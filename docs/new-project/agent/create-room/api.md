# Agent create room — API

Base: `/agent/rooms` · role `agent`

---

## `POST /agent/rooms`

สร้างแถว **`rent_rooms`** (`is_scout_room: true`) — ส่งเฉพาะ field ที่มี; server ใส่ discriminator

```json
{
  "visibility": "private",
  "propertyOwnerId": 12,
  "propertyId": 5,
  "listingTitle": "ห้องสวย วิวดี",
  "availableFromDate": "2026-04-01",
  "waterRatePerUnit": 18,
  "electricRatePerUnit": 7,
  "prices": [{ "contractTypeCode": "monthly_12", "price": 12000 }],
  "layout": [{ "code": "bedroom", "value": "1" }],
  "facilities": [],
  "medias": [{ "mediaUrl": "https://...", "category": "room", "isCover": true }]
}
```

**Server defaults**

```json
{
  "isScoutRoom": true,
  "ownerId": null,
  "roomStatusCode": "available",
  "createdByUserId": "<agent>"
}
```

**Response `201`**

```json
{
  "id": 42,
  "propertyId": 5,
  "isScoutRoom": true,
  "visibility": "private"
}
```

**Required validation (Agent)**

- `propertyOwnerId` หรือ `propertyOwner{name,phone}`
- `propertyId` หรือ `property{address,district,province,propertyTypeId}`
- `listingTitle`, `prices`, water/electric > 0
- `medias` ≥ 5 รูป `room`
- `visibility` ∈ `private|published`

Optional: `roomId`, `listingDescription`, layout, facilities, nearby, documents

---

## `PATCH /agent/rooms/:id/visibility`

Deprecated path — ใช้ **`PATCH /agent/listings/:id/visibility`** แทน (ดู [listings/api.md](../listings/api.md))

## Endpoints อื่น

| Method | Path | หมายเหตุ |
|--------|------|----------|
| `GET` | `/agent/listings` | รายการ — ดู [listings/api.md](../listings/api.md) |
| `GET` | `/agent/listings/:id` | รายละเอียด |
| `PATCH` | `/agent/listings/:id/visibility` | สลับ private/published |
| `GET` | `/agent/rooms/properties` | reuse โครงการ (wizard) |
| `GET` | `/agent/rooms/property-types` | master ประเภทอสังหา `{ id, code }` |
| `GET` | `/agent/rooms/property-owners` | picker เจ้าของห้อง |
| `POST` | `/agent/rooms/media/upload` | อัปโหลดรูป |
