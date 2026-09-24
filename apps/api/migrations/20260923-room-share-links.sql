CREATE TABLE IF NOT EXISTS room_share_links (
  id serial PRIMARY KEY,
  rent_room_id int NOT NULL REFERENCES rent_rooms (id) ON DELETE CASCADE,
  created_by_user_id int NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  token_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  share_sections jsonb NOT NULL,
  contact_id int NULL REFERENCES contacts (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_room_share_links_token_hash UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS idx_room_share_links_rent_room
  ON room_share_links (rent_room_id);
