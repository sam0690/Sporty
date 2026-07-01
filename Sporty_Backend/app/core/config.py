from pydantic_settings import BaseSettings
from typing import Optional
from urllib.parse import urlparse


class Settings(BaseSettings):
    # ── Environment ───────────────────────────────────────────
    ENVIRONMENT: str = "development"  # "development", "staging", "production"

    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str

    # ── Redis ─────────────────────────────────────────────────
    REDIS_URL: str 

    # ── Celery (Redis broker/result backend) ───────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # ── CORS Configuration ─────────────────────────────────────
    # Comma-separated list of allowed origins per environment
    # Add your deployed frontend domain here (comma-separated if multiple)
    CORS_PRODUCTION_ORIGINS: str = "https://sporty-woad.vercel.app"
    CORS_STAGING_ORIGINS: str = ""
    CORS_LOCAL_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"

    # ── Cookie Security Configuration ──────────────────────────
    # secure=True in production (HTTPS), False in development (HTTP)
    COOKIE_SECURE: bool = False  # Override to True in production
    # SameSite policy:
    #   - "none" + Secure=True: Required for cross-origin SPA cookie auth (production)
    #   - "lax" + Secure=False: Development only; requires Next.js rewrites for POST cookie auth
    COOKIE_SAME_SITE: str = "lax"  # "lax", "strict", or "none"
    COOKIE_DOMAIN: str = ""  # Empty = current domain; set to ".sporty.com" for subdomains

    # ── Rate Limiting ──────────────────────────────────────────
    RATE_LIMIT_ENABLED: bool = True
    # Global rate limit (requests per minute per IP)
    RATE_LIMIT_GLOBAL_RPM: int = 120
    # Auth-specific rate limits (stricter)
    RATE_LIMIT_LOGIN_RPM: int = 10
    RATE_LIMIT_REGISTER_RPM: int = 5
    RATE_LIMIT_REFRESH_RPM: int = 20
    RATE_LIMIT_FORGOT_PASSWORD_RPM: int = 3
    RATE_LIMIT_RESET_PASSWORD_RPM: int = 5
    # Window size in seconds for rate limit tracking
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # ── CSRF Protection ────────────────────────────────────────
    CSRF_ENABLED: bool = True
    CSRF_COOKIE_NAME: str = "csrf_token"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"
    # Paths exempt from CSRF (safe endpoints, health checks, etc.)
    # /api/v1/feed is server-to-server (Sporty Data Feeder) authenticated by
    # X-Feeder-Secret — no browser session exists, so CSRF does not apply.
    CSRF_EXEMPT_PATHS: str = "/health,/metrics,/docs,/redoc,/openapi.json,/api/v1/feed"

    # ── Sporty Data Feeder ──────────────────────────────────────
    # Shared secret for inbound /api/v1/feed/* pushes — must match the
    # FEEDER_SECRET in the feeder's .env. Empty disables the feed endpoints (503).
    FEEDER_SECRET: str = ""

    # ── Realtime Event Pipeline ────────────────────────────────
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:9092"
    KAFKA_CLIENT_ID: str = "sporty-backend"
    KAFKA_SECURITY_PROTOCOL: str = "PLAINTEXT"

    MATCH_EVENTS_TOPIC: str = "match.events"
    PLAYER_STATS_TOPIC: str = "player.stats"
    SCORE_UPDATES_TOPIC: str = "score.updates"
    LINEUP_CHANGES_TOPIC: str = "lineup.changes"
    FANTASY_POINTS_TOPIC: str = "fantasy.points"
    NOTIFICATIONS_TOPIC: str = "notifications"

    INFLUXDB_URL: str = "http://localhost:8086"
    INFLUXDB_TOKEN: str = ""
    INFLUXDB_ORG: str = "sporty"
    INFLUXDB_BUCKET: str = "sporty_realtime"

    INGEST_POLL_INTERVAL_SECONDS: float = 2.0
    MATCH_SCHEDULER_REFRESH_SECONDS: float = 10.0
    REDIS_PUBSUB_PREFIX: str = "match"
    REALTIME_PIPELINE_ENABLED: bool = False

    # Real-API live-match polling (app/services/sync/football_live_sync.py,
    # nba_live_sync.py) — separate from REALTIME_PIPELINE_ENABLED (the Kafka
    # pipeline). Off by default: live match data currently comes from the
    # SportyDataFeeder simulator via /api/v1/feed/*. The polling code is fully
    # implemented and writes into the same Match/LiveEvent/Redis-pubsub model
    # the feeder uses, so flipping this on is the only step needed later —
    # but RapidAPI free-tier quotas (100 req/day) will not sustain a 1-minute
    # poll interval against real fixtures without a paid plan.
    LIVE_POLLING_ENABLED: bool = False

    FOOTBALL_LIVE_LEAGUE_ID: int = 39
    BASKETBALL_LIVE_LEAGUE_ID: int = 12

    # ── Push Notifications ─────────────────────────────────────
    FIREBASE_CREDENTIALS_PATH: str = ""
    APNS_USE_SANDBOX: bool = True
    APNS_KEY_PATH: str = ""
    APNS_KEY_ID: str = ""
    APNS_TEAM_ID: str = ""
    APNS_BUNDLE_ID: str = ""

    # ── JWT ───────────────────────────────────────────────────
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 90
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Google OAuth ──────────────────────────────────────────
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "https://sporty-woad.vercel.app/auth/google/callback"

    # ── External APIs ─────────────────────────────────────────
    RAPIDAPI_FOOTBALL_KEY: str = ""
    RAPIDAPI_NBA_KEY: str = ""
    CRICKET_API_KEY: str = ""

    # Fixed hosts - these are the actual working endpoints
    RAPIDAPI_FOOTBALL_HOST: str = "v3.football.api-sports.io"
    RAPIDAPI_NBA_HOST: str = "api-basketball-nba.p.rapidapi.com"
    RAPIDAPI_CRICKET_HOST: str = "cricbuzz-cricket.p.rapidapi.com"

    # BallDontLie (Basketball - Free API)
    BALLDONTLIE_API_KEY: str = ""

    # ── Email / notifications ───────────────────────────────────
    RESEND_API_KEY: str = ""
    FROM_EMAIL: str = ""
    # Default frontend base; override via env in non-local environments
    FRONTEND_BASE_URL: str = "https://sporty-woad.vercel.app"

    # Forgot-password abuse protection (legacy - superseded by rate limiter)
    FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS: int = 300
    FORGOT_PASSWORD_RATE_LIMIT_MAX_REQUESTS: int = 5

    # League lifecycle safeguards
    LEAGUE_MIN_MEMBERS_TO_ACTIVATE: int = 2

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }

    def get_cors_origins(self) -> list[str]:
        """Get allowed CORS origins based on environment."""
        origins: list[str] = []

        if self.ENVIRONMENT == "production":
            if not self.CORS_PRODUCTION_ORIGINS:
                raise ValueError(
                    "CORS_PRODUCTION_ORIGINS must be set in production environment"
                )
            origins.extend(
                [o.strip() for o in self.CORS_PRODUCTION_ORIGINS.split(",") if o.strip()]
            )
        elif self.ENVIRONMENT == "staging":
            if self.CORS_STAGING_ORIGINS:
                origins.extend(
                    [o.strip() for o in self.CORS_STAGING_ORIGINS.split(",") if o.strip()]
                )
            else:
                origins.extend(
                    [o.strip() for o in self.CORS_LOCAL_ORIGINS.split(",") if o.strip()]
                )
        else:
            origins.extend([o.strip() for o in self.CORS_LOCAL_ORIGINS.split(",") if o.strip()])

        frontend_origin = self.get_frontend_origin()
        if frontend_origin and frontend_origin not in origins:
            origins.append(frontend_origin)

        return origins

    def get_frontend_origin(self) -> str:
        """Get the frontend origin used for cross-origin browser requests."""
        parsed = urlparse(self.FRONTEND_BASE_URL.strip())
        if not parsed.scheme or not parsed.netloc:
            return ""
        return f"{parsed.scheme}://{parsed.netloc}"

    def get_csrf_exempt_paths(self) -> list[str]:
        """Get list of paths exempt from CSRF protection."""
        return [p.strip() for p in self.CSRF_EXEMPT_PATHS.split(",") if p.strip()]

    def validate_production(self) -> None:
        """Validate required settings for production environment. Fails fast if missing."""
        errors = []

        if self.ENVIRONMENT == "production":
            if not self.CORS_PRODUCTION_ORIGINS:
                errors.append("CORS_PRODUCTION_ORIGINS is required in production")
            if not self.COOKIE_SECURE:
                errors.append("COOKIE_SECURE must be True in production (HTTPS required)")
            if self.COOKIE_SAME_SITE.lower() != "none":
                errors.append(
                    "COOKIE_SAME_SITE must be 'none' in production for cross-origin SPA cookie auth"
                )
            if self.JWT_SECRET_KEY == "your-secret-key-here-min-32-chars":
                errors.append("JWT_SECRET_KEY must be changed from default value")
            if not self.DATABASE_URL or "localhost" in self.DATABASE_URL:
                errors.append("DATABASE_URL should not point to localhost in production")

        # SameSite=None requires Secure=True (browsers reject None without Secure)
        if self.COOKIE_SAME_SITE.lower() == "none" and not self.COOKIE_SECURE:
            errors.append(
                "COOKIE_SAME_SITE='none' requires COOKIE_SECURE=True (browsers reject SameSite=None without Secure)"
            )

        # Validate JWT secret minimum length
        if len(self.JWT_SECRET_KEY) < 32:
            errors.append("JWT_SECRET_KEY must be at least 32 characters")

        if errors:
            raise ValueError(
                f"Configuration validation failed for {self.ENVIRONMENT} environment:\n"
                + "\n".join(f"  - {e}" for e in errors)
            )


# Single instance used everywhere
settings = Settings()
