-- =============================================================================
-- Agent demo seed (extra) — 20 fully-filled scout rooms + 3 pinned leads
-- =============================================================================
-- Prerequisite:
--   ./docs/new-project/docker/seed-agent-demo.sh   (owners + rooms demo-agent-1..10)
--
-- Seeds: rooms demo-agent-11..30 (property, prices 12/6/3 months, layout,
--        facilities) + 3 leads with ranked pins in lead_locations.
-- Re-runnable: wipes only its own rows first. Re-running seed-agent-demo.sh
-- deletes every demo-agent-* room, so run this file again afterwards.
--
-- Matching cases vs lead "Test A" (Asok / Lumpini / Bang Kapi, 3 km, ≤ 30,000,
-- three_bedroom, 12 months, move-in 2026-10-01):
--   pass all · outside radius · room type differs · lease only 6/3 months ·
--   free 7 / 15 / 44 days late · rented (hidden) · over budget (hidden) ·
--   farther than 2× radius (hidden)
--
-- Run: ./docs/new-project/docker/seed-agent-demo-extra.sh
-- Photos: DEMO_PHOTOS_MISSING_ONLY=1 ./docs/new-project/docker/seed-agent-photos.sh
-- =============================================================================

BEGIN;

CREATE TEMP TABLE demo_extra_rooms (
  room_id      text PRIMARY KEY,
  title        text NOT NULL,
  promo        text NOT NULL,
  description  text NOT NULL,
  prop_name    text NOT NULL,
  address      text NOT NULL,
  subdistrict  text NOT NULL,
  district     text NOT NULL,
  postal_code  text NOT NULL,
  lat          numeric(10, 7) NOT NULL,
  lng          numeric(10, 7) NOT NULL,
  room_type    text NOT NULL,
  status       text NOT NULL,
  available    date NOT NULL,
  p12          int,
  p6           int,
  p3           int,
  bedroom      text NOT NULL,
  bathroom     text NOT NULL,
  room_size    text NOT NULL,
  floor        text NOT NULL,
  building     text NOT NULL,
  water        numeric(12, 2) NOT NULL,
  electric     numeric(12, 2) NOT NULL,
  deposit      smallint NOT NULL,
  advance      smallint NOT NULL,
  visibility   text NOT NULL,
  source       text NOT NULL,
  owner_phone  text NOT NULL,
  facilities   text[] NOT NULL,
  custom       text[] NOT NULL,
  nearby_other text
) ON COMMIT DROP;

