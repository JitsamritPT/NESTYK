-- Store tenant ID/passport and nationality on the tenant profile.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS identity_number VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS nationality VARCHAR(120) NULL;

UPDATE tenants t
SET nationality = l.nationality
FROM leads l
WHERE t.lead_id = l.id
  AND t.nationality IS NULL
  AND l.nationality IS NOT NULL
  AND btrim(l.nationality) <> '';
