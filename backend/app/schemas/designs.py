from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.design import DesignItem, DesignValidationResponse


def _clean_name(value: str) -> str:
    cleaned = value.strip()
    if len(cleaned) < 2:
        raise ValueError("design name must be at least 2 characters")
    return cleaned


class DesignCreateRequest(BaseModel):
    mission_slug: str = Field(min_length=2)
    name: str = Field(min_length=2, max_length=200)
    items: list[DesignItem] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def name_is_present(cls, value: str) -> str:
        return _clean_name(value)


class DesignUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    items: list[DesignItem] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def name_is_present(cls, value: str) -> str:
        return _clean_name(value)


class DesignItemRead(BaseModel):
    component_id: int
    quantity: int


class DesignDetailRead(DesignValidationResponse):
    id: int
    mission_id: int
    name: str
    items: list[DesignItemRead]
    created_at: datetime
    updated_at: datetime
