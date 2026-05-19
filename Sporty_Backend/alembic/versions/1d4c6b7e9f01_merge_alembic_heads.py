"""merge alembic heads

Revision ID: 1d4c6b7e9f01
Revises: 3a7f4f9e1c2d, f0c1a2b3d4e5, zz_twx_excl_20260501
Create Date: 2026-05-19 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "1d4c6b7e9f01"
down_revision: Union[str, Sequence[str], None] = (
    "3a7f4f9e1c2d",
    "f0c1a2b3d4e5",
    "zz_twx_excl_20260501",
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
