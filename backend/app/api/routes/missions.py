from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import DbSession
from app.models import Mission
from app.schemas.catalog import MissionRead

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("", response_model=list[MissionRead])
def list_missions(db: DbSession) -> list[MissionRead]:
    missions = db.scalars(select(Mission).order_by(Mission.id)).all()
    return [MissionRead.model_validate(mission) for mission in missions]
