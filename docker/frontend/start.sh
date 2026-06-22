#!/bin/sh
set -eu

cd /gressus/frontend

# node_modules lives in a named volume and survives image rebuilds; sync deps on start.
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

if [ "${IS_DEBUG:-true}" = "false" ]; then
  exec npm run build && npm run preview -- --host 0.0.0.0 --port 5173
fi

exec npm run dev
