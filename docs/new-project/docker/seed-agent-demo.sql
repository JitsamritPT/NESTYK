-- =============================================================================
-- Agent demo seed — scout rooms + leads for local / clone DB
-- =============================================================================
-- Prerequisite:
--   ./docs/new-project/docker/apply-schema.sh
--   ./docs/new-project/docker/seed-dev-user.sh
--
-- Owner agent: admin@jitsamrit.com
--   UUID 00000000-0000-4000-8000-000000000001
--
-- Seeds: 10 scout rooms + 6 leads
--
-- Run:
--   psql "$DATABASE_URL" -f docs/new-project/docker/seed-agent-demo.sql
-- Or: ./docs/new-project/docker/seed-agent-demo.sh
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_agent_id INT;
  v_owner1 INT;
  v_owner2 INT;
  v_owner3 INT;
  v_prop1 INT;
  v_prop2 INT;
  v_prop3 INT;
  v_prop4 INT;
  v_prop5 INT;
  v_prop6 INT;
  v_prop7 INT;
  v_prop8 INT;
  v_prop9 INT;
  v_prop10 INT;
  v_status_available INT;
  v_rt_studio INT;
  v_rt_1br INT;
  v_rt_2br INT;
  v_src_co INT;
  v_ct_12 INT;
  v_pt_condo INT;
  v_room1 INT;
  v_room2 INT;
  v_room3 INT;
  v_visa_tourist INT;
