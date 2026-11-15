import pytest
from fastapi.testclient import TestClient

BASELINE_SLUGS = [
    "structure-3u-frame",
    "power-deployable-array",
    "power-li-ion-battery-40wh",
    "comm-uhf-transceiver",
    "obc-flight-computer",
    "payload-multispectral-imager",
    "thermal-passive-kit",
]

SIMULATION_URL = "/api/simulation/analyze"
SSO_INCLINATION_DEG = 97.5928772417652


@pytest.fixture()
def baseline_design(client: TestClient) -> dict:
    components = {
        component["slug"]: component for component in client.get("/api/components").json()
    }
    response = client.post(
        "/api/designs",
        json={
            "mission_slug": "earthwatch-01",
            "name": "EarthWatch-01 Baseline",
            "items": [
                {"component_id": components[slug]["id"], "quantity": 1}
                for slug in BASELINE_SLUGS
            ],
        },
    )
    assert response.status_code == 201
    return response.json()


def simulation_payload(
    design_id: int | None,
    *,
    altitude_km: float = 550.0,
    inclination_deg: float = SSO_INCLINATION_DEG,
    components: list[dict] | None = None,
) -> dict:
    return {
        "design_id": design_id,
        "design_name": "EarthWatch-01 Baseline",
        "mission_slug": "earthwatch-01",
        "design_data": {
            "altitude_km": altitude_km,
            "inclination_deg": inclination_deg,
        },
        "components": components or [],
    }


def test_simulation_accepts_the_exact_payload_that_caused_the_503(
    client: TestClient, baseline_design: dict
) -> None:
    """Regression: the browser payload mixed stale engineering values with a
    saved design id. The endpoint must accept it, ignore the browser numbers
    and compute everything from the saved design."""
    legacy_payload = {
        "design_id": baseline_design["id"],
        "design_name": "EarthWatch-01 Baseline",
        "mission_slug": "earthwatch-01",
        "design_data": {
            "altitude_km": 550,
            "inclination_deg": SSO_INCLINATION_DEG,
            "power_generation_w": 500,
            "power_consumption_w": 300,
            "mass_kg": 150,
            "cost_usd": 1000000,
            "present_categories": 3,
            "missing_categories": [],
            "coverage_pct": 85.0,
        },
        "mission_data": {
            "max_mass_kg": 5000,
            "max_cost_usd": 5000000,
            "min_power_margin_w": 100,
            "required_categories": ["power", "comm", "active", "payload"],
        },
        "components": [{"component_id": 1, "quantity": 1}],
    }

    response = client.post(SIMULATION_URL, json=legacy_payload)

    assert response.status_code == 200, response.text
    body = response.json()
    run = body["run"]

    # Values come from the saved design and the seeded mission, not the request.
    assert run["design_id"] == baseline_design["id"]
    assert run["design_name"] == "EarthWatch-01 Baseline"
    assert run["total_mass_kg"] == pytest.approx(5.7)
    assert run["power_generation_w"] == pytest.approx(28.0)
    assert run["power_consumption_w"] == pytest.approx(14.5)
    assert run["net_power_w"] == pytest.approx(13.5)
    assert run["total_cost_usd"] == 332000
    assert run["mass_limit_kg"] == pytest.approx(8.0)
    assert run["cost_limit_usd"] == 500000
    assert run["required_categories"] == 6
    assert run["missing_categories"] == []
    assert run["altitude_km"] == pytest.approx(550.0)
    assert run["inclination_deg"] == pytest.approx(SSO_INCLINATION_DEG)
    assert run["required_sso_inclination_deg"] == pytest.approx(
        SSO_INCLINATION_DEG, abs=1e-6
    )

    # Real orbit solution from the B4 engine.
    assert run["orbital_period_s"] == pytest.approx(5738.9468, abs=1e-4)
    assert run["orbits_completed"] > 0
    assert run["orbit_elapsed_s"] == pytest.approx(30 * 24 * 3600, rel=1e-9)
    assert len(run["timeline"]) == run["orbits_completed"]
    assert run["timeline"][0]["mission_phase"] == "orbit_insertion"

    # Power model is grounded in the calculated design.
    assert run["battery_energy_full_wh"] > 0
    assert 0.0 <= run["battery_min_state_of_charge_pct"] <= 100.0
    assert run["comm_contact_sessions"] > 0
    assert run["comm_contact_fraction"] == pytest.approx(0.25)

    # Scoring is complete, in range and internally consistent.
    breakdown = body["score_breakdown"]
    assert body["raw_score"] == run["raw_score"] == sum(breakdown.values())
    assert 0 <= body["raw_score"] <= 100
    assert breakdown == {
        "orbit_achievement": 25,
        "power_management": 20,
        "mass_management": 15,
        "communication": 15,
        "payload_performance": 15,
        "budget_management": 10,
    }
    assert run["mission_status"] == "success"
    assert run["warnings"] == []
    assert run["violation_codes"] == []
    assert run["assumptions"]

    # Readiness is derived from the returned run.
    readiness = body["readiness"]
    assert readiness["valid"] is True
    assert readiness["mission_status"] == run["mission_status"]
    assert readiness["total_mass_kg"] == run["total_mass_kg"]
    assert readiness["total_cost_usd"] == run["total_cost_usd"]


