from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.domain.enums import ComponentCategory, DataClassification, PowerRole
from app.models.science import DataSource, utcnow

if TYPE_CHECKING:
    from app.models.design import Spacecraft


def _enum(enum_cls: type, name: str) -> SAEnum:
    return SAEnum(
        enum_cls,
        native_enum=False,
        values_callable=lambda members: [member.value for member in members],
        name=name,
    )


class Mission(Base):
    __tablename__ = "missions"
    __table_args__ = (
        CheckConstraint("max_mass_kg > 0", name="ck_mission_mass_budget_positive"),
        CheckConstraint("max_cost_usd >= 0", name="ck_mission_cost_budget_non_negative"),
        CheckConstraint(
            "min_power_margin_w >= 0", name="ck_mission_power_margin_non_negative"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text)
    briefing: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str] = mapped_column(String(40))
    max_mass_kg: Mapped[float] = mapped_column(Float)
    max_cost_usd: Mapped[int] = mapped_column(Integer)
    min_power_margin_w: Mapped[float] = mapped_column(Float)
    required_categories: Mapped[list[str]] = mapped_column(JSON, default=list)
    budget_rationale: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    spacecrafts: Mapped[list["Spacecraft"]] = relationship(
        back_populates="mission", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"Mission(slug={self.slug!r})"


class Component(Base):
    __tablename__ = "components"
    __table_args__ = (
        CheckConstraint("mass_kg >= 0", name="ck_component_mass_non_negative"),
        CheckConstraint("power_w >= 0", name="ck_component_power_non_negative"),
        CheckConstraint("cost_usd >= 0", name="ck_component_cost_non_negative"),
        CheckConstraint(
            "data_classification != 'published_reference' OR source_id IS NOT NULL",
            name="ck_component_published_requires_source",
        ),
        CheckConstraint(
            "data_classification != 'estimated' OR source_id IS NULL",
            name="ck_component_estimated_has_no_source",
        ),
        CheckConstraint(
            "data_classification != 'estimated' OR rationale IS NOT NULL",
            name="ck_component_estimated_requires_rationale",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[ComponentCategory] = mapped_column(
        _enum(ComponentCategory, "component_category"), index=True
    )
    mass_kg: Mapped[float] = mapped_column(Float)
    power_w: Mapped[float] = mapped_column(Float)
    power_role: Mapped[PowerRole] = mapped_column(_enum(PowerRole, "power_role"))
    cost_usd: Mapped[int] = mapped_column(Integer)
    data_classification: Mapped[DataClassification] = mapped_column(
        _enum(DataClassification, "component_data_classification"), index=True
    )
    rationale: Mapped[str] = mapped_column(Text)
    source_id: Mapped[int | None] = mapped_column(
        ForeignKey("data_sources.id"), nullable=True, index=True
    )
    source: Mapped[DataSource | None] = relationship(lazy="joined")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    def __repr__(self) -> str:
        return f"Component(slug={self.slug!r}, category={self.category.value!r})"
