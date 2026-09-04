-- =============================================================================
-- Portable blueprint — rent_rooms (unified listing table)
-- =============================================================================
-- Docs: docs/new-project/agent/create-room/README.md
--       docs/new-project/agent/create-room/database.md
--
-- Prerequisite: docs/new-project/roles/schema.sql
--
-- Agent scout row: is_scout_room=true, visibility private|published, owner_id NULL
-- Owner row (future): is_scout_room=false, owner_id set, visibility NULL
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS properties (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  category_code VARCHAR(64)  NULL,
  address       TEXT         NOT NULL,
  subdistrict   VARCHAR(255) NOT NULL DEFAULT '-',
  district      VARCHAR(255) NOT NULL,
  province      VARCHAR(255) NOT NULL,
  postal_code   VARCHAR(10)  NOT NULL DEFAULT '-',
  latitude      DECIMAL(10, 7) NULL,
  longitude     DECIMAL(10, 7) NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_name ON properties (name);

CREATE TABLE IF NOT EXISTS property_owners (
  id                 SERIAL PRIMARY KEY,
  name               VARCHAR(255) NOT NULL,
  phone              VARCHAR(50)  NOT NULL,
  email              VARCHAR(255) NULL,
  note               VARCHAR(500) NULL,
  created_by_user_id INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id            INT          NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_property_owners_agent_phone UNIQUE (created_by_user_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_property_owners_created_by_user_id
  ON property_owners (created_by_user_id);

CREATE TABLE IF NOT EXISTS master_room_statuses (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE
);

INSERT INTO master_room_statuses (code)
VALUES ('available'), ('rented'), ('pending_verification'), ('needs_edit')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS master_layouts (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE
);

INSERT INTO master_layouts (code)
VALUES ('bedroom'), ('bathroom'), ('room_size'), ('floor'), ('building')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS master_facilities_groups (
  id   SERIAL PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE
);

INSERT INTO master_facilities_groups (code)
VALUES ('room'), ('building'), ('security')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS master_facilities (
  id       SERIAL PRIMARY KEY,
  group_id INT          NOT NULL REFERENCES master_facilities_groups(id) ON DELETE CASCADE,
  code     VARCHAR(64)  NOT NULL,
  UNIQUE (group_id, code)
);

-- -----------------------------------------------------------------------------
-- rent_rooms — ห้องเดียวกับ Owner listing · แยกด้วย is_scout_room
-- visibility = tag public/private สำหรับ scout (published = public search)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rent_rooms (
  id                     SERIAL PRIMARY KEY,
  room_id                VARCHAR(100) NULL,
  listing_title          VARCHAR(255) NULL,
  listing_description    TEXT         NULL,
  available_from_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
  prices                 JSONB        NULL,
  custom_facilities      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  latitude               DECIMAL(10, 7) NULL,
  longitude              DECIMAL(10, 7) NULL,
  nearby_other           VARCHAR(500) NULL,
  nearby_places          JSONB        NOT NULL DEFAULT '[]'::jsonb,
  water_rate_per_unit    DECIMAL(12, 2) NULL,
  electric_rate_per_unit DECIMAL(12, 2) NULL,
  owner_identity_number  VARCHAR(100) NULL,
  owner_bank_name        VARCHAR(120) NULL,
  owner_bank_account     VARCHAR(30)  NULL,
  is_scout_room          BOOLEAN      NOT NULL DEFAULT FALSE,
  visibility             VARCHAR(20)  NULL,
  created_by_user_id     INT          NULL REFERENCES users(id) ON DELETE SET NULL,
  property_owner_id      INT          NULL REFERENCES property_owners(id) ON DELETE RESTRICT,
  owner_id               INT          NULL REFERENCES users(id) ON DELETE SET NULL,
  properties_id          INT          NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  room_status_id         INT          NOT NULL REFERENCES master_room_statuses(id) ON DELETE RESTRICT,
  view_count             INT          NOT NULL DEFAULT 0,
  last_viewed_at         TIMESTAMPTZ  NULL,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_rent_rooms_visibility
    CHECK (visibility IS NULL OR visibility IN ('private', 'published')),
  CONSTRAINT chk_rent_rooms_scout_invariant CHECK (
    NOT is_scout_room OR (
      created_by_user_id IS NOT NULL
      AND property_owner_id IS NOT NULL
      AND owner_id IS NULL
      AND visibility IN ('private', 'published')
    )
  ),
  CONSTRAINT chk_rent_rooms_owner_invariant CHECK (
    is_scout_room OR (
      owner_id IS NOT NULL
      AND property_owner_id IS NULL
      AND visibility IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_rent_rooms_is_scout_room ON rent_rooms (is_scout_room);
CREATE INDEX IF NOT EXISTS idx_rent_rooms_created_by_user_id ON rent_rooms (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_rent_rooms_owner_id ON rent_rooms (owner_id);
CREATE INDEX IF NOT EXISTS idx_rent_rooms_properties_id ON rent_rooms (properties_id);
CREATE INDEX IF NOT EXISTS idx_rent_rooms_property_owner_id ON rent_rooms (property_owner_id);
CREATE INDEX IF NOT EXISTS idx_rent_rooms_public_scout_listing
  ON rent_rooms (visibility, room_status_id)
  WHERE is_scout_room = TRUE AND visibility = 'published';

CREATE TABLE IF NOT EXISTS room_layout_values (
  id           SERIAL PRIMARY KEY,
  rent_room_id INT          NOT NULL REFERENCES rent_rooms(id) ON DELETE CASCADE,
  layout_id    INT          NOT NULL REFERENCES master_layouts(id) ON DELETE RESTRICT,
  value        VARCHAR(64)  NOT NULL,
  UNIQUE (rent_room_id, layout_id)
);

CREATE TABLE IF NOT EXISTS room_facilities (
  id           SERIAL PRIMARY KEY,
  rent_room_id INT NOT NULL REFERENCES rent_rooms(id) ON DELETE CASCADE,
  group_id     INT NOT NULL REFERENCES master_facilities_groups(id) ON DELETE RESTRICT,
  f_id         INT NOT NULL REFERENCES master_facilities(id) ON DELETE RESTRICT,
  UNIQUE (rent_room_id, f_id)
);

CREATE TABLE IF NOT EXISTS room_medias (
  id          SERIAL PRIMARY KEY,
  rent_id     INT          NOT NULL REFERENCES rent_rooms(id) ON DELETE CASCADE,
  media_url   VARCHAR(500) NOT NULL,
  media_type  VARCHAR(16)  NOT NULL DEFAULT 'image',
  category    VARCHAR(32)  NOT NULL DEFAULT 'room',
  is_cover    BOOLEAN      NOT NULL DEFAULT FALSE,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_room_medias_type CHECK (media_type IN ('image', 'video')),
  CONSTRAINT chk_room_medias_category CHECK (category IN ('room', 'common', 'floorplan'))
);

CREATE INDEX IF NOT EXISTS idx_room_medias_rent_id ON room_medias (rent_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_medias_one_cover
  ON room_medias (rent_id)
  WHERE is_cover = TRUE;

CREATE TABLE IF NOT EXISTS rent_room_documents (
  id         SERIAL PRIMARY KEY,
  rent_id    INT          NOT NULL REFERENCES rent_rooms(id) ON DELETE CASCADE,
  kind       VARCHAR(32)  NOT NULL,
  media_url  VARCHAR(500) NOT NULL,
  sort_order INT          NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_rent_room_documents_kind
    CHECK (kind IN ('id_passport', 'bookbank', 'ownership', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_rent_room_documents_rent_id ON rent_room_documents (rent_id);

COMMIT;
