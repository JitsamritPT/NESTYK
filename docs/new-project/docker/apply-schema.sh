#!/usr/bin/env bash
# Apply docs/new-project schemas in order onto local Postgres.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CONTAINER="${NESTYK_PG_CONTAINER:-nestyk-postgres}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-nestyk_db}"

FILES=(
  "docs/new-project/roles/schema.sql"
  "docs/new-project/agent/create-room/schema.sql"
  "docs/new-project/agent/create-room/migrations/20260909-amenities-catalog.sql"
  "docs/new-project/agent/leads/schema.sql"
  "docs/new-project/agent/leads/migrations/20260908-room-seeker-preferences.sql"
  "docs/new-project/agent/leads/migrations/20260908-lead-profile.sql"
  "docs/new-project/agent/leads/migrations/20260908-master-visa-types.sql"
  "docs/new-project/agent/leads/migrations/20260910-lead-locations.sql"
  "docs/new-project/agent/leads/migrations/20260910-lead-map.sql"
  "docs/new-project/agent/contracts/schema.sql"
)

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container '$CONTAINER' is not running."
  echo "Start with: docker compose up -d"
  exit 1
fi

echo "Applying schemas to $CONTAINER / $DB_NAME ..."
for rel in "${FILES[@]}"; do
  abs="$ROOT/$rel"
  if [[ ! -f "$abs" ]]; then
    echo "Missing: $abs"
    exit 1
  fi
  echo "→ $rel"
  docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$abs"
done

echo
echo "Done. Tables in public:"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
