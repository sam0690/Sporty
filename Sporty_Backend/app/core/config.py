from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str

    # ── Redis ─────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Celery (Redis broker/result backend) ───────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── JWT ───────────────────────────────────────────────────
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 90
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Google OAuth ──────────────────────────────────────────
    GOOGLE_CLIENT_ID: str

    # ── External APIs ─────────────────────────────────────────
    RAPIDAPI_FOOTBALL_KEY: str = ""
    RAPIDAPI_NBA_KEY: str = ""
    CRICKET_API_KEY: str = ""

    RAPIDAPI_FOOTBALL_HOST: str = "api-football-v1.p.rapidapi.com"
    RAPIDAPI_NBA_HOST: str = "api-nba-v1.p.rapidapi.com"
    RAPIDAPI_CRICKET_HOST: str = "cricbuzz-cricket.p.rapidapi.com"

    # BallDontLie (Basketball - Free API)
    BALLDONTLIE_API_KEY: str = ""

    # ── Email / notifications ───────────────────────────────────
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = ""

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


# Single instance used everywhere
settings = Settings()
