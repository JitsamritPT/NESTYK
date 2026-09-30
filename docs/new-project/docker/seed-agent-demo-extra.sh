#!/usr/bin/env bash
# Seed 20 extra fully-filled demo rooms (demo-agent-11..30) + 3 pinned leads.
# Usage (from monorepo root):
#   ./docs/new-project/docker/seed-agent-demo-extra.sh
# Prerequisite: ./docs/new-project/docker/seed-agent-demo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

SQL_FILE="docs/new-project/docker/seed-agent-demo-extra.sql"
CONTAINER="${NESTYK_PG_CONTAINER:-supabase_db_NESTYK}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-postgres}"

if [[ -f .env.api ]]; then
  # shellcheck disable=SC1091
  set -a && source .env.api && set +a
fi

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54422/postgres}"

run_sql() {
  if command -v psql >/dev/null 2>&1; then
    echo "Seeding agent demo extra via psql → ${DATABASE_URL%%@*}@…"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
    return
  fi

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
    echo "psql not on PATH — seeding via docker exec $CONTAINER / $DB_NAME …"
    docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$SQL_FILE"
    return
  fi

  echo "Neither local psql nor container '$CONTAINER' is available."
  echo "Start with: ./docs/new-project/docker/start-supabase-local.sh"
  exit 1
}

run_sql
echo "Done. 20 extra rooms (demo-agent-11..30) + 3 pinned leads."
echo "Photos: DEMO_PHOTOS_MISSING_ONLY=1 ./docs/new-project/docker/seed-agent-photos.sh"
