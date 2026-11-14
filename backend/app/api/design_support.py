from collections.abc import Sequence
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Component, Mission
from app.schemas.design import (
    CategoryBreakdownRead,
    DesignBudgetsRead,
    DesignCalculationResponse,
    DesignItem,
    DesignTotalsRead,
    ViolationRead,
)
from app.services.design import DesignCalculation, DesignLine, Violation


def get_mission_or_404(db: Session, mission_slug: str) -> Mission:
    mission = db.scalar(select(Mission).where(Mission.slug == mission_slug))
    if mission is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "MISSION_NOT_FOUND",
                "message": f"Mission '{mission_slug}' does not exist.",
            },
        )
    return mission


def resolve_lines(db: Session, items: Sequence[DesignItem]) -> list[DesignLine]:
    """Merge duplicate component ids and load catalog rows.

    Quantities are summed so a design can never contain two rows for the same
    component, matching the database's unique constraint.
    """
    quantities: dict[int, int] = {}
    for item in items:
        quantities[item.component_id] = quantities.get(item.component_id, 0) + item.quantity

    if not quantities:
        return []

    components = db.scalars(
        select(Component).where(Component.id.in_(quantities.keys()))
    ).all()
    by_id = {component.id: component for component in components}
    missing = sorted(set(quantities) - set(by_id))
    if missing:
        raise HTTPException(
            status_code=422,
            detail={
                "code": "UNKNOWN_COMPONENT_IDS",
                "message": "One or more component ids do not exist.",
                "component_ids": missing,
            },
        )

    return [
        DesignLine(component=by_id[component_id], quantity=quantity)
        for component_id, quantity in sorted(quantities.items())
    ]


def resolve_design(
    db: Session, mission_slug: str, items: Sequence[DesignItem]
) -> tuple[Mission, list[DesignLine]]:
    mission = get_mission_or_404(db, mission_slug)
    return mission, resolve_lines(db, items)


def calculation_response(calculation: DesignCalculation) -> DesignCalculationResponse:
    return DesignCalculationResponse(
        mission_slug=calculation.mission_slug,
        mission_name=calculation.mission_name,
        totals=DesignTotalsRead(
            mass_kg=calculation.totals.mass_kg,
            power_consumption_w=calculation.totals.power_consumption_w,
            power_generation_w=calculation.totals.power_generation_w,
            power_margin_w=calculation.totals.power_margin_w,
            cost_usd=calculation.totals.cost_usd,
            component_count=calculation.totals.component_count,
            total_quantity=calculation.totals.total_quantity,
        ),
        budgets=DesignBudgetsRead(
            mass_remaining_kg=calculation.budgets.mass_remaining_kg,
            mass_limit_kg=calculation.budgets.mass_limit_kg,
            mass_used_pct=calculation.budgets.mass_used_pct,
            cost_remaining_usd=calculation.budgets.cost_remaining_usd,
            cost_limit_usd=calculation.budgets.cost_limit_usd,
            cost_used_pct=calculation.budgets.cost_used_pct,
            min_power_margin_w=calculation.budgets.min_power_margin_w,
            power_surplus_w=calculation.budgets.power_surplus_w,
        ),
        categories=[
            CategoryBreakdownRead(
                category=category.category,
                quantity=category.quantity,
                mass_kg=category.mass_kg,
                power_consumption_w=category.power_consumption_w,
                power_generation_w=category.power_generation_w,
                cost_usd=category.cost_usd,
            )
            for category in calculation.categories
        ],
    )


def violation_reads(violations: Sequence[Violation]) -> list[ViolationRead]:
    return [
        ViolationRead(code=violation.code, severity=violation.severity, message=violation.message)
        for violation in violations
    ]


def as_utc(value: datetime) -> datetime:
    """SQLite drops timezone info; timestamps are stored as UTC."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


__all__ = [
    "as_utc",
    "calculation_response",
    "get_mission_or_404",
    "resolve_design",
    "resolve_lines",
    "violation_reads",
]
