"""임베딩 — VOYAGE_API_KEY가 있으면 Voyage AI, 없으면 로컬 문자 n-gram 해시 임베딩.

로컬 모드는 의미 품질이 떨어지지만 키 없이도 전체 시스템이 동작하게 한다.
"""
from __future__ import annotations

import hashlib

import httpx
import numpy as np

DIM = 512


def _local_embed(texts: list[str]) -> np.ndarray:
    out = np.zeros((len(texts), DIM), dtype=np.float32)
    for i, text in enumerate(texts):
        s = f"  {text.lower()}  "
        for n in (2, 3):
            for j in range(len(s) - n + 1):
                gram = s[j:j + n]
                h = int.from_bytes(hashlib.md5(gram.encode()).digest()[:4], "little")
                out[i, h % DIM] += 1.0
        norm = np.linalg.norm(out[i])
        if norm > 0:
            out[i] /= norm
    return out


def _voyage_embed(texts: list[str], api_key: str, input_type: str) -> np.ndarray:
    r = httpx.post(
        "https://api.voyageai.com/v1/embeddings",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"model": "voyage-3.5", "input": texts, "input_type": input_type},
        timeout=60,
    )
    r.raise_for_status()
    vecs = np.array([d["embedding"] for d in r.json()["data"]], dtype=np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    norms[norms == 0] = 1
    return vecs / norms


def embed(texts: list[str], api_key: str = "", input_type: str = "document") -> np.ndarray:
    if not texts:
        return np.zeros((0, DIM), dtype=np.float32)
    if api_key:
        try:
            return _voyage_embed(texts, api_key, input_type)
        except Exception:
            pass  # 임베딩 실패 시 로컬로 폴백 — 단계 전체 실패 방지
    return _local_embed(texts)
