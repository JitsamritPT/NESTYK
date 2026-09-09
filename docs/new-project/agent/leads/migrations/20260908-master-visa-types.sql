-- Catalog of visa types for foreign room-seekers. Labels live in i18n (masters.visaTypes.<code>).
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS master_visa_types (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(64) NOT NULL UNIQUE,
  sort_order INT         NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT TRUE
);

INSERT INTO master_visa_types (code, sort_order)
VALUES
  ('tourist', 1),
  ('non_immigrant_b', 2),
  ('non_immigrant_ed', 3),
  ('non_immigrant_o', 4),
  ('elite', 5),
  ('ltr', 6),
  ('dtv', 7),
  ('other', 8)
ON CONFLICT (code) DO UPDATE SET sort_order = EXCLUDED.sort_order;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS visa_type_id INT NULL REFERENCES master_visa_types(id) ON DELETE RESTRICT;

ALTER TABLE leads DROP COLUMN IF EXISTS visa_type;

COMMENT ON TABLE master_visa_types IS 'Visa types for foreign room-seekers; display via i18n masters.visaTypes.<code>';
COMMENT ON COLUMN leads.visa_type_id IS 'Optional FK to master_visa_types; NULL when unknown or not a foreign national';
COMMIT;
