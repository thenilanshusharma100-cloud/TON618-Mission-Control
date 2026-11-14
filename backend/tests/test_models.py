import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.domain.enums import ComponentCategory, DataClassification, PowerRole
from app.models import Component, DataSource, Mission, Spacecraft, SpacecraftComponent


def test_spacecraft_aggregates_components(db_session) -> None:
    mission = db_session.scalar(select(Mission).where(Mission.slug == "earthwatch-01"))
    component = db_session.scalar(
        select(Component).where(Component.slug == "payload-multispectral-imager")
    )
    assert mission is not None
    assert component is not None

    spacecraft = Spacecraft(mission=mission, name="EarthWatch-01 Test Bus")
    spacecraft.components.append(SpacecraftComponent(component=component, quantity=2))
    db_session.add(spacecraft)
    db_session.flush()

    assert spacecraft.id is not None
    assert len(spacecraft.components) == 1
    assert spacecraft.components[0].quantity == 2
    assert spacecraft.components[0].component.slug == "payload-multispectral-imager"
    assert mission.spacecrafts[0].name == "EarthWatch-01 Test Bus"

    db_session.rollback()


def test_duplicate_component_per_spacecraft_is_rejected(db_session) -> None:
    mission = db_session.scalar(select(Mission).where(Mission.slug == "earthwatch-01"))
    component = db_session.scalar(select(Component).where(Component.slug == "obc-flight-computer"))
    assert mission is not None
    assert component is not None

    spacecraft = Spacecraft(mission=mission, name="Duplicate Test")
    spacecraft.components.append(SpacecraftComponent(component=component, quantity=1))
    spacecraft.components.append(SpacecraftComponent(component=component, quantity=2))
    db_session.add(spacecraft)

    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_estimated_component_cannot_cite_source(db_session) -> None:
    source = db_session.scalar(select(DataSource))
    assert source is not None

    db_session.add(
        Component(
            slug="test-invalid-estimated",
            name="Invalid Estimated Component",
            description="Should be rejected by the provenance constraint.",
            category=ComponentCategory.STRUCTURE,
            mass_kg=1.0,
            power_w=0.0,
            power_role=PowerRole.CONSUMER,
            cost_usd=1,
            data_classification=DataClassification.ESTIMATED,
            rationale="Test rationale for the constraint.",
            source_id=source.id,
        )
    )

    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_published_component_requires_source(db_session) -> None:
    db_session.add(
        Component(
            slug="test-invalid-published",
            name="Invalid Published Component",
            description="Should be rejected by the provenance constraint.",
            category=ComponentCategory.STRUCTURE,
            mass_kg=1.0,
            power_w=0.0,
            power_role=PowerRole.CONSUMER,
            cost_usd=1,
            data_classification=DataClassification.PUBLISHED_REFERENCE,
            rationale="Test rationale for the constraint.",
            source_id=None,
        )
    )

    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()
