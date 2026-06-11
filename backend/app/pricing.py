"""모델 목록 · API 비용 추정.

가격은 1M 토큰당 USD. 5.1 이상은 공시가 미확정으로 5 시리즈 기준 추정치(approx).
이미지 토큰은 640px 프레임 기준 근사치를 쓴다 — 추정용이며 실제 청구액과 다를 수 있다.
"""
from __future__ import annotations

import math

MODELS = [
    {"id": "gpt-4o-mini",   "label": "GPT-4o mini",   "in": 0.15, "out": 0.60,  "approx": False, "note": "기본 · 가장 저렴"},
    {"id": "gpt-4.1-mini",  "label": "GPT-4.1 mini",  "in": 0.40, "out": 1.60,  "approx": False, "note": ""},
    {"id": "gpt-5-nano",    "label": "GPT-5 nano",    "in": 0.05, "out": 0.40,  "approx": False, "note": ""},
    {"id": "gpt-5-mini",    "label": "GPT-5 mini",    "in": 0.25, "out": 2.00,  "approx": False, "note": ""},
    {"id": "gpt-5",         "label": "GPT-5",         "in": 1.25, "out": 10.00, "approx": False, "note": ""},
    {"id": "gpt-5.1",       "label": "GPT-5.1",       "in": 1.25, "out": 10.00, "approx": True,  "note": ""},
    {"id": "gpt-5.2",       "label": "GPT-5.2",       "in": 1.25, "out": 10.00, "approx": True,  "note": ""},
    {"id": "gpt-5.4-mini",  "label": "GPT-5.4 mini",  "in": 0.25, "out": 2.00,  "approx": True,  "note": ""},
    {"id": "gpt-5.4",       "label": "GPT-5.4",       "in": 1.25, "out": 10.00, "approx": True,  "note": "최고 품질"},
]

_BY_ID = {m["id"]: m for m in MODELS}

# 호출당 토큰 근사치
_IMG_TOK = 500          # 640px 프레임 1장
_RULES_TOK = 2000       # 금칙기준.md + 시스템 프롬프트
_JUDGE_OUT = 120
_SCENE_IN = 1100
_SCENE_OUT = 80
USD_KRW = 1450


def estimate(duration: float, interval: float, model: str, window: int = 3) -> dict:
    m = _BY_ID.get(model, MODELS[0])
    duration = max(1.0, duration)
    interval = min(10.0, max(1.0, interval))

    n_frames = math.ceil(duration / interval)
    n_windows = math.ceil(n_frames / window)
    judge_in = n_windows * (_RULES_TOK + window * _IMG_TOK + 150)
    judge_out = n_windows * _JUDGE_OUT

    n_scenes = min(12, max(1, int(duration // 120)))
    scene_in = n_scenes * _SCENE_IN
    scene_out = n_scenes * _SCENE_OUT

    corr_in = min(9000, 500 + int(duration * 2))
    corr_out = int(corr_in * 0.15)

    tok_in = judge_in + scene_in + corr_in
    tok_out = judge_out + scene_out + corr_out
    usd = tok_in / 1e6 * m["in"] + tok_out / 1e6 * m["out"]
    return {
        "model": m["id"],
        "interval": interval,
        "frames": n_frames,
        "judge_calls": n_windows,
        "scene_calls": n_scenes,
        "input_tokens": tok_in,
        "output_tokens": tok_out,
        "total_tokens": tok_in + tok_out,
        "usd": round(usd, 4),
        "krw": int(usd * USD_KRW),
        "approx": m["approx"],
    }
