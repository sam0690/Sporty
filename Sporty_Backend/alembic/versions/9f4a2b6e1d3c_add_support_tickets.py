"""add support tickets

Revision ID: 9f4a2b6e1d3c
Revises: 8e1f2a9b3c7d
Create Date: 2026-07-05 17:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PGEnum

# revision identifiers, used by Alembic.
revision: str = '9f4a2b6e1d3c'
down_revision: Union[str, Sequence[str], None] = '8e1f2a9b3c7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ticketstatus_enum = PGEnum(
    'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed',
    name='ticketstatus_enum', create_type=False,
)
ticketpriority_enum = PGEnum(
    'low', 'normal', 'high', 'urgent', name='ticketpriority_enum', create_type=False,
)
ticketcategory_enum = PGEnum(
    'account', 'league_dispute', 'transfer_dispute', 'billing', 'bug', 'other',
    name='ticketcategory_enum', create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    ticketstatus_enum.create(bind, checkfirst=True)
    ticketpriority_enum.create(bind, checkfirst=True)
    ticketcategory_enum.create(bind, checkfirst=True)

    # New AdminActionType values for ticket admin actions (Phase 0's enum).
    # ADD VALUE can't run in the same transaction as a statement that USES
    # the new value, but nothing here does, so this is safe inside alembic's
    # single-transaction migration.
    op.execute("ALTER TYPE adminactiontype_enum ADD VALUE IF NOT EXISTS 'ticket_update'")
    op.execute("ALTER TYPE adminactiontype_enum ADD VALUE IF NOT EXISTS 'ticket_assign'")

    op.create_table(
        'support_tickets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('reporter_user_id', sa.UUID(), nullable=False),
        sa.Column('league_id', sa.UUID(), nullable=True),
        sa.Column('subject', sa.String(length=200), nullable=False),
        sa.Column('category', ticketcategory_enum, nullable=False),
        sa.Column('priority', ticketpriority_enum, server_default='normal', nullable=False),
        sa.Column('status', ticketstatus_enum, server_default='open', nullable=False),
        sa.Column('assigned_admin_user_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['reporter_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_admin_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_support_tickets_reporter_user_id', 'support_tickets', ['reporter_user_id'])
    op.create_index('ix_support_tickets_league_id', 'support_tickets', ['league_id'])
    op.create_index('ix_support_tickets_assigned_admin_user_id', 'support_tickets', ['assigned_admin_user_id'])

    op.create_table(
        'ticket_messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('ticket_id', sa.UUID(), nullable=False),
        sa.Column('author_user_id', sa.UUID(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('is_internal_note', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['ticket_id'], ['support_tickets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ticket_messages_ticket_id', 'ticket_messages', ['ticket_id'])


def downgrade() -> None:
    op.drop_index('ix_ticket_messages_ticket_id', table_name='ticket_messages')
    op.drop_table('ticket_messages')

    op.drop_index('ix_support_tickets_assigned_admin_user_id', table_name='support_tickets')
    op.drop_index('ix_support_tickets_league_id', table_name='support_tickets')
    op.drop_index('ix_support_tickets_reporter_user_id', table_name='support_tickets')
    op.drop_table('support_tickets')

    # Note: Postgres has no ALTER TYPE ... DROP VALUE — the two added
    # AdminActionType enum labels ('ticket_update', 'ticket_assign') are not
    # removed on downgrade. Harmless (unused labels), consistent with
    # Postgres enum limitations generally.

    bind = op.get_bind()
    ticketcategory_enum.drop(bind, checkfirst=True)
    ticketpriority_enum.drop(bind, checkfirst=True)
    ticketstatus_enum.drop(bind, checkfirst=True)
