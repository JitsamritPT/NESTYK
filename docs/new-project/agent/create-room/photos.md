# Real room photos (Supabase Storage)

The agent mobile wizard selects 5–12 photos from the device library, previews them,
allows removal and makes the tapped image the cover. It uploads at final submission,
then sends the returned URLs to `POST /api/v1/agent/rooms`. Successful uploads are
reused on retry while the wizard stays open. Cancelling the system picker changes nothing.

`POST /api/v1/agent/rooms/media/upload` accepts multipart field `file`, requires
an authenticated agent, and limits each file to 10 MiB. The API decodes the image,
limits input to 40 megapixels, removes metadata/GPS, corrects orientation and writes
a JPEG with longest edge at most 2400 pixels. JPEG, PNG and WebP are supported;
HEIF/AVIF decoding depends on the installed Sharp codecs. The iOS picker requests
compatible representations. Corrupt, animated and non-image files are rejected.

New files are stored in Supabase Storage at
`<SUPABASE_BUCKET_PROPERTIES>/<agent-id>/<random-uuid>.jpg` (default bucket:
`property-images`). Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in
root `.env.api`; the service role key must stay on the API server. Like NETIQ, the API automatically creates a missing public bucket on first upload,
allowing `image/jpeg` up to 10 MiB. Existing buckets retain their settings and must
be public. Failed initialization is retried on the next upload. NESTYK keeps its
`property-images` bucket and agent/UUID paths so existing photo URLs remain valid.
Client uploads still pass through the authenticated agent API; no anonymous write
policy is needed. Missing configuration or failed uploads return 503, without a
local-disk fallback. Restart the API after changing configuration.

The returned `mediaUrl` is the Supabase public URL. No database migration is needed:
room URLs and cover flags use `room_medias`. Saving verifies that every cloud photo
exists and belongs to the current agent's folder, rejecting duplicates and foreign URLs.
Supabase images are public, including photos attached to private listings; this
bucket must never hold identity, bank or ownership documents.

Legacy local photo serving has been removed. Delete old local references using
`migrations/20260909-remove-local-room-photos.sql`, then remove `.data/room-photos`.
Rooms without photos remain in the listings with no cover image.
Abandoned Supabase uploads are not automatically cleaned up.

Verification: `npm run test:room-photos --workspace @nestyk/api` runs the real
multipart API with an in-memory Supabase storage test double . It checks auth, corrupt/oversize files, image normalization, cloud URLs,
ownership, duplicates, missing objects, storage failures and rejection of legacy URLs.
It does not connect to the application DB or a live Supabase project.

Device acceptance: create a room with five photos, cancel then reopen the picker,
remove/reselect photos, choose a cover, save, and check the cover in My Listings.
Disconnect during upload and retry; completed uploads should be reused.
