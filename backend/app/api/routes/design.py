from fastapi import APIRouter

from app.api.deps import DbSession
from app.api.design_support import (
    calculation_response,
    resolve_design,
    violation_reads,
)
from app.schemas.design import (
    DesignCalculationResponse,
    DesignRequest,
    DesignValidationResponse,
)
from app.services.design import calculate_design, find_violations

router = APIRouter(prefix="/design", tags=["design"])


@router.post("/calculate", response_model=DesignCalculationResponse)
def calculate(payload: DesignRequest, db: DbSession) -> DesignCalculationResponse:
    mission, lines = resolve_design(db, payload.mission_slug, payload.items)
    return calculation_response(calculate_design(mission, lines))


@router.post("/validate", response_model=DesignValidationResponse)
def validate(payload: DesignRequest, db: DbSession) -> DesignValidationResponse:
    mission, lines = resolve_design(db, payload.mission_slug, payload.items)
    calculation = calculate_design(mission, lines)
    violations = find_violations(mission, calculation)
    return DesignValidationResponse(
        **calculation_response(calculation).model_dump(),
        valid=not violations,
        violations=violation_reads(violations),
    )
