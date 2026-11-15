from dataclasses import dataclass
from datetime import timedelta
from math import pi

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.units import convert
from app.data.catalog import SI_UNITS, Catalog
from app.domain.enums import DataClassification
from app.models import (
    Component,
    DataSource,
    Mission,
    ScientificData,
    Spacecraft,
    SpacecraftComponent,
)
from app.models.science import utcnow

DERIVED_ANGULAR_VELOCITY_KEY = "earth.angular_velocity"

DEMO_DESIGNS: tuple[tuple[str, tuple[tuple[str, int], ...]], ...] = (
    (
        "EarthWatch-01 Baseline",
        (
            ("structure-3u-frame", 1),
            ("power-body-mounted-array", 2),
            ("power-deployable-array", 1),
            ("power-li-ion-battery-40wh", 2),
            ("comm-uhf-transceiver", 1),
            ("obc-flight-computer", 1),
            ("payload-multispectral-imager", 1),
            ("thermal-passive-kit", 1),
        ),
    ),
    (
        "High-Resolution Concept",
        (
            ("structure-6u-frame", 1),
            ("power-deployable-array", 1),
            ("power-li-ion-battery-40wh", 1),
            ("comm-sband-transmitter", 1),
            ("comm-high-gain-antenna", 1),
            ("obc-flight-computer", 1),
            ("payload-high-res-imager", 1),
            ("thermal-active-control", 1),
        ),
    ),
)


@dataclass(frozen=True)
class SeedSummary:
    sources: int = 0
    constants: int = 0
    derived: int = 0
    components: int = 0
    missions: int = 0
    designs: int = 0


def seed_catalog(session: Session, catalog: Catalog) -> SeedSummary:
    """Insert catalog rows that do not exist yet. Safe to run repeatedly."""
    counts = {
        "sources": 0,
        "constants": 0,
        "derived": 0,
        "components": 0,
        "missions": 0,
        "designs": 0,
    }

    sources: dict[str, DataSource] = {}
    for record in catalog.sources:
        source = session.scalar(select(DataSource).where(DataSource.key == record.key))
        if source is None:
            source = DataSource(
                key=record.key,
                title=record.title,
                publisher=record.publisher,
                url=record.url,
                retrieved_on=record.retrieved_on,
                kind=record.kind,
            )
            session.add(source)
            session.flush()
            counts["sources"] += 1
        sources[record.key] = source

    constant_rows: dict[str, ScientificData] = {}
    for record in catalog.constants:
        existing = session.scalar(
            select(ScientificData).where(ScientificData.key == record.key)
        )
        if existing is not None:
            constant_rows[record.key] = existing
            continue

        si_unit = SI_UNITS[record.quantity_kind]
        value_si = convert(record.original_value, record.original_unit, si_unit)
        row = ScientificData(
            key=record.key,
            label=record.label,
            value_si=value_si,
            si_unit=si_unit,
            original_value=record.original_value,
            original_unit=record.original_unit,
            classification=record.classification,
            method=record.method,
            notes=record.notes,
            source_id=sources[record.source].id if record.source else None,
        )
        session.add(row)
        session.flush()
        constant_rows[record.key] = row
        counts["constants"] += 1

    period = constant_rows.get("earth.rotation.sidereal")
    if (
        period is not None
        and session.scalar(
            select(ScientificData).where(ScientificData.key == DERIVED_ANGULAR_VELOCITY_KEY)
        )
        is None
    ):
        angular_velocity = 2.0 * pi / period.value_si
        session.add(
            ScientificData(
                key=DERIVED_ANGULAR_VELOCITY_KEY,
                label="Earth sidereal angular velocity",
                value_si=angular_velocity,
                si_unit="rad/s",
                original_value=angular_velocity,
                original_unit="rad/s",
                classification=DataClassification.DERIVED,
                method="omega = 2*pi / T_sidereal, with T_sidereal from earth.rotation.sidereal",
                notes="Computed at seed time from the published sidereal rotation period.",
                source_id=period.source_id,
            )
        )
        counts["derived"] += 1

    for record in catalog.components:
        if session.scalar(select(Component).where(Component.slug == record.slug)) is not None:
            continue
        session.add(
            Component(
                slug=record.slug,
                name=record.name,
                description=record.description,
                category=record.category,
                mass_kg=record.mass_kg,
                power_w=record.power_w,
                power_role=record.power_role,
                cost_usd=record.cost_usd,
                data_classification=record.data_classification,
                rationale=record.rationale,
                source_id=sources[record.source].id if record.source else None,
            )
        )
        counts["components"] += 1

    mission_record = catalog.mission
    if session.scalar(select(Mission).where(Mission.slug == mission_record.slug)) is None:
        session.add(
            Mission(
                slug=mission_record.slug,
                name=mission_record.name,
                summary=mission_record.summary,
                briefing=mission_record.briefing,
                difficulty=mission_record.difficulty,
                max_mass_kg=mission_record.max_mass_kg,
                max_cost_usd=mission_record.max_cost_usd,
                min_power_margin_w=mission_record.min_power_margin_w,
                required_categories=[
                    category.value for category in mission_record.required_categories
                ],
                budget_rationale=mission_record.budget_rationale,
            )
        )
        counts["missions"] += 1

    session.flush()

    if session.scalar(select(Spacecraft).limit(1)) is None:
        mission = session.scalar(
            select(Mission).where(Mission.slug == mission_record.slug)
        )
        if mission is None:
            raise RuntimeError("Mission seed row is missing after flush.")

        components = {
            component.slug: component
            for component in session.scalars(select(Component)).all()
        }
        missing = sorted(
            {
                slug
                for _, lines in DEMO_DESIGNS
                for slug, _ in lines
                if slug not in components
            }
        )
        if missing:
            raise RuntimeError(
                "Demo designs reference unknown component slugs: " + ", ".join(missing)
            )

        # Seed the demos only into an empty design table. The baseline is
        # inserted first so it keeps id 1, which the simulation page uses.
        # Its newer timestamp keeps it first in the designs list as well.
        seeded_at = utcnow()
        for index, (name, lines) in enumerate(DEMO_DESIGNS):
            timestamp = seeded_at - timedelta(seconds=index)
            spacecraft = Spacecraft(
                mission=mission,
                name=name,
                created_at=timestamp,
                updated_at=timestamp,
            )
            spacecraft.components = [
                SpacecraftComponent(component=components[slug], quantity=quantity)
                for slug, quantity in lines
            ]
            session.add(spacecraft)
            counts["designs"] += 1

    session.commit()
    return SeedSummary(**counts)
