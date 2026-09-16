ALTER TABLE lease_contracts ADD COLUMN IF NOT EXISTS move_in_date DATE NULL;
-- Preserve existing reservation date values under their corrected meaning.
UPDATE lease_contracts c
SET move_in_date = COALESCE(c.move_in_date, c.end_date), end_date = NULL
FROM master_agreement_types t
WHERE c.agreement_type_code = t.code AND t.form_kind = 'reservation'
  AND c.end_date IS NOT NULL;
