from collections.abc import Sequence
from dataclasses import dataclass

from app.domain.enums import ComponentCategory, PowerRole
from app.models import Component, Mission


@dataclass(frozen=True)
class DesignLine:
    component: Component
    quantity: int


@dataclass(frozen=True)
class CategoryTotals:
    category: ComponentCategory
    quantity: int
    mass_kg: float
    power_consumption_w: float
    power_generation_w: float
    cost_usd: int


@dataclass(frozen=True)
class DesignTotals:
    mass_kg: float
    power_consumption_w: float
    power_generation_w: float
    power_margin_w: float
    cost_usd: int
    component_count: int
    total_quantity: int


@dataclass(frozen=True)
class DesignBudgets:
    mass_remaining_kg: float
    mass_limit_kg: float
    mass_used_pct: float
    cost_remaining_usd: int
    cost_limit_usd: int
    cost_used_pct: float
    min_power_margin_w: float
    power_surplus_w: float


@dataclass(frozen=True)
class DesignCalculation:
    mission_slug: str
    mission_name: str
    totals: DesignTotals
    budgets: DesignBudgets
    categories: tuple[CategoryTotals, ...]


@dataclass(frozen=True)
class Violation:
    code: str
    severity: str
    message: str


def _percent(used: float, limit: float) -> float:
    if limit <= 0:
        return 0.0
    return round(used / limit * 100.0, 1)


def calculate_design(mission: Mission, lines: Sequence[DesignLine]) -> DesignCalculation:
    buckets: dict[ComponentCategory, dict[str, float]] = {
        category: {
            "quantity": 0,
            "mass_kg": 0.0,
            "power_consumption_w": 0.0,
            "power_generation_w": 0.0,
            "cost_usd": 0,
        }
        for category in ComponentCategory
    }

    total_mass = 0.0
    total_consumption = 0.0
    total_generation = 0.0
    total_cost = 0
    total_quantity = 0

    for line in lines:
        if line.quantity < 1:
            raise ValueError("component quantity must be at least 1")
        component = line.component
        bucket = buckets[component.category]

        bucket["quantity"] += line.quantity
        bucket["mass_kg"] += component.mass_kg * line.quantity
        bucket["cost_usd"] += component.cost_usd * line.quantity

        if component.power_role is PowerRole.GENERATOR:
            total_generation += component.power_w * line.quantity
            bucket["power_generation_w"] += component.power_w * line.quantity
        else:
            total_consumption += component.power_w * line.quantity
            bucket["power_consumption_w"] += component.power_w * line.quantity

        total_mass += component.mass_kg * line.quantity
        total_cost += component.cost_usd * line.quantity
        total_quantity += line.quantity

    categories = tuple(
        CategoryTotals(
            category=category,
            quantity=int(bucket["quantity"]),
            mass_kg=round(bucket["mass_kg"], 3),
            power_consumption_w=round(bucket["power_consumption_w"], 3),
            power_generation_w=round(bucket["power_generation_w"], 3),
            cost_usd=int(bucket["cost_usd"]),
        )
        for category, bucket in buckets.items()
    )

    totals = DesignTotals(
        mass_kg=round(total_mass, 3),
        power_consumption_w=round(total_consumption, 3),
        power_generation_w=round(total_generation, 3),
        power_margin_w=round(total_generation - total_consumption, 3),
        cost_usd=total_cost,
        component_count=len(lines),
        total_quantity=total_quantity,
    )

    budgets = DesignBudgets(
        mass_remaining_kg=round(mission.max_mass_kg - totals.mass_kg, 3),
        mass_limit_kg=mission.max_mass_kg,
        mass_used_pct=_percent(totals.mass_kg, mission.max_mass_kg),
        cost_remaining_usd=mission.max_cost_usd - totals.cost_usd,
        cost_limit_usd=mission.max_cost_usd,
        cost_used_pct=_percent(totals.cost_usd, mission.max_cost_usd),
        min_power_margin_w=mission.min_power_margin_w,
        power_surplus_w=round(totals.power_margin_w - mission.min_power_margin_w, 3),
    )

    return DesignCalculation(
        mission_slug=mission.slug,
        mission_name=mission.name,
        totals=totals,
        budgets=budgets,
        categories=categories,
    )


def find_violations(mission: Mission, calculation: DesignCalculation) -> tuple[Violation, ...]:
    totals = calculation.totals
    violations: list[Violation] = []

    if totals.total_quantity == 0:
        violations.append(
            Violation(
                code="EMPTY_DESIGN",
                severity="error",
                message="No components selected.",
            )
        )

    if totals.mass_kg > mission.max_mass_kg:
        violations.append(
            Violation(
                code="MASS_OVER_BUDGET",
                severity="error",
                message=(
                    f"Total mass {totals.mass_kg:.2f} kg exceeds the "
                    f"{mission.max_mass_kg:.2f} kg budget."
                ),
            )
        )

    if totals.power_margin_w < mission.min_power_margin_w:
        violations.append(
            Violation(
                code="POWER_MARGIN_LOW",
                severity="error",
                message=(
                    f"Power margin {totals.power_margin_w:.2f} W is below the required "
                    f"{mission.min_power_margin_w:.2f} W."
                ),
            )
        )

    if totals.cost_usd > mission.max_cost_usd:
        violations.append(
            Violation(
                code="COST_OVER_BUDGET",
                severity="error",
                message=(
                    f"Total cost ${totals.cost_usd:,} exceeds the "
                    f"${mission.max_cost_usd:,} budget."
                ),
            )
        )

    present = {
        category.category.value
        for category in calculation.categories
        if category.quantity > 0
    }
    for required in mission.required_categories:
        if required not in present:
            violations.append(
                Violation(
                    code="MISSING_REQUIRED_CATEGORY",
                    severity="error",
                    message=f"Required category '{required}' has no components.",
                )
            )

    return tuple(violations)
