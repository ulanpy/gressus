#!/bin/sh
set -eu

# Sync deps on every start so pyproject.toml/lock changes work without rebuild.
# Packages install into system Python (POETRY_VIRTUALENVS_CREATE=0 in Dockerfile).
cd /gressus/backend
poetry install --no-root --no-cache

cd /gressus
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend
