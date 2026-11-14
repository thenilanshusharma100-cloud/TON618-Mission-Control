from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.domain.enums import ComponentCategory, DataClassification, PowerRole


class DataSourceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    title: str
    publisher: str
    url: str
    retrieved_on: date
    kind: str


class MissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    summary: str
    briefing: str
    difficulty: str
    max_mass_kg: float
    max_cost_usd: int
    min_power_margin_w: float
    required_categories: list[ComponentCategory]
    budget_rationale: str


class ComponentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    description: str
    category: ComponentCategory
    mass_kg: float
    power_w: float
    power_role: PowerRole
    cost_usd: int
    cost_currency: Literal["USD"] = "USD"
    data_classification: DataClassification
    rationale: str
    source: DataSourceRead | None = None
