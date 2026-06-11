"""검색 — 모드 4종: hybrid(기본) / keyword / vector / filter (PRD 4-3).

각 결과에 출처(keyword/vector/both)와 매칭 이유를 함께 담는다.
"""
from __future__ import annotations

import re

import numpy as np

from . import embedder

TOP_K = 12


def _fts_query(q: str) -> str:
    # 한국어 조사("야경에서")까지 잡도록 접두사 매칭 사용
    terms = [t for t in re.findall(r"[\w가-힣]+", q) if t]
    return " OR ".join(f'"{t}"*' for t in terms) if terms else '""'


def _keyword_hits(conn, q: str) -> list[dict]:
    try:
        rows = conn.execute(
            "SELECT content, video_id, ref_type, tc, t, bm25(search_fts) AS rank "
            "FROM search_fts WHERE search_fts MATCH ? ORDER BY rank LIMIT ?",
            (_fts_query(q), TOP_K * 2),
        ).fetchall()
    except Exception:
        return []
    out = []
    for r in rows:
        out.append({
            "video_id": r["video_id"], "ref_type": r["ref_type"], "tc": r["tc"], "t": r["t"],
            "content": r["content"], "score": -float(r["rank"]),
        })
    return out


def _vector_hits(conn, q: str, voyage_key: str) -> list[dict]:
    rows = conn.execute("SELECT video_id, ref_type, t, tc, content, vec FROM embeddings").fetchall()
    if not rows:
        return []
    qv = embedder.embed([q], api_key=voyage_key, input_type="query")[0]
    mat = np.stack([np.frombuffer(r["vec"], dtype=np.float32) for r in rows])
    sims = mat @ qv
    order = np.argsort(-sims)[: TOP_K * 2]
    return [
        {
            "video_id": rows[i]["video_id"], "ref_type": rows[i]["ref_type"], "tc": rows[i]["tc"],
            "t": rows[i]["t"], "content": rows[i]["content"], "score": float(sims[i]),
        }
        for i in order if sims[i] > 0.05
    ]


def _normalize(hits: list[dict]) -> dict[tuple, float]:
    if not hits:
        return {}
    scores = [h["score"] for h in hits]
    lo, hi = min(scores), max(scores)
    span = (hi - lo) or 1.0
    return {(h["video_id"], h["tc"], h["ref_type"]): (h["score"] - lo) / span for h in hits}


def search(conn, q: str, mode: str = "hybrid", voyage_key: str = "", video_id: str = "", date: str = "") -> list[dict]:
    q = q.strip()
    kw = _keyword_hits(conn, q) if mode in ("hybrid", "keyword", "filter") and q else []
    vc = _vector_hits(conn, q, voyage_key) if mode in ("hybrid", "vector") and q else []

    pool: dict[tuple, dict] = {}
    kn, vn = _normalize(kw), _normalize(vc)
    for h in kw + vc:
        key = (h["video_id"], h["tc"], h["ref_type"])
        if key not in pool:
            pool[key] = h
    results = []
    for key, h in pool.items():
        in_k, in_v = key in kn, key in vn
        score = kn.get(key, 0.0) + vn.get(key, 0.0)
        source = "both" if (in_k and in_v) else ("keyword" if in_k else "vector")
        if in_k and in_v:
            reason = f"키워드 일치 + 의미 유사도 {vn[key]:.2f} 동시 매칭"
        elif in_k:
            reason = "자막·장면 키워드 정확 일치"
        else:
            reason = f"의미 유사 — 벡터 매칭 {vn[key]:.2f}"
        ref = "장면 설명" if h["ref_type"] == "scene" else "자막"
        results.append({
            "video_id": h["video_id"], "tc": h["tc"], "t": h["t"],
            "snippet": h["content"], "source": source,
            "reason": f"{reason} ({ref})", "score": score,
        })

    # filter 모드: 조건(영상/날짜)으로 좁히기 — 질의 없으면 전체에서 조건만 적용
    if mode == "filter":
        if not q:
            rows = conn.execute("SELECT content, video_id, ref_type, tc, t FROM search_fts LIMIT 200").fetchall()
            results = [{
                "video_id": r["video_id"], "tc": r["tc"], "t": r["t"], "snippet": r["content"],
                "source": "keyword", "reason": "조건 검색 (전체 색인)", "score": 0.0,
            } for r in rows]
    if video_id:
        results = [r for r in results if r["video_id"] == video_id]
    if date:
        ok = {r["id"] for r in conn.execute("SELECT id FROM videos WHERE uploaded_at LIKE ?", (f"{date}%",))}
        results = [r for r in results if r["video_id"] in ok]

    results.sort(key=lambda r: -r["score"])
    # 영상+근접 타임코드 중복 제거
    seen, dedup = set(), []
    for r in results:
        key = (r["video_id"], r["tc"])
        if key in seen:
            continue
        seen.add(key)
        dedup.append(r)
    return dedup[:TOP_K]
