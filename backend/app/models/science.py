from datetime import UTC, date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SAEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.domain.enums import DataClassification, SourceKind


def utcnow() -> datetime:
    return datetime.now(UTC)


def _enum(enum_cls: type, name: str) -> SAEnum:
    return SAEnum(
        enum_cls,
        native_enum=False,
        values_callable=lambda members: [member.value for member in members],
        name=name,
    )


class DataSource(Base):
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(300))
    publisher: Mapped[str] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(String(500))
    retrieved_on: Mapped[date] = mapped_column(Date)
    kind: Mapped[SourceKind] = mapped_column(_enum(SourceKind, "source_kind"))

    def __repr__(self) -> str:
        return f"DataSource(key={self.key!r})"


class ScientificData(Base):
    __tablename__ = "scientific_data"
    __table_args__ = (
        CheckConstraint(
            "classification != 'published_reference' OR source_id IS NOT NULL",
            name="ck_scientific_published_requires_source",
        ),
        CheckConstraint(
            "classification != 'estimated' OR source_id IS NULL",
            name="ck_scientific_estimated_has_no_source",
        ),
        CheckConstraint(
            "classification = 'published_reference' OR method IS NOT NULL",
            name="ck_scientific_derived_requires_method",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(300))
    value_si: Mapped[float] = mapped_column(Float)
    si_unit: Mapped[str] = mapped_column(String(40))
    original_value: Mapped[float] = mapped_column(Float)
    original_unit: Mapped[str] = mapped_column(String(40))
    classification: Mapped[DataClassification] = mapped_column(
        _enum(DataClassification, "data_classification"), index=True
    )
    method: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_id: Mapped[int | None] = mapped_column(
        ForeignKey("data_sources.id"), nullable=True, index=True
    )
    source: Mapped[DataSource | None] = relationship(lazy="joined")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    def __repr__(self) -> str:
        return f"ScientificData(key={self.key!r}, value_si={self.value_si!r})"
