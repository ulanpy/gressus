#!/bin/sh
set -eu

cd /gressus
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir backend
