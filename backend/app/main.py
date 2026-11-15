from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import components, design, designs, health, missions, orbit, simulation
from app.core.config import get_settings
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

    # CORS configuration - origins from settings (comma-separated string)
    cors_origins = [origin.strip() for origin in settings.cors_origins.split(",")]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, prefix="/api")
    app.include_router(missions.router, prefix="/api")
    app.include_router(components.router, prefix="/api")
    app.include_router(design.router, prefix="/api")
    app.include_router(designs.router, prefix="/api")
    app.include_router(orbit.router, prefix="/api")
    app.include_router(simulation.router, prefix="/api")
    return app


app = create_app()
