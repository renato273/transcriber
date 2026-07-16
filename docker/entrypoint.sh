#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "▶ Aplicando migraciones Prisma..."
  cd /app/packages/database
  pnpm exec prisma migrate deploy
  cd /app
else
  echo "⚠ DATABASE_URL no definida; se omiten migraciones."
fi

exec "$@"
