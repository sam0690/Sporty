"""merge lifecycle heads

Revision ID: e3f4a5b6c7d8
Revises: 1d4c6b7e9f01, d9e1f0a2b3c4
Create Date: 2026-05-27 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "e3f4a5b6c7d8"
down_revision: Union[str, Sequence[str], None] = (
    "1d4c6b7e9f01",
    "d9e1f0a2b3c4",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass