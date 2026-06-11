"""처리 파이프라인 — 영상 내 병렬 8단계 (PRD §5).

병렬: [자막 추출→자막 교정] · [장면 분석] · [기술 검토] · [프레임 샘플링→프레임별 금칙 판정]
순서: 색인 생성(자막+장면 후) → 종합 판정(전부 끝난 뒤)
한 단계 실패가 다른 병렬 단계를 중단시키지 않는다.
"""
from __future__ import annotations

import asyncio
import traceback
from pathlib import Path

import numpy as np

from . import ai, db, ffparse, indexer, media, reports, stt, telegram
from .config import settings
from .domain import aggregate, fmt_tc, sev_label


class Deps:
    """테스트에서 통째로 갈아끼우는 의존성 묶음."""

    def __init__(self) -> None:
        self.media = media
        self.stt = stt
        self.ai = ai
        self.indexer = indexer
        self.telegram = telegram
        self.reports = reports
        self.settings = settings
        self._client = None

    def client(self):
        if self._client is None:
            self._client = ai.get_client()
        return self._client


async def run_pipeline(conn, vid: str, src_path: str, deps: Deps | None = None) -> None:
    deps = deps or Deps()
    s = deps.settings
    vrow = db.get_video(conn, vid)
    ai_model = (vrow["ai_model"] if vrow and vrow["ai_model"] else ai_model)
    frame_interval = (vrow["frame_interval"] if vrow and vrow["frame_interval"] else frame_interval)
    vdir = s.video_dir(vid)
    vdir.mkdir(parents=True, exist_ok=True)
    loop = asyncio.get_running_loop()

    def bg(fn, *args, **kw):
        return loop.run_in_executor(None, lambda: fn(*args, **kw))

    async def stage(name: str, coro):
        """단계 실행 래퍼 — 실패해도 다른 단계는 계속 (PRD 4-2)."""
        db.set_stage(conn, vid, name, pct=0, state="run")
        try:
            result = await coro
            db.set_stage(conn, vid, name, pct=100, state="done")
            return result
        except Exception as e:
            traceback.print_exc()
            db.set_stage(conn, vid, name, state="failed", error=str(e)[:500])
            return None

    def pct(name: str, value: float):
        db.set_stage(conn, vid, name, pct=min(99, value))

    # ---------- 0. 메타데이터 ----------
    try:
        meta = await bg(deps.media.probe, src_path)
    except Exception as e:
        db.update_video(conn, vid, status="failed", verdict=f"메타데이터 실패: {e}")
        return
    duration = meta["duration"]
    db.update_video(
        conn, vid,
        duration_sec=duration,
        size_bytes=meta["size_bytes"],
        resolution=f"{meta['width']}×{meta['height']} · {meta['fps']}fps",
        fps=meta["fps"],
        codec=f"{meta['vcodec']} / {meta['acodec']}".strip(" /"),
    )

    captions_done = asyncio.Event()
    scenes_done = asyncio.Event()
    transcript_rows: list[dict] = []
    scene_rows: list[dict] = []
    frame_rows: list[dict] = []

    # ---------- 자막 추출 → 자막 교정 ----------
    async def captions_branch():
        async def extract():
            pct("자막 추출", 10)
            srt = await bg(deps.media.extract_subtitles, src_path) if meta.get("has_subtitles") else None
            if srt:
                lines = ffparse.parse_srt(srt)
                source = "임베디드 자막"
            else:
                pct("자막 추출", 30)
                wav = str(vdir / "audio.wav")
                await bg(deps.media.extract_audio, src_path, wav)
                pct("자막 추출", 50)
                lines = await bg(deps.stt.transcribe, wav, s.whisper_model)
                source = "음성 인식(STT)"
            db.update_video(conn, vid, caption_source=source)
            return lines

        lines = await stage("자막 추출", extract())
        if lines is None:
            db.update_video(conn, vid, caption_source="추출 실패")
            db.set_stage(conn, vid, "자막 교정", state="failed", error="자막 없음 — 교정 생략")
            captions_done.set()
            return

        async def correct():
            corrections = await bg(deps.ai.correct_captions, deps.client(), ai_model, lines)
            fix_map = {c["orig"]: c for c in corrections}
            for line in lines:
                hit = fix_map.get(line["text"])
                if hit:
                    line["text"] = hit["fix"]
                    line["corrected"] = True
            db.insert_many(conn, "corrections", vid, [
                {"tc": c["tc"], "orig": c["orig"], "fix": c["fix"]} for c in corrections
            ])
            return lines

        corrected = await stage("자막 교정", correct()) or lines
        transcript_rows.extend(corrected)
        db.insert_many(conn, "transcript", vid, [
            {"t": l["t"], "tc": l["tc"], "text": l["text"], "corrected": 1 if l.get("corrected") else 0}
            for l in corrected
        ])
        captions_done.set()

    # ---------- 장면 분석 ----------
    async def scenes_branch():
        async def run():
            times = list(np.arange(s.scene_interval / 2, duration, s.scene_interval))[:12]
            if not times and duration > 0:
                times = [duration / 2]
            for i, t in enumerate(times):
                img = str(vdir / f"scene_{int(t):06d}.jpg")
                await bg(deps.media.extract_frame_at, src_path, float(t), img)
                desc = await bg(deps.ai.analyze_scene, deps.client(), ai_model,
                                Path(img).read_bytes(), fmt_tc(t))
                scene_rows.append({"t": float(t), "tc": fmt_tc(t), "descr": desc, "img": Path(img).name})
                pct("장면 분석", (i + 1) / len(times) * 100)
            db.insert_many(conn, "scenes", vid, scene_rows)

        await stage("장면 분석", run())
        scenes_done.set()

    # ---------- 기술 검토 ----------
    async def tech_branch():
        async def run():
            pct("기술 검토", 20)
            found = await bg(deps.media.detect_tech, src_path)
            db.insert_many(conn, "tech", vid, [
                {"kind": f["kind"], "start": f["start"], "end": f["end"]} for f in found
            ])

        await stage("기술 검토", run())

    # ---------- 프레임 샘플링 → 금칙 판정 ----------
    async def moderation_branch():
        async def sample():
            pct("프레임 샘플링", 10)
            frames = await bg(deps.media.extract_frames, src_path, str(vdir / "frames"), frame_interval)
            return frames

        frames = await stage("프레임 샘플링", sample())
        if not frames:
            db.set_stage(conn, vid, "프레임별 금칙 판정", state="failed", error="샘플링 프레임 없음")
            return
        db.update_video(conn, vid, frames_sampled=len(frames))

        async def judge():
            rules_text = s.rules_path.read_text(encoding="utf-8")
            win = max(1, s.mod_window)
            windows = [frames[i:i + win] for i in range(0, len(frames), win)]
            sem = asyncio.Semaphore(4)

            async def one(window):
                async with sem:
                    mid = window[len(window) // 2]
                    snippet = " / ".join(
                        l["text"] for l in transcript_rows if abs(l["t"] - mid[0]) <= win * frame_interval
                    )[:500]
                    imgs = [Path(f[1]).read_bytes() for f in window]
                    verdict = await bg(deps.ai.judge_window, deps.client(), ai_model,
                                       imgs, snippet, rules_text, fmt_tc(mid[0]))
                    return window, verdict

            done = 0
            for coro in asyncio.as_completed([one(w) for w in windows]):
                window, v = await coro
                done += 1
                pct("프레임별 금칙 판정", done / len(windows) * 100)
                mid = window[len(window) // 2]
                row = {
                    "t": mid[0], "tc": fmt_tc(mid[0]),
                    "category": v["category"], "sev": v["sev"],
                    "rule": v["rule"], "reason": v["reason"], "sound": v["sound"],
                    "img": Path(mid[1]).name,
                    "img_prev": Path(window[0][1]).name,
                    "img_next": Path(window[-1][1]).name,
                }
                frame_rows.append(row)
                if v["sev"] >= 3:
                    db.insert_many(conn, "frames", vid, [row])

        await stage("프레임별 금칙 판정", judge())

    await asyncio.gather(captions_branch(), scenes_branch(), tech_branch(), moderation_branch())

    # ---------- 색인 생성 (자막+장면 완료 후) ----------
    async def index_run():
        await asyncio.wait_for(asyncio.gather(captions_done.wait(), scenes_done.wait()), timeout=5)
        await bg(deps.indexer.index_video, conn, vid, transcript_rows, scene_rows, s.voyage_api_key)

    await stage("색인 생성", index_run())

    # ---------- 종합 판정 ----------
    async def final_run():
        agg = aggregate(frame_rows)
        db.update_video(
            conn, vid, status="done",
            violation=agg["violation"], review=agg["review"],
            max_sev=agg["max_sev"], verdict=agg["verdict"],
            categories_hit=",".join(agg["categories_hit"]),
        )
        conn.execute("UPDATE videos SET pass=? WHERE id=?", (agg["pass"], vid))
        conn.commit()
        video = db.get_video(conn, vid)
        report = {
            "video_id": vid,
            "title": video["title"],
            "summary": {
                "verdict": agg["verdict"], "max_sev": agg["max_sev"],
                "frames_sampled": video["frames_sampled"],
                "violation": agg["violation"], "review": agg["review"],
                "categories_hit": agg["categories_hit"],
            },
            "frames": [
                {**{k: r[k] for k in ("tc", "t", "category", "sev", "rule", "reason", "sound", "img")},
                 "verdict": sev_label(r["sev"])}
                for r in sorted(frame_rows, key=lambda r: -r["sev"]) if r["sev"] >= 3
            ],
            "tech": [dict(r) for r in map(dict, db.rows(conn, "tech", vid))],
            "scenes": scene_rows,
            "corrections": [dict(r) for r in map(dict, db.rows(conn, "corrections", vid))],
        }
        deps.reports.write_outputs(vdir, report)
        deps.telegram.notify(
            f"✅ 처리 완료: {video['title']}\n종합 판정: {agg['verdict']} (최고 심각도 {agg['max_sev']})\n"
            f"방영 불가 {agg['violation']} · 검토 필요 {agg['review']}\n"
            f"카테고리: {', '.join(agg['categories_hit']) or '없음'}",
            s.telegram_bot_token, s.telegram_chat_id,
        )

    await stage("종합 판정", final_run())
    row = db.get_video(conn, vid)
    if row["status"] == "processing":
        db.update_video(conn, vid, status="done")
