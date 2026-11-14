import app.models  # noqa: F401  (register mappers before create_all)
from app.core.db import get_engine
from app.data.catalog import load_catalog
from app.db.base import Base, SessionLocal
from app.db.seed import SeedSummary, seed_catalog


def init_db() -> SeedSummary:
    Base.metadata.create_all(bind=get_engine())
    with SessionLocal() as session:
        return seed_catalog(session, load_catalog())
