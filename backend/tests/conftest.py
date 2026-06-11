import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from app import db as db_mod


@pytest.fixture()
def conn(tmp_path):
    c = db_mod.connect(tmp_path / "test.db")
    yield c
    c.close()
