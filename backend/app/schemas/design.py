from typing import Literal

from pydantic import BaseModel, Field

from app.domain.enums import ComponentCategory


class DesignItem(BaseModel):
    component_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1, le=100)


class DesignRequest(BaseModel):
    mission_slug: str = Field(min_length=2)
    items: list[DesignItem] = Field(default_factory=list)


class DesignTotalsRead(BaseModel):
    mass_kg: float
    power_consumption_w: float
    power_generation_w: float
    power_margin_w: float
    cost_usd: int
    cost_currency: Literal["USD"] = "USD"
    component_count: int
    total_quantity: int


class DesignBudgetsRead(BaseModel):
    mass_remaining_kg: float
    mass_limit_kg: float
    mass_used_pct: float
    cost_remaining_usd: int
    cost_limit_usd: int
    cost_used_pct: float
    min_power_margin_w: float
    power_surplus_w: float


class CategoryBreakdownRead(BaseModel):
    category: ComponentCategory
    quantity: int
    mass_kg: float
    power_consumption_w: float
    power_generation_w: float
    cost_usd: int


class DesignCalculationResponse(BaseModel):
    mission_slug: str
    mission_name: str
    totals: DesignTotalsRead
    budgets: DesignBudgetsRead
    categories: list[CategoryBreakdownRead]


class ViolationRead(BaseModel):
    code: str
    severity: Literal["error", "warning"]
    message: str


class DesignValidationResponse(DesignCalculationResponse):
    valid: bool
    violations: list[ViolationRead]
