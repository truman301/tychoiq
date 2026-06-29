#!/bin/sh
set -e

# Apply the Prisma schema to the database on boot, then start the server.
# `db push` is idempotent; for versioned migrations use `prisma migrate deploy`.
echo "→ Applying database schema…"
node node_modules/prisma/build/index.js db push --skip-generate || \
  npx prisma db push --skip-generate

echo "→ Starting TychoIQ…"
exec node server.js
