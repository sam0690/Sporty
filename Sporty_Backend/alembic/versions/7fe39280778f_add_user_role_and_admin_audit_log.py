"""add user role and admin audit log

Revision ID: 7fe39280778f
Revises: 9aa8a1dd3a3d
Create Date: 2026-07-05 14:48:25.951488

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PGEnum

# revision identifiers, used by Alembic.
revision: str = '7fe39280778f'
down_revision: Union[str, Sequence[str], None] = '9aa8a1dd3a3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Hand-written rather than left as raw autogenerate output: autogenerate also
# picked up pre-existing drift unrelated to this change (notifications,
# live_events, match_feed_cache tables and a couple of indexes not reflected
# in alembic/env.py's model imports) — stripped out here to keep this
# migration scoped to the user role + admin audit log addition only.
#
# create_type=False on both enum columns below: we create/drop the Postgres
# enum types explicitly (CREATE TYPE isn't a side effect of ALTER TABLE ADD
# COLUMN the way it is for CREATE TABLE), so letting the column definition
# also try to auto-create/drop the type would race with our explicit call.

userrole_enum = PGEnum('user', 'support', 'admin', 'super_admin', name='userrole_enum', create_type=False)
adminactiontype_enum = PGEnum(
    'user_suspend', 'user_reactivate', 'user_force_logout', 'user_role_change',
    'league_status_override', 'league_delete_override', 'league_settings_override',
    'scoring_recalculate', 'scoring_window_lock', 'scoring_window_unlock',
    'player_price_override', 'player_data_edit',
    'transfer_reverse', 'waiver_override', 'trade_veto_override', 'trade_cancel_override',
    'feature_flag_toggle', 'ticket_resolve',
    name='adminactiontype_enum',
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    userrole_enum.create(bind, checkfirst=True)
    adminactiontype_enum.create(bind, checkfirst=True)

    op.add_column(
        'users',
        sa.Column('role', userrole_enum, server_default='user', nullable=False),
    )

    op.create_table(
        'admin_audit_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('actor_user_id', sa.UUID(), nullable=False),
        sa.Column('actor_username_snapshot', sa.String(length=50), nullable=False),
        sa.Column('action', adminactiontype_enum, nullable=False),
        sa.Column('target_type', sa.String(length=50), nullable=False),
        sa.Column('target_id', sa.String(length=255), nullable=False),
        sa.Column('reason', sa.String(length=1000), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_admin_audit_logs_actor_created', 'admin_audit_logs', ['actor_user_id', 'created_at'], unique=False
    )
    op.create_index(
        'ix_admin_audit_logs_target', 'admin_audit_logs', ['target_type', 'target_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_admin_audit_logs_target', table_name='admin_audit_logs')
    op.drop_index('ix_admin_audit_logs_actor_created', table_name='admin_audit_logs')
    op.drop_table('admin_audit_logs')

    op.drop_column('users', 'role')

    bind = op.get_bind()
    adminactiontype_enum.drop(bind, checkfirst=True)
    userrole_enum.drop(bind, checkfirst=True)
