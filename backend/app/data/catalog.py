from datetime import date
from functools import cached_property
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.config import get_settings
from app.domain.enums import (
    ComponentCategory,
    DataClassification,
    PowerRole,
    SourceKind,
)

QuantityKind = Literal[
    "gravitational_parameter",
    "length",
    "time",
    "irradiance",
    "dimensionless",
    "angular_velocity",
]

SI_UNITS: dict[str, str] = {
    "gravitational_parameter": "m^3/s^2",
    "length": "m",
    "time": "s",
    "irradiance": "W/m^2",
    "dimensionless": "dimensionless",
    "angular_velocity": "rad/s",
}


class SourceRecord(BaseModel):
    key: str = Field(min_length=2)
    title: str = Field(min_length=2)
    publisher: str = Field(min_length=2)
    url: str
    retrieved_on: date
    kind: SourceKind

    @field_validator("url")
    @classmethod
    def url_must_be_absolute(cls, value: str) -> str:
        if not value.startswith(("https://", "http://")):
            raise ValueError("source URL must be absolute")
        return value

    @cached_property
    def is_nasa(self) -> bool:
        return self.kind in (SourceKind.NASA, SourceKind.JPL)


class ConstantRecord(BaseModel):
    key: str = Field(min_length=2)
    label: str = Field(min_length=2)
    quantity_kind: QuantityKind
    original_value: float
    original_unit: str = Field(min_length=1)
    classification: DataClassification
    source: str | None = None
    method: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def provenance_is_complete(self) -> "ConstantRecord":
        if self.classification is DataClassification.PUBLISHED_REFERENCE and not self.source:
            raise ValueError(f"{self.key}: published_reference requires a source")
        if self.classification is DataClassification.ESTIMATED and self.source:
            raise ValueError(f"{self.key}: estimated data must not cite a source")
        if self.classification is not DataClassification.PUBLISHED_REFERENCE and not self.method:
            raise ValueError(f"{self.key}: derived/estimated data requires a method note")
        return self


class ComponentRecord(BaseModel):
    slug: str = Field(min_length=2)
    name: str = Field(min_length=2)
    description: str = Field(min_length=5)
    category: ComponentCategory
    mass_kg: float = Field(ge=0)
    power_w: float = Field(ge=0)
    power_role: PowerRole
    cost_usd: int = Field(ge=0)
    data_classification: Literal[
        DataClassification.PUBLISHED_REFERENCE, DataClassification.ESTIMATED
    ]
    rationale: str = Field(min_length=10)
    source: str | None = None

    @model_validator(mode="after")
    def provenance_is_complete(self) -> "ComponentRecord":
        if self.data_classification is DataClassification.PUBLISHED_REFERENCE and not self.source:
            raise ValueError(f"{self.slug}: published_reference requires a source")
        if self.data_classification is DataClassification.ESTIMATED and self.source:
            raise ValueError(f"{self.slug}: estimated component must not cite a source")
        return self


class MissionRecord(BaseModel):
    slug: str = Field(min_length=2)
    name: str = Field(min_length=2)
    summary: str = Field(min_length=10)
    briefing: str = Field(min_length=10)
    difficulty: str = Field(min_length=2)
    max_mass_kg: float = Field(gt=0)
    max_cost_usd: int = Field(ge=0)
    min_power_margin_w: float = Field(ge=0)
    required_categories: list[ComponentCategory] = Field(min_length=1)
    budget_rationale: str = Field(min_length=10)

    @field_validator("required_categories")
    @classmethod
    def categories_are_unique(
        cls, value: list[ComponentCategory]
    ) -> list[ComponentCategory]:
        if len(set(value)) != len(value):
            raise ValueError("required_categories must be unique")
        return value


class Catalog(BaseModel):
    sources: list[SourceRecord]
    constants: list[ConstantRecord]
    components: list[ComponentRecord]
    mission: MissionRecord

    @model_validator(mode="after")
    def references_exist(self) -> "Catalog":
        source_keys = {source.key for source in self.sources}
        duplicates = _duplicates([source.key for source in self.sources])
        if duplicates:
            raise ValueError(f"duplicate source keys: {duplicates}")

        for constant in self.constants:
            if constant.source and constant.source not in source_keys:
                raise ValueError(f"{constant.key}: unknown source '{constant.source}'")
        for component in self.components:
            if component.source and component.source not in source_keys:
                raise ValueError(f"{component.slug}: unknown source '{component.source}'")

        duplicate_components = _duplicates([component.slug for component in self.components])
        if duplicate_components:
            raise ValueError(f"duplicate component slugs: {duplicate_components}")
        return self


def _duplicates(values: list[str]) -> list[str]:
    seen: set[str] = set()
    duplicate: set[str] = set()
    for value in values:
        if value in seen:
            duplicate.add(value)
        seen.add(value)
    return sorted(duplicate)


def _read_json(path: Path) -> object:
    import json

    if not path.is_file():
        raise FileNotFoundError(f"catalog file missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def load_catalog() -> Catalog:
    base = get_settings().catalog_dir
    return Catalog(
        sources=[SourceRecord(**row) for row in _read_json(base / "reference/sources.json")],
        constants=[
            ConstantRecord(**row) for row in _read_json(base / "reference/earth_constants.json")
        ],
        components=[
            ComponentRecord(**row) for row in _read_json(base / "catalog/components.json")
        ],
        mission=MissionRecord(**{**_read_json(base / "missions/earthwatch-01.json")}),
    )