INSERT INTO demo_extra_rooms VALUES
  ('demo-agent-11', 'DEMO · The Esse Asoke 3BR', 'The Esse Asoke 3 ห้องนอน 120 ตร.ม. ติด BTS อโศก',
   'ห้อง 3 ห้องนอนมุมสูง วิวเมือง เดิน 3 นาทีถึง BTS อโศก / MRT สุขุมวิท เฟอร์นิเจอร์ครบพร้อมเข้าอยู่ [DEMO_SEED]',
   'DEMO · The Esse Asoke', '9 Sukhumvit 21', 'คลองเตยเหนือ', 'วัฒนา', '10110', 13.7390000, 100.5620000,
   'three_bedroom', 'available', '2026-09-28', 29000, 32000, NULL, '3', '2', '120', '28', 'A', 18, 7, 2, 1, 'published', 'co_agent', '0811111111',
   ARRAY['bed_mattress','wardrobe','sofa','dining_table','desk','curtains','air_conditioning','refrigerator','microwave','washing_machine','water_heater','induction_stove','range_hood','digital_door_lock','closed_kitchen','balcony','bathtub','car_parking','fixed_parking_slot','shared_pool','gym','sauna','parcel_room','security_24h','keycard_access','cctv','in_unit_internet'],
   ARRAY['Terminal 21','7-11'], 'ใกล้ Terminal 21'),
  ('demo-agent-12', 'DEMO · Lumpini Suite Sathorn 3BR', 'Lumpini Suite 3 ห้องนอน ใกล้ MRT ลุมพินี',
   'ห้องครอบครัว 3 ห้องนอน 2 ห้องน้ำ ใกล้สวนลุมพินี เดินถึง MRT ลุมพินี [DEMO_SEED]',
   'DEMO · Lumpini Suite Sathorn', '22 Sathorn Soi 1', 'ทุ่งมหาเมฆ', 'สาทร', '10120', 13.7240000, 100.5430000,
   'three_bedroom', 'available', '2026-10-08', 28500, NULL, NULL, '3', '2', '105', '15', 'B', 18, 7, 2, 1, 'published', 'owner', '0822222222',
   ARRAY['bed_mattress','wardrobe','sofa','dining_table','curtains','air_conditioning','refrigerator','washing_machine','water_heater','closed_kitchen','balcony','car_parking','shared_pool','gym','shared_garden','security_24h','keycard_access','cctv'],
   ARRAY['สวนลุมพินี'], NULL),
  ('demo-agent-13', 'DEMO · Park 24 3BR', 'Park 24 3 ห้องนอน วิวสวนเบญจสิริ',
   'ห้อง 3 ห้องนอนวิวสวน ใกล้ BTS พร้อมพงษ์ / Emquartier สัญญา 12 หรือ 6 เดือน [DEMO_SEED]',
   'DEMO · Park 24', '24 Sukhumvit 24', 'คลองตัน', 'คลองเตย', '10110', 13.7220000, 100.5690000,
   'three_bedroom', 'available', '2026-10-01', 30000, 33000, NULL, '3', '3', '130', '32', 'C', 20, 8, 2, 1, 'published', 'co_agent', '0811111111',
   ARRAY['bed_mattress','wardrobe','sofa','tv_stand','dining_table','desk','vanity_mirror','curtains','air_conditioning','tv','refrigerator','microwave','washing_machine','dryer','water_heater','induction_stove','range_hood','water_filter','digital_door_lock','smart_home','open_kitchen','balcony','bathtub','drying_area','car_parking','indoor_parking','private_ev_charger','shared_pool','gym','sauna','coworking','shared_laundry','security_24h','keycard_access','cctv','smoke_detector','fire_extinguisher','in_unit_internet','housekeeping'],
   ARRAY['Emquartier','Benjasiri Park'], 'ใกล้ Emquartier'),
  ('demo-agent-14', 'DEMO · Happyland Bangkapi 3BR', 'บ้านเดี่ยว Happyland 3 ห้องนอน ใกล้ The Mall บางกะปิ',
   'ทาวน์โฮม 3 ห้องนอน เหมาะครอบครัว สัญญาสั้น 6 หรือ 3 เดือนเท่านั้น [DEMO_SEED]',
   'DEMO · Happyland Bangkapi', '88 Happyland Rd', 'คลองจั่น', 'บางกะปิ', '10240', 13.7700000, 100.6420000,
   'three_bedroom', 'available', '2026-09-25', NULL, 26000, 28000, '3', '3', '160', '1', '-', 18, 7, 2, 1, 'published', 'owner', '0833333333',
   ARRAY['bed_mattress','wardrobe','sofa','dining_table','curtains','air_conditioning','fan','refrigerator','washing_machine','water_heater','gas_stove','closed_kitchen','drying_area','storage_room','car_parking','motorcycle_parking','cctv','pet_friendly'],
   ARRAY['The Mall บางกะปิ'], NULL),
  ('demo-agent-15', 'DEMO · Ramkhamhaeng Residence 3BR', 'Ramkhamhaeng Residence 3 ห้องนอน ใกล้ ม.รามคำแหง',
   'ห้องกว้าง 3 ห้องนอน ราคาคุ้ม ใกล้ ม.รามคำแหง / Airport Link รามคำแหง [DEMO_SEED]',
   'DEMO · Ramkhamhaeng Residence', '150 Ramkhamhaeng Rd', 'หัวหมาก', 'บางกะปิ', '10240', 13.7560000, 100.6120000,
   'three_bedroom', 'available', '2026-10-16', 24000, NULL, NULL, '3', '2', '98', '12', 'A', 17, 7, 2, 1, 'published', 'co_agent', '0833333333',
   ARRAY['bed_mattress','wardrobe','sofa','curtains','air_conditioning','refrigerator','washing_machine','water_heater','closed_kitchen','balcony','car_parking','shared_pool','gym','security_24h','keycard_access','cctv'],
   ARRAY[]::text[], NULL),
  ('demo-agent-16', 'DEMO · Edge Sukhumvit 23 2BR', 'Edge Sukhumvit 23 2 ห้องนอน ใกล้ MRT สุขุมวิท',
   'ห้อง 2 ห้องนอนแต่งใหม่ ใกล้ BTS อโศก / MRT สุขุมวิท รับสัญญา 12 หรือ 6 เดือน [DEMO_SEED]',
   'DEMO · Edge Sukhumvit 23', '23 Sukhumvit 23', 'คลองเตยเหนือ', 'วัฒนา', '10110', 13.7410000, 100.5640000,
   'two_bedroom', 'available', '2026-09-30', 27000, 29000, NULL, '2', '2', '65', '18', 'A', 18, 7, 2, 1, 'published', 'co_agent', '0811111111',
   ARRAY['bed_mattress','wardrobe','sofa','tv_stand','dining_table','desk','curtains','air_conditioning','tv','refrigerator','microwave','washing_machine','water_heater','induction_stove','digital_door_lock','open_kitchen','balcony','car_parking','shared_pool','gym','coworking','parcel_room','security_24h','keycard_access','cctv','in_unit_internet'],
   ARRAY['Srinakharinwirot Univ.'], NULL),
  ('demo-agent-17', 'DEMO · Siamese Exclusive 31 1BR', 'Siamese Exclusive 31 1 ห้องนอน ใกล้ BTS พร้อมพงษ์',
   'ห้อง 1 ห้องนอนตกแต่งโมเดิร์น เดินถึง BTS พร้อมพงษ์ มีสัญญา 12 / 6 / 3 เดือน [DEMO_SEED]',
   'DEMO · Siamese Exclusive 31', '31 Sukhumvit 31', 'คลองเตยเหนือ', 'วัฒนา', '10110', 13.7345000, 100.5665000,
   'one_bedroom', 'available', '2026-10-10', 22000, 24000, 26000, '1', '1', '42', '9', 'B', 18, 7, 2, 1, 'published', 'owner', '0822222222',
   ARRAY['bed_mattress','wardrobe','sofa','desk','curtains','air_conditioning','tv','refrigerator','microwave','washing_machine','water_heater','induction_stove','digital_door_lock','open_kitchen','balcony','car_parking','shared_pool','gym','parcel_room','security_24h','keycard_access','cctv','in_unit_internet'],
   ARRAY['7-11'], NULL),
  ('demo-agent-18', 'DEMO · Park Origin Phrom Phong 1BR+', 'Park Origin Phrom Phong 1 ห้องนอน+ ติด BTS',
   'ห้อง 1 ห้องนอน + ห้องทำงาน ติด BTS พร้อมพงษ์ ชั้นสูงวิวสวน [DEMO_SEED]',
   'DEMO · Park Origin Phrom Phong', '1 Sukhumvit 24', 'คลองตัน', 'คลองเตย', '10110', 13.7300000, 100.5710000,
   'one_bedroom_plus', 'available', '2026-10-01', 26000, NULL, NULL, '1', '1', '55', '35', 'A', 20, 8, 2, 1, 'published', 'co_agent', '0811111111',
   ARRAY['bed_mattress','wardrobe','sofa','tv_stand','desk','curtains','air_conditioning','tv','refrigerator','microwave','washing_machine','water_heater','induction_stove','range_hood','digital_door_lock','smart_home','open_kitchen','balcony','indoor_parking','shared_pool','gym','sauna','coworking','shared_garden','security_24h','keycard_access','cctv','smoke_detector','in_unit_internet','housekeeping'],
   ARRAY['Emporium'], NULL),
  ('demo-agent-19', 'DEMO · Noble Ploenchit Studio', 'Noble Ploenchit สตูดิโอ ติด BTS เพลินจิต',
   'สตูดิโอพร้อมอยู่ ติด BTS เพลินจิต เหมาะคนทำงานย่าน CBD [DEMO_SEED]',
   'DEMO · Noble Ploenchit', '888 Ploenchit Rd', 'ลุมพินี', 'ปทุมวัน', '10330', 13.7430000, 100.5480000,
   'studio', 'available', '2026-09-20', 18000, 19500, NULL, '0', '1', '30', '21', 'B', 18, 7, 2, 1, 'published', 'owner', '0822222222',
   ARRAY['bed_mattress','wardrobe','desk','curtains','air_conditioning','tv','refrigerator','microwave','water_heater','digital_door_lock','open_kitchen','shared_pool','gym','shared_laundry','security_24h','keycard_access','cctv'],
   ARRAY['Central Embassy'], NULL),
  ('demo-agent-20', 'DEMO · Rhythm Ekkamai 2BR', 'Rhythm Ekkamai 2 ห้องนอน ใกล้ BTS เอกมัย',
   'ห้อง 2 ห้องนอนชั้นสูง ใกล้ BTS เอกมัย ว่างกลางเดือนพฤศจิกายน [DEMO_SEED]',
   'DEMO · Rhythm Ekkamai', '63 Sukhumvit 63', 'คลองตันเหนือ', 'วัฒนา', '10110', 13.7200000, 100.5880000,
   'two_bedroom', 'available', '2026-11-14', 29500, NULL, NULL, '2', '2', '70', '26', 'A', 20, 8, 2, 1, 'published', 'co_agent', '0811111111',
   ARRAY['bed_mattress','wardrobe','sofa','dining_table','curtains','air_conditioning','tv','refrigerator','washing_machine','water_heater','induction_stove','open_kitchen','balcony','car_parking','shared_pool','gym','security_24h','keycard_access','cctv'],
   ARRAY['Gateway Ekkamai'], NULL),
  ('demo-agent-21', 'DEMO · Ideo Mobi Sukhumvit Studio', 'Ideo Mobi Sukhumvit สตูดิโอ ใกล้ BTS อ่อนนุช',
   'สตูดิโอราคาประหยัด ใกล้ BTS อ่อนนุช สัญญา 12 หรือ 3 เดือน [DEMO_SEED]',
   'DEMO · Ideo Mobi Sukhumvit', '77 Sukhumvit 77', 'พระโขนงเหนือ', 'วัฒนา', '10110', 13.7050000, 100.6000000,
   'studio', 'available', '2026-10-05', 15000, NULL, 17000, '0', '1', '26', '7', 'A', 17, 7, 2, 1, 'published', 'owner', '0833333333',
   ARRAY['bed_mattress','wardrobe','curtains','air_conditioning','refrigerator','microwave','water_heater','open_kitchen','motorcycle_parking','shared_pool','shared_laundry','keycard_access','cctv'],
   ARRAY['Tesco Lotus'], NULL),
  ('demo-agent-22', 'DEMO · Ideo Rama 9 - Asoke 1BR', 'Ideo Rama 9 - Asoke 1 ห้องนอน ใกล้ MRT พระราม 9',
   'ห้อง 1 ห้องนอนใหม่ ใกล้ MRT พระราม 9 / Central Rama 9 [DEMO_SEED]',
   'DEMO · Ideo Rama 9 - Asoke', '2 Rama IX Rd', 'ห้วยขวาง', 'ห้วยขวาง', '10310', 13.7560000, 100.5660000,
   'one_bedroom', 'available', '2026-10-12', 21000, 23000, NULL, '1', '1', '35', '19', 'A', 18, 7, 2, 1, 'published', 'co_agent', '0822222222',
   ARRAY['bed_mattress','wardrobe','sofa','desk','curtains','air_conditioning','tv','refrigerator','microwave','washing_machine','water_heater','induction_stove','digital_door_lock','open_kitchen','balcony','car_parking','shared_pool','gym','coworking','security_24h','keycard_access','cctv','in_unit_internet'],
   ARRAY['Central Rama 9'], NULL),
  ('demo-agent-23', 'DEMO · The Mall Residence Bangkapi 2BR', 'The Mall Residence 2 ห้องนอน ติด The Mall บางกะปิ',
   'ห้อง 2 ห้องนอนติดห้าง เหมาะครอบครัวเล็ก [DEMO_SEED]',
   'DEMO · The Mall Residence Bangkapi', '3522 Lat Phrao Rd', 'คลองจั่น', 'บางกะปิ', '10240', 13.7660000, 100.6470000,
   'two_bedroom', 'available', '2026-10-03', 23000, NULL, NULL, '2', '1', '58', '11', 'A', 17, 7, 2, 1, 'published', 'owner', '0833333333',
   ARRAY['bed_mattress','wardrobe','sofa','dining_table','curtains','air_conditioning','refrigerator','washing_machine','water_heater','closed_kitchen','balcony','car_parking','shared_pool','gym','security_24h','keycard_access','cctv'],
   ARRAY['The Mall บางกะปิ'], NULL),
  ('demo-agent-24', 'DEMO · Saladaeng One 3BR', 'Saladaeng One 3 ห้องนอน ใกล้ BTS ศาลาแดง',
   'ห้อง 3 ห้องนอนหรู ใกล้ BTS ศาลาแดง — เช่าแล้ว [DEMO_SEED]',
   'DEMO · Saladaeng One', '1 Sala Daeng Rd', 'สีลม', 'บางรัก', '10500', 13.7285000, 100.5390000,
   'three_bedroom', 'rented', '2026-09-29', 29900, NULL, NULL, '3', '3', '140', '30', 'A', 20, 8, 2, 1, 'published', 'co_agent', '0822222222',
   ARRAY['bed_mattress','wardrobe','sofa','dining_table','curtains','air_conditioning','tv','refrigerator','washing_machine','dryer','water_heater','induction_stove','closed_kitchen','balcony','bathtub','car_parking','shared_pool','gym','sauna','security_24h','keycard_access','cctv','housekeeping'],
   ARRAY[]::text[], NULL),
  ('demo-agent-25', 'DEMO · 98 Wireless 3BR', '98 Wireless 3 ห้องนอน ลักซ์ชัวรี ถนนวิทยุ',
   'ลักซ์ชัวรี 3 ห้องนอน ถนนวิทยุ วิวสวนลุมพินี [DEMO_SEED]',
   'DEMO · 98 Wireless', '98 Wireless Rd', 'ลุมพินี', 'ปทุมวัน', '10330', 13.7400000, 100.5480000,
   'three_bedroom', 'available', '2026-10-01', 85000, NULL, NULL, '3', '4', '220', '40', 'A', 25, 9, 2, 1, 'published', 'co_agent', '0811111111',
   ARRAY['bed_mattress','wardrobe','sofa','tv_stand','dining_table','desk','vanity_mirror','storage_cabinet','curtains','air_conditioning','tv','refrigerator','microwave','washing_machine','dryer','water_heater','induction_stove','range_hood','water_filter','digital_door_lock','smart_home','closed_kitchen','balcony','bathtub','storage_room','car_parking','fixed_parking_slot','indoor_parking','private_ev_charger','shared_pool','gym','sauna','shared_garden','coworking','security_24h','keycard_access','cctv','smoke_detector','fire_extinguisher','in_unit_internet','housekeeping'],
   ARRAY['Central Embassy','สวนลุมพินี'], NULL),
  ('demo-agent-26', 'DEMO · The Lofts Asoke 3BR', 'The Lofts Asoke 3 ห้องนอน ติด MRT เพชรบุรี',
   'ห้อง 3 ห้องนอนสไตล์ลอฟต์ ติด MRT เพชรบุรี [DEMO_SEED]',
   'DEMO · The Lofts Asoke', '1 Asoke-Din Daeng Rd', 'มักกะสัน', 'ราชเทวี', '10400', 13.7420000, 100.5610000,
   'three_bedroom', 'available', '2026-10-01', 45000, 48000, NULL, '3', '2', '115', '22', 'A', 20, 8, 2, 1, 'published', 'owner', '0822222222',
   ARRAY['bed_mattress','wardrobe','sofa','dining_table','curtains','air_conditioning','tv','refrigerator','washing_machine','water_heater','induction_stove','open_kitchen','balcony','car_parking','shared_pool','gym','security_24h','keycard_access','cctv'],
   ARRAY[]::text[], NULL),
  ('demo-agent-27', 'DEMO · Circle Living Prototype 2BR', 'Circle Living Prototype 2 ห้องนอน เพชรบุรีตัดใหม่',
   'ห้อง 2 ห้องนอนกว้าง ใกล้ Airport Link มักกะสัน [DEMO_SEED]',
   'DEMO · Circle Living Prototype', '36 New Petchburi Rd', 'มักกะสัน', 'ราชเทวี', '10400', 13.7500000, 100.5530000,
   'two_bedroom', 'available', '2026-09-26', 36000, NULL, NULL, '2', '2', '80', '25', 'B', 18, 7, 2, 1, 'published', 'co_agent', '0811111111',
   ARRAY['bed_mattress','wardrobe','sofa','dining_table','curtains','air_conditioning','tv','refrigerator','washing_machine','water_heater','closed_kitchen','balcony','car_parking','shared_pool','gym','sauna','security_24h','keycard_access','cctv'],
   ARRAY[]::text[], NULL),
  ('demo-agent-28', 'DEMO · Ideo Mobi Bangna 3BR', 'Ideo Mobi Bangna 3 ห้องนอน ใกล้ BTS บางนา',
   'ห้อง 3 ห้องนอน ใกล้ BTS บางนา / BITEC [DEMO_SEED]',
   'DEMO · Ideo Mobi Bangna', '9 Bangna-Trad Rd', 'บางนา', 'บางนา', '10260', 13.6680000, 100.6050000,
   'three_bedroom', 'available', '2026-09-27', 25000, NULL, NULL, '3', '2', '95', '14', 'A', 17, 7, 2, 1, 'published', 'owner', '0833333333',
   ARRAY['bed_mattress','wardrobe','sofa','curtains','air_conditioning','refrigerator','washing_machine','water_heater','closed_kitchen','balcony','car_parking','shared_pool','gym','security_24h','keycard_access','cctv'],
   ARRAY['BITEC'], NULL),
  ('demo-agent-29', 'DEMO · Ideo Q Ari Studio', 'Ideo Q Ari สตูดิโอ ติด BTS อารีย์',
   'สตูดิโอใหม่ ติด BTS อารีย์ สัญญา 12 หรือ 6 เดือน [DEMO_SEED]',
   'DEMO · Ideo Q Ari', '1 Phahonyothin 7', 'สามเสนใน', 'พญาไท', '10400', 13.7810000, 100.5440000,
   'studio', 'available', '2026-10-01', 17000, 17500, NULL, '0', '1', '28', '16', 'A', 18, 7, 2, 1, 'published', 'co_agent', '0822222222',
   ARRAY['bed_mattress','wardrobe','desk','curtains','air_conditioning','tv','refrigerator','microwave','water_heater','digital_door_lock','open_kitchen','balcony','shared_pool','gym','coworking','security_24h','keycard_access','cctv','in_unit_internet'],
   ARRAY['La Villa Ari'], NULL),
  ('demo-agent-30', 'DEMO · Chaengwattana Condo 2BR', 'คอนโดแจ้งวัฒนะ 2 ห้องนอน ใกล้ศูนย์ราชการ',
   'ห้อง 2 ห้องนอน ใกล้ศูนย์ราชการแจ้งวัฒนะ / MRT สายสีชมพู [DEMO_SEED]',
   'DEMO · Chaengwattana Condo', '120 Chaeng Watthana Rd', 'ทุ่งสองห้อง', 'หลักสี่', '10210', 13.9000000, 100.5300000,
   'two_bedroom', 'available', '2026-10-01', 20000, NULL, NULL, '2', '1', '60', '8', 'A', 17, 7, 2, 1, 'private', 'owner', '0833333333',
   ARRAY['bed_mattress','wardrobe','sofa','curtains','air_conditioning','refrigerator','washing_machine','water_heater','closed_kitchen','car_parking','shared_pool','security_24h','cctv'],
   ARRAY[]::text[], NULL);

