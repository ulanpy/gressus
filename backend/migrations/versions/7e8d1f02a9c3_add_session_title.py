"""add optional therapist-facing session title

Revision ID: 7e8d1f02a9c3
Revises: ab3a6b974b74
Create Date: 2026-09-15 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7e8d1f02a9c3"
down_revision: Union[str, Sequence[str], None] = "ab3a6b974b74"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("title", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "title")
