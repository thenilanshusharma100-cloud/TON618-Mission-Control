from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import components, design, designs, health, missions
from app.core.config import get_settings
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
    app.include_router(health.router, prefix="/api")
    app.include_router(missions.router, prefix="/api")
    app.include_router(components.router, prefix="/api")
    app.include_router(design.router, prefix="/api")
    app.include_router(designs.router, prefix="/api")
    return app


app = create_app()
