from dataclasses import asdict

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.models import Component, Mission
from app.schemas.design import (
    CategoryBreakdownRead,
    DesignBudgetsRead,
    DesignCalculationResponse,
    DesignRequest,
    DesignTotalsRead,
    DesignValidationResponse,
    ViolationRead,
)
from app.services.design import (
    DesignCalculation,
    DesignLine,
    calculate_design,
    find_violations,
)

router = APIRouter(prefix="/design", tags=["design"])


def _resolve_design(
    db: Session, payload: DesignRequest
) -> tuple[Mission, list[DesignLine]]:
    mission = db.scalar(select(Mission).where(Mission.slug == payload.mission_slug))
    if mission is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "MISSION_NOT_FOUND",
                "message": f"Mission '{payload.mission_slug}' does not exist.",
            },
        )

    quantities: dict[int, int] = {}
    for item in payload.items:
        quantities[item.component_id] = quantities.get(item.component_id, 0) + item.quantity

    if not quantities:
        return mission, []

    components = db.scalars(
        select(Component).where(Component.id.in_(quantities.keys()))
    ).all()
    by_id = {component.id: component for component in components}
    missing = sorted(set(quantities) - set(by_id))
    if missing:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "UNKNOWN_COMPONENT_IDS",
                "message": "One or more component ids do not exist.",
                "component_ids": missing,
            },
        )

    lines = [
        DesignLine(component=by_id[component_id], quantity=quantity)
        for component_id, quantity in sorted(quantities.items())
    ]
    return mission, lines


def _calculation_response(calculation: DesignCalculation) -> DesignCalculationResponse:
    return DesignCalculationResponse(
        mission_slug=calculation.mission_slug,
        mission_name=calculation.mission_name,
        totals=DesignTotalsRead(**asdict(calculation.totals)),
        budgets=DesignBudgetsRead(**asdict(calculation.budgets)),
        categories=[
            CategoryBreakdownRead(**asdict(category))
            for category in calculation.categories
        ],
    )


@router.post("/calculate", response_model=DesignCalculationResponse)
def calculate(
    payload: DesignRequest, db: DbSession
) -> DesignCalculationResponse:
    mission, lines = _resolve_design(db, payload)
    return _calculation_response(calculate_design(mission, lines))


@router.post("/validate", response_model=DesignValidationResponse)
def validate(
    payload: DesignRequest, db: DbSession
) -> DesignValidationResponse:
    mission, lines = _resolve_design(db, payload)
    calculation = calculate_design(mission, lines)
    violations = find_violations(mission, calculation)
    base = _calculation_response(calculation)
    return DesignValidationResponse(
        **base.model_dump(),
        valid=not violations,
        violations=[ViolationRead(**asdict(violation)) for violation in violations],
    )
