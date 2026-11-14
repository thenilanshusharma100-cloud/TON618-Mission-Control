from functools import lru_cache
from pathlib import Path

from sqlalchemy import Engine, create_engine, text

from app.core.config import get_settings


def _ensure_sqlite_parent_dir(database_url: str) -> None:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        return
    db_path = Path(database_url.removeprefix(prefix))
    if not db_path.is_absolute():
        db_path = Path.cwd() / db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_engine() -> Engine:
    url = get_settings().database_url
    _ensure_sqlite_parent_dir(url)
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(url, connect_args=connect_args)


def database_ok() -> bool:
    """Cheap connectivity probe used by the health endpoint."""
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        return False
    return True
