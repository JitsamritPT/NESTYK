-- Lead status pipeline: drop `viewed`; keep new | inprogress | lost | booked.
UPDATE leads SET status = 'inprogress' WHERE status = 'viewed';

ALTER TABLE leads DROP CONSTRAINT IF EXISTS chk_leads_status;
ALTER TABLE leads ADD CONSTRAINT chk_leads_status CHECK (
  status IN ('new', 'inprogress', 'lost', 'booked')
);
