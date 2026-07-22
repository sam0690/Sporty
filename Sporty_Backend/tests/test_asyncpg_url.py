"""Guard the DATABASE_URL → asyncpg rewrite against libpq-only params."""

from app.core.database import _to_asyncpg_url


def test_strips_libpq_only_params_and_keeps_tls():
    url, connect_args = _to_asyncpg_url(
        "postgresql+asyncpg://u:p@ep-x-pooler.us-east-1.aws.neon.tech/neondb"
        "?sslmode=require&channel_binding=require"
    )
    assert "sslmode" not in url and "channel_binding" not in url
    assert connect_args == {"ssl": True}


def test_sslmode_disable_means_no_tls():
    url, connect_args = _to_asyncpg_url("postgresql+asyncpg://u:p@localhost/db?sslmode=disable")
    assert connect_args == {}
    assert "sslmode" not in url


def test_unrelated_params_survive():
    url, _ = _to_asyncpg_url("postgresql+asyncpg://u:p@h/db?application_name=sporty")
    assert "application_name=sporty" in url
