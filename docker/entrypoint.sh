#!/bin/sh
set -e

# Evitar pnpm en runtime (pnpm 11 requiere node:sqlite, no disponible en Node 20).
find_prisma() {
  if [ -x /app/node_modules/.bin/prisma ]; then
    echo /app/node_modules/.bin/prisma
    return 0
  fi
  if [ -x /app/packages/database/node_modules/.bin/prisma ]; then
    echo /app/packages/database/node_modules/.bin/prisma
    return 0
  fi
  # Fallback pnpm store layout
  FOUND=$(find /app/node_modules/.pnpm -path '*/prisma@*/node_modules/prisma/build/index.js' 2>/dev/null | head -n 1)
  if [ -n "$FOUND" ]; then
    echo "node $FOUND"
    return 0
  fi
  return 1
}

if [ -n "$DATABASE_URL" ]; then
  echo "▶ Aplicando migraciones Prisma..."
  PRISMA_CMD=$(find_prisma) || {
    echo "✖ No se encontró el CLI de Prisma en la imagen."
    exit 1
  }
  cd /app/packages/database
  # shellcheck disable=SC2086
  $PRISMA_CMD migrate deploy
  cd /app
else
  echo "⚠ DATABASE_URL no definida; se omiten migraciones."
fi

exec "$@"
