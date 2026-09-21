-- Amenities catalog trim — remove wet/dry bath, private garden/pool; keep pool under project facilities.
-- Labels: shared_pool → "สระว่ายน้ำ" (i18n). Apply after 20260318.

BEGIN;

-- Remap private_pool selections → shared_pool before delete.
WITH src AS (
  SELECT rf.rent_room_id, rf.f_id AS old_f_id
  FROM room_facilities rf
  JOIN master_facilities mf ON mf.id = rf.f_id
  WHERE mf.code = 'private_pool'
),
dest AS (
  SELECT id FROM master_facilities WHERE code = 'shared_pool' LIMIT 1
)
INSERT INTO room_facilities (rent_room_id, group_id, f_id)
SELECT src.rent_room_id, nf.group_id, nf.id
FROM src
CROSS JOIN dest
JOIN master_facilities nf ON nf.id = dest.id
ON CONFLICT (rent_room_id, f_id) DO NOTHING;

DELETE FROM room_facilities rf
USING master_facilities mf
WHERE rf.f_id = mf.id
  AND mf.code IN ('wet_dry_bathroom', 'private_garden', 'private_pool');

DELETE FROM master_facilities
WHERE code IN ('wet_dry_bathroom', 'private_garden', 'private_pool');

-- Ensure swimming pool exists under project facilities (shared_pool).
INSERT INTO master_facilities (group_id, code, sort_order, is_extra_charge)
SELECT g.id, 'shared_pool', 0, false
FROM master_facilities_groups g
WHERE g.code = 'project_facilities'
ON CONFLICT (group_id, code) DO UPDATE SET sort_order = 0;

COMMIT;
