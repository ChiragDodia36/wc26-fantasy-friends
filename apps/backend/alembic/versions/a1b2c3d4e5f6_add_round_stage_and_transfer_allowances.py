"""add round stage and transfer allowances

Revision ID: a1b2c3d4e5f6
Revises: 4fa28a6e0d12
Create Date: 2026-02-25 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '4fa28a6e0d12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the RoundStage enum type
    round_stage_enum = sa.Enum(
        'GROUP', 'ROUND_OF_16', 'QUARTER_FINAL',
        'SEMI_FINAL', 'THIRD_PLACE', 'FINAL',
        name='roundstage',
    )
    round_stage_enum.create(op.get_bind(), checkfirst=True)

    # Add stage column to rounds table
    op.add_column(
        'rounds',
        sa.Column('stage', round_stage_enum, server_default='GROUP', nullable=False),
    )

    # Create transfer_allowances table
    op.create_table(
        'transfer_allowances',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('squad_id', sa.String(), nullable=False),
        sa.Column('round_id', sa.String(), nullable=False),
        sa.Column('match_date', sa.Date(), nullable=False),
        sa.Column('free_remaining', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['squad_id'], ['squads.id']),
        sa.ForeignKeyConstraint(['round_id'], ['rounds.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('squad_id', 'round_id', 'match_date', name='uq_squad_round_matchdate'),
    )


def downgrade() -> None:
    op.drop_table('transfer_allowances')
    op.drop_column('rounds', 'stage')
    sa.Enum(name='roundstage').drop(op.get_bind(), checkfirst=True)
