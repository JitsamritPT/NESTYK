-- Remove smart_tv from amenities catalog; remap selections to tv.
BEGIN;

WITH src AS (
  SELECT rf.rent_room_id
  FROM room_facilities rf
  JOIN master_facilities mf ON mf.id = rf.f_id
  WHERE mf.code = 'smart_tv'
),
dest AS (
  SELECT id, group_id FROM master_facilities WHERE code = 'tv' LIMIT 1
)
INSERT INTO room_facilities (rent_room_id, group_id, f_id)
SELECT src.rent_room_id, dest.group_id, dest.id
FROM src
CROSS JOIN dest
ON CONFLICT (rent_room_id, f_id) DO NOTHING;

DELETE FROM room_facilities rf
USING master_facilities mf
WHERE rf.f_id = mf.id AND mf.code = 'smart_tv';

DELETE FROM master_facilities WHERE code = 'smart_tv';

COMMIT;
