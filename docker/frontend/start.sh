#!/bin/sh
set -eu

cd /gressus/frontend

lockfile_hash="$(sha256sum package-lock.json | awk '{print $1}')"
installed_hash_file="node_modules/.package-lock.sha256"

# The named node_modules volume is empty on its first use and masks the
# dependencies installed into the image. Reinstall only when the lockfile changed.
if [ ! -x node_modules/.bin/vite ] || [ ! -f "$installed_hash_file" ] \
  || [ "$(cat "$installed_hash_file")" != "$lockfile_hash" ]; then
  npm ci
  printf '%s\n' "$lockfile_hash" > "$installed_hash_file"
fi

if [ "${IS_DEBUG:-true}" = "false" ]; then
  exec npm run build && npm run preview -- --host 0.0.0.0 --port 5173
fi

exec npm run dev
