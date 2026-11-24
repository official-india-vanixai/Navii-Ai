"""
Core configuration settings module for N.A.V.I.I Backend.
Loads environment variables safely using Pydantic Settings.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "N.A.V.I.I Backend"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # Server Binding
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # CORS (Client access restriction)
    CORS_ORIGINS: List[str] = ["*"]

    # OpenRouter Multi-Model Integration (Five Free Models)
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_DEFAULT_MODEL: str = "google/gemma-4-26b-a4b-it:free"

    # Model specific keys pool
    OPENROUTER_KEY_NEMOTRON_ULTRA: str = ""
    OPENROUTER_KEY_ERNIE: str = ""
    OPENROUTER_KEY_NEMOTRON_VL: str = ""
    OPENROUTER_KEY_PARTICLE: str = ""
    OPENROUTER_KEY_GEMMA: str = ""

    # Legacy OpenAI / Supabase (Optional fallback)
    OPENAI_API_KEY: str = ""
    OPENAI_DEFAULT_MODEL: str = "gpt-4o"
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""

    # Web Search Provider Secrets
    SEARCH_API_KEY: str = ""
    SEARCH_PROVIDER: str = "tavily"

    # Google OAuth & Firebase Cloud
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    FIREBASE_PROJECT_ID: str = "naviixai-uk14"
    FIREBASE_API_KEY: str = ""
    FIREBASE_AUTH_DOMAIN: str = ""
    FIREBASE_APP_ID: str = ""
    FIREBASE_MESSAGING_SENDER_ID: str = ""
    FIREBASE_STORAGE_BUCKET: str = ""

    # Rate Limiting & AI Usage Guardrails
    MAX_PROMPT_TOKENS: int = 8192
    MAX_DAILY_REQUESTS_PER_USER: int = 200

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
