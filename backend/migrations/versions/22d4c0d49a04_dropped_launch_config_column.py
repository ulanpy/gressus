"""dropped launch config column

Revision ID: 22d4c0d49a04
Revises: 5a9ee33a7a24
Create Date: 2026-06-19 05:46:55.999460

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '22d4c0d49a04'
down_revision: Union[str, Sequence[str], None] = '8277fd10ac7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # No-op: launch_config was never created in this migration lineage
    # (column was already removed before initial_schema was regenerated).
    pass


def downgrade() -> None:
    """Downgrade schema."""
    # No-op, matching upgrade()
    pass
