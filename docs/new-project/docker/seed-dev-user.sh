#!/usr/bin/env bash
# Seed portable dev login profile into local Postgres.
# Usage (from monorepo root):
#   ./docs/new-project/docker/seed-dev-user.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

if [[ -f .env.api ]]; then
  # shellcheck disable=SC1091
  set -a && source .env.api && set +a
fi

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:password@localhost:5432/nestyk_db}"

echo "Seeding dev user into ${DATABASE_URL%%@*}@…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f docs/new-project/docker/seed-dev-user.sql
echo "Done. Login with admin@jitsamrit.com / Jitsamrit2026 (EXPO_PUBLIC_USE_DEV_AUTH)."
