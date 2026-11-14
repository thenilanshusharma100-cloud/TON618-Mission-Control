from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Override with TON618_* environment variables.

    Relative paths resolve against the process working directory, which is
    expected to be ``backend/`` during local development.
    """

    model_config = SettingsConfigDict(env_prefix="TON618_", env_file=".env", extra="ignore")

    app_name: str = "TON618 Mission Control"
    app_version: str = "0.1.0"
    database_url: str = "sqlite:///./var/ton618.db"
    catalog_dir: Path = Path("../data")


@lru_cache
def get_settings() -> Settings:
    return Settings()
