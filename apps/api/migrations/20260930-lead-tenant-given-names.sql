-- Split the display name so leads and tenants can be refilled as given name + surname.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(255) NOT NULL DEFAULT '';

UPDATE leads
SET
  first_name = split_part(btrim(name), ' ', 1),
  last_name = CASE
    WHEN position(' ' IN btrim(name)) > 0
      THEN btrim(substr(btrim(name), position(' ' IN btrim(name)) + 1))
    ELSE ''
  END
WHERE first_name = '' AND btrim(name) <> '';

UPDATE tenants
SET
  first_name = split_part(btrim(name), ' ', 1),
  last_name = CASE
    WHEN position(' ' IN btrim(name)) > 0
      THEN btrim(substr(btrim(name), position(' ' IN btrim(name)) + 1))
    ELSE ''
  END
WHERE first_name = '' AND btrim(name) <> '';
