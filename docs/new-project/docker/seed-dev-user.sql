-- =============================================================================
-- Dev profile seed — portable across clones (local Docker Postgres)
-- =============================================================================
-- Docs: docs/new-project/docker/README.md
-- Must match EXPO_PUBLIC_DEV_LOGIN_* in root `.env` / `.env.example`
--
-- UUID: 00000000-0000-4000-8000-000000000001
-- Email: admin@jitsamrit.com
--
-- Run (after roles schema):
--   psql "$DATABASE_URL" -f docs/new-project/docker/seed-dev-user.sql
-- Or: ./docs/new-project/docker/seed-dev-user.sh
--
-- Safe to re-run: upserts by supabase_user_id first, then by email.
-- =============================================================================

BEGIN;

-- Free the target email if another row holds it (keep that row, rename email).
UPDATE users
SET email = 'displaced+' || id::text || '@nestyk.local'
WHERE email = 'admin@jitsamrit.com'
  AND supabase_user_id IS DISTINCT FROM '00000000-0000-4000-8000-000000000001';

-- Prefer aligning the existing UUID row (preserves FKs / contract ownership).
UPDATE users
SET
  email = 'admin@jitsamrit.com',
  first_name = 'Admin',
  last_name = 'Jitsamrit',
  profile_completed = TRUE
WHERE supabase_user_id = '00000000-0000-4000-8000-000000000001';

-- If UUID row is missing, insert (or reclaim by email).
INSERT INTO users (
  supabase_user_id,
  email,
  first_name,
  last_name,
  phone,
  profile_completed
)
SELECT
  '00000000-0000-4000-8000-000000000001',
  'admin@jitsamrit.com',
  'Admin',
  'Jitsamrit',
  NULL,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM users
  WHERE supabase_user_id = '00000000-0000-4000-8000-000000000001'
)
ON CONFLICT (email) DO UPDATE
SET
  supabase_user_id = EXCLUDED.supabase_user_id,
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  profile_completed = TRUE;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
CROSS JOIN master_roles r
WHERE u.supabase_user_id = '00000000-0000-4000-8000-000000000001'
  AND r.name IN ('guest', 'admin', 'owner', 'tenant', 'agent')
ON CONFLICT DO NOTHING;

COMMIT;
