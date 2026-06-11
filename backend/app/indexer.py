"""색인 생성 — 자막/장면 설명을 FTS5(키워드)와 embeddings(벡터)에 동시 저장."""
from __future__ import annotations

import numpy as np

from . import embedder


def index_video(conn, vid: str, transcript: list[dict], scenes: list[dict], voyage_key: str = "") -> int:
    docs: list[dict] = []
    for line in transcript:
        if line["text"].strip():
            docs.append({"ref_type": "transcript", "t": line["t"], "tc": line["tc"], "content": line["text"]})
    for s in scenes:
        docs.append({"ref_type": "scene", "t": s["t"], "tc": s["tc"], "content": s["descr"]})
    if not docs:
        return 0
    vecs = embedder.embed([d["content"] for d in docs], api_key=voyage_key)
    for d, v in zip(docs, vecs):
        conn.execute(
            "INSERT INTO search_fts (content, video_id, ref_type, tc, t) VALUES (?,?,?,?,?)",
            (d["content"], vid, d["ref_type"], d["tc"], d["t"]),
        )
        conn.execute(
            "INSERT INTO embeddings (video_id, ref_type, t, tc, content, vec) VALUES (?,?,?,?,?,?)",
            (vid, d["ref_type"], d["t"], d["tc"], d["content"], np.asarray(v, dtype=np.float32).tobytes()),
        )
    conn.commit()
    return len(docs)
