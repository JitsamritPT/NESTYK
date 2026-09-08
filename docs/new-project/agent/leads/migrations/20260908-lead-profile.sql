-- Add only missing room-seeker profile fields; preserve all existing lead fields/data.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS preferred_location VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS move_in_plan VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS has_pets BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS occupation VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS visa_type VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS lease_duration_months SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS uses_car BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS occupant_count SMALLINT NULL,
  ADD COLUMN IF NOT EXISTS is_smoker BOOLEAN NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leads'::regclass AND conname='chk_leads_lease_duration') THEN
    ALTER TABLE leads ADD CONSTRAINT chk_leads_lease_duration CHECK (lease_duration_months IS NULL OR lease_duration_months > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leads'::regclass AND conname='chk_leads_occupant_count') THEN
    ALTER TABLE leads ADD CONSTRAINT chk_leads_occupant_count CHECK (occupant_count IS NULL OR occupant_count > 0);
  END IF;
END $$;
COMMENT ON COLUMN leads.move_in_plan IS 'Free-text move-in plan, e.g. immediately, October 2026, or an exact date';
COMMENT ON COLUMN leads.lease_duration_months IS 'Requested rental duration in whole months';
COMMENT ON COLUMN leads.has_pets IS 'NULL = unknown; true = pets; false = no pets';
COMMENT ON COLUMN leads.uses_car IS 'NULL = unknown; true = uses a car; false = no car';
COMMENT ON COLUMN leads.is_smoker IS 'NULL = unknown; true = smoker; false = non-smoker';
COMMIT;
