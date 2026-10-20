#!/usr/bin/env bash
set -euo pipefail
# Base local descartable, sin red ni puertos publicados. No usa producción.
wa_root=$(cd "$(dirname "$0")/../../.." && pwd)
wa_container="tratto-wa-test-${RANDOM}"
trap 'docker rm -f "$wa_container" >/dev/null 2>&1 || true' EXIT
docker run --name "$wa_container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust --mount "type=bind,src=$wa_root,dst=/repo,readonly" -d postgres:17.6-alpine >/dev/null
for _ in $(seq 1 30); do
  if docker exec "$wa_container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec "$wa_container" psql -U postgres -v ON_ERROR_STOP=1 -f /repo/tools/whatsapp/tests/fixture.sql >/dev/null
for wa_file in "$wa_root"/supabase/migrations/*_whatsapp_*.sql; do
  docker exec "$wa_container" psql -U postgres -v ON_ERROR_STOP=1 -f "/repo/supabase/migrations/$(basename "$wa_file")" >/dev/null
done
for wa_suite in queue races inbox; do
  docker exec "$wa_container" psql -U postgres -v ON_ERROR_STOP=1 -f "/repo/tools/whatsapp/tests/$wa_suite.sql"
done
