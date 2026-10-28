import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:Loka%408610@localhost:5432/crimesketch"

    # Security & JWT
    JWT_SECRET: str = "supersecret-crimesketch-jwt-token-key-32bytes-min"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Storage
    STORAGE_DIR: str = "./storage"
    MAX_UPLOAD_MB: int = 25

    # AI Providers
    LLM_PROVIDER: str = "none"
    LLM_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gpt-4o-mini"

    WHISPER_PROVIDER: str = "none"
    WHISPER_API_KEY: Optional[str] = None
    WHISPER_MODEL: str = "whisper-1"

    IMAGE_PROVIDER: str = "none"
    IMAGE_API_KEY: Optional[str] = None
    IMAGE_MODEL: str = "flux-schnell"

    # Dev fixtures
    DEV_FIXTURES: bool = True

    # Seed Admin Defaults
    ADMIN_EMAIL: str = "admin@crimesketch.com"
    ADMIN_PASSWORD: str = "AdminSecurePassword123!"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
