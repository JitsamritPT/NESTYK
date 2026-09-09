-- Remove only legacy API-hosted room photos; keep rooms and Supabase images.
DELETE FROM room_medias
WHERE media_url ~ '^https?://[^/]+/api/v1/room-images/[0-9]+/[^/?#]+\.jpg$';
