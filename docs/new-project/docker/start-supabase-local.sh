#!/usr/bin/env bash
# Start local Supabase (Docker) — Postgres (app DB) + Storage (+ Auth/Studio).
# Mirrors hosted Supabase: one stack; deploy by swapping .env.api URL/keys.
#
# Usage (from monorepo root):
#   ./docs/new-project/docker/start-supabase-local.sh
#
# Then apply schema + seed, and set root .env.api from the printed keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

export SUPABASE_TELEMETRY_DISABLED=1
export DO_NOT_TRACK=1

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install/start Docker Desktop first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop, then retry."
  exit 1
fi

if [[ ! -f supabase/config.toml ]]; then
  echo "Missing supabase/config.toml — run: npx supabase init"
  exit 1
fi

echo "Starting local Supabase for NESTYK (API 54421, Postgres 54422)…"
echo "First run downloads images and may take several minutes."
npx supabase start

echo
echo "────────────────────────────────────────────────────────────"
echo "Local Supabase (NESTYK) is up — DB + Storage in one stack."
echo "Put these in root .env.api and restart API:"
echo
npx supabase status || true
echo
echo "Typical values for this repo's config.toml:"
echo "  DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres"
echo "  SUPABASE_URL=http://127.0.0.1:54421"
echo "  SUPABASE_SERVICE_ROLE_KEY=<service_role from status above>"
echo "  SUPABASE_BUCKET_PROPERTIES=property-images"
echo
echo "Next:"
echo "  ./docs/new-project/docker/apply-schema.sh"
echo "  ./docs/new-project/docker/seed-dev-user.sh"
echo "  ./docs/new-project/docker/seed-agent-demo.sh"
echo "  ./docs/new-project/docker/seed-agent-photos.sh"
echo "────────────────────────────────────────────────────────────"
