"""음성 인식(STT) — 자막 트랙이 없는 영상의 자막 생성 (PRD 4-2 v1.1)."""
from __future__ import annotations

from .domain import fmt_tc


class SttUnavailable(RuntimeError):
    pass


def transcribe(wav_path: str, model_size: str = "small") -> list[dict]:
    try:
        from faster_whisper import WhisperModel
    except ImportError as e:
        raise SttUnavailable("faster-whisper가 설치되어 있지 않습니다") from e

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(wav_path, language="ko", vad_filter=True)
    out = []
    for seg in segments:
        text = seg.text.strip()
        if text:
            out.append({"t": float(seg.start), "tc": fmt_tc(seg.start), "end": float(seg.end), "text": text})
    return out
