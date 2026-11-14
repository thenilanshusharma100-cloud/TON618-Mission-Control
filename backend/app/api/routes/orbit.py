from datetime import UTC, datetime
from math import degrees

from fastapi import APIRouter, HTTPException

from app.api.deps import DbSession
from app.core.units import convert
from app.schemas.orbit import (
    OrbitAnalysisRead,
    OrbitConstantsRead,
    OrbitRequest,
    SunSynchronousRead,
)
from app.services.orbit import (
    ASSUMPTIONS,
    LIMITATIONS,
    SUN_SYNCHRONOUS_TARGET_RAD_S,
    SUN_SYNCHRONOUS_TOLERANCE,
    OrbitConstantsMissing,
    OrbitModelError,
    analyze_orbit,
    load_earth_constants,
)

router = APIRouter(prefix="/orbit", tags=["orbit"])


@router.post("/analyze", response_model=OrbitAnalysisRead)
def analyze(payload: OrbitRequest, db: DbSession) -> OrbitAnalysisRead:
    try:
        constants = load_earth_constants(db)
    except OrbitConstantsMissing as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "ORBIT_REFERENCE_MISSING", "message": str(exc)},
        ) from exc

    altitude_m = convert(payload.altitude_km, "km", "m")
    inclination_rad = convert(payload.inclination_deg, "deg", "rad")

    try:
        solution = analyze_orbit(constants, altitude_m, inclination_rad)
    except OrbitModelError as exc:
        raise HTTPException(
            status_code=422,
            detail={"code": "ORBIT_MODEL_ERROR", "message": str(exc)},
        ) from exc

    required_inclination_deg = degrees(solution.required_sso_inclination_rad)
    target_rate = SUN_SYNCHRONOUS_TARGET_RAD_S
    nodal_rate_delta = solution.nodal_precession_rad_s - target_rate

    return OrbitAnalysisRead(
        central_body="Earth",
        orbit_type="circular_leo",
        altitude_km=payload.altitude_km,
        altitude_m=solution.altitude_m,
        inclination_deg=payload.inclination_deg,
        inclination_rad=solution.inclination_rad,
        radius_m=solution.radius_m,
        velocity_m_s=solution.velocity_m_s,
        period_s=solution.period_s,
        specific_energy_j_kg=solution.specific_energy_j_kg,
        angular_momentum_m2_s=solution.angular_momentum_m2_s,
        mean_motion_rad_s=solution.mean_motion_rad_s,
        orbits_per_day=86400.0 / solution.period_s,
        nodal_precession_rad_s=solution.nodal_precession_rad_s,
        epoch_utc=datetime.now(UTC),
        constants=OrbitConstantsRead(
            gravitational_parameter_m3_s2=constants.gravitational_parameter_m3_s2,
            equatorial_radius_m=constants.equatorial_radius_m,
            j2=constants.j2,
            source_title=constants.source_title,
            source_url=constants.source_url,
            retrieved_on=constants.retrieved_on,
        ),
        sun_synchronous=SunSynchronousRead(
            target_rate_rad_s=target_rate,
            required_inclination_rad=solution.required_sso_inclination_rad,
            required_inclination_deg=required_inclination_deg,
            nodal_rate_delta_rad_s=nodal_rate_delta,
            inclination_delta_deg=payload.inclination_deg - required_inclination_deg,
            tolerance_fraction=SUN_SYNCHRONOUS_TOLERANCE,
            is_sun_synchronous=abs(nodal_rate_delta)
            <= SUN_SYNCHRONOUS_TOLERANCE * target_rate,
        ),
        assumptions=list(ASSUMPTIONS),
        limitations=list(LIMITATIONS),
    )


__all__ = ["router"]
