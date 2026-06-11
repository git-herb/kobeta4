"""REST API — 업로드 / 목록 / 진행 / 리포트 / 검색 / 삭제."""
from __future__ import annotations

import asyncio
import shutil
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import db, search as search_mod
from .config import settings
from .domain import build_timeline, fmt_tc, sev_label
from .pipeline import Deps, run_pipeline

app = FastAPI(title="영상 아카이브 & 검수 시스템")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_conn = None


def conn():
    global _conn
    if _conn is None:
        _conn = db.connect(settings.db_path)
    return _conn


def _video_json(r) -> dict:
    return {
        "id": r["id"],
        "title": r["title"],
        "status": r["status"],
        "duration": fmt_tc(r["duration_sec"]),
        "durationSec": r["duration_sec"],
        "size": f"{r['size_bytes'] / 1e9:.1f} GB" if r["size_bytes"] >= 1e9 else f"{r['size_bytes'] / 1e6:.1f} MB",
        "uploadedAt": r["uploaded_at"],
        "captionSource": r["caption_source"],
        "counts": {"violation": r["violation"], "review": r["review"], "pass": r["pass"]},
        "maxSev": r["max_sev"],
        "verdict": r["verdict"] or sev_label(r["max_sev"]),
    }


@app.post("/api/videos")
async def upload(file: UploadFile):
    vid = f"v-{uuid.uuid4().hex[:8]}"
    vdir = settings.video_dir(vid)
    vdir.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "video.mp4").suffix or ".mp4"
    dest = vdir / f"source{ext}"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    db.create_video(conn(), vid, file.filename or dest.name, dest.name, datetime.now().strftime("%Y-%m-%d %H:%M"))
    db.update_video(conn(), vid, size_bytes=dest.stat().st_size)
    asyncio.create_task(run_pipeline(conn(), vid, str(dest), Deps()))
    return {"id": vid}


@app.get("/api/videos")
def list_videos():
    return [_video_json(r) for r in db.list_videos(conn())]


@app.get("/api/videos/{vid}")
def get_video(vid: str):
    r = db.get_video(conn(), vid)
    if not r:
        raise HTTPException(404)
    return _video_json(r)


@app.get("/api/videos/{vid}/progress")
def progress(vid: str):
    r = db.get_video(conn(), vid)
    if not r:
        raise HTTPException(404)
    stages = [
        {"name": s["name"], "pct": round(s["pct"]), "state": s["state"], "error": s["error"]}
        for s in db.get_stages(conn(), vid)
    ]
    overall = round(sum(s["pct"] for s in stages) / max(1, len(stages)))
    return {"id": vid, "status": r["status"], "title": r["title"], "overall": overall, "stages": stages}


@app.get("/api/videos/{vid}/report")
def report(vid: str):
    c = conn()
    r = db.get_video(c, vid)
    if not r:
        raise HTTPException(404)
    duration = r["duration_sec"] or 1
    frames = [dict(x) for x in db.rows(c, "frames", vid)]
    tech = [dict(x) for x in db.rows(c, "tech", vid)]
    segs = build_timeline(duration, tech, frames)
    timeline = [
        {"type": s["type"], "from": s["from"] / duration * 100, "to": s["to"] / duration * 100}
        for s in segs
    ]
    ticks = [fmt_tc(duration * i / 4) for i in range(5)]
    tech_grouped: dict[str, list[str]] = {"silence": [], "black": [], "freeze": [], "clipping": []}
    for t in tech:
        tech_grouped.setdefault(t["kind"], []).append(f"{fmt_tc(t['start'])}–{fmt_tc(t['end'])}")
    return {
        **_video_json(r),
        "resolution": r["resolution"],
        "codec": r["codec"],
        "framesSampled": r["frames_sampled"],
        "categoriesHit": [x for x in (r["categories_hit"] or "").split(",") if x],
        "timeline": timeline,
        "ticks": ticks,
        "frames": [
            {
                "tc": f["tc"], "category": f["category"], "sev": f["sev"],
                "rule": f["rule"], "reason": f["reason"], "sound": f["sound"],
                "img": f"/api/videos/{vid}/frames/{f['img']}" if f["img"] else "",
                "imgPrev": f"/api/videos/{vid}/frames/{f['img_prev']}" if f["img_prev"] else "",
                "imgNext": f"/api/videos/{vid}/frames/{f['img_next']}" if f["img_next"] else "",
            }
            for f in frames
        ],
        "tech": tech_grouped,
        "scenes": [
            {"tc": s["tc"], "desc": s["descr"], "img": f"/api/videos/{vid}/frames/{s['img']}" if s["img"] else ""}
            for s in map(dict, db.rows(c, "scenes", vid))
        ],
        "corrections": [{"tc": x["tc"], "orig": x["orig"], "fix": x["fix"]} for x in db.rows(c, "corrections", vid)],
        "transcript": [
            {"tc": x["tc"], "text": x["text"], "corrected": bool(x["corrected"]), "flag": bool(x["flag"])}
            for x in db.rows(c, "transcript", vid)
        ],
    }


@app.get("/api/videos/{vid}/frames/{name}")
def frame_image(vid: str, name: str):
    if "/" in name or "\\" in name or ".." in name:
        raise HTTPException(400)
    for sub in ("frames", "."):
        p = settings.video_dir(vid) / sub / name
        if p.exists():
            return FileResponse(p)
    raise HTTPException(404)


@app.get("/api/videos/{vid}/report.json")
def report_file(vid: str):
    p = settings.video_dir(vid) / "report.json"
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p, filename="report.json")


@app.get("/api/videos/{vid}/violations.csv")
def violations_file(vid: str):
    p = settings.video_dir(vid) / "violations.csv"
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p, filename="violations.csv")


@app.delete("/api/videos/{vid}")
def delete(vid: str):
    c = conn()
    r = db.get_video(c, vid)
    if not r:
        raise HTTPException(404)
    if r["status"] == "processing":
        raise HTTPException(409, "처리 중인 영상은 삭제할 수 없습니다")
    db.delete_video(c, vid)
    shutil.rmtree(settings.video_dir(vid), ignore_errors=True)
    return {"deleted": vid}


@app.get("/api/search")
def search(q: str = "", mode: str = "hybrid", video_id: str = "", date: str = ""):
    c = conn()
    hits = search_mod.search(c, q, mode=mode, voyage_key=settings.voyage_api_key, video_id=video_id, date=date)
    titles = {r["id"]: r["title"] for r in db.list_videos(c)}
    out = []
    for h in hits:
        thumb = ""
        row = c.execute(
            "SELECT img FROM scenes WHERE video_id=? ORDER BY ABS(t-?) LIMIT 1", (h["video_id"], h["t"]),
        ).fetchone()
        if row and row["img"]:
            thumb = f"/api/videos/{h['video_id']}/frames/{row['img']}"
        out.append({
            "videoId": h["video_id"],
            "videoTitle": titles.get(h["video_id"], h["video_id"]),
            "tc": h["tc"], "snippet": h["snippet"],
            "source": h["source"], "reason": h["reason"], "thumb": thumb,
        })
    return {"q": q, "mode": mode, "results": out}
