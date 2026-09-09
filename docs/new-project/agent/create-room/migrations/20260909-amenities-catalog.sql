-- NETIQ amenities catalog. Existing rooms and unknown legacy facilities are retained.
BEGIN;
ALTER TABLE master_facilities_groups ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;
ALTER TABLE master_facilities ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;
ALTER TABLE master_facilities ADD COLUMN IF NOT EXISTS is_extra_charge BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO master_facilities_groups (code, sort_order) VALUES
('popular', 0),
('in_room_home', 1),
('safety_security', 2),
('services_facilities', 3)
ON CONFLICT (code) DO UPDATE SET sort_order = EXCLUDED.sort_order;
INSERT INTO master_facilities (group_id, code, sort_order, is_extra_charge)
SELECT g.id, v.code, v.sort_order, v.is_extra_charge FROM (VALUES
('popular', 'pop_01', 0, false),
('popular', 'pop_03', 1, false),
('popular', 'pop_02', 2, false),
('popular', 'pop_04', 3, false),
('popular', 'pop_05', 4, false),
('in_room_home', 'bed_01', 0, false),
('in_room_home', 'bed_02', 1, false),
('in_room_home', 'bed_04', 2, false),
('in_room_home', 'liv_02', 3, false),
('in_room_home', 'liv_03', 4, false),
('in_room_home', 'liv_04', 5, false),
('in_room_home', 'liv_05', 6, false),
('in_room_home', 'liv_06', 7, false),
('in_room_home', 'liv_08', 8, false),
('in_room_home', 'liv_09', 9, false),
('safety_security', 'sec_01', 0, false),
('safety_security', 'sec_02', 1, false),
('safety_security', 'sec_03', 2, false),
('safety_security', 'sec_04', 3, false),
('safety_security', 'sec_05', 4, false),
('safety_security', 'sec_06', 5, false),
('services_facilities', 'srv_02', 0, true),
('services_facilities', 'srv_01', 1, false),
('services_facilities', 'srv_04', 2, false),
('services_facilities', 'srv_05', 3, false),
('services_facilities', 'srv_06', 4, false),
('services_facilities', 'srv_07', 5, false),
('services_facilities', 'srv_08', 6, false),
('services_facilities', 'srv_09', 7, false)
) AS v(group_code, code, sort_order, is_extra_charge) JOIN master_facilities_groups g ON g.code = v.group_code
ON CONFLICT (group_id, code) DO UPDATE SET sort_order = EXCLUDED.sort_order, is_extra_charge = EXCLUDED.is_extra_charge;

-- Insert the equivalent selection before removing only its obsolete link.
INSERT INTO room_facilities (rent_room_id, group_id, f_id)
SELECT rf.rent_room_id, target.group_id, target.id
FROM room_facilities rf JOIN master_facilities old ON old.id = rf.f_id
CROSS JOIN master_facilities target JOIN master_facilities_groups g ON g.id = target.group_id
WHERE old.code IN ('aircon', 'air_con', 'air_conditioner') AND target.code = 'bed_01' AND g.code = 'in_room_home'
ON CONFLICT (rent_room_id, f_id) DO NOTHING;
DELETE FROM room_facilities rf USING master_facilities old
WHERE rf.f_id = old.id AND old.code IN ('aircon', 'air_con', 'air_conditioner')
AND EXISTS (SELECT 1 FROM room_facilities replacement JOIN master_facilities f ON f.id = replacement.f_id
JOIN master_facilities_groups g ON g.id = f.group_id
WHERE replacement.rent_room_id = rf.rent_room_id AND f.code = 'bed_01' AND g.code = 'in_room_home');
COMMIT;
