"""ffmpeg / ffprobe 출력 파서 (순수 함수)."""
from __future__ import annotations

import json
import re


def parse_silencedetect(stderr: str) -> list[dict]:
    out = []
    start = None
    for m in re.finditer(r"silence_(start|end): ([0-9.]+)", stderr):
        if m.group(1) == "start":
            start = float(m.group(2))
        elif start is not None:
            out.append({"kind": "silence", "start": start, "end": float(m.group(2))})
            start = None
    return out


def parse_blackdetect(stderr: str) -> list[dict]:
    return [
        {"kind": "black", "start": float(m.group(1)), "end": float(m.group(2))}
        for m in re.finditer(r"black_start:([0-9.]+) black_end:([0-9.]+)", stderr)
    ]


def parse_freezedetect(stderr: str) -> list[dict]:
    out = []
    start = None
    for m in re.finditer(r"freezedetect\.freeze_(start|end): ([0-9.]+)", stderr):
        if m.group(1) == "start":
            start = float(m.group(2))
        elif start is not None:
            out.append({"kind": "freeze", "start": start, "end": float(m.group(2))})
            start = None
    return out


def parse_clipping(stderr: str, frame_dur: float = 1.0) -> list[dict]:
    """astats(ametadata) 출력에서 클리핑 샘플이 있는 시간대를 구간으로 묶는다."""
    times = []
    t = None
    for line in stderr.splitlines():
        m = re.search(r"pts_time:([0-9.]+)", line)
        if m:
            t = float(m.group(1))
            continue
        m = re.search(r"Number_of_clipped_samples=([0-9]+)", line.replace(" ", "_"))
        if not m:
            m = re.search(r"Number of clipped samples[:=]\s*([0-9]+)", line)
        if m and t is not None and int(m.group(1)) > 0:
            times.append(t)
    out: list[dict] = []
    for t in times:
        if out and t <= out[-1]["end"] + frame_dur:
            out[-1]["end"] = t + frame_dur
        else:
            out.append({"kind": "clipping", "start": t, "end": t + frame_dur})
    return out


def parse_ffprobe_json(text: str) -> dict:
    data = json.loads(text)
    fmt = data.get("format", {})
    streams = data.get("streams", [])
    v = next((s for s in streams if s.get("codec_type") == "video"), {})
    a = next((s for s in streams if s.get("codec_type") == "audio"), {})
    has_subs = any(s.get("codec_type") == "subtitle" for s in streams)
    fps = 0.0
    if v.get("avg_frame_rate") and v["avg_frame_rate"] != "0/0":
        num, _, den = v["avg_frame_rate"].partition("/")
        if float(den or 1) > 0:
            fps = float(num) / float(den or 1)
    return {
        "duration": float(fmt.get("duration", 0) or 0),
        "size_bytes": int(fmt.get("size", 0) or 0),
        "width": int(v.get("width", 0) or 0),
        "height": int(v.get("height", 0) or 0),
        "fps": round(fps, 3),
        "vcodec": (v.get("codec_name") or "").upper(),
        "acodec": (a.get("codec_name") or "").upper(),
        "has_subtitles": has_subs,
    }


_TS = re.compile(r"(\d+):(\d+):(\d+)[,.](\d+)")


def _ts(s: str) -> float:
    m = _TS.match(s.strip())
    if not m:
        return 0.0
    h, mi, se, ms = (int(x) for x in m.groups())
    return h * 3600 + mi * 60 + se + ms / 1000


def parse_srt(text: str) -> list[dict]:
    from .domain import fmt_tc

    out = []
    for block in re.split(r"\n\s*\n", text.strip().replace("\r\n", "\n")):
        lines = [l for l in block.splitlines() if l.strip()]
        if len(lines) < 2:
            continue
        idx = 1 if "-->" in lines[1] else (0 if "-->" in lines[0] else -1)
        if idx < 0:
            continue
        start_s, _, end_s = lines[idx].partition("-->")
        body = " ".join(lines[idx + 1:]).strip()
        body = re.sub(r"<[^>]+>", "", body)
        if not body:
            continue
        t = _ts(start_s)
        out.append({"t": t, "tc": fmt_tc(t), "end": _ts(end_s), "text": body})
    return out
