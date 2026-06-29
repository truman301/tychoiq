#!/bin/sh
set -e

# Apply the Prisma schema to the database on boot (idempotent), with a few
# retries to tolerate the database/private network needing a moment to be ready.
echo "→ Applying database schema…"
n=0
until [ "$n" -ge 5 ]; do
  if node_modules/.bin/prisma db push --skip-generate; then
    break
  fi
  n=$((n + 1))
  echo "  schema push failed (attempt $n/5) — retrying in 3s…"
  sleep 3
done
if [ "$n" -ge 5 ]; then
  echo "ERROR: could not apply database schema after 5 attempts" >&2
  exit 1
fi

echo "→ Starting TychoIQ…"
exec node_modules/.bin/next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
