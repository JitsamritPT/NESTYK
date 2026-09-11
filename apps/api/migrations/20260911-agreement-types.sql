-- Run within a transaction using the configured DB_SCHEMA search_path.
CREATE TABLE IF NOT EXISTS master_agreement_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name_th VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  icon VARCHAR(64) NOT NULL DEFAULT 'note',
  form_kind VARCHAR(32) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_agreement_form_kind CHECK (form_kind IN ('reservation', 'lease'))
);
INSERT INTO master_agreement_types (code, name_th, name_en, icon, form_kind, sort_order)
VALUES ('reservation', 'สัญญาจองห้อง', 'Room reservation agreement', 'calendar', 'reservation', 10),
       ('lease', 'สัญญาเช่า', 'Lease agreement', 'key', 'lease', 20)
ON CONFLICT (code) DO NOTHING;
ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS agreement_type_code VARCHAR(64) NOT NULL DEFAULT 'lease';
ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS reservation_fee NUMERIC(12,2) NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'lease_contracts'::regclass AND conname = 'fk_lease_agreement_type') THEN
    ALTER TABLE lease_contracts ADD CONSTRAINT fk_lease_agreement_type
      FOREIGN KEY (agreement_type_code) REFERENCES master_agreement_types(code) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'lease_contracts'::regclass AND conname = 'chk_reservation_fee_nonnegative') THEN
    ALTER TABLE lease_contracts ADD CONSTRAINT chk_reservation_fee_nonnegative CHECK (reservation_fee >= 0);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_lease_contracts_agreement_type ON lease_contracts(agreement_type_code);
-- Same exposure policy as the other server-only tables: clients use the guarded API.
ALTER TABLE master_agreement_types ENABLE ROW LEVEL SECURITY;
