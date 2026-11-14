from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.deps import DbSession
from app.api.design_support import (
    as_utc,
    calculation_response,
    resolve_design,
    violation_reads,
)
from app.models import Spacecraft, SpacecraftComponent
from app.models.science import utcnow
from app.schemas.designs import (
    DesignCreateRequest,
    DesignDetailRead,
    DesignUpdateRequest,
)
from app.services.design import DesignLine, calculate_design, find_violations

router = APIRouter(prefix="/designs", tags=["designs"])


def _get_spacecraft_or_404(db: DbSession, design_id: int) -> Spacecraft:
    spacecraft = db.get(Spacecraft, design_id)
    if spacecraft is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "DESIGN_NOT_FOUND",
                "message": f"Saved design {design_id} does not exist.",
            },
        )
    return spacecraft


def _replace_components(db: DbSession, spacecraft: Spacecraft, lines: list[DesignLine]) -> None:
    spacecraft.components.clear()
    db.flush()
    spacecraft.components.extend(
        SpacecraftComponent(component=line.component, quantity=line.quantity)
        for line in lines
    )


def _detail(spacecraft: Spacecraft) -> DesignDetailRead:
    mission = spacecraft.mission
    lines = [
        DesignLine(component=row.component, quantity=row.quantity)
        for row in spacecraft.components
    ]
    calculation = calculate_design(mission, lines)
    violations = find_violations(mission, calculation)
    payload = calculation_response(calculation)
    return DesignDetailRead(
        **payload.model_dump(),
        id=spacecraft.id,
        mission_id=spacecraft.mission_id,
        name=spacecraft.name,
        items=[
            {"component_id": row.component_id, "quantity": row.quantity}
            for row in sorted(spacecraft.components, key=lambda row: row.component_id)
        ],
        created_at=as_utc(spacecraft.created_at),
        updated_at=as_utc(spacecraft.updated_at),
        valid=not violations,
        violations=violation_reads(violations),
    )


@router.get("", response_model=list[DesignDetailRead])
def list_designs(
    db: DbSession,
    mission_slug: Annotated[str | None, Query()] = None,
) -> list[DesignDetailRead]:
    statement = select(Spacecraft).order_by(Spacecraft.updated_at.desc(), Spacecraft.id.desc())
    if mission_slug is not None:
        statement = statement.where(Spacecraft.mission.has(slug=mission_slug))
    designs = db.scalars(statement).unique().all()
    return [_detail(spacecraft) for spacecraft in designs]


@router.post("", response_model=DesignDetailRead, status_code=201)
def create_design(payload: DesignCreateRequest, db: DbSession) -> DesignDetailRead:
    mission, lines = resolve_design(db, payload.mission_slug, payload.items)
    spacecraft = Spacecraft(mission=mission, name=payload.name)
    spacecraft.components = [
        SpacecraftComponent(component=line.component, quantity=line.quantity)
        for line in lines
    ]
    db.add(spacecraft)
    db.commit()
    return _detail(spacecraft)


@router.get("/{design_id}", response_model=DesignDetailRead)
def get_design(design_id: int, db: DbSession) -> DesignDetailRead:
    return _detail(_get_spacecraft_or_404(db, design_id))


@router.put("/{design_id}", response_model=DesignDetailRead)
def update_design(
    design_id: int, payload: DesignUpdateRequest, db: DbSession
) -> DesignDetailRead:
    spacecraft = _get_spacecraft_or_404(db, design_id)
    _, lines = resolve_design(db, spacecraft.mission.slug, payload.items)

    spacecraft.name = payload.name
    _replace_components(db, spacecraft, lines)
    spacecraft.updated_at = utcnow()
    db.commit()
    return _detail(spacecraft)


__all__ = ["router"]
