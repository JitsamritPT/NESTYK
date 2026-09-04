-- =============================================================================
-- Portable blueprint — Agent contracts (DDL)
-- =============================================================================
-- Prerequisite:
--   docs/new-project/roles/schema.sql
--   docs/new-project/agent/create-room/schema.sql
--   docs/new-project/agent/leads/schema.sql
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- tenants — ผู้เช่าที่ทำสัญญา (สร้างจาก lead booked เท่านั้น)
-- ชื่ออยู่ทั้ง leads และ tenants — lead.status = booked, lead.tenant_id ชี้มา
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id                 SERIAL PRIMARY KEY,
  lead_id            INT          NOT NULL UNIQUE REFERENCES leads(id) ON DELETE RESTRICT,
  name               VARCHAR(255) NOT NULL,
  phone              VARCHAR(50)  NOT NULL,
  email              VARCHAR(255) NULL,
  note               VARCHAR(500) NULL,
  user_id            INT          NULL REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_lead_id ON tenants (lead_id);
CREATE INDEX IF NOT EXISTS idx_tenants_user_id ON tenants (user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_created_by_user_id ON tenants (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_phone ON tenants (phone);

-- FK จาก leads → tenants (leads สร้างก่อนใน leads/schema.sql)
-- idempotent: รัน apply ซ้ำได้
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_leads_tenant_id'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT fk_leads_tenant_id
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- room_tenancies — tenant ผูกห้อง (occupancy)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS room_tenancies (
  id                 SERIAL PRIMARY KEY,
  rent_room_id       INT          NOT NULL REFERENCES rent_rooms(id) ON DELETE RESTRICT,
  tenant_id          INT          NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  status             VARCHAR(20)  NOT NULL DEFAULT 'prospect',
  move_in_date       DATE         NULL,
  move_out_date      DATE         NULL,
  created_by_user_id INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_room_tenancies_status
    CHECK (status IN ('prospect', 'active', 'moved_out'))
);

CREATE INDEX IF NOT EXISTS idx_room_tenancies_rent_room_id ON room_tenancies (rent_room_id);
CREATE INDEX IF NOT EXISTS idx_room_tenancies_tenant_id ON room_tenancies (tenant_id);
CREATE INDEX IF NOT EXISTS idx_room_tenancies_status ON room_tenancies (status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_tenancies_one_active_per_room
  ON room_tenancies (rent_room_id)
  WHERE status = 'active';

-- -----------------------------------------------------------------------------
-- lease_contracts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lease_contracts (
  id                      SERIAL PRIMARY KEY,
  contract_no             VARCHAR(32)  NULL UNIQUE,
  room_tenancy_id         INT          NOT NULL REFERENCES room_tenancies(id) ON DELETE RESTRICT,
  rent_room_id            INT          NOT NULL REFERENCES rent_rooms(id) ON DELETE RESTRICT,
  tenant_id               INT          NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  lead_id                 INT          NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  property_owner_id       INT          NULL REFERENCES property_owners(id) ON DELETE SET NULL,
  owner_user_id           INT          NULL REFERENCES users(id) ON DELETE SET NULL,
  created_by_user_id      INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  original_contract_id    INT          NULL REFERENCES lease_contracts(id) ON DELETE SET NULL,
  contract_type_code      VARCHAR(64)  NULL,
  start_date              DATE         NOT NULL,
  end_date                DATE         NULL,
  monthly_rent            DECIMAL(12, 2) NULL,
  deposit                 DECIMAL(12, 2) NULL,
  advance_rent            DECIMAL(12, 2) NULL,
  status                  VARCHAR(40)  NOT NULL DEFAULT 'draft',
  document_url            TEXT         NULL,
  owner_signed_at         TIMESTAMPTZ  NULL,
  tenant_signed_at        TIMESTAMPTZ  NULL,
  reviewed_by_user_id     INT          NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at             TIMESTAMPTZ  NULL,
  payment_submitted_at    TIMESTAMPTZ  NULL,
  terminated_at           TIMESTAMPTZ  NULL,
  notes                   TEXT         NULL,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_lease_contracts_status CHECK (
    status IN (
      'draft',
      'awaiting_signatures',
      'awaiting_agent_review',
      'awaiting_payment',
      'awaiting_payment_verification',
      'active',
      'cancelled',
      'expired',
      'terminated'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_lease_contracts_room_tenancy_id ON lease_contracts (room_tenancy_id);
CREATE INDEX IF NOT EXISTS idx_lease_contracts_rent_room_id ON lease_contracts (rent_room_id);
CREATE INDEX IF NOT EXISTS idx_lease_contracts_tenant_id ON lease_contracts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_lease_contracts_lead_id ON lease_contracts (lead_id);
CREATE INDEX IF NOT EXISTS idx_lease_contracts_status_updated_at ON lease_contracts (status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lease_contracts_created_by_user_id ON lease_contracts (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_lease_contracts_original_contract_id ON lease_contracts (original_contract_id);

COMMIT;
