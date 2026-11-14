import pytest

from app.domain.enums import ComponentCategory, PowerRole
from app.models import Component, Mission
from app.services.design import DesignLine, calculate_design, find_violations


def make_component(
    *,
    category: ComponentCategory,
    mass_kg: float,
    power_w: float,
    role: PowerRole,
    cost_usd: int,
) -> Component:
    return Component(
        category=category,
        mass_kg=mass_kg,
        power_w=power_w,
        power_role=role,
        cost_usd=cost_usd,
    )


def make_mission(
    *,
    max_mass_kg: float = 10.0,
    max_cost_usd: int = 100000,
    min_power_margin_w: float = 5.0,
    required_categories: list[str] | None = None,
) -> Mission:
    return Mission(
        slug="test-mission",
        name="Test Mission",
        max_mass_kg=max_mass_kg,
        max_cost_usd=max_cost_usd,
        min_power_margin_w=min_power_margin_w,
        required_categories=required_categories or [],
    )


def test_totals_include_quantities_and_power_roles() -> None:
    mission = make_mission()
    lines = [
        DesignLine(
            component=make_component(
                category=ComponentCategory.STRUCTURE,
                mass_kg=2.0,
                power_w=0.0,
                role=PowerRole.CONSUMER,
                cost_usd=1000,
            ),
            quantity=2,
        ),
        DesignLine(
            component=make_component(
                category=ComponentCategory.POWER,
                mass_kg=1.5,
                power_w=30.0,
                role=PowerRole.GENERATOR,
                cost_usd=5000,
            ),
            quantity=1,
        ),
        DesignLine(
            component=make_component(
                category=ComponentCategory.PAYLOAD,
                mass_kg=0.5,
                power_w=8.0,
                role=PowerRole.CONSUMER,
                cost_usd=2000,
            ),
            quantity=3,
        ),
    ]

    calculation = calculate_design(mission, lines)

    assert calculation.totals.mass_kg == pytest.approx(7.0)
    assert calculation.totals.power_generation_w == pytest.approx(30.0)
    assert calculation.totals.power_consumption_w == pytest.approx(24.0)
    assert calculation.totals.power_margin_w == pytest.approx(6.0)
    assert calculation.totals.cost_usd == 13000
    assert calculation.totals.component_count == 3
    assert calculation.totals.total_quantity == 6
    assert calculation.budgets.mass_remaining_kg == pytest.approx(3.0)
    assert calculation.budgets.cost_remaining_usd == 87000
    assert calculation.budgets.power_surplus_w == pytest.approx(1.0)


def test_category_breakdown_covers_all_categories() -> None:
    mission = make_mission()
    lines = [
        DesignLine(
            component=make_component(
                category=ComponentCategory.PAYLOAD,
                mass_kg=1.0,
                power_w=4.0,
                role=PowerRole.CONSUMER,
                cost_usd=100,
            ),
            quantity=1,
        )
    ]

    calculation = calculate_design(mission, lines)
    by_category = {row.category: row for row in calculation.categories}

    assert len(by_category) == len(ComponentCategory)
    assert by_category[ComponentCategory.PAYLOAD].quantity == 1
    assert by_category[ComponentCategory.PAYLOAD].mass_kg == pytest.approx(1.0)
    assert by_category[ComponentCategory.POWER].quantity == 0


def test_budget_violations_are_reported() -> None:
    mission = make_mission(
        max_mass_kg=5.0,
        max_cost_usd=1000,
        min_power_margin_w=5.0,
        required_categories=["structure", "payload"],
    )
    lines = [
        DesignLine(
            component=make_component(
                category=ComponentCategory.STRUCTURE,
                mass_kg=4.0,
                power_w=0.0,
                role=PowerRole.CONSUMER,
                cost_usd=800,
            ),
            quantity=1,
        ),
        DesignLine(
            component=make_component(
                category=ComponentCategory.PAYLOAD,
                mass_kg=2.0,
                power_w=6.0,
                role=PowerRole.CONSUMER,
                cost_usd=400,
            ),
            quantity=1,
        ),
    ]

    calculation = calculate_design(mission, lines)
    codes = {violation.code for violation in find_violations(mission, calculation)}

    assert codes == {"MASS_OVER_BUDGET", "COST_OVER_BUDGET", "POWER_MARGIN_LOW"}


def test_missing_categories_and_empty_design_are_reported() -> None:
    mission = make_mission(required_categories=["power", "payload"])
    calculation = calculate_design(mission, [])

    violations = find_violations(mission, calculation)
    codes = [violation.code for violation in violations]

    assert codes.count("MISSING_REQUIRED_CATEGORY") == 2
    assert "EMPTY_DESIGN" in codes
    assert all(violation.severity == "error" for violation in violations)


def test_valid_design_has_no_violations() -> None:
    mission = make_mission(required_categories=["power"])
    lines = [
        DesignLine(
            component=make_component(
                category=ComponentCategory.POWER,
                mass_kg=1.0,
                power_w=20.0,
                role=PowerRole.GENERATOR,
                cost_usd=1000,
            ),
            quantity=1,
        )
    ]

    calculation = calculate_design(mission, lines)

    assert find_violations(mission, calculation) == ()
