from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.catalog import Component, Mission
from app.models.science import utcnow


class Spacecraft(Base):
    __tablename__ = "spacecraft"

    id: Mapped[int] = mapped_column(primary_key=True)
    mission_id: Mapped[int] = mapped_column(ForeignKey("missions.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    mission: Mapped[Mission] = relationship(back_populates="spacecrafts")
    components: Mapped[list["SpacecraftComponent"]] = relationship(
        back_populates="spacecraft", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"Spacecraft(id={self.id!r}, name={self.name!r})"


class SpacecraftComponent(Base):
    __tablename__ = "spacecraft_components"
    __table_args__ = (
        UniqueConstraint("spacecraft_id", "component_id", name="uq_spacecraft_component"),
        CheckConstraint("quantity >= 1", name="ck_spacecraft_component_quantity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    spacecraft_id: Mapped[int] = mapped_column(
        ForeignKey("spacecraft.id", ondelete="CASCADE"), index=True
    )
    component_id: Mapped[int] = mapped_column(ForeignKey("components.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)

    spacecraft: Mapped[Spacecraft] = relationship(back_populates="components")
    component: Mapped[Component] = relationship(lazy="joined")

    def __repr__(self) -> str:
        return (
            f"SpacecraftComponent(spacecraft_id={self.spacecraft_id!r}, "
            f"component_id={self.component_id!r}, quantity={self.quantity!r})"
        )
