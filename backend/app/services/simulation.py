"""Mission simulation engine.

All physical quantities are SI base units (metres, seconds, watts, kilograms;
cost is integer USD). Display conversion happens in the frontend.

The engine never invents telemetry: every result is derived from

* the seeded :class:`~app.models.Mission` budgets,
* the design calculation produced by ``app.services.design``,
* the orbit solution produced by ``app.services.orbit`` (seeded NASA
  reference constants plus the first-order J2 model).

Model assumptions are listed in :data:`ASSUMPTIONS`. The scoring rules are
documented on :func:`compute_score`.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from math import ceil, degrees, radians

from app.models import Mission
from app.schemas.simulation import (
    MissionReadinessRead,
    MissionTimelinePointRead,
    SimulationRunRead,
    SimulationScoreBreakdown,
)
from app.services.design import DesignCalculation, Violation
from app.services.orbit import (
    SUN_SYNCHRONOUS_TARGET_RAD_S,
    SUN_SYNCHRONOUS_TOLERANCE,
    EarthConstants,
    analyze_orbit,
)

# Mission duration: a 30-day LEO educational scenario.
MISSION_DURATION_S: float = 30.0 * 24.0 * 3600.0

# Energy integration step. Finer than the timeline sampling so the battery
# state is resolved through sunlight and eclipse instead of once per orbit.
INTEGRATION_STEP_S: float = 60.0

# Educational power model: a LEO spacecraft averages 55 % sunlight per orbit.
# This is a phase-averaged assumption, not a beta-angle / eclipse geometry model.
SUNLIT_FRACTION_PER_ORBIT: float = 0.55

# Educational battery sizing: 30 % reserve above the energy needed to ride
# through one eclipse.
BATTERY_RESERVE_FRACTION: float = 0.30

# Educational ground-station model: a contact window is available for 25 % of
# each orbit (~15 min of a ~96 min orbit at 550 km).
CONTACT_FRACTION_PER_ORBIT: float = 0.25

# Game rule: below this state of charge the mission is considered degraded.
LOW_BATTERY_THRESHOLD_PCT: float = 20.0

# Game rule: contact coverage at or above this fraction earns full comm points.
COMM_PASS_THRESHOLD: float = 0.20

ASSUMPTIONS: tuple[str, ...] = (
    "30-day mission duration integrated in 60 s steps.",
    "Circular orbit with first-order J2 nodal precession; constants come from "
    "the seeded NASA NSSDCA Earth Fact Sheet reference data.",
    "Each orbit is 55 % sunlit and 45 % eclipse, an educational LEO average "
    "rather than a beta-angle eclipse model.",
    "Battery capacity is sized to 130 % of one eclipse's energy demand.",
    "Ground-station contact is available for 25 % of each orbit.",
    "Solar-array generation is nameplate power; pointing, ageing and "
    "temperature derating are not modelled.",
)

_RECOMMENDATIONS: dict[str, str] = {
    "EMPTY_DESIGN": "Add components to the spacecraft design before launch.",
    "MASS_OVER_BUDGET": "Reduce component masses or select lighter alternatives.",
    "POWER_MARGIN_LOW": "Add generation or reduce consumption to meet the mission power margin.",
    "COST_OVER_BUDGET": "Select lower-cost components or reduce quantities.",
    "MISSING_REQUIRED_CATEGORY": "Install the missing subsystem before launch.",
}


def _state_of_charge_pct(energy_wh: float, capacity_wh: float) -> float:
    if capacity_wh <= 0.0:
        return 100.0
    return 100.0 * energy_wh / capacity_wh


def _add_once(target: list[str], value: str) -> None:
    if value not in target:
        target.append(value)


def compute_score(
    calculation: DesignCalculation,
    mission: Mission,
    *,
    is_sun_synchronous: bool,
    inclination_delta_deg: float,
    comm_contact_fraction: float,
    missing_categories: Sequence[str],
    battery_min_soc_pct: float,
) -> SimulationScoreBreakdown:
    """Compute the 100-point mission score from the design and orbit results.

    Game rules (documented, deterministic, no randomness):

    ====================  ====  =============================================
    Category              Max   Rule
    ====================  ====  =============================================
    Orbit achievement      25   25 if the orbit is sun-synchronous; otherwise
                                25 - 5 points per full degree of inclination
                                departure from the solved SSO inclination.
    Power management       20   20 if the net power margin meets the mission
                                minimum, 10 if it is non-negative, else 0;
                                capped at 10 when the battery drops below 20 %.
    Mass management        15   15 at or below 90 % of the mass budget,
                                10 at or below 100 %, else 0.
    Communication          15   15 at or above 20 % contact coverage,
                                10 for any coverage, else 0.
    Payload performance    15   15 when every required category is present,
                                minus 3 per missing category.
    Budget management      10   10 at or below 90 % of the cost budget,
                                5 at or below 100 %, else 0.
    ====================  ====  =============================================
    """
    totals = calculation.totals
    budgets = calculation.budgets

    # Orbit achievement (25)
    if is_sun_synchronous:
        orbit_points = 25
    else:
        orbit_points = max(0, 25 - 5 * ceil(abs(inclination_delta_deg)))

    # Power management (20)
    if totals.power_margin_w >= mission.min_power_margin_w:
        power_points = 20
    elif totals.power_margin_w >= 0.0:
        power_points = 10
    else:
        power_points = 0
    if battery_min_soc_pct < LOW_BATTERY_THRESHOLD_PCT:
        power_points = min(power_points, 10)

    # Mass management (15)
    mass_pct = (
        totals.mass_kg / budgets.mass_limit_kg * 100.0
        if budgets.mass_limit_kg > 0.0
        else 0.0
    )
    if mass_pct <= 90.0:
        mass_points = 15
    elif mass_pct <= 100.0:
        mass_points = 10
    else:
        mass_points = 0

    # Communication (15)
    if comm_contact_fraction >= COMM_PASS_THRESHOLD:
        comm_points = 15
    elif comm_contact_fraction > 0.0:
        comm_points = 10
    else:
        comm_points = 0

    # Payload performance (15)
    missing_count = len(missing_categories)
    payload_points = 15 if missing_count == 0 else max(0, 15 - 3 * missing_count)

    # Budget management (10)
    if budgets.cost_used_pct <= 90.0:
        budget_points = 10
    elif budgets.cost_used_pct <= 100.0:
        budget_points = 5
    else:
        budget_points = 0

    return SimulationScoreBreakdown(
        orbit_achievement=orbit_points,
        power_management=power_points,
        mass_management=mass_points,
        communication=comm_points,
        payload_performance=payload_points,
        budget_management=budget_points,
    )


def simulate_mission(
    *,
    mission: Mission,
    calculation: DesignCalculation,
    violations: Sequence[Violation],
    constants: EarthConstants,
    design_id: int,
    design_name: str,
    altitude_km: float,
    inclination_deg: float,
) -> SimulationRunRead:
    """Run the 30-day mission timeline for a resolved design and orbit.

    ``mission`` and ``calculation`` are the authoritative inputs: the same
    objects the design console uses. ``simulate_mission`` performs no database
    access and accepts no browser-supplied mass, power or cost values.
    """
    solution = analyze_orbit(constants, altitude_km * 1000.0, radians(inclination_deg))
    period_s = solution.period_s

    required_sso_inclination_deg = degrees(solution.required_sso_inclination_rad)
    nodal_rate_delta = solution.nodal_precession_rad_s - SUN_SYNCHRONOUS_TARGET_RAD_S
    is_sun_synchronous = (
        abs(nodal_rate_delta)
        <= SUN_SYNCHRONOUS_TOLERANCE * SUN_SYNCHRONOUS_TARGET_RAD_S
    )

    totals = calculation.totals
    budgets = calculation.budgets

    power_generation_w = totals.power_generation_w
    power_consumption_w = totals.power_consumption_w
    net_power_w = totals.power_margin_w

    # Battery sized for one eclipse plus an educational reserve.
    eclipse_fraction = 1.0 - SUNLIT_FRACTION_PER_ORBIT
    eclipse_energy_wh = (
        power_consumption_w * period_s * eclipse_fraction / 3600.0
    )
    battery_full_wh = eclipse_energy_wh * (1.0 + BATTERY_RESERVE_FRACTION)
    battery_energy_wh = battery_full_wh
    battery_min_energy_wh = battery_full_wh
    energy_deficit_wh = 0.0

    # Subsystem coverage: only categories that actually contain components.
    present = {
        category.category.value
        for category in calculation.categories
        if category.quantity > 0
    }
    required_categories = list(mission.required_categories)
    present_required = present & set(required_categories)
    missing_categories = [name for name in required_categories if name not in present]
    coverage_pct = (
        len(present_required) / len(required_categories) * 100.0
        if required_categories
        else 100.0
    )

    started_at = datetime.now(UTC)
    run_id = f"mission-{mission.slug}-{design_id}"

    sunlit_s = period_s * SUNLIT_FRACTION_PER_ORBIT
    elapsed_s = 0.0
    orbits_completed = 0
    contact_sessions = 0
    timeline: list[MissionTimelinePointRead] = []

    while elapsed_s < MISSION_DURATION_S:
        orbit_end_s = min(elapsed_s + period_s, MISSION_DURATION_S)
        orbit_min_energy_wh = battery_energy_wh

        # Integrate power over the orbit: sunlight first, then eclipse.
        while elapsed_s < orbit_end_s:
            step_s = min(INTEGRATION_STEP_S, orbit_end_s - elapsed_s)
            phase_s = elapsed_s % period_s
            if phase_s < sunlit_s:
                battery_energy_wh += power_generation_w * step_s / 3600.0
            battery_energy_wh -= power_consumption_w * step_s / 3600.0

            if battery_energy_wh < 0.0:
                energy_deficit_wh += -battery_energy_wh
                battery_energy_wh = 0.0
            elif battery_energy_wh > battery_full_wh:
                battery_energy_wh = battery_full_wh

            orbit_min_energy_wh = min(orbit_min_energy_wh, battery_energy_wh)
            elapsed_s += step_s

        orbits_completed += 1
        battery_min_energy_wh = min(battery_min_energy_wh, orbit_min_energy_wh)

        has_contact = orbits_completed % round(1.0 / CONTACT_FRACTION_PER_ORBIT) == 0
        if has_contact:
            contact_sessions += 1

        soc_pct = _state_of_charge_pct(battery_energy_wh, battery_full_wh)
        orbit_min_soc_pct = _state_of_charge_pct(orbit_min_energy_wh, battery_full_wh)

        if orbits_completed == 1:
            mission_phase = "orbit_insertion"
        elif orbit_min_soc_pct < LOW_BATTERY_THRESHOLD_PCT:
            mission_phase = "low_power"
        elif has_contact:
            mission_phase = "contact_pass"
        else:
            mission_phase = "orbit_cruise"

        power_status = (
            "on" if soc_pct > LOW_BATTERY_THRESHOLD_PCT else "low" if soc_pct > 0.0 else "critical"
        )
        payload_available = "payload" in present
        payload_status = (
            "observing"
            if payload_available and has_contact and power_status == "on"
            else "idle"
            if payload_available
            else "unavailable"
        )

        timeline.append(
            MissionTimelinePointRead(
                elapsed_s=elapsed_s,
                mission_phase=mission_phase,
                epoch_utc=(started_at + timedelta(seconds=elapsed_s)).strftime(
                    "%Y-%m-%dT%H:%M:%SZ"
                ),
                power_status=power_status,
                comm_status="contact" if has_contact else "no_contact",
                payload_status=payload_status,
            )
        )

    comm_contact_fraction = (
        contact_sessions / orbits_completed if orbits_completed > 0 else 0.0
    )
    battery_min_soc_pct = _state_of_charge_pct(battery_min_energy_wh, battery_full_wh)
    battery_soc_pct = _state_of_charge_pct(battery_energy_wh, battery_full_wh)

    score_breakdown = compute_score(
        calculation,
        mission,
        is_sun_synchronous=is_sun_synchronous,
        inclination_delta_deg=inclination_deg - required_sso_inclination_deg,
        comm_contact_fraction=comm_contact_fraction,
        missing_categories=missing_categories,
        battery_min_soc_pct=battery_min_soc_pct,
    )
    raw_score = score_breakdown.total

    violation_codes = [violation.code for violation in violations]
    warnings = [violation.message for violation in violations]
    recommendations: list[str] = []
    for code in violation_codes:
        recommendation = _RECOMMENDATIONS.get(code)
        if recommendation is not None:
            _add_once(recommendations, recommendation)

    if battery_min_soc_pct < LOW_BATTERY_THRESHOLD_PCT:
        _add_once(
            warnings,
            f"Battery state of charge reached {battery_min_soc_pct:.1f}% "
            f"during the mission (minimum {LOW_BATTERY_THRESHOLD_PCT:.0f}%).",
        )
        _add_once(
            recommendations,
            "Increase battery capacity or reduce eclipse power draw.",
        )
    if energy_deficit_wh > 0.0:
        _add_once(
            warnings,
            f"Energy deficit of {energy_deficit_wh:.1f} Wh: the battery could not "
            "cover demand.",
        )
    if contact_sessions == 0:
        _add_once(warnings, "No ground-station contact was available.")
        _add_once(recommendations, "Schedule ground-station contact windows.")
    _add_once(recommendations, "Monitor battery state of charge through the mission.")

    failure_codes = {"MASS_OVER_BUDGET", "COST_OVER_BUDGET"}
    if (
        battery_min_soc_pct < LOW_BATTERY_THRESHOLD_PCT
        or energy_deficit_wh > 0.0
        or failure_codes & set(violation_codes)
    ):
        mission_status = "failure"
    elif violation_codes or net_power_w < mission.min_power_margin_w:
        mission_status = "partial"
    else:
        mission_status = "success"

    if net_power_w > 0.0:
        power_balance_status = "positive"
    elif net_power_w < 0.0:
        power_balance_status = "negative"
    else:
        power_balance_status = "zero"

    return SimulationRunRead(
        run_id=run_id,
        started_at=started_at,
        completed_at=datetime.now(UTC),
        design_id=design_id,
        design_name=design_name,
        mission_slug=mission.slug,
        altitude_km=altitude_km,
        inclination_deg=inclination_deg,
        required_sso_inclination_deg=required_sso_inclination_deg,
        orbital_period_s=period_s,
        orbits_completed=orbits_completed,
        orbit_elapsed_s=elapsed_s,
        total_mass_kg=totals.mass_kg,
        mass_limit_kg=budgets.mass_limit_kg,
        total_cost_usd=totals.cost_usd,
        cost_limit_usd=budgets.cost_limit_usd,
        cost_remaining_usd=budgets.cost_remaining_usd,
        cost_used_pct=budgets.cost_used_pct,
        power_generation_w=power_generation_w,
        power_consumption_w=power_consumption_w,
        net_power_w=net_power_w,
        min_power_margin_w=mission.min_power_margin_w,
        battery_energy_full_wh=battery_full_wh,
        battery_energy_remaining_wh=battery_energy_wh,
        battery_state_of_charge_pct=battery_soc_pct,
        battery_min_state_of_charge_pct=battery_min_soc_pct,
        power_balance_status=power_balance_status,
        coverage_pct=coverage_pct,
        required_categories=len(required_categories),
        present_categories=len(present_required),
        missing_categories=missing_categories,
        comm_contact_sessions=contact_sessions,
        comm_contact_fraction=comm_contact_fraction,
        raw_score=raw_score,
        score_breakdown=score_breakdown,
        mission_status=mission_status,
        warnings=warnings,
        recommendations=recommendations,
        violation_codes=violation_codes,
        timeline=timeline,
        assumptions=list(ASSUMPTIONS),
    )


def evaluate_mission_readiness(run: SimulationRunRead) -> MissionReadinessRead:
    """Summarise launch readiness from a completed simulation run.

    Readiness is derived from the same run the response returns, so the design
    console, the score and the summary can never disagree.
    """
    return MissionReadinessRead(
        valid=run.mission_status == "success",
        mission_status=run.mission_status,
        warnings=list(run.warnings),
        recommendations=list(run.recommendations),
        total_mass_kg=run.total_mass_kg,
        mass_limit_kg=run.mass_limit_kg,
        total_cost_usd=run.total_cost_usd,
        cost_limit_usd=run.cost_limit_usd,
        cost_used_pct=run.cost_used_pct,
        net_power_w=run.net_power_w,
        min_power_margin_w=run.min_power_margin_w,
        battery_min_state_of_charge_pct=run.battery_min_state_of_charge_pct,
        coverage_pct=run.coverage_pct,
        required_categories=run.required_categories,
        present_categories=run.present_categories,
        missing_categories=list(run.missing_categories),
        violation_codes=list(run.violation_codes),
    )


__all__ = [
    "ASSUMPTIONS",
    "COMM_PASS_THRESHOLD",
    "CONTACT_FRACTION_PER_ORBIT",
    "INTEGRATION_STEP_S",
    "LOW_BATTERY_THRESHOLD_PCT",
    "MISSION_DURATION_S",
    "SUNLIT_FRACTION_PER_ORBIT",
    "compute_score",
    "evaluate_mission_readiness",
    "simulate_mission",
]
