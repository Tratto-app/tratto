#!/bin/bash
# Backup de la base. Guardalo en un cron: 0 3 * * * /ruta/backup.sh
#
# Los turnos viejos se borran cada domingo, así que el backup importa sobre
# todo por los clientes, los descuentos y los balances.
set -euo pipefail

DESTINO="${1:-./backups}"
mkdir -p "$DESTINO"
ARCHIVO="$DESTINO/barberia-$(date +%Y%m%d-%H%M).sql.gz"

if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump "$DATABASE_URL" | gzip > "$ARCHIVO"
else
  docker compose exec -T base pg_dump -U barberia barberia | gzip > "$ARCHIVO"
fi

# Se conservan los últimos 30 backups.
ls -1t "$DESTINO"/barberia-*.sql.gz | tail -n +31 | xargs -r rm --

echo "✅ Backup guardado en $ARCHIVO"
