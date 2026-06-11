"""리포트 출력물 — report.json / violations.csv (PRD 4-4)."""
from __future__ import annotations

import csv
import json
from pathlib import Path


def write_outputs(video_dir: str | Path, report: dict) -> None:
    d = Path(video_dir)
    d.mkdir(parents=True, exist_ok=True)
    (d / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    with open(d / "violations.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["타임코드", "카테고리", "심각도", "판정", "근거 규정", "소리 근거", "판정 이유"])
        for fr in report.get("frames", []):
            if fr["sev"] >= 3:
                w.writerow([fr["tc"], fr["category"], fr["sev"], fr["verdict"], fr["rule"], fr["sound"], fr["reason"]])
