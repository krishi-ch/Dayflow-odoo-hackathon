from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    APP_NAME: str = "Dayflow HRMS"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = "postgresql+psycopg2://dayflow:dayflow@localhost:5432/dayflow_hrms"
    DATABASE_URL_ASYNC: str = "postgresql+asyncpg://dayflow:dayflow@localhost:5432/dayflow_hrms"

    SECRET_KEY: str = "dayflow-super-secret-key-change-in-production-please-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    EMAIL_SMTP_HOST: str = "smtp.gmail.com"
    EMAIL_SMTP_PORT: int = 587
    EMAIL_SMTP_USER: str = ""
    EMAIL_SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@dayflow.tech"

    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    MAX_UPLOAD_SIZE_MB: int = 10
    PROFILE_PICTURES_DIR: str = "uploads/profile_pictures"
    DOCUMENTS_DIR: str = "uploads/documents"
    PAYSLIPS_DIR: str = "uploads/payslips"

    WORK_START_HOUR: int = 9
    WORK_START_MINUTE: int = 0
    WORK_END_HOUR: int = 18
    WORK_END_MINUTE: int = 0
    LATE_THRESHOLD_MINUTES: int = 15
    HALF_DAY_THRESHOLD_HOURS: float = 4.0
    FULL_DAY_HOURS: float = 8.0

    OPENAI_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gpt-4o-mini"


settings = Settings()
