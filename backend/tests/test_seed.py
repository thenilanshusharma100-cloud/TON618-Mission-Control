from dataclasses import asdict

import pytest
from sqlalchemy import select

from app.db.base import SessionLocal
from app.db.init_db import init_db
from app.domain.enums import ComponentCategory, DataClassification, PowerRole
from app.models import Component, DataSource, Mission, ScientificData


def test_seed_is_idempotent_and_complete() -> None:
    init_db()
    second = init_db()

    assert sum(asdict(second).values()) == 0

    with SessionLocal() as session:
        mission = session.scalar(select(Mission).where(Mission.slug == "earthwatch-01"))
        components = session.scalars(select(Component)).all()
        constants = session.scalars(select(ScientificData)).all()
        categories = {component.category for component in components}

        assert mission is not None
        assert mission.max_mass_kg == 8.0
        assert mission.max_cost_usd == 500000
        assert mission.min_power_margin_w == 5.0
        assert set(mission.required_categories) == {
            "structure",
            "power",
            "communication",
            "onboard_computer",
            "payload",
            "thermal_control",
        }
        assert len(components) == 15
        assert categories == set(ComponentCategory)
        assert all(component.rationale for component in components)
        assert all(component.cost_usd >= 0 for component in components)
        assert all(component.mass_kg >= 0 for component in components)
        assert sum(component.power_role is PowerRole.GENERATOR for component in components) == 2

        assert len(constants) == 7
        published = [
            row for row in constants if row.classification is DataClassification.PUBLISHED_REFERENCE
        ]
        derived = [row for row in constants if row.classification is DataClassification.DERIVED]
        assert len(published) == 6
        assert len(derived) == 1
        assert all(row.source_id is not None for row in published)


def test_nasa_constants_keep_source_and_original_units() -> None:
    init_db()

    with SessionLocal() as session:
        gm = session.scalar(select(ScientificData).where(ScientificData.key == "earth.gm"))
        omega = session.scalar(
            select(ScientificData).where(ScientificData.key == "earth.angular_velocity")
        )
        source = session.scalar(
            select(DataSource).where(DataSource.key == "nasa-nssdca-earth-fact-sheet")
        )

        assert gm is not None
        assert gm.original_value == pytest.approx(398600.4418)
        assert gm.original_unit == "km^3/s^2"
        assert gm.si_unit == "m^3/s^2"
        assert gm.value_si == pytest.approx(3.986004418e14)
        assert gm.classification is DataClassification.PUBLISHED_REFERENCE
        assert gm.source is not None
        assert gm.source.url == "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html"

        assert source is not None
        assert source.publisher.startswith("NASA")

        assert omega is not None
        assert omega.classification is DataClassification.DERIVED
        assert omega.value_si == pytest.approx(7.292115e-5, rel=1e-5)
        assert omega.source_id == gm.source_id


def test_estimated_scientific_data_cannot_cite_source(db_session) -> None:
    source = db_session.scalar(select(DataSource))
    assert source is not None

    db_session.add(
        ScientificData(
            key="test.estimated.with.source",
            label="Invalid estimated fact",
            value_si=1.0,
            si_unit="m",
            original_value=1.0,
            original_unit="m",
            classification=DataClassification.ESTIMATED,
            method="test",
            source_id=source.id,
        )
    )

    from sqlalchemy.exc import IntegrityError

    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_published_reference_requires_source(db_session) -> None:
    db_session.add(
        ScientificData(
            key="test.published.without.source",
            label="Invalid published fact",
            value_si=1.0,
            si_unit="m",
            original_value=1.0,
            original_unit="m",
            classification=DataClassification.PUBLISHED_REFERENCE,
        )
    )

    from sqlalchemy.exc import IntegrityError

    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()
