from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.deps import DbSession
from app.domain.enums import ComponentCategory
from app.models import Component
from app.schemas.catalog import ComponentRead

router = APIRouter(prefix="/components", tags=["components"])


@router.get("", response_model=list[ComponentRead])
def list_components(
    db: DbSession,
    category: Annotated[ComponentCategory | None, Query()] = None,
) -> list[ComponentRead]:
    statement = select(Component).order_by(Component.category, Component.name)
    if category is not None:
        statement = statement.where(Component.category == category)
    components = db.scalars(statement).all()
    return [ComponentRead.model_validate(component) for component in components]


@router.get("/{component_id}", response_model=ComponentRead)
def get_component(component_id: int, db: DbSession) -> ComponentRead:
    component = db.get(Component, component_id)
    if component is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "COMPONENT_NOT_FOUND",
                "message": f"Component {component_id} does not exist.",
            },
        )
    return ComponentRead.model_validate(component)
