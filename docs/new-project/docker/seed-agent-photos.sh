#!/usr/bin/env bash
# Seed demo room photos into Supabase Storage + room_medias.
# Usage (from monorepo root):
#   ./docs/new-project/docker/seed-agent-photos.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

if [[ -f .env.api ]]; then
  # shellcheck disable=SC1091
  set -a && source .env.api && set +a
fi

node "$ROOT/docs/new-project/docker/seed-agent-photos.mjs"