DO $$
DECLARE
  v_agent_id INT;
  v_missing  TEXT;
BEGIN
  SELECT id INTO v_agent_id FROM users WHERE email = 'admin@jitsamrit.com';
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Dev user admin@jitsamrit.com not found — run seed-dev-user.sh first';
  END IF;

  SELECT string_agg(DISTINCT d.owner_phone, ', ') INTO v_missing
  FROM demo_extra_rooms d
  WHERE NOT EXISTS (
    SELECT 1 FROM property_owners o WHERE o.created_by_user_id = v_agent_id AND o.phone = d.owner_phone
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Demo owners missing (%) — run seed-agent-demo.sh first', v_missing;
  END IF;

  SELECT string_agg(f.code, ', ') INTO v_missing
  FROM (SELECT DISTINCT unnest(facilities) AS code FROM demo_extra_rooms) f
  WHERE NOT EXISTS (
    SELECT 1 FROM master_facilities mf JOIN master_facilities_groups g ON g.id = mf.group_id
    WHERE mf.code = f.code
      AND g.code IN ('furniture','appliances','room_features','parking','project_facilities','security_services')
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown facility codes: %', v_missing;
  END IF;

  -- Wipe previous extra rows (idempotent re-seed)
  DELETE FROM leads WHERE created_by_user_id = v_agent_id AND notes LIKE '%[DEMO_SEED_EXTRA]%';
  DELETE FROM rent_room_prices WHERE rent_room_id IN (SELECT id FROM rent_rooms WHERE room_id IN (SELECT room_id FROM demo_extra_rooms));
  DELETE FROM room_layout_values WHERE rent_room_id IN (SELECT id FROM rent_rooms WHERE room_id IN (SELECT room_id FROM demo_extra_rooms));
  DELETE FROM room_facilities WHERE rent_room_id IN (SELECT id FROM rent_rooms WHERE room_id IN (SELECT room_id FROM demo_extra_rooms));
  DELETE FROM rent_rooms WHERE room_id IN (SELECT room_id FROM demo_extra_rooms) AND created_by_user_id = v_agent_id;
  DELETE FROM properties p
  WHERE p.name IN (SELECT prop_name FROM demo_extra_rooms)
    AND NOT EXISTS (SELECT 1 FROM rent_rooms r WHERE r.properties_id = p.id);

  INSERT INTO properties (name, property_type_id, address, subdistrict, district, province, postal_code, latitude, longitude)
  SELECT d.prop_name,
         (SELECT id FROM master_property_types WHERE code = CASE WHEN d.room_id = 'demo-agent-14' THEN 'house' ELSE 'condo' END),
         d.address, d.subdistrict, d.district, 'กรุงเทพมหานคร', d.postal_code, d.lat, d.lng
  FROM demo_extra_rooms d;

  INSERT INTO rent_rooms (
    room_id, listing_title, promo_title, listing_description, available_from_date, prices, custom_facilities,
    latitude, longitude, nearby_other, water_rate_per_unit, electric_rate_per_unit, advance_rent_months, deposit_months,
    is_scout_room, visibility, created_by_user_id, property_owner_id, owner_id, properties_id,
    room_type_id, listing_source_id, room_status_id
  )
  SELECT
    d.room_id, d.title, d.promo, d.description, d.available,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'price', t.price, 'depositMonths', d.deposit, 'contractTypeId', ct.id,
        'contractTypeCode', ct.code, 'advanceRentMonths', d.advance
      ) ORDER BY ct.sort_order)
      FROM (VALUES ('monthly_12', d.p12), ('monthly_6', d.p6), ('monthly_3', d.p3)) AS t(code, price)
      JOIN master_contract_types ct ON ct.code = t.code
      WHERE t.price IS NOT NULL
    ),
    to_jsonb(d.custom),
    d.lat, d.lng, d.nearby_other, d.water, d.electric, d.advance, d.deposit,
    TRUE, d.visibility, v_agent_id,
    (SELECT o.id FROM property_owners o WHERE o.created_by_user_id = v_agent_id AND o.phone = d.owner_phone ORDER BY o.id LIMIT 1),
    NULL,
    (SELECT p.id FROM properties p WHERE p.name = d.prop_name ORDER BY p.id DESC LIMIT 1),
    (SELECT id FROM master_room_types WHERE code = d.room_type),
    (SELECT id FROM master_listing_sources WHERE code = d.source),
    (SELECT id FROM master_room_statuses WHERE code = d.status)
  FROM demo_extra_rooms d;

  INSERT INTO rent_room_prices (rent_room_id, contract_type_id, price)
  SELECT r.id, ct.id, t.price
  FROM demo_extra_rooms d
  JOIN rent_rooms r ON r.room_id = d.room_id AND r.created_by_user_id = v_agent_id
  CROSS JOIN LATERAL (VALUES ('monthly_12', d.p12), ('monthly_6', d.p6), ('monthly_3', d.p3)) AS t(code, price)
  JOIN master_contract_types ct ON ct.code = t.code
  WHERE t.price IS NOT NULL;

  INSERT INTO room_layout_values (rent_room_id, layout_id, value)
  SELECT r.id, ml.id, t.value
  FROM demo_extra_rooms d
  JOIN rent_rooms r ON r.room_id = d.room_id AND r.created_by_user_id = v_agent_id
  CROSS JOIN LATERAL (VALUES
    ('bedroom', d.bedroom), ('bathroom', d.bathroom), ('room_size', d.room_size), ('floor', d.floor), ('building', d.building)
  ) AS t(code, value)
  JOIN master_layouts ml ON ml.code = t.code
  WHERE t.value IS NOT NULL AND t.value <> '-';

  INSERT INTO room_facilities (rent_room_id, group_id, f_id)
  SELECT r.id, g.id, mf.id
  FROM demo_extra_rooms d
  JOIN rent_rooms r ON r.room_id = d.room_id AND r.created_by_user_id = v_agent_id
  CROSS JOIN LATERAL unnest(d.facilities) AS fc(code)
  JOIN master_facilities mf ON mf.code = fc.code
  JOIN master_facilities_groups g ON g.id = mf.group_id
  WHERE g.code IN ('furniture','appliances','room_features','parking','project_facilities','security_services');

  -- Leads with ranked pins (radius shared on leads.radius_km)
  WITH new_leads AS (
    INSERT INTO leads (
      name, phone, email, source, desired_room_type_id, budget_min, budget_max, radius_km, province, locations,
      preferred_location, move_in_plan, has_pets, uses_car, is_smoker, occupant_count, lease_duration_months,
      nationality, occupation, status, notes, other_contacts, created_by_user_id
    ) VALUES
      ('Demo อโศก 1BR', '0800000011', 'asoke.demo@example.com', 'facebook',
       (SELECT id FROM master_room_types WHERE code = 'one_bedroom'), 20000, 28000, 3, 'กรุงเทพมหานคร', ARRAY['คลองเตย','วัฒนา'],
       'ใกล้ BTS อโศก หรือพร้อมพงษ์', '2026-10-15', FALSE, FALSE, FALSE, 1, 12,
       'Japanese', 'พนักงานบริษัท', 'new', '[DEMO_SEED_EXTRA] Asoke 1BR', '[]'::jsonb, v_agent_id),
      ('Demo อารีย์ Studio', '0800000012', 'ari.demo@example.com', 'line',
       (SELECT id FROM master_room_types WHERE code = 'studio'), 12000, 18000, 1, 'กรุงเทพมหานคร', ARRAY['พญาไท','ราชเทวี'],
       'เดินถึง BTS ได้', '2026-10-05', FALSE, FALSE, FALSE, 1, 6,
       'Thai', 'ฟรีแลนซ์', 'inprogress', '[DEMO_SEED_EXTRA] Ari studio', '[]'::jsonb, v_agent_id),
      ('Demo พระราม 9 2BR', '0800000013', 'rama9.demo@example.com', 'walk_in',
       (SELECT id FROM master_room_types WHERE code = 'two_bedroom'), 25000, 40000, 5, 'กรุงเทพมหานคร', ARRAY['ห้วยขวาง','ดินแดง'],
       NULL, 'ต้นเดือนหน้า', TRUE, TRUE, FALSE, 3, 12,
       'Chinese', 'ผู้จัดการ', 'new', '[DEMO_SEED_EXTRA] Rama 9 2BR family', '[]'::jsonb, v_agent_id)
    RETURNING id, phone
  )
  INSERT INTO lead_locations (lead_id, rank, place_id, name, latitude, longitude, province, district)
  SELECT nl.id, p.rank, NULL, p.name, p.lat, p.lng, 'กรุงเทพมหานคร', p.district
  FROM new_leads nl
  JOIN (VALUES
    ('0800000011', 1, 'BTS อโศก', 13.7367, 100.5605, 'คลองเตย'),
    ('0800000011', 2, 'BTS พร้อมพงษ์', 13.7305, 100.5697, 'วัฒนา'),
    ('0800000012', 1, 'BTS อารีย์', 13.7797, 100.5446, 'พญาไท'),
    ('0800000012', 2, 'อนุสาวรีย์ชัยสมรภูมิ', 13.7628, 100.5372, 'ราชเทวี'),
    ('0800000013', 1, 'MRT พระราม 9', 13.7575, 100.5652, 'ห้วยขวาง'),
    ('0800000013', 2, 'MRT ศูนย์วัฒนธรรมแห่งประเทศไทย', 13.7659, 100.5701, 'ดินแดง')
  ) AS p(phone, rank, name, lat, lng, district) ON p.phone = nl.phone;

  RAISE NOTICE 'Agent demo extra seed OK — agent_id=%, rooms=20, leads=3', v_agent_id;
END $$;

COMMIT;
