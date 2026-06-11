"""텔레그램 알림 (PRD 4-5) — 미설정 시 조용히 생략."""
from __future__ import annotations

import httpx


def notify(text: str, bot_token: str, chat_id: str) -> bool:
    if not bot_token or not chat_id:
        return False
    try:
        r = httpx.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=15,
        )
        return r.status_code == 200
    except Exception:
        return False
