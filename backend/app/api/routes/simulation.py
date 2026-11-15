from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.api.design_support import get_mission_or_404, resolve_lines
from app.models import Mission, Spacecraft
from app.schemas.simulation import MissionParams, SimulationRunResponse
from app.services.design import DesignLine, calculate_design, find_violations
from app.services.orbit import (
    OrbitConstantsMissing,
    OrbitModelError,
    load_earth_constants,
)
from app.services.simulation import evaluate_mission_readiness, simulate_mission

router = APIRouter(prefix="/simulation", tags=["simulation"])


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code, detail={"code": code, "message": message}
    )


def _resolve_design(
    db: Session, payload: MissionParams
) -> tuple[Mission, int, str, list[DesignLine]]:
    """Resolve the authoritative mission and component lines for a run.

    A saved design is the normal path: its mission and stored component lines
    are loaded from the database, so the browser can never inject mass, power
    or cost values. An unsaved design is accepted only through explicit
    ``components`` lines.
    """
    if payload.design_id is not None:
        spacecraft = db.get(Spacecraft, payload.design_id)
        if spacecraft is None:
            raise _error(
                404,
                "DESIGN_NOT_FOUND",
                f"Saved design {payload.design_id} does not exist.",
            )
        if spacecraft.mission.slug != payload.mission_slug:
            raise _error(
                422,
                "MISSION_DESIGN_MISMATCH",
                f"Design {spacecraft.id} belongs to mission "
                f"'{spacecraft.mission.slug}', not '{payload.mission_slug}'.",
            )
        if not spacecraft.components:
            raise _error(
                422,
                "EMPTY_DESIGN",
                f"Saved design {spacecraft.id} has no components.",
            )
        lines = [
            DesignLine(component=row.component, quantity=row.quantity)
            for row in sorted(spacecraft.components, key=lambda row: row.component_id)
        ]
        return spacecraft.mission, spacecraft.id, spacecraft.name, lines

    mission = get_mission_or_404(db, payload.mission_slug)
    if not payload.components:
        raise _error(
            422,
            "EMPTY_DESIGN",
            "Provide a saved design_id or at least one component line.",
        )
    lines = resolve_lines(db, payload.components)
    design_name = payload.design_name or f"{mission.name} concept"
    return mission, 0, design_name, lines


@router.post("/analyze", response_model=SimulationRunResponse)
def analyze(payload: MissionParams, db: DbSession) -> SimulationRunResponse:
    """Run a full mission simulation and return a scored report.

    Accepts a saved design id plus the orbit selected in the planner.
    Mass, power, cost and category coverage are recomputed from the saved
    design and the seeded catalog; they are never taken from the request.
    """
    mission, design_id, design_name, lines = _resolve_design(db, payload)

    try:
        constants = load_earth_constants(db)
    except OrbitConstantsMissing as exc:
        raise _error(503, "ORBIT_REFERENCE_MISSING", str(exc)) from exc

    calculation = calculate_design(mission, lines)
    violations = find_violations(mission, calculation)

    try:
        run = simulate_mission(
            mission=mission,
            calculation=calculation,
            violations=violations,
            constants=constants,
            design_id=design_id,
            design_name=design_name,
            altitude_km=payload.design_data.altitude_km,
            inclination_deg=payload.design_data.inclination_deg,
        )
    except OrbitModelError as exc:
        raise _error(422, "ORBIT_MODEL_ERROR", str(exc)) from exc

    readiness = evaluate_mission_readiness(run)
    return SimulationRunResponse(
        run=run,
        raw_score=run.raw_score,
        score_breakdown=run.score_breakdown,
        readiness=readiness,
    )


__all__ = ["router"]
