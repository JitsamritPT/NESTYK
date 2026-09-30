-- Ranked map pins per lead (max 3). Radius stays on leads.radius_km (shared by all pins).
CREATE TABLE IF NOT EXISTS lead_locations (
  id serial PRIMARY KEY,
  lead_id int NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  rank smallint NOT NULL,
  place_id varchar(255) NULL,
  name varchar(500) NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  province varchar(120) NOT NULL,
  district varchar(255) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_lead_locations_rank CHECK (rank BETWEEN 1 AND 3),
  CONSTRAINT chk_lead_locations_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_lead_locations_lng CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT uq_lead_locations_rank UNIQUE (lead_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_lead_locations_lat_lng
  ON lead_locations (latitude, longitude);

-- Pins moved to lead_locations; radius_km is shared and independent of the legacy pin columns.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS chk_leads_map_location;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'leads'::regclass AND conname = 'chk_leads_radius_km') THEN
    ALTER TABLE leads ADD CONSTRAINT chk_leads_radius_km CHECK (radius_km IS NULL OR radius_km IN (1, 3, 5));
  END IF;
END $$;

-- Backfill: the previous single pin becomes rank 1.
INSERT INTO lead_locations (lead_id, rank, place_id, name, latitude, longitude, province, district)
SELECT l.id, 1, NULLIF(l.location_place_id, ''), COALESCE(NULLIF(l.location_name, ''), l.province),
       l.latitude, l.longitude, l.province, l.locations[1]
FROM leads l
WHERE l.latitude IS NOT NULL
  AND l.longitude IS NOT NULL
  AND l.province IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM lead_locations x WHERE x.lead_id = l.id);
