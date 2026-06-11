"""핵심 로직 통합 테스트 — 도메인 / 파서 / DB / 검색 / AI 래퍼."""
import json

from app import db, ffparse, indexer, search
from app.domain import aggregate, build_timeline, fmt_tc, sev_label


# ---------- domain ----------

def test_sev_label():
    assert [sev_label(s) for s in range(6)] == ["통과", "주의", "주의", "검토 필요", "방영 불가", "방영 불가"]


def test_fmt_tc():
    assert fmt_tc(0) == "00:00"
    assert fmt_tc(84.4) == "01:24"
    assert fmt_tc(3700) == "61:40"


def test_aggregate():
    frames = [{"sev": 5, "category": "폭력"}, {"sev": 3, "category": "성표현"},
              {"sev": 0, "category": "정상"}, {"sev": 4, "category": "폭력"}]
    a = aggregate(frames)
    assert (a["violation"], a["review"], a["pass"], a["max_sev"]) == (2, 1, 1, 5)
    assert a["verdict"] == "방영 불가"
    assert a["categories_hit"] == ["폭력", "성표현"]
    assert aggregate([])["verdict"] == "통과"


def test_build_timeline():
    segs = build_timeline(
        100.0,
        tech=[{"kind": "black", "start": 0.0, "end": 1.0}, {"kind": "silence", "start": 50.0, "end": 52.0}],
        frames=[{"t": 30.0, "sev": 5}, {"t": 70.0, "sev": 3}],
    )
    types = [s["type"] for s in segs]
    assert types[0] == "black"
    assert {"violation", "review", "silence"} <= set(types)
    assert abs(sum(s["to"] - s["from"] for s in segs) - 100.0) < 1e-6


# ---------- ffparse ----------

def test_parse_silence_black_freeze():
    err = "[silencedetect] silence_start: 14.02\n[silencedetect] silence_end: 75.2 | silence_duration: 61\n"
    assert ffparse.parse_silencedetect(err) == [{"kind": "silence", "start": 14.02, "end": 75.2}]
    err = "[blackdetect] black_start:0 black_end:0.84 black_duration:0.84"
    assert ffparse.parse_blackdetect(err)[0]["end"] == 0.84
    err = "lavfi.freezedetect.freeze_start: 31.4\nlavfi.freezedetect.freeze_end: 33.0"
    assert ffparse.parse_freezedetect(err) == [{"kind": "freeze", "start": 31.4, "end": 33.0}]


def test_parse_ffprobe_json():
    text = json.dumps({
        "format": {"duration": "47.5", "size": "1000000"},
        "streams": [
            {"codec_type": "video", "codec_name": "h264", "width": 1920, "height": 1080, "avg_frame_rate": "24000/1001"},
            {"codec_type": "audio", "codec_name": "aac"},
            {"codec_type": "subtitle"},
        ],
    })
    m = ffparse.parse_ffprobe_json(text)
    assert m["duration"] == 47.5 and m["width"] == 1920 and m["has_subtitles"]
    assert abs(m["fps"] - 23.976) < 0.01


def test_parse_srt():
    srt = "1\n00:00:01,000 --> 00:00:03,000\n안녕하세요\n\n2\n00:01:24,500 --> 00:01:26,000\n<i>반갑습니다</i>\n"
    lines = ffparse.parse_srt(srt)
    assert lines[0]["text"] == "안녕하세요" and lines[0]["tc"] == "00:01"
    assert lines[1]["text"] == "반갑습니다" and lines[1]["tc"] == "01:24"


# ---------- db ----------

def test_db_crud_and_cascade(conn):
    db.create_video(conn, "v-1", "테스트.mp4", "source.mp4", "2026-06-11 10:00")
    assert db.get_video(conn, "v-1")["status"] == "processing"
    assert len(db.get_stages(conn, "v-1")) == 8
    db.set_stage(conn, "v-1", "자막 추출", pct=50, state="run")
    assert db.get_stages(conn, "v-1")[0]["pct"] == 50
    db.insert_many(conn, "frames", "v-1", [{"t": 1, "tc": "00:01", "category": "폭력", "sev": 5}])
    db.insert_many(conn, "transcript", "v-1", [{"t": 1, "tc": "00:01", "text": "안녕"}])
    indexer.index_video(conn, "v-1", [{"t": 1, "tc": "00:01", "text": "비 내리는 야경"}], [])
    assert len(db.rows(conn, "frames", "v-1")) == 1
    db.delete_video(conn, "v-1")
    assert db.get_video(conn, "v-1") is None
    assert conn.execute("SELECT COUNT(*) c FROM search_fts WHERE video_id='v-1'").fetchone()["c"] == 0
    assert conn.execute("SELECT COUNT(*) c FROM embeddings WHERE video_id='v-1'").fetchone()["c"] == 0


# ---------- search ----------

def test_search_modes(conn):
    db.create_video(conn, "v-1", "드라마.mp4", "s.mp4", "2026-06-11 09:00")
    db.create_video(conn, "v-2", "다큐.mp4", "s.mp4", "2026-06-10 09:00")
    indexer.index_video(conn, "v-1", [{"t": 134, "tc": "02:14", "text": "비 내리는 도심 야경에서 기다린다"}], [])
    indexer.index_video(conn, "v-2", [{"t": 10, "tc": "00:10", "text": "사자가 초원을 달린다"}], [])

    kw = search.search(conn, "야경", mode="keyword")
    assert kw and kw[0]["video_id"] == "v-1" and kw[0]["source"] == "keyword"

    vec = search.search(conn, "비 내리는 도심 야경", mode="vector")
    assert vec and vec[0]["video_id"] == "v-1" and vec[0]["source"] == "vector"

    hy = search.search(conn, "비 내리는 야경", mode="hybrid")
    assert hy and hy[0]["video_id"] == "v-1" and hy[0]["source"] == "both"
    assert "매칭" in hy[0]["reason"] or "일치" in hy[0]["reason"]

    flt = search.search(conn, "야경", mode="filter", video_id="v-2")
    assert all(r["video_id"] == "v-2" for r in flt)


# ---------- ai wrappers (mocked client) ----------

class FakeBlock:
    type = "text"

    def __init__(self, text):
        self.text = text


class FakeResp:
    def __init__(self, text):
        self.content = [FakeBlock(text)]


class FakeClient:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    @property
    def messages(self):
        return self

    def create(self, **kw):
        self.calls.append(kw)
        return FakeResp(self.payload)


def test_correct_captions_returns_changed_only():
    from app import ai
    payload = json.dumps({"corrections": [
        {"tc": "06:32", "orig": "안게로 가득", "fix": "안개로 가득"},
        {"tc": "07:00", "orig": "같음", "fix": "같음"},
    ]})
    client = FakeClient(payload)
    out = ai.correct_captions(client, "claude-opus-4-8", [{"tc": "06:32", "text": "안게로 가득"}])
    assert out == [{"tc": "06:32", "orig": "안게로 가득", "fix": "안개로 가득"}]


def test_judge_window_parses_and_falls_back():
    from app import ai
    payload = json.dumps({"category": "폭력", "sev": 5, "rule": "§36 ②", "reason": "뺨 가격", "sound": "비명"})
    out = ai.judge_window(FakeClient(payload), "m", [b"jpg"], "대사", "기준", "18:04")
    assert out["category"] == "폭력" and out["sev"] == 5

    bad = ai.judge_window(FakeClient("{{{not json"), "m", [b"jpg"], "", "기준", "00:01")
    assert bad == {"category": "정상", "sev": 0, "rule": "", "reason": "", "sound": ""}
