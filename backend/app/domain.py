"""순수 도메인 로직 — 심각도, 종합 판정, 타임라인."""
from __future__ import annotations


def sev_label(s: int) -> str:
    if s >= 4:
        return "방영 불가"
    if s == 3:
        return "검토 필요"
    if s >= 1:
        return "주의"
    return "통과"


def fmt_tc(seconds: float) -> str:
    seconds = max(0, int(seconds))
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def aggregate(frames: list[dict]) -> dict:
    violation = sum(1 for f in frames if f["sev"] >= 4)
    review = sum(1 for f in frames if f["sev"] == 3)
    passed = len(frames) - violation - review
    max_sev = max((f["sev"] for f in frames), default=0)
    cats: list[str] = []
    for f in sorted(frames, key=lambda f: -f["sev"]):
        c = f.get("category", "정상")
        if c != "정상" and f["sev"] >= 3 and c not in cats:
            cats.append(c)
    return {
        "violation": violation,
        "review": review,
        "pass": passed,
        "max_sev": max_sev,
        "verdict": sev_label(max_sev),
        "categories_hit": cats,
    }


# 타임라인 우선순위: 위반 > 검토 > 블랙 > 무음 > 정상
_PRIORITY = {"violation": 4, "review": 3, "black": 2, "silence": 1, "normal": 0}


def build_timeline(duration: float, tech: list[dict], frames: list[dict], pad: float = 0.6) -> list[dict]:
    """초 단위 구간 리스트 [{type, from, to}] — 전체 길이를 빈틈없이 채운다."""
    if duration <= 0:
        return []
    intervals: list[tuple[float, float, str]] = []
    for t in tech:
        if t["kind"] in ("silence", "black"):
            intervals.append((max(0, t["start"]), min(duration, t["end"]), t["kind"]))
    for f in frames:
        if f["sev"] >= 4:
            kind = "violation"
        elif f["sev"] == 3:
            kind = "review"
        else:
            continue
        intervals.append((max(0, f["t"] - pad), min(duration, f["t"] + pad), kind))

    # 경계점 분할 후 우선순위 병합
    points = sorted({0.0, duration, *[a for a, _, _ in intervals], *[b for _, b, _ in intervals]})
    segs: list[dict] = []
    for a, b in zip(points, points[1:]):
        if b - a <= 1e-9:
            continue
        mid = (a + b) / 2
        best = "normal"
        for s, e, kind in intervals:
            if s <= mid < e and _PRIORITY[kind] > _PRIORITY[best]:
                best = kind
        if segs and segs[-1]["type"] == best:
            segs[-1]["to"] = b
        else:
            segs.append({"type": best, "from": a, "to": b})
    return segs
