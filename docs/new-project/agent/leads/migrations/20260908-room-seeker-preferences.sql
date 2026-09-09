-- Add room-seeker preferences to existing leads without replacing existing data.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE leads ALTER COLUMN rent_room_id DROP NOT NULL;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_rent_room_id_fkey;
ALTER TABLE leads ADD CONSTRAINT leads_rent_room_id_fkey
  FOREIGN KEY (rent_room_id) REFERENCES rent_rooms(id) ON DELETE SET NULL;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS desired_room_type_id INT NULL REFERENCES master_room_types(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS budget_min DECIMAL(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS budget_max DECIMAL(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS other_contacts JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'leads'::regclass AND conname = 'chk_leads_budget') THEN
    ALTER TABLE leads ADD CONSTRAINT chk_leads_budget CHECK (
      (budget_min IS NULL OR (budget_min >= 0 AND budget_min <> 'NaN'::numeric)) AND
      (budget_max IS NULL OR (budget_max > 0 AND budget_max <> 'NaN'::numeric)) AND
      (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'leads'::regclass AND conname = 'chk_leads_other_contacts_array') THEN
    ALTER TABLE leads ADD CONSTRAINT chk_leads_other_contacts_array
      CHECK (jsonb_typeof(other_contacts) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_agent_desired_room_type
  ON leads (created_by_user_id, desired_room_type_id);
COMMENT ON COLUMN leads.desired_room_type_id IS 'Desired room type; independent of a selected rental room';
COMMENT ON COLUMN leads.budget_min IS 'Minimum monthly rent budget, THB';
COMMENT ON COLUMN leads.budget_max IS 'Maximum monthly rent budget, THB';
COMMENT ON COLUMN leads.other_contacts IS 'Array of {channel, value}, e.g. line, whatsapp, facebook';

COMMIT;
