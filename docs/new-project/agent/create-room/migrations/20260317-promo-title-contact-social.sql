-- Agent listing promo title (public share) + contact social channels
-- Apply: psql "$DATABASE_URL" -f docs/new-project/agent/create-room/migrations/20260317-promo-title-contact-social.sql

ALTER TABLE rent_rooms
  ADD COLUMN IF NOT EXISTS promo_title VARCHAR(255) NULL;

COMMENT ON COLUMN rent_rooms.listing_title IS 'Agent-only internal listing name';
COMMENT ON COLUMN rent_rooms.promo_title IS 'Public listing headline for share / marketplace';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS line_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS facebook VARCHAR(255) NULL;
