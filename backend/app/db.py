"""SQLite 저장소 — 키워드 검색용 FTS5 + 벡터 검색용 embeddings (PRD §7 저장소 2종)."""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',   -- processing | done | failed
  size_bytes INTEGER DEFAULT 0,
  duration_sec REAL DEFAULT 0,
  resolution TEXT DEFAULT '',
  fps REAL DEFAULT 0,
  codec TEXT DEFAULT '',
  caption_source TEXT DEFAULT '—',
  uploaded_at TEXT NOT NULL,
  frames_sampled INTEGER DEFAULT 0,
  violation INTEGER DEFAULT 0,
  review INTEGER DEFAULT 0,
  pass INTEGER DEFAULT 0,
  max_sev INTEGER DEFAULT 0,
  verdict TEXT DEFAULT '',
  categories_hit TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS stages (
  video_id TEXT NOT NULL,
  name TEXT NOT NULL,
  pct REAL DEFAULT 0,
  state TEXT DEFAULT 'wait',                   -- wait | run | done | failed
  error TEXT DEFAULT '',
  PRIMARY KEY (video_id, name)
);
CREATE TABLE IF NOT EXISTS frames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  t REAL NOT NULL,
  tc TEXT NOT NULL,
  category TEXT NOT NULL,
  sev INTEGER NOT NULL,
  rule TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  sound TEXT DEFAULT '',
  img TEXT DEFAULT '',
  img_prev TEXT DEFAULT '',
  img_next TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  t REAL NOT NULL,
  tc TEXT NOT NULL,
  descr TEXT NOT NULL,
  img TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS transcript (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  t REAL NOT NULL,
  tc TEXT NOT NULL,
  text TEXT NOT NULL,
  corrected INTEGER DEFAULT 0,
  flag INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  tc TEXT NOT NULL,
  orig TEXT NOT NULL,
  fix TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tech (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  kind TEXT NOT NULL,                          -- silence | black | freeze | clipping
  start REAL NOT NULL,
  end REAL NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
  content, video_id UNINDEXED, ref_type UNINDEXED, tc UNINDEXED, t UNINDEXED
);
CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL,
  ref_type TEXT NOT NULL,                      -- transcript | scene
  t REAL NOT NULL,
  tc TEXT NOT NULL,
  content TEXT NOT NULL,
  vec BLOB NOT NULL
);
"""


def connect(path: str | Path) -> sqlite3.Connection:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    for ddl in (
        "ALTER TABLE videos ADD COLUMN ai_model TEXT DEFAULT ''",
        "ALTER TABLE videos ADD COLUMN frame_interval REAL DEFAULT 0",
    ):
        try:
            conn.execute(ddl)
        except sqlite3.OperationalError:
            pass  # 이미 적용된 마이그레이션
    return conn


STAGE_NAMES = [
    "자막 추출", "자막 교정", "장면 분석", "기술 검토",
    "프레임 샘플링", "프레임별 금칙 판정", "색인 생성", "종합 판정",
]


def create_video(conn, vid: str, title: str, filename: str, uploaded_at: str) -> None:
    conn.execute(
        "INSERT INTO videos (id, title, filename, uploaded_at) VALUES (?,?,?,?)",
        (vid, title, filename, uploaded_at),
    )
    for name in STAGE_NAMES:
        conn.execute(
            "INSERT OR REPLACE INTO stages (video_id, name, pct, state) VALUES (?,?,0,'wait')",
            (vid, name),
        )
    conn.commit()


def update_video(conn, vid: str, **fields) -> None:
    cols = ", ".join(f"{k}=?" for k in fields)
    conn.execute(f"UPDATE videos SET {cols} WHERE id=?", (*fields.values(), vid))
    conn.commit()


def get_video(conn, vid: str):
    return conn.execute("SELECT * FROM videos WHERE id=?", (vid,)).fetchone()


def list_videos(conn):
    return conn.execute("SELECT * FROM videos ORDER BY uploaded_at DESC").fetchall()


def set_stage(conn, vid: str, name: str, pct: float | None = None, state: str | None = None, error: str | None = None) -> None:
    sets, vals = [], []
    if pct is not None:
        sets.append("pct=?"); vals.append(pct)
    if state is not None:
        sets.append("state=?"); vals.append(state)
    if error is not None:
        sets.append("error=?"); vals.append(error)
    conn.execute(f"UPDATE stages SET {', '.join(sets)} WHERE video_id=? AND name=?", (*vals, vid, name))
    conn.commit()


def get_stages(conn, vid: str):
    rows = conn.execute("SELECT * FROM stages WHERE video_id=?", (vid,)).fetchall()
    order = {n: i for i, n in enumerate(STAGE_NAMES)}
    return sorted(rows, key=lambda r: order.get(r["name"], 99))


def insert_many(conn, table: str, video_id: str, rows: list[dict]) -> None:
    for r in rows:
        cols = ["video_id", *r.keys()]
        conn.execute(
            f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})",
            (video_id, *r.values()),
        )
    conn.commit()


def rows(conn, table: str, vid: str, order: str = "t"):
    cols = {"frames": "sev DESC, t", "corrections": "tc", "tech": "start"}.get(table, order)
    return conn.execute(f"SELECT * FROM {table} WHERE video_id=? ORDER BY {cols}", (vid,)).fetchall()


def delete_video(conn, vid: str) -> None:
    for table in ("frames", "scenes", "transcript", "corrections", "tech", "stages", "embeddings", "videos"):
        conn.execute(f"DELETE FROM {table} WHERE {'id' if table == 'videos' else 'video_id'}=?", (vid,))
    conn.execute("DELETE FROM search_fts WHERE video_id=?", (vid,))
    conn.commit()
