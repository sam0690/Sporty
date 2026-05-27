"""merge player and lifecycle heads

Revision ID: f1a2b3c4d5e6
Revises: c1f2e3d4b5a6, e3f4a5b6c7d8
Create Date: 2026-05-27 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = (
    "c1f2e3d4b5a6",
    "e3f4a5b6c7d8",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass