BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS location_place_id VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS location_name VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS radius_km SMALLINT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='leads'::regclass AND conname='chk_leads_map_location') THEN
    ALTER TABLE leads ADD CONSTRAINT chk_leads_map_location CHECK (
      (latitude IS NULL AND longitude IS NULL AND radius_km IS NULL AND location_name IS NULL AND location_place_id IS NULL)
      OR (latitude IS NOT NULL AND longitude IS NOT NULL AND radius_km IS NOT NULL AND location_name IS NOT NULL
        AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
        AND radius_km IN (1,3,5) AND length(trim(location_name)) > 0)
    );
  END IF;
END $$;
COMMENT ON COLUMN leads.radius_km IS 'Requested straight-line radius in km around the map pin';
COMMIT;
