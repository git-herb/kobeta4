"""ffmpeg / ffprobe 실행 어댑터."""
from __future__ import annotations

import subprocess
from pathlib import Path

from . import ffparse


class MediaError(RuntimeError):
    pass


def _run(cmd: list[str], timeout: int = 600) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)


def probe(path: str) -> dict:
    p = _run(["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", path], timeout=60)
    if p.returncode != 0:
        raise MediaError(f"ffprobe 실패: {p.stderr[:300]}")
    return ffparse.parse_ffprobe_json(p.stdout)


def extract_subtitles(path: str) -> str | None:
    p = _run(["ffmpeg", "-v", "error", "-i", path, "-map", "0:s:0", "-f", "srt", "-"], timeout=120)
    if p.returncode != 0 or not p.stdout.strip():
        return None
    return p.stdout


def extract_audio(path: str, out_wav: str) -> str:
    p = _run(["ffmpeg", "-y", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", out_wav], timeout=900)
    if p.returncode != 0:
        raise MediaError(f"오디오 추출 실패: {p.stderr[:300]}")
    return out_wav


def extract_frames(path: str, out_dir: str, interval: float = 1.0) -> list[tuple[float, str]]:
    """interval 초 간격 프레임 추출 → [(초, 파일경로)]."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    pattern = str(out / "f%06d.jpg")
    p = _run(
        ["ffmpeg", "-y", "-v", "error", "-i", path,
         "-vf", f"fps=1/{interval},scale=640:-2", "-q:v", "4", pattern],
        timeout=1800,
    )
    if p.returncode != 0:
        raise MediaError(f"프레임 추출 실패: {p.stderr[:300]}")
    files = sorted(out.glob("f*.jpg"))
    return [((i + 0.5) * interval, str(f)) for i, f in enumerate(files)]


def extract_frame_at(path: str, t: float, out_file: str) -> str:
    p = _run(
        ["ffmpeg", "-y", "-v", "error", "-ss", str(t), "-i", path,
         "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "4", out_file],
        timeout=60,
    )
    if p.returncode != 0:
        raise MediaError(f"프레임 캡처 실패: {p.stderr[:300]}")
    return out_file


def detect_tech(path: str) -> list[dict]:
    """무음 / 블랙 / 프리즈 / 클리핑 감지 (PRD 4-2 기술 검토)."""
    out: list[dict] = []
    p = _run(["ffmpeg", "-v", "info", "-i", path, "-af", "silencedetect=n=-35dB:d=1", "-f", "null", "-"], timeout=900)
    out += ffparse.parse_silencedetect(p.stderr)
    p = _run(["ffmpeg", "-v", "info", "-i", path, "-vf", "blackdetect=d=0.5:pic_th=0.98", "-an", "-f", "null", "-"], timeout=900)
    out += ffparse.parse_blackdetect(p.stderr)
    p = _run(["ffmpeg", "-v", "info", "-i", path, "-vf", "freezedetect=n=0.003:d=2", "-an", "-f", "null", "-"], timeout=900)
    out += ffparse.parse_freezedetect(p.stderr)
    p = _run(
        ["ffmpeg", "-v", "info", "-i", path,
         "-af", "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Number_of_clipped_samples",
         "-f", "null", "-"],
        timeout=900,
    )
    out += ffparse.parse_clipping(p.stderr)
    return out
