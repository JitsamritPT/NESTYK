-- =============================================================================
-- Portable blueprint — Agent leads (DDL)
-- =============================================================================
-- Docs: docs/new-project/agent/leads/README.md
--
-- Prerequisite:
--   docs/new-project/roles/schema.sql
--   docs/new-project/agent/create-room/schema.sql
--
-- Run before contracts/schema.sql
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS master_visa_types (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(64) NOT NULL UNIQUE,
  sort_order INT         NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE
);

INSERT INTO master_visa_types (code, sort_order)
VALUES
  ('tourist', 1),
  ('non_immigrant_b', 2),
  ('non_immigrant_ed', 3),
  ('non_immigrant_o', 4),
  ('elite', 5),
  ('ltr', 6),
  ('dtv', 7),
  ('other', 8)
ON CONFLICT (code) DO UPDATE SET sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS leads (
  id                 SERIAL PRIMARY KEY,
  rent_room_id       INT          NULL REFERENCES rent_rooms(id) ON DELETE SET NULL,
  name               VARCHAR(255) NOT NULL,
  phone              VARCHAR(50)  NOT NULL,
  email              VARCHAR(255) NULL,
  source             VARCHAR(64)  NULL,
  desired_room_type_id INT        NULL REFERENCES master_room_types(id) ON DELETE RESTRICT,
  budget_min         DECIMAL(12, 2) NULL,
  budget_max         DECIMAL(12, 2) NULL,
  other_contacts     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  nationality VARCHAR(120) NULL,
  -- Legacy single pin (superseded by lead_locations; no longer written, drop later)
  location_place_id VARCHAR(255) NULL,
  location_name VARCHAR(500) NULL,
  latitude DOUBLE PRECISION NULL,
  longitude DOUBLE PRECISION NULL,
  -- Search radius (1/3/5 km) shared by every lead_locations pin
  radius_km SMALLINT NULL,
  -- province = rank-1 pin province; locations = pin districts (list filter only)
  province VARCHAR(120) NULL,
  locations TEXT[] NOT NULL DEFAULT '{}',
  preferred_location VARCHAR(500) NULL,
  move_in_plan VARCHAR(255) NULL,
  has_pets BOOLEAN NULL,
  occupation VARCHAR(255) NULL,
  visa_type_id INT NULL REFERENCES master_visa_types(id) ON DELETE RESTRICT,
  lease_duration_months SMALLINT NULL,
  uses_car BOOLEAN NULL,
  occupant_count SMALLINT NULL,
  is_smoker BOOLEAN NULL,
  status             VARCHAR(20)  NOT NULL DEFAULT 'new',
  viewed_at          TIMESTAMPTZ  NULL,
  lost_reason        VARCHAR(500) NULL,
  notes              TEXT         NULL,
  tenant_id          INT          NULL,
  created_by_user_id INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_leads_lease_duration CHECK (lease_duration_months IS NULL OR lease_duration_months > 0),
  CONSTRAINT chk_leads_occupant_count CHECK (occupant_count IS NULL OR occupant_count > 0),
  CONSTRAINT chk_leads_radius_km CHECK (radius_km IS NULL OR radius_km IN (1, 3, 5)),
  CONSTRAINT chk_leads_budget CHECK (
    (budget_min IS NULL OR (budget_min >= 0 AND budget_min <> 'NaN'::numeric)) AND
    (budget_max IS NULL OR (budget_max > 0 AND budget_max <> 'NaN'::numeric)) AND
    (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
  ),
  CONSTRAINT chk_leads_other_contacts_array CHECK (jsonb_typeof(other_contacts) = 'array'),
  CONSTRAINT chk_leads_status CHECK (
    status IN ('new', 'inprogress', 'lost', 'booked')
  )
);

CREATE INDEX IF NOT EXISTS idx_leads_rent_room_id ON leads (rent_room_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_created_by_user_id ON leads (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone);

-- ห้องละ lead booked ได้คนเดียว (จองคิวเช่า)
CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_one_booked_per_room
  ON leads (rent_room_id)
  WHERE status = 'booked';

-- Ranked search pins (max 3, rank 1 = top priority) — see matching.md §2.1 / §3.1
CREATE TABLE IF NOT EXISTS lead_locations (
  id         SERIAL PRIMARY KEY,
  lead_id    INT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  rank       SMALLINT NOT NULL,
  place_id   VARCHAR(255) NULL,
  name       VARCHAR(500) NOT NULL,
  latitude   DOUBLE PRECISION NOT NULL,
  longitude  DOUBLE PRECISION NOT NULL,
  province   VARCHAR(120) NOT NULL,
  district   VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lead_locations_rank CHECK (rank BETWEEN 1 AND 3),
  CONSTRAINT chk_lead_locations_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_lead_locations_lng CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT uq_lead_locations_rank UNIQUE (lead_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_lead_locations_lat_lng ON lead_locations (latitude, longitude);

COMMIT;

-- tenant_id FK added in contracts/schema.sql after tenants table exists

-- Existing databases: also apply migrations/20260908-room-seeker-preferences.sql,
-- migrations/20260908-lead-profile.sql, and migrations/20260908-master-visa-types.sql.
-- Ranked pins: apps/api/migrations/20260924-lead-locations.sql (node apps/api/scripts/apply-lead-locations.cjs).
