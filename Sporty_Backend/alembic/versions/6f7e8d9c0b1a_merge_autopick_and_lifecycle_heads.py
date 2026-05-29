"""merge autopick and lifecycle heads

Revision ID: 6f7e8d9c0b1a
Revises: 4b5c6d7e8f90, f1a2b3c4d5e6
Create Date: 2026-05-29 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "6f7e8d9c0b1a"
down_revision: Union[str, Sequence[str], None] = (
    "4b5c6d7e8f90",
    "f1a2b3c4d5e6",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
