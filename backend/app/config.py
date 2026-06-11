"""환경 설정 — .env 파일과 환경변수에서 읽는다 (PRD §8: 키는 .env로만 관리)."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip())


_load_dotenv(BASE_DIR / ".env")


class Settings:
    def __init__(self) -> None:
        self.openai_api_key = os.environ.get("OPENAI_API_KEY", "")
        self.ai_model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        self.voyage_api_key = os.environ.get("VOYAGE_API_KEY", "")
        self.telegram_bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        self.telegram_chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
        self.whisper_model = os.environ.get("WHISPER_MODEL", "small")
        self.frame_interval = float(os.environ.get("FRAME_INTERVAL", "1.0"))
        self.mod_window = int(os.environ.get("MOD_WINDOW", "3"))
        self.scene_interval = float(os.environ.get("SCENE_INTERVAL", "120"))
        self.data_dir = Path(os.environ.get("DATA_DIR", str(BASE_DIR / "data"))).resolve()

    @property
    def db_path(self) -> Path:
        return self.data_dir / "archive.db"

    def video_dir(self, video_id: str) -> Path:
        return self.data_dir / "videos" / video_id

    @property
    def rules_path(self) -> Path:
        return BASE_DIR / "rules" / "금칙기준.md"


settings = Settings()
