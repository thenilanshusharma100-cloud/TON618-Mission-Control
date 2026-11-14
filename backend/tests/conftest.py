import os
import shutil
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest

_TEST_DIR = Path(tempfile.mkdtemp(prefix="ton618-tests-"))
os.environ["TON618_DATABASE_URL"] = f"sqlite:///{(_TEST_DIR / 'test.db').as_posix()}"
os.environ["TON618_CATALOG_DIR"] = str(Path(__file__).resolve().parents[2] / "data")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.db.base import SessionLocal  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db_session() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    shutil.rmtree(_TEST_DIR, ignore_errors=True)
