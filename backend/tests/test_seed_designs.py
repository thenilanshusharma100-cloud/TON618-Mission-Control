from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.data.catalog import load_catalog
from app.db.seed import DEMO_DESIGNS, SeedSummary, seed_catalog
from app.models import Mission, Spacecraft

BASELINE_NAME = "EarthWatch-01 Baseline"
CONCEPT_NAME = "High-Resolution Concept"


@pytest.fixture(autouse=True)
def clean_saved_designs(db_session) -> Iterator[None]:
    def purge() -> None:
        for spacecraft in db_session.scalars(select(Spacecraft)).all():
            db_session.delete(spacecraft)
        db_session.commit()

    purge()
    yield
    purge()


def seed(db_session) -> SeedSummary:
    return seed_catalog(db_session, load_catalog())


def component_ids_by_slug(client: TestClient) -> dict[str, int]:
    response = client.get("/api/components")
    assert response.status_code == 200
    return {component["slug"]: component["id"] for component in response.json()}


def expected_items(
    lines: tuple[tuple[str, int], ...], ids: dict[str, int]
) -> list[dict[str, int]]:
    return sorted(
        (
            {"component_id": ids[slug], "quantity": quantity}
            for slug, quantity in lines
        ),
        key=lambda item: item["component_id"],
    )


def design_list(client: TestClient) -> list[dict]:
    response = client.get("/api/designs", params={"mission_slug": "earthwatch-01"})
    assert response.status_code == 200
    return response.json()


def test_seed_creates_baseline_first_with_ids_one_and_two(
    client: TestClient, db_session
) -> None:
    summary = seed(db_session)
    assert summary.designs == 2

    designs = db_session.scalars(select(Spacecraft).order_by(Spacecraft.id)).all()
    assert [(design.id, design.name) for design in designs] == [
        (1, BASELINE_NAME),
        (2, CONCEPT_NAME),
    ]
    assert [design["name"] for design in design_list(client)] == [
        BASELINE_NAME,
        CONCEPT_NAME,
    ]


def test_seeded_recipes_and_engineering_totals(
    client: TestClient, db_session
) -> None:
    summary = seed(db_session)
    assert summary.designs == 2

    ids = component_ids_by_slug(client)
    designs = {design["name"]: design for design in design_list(client)}

    baseline = designs[BASELINE_NAME]
    assert baseline["items"] == expected_items(DEMO_DESIGNS[0][1], ids)
    assert baseline["totals"]["mass_kg"] == pytest.approx(7.8)
    assert baseline["totals"]["power_generation_w"] == pytest.approx(52.0)
    assert baseline["totals"]["power_consumption_w"] == pytest.approx(14.5)
    assert baseline["totals"]["power_margin_w"] == pytest.approx(37.5)
    assert baseline["totals"]["cost_usd"] == 418000
    assert baseline["valid"] is True
    assert baseline["violations"] == []

    concept = designs[CONCEPT_NAME]
    assert concept["items"] == expected_items(DEMO_DESIGNS[1][1], ids)
    assert concept["totals"]["mass_kg"] == pytest.approx(8.95)
    assert concept["totals"]["power_generation_w"] == pytest.approx(28.0)
    assert concept["totals"]["power_consumption_w"] == pytest.approx(33.5)
    assert concept["totals"]["power_margin_w"] == pytest.approx(-5.5)
    assert concept["totals"]["cost_usd"] == 531000
    assert concept["valid"] is False
    assert {violation["code"] for violation in concept["violations"]} == {
        "MASS_OVER_BUDGET",
        "POWER_MARGIN_LOW",
        "COST_OVER_BUDGET",
    }


def test_repeated_startup_does_not_duplicate_designs(
    client: TestClient, db_session
) -> None:
    first = seed(db_session)
    second = seed(db_session)

    assert (first.designs, second.designs) == (2, 0)
    assert len(design_list(client)) == 2


def test_seed_skips_when_any_saved_design_exists(
    client: TestClient, db_session
) -> None:
    mission = db_session.scalar(
        select(Mission).where(Mission.slug == "earthwatch-01")
    )
    assert mission is not None
    existing = Spacecraft(mission=mission, name="My Existing Design")
    db_session.add(existing)
    db_session.commit()
    existing_id = existing.id

    summary = seed(db_session)

    assert summary.designs == 0
    designs = db_session.scalars(select(Spacecraft)).all()
    assert [(design.id, design.name) for design in designs] == [
        (existing_id, "My Existing Design")
    ]
    assert [design["name"] for design in design_list(client)] == [
        "My Existing Design"
    ]
