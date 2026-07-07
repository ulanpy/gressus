#!/bin/sh
set -eu

cd /gressus/backend
poetry install --no-root --no-cache

cd /gressus
exec python -m backend.workers.analytics
