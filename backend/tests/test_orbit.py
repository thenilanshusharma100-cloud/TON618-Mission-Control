from datetime import date
from math import degrees, pi, sqrt

import pytest
from fastapi.testclient import TestClient

from app.db.init_db import init_db
from app.services.orbit import (
    SUN_SYNCHRONOUS_TARGET_RAD_S,
    EarthConstants,
    OrbitModelError,
    analyze_orbit,
    j2_nodal_precession,
    load_earth_constants,
    orbital_period,
    orbital_radius,
    orbital_velocity,
    specific_angular_momentum,
    specific_orbital_energy,
    sun_synchronous_inclination,
)

MU = 3.986004418e14
R_EARTH = 6378.1e3
J2 = 0.00108263
ALTITUDE_M = 550e3


def expected_solution() -> tuple[float, float, float, float, float]:
    radius = R_EARTH + ALTITUDE_M
    return (
        radius,
        sqrt(MU / radius),
        2.0 * pi * sqrt(radius**3 / MU),
        -MU / (2.0 * radius),
        sqrt(MU * radius),
    )


def test_orbital_elements_match_closed_form() -> None:
    radius, velocity, period, energy, angular_momentum = expected_solution()

    assert orbital_radius(ALTITUDE_M, R_EARTH) == pytest.approx(radius)
    assert orbital_velocity(MU, radius) == pytest.approx(velocity, rel=1e-12)
    assert orbital_period(MU, radius) == pytest.approx(period, rel=1e-12)
    assert specific_orbital_energy(MU, radius) == pytest.approx(energy, rel=1e-12)
    assert specific_angular_momentum(MU, radius) == pytest.approx(
        angular_momentum, rel=1e-12
    )

    # Reference values at 550 km (computed from the seeded NASA constants).
    assert radius == pytest.approx(6_928_100.0)
    assert velocity == pytest.approx(7585.1088, abs=1e-4)
    assert period == pytest.approx(5738.9468, abs=1e-4)
    assert period / 60.0 == pytest.approx(95.6491, abs=1e-4)
    assert energy == pytest.approx(-28_766_937.674, abs=1e-3)
    assert angular_momentum == pytest.approx(5.2550392e10, rel=1e-6)


def test_j2_nodal_precession_uses_target_rate_not_hardcoded_inclination() -> None:
    radius = orbital_radius(ALTITUDE_M, R_EARTH)

    equatorial_rate = j2_nodal_precession(MU, radius, R_EARTH, J2, 0.0)
    assert equatorial_rate < 0.0

    inclination = sun_synchronous_inclination(MU, radius, R_EARTH, J2)
    assert degrees(inclination) == pytest.approx(97.592877, abs=1e-6)
    assert inclination > pi / 2.0

    sso_rate = j2_nodal_precession(MU, radius, R_EARTH, J2, inclination)
    assert sso_rate > 0.0
    assert sso_rate == pytest.approx(SUN_SYNCHRONOUS_TARGET_RAD_S, rel=1e-12)
    assert degrees(sso_rate) * 86400.0 == pytest.approx(0.9856473, abs=1e-6)


def test_sso_inclination_varies_with_altitude() -> None:
    low = sun_synchronous_inclination(MU, orbital_radius(550e3, R_EARTH), R_EARTH, J2)
    high = sun_synchronous_inclination(MU, orbital_radius(2000e3, R_EARTH), R_EARTH, J2)

    assert degrees(low) == pytest.approx(97.592877, abs=1e-6)
    assert degrees(high) == pytest.approx(104.889973, abs=1e-6)
    assert high > low


def test_orbit_model_rejects_invalid_inputs() -> None:
    radius = orbital_radius(ALTITUDE_M, R_EARTH)

    with pytest.raises(OrbitModelError):
        orbital_radius(0.0, R_EARTH)
    with pytest.raises(OrbitModelError):
        orbital_velocity(0.0, radius)
    with pytest.raises(OrbitModelError):
        orbital_period(MU, 0.0)
    with pytest.raises(OrbitModelError):
        j2_nodal_precession(MU, radius, R_EARTH, J2, pi + 0.1)
    with pytest.raises(OrbitModelError):
        sun_synchronous_inclination(MU, radius, R_EARTH, J2, target_rate_rad_s=-1.0)


def test_analyze_orbit_returns_consistent_solution() -> None:
    constants = EarthConstants(
        gravitational_parameter_m3_s2=MU,
        equatorial_radius_m=R_EARTH,
        j2=J2,
        source_title="Earth Fact Sheet",
        source_url="https://example.test/earth",
        retrieved_on=date(2026, 11, 14),
    )
    solution = analyze_orbit(constants, ALTITUDE_M, 0.0)
    radius, velocity, period, energy, angular_momentum = expected_solution()

    assert solution.radius_m == pytest.approx(radius)
    assert solution.velocity_m_s == pytest.approx(velocity)
    assert solution.period_s == pytest.approx(period)
    assert solution.specific_energy_j_kg == pytest.approx(energy)
    assert solution.angular_momentum_m2_s == pytest.approx(angular_momentum)
    assert solution.nodal_precession_rad_s < 0.0


def test_orbit_endpoint_returns_si_elements_and_source(client: TestClient) -> None:
    response = client.post(
        "/api/orbit/analyze",
        json={"altitude_km": 550.0, "inclination_deg": 97.5928772417652},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["central_body"] == "Earth"
    assert body["orbit_type"] == "circular_leo"
    assert body["altitude_km"] == pytest.approx(550.0)
    assert body["altitude_m"] == pytest.approx(550_000.0)
    assert body["inclination_rad"] == pytest.approx(pi * 97.5928772417652 / 180.0)
    assert body["radius_m"] == pytest.approx(6_928_100.0)
    assert body["velocity_m_s"] == pytest.approx(7585.1088, abs=1e-4)
    assert body["period_s"] == pytest.approx(5738.9468, abs=1e-4)
    assert body["specific_energy_j_kg"] == pytest.approx(-28_766_937.674, abs=1e-3)
    assert body["angular_momentum_m2_s"] == pytest.approx(5.2550392e10, rel=1e-6)
    assert body["orbits_per_day"] == pytest.approx(15.0550, abs=1e-4)
    assert body["epoch_utc"]

    assert body["constants"]["source_url"] == (
        "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html"
    )
    assert body["constants"]["gravitational_parameter_m3_s2"] == pytest.approx(MU)
    assert body["constants"]["equatorial_radius_m"] == pytest.approx(R_EARTH)
    assert body["constants"]["j2"] == pytest.approx(J2)

    sso = body["sun_synchronous"]
    assert sso["required_inclination_deg"] == pytest.approx(97.592877, abs=1e-6)
    assert sso["is_sun_synchronous"] is True
    assert abs(sso["inclination_delta_deg"]) < 1e-6
    assert body["assumptions"]
    assert body["limitations"]


def test_orbit_endpoint_flags_non_sso_inclination(client: TestClient) -> None:
    response = client.post(
        "/api/orbit/analyze",
        json={"altitude_km": 550.0, "inclination_deg": 0.0},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["nodal_precession_rad_s"] < 0.0
    assert body["sun_synchronous"]["is_sun_synchronous"] is False
    assert body["sun_synchronous"]["required_inclination_deg"] == pytest.approx(
        97.592877, abs=1e-6
    )
    assert body["sun_synchronous"]["inclination_delta_deg"] == pytest.approx(
        -97.592877, abs=1e-6
    )


@pytest.mark.parametrize(
    "payload",
    [
        {"altitude_km": 50.0, "inclination_deg": 98.0},
        {"altitude_km": 2500.0, "inclination_deg": 98.0},
        {"altitude_km": 550.0, "inclination_deg": -1.0},
        {"altitude_km": 550.0, "inclination_deg": 181.0},
        {"altitude_km": 550.0},
    ],
)
def test_orbit_endpoint_rejects_invalid_inputs(client: TestClient, payload: dict) -> None:
    response = client.post("/api/orbit/analyze", json=payload)
    assert response.status_code == 422


def test_orbit_constants_come_from_seeded_reference_data(client: TestClient, db_session) -> None:
    init_db()
    constants = load_earth_constants(db_session)
    assert constants.gravitational_parameter_m3_s2 == pytest.approx(MU)
    assert constants.equatorial_radius_m == pytest.approx(R_EARTH)
    assert constants.j2 == pytest.approx(J2)
    assert constants.source_url.startswith("https://nssdc.gsfc.nasa.gov/")
    assert constants.source_title == "Earth Fact Sheet"
    assert client.post(
        "/api/orbit/analyze", json={"altitude_km": 550.0, "inclination_deg": 97.6}
    ).status_code == 200
