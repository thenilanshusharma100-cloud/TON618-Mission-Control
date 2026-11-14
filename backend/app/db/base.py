from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.db import get_engine


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)
