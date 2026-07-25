#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yml"

COMPONENTS=("$@")
if [ "${#COMPONENTS[@]}" -eq 0 ]; then
  echo "Usage: $0 <component> [component...]"
  echo "Example: $0 button dialog input"
  exit 1
fi

if ! docker compose -f "$COMPOSE_FILE" ps --status running frontend 2>/dev/null | grep -q frontend; then
  echo "Frontend container is not running. Start it with: docker compose up -d frontend"
  exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T frontend \
  npx shadcn@latest add "${COMPONENTS[@]}" --yes --overwrite

echo "Done. Restart dev server if it was running during dependency changes."
