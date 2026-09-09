# Amenities and nearby places

The shared room wizard follows this order: property, room, facilities, nearby places,
pricing, photos, additional details/documents, and contact. Existing rooms have shortcuts
to facilities, nearby places, and additional details.

## Catalog

Run `migrations/20260909-amenities-catalog.sql` before deploying the updated API.
The local schema installer includes this migration. It is transactional and repeatable.

The NETIQ catalog contains 29 amenities:

| Group code | Count |
| --- | ---: |
| popular | 5 |
| in_room_home | 10 |
| safety_security | 6 |
| services_facilities | 8 |

The migration adds ordering and the extra-charge flag, retains old master IDs, and
moves existing aircon selections to `in_room_home / bed_01` without losing room links.
Unknown legacy amenities remain available. Translations live in i18n, not database columns.
`GET /agent/rooms/facilities` returns code, groupCode, and isExtraCharge.

## Nearby places

`GET /agent/places/nearby?latitude=...&longitude=...&language=th` calls Google Places New
on the server. Six place types use the NETIQ category radii: transit 1 km,
universities/hospitals 2.5 km, malls 3 km, parks 2 km. Results are deduplicated and
limited to 24. Parks require at least 120 ratings.

The client supports category selection and up to five custom pins. Every custom pin
requires a name. `nearbyPlaces` is persisted in `rent_rooms.nearby_places` as JSONB:

```json
{
  "placeId": "custom-example",
  "name": "Nearby market",
  "type": "custom_nearby",
  "latitude": 13.7573,
  "longitude": 100.5018,
  "distanceMeters": 111
}
```

Distance is straight-line distance, recalculated on the server from the room/property
coordinates. Changing the property preserves the pinned locations and recalculates
distances. The separate `nearbyOther` notes remain unchanged unless edited; legacy text
is never converted to fabricated coordinates.

Saving `facilities: []` or `nearbyPlaces: []` explicitly clears the selections.
Omitting either field preserves it when editing. The authenticated room detail endpoint
returns separate catalog selections, custom facilities, and structured nearby places.

## Map configuration

- Backend: `GOOGLE_MAPS_API_KEY` in `.env.api` (Places API New).
- Frontend: `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env` (Maps JavaScript API; native map configuration).
- Never expose the backend key in the frontend. Restart Expo after changing its public key.

## Verification

- `npm run test:room-details --workspace @nestyk/api`
- `node --test packages/feature-listing/test/nearby.test.cjs`
- API TypeScript check: `npx tsc --noEmit -p apps/api/tsconfig.json`

Manual verification covered mobile/web layout, grouped selection, live Google search,
custom pin creation and required names, and form save/reopen. A database integration
check saved/read/cleared selections inside a rollback-only transaction and verified
that the original room was restored.


## Quick creation and later editing

Creation now uses five steps after choosing the contact source: property, basic room information, photos (optional, up to twelve), pricing, and contact. Photos picked during creation are uploaded on submit via `POST /agent/rooms/media/upload` and saved as `room_medias` with the first photo as cover. Room size, floor, building, utility rates, amenities, nearby places, descriptions, availability and documents can be added later through Edit. Pricing retains visible advance-rent and deposit terms so the saved agreement is clear.

Edit opens on a section overview listing all eight sections (property, room details, photos, pricing, amenities, nearby, additional details, contact). Each row shows a completeness status computed from the same validation rules used on save: `complete`, `incomplete` (count of required fields missing), or `not added yet` for optional sections with no data. A banner at the top summarises how many sections still need attention. Tapping a row opens that section alone with its title, a status line listing the missing required fields, and a footer with "Sections" (back to overview) and "Save changes". Saving still validates every section; if another section is invalid the editor jumps to it. Section transitions use a 150 ms fade (react-native-reanimated). Private rooms may have zero photos; published rooms still require at least five (maximum twelve). Empty room size is omitted from the layout rather than stored as an empty value.
