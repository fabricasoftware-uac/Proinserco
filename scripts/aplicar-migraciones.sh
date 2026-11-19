#!/usr/bin/env sh
# Aplica TODAS las migraciones de supabase/migrations en orden (nombre = marca de tiempo).
#
#   DATABASE_URL_DIRECT=postgresql://postgres:...@host:5432/postgres sh scripts/aplicar-migraciones.sh
#
# - Conexión DIRECTA (5432), nunca el pooler (6543).
# - Cada archivo en su propia transacción (--single-transaction) y ON_ERROR_STOP.
# - Con PREPARAR_POSTGRES_PLANO=si primero ejecuta supabase/tests/preparar-postgres-plano.sql
#   (SOLO pruebas/CI con la imagen oficial `postgres`; jamás en staging ni producción).
# - DESDE=<prefijo> aplica solo las migraciones cuyo nombre sea >= al prefijo
#   (p. ej. DESDE=20261118200000 en un servidor que ya tiene las 5 primeras).
set -eu

: "${DATABASE_URL_DIRECT:?Define DATABASE_URL_DIRECT (conexión directa, puerto 5432)}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

if [ "${PREPARAR_POSTGRES_PLANO:-no}" = "si" ]; then
  echo "→ preparar-postgres-plano.sql (solo pruebas)"
  psql "$DATABASE_URL_DIRECT" -X -q -v ON_ERROR_STOP=1 -f "$RAIZ/supabase/tests/preparar-postgres-plano.sql"
fi

for archivo in "$RAIZ"/supabase/migrations/*.sql; do
  nombre="$(basename "$archivo")"
  if [ -n "${DESDE:-}" ] && [ "${nombre%%_*}" -lt "$DESDE" ]; then
    continue
  fi
  echo "→ $nombre"
  psql "$DATABASE_URL_DIRECT" -X -q -v ON_ERROR_STOP=1 --single-transaction -f "$archivo"
done
echo "Migraciones aplicadas."
