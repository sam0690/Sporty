"""lowercase existing user emails

Revision ID: c9d2e8f4a107
Revises: b7e4d2a91c58
Create Date: 2026-07-13 00:00:00.000000

Why:
  register/google-auth stored emails as submitted, while login and
  forgot-password compare against a lowercased identifier — any account
  registered with uppercase in the email could never log in by email or
  reset its password. auth/services.py now normalises every write via
  _normalize_email(); this brings existing rows in line.

Guard:
  If two accounts differ only by email case, lowercasing both would violate
  the users.email unique constraint. That state is ambiguous (two people, or
  one person double-registered?) so the migration aborts and lists the
  collisions for manual resolution instead of guessing.

Downgrade: original casing is not recorded; no-op.
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "c9d2e8f4a107"
down_revision = "b7e4d2a91c58"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    collisions = bind.execute(text("""
        SELECT lower(btrim(email)) AS folded, count(*) AS n,
               array_agg(email ORDER BY created_at) AS variants
        FROM users
        GROUP BY lower(btrim(email))
        HAVING count(*) > 1
    """)).all()
    if collisions:
        details = "; ".join(f"{row.folded}: {row.variants}" for row in collisions)
        raise RuntimeError(
            f"{len(collisions)} email case-collision group(s) — resolve manually "
            f"before lowercasing: {details}"
        )

    bind.execute(text("""
        UPDATE users SET email = lower(btrim(email))
        WHERE email <> lower(btrim(email))
    """))


def downgrade() -> None:
    # Original casing is not recorded.
    pass