def test_simulation_selected_orbit_drives_the_timeline(
    client: TestClient, baseline_design: dict
) -> None:
    orbit = client.post(
        "/api/orbit/analyze",
        json={"altitude_km": 700.0, "inclination_deg": 80.0},
    ).json()

    response = client.post(
        SIMULATION_URL,
        json=simulation_payload(
            baseline_design["id"], altitude_km=700.0, inclination_deg=80.0
        ),
    )

    assert response.status_code == 200, response.text
    run = response.json()["run"]
    assert run["altitude_km"] == pytest.approx(700.0)
    assert run["inclination_deg"] == pytest.approx(80.0)
    assert run["orbital_period_s"] == pytest.approx(orbit["period_s"])
    assert run["required_sso_inclination_deg"] == pytest.approx(
        orbit["sun_synchronous"]["required_inclination_deg"]
    )
    # 80 degrees is far from the solved sun-synchronous inclination.
    assert run["score_breakdown"]["orbit_achievement"] < 25


def test_simulation_unsaved_design_uses_explicit_component_lines(
    client: TestClient,
) -> None:
    components = {
        component["slug"]: component for component in client.get("/api/components").json()
    }
    items = [
        {"component_id": components[slug]["id"], "quantity": 1}
        for slug in BASELINE_SLUGS
    ]

    payload = simulation_payload(None, components=items)
    payload.pop("design_name")

    response = client.post(
        SIMULATION_URL,
        json=payload,
    )

    assert response.status_code == 200, response.text
    run = response.json()["run"]
    assert run["design_id"] == 0
    assert run["design_name"] == "EarthWatch-01 concept"
    assert run["total_mass_kg"] == pytest.approx(5.7)
    assert run["total_cost_usd"] == 332000


def test_simulation_is_deterministic(client: TestClient, baseline_design: dict) -> None:
    payload = simulation_payload(baseline_design["id"])
    first = client.post(SIMULATION_URL, json=payload).json()["run"]
    second = client.post(SIMULATION_URL, json=payload).json()["run"]

    deterministic_fields = [
        "orbits_completed",
        "orbit_elapsed_s",
        "orbital_period_s",
        "battery_min_state_of_charge_pct",
        "battery_state_of_charge_pct",
        "comm_contact_sessions",
        "raw_score",
        "mission_status",
    ]
    for field in deterministic_fields:
        assert first[field] == second[field]
    assert [point["mission_phase"] for point in first["timeline"]] == [
        point["mission_phase"] for point in second["timeline"]
    ]


def test_simulation_rejects_unknown_design(client: TestClient) -> None:
    response = client.post(SIMULATION_URL, json=simulation_payload(999999))

    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "DESIGN_NOT_FOUND"


def test_simulation_rejects_mission_design_mismatch(
    client: TestClient, baseline_design: dict
) -> None:
    payload = simulation_payload(baseline_design["id"])
    payload["mission_slug"] = "missing-mission"

    response = client.post(SIMULATION_URL, json=payload)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "MISSION_DESIGN_MISMATCH"


def test_simulation_rejects_empty_design(client: TestClient) -> None:
    response = client.post(SIMULATION_URL, json=simulation_payload(None))

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "EMPTY_DESIGN"


@pytest.mark.parametrize(
    "design_data",
    [
        {"altitude_km": 0, "inclination_deg": 98.0},
        {"altitude_km": 550.0, "inclination_deg": 181.0},
        {"inclination_deg": 98.0},
    ],
)
def test_simulation_rejects_invalid_orbit(
    client: TestClient, baseline_design: dict, design_data: dict
) -> None:
    payload = simulation_payload(baseline_design["id"])
    payload["design_data"] = design_data

    response = client.post(SIMULATION_URL, json=payload)

    assert response.status_code == 422


def test_simulation_is_mounted_under_the_api_prefix(
    client: TestClient, baseline_design: dict
) -> None:
    payload = simulation_payload(baseline_design["id"])

    legacy = client.post("/simulation/analyze", json=payload)

    assert legacy.status_code == 404
