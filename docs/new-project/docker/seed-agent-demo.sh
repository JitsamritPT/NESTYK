#!/usr/bin/env bash
# Seed demo scout rooms + leads for the portable agent profile.
# Usage (from monorepo root):
#   ./docs/new-project/docker/seed-agent-demo.sh
# Prerequisite: schema applied + ./docs/new-project/docker/seed-dev-user.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

SQL_FILE="docs/new-project/docker/seed-agent-demo.sql"
CONTAINER="${NESTYK_PG_CONTAINER:-nestyk-postgres}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-nestyk_db}"

if [[ -f .env.api ]]; then
  # shellcheck disable=SC1091
  set -a && source .env.api && set +a
fi

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/nestyk_db}"

run_sql() {
  if command -v psql >/dev/null 2>&1; then
    echo "Seeding agent demo via psql → ${DATABASE_URL%%@*}@…"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
    return
  fi

  if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$CONTAINER"; then
    echo "psql not on PATH — seeding via docker exec $CONTAINER / $DB_NAME …"
    docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$SQL_FILE"
    return
  fi

  echo "Neither local psql nor container '$CONTAINER' is available."
  echo "Install psql, or: docker compose up -d"
  exit 1
}

run_sql
echo "Done. Login as admin@jitsamrit.com (agent role) to see 10 rooms + 6 leads."
