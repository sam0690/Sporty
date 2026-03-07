# Step 1: Make sure ALL models are imported in your Base metadata.
# Every models.py must be imported somewhere before alembic runs.
# Check your alembic/env.py — it should import all modules:

# In alembic/env.py:
import app.auth.models       # noqa: F401
import app.league.models     # noqa: F401
import app.player.models     # noqa: F401
import app.scoring.models    # noqa: F401
from app.database import Base
target_metadata = Base.metadata

# Step 2: Generate the migration
alembic revision --autogenerate -m "phase2_all_models"

# Step 3: READ the generated file before running it.
# Open migrations/versions/xxxx_phase2_all_models.py
# Check every table is present.
# Check enum types are created before tables that use them.
# Check indexes appear.

# Step 4: Run it
alembic upgrade head