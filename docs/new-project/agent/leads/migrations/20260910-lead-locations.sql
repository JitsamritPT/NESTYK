BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS province VARCHAR(120) NULL,
  ADD COLUMN IF NOT EXISTS locations TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_leads_agent_province ON leads (created_by_user_id, province);
CREATE INDEX IF NOT EXISTS idx_leads_locations ON leads USING GIN (locations);
COMMENT ON COLUMN leads.preferred_location IS 'Additional location details; legacy free-text location preserved';
COMMENT ON COLUMN leads.province IS 'Canonical Thai province; NULL for legacy leads';
COMMIT;
