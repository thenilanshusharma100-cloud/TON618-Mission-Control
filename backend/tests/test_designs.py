from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import Mission, Spacecraft, SpacecraftComponent

BASELINE_SLUGS = [
    "structure-3u-frame",
    "power-deployable-array",
    "power-li-ion-battery-40wh",
    "comm-uhf-transceiver",
    "obc-flight-computer",
    "payload-multispectral-imager",
    "thermal-passive-kit",
]


@pytest.fixture(autouse=True)
def clean_saved_designs(db_session) -> Iterator[None]:
    def purge() -> None:
        for spacecraft in db_session.scalars(select(Spacecraft)).all():
            db_session.delete(spacecraft)
        db_session.commit()

    purge()
    yield
    purge()


def components_by_slug(client: TestClient) -> dict[str, dict]:
    response = client.get("/api/components")
    assert response.status_code == 200
    return {component["slug"]: component for component in response.json()}


def design_items(
    components: dict[str, dict], slugs: list[str], quantity: int = 1
) -> list[dict]:
    return [
        {"component_id": components[slug]["id"], "quantity": quantity} for slug in slugs
    ]


def create_payload(
    components: dict[str, dict],
    slugs: list[str],
    name: str = "EarthWatch-01 Baseline",
) -> dict:
    return {
        "mission_slug": "earthwatch-01",
        "name": name,
        "items": design_items(components, slugs),
    }


def test_create_design_persists_and_validates(client: TestClient, db_session) -> None:
    components = components_by_slug(client)
    response = client.post("/api/designs", json=create_payload(components, BASELINE_SLUGS))

    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert body["name"] == "EarthWatch-01 Baseline"
    assert body["mission_slug"] == "earthwatch-01"
    assert body["valid"] is True
    assert body["violations"] == []
    assert body["totals"]["mass_kg"] == pytest.approx(5.7)
    assert body["totals"]["power_margin_w"] == pytest.approx(13.5)
    assert body["totals"]["cost_usd"] == 332000
    assert len(body["items"]) == 7
    assert body["items"] == sorted(body["items"], key=lambda item: item["component_id"])

    listed = client.get("/api/designs", params={"mission_slug": "earthwatch-01"})
    assert listed.status_code == 200
    assert [design["id"] for design in listed.json()] == [body["id"]]

    detail = client.get(f"/api/designs/{body['id']}")
    assert detail.status_code == 200
    assert detail.json()["name"] == "EarthWatch-01 Baseline"

    spacecraft = db_session.scalar(select(Spacecraft).where(Spacecraft.id == body["id"]))
    assert spacecraft is not None
    assert len(spacecraft.components) == 7

    rows = db_session.scalars(
        select(SpacecraftComponent).where(SpacecraftComponent.spacecraft_id == body["id"])
    ).all()
    assert len(rows) == 7


def test_update_design_recalculates_and_keeps_record(client: TestClient) -> None:
    components = components_by_slug(client)
    created = client.post("/api/designs", json=create_payload(components, BASELINE_SLUGS))
    design_id = created.json()["id"]

    response = client.put(
        f"/api/designs/{design_id}",
        json={
            "name": "Stripped Payload Test",
            "items": design_items(components, ["payload-multispectral-imager"]),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == design_id
    assert body["name"] == "Stripped Payload Test"
    assert body["valid"] is False
    assert body["totals"]["mass_kg"] == pytest.approx(1.1)
    assert body["totals"]["cost_usd"] == 120000
    assert len(body["items"]) == 1
    codes = [violation["code"] for violation in body["violations"]]
    assert codes.count("MISSING_REQUIRED_CATEGORY") == 5
    assert "POWER_MARGIN_LOW" in codes

    detail = client.get(f"/api/designs/{design_id}")
    assert detail.json()["name"] == "Stripped Payload Test"
    assert detail.json()["items"] == [
        {
            "component_id": components["payload-multispectral-imager"]["id"],
            "quantity": 1,
        }
    ]


def test_duplicate_items_are_merged_on_save(client: TestClient) -> None:
    components = components_by_slug(client)
    component_id = components["obc-flight-computer"]["id"]

    response = client.post(
        "/api/designs",
        json={
            "mission_slug": "earthwatch-01",
            "name": "Merged Quantity",
            "items": [
                {"component_id": component_id, "quantity": 2},
                {"component_id": component_id, "quantity": 3},
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["totals"]["total_quantity"] == 5
    assert body["items"] == [{"component_id": component_id, "quantity": 5}]


def test_list_filters_by_mission(client: TestClient) -> None:
    components = components_by_slug(client)
    created = client.post("/api/designs", json=create_payload(components, BASELINE_SLUGS))
    assert created.status_code == 201

    empty = client.get("/api/designs", params={"mission_slug": "missing-mission"})
    assert empty.status_code == 200
    assert empty.json() == []


def test_design_error_paths(client: TestClient) -> None:
    components = components_by_slug(client)

    unknown_mission = client.post(
        "/api/designs",
        json={
            "mission_slug": "missing-mission",
            "name": "Unknown Mission",
            "items": [],
        },
    )
    assert unknown_mission.status_code == 404
    assert unknown_mission.json()["detail"]["code"] == "MISSION_NOT_FOUND"

    unknown_component = client.post(
        "/api/designs",
        json={
            "mission_slug": "earthwatch-01",
            "name": "Unknown Component",
            "items": [{"component_id": 999999, "quantity": 1}],
        },
    )
    assert unknown_component.status_code == 422
    assert unknown_component.json()["detail"]["code"] == "UNKNOWN_COMPONENT_IDS"

    missing = client.get("/api/designs/999999")
    assert missing.status_code == 404
    assert missing.json()["detail"]["code"] == "DESIGN_NOT_FOUND"

    blank_name = client.post(
        "/api/designs",
        json={
            "mission_slug": "earthwatch-01",
            "name": "   ",
            "items": design_items(components, BASELINE_SLUGS),
        },
    )
    assert blank_name.status_code == 422


def test_seeded_mission_is_still_available(client: TestClient, db_session) -> None:
    mission = db_session.scalar(select(Mission).where(Mission.slug == "earthwatch-01"))
    assert mission is not None
    assert mission.max_mass_kg == 8.0
