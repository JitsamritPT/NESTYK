# Real room photos (local API storage)

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

Files are stored in `.data/room-photos/<agent-id>/<random-uuid>.jpg` at the repository
root, outside Git. `ROOM_PHOTO_DIR` can override this with an absolute persistent
folder. No database migration is needed: room URLs and cover flags use `room_medias`.
Room creation rejects missing, duplicate or other agents' uploaded files.

The image URL uses the upload request's origin by default. If behind a proxy, set
`PUBLIC_API_URL` to the externally accessible API origin **without `/api/v1`**.
The phone's `EXPO_PUBLIC_API_URL` must reach that machine, for example
`http://192.168.1.10:4000/api/v1`; localhost on a physical phone points at the phone.
Restart the API and Expo after installing dependencies. A custom native development
build must be rebuilt to include expo-image-picker; Expo Go SDK 54 includes it.

Local image URLs can be read by anyone possessing the URL (including photos on
private listings). This endpoint is for room photos only, never identity/bank documents.
Keep the storage folder across API restarts/deployments. Files uploaded before an
abandoned/failed save remain on disk; automatic orphan cleanup is not implemented.
Deleting a photo in the wizard removes it from the new listing's payload.

Verification: `npm run test:room-photos --workspace @nestyk/api` starts an isolated
HTTP server and uses a temporary folder. It does not connect to the application DB.
It tests auth, multipart uploads, corrupt/oversize files, retrieval, normalization,
metadata removal, duplicate/foreign/missing URLs and persistence across service instances.

Device acceptance: create a room with five photos, cancel then reopen the picker,
remove/reselect photos, choose a cover, save, and check the cover in My Listings.
Disconnect during upload and retry; completed uploads should be reused.
