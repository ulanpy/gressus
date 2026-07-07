"""added analytics status & metrics columns to sessions model

Revision ID: 636013f742bd
Revises: f1acc08b0151
Create Date: 2026-07-07 13:22:43.388233

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '636013f742bd'
down_revision: Union[str, Sequence[str], None] = 'f1acc08b0151'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# IMPORTANT FOR FUTURE: Postgres requires the enum to be created before the column is added.
_ANALYTICS_STATUS = postgresql.ENUM(
    "pending",
    "processing",
    "ready",
    "failed",
    name="analytics_status",
    create_type=False,
)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    postgresql.ENUM(
        "pending",
        "processing",
        "ready",
        "failed",
        name="analytics_status",
    ).create(bind, checkfirst=True)

    op.add_column("sessions", sa.Column("analytics_status", _ANALYTICS_STATUS, nullable=True))
    op.add_column(
        "sessions",
        sa.Column("analytics_metrics", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.create_index(op.f("ix_sessions_analytics_status"), "sessions", ["analytics_status"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_sessions_analytics_status"), table_name="sessions")
    op.drop_column("sessions", "analytics_metrics")
    op.drop_column("sessions", "analytics_status")

    postgresql.ENUM(
        "pending",
        "processing",
        "ready",
        "failed",
        name="analytics_status",
    ).drop(op.get_bind(), checkfirst=True)
