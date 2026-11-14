from fastapi import APIRouter

from app.core.config import get_settings
from app.core.db import database_ok
from app.schemas.health import HealthResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    db_ok = database_ok()
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        version=get_settings().app_version,
        database="ok" if db_ok else "error",
        units="SI (pint)",
    )
