-- Amenities catalog v2 — update_room.md 09/18 (6 groups)
-- Apply via apply-schema.sh or node pg. Keeps legacy masters; remaps room links to new codes.

BEGIN;

ALTER TABLE master_facilities_groups ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;
ALTER TABLE master_facilities ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 100;
ALTER TABLE master_facilities ADD COLUMN IF NOT EXISTS is_extra_charge BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO master_facilities_groups (code, sort_order) VALUES
  ('furniture', 10),
  ('appliances', 20),
  ('room_features', 30),
  ('parking', 40),
  ('project_facilities', 50),
  ('security_services', 60)
ON CONFLICT (code) DO UPDATE SET sort_order = EXCLUDED.sort_order;

-- Bump legacy groups so they sort after the new catalog (hidden from picker API).
UPDATE master_facilities_groups
SET sort_order = 1000 + COALESCE(id)
WHERE code IN ('popular', 'in_room_home', 'safety_security', 'services_facilities',
               'bedroom_bathroom', 'living_kitchen', 'wellness_recreation', 'food_drink',
               'accessibility', 'nearby_places');

INSERT INTO master_facilities (group_id, code, sort_order, is_extra_charge)
SELECT g.id, v.code, v.sort_order, false
FROM (VALUES
  -- furniture
  ('furniture', 'bed_mattress', 0),
  ('furniture', 'wardrobe', 1),
  ('furniture', 'sofa', 2),
  ('furniture', 'tv_stand', 3),
  ('furniture', 'dining_table', 4),
  ('furniture', 'desk', 5),
  ('furniture', 'vanity_mirror', 6),
  ('furniture', 'storage_cabinet', 7),
  ('furniture', 'curtains', 8),
  -- appliances
  ('appliances', 'air_conditioning', 0),
  ('appliances', 'fan', 1),
  ('appliances', 'tv', 2),
  ('appliances', 'refrigerator', 3),
  ('appliances', 'microwave', 4),
  ('appliances', 'washing_machine', 5),
  ('appliances', 'dryer', 6),
  ('appliances', 'water_heater', 7),
  ('appliances', 'induction_stove', 8),
  ('appliances', 'gas_stove', 9),
  ('appliances', 'range_hood', 10),
  ('appliances', 'water_filter', 11),
  ('appliances', 'digital_door_lock', 12),
  ('appliances', 'smart_home', 13),
  -- room_features
  ('room_features', 'open_kitchen', 0),
  ('room_features', 'closed_kitchen', 1),
  ('room_features', 'bathtub', 2),
  ('room_features', 'balcony', 3),
  ('room_features', 'mosquito_net', 4),
  ('room_features', 'drying_area', 5),
  ('room_features', 'storage_room', 6),
  -- parking
  ('parking', 'car_parking', 0),
  ('parking', 'motorcycle_parking', 1),
  ('parking', 'bicycle_parking', 2),
  ('parking', 'fixed_parking_slot', 3),
  ('parking', 'indoor_parking', 4),
  ('parking', 'private_ev_charger', 5),
  -- project_facilities
  ('project_facilities', 'shared_pool', 0),
  ('project_facilities', 'gym', 1),
  ('project_facilities', 'sauna', 2),
  ('project_facilities', 'shared_garden', 3),
  ('project_facilities', 'coworking', 4),
  ('project_facilities', 'cokitchen', 5),
  ('project_facilities', 'playground', 6),
  ('project_facilities', 'parcel_room', 7),
  ('project_facilities', 'shared_laundry', 8),
  ('project_facilities', 'shuttle', 9),
  ('project_facilities', 'shared_ev_charger', 10),
  -- security_services
  ('security_services', 'security_24h', 0),
  ('security_services', 'keycard_access', 1),
  ('security_services', 'cctv', 2),
  ('security_services', 'smoke_detector', 3),
  ('security_services', 'fire_extinguisher', 4),
  ('security_services', 'in_unit_internet', 5),
  ('security_services', 'housekeeping', 6),
  ('security_services', 'pet_friendly', 7)
) AS v(group_code, code, sort_order)
JOIN master_facilities_groups g ON g.code = v.group_code
ON CONFLICT (group_id, code) DO UPDATE SET sort_order = EXCLUDED.sort_order;

-- Remap room_facilities from legacy codes → new catalog (keep old rows if already remapped).
WITH map(old_code, new_code, new_group) AS (VALUES
  ('aircon', 'air_conditioning', 'appliances'),
  ('air_con', 'air_conditioning', 'appliances'),
  ('air_conditioner', 'air_conditioning', 'appliances'),
  ('bed_01', 'air_conditioning', 'appliances'),
  ('bed_02', 'wardrobe', 'furniture'),
  ('bed_04', 'bathtub', 'room_features'),
  ('bed_05', 'bathtub', 'room_features'),
  ('liv_02', 'desk', 'furniture'),
  ('liv_03', 'tv', 'appliances'),
  ('liv_04', 'open_kitchen', 'room_features'),
  ('liv_05', 'refrigerator', 'appliances'),
  ('liv_06', 'microwave', 'appliances'),
  ('liv_08', 'washing_machine', 'appliances'),
  ('liv_09', 'balcony', 'room_features'),
  ('sec_01', 'security_24h', 'security_services'),
  ('sec_02', 'keycard_access', 'security_services'),
  ('sec_03', 'cctv', 'security_services'),
  ('sec_04', 'smoke_detector', 'security_services'),
  ('sec_05', 'fire_extinguisher', 'security_services'),
  ('srv_02', 'housekeeping', 'security_services'),
  ('srv_04', 'car_parking', 'parking'),
  ('pop_04', 'car_parking', 'parking'),
  ('parking', 'car_parking', 'parking'),
  ('srv_06', 'coworking', 'project_facilities'),
  ('srv_07', 'shared_garden', 'project_facilities'),
  ('srv_08', 'shared_pool', 'project_facilities'),
  ('pop_01', 'shared_pool', 'project_facilities'),
  ('srv_09', 'shared_pool', 'project_facilities'),
  ('pop_02', 'sauna', 'project_facilities'),
  ('pop_03', 'gym', 'project_facilities'),
  ('pop_05', 'pet_friendly', 'security_services')
)
INSERT INTO room_facilities (rent_room_id, group_id, f_id)
SELECT DISTINCT rf.rent_room_id, ng.id, nf.id
FROM room_facilities rf
JOIN master_facilities old ON old.id = rf.f_id
JOIN map ON map.old_code = old.code
JOIN master_facilities_groups ng ON ng.code = map.new_group
JOIN master_facilities nf ON nf.group_id = ng.id AND nf.code = map.new_code
ON CONFLICT (rent_room_id, f_id) DO NOTHING;

COMMIT;
