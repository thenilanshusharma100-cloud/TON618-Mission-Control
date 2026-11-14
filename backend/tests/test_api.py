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


def components_by_slug(client: TestClient) -> dict[str, dict]:
    response = client.get("/api/components")
    assert response.status_code == 200
    return {component["slug"]: component for component in response.json()}


def design_payload(
    components: dict[str, dict], slugs: list[str], quantity: int = 1
) -> dict:
    return {
        "mission_slug": "earthwatch-01",
        "items": [
            {"component_id": components[slug]["id"], "quantity": quantity} for slug in slugs
        ],
    }


def test_list_missions(client: TestClient) -> None:
    response = client.get("/api/missions")

    assert response.status_code == 200
    missions = response.json()
    assert len(missions) == 1
    assert missions[0]["slug"] == "earthwatch-01"
    assert missions[0]["max_mass_kg"] == 8.0
    assert missions[0]["max_cost_usd"] == 500000
    assert "payload" in missions[0]["required_categories"]
    assert "not NASA requirements" in missions[0]["budget_rationale"]


def test_list_components_and_filter(client: TestClient) -> None:
    response = client.get("/api/components")

    assert response.status_code == 200
    components = response.json()
    assert len(components) == 15
    assert all(component["cost_currency"] == "USD" for component in components)
    assert all(component["data_classification"] == "estimated" for component in components)
    assert all(component["rationale"] for component in components)
    assert all(component["source"] is None for component in components)

    filtered = client.get("/api/components", params={"category": "power"})
    assert filtered.status_code == 200
    assert len(filtered.json()) == 3
    assert all(component["category"] == "power" for component in filtered.json())

    invalid = client.get("/api/components", params={"category": "warp-core"})
    assert invalid.status_code == 422


def test_get_component_and_missing(client: TestClient) -> None:
    components = components_by_slug(client)
    imager = components["payload-multispectral-imager"]

    response = client.get(f"/api/components/{imager['id']}")
    assert response.status_code == 200
    assert response.json()["slug"] == "payload-multispectral-imager"
    assert response.json()["mass_kg"] == 1.1

    missing = client.get("/api/components/999999")
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "COMPONENT_NOT_FOUND"


def test_calculate_baseline_design(client: TestClient) -> None:
    components = components_by_slug(client)
    response = client.post(
        "/api/design/calculate", json=design_payload(components, BASELINE_SLUGS)
    )

    assert response.status_code == 200
    body = response.json()
    totals = body["totals"]
    budgets = body["budgets"]

    assert totals["mass_kg"] == pytest.approx(5.7)
    assert totals["power_consumption_w"] == pytest.approx(14.5)
    assert totals["power_generation_w"] == pytest.approx(28.0)
    assert totals["power_margin_w"] == pytest.approx(13.5)
    assert totals["cost_usd"] == 332000
    assert totals["cost_currency"] == "USD"
    assert totals["component_count"] == 7
    assert totals["total_quantity"] == 7

    assert budgets["mass_remaining_kg"] == pytest.approx(2.3)
    assert budgets["cost_remaining_usd"] == 168000
    assert budgets["power_surplus_w"] == pytest.approx(8.5)

    assert len(body["categories"]) == 7
    payload = next(row for row in body["categories"] if row["category"] == "payload")
    assert payload["mass_kg"] == pytest.approx(1.1)
    assert payload["power_consumption_w"] == pytest.approx(8.0)


def test_validate_baseline_design_is_valid(client: TestClient) -> None:
    components = components_by_slug(client)
    response = client.post(
        "/api/design/validate", json=design_payload(components, BASELINE_SLUGS)
    )

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["violations"] == []


def test_validate_incomplete_design(client: TestClient) -> None:
    components = components_by_slug(client)
    response = client.post(
        "/api/design/validate",
        json=design_payload(components, ["payload-multispectral-imager"]),
    )

    assert response.status_code == 200
    body = response.json()
    codes = [violation["code"] for violation in body["violations"]]

    assert body["valid"] is False
    assert codes.count("MISSING_REQUIRED_CATEGORY") == 5
    assert "POWER_MARGIN_LOW" in codes


def test_validate_overbudget_design(client: TestClient) -> None:
    components = components_by_slug(client)
    payload = {
        "mission_slug": "earthwatch-01",
        "items": [{"component_id": components["structure-6u-frame"]["id"], "quantity": 10}],
    }
    response = client.post("/api/design/validate", json=payload)

    assert response.status_code == 200
    body = response.json()
    codes = {violation["code"] for violation in body["violations"]}

    assert body["valid"] is False
    assert "MASS_OVER_BUDGET" in codes
    assert "COST_OVER_BUDGET" in codes


def test_empty_design_is_reported(client: TestClient) -> None:
    response = client.post(
        "/api/design/validate",
        json={"mission_slug": "earthwatch-01", "items": []},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is False
    assert body["totals"]["total_quantity"] == 0
    assert any(violation["code"] == "EMPTY_DESIGN" for violation in body["violations"])


def test_duplicate_items_are_merged(client: TestClient) -> None:
    components = components_by_slug(client)
    component_id = components["obc-flight-computer"]["id"]
    response = client.post(
        "/api/design/calculate",
        json={
            "mission_slug": "earthwatch-01",
            "items": [
                {"component_id": component_id, "quantity": 2},
                {"component_id": component_id, "quantity": 3},
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()["totals"]["total_quantity"] == 5
    assert response.json()["totals"]["component_count"] == 1


def test_unknown_component_and_mission(client: TestClient) -> None:
    unknown_component = client.post(
        "/api/design/calculate",
        json={
            "mission_slug": "earthwatch-01",
            "items": [{"component_id": 999999, "quantity": 1}],
        },
    )
    assert unknown_component.status_code == 422
    assert unknown_component.json()["detail"]["code"] == "UNKNOWN_COMPONENT_IDS"

    unknown_mission = client.post(
        "/api/design/calculate",
        json={"mission_slug": "missing-mission", "items": []},
    )
    assert unknown_mission.status_code == 404
    assert unknown_mission.json()["detail"]["code"] == "MISSION_NOT_FOUND"