BEGIN
  SELECT id INTO v_agent_id FROM users WHERE email = 'admin@jitsamrit.com';
  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'Dev user admin@jitsamrit.com not found — run seed-dev-user.sh first';
  END IF;

  -- Ensure agent role
  INSERT INTO user_roles (user_id, role_id)
  SELECT v_agent_id, r.id
  FROM master_roles r
  WHERE r.name = 'agent'
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_status_available FROM master_room_statuses WHERE code = 'available';
  SELECT id INTO v_rt_studio FROM master_room_types WHERE code = 'studio';
  SELECT id INTO v_rt_1br FROM master_room_types WHERE code = 'one_bedroom';
  SELECT id INTO v_rt_2br FROM master_room_types WHERE code = 'two_bedroom';
  SELECT id INTO v_src_co FROM master_listing_sources WHERE code = 'co_agent';
  SELECT id INTO v_ct_12 FROM master_contract_types WHERE code = 'monthly_12';
  SELECT id INTO v_pt_condo FROM master_property_types WHERE code = 'condo';
  SELECT id INTO v_visa_tourist FROM master_visa_types WHERE code = 'tourist';

  IF v_status_available IS NULL OR v_rt_1br IS NULL OR v_ct_12 IS NULL THEN
    RAISE EXCEPTION 'Master catalog missing — run apply-schema.sh first';
  END IF;

  -- Wipe previous demo rows (idempotent re-seed)
  DELETE FROM leads
  WHERE created_by_user_id = v_agent_id
    AND notes LIKE '%[DEMO_SEED]%';

  DELETE FROM rent_room_prices
  WHERE rent_room_id IN (
    SELECT id FROM rent_rooms WHERE room_id LIKE 'demo-agent-%'
  );

  DELETE FROM rent_rooms
  WHERE room_id LIKE 'demo-agent-%'
    AND created_by_user_id = v_agent_id;

  DELETE FROM properties
  WHERE name LIKE 'DEMO · %';

  DELETE FROM property_owners
  WHERE created_by_user_id = v_agent_id
    AND phone IN ('0811111111', '0822222222', '0833333333');

  -- Property owners (scout contacts)
  INSERT INTO property_owners (name, phone, email, note, created_by_user_id)
  VALUES
    ('คุณสมชาย DEMO', '0811111111', 'somchai.demo@example.com', '[DEMO_SEED] Bangkok owner A', v_agent_id),
    ('คุณมาลี DEMO', '0822222222', 'malee.demo@example.com', '[DEMO_SEED] Bangkok owner B', v_agent_id),
    ('คุณวิชัย DEMO', '0833333333', 'wichai.demo@example.com', '[DEMO_SEED] CNX / outer BKK', v_agent_id);

  SELECT id INTO v_owner1 FROM property_owners WHERE created_by_user_id = v_agent_id AND phone = '0811111111';
  SELECT id INTO v_owner2 FROM property_owners WHERE created_by_user_id = v_agent_id AND phone = '0822222222';
  SELECT id INTO v_owner3 FROM property_owners WHERE created_by_user_id = v_agent_id AND phone = '0833333333';

  -- Properties (1:1 with rooms for variety)
  INSERT INTO properties (
    name, property_type_id, address, subdistrict, district, province, postal_code, latitude, longitude
  ) VALUES
    ('DEMO · The Line Asoke', v_pt_condo, '123 Sukhumvit 21', 'Khlong Toei Nuea', 'Watthana', 'Bangkok', '10110', 13.7382000, 100.5605000),
    ('DEMO · Noble Around Ari', v_pt_condo, '88 Phahonyothin Rd', 'Samsen Nai', 'Phaya Thai', 'Bangkok', '10400', 13.7796000, 100.5446000),
    ('DEMO · Dcondo Nimman', v_pt_condo, '15 Nimmanhaemin Rd', 'Su Thep', 'Mueang Chiang Mai', 'Chiang Mai', '50200', 18.7961000, 98.9676000),
    ('DEMO · Ideo Q Thonglor', v_pt_condo, '55 Sukhumvit 55', 'Khlong Tan Nuea', 'Watthana', 'Bangkok', '10110', 13.7308000, 100.5821000),
    ('DEMO · Rhythm On Nut', v_pt_condo, '99 Sukhumvit 77', 'Suan Luang', 'Suan Luang', 'Bangkok', '10250', 13.7054000, 100.6012000),
    ('DEMO · The Room Phrom Phong', v_pt_condo, '12 Sukhumvit 31', 'Khlong Tan Nuea', 'Watthana', 'Bangkok', '10110', 13.7331000, 100.5698000),
    ('DEMO · Ashton Silom', v_pt_condo, '8 Silom Rd', 'Suriyawong', 'Bang Rak', 'Bangkok', '10500', 13.7264000, 100.5236000),
    ('DEMO · Life Asoke Hype', v_pt_condo, '7 Rama IX Rd', 'Huai Khwang', 'Huai Khwang', 'Bangkok', '10310', 13.7579000, 100.5642000),
    ('DEMO · Aspire Rama 9', v_pt_condo, '33 Rama IX Rd', 'Bang Kapi', 'Huai Khwang', 'Bangkok', '10310', 13.7498000, 100.5945000),
    ('DEMO · Supalai Monte Chiang Mai', v_pt_condo, '21 Chang Khlan Rd', 'Chang Khlan', 'Mueang Chiang Mai', 'Chiang Mai', '50100', 18.7852000, 98.9998000);

  SELECT id INTO v_prop1 FROM properties WHERE name = 'DEMO · The Line Asoke';
  SELECT id INTO v_prop2 FROM properties WHERE name = 'DEMO · Noble Around Ari';
  SELECT id INTO v_prop3 FROM properties WHERE name = 'DEMO · Dcondo Nimman';
  SELECT id INTO v_prop4 FROM properties WHERE name = 'DEMO · Ideo Q Thonglor';
  SELECT id INTO v_prop5 FROM properties WHERE name = 'DEMO · Rhythm On Nut';
  SELECT id INTO v_prop6 FROM properties WHERE name = 'DEMO · The Room Phrom Phong';
  SELECT id INTO v_prop7 FROM properties WHERE name = 'DEMO · Ashton Silom';
  SELECT id INTO v_prop8 FROM properties WHERE name = 'DEMO · Life Asoke Hype';
  SELECT id INTO v_prop9 FROM properties WHERE name = 'DEMO · Aspire Rama 9';
  SELECT id INTO v_prop10 FROM properties WHERE name = 'DEMO · Supalai Monte Chiang Mai';

  -- Scout rooms (10)
  INSERT INTO rent_rooms (
    room_id,
    listing_title,
    listing_description,
    available_from_date,
    prices,
    latitude,
    longitude,
    water_rate_per_unit,
    electric_rate_per_unit,
    advance_rent_months,
    deposit_months,
    is_scout_room,
    visibility,
    created_by_user_id,
    property_owner_id,
    owner_id,
    properties_id,
    room_type_id,
    listing_source_id,
    room_status_id
  ) VALUES
    (
      'demo-agent-1',
      'DEMO · Asoke Studio near BTS',
      'Bright studio, co-agent listing near Asoke. [DEMO_SEED]',
      CURRENT_DATE,
      jsonb_build_array(jsonb_build_object('contractTypeId', v_ct_12, 'price', 18000, 'code', 'monthly_12')),
      13.7382000, 100.5605000, 18, 6, 1, 2, TRUE, 'published',
      v_agent_id, v_owner1, NULL, v_prop1, COALESCE(v_rt_studio, v_rt_1br), v_src_co, v_status_available
    ),
    (
      'demo-agent-2',
      'DEMO · Ari 1BR with pool',
      'One bedroom with building pool access. [DEMO_SEED]',
      CURRENT_DATE + 7,
      jsonb_build_array(jsonb_build_object('contractTypeId', v_ct_12, 'price', 26000, 'code', 'monthly_12')),
      13.7796000, 100.5446000, 20, 7, 1, 2, TRUE, 'published',
      v_agent_id, v_owner2, NULL, v_prop2, v_rt_1br, v_src_co, v_status_available
    ),
    (
      'demo-agent-3',
      'DEMO · Nimman 2BR private',
      'Private scout listing — not on guest search. [DEMO_SEED]',
      CURRENT_DATE + 14,
      jsonb_build_array(jsonb_build_object('contractTypeId', v_ct_12, 'price', 22000, 'code', 'monthly_12')),
      18.7961000, 98.9676000, 15, 5, 1, 1, TRUE, 'private',
      v_agent_id, v_owner3, NULL, v_prop3, COALESCE(v_rt_2br, v_rt_1br), v_src_co, v_status_available
    ),
    (
      'demo-agent-4',
      'DEMO · Thonglor 1BR loft',
      'Loft-style 1BR steps from Ekkamai. [DEMO_SEED]',
      CURRENT_DATE + 3,
      jsonb_build_array(jsonb_build_object('contractTypeId', v_ct_12, 'price', 32000, 'code', 'monthly_12')),
      13.7308000, 100.5821000, 22, 8, 1, 2, TRUE, 'published',
      v_agent_id, v_owner1, NULL, v_prop4, v_rt_1br, v_src_co, v_status_available
    ),
    (
      'demo-agent-5',
      'DEMO · On Nut Studio value',
      'Affordable studio near Airport Link. [DEMO_SEED]',
      CURRENT_DATE + 10,
      jsonb_build_array(jsonb_build_object('contractTypeId', v_ct_12, 'price', 14000, 'code', 'monthly_12')),
      13.7054000, 100.6012000, 16, 5, 1, 1, TRUE, 'published',
      v_agent_id, v_owner2, NULL, v_prop5, COALESCE(v_rt_studio, v_rt_1br), v_src_co, v_status_available
    ),
    (
      'demo-agent-6',
      'DEMO · Phrom Phong 2BR family',
      'Spacious 2BR for couple / small family. [DEMO_SEED]',
      CURRENT_DATE + 5,
      jsonb_build_array(jsonb_build_object('contractTypeId', v_ct_12, 'price', 45000, 'code', 'monthly_12')),
      13.7331000, 100.5698000, 25, 8, 2, 2, TRUE, 'published',
      v_agent_id, v_owner1, NULL, v_prop6, COALESCE(v_rt_2br, v_rt_1br), v_src_co, v_status_available
    ),
    (
      'demo-agent-7',
      'DEMO · Silom 1BR CBD',
      'City-view 1BR near BTS Sala Daeng. [DEMO_SEED]',
      CURRENT_DATE + 2,
      jsonb_build_array(jsonb_build_object('contractTypeId', v_ct_12, 'price', 28000, 'code', 'monthly_12')),
      13.7264000, 100.5236000, 20, 7, 1, 2, TRUE, 'published',
      v_agent_id, v_owner2, NULL, v_prop7, v_rt_1br, v_src_co, v_status_available
    ),
    (
      'demo-agent-8',
      'DEMO · Asoke Hype Studio',
      'New studio near MRT Rama 9 / Central. [DEMO_SEED]',
      CURRENT_DATE + 1,
      jsonb_build_array(jsonb_build_object('contractTypeId', v_ct_12, 'price', 21000, 'code', 'monthly_12')),
      13.7579000, 100.5642000, 18, 6, 1, 2, TRUE, 'published',
      v_agent_id, v_owner3, NULL, v_prop8, COALESCE(v_rt_studio, v_rt_1br), v_src_co, v_status_available
    ),
    (
      'demo-agent-9',
      'DEMO · Rama 9 1BR private',
      'Private listing near Airport Link Makkasan. [DEMO_SEED]',
      CURRENT_DATE + 21,
      jsonb_build_array(jsonb_build_object('contractTypeId', v_ct_12, 'price', 24000, 'code', 'monthly_12')),
      13.7498000, 100.5945000, 18, 6, 1, 2, TRUE, 'private',
      v_agent_id, v_owner3, NULL, v_prop9, v_rt_1br, v_src_co, v_status_available
    ),
    (
      'demo-agent-10',
      'DEMO · Night Bazaar 2BR',
      'Chiang Mai 2BR near Night Bazaar / Ping River. [DEMO_SEED]',
      CURRENT_DATE + 30,
      jsonb_build_array(jsonb_build_object('contractTypeId', v_ct_12, 'price', 19000, 'code', 'monthly_12')),
      18.7852000, 98.9998000, 15, 5, 1, 1, TRUE, 'published',
      v_agent_id, v_owner3, NULL, v_prop10, COALESCE(v_rt_2br, v_rt_1br), v_src_co, v_status_available
    );

  SELECT id INTO v_room1 FROM rent_rooms WHERE room_id = 'demo-agent-1';
  SELECT id INTO v_room2 FROM rent_rooms WHERE room_id = 'demo-agent-2';
  SELECT id INTO v_room3 FROM rent_rooms WHERE room_id = 'demo-agent-3';

  INSERT INTO rent_room_prices (rent_room_id, contract_type_id, price)
  SELECT r.id, v_ct_12,
    CASE r.room_id
      WHEN 'demo-agent-1' THEN 18000
      WHEN 'demo-agent-2' THEN 26000
      WHEN 'demo-agent-3' THEN 22000
      WHEN 'demo-agent-4' THEN 32000
      WHEN 'demo-agent-5' THEN 14000
      WHEN 'demo-agent-6' THEN 45000
      WHEN 'demo-agent-7' THEN 28000
      WHEN 'demo-agent-8' THEN 21000
      WHEN 'demo-agent-9' THEN 24000
      WHEN 'demo-agent-10' THEN 19000
    END
  FROM rent_rooms r
  WHERE r.room_id LIKE 'demo-agent-%'
    AND r.created_by_user_id = v_agent_id
  ON CONFLICT (rent_room_id, contract_type_id) DO UPDATE
  SET price = EXCLUDED.price;

  -- Leads (pipeline demo — still tied to rooms 1–3)
  INSERT INTO leads (
    rent_room_id,
    name,
    phone,
    email,
    source,
    desired_room_type_id,
    budget_min,
    budget_max,
    province,
    locations,
    preferred_location,
    move_in_plan,
    has_pets,
    uses_car,
    is_smoker,
    occupant_count,
    lease_duration_months,
    visa_type_id,
    status,
    notes,
    created_by_user_id
  ) VALUES
    (
      v_room1,
      'Ananya Wong',
      '0800000001',
      'ananya.demo@example.com',
      'facebook',
      COALESCE(v_rt_studio, v_rt_1br),
      15000,
      20000,
      'Bangkok',
      ARRAY['Watthana', 'Khlong Toei'],
      'Near Asoke BTS',
      'This month',
      FALSE,
      FALSE,
      FALSE,
      1,
      12,
      NULL,
      'new',
      '[DEMO_SEED] Hot lead for Asoke studio',
      v_agent_id
    ),
    (
      v_room1,
      'James Miller',
      '0800000002',
      'james.demo@example.com',
      'line',
      COALESCE(v_rt_studio, v_rt_1br),
      16000,
      22000,
      'Bangkok',
      ARRAY['Watthana'],
      'Asoke / Terminal 21 area',
      'Next week',
      FALSE,
      TRUE,
      FALSE,
      1,
      12,
      v_visa_tourist,
      'inprogress',
      '[DEMO_SEED] Viewing scheduled',
      v_agent_id
    ),
    (
      v_room2,
      'Pimchanok S.',
      '0800000003',
      'pim.demo@example.com',
      'walk_in',
      v_rt_1br,
      24000,
      30000,
      'Bangkok',
      ARRAY['Phaya Thai'],
      'Ari / Sanam Pao',
      'October',
      TRUE,
      FALSE,
      FALSE,
      2,
      12,
      NULL,
      'viewed',
      '[DEMO_SEED] Already viewed Ari 1BR',
      v_agent_id
    ),
    (
      v_room2,
      'Kenji Sato',
      '0800000004',
      'kenji.demo@example.com',
      'co_agent',
      v_rt_1br,
      25000,
      28000,
      'Bangkok',
      ARRAY['Phaya Thai'],
      'Near Ari BTS',
      'Flexible',
      FALSE,
      FALSE,
      FALSE,
      1,
      6,
      NULL,
      'new',
      '[DEMO_SEED] Co-broke inquiry',
      v_agent_id
    ),
    (
      NULL,
      'Somying Open',
      '0800000005',
      NULL,
      'phone',
      v_rt_2br,
      18000,
      25000,
      'Chiang Mai',
      ARRAY['Mueang Chiang Mai'],
      'Nimman / Downtown',
      'Immediately',
      FALSE,
      TRUE,
      FALSE,
      2,
      12,
      NULL,
      'new',
      '[DEMO_SEED] Lead without room yet',
      v_agent_id
    ),
    (
      v_room3,
      'Lost Lead Demo',
      '0800000006',
      'lost.demo@example.com',
      'facebook',
      COALESCE(v_rt_2br, v_rt_1br),
      20000,
      24000,
      'Chiang Mai',
      ARRAY['Mueang Chiang Mai'],
      'Nimman',
      'Was urgent',
      FALSE,
      FALSE,
      TRUE,
      1,
      12,
      NULL,
      'lost',
      '[DEMO_SEED] Chose another agent',
      v_agent_id
    );

  RAISE NOTICE 'Agent demo seed OK — agent_id=%, rooms=10, leads=6', v_agent_id;
END $$;

COMMIT;
