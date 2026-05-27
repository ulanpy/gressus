#!/bin/sh
set -eu

cd /gressus/frontend

if [ "${IS_DEBUG:-true}" = "false" ]; then
  exec npm run build && npm run preview -- --host 0.0.0.0 --port 5173
fi

exec npm run dev
