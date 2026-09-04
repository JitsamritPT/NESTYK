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

CREATE TABLE IF NOT EXISTS leads (
  id                 SERIAL PRIMARY KEY,
  rent_room_id       INT          NOT NULL REFERENCES rent_rooms(id) ON DELETE CASCADE,
  name               VARCHAR(255) NOT NULL,
  phone              VARCHAR(50)  NOT NULL,
  email              VARCHAR(255) NULL,
  source             VARCHAR(64)  NULL,
  status             VARCHAR(20)  NOT NULL DEFAULT 'new',
  viewed_at          TIMESTAMPTZ  NULL,
  lost_reason        VARCHAR(500) NULL,
  notes              TEXT         NULL,
  tenant_id          INT          NULL,
  created_by_user_id INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_leads_status CHECK (
    status IN ('new', 'inprogress', 'viewed', 'lost', 'booked')
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

COMMIT;

-- tenant_id FK added in contracts/schema.sql after tenants table exists
