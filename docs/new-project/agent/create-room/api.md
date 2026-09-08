# Agent create room — API

Base: `/agent/rooms` · role `agent`

---

## `POST /agent/rooms`

สร้างแถว **`rent_rooms`** (`is_scout_room: true`) — ส่งเฉพาะ field ที่มี; server ใส่ discriminator

```json
{
  "visibility": "private",
  "contactId": 12,
  "propertyId": 5,
  "listingTitle": "ห้องสวย วิวดี",
  "listingSourceCode": "co_agent",
  "roomTypeId": 2,
  "availableFromDate": "2026-04-01",
  "waterRatePerUnit": 18,
  "electricRatePerUnit": 7,
  "prices": [{ "contractTypeId": 1, "price": 12000 }],
  "layout": [
    { "code": "bedroom", "value": "1" },
    { "code": "bathroom", "value": "1" }
  ],
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
  "contactId": 12,
  "isScoutRoom": true,
  "visibility": "private"
}
```

**Required validation (Agent)**

- `contactId` หรือ `contact{name,phone}` — ผู้ติดต่อของห้อง (ไม่ใช่เจ้าของห้องจริง)
- `propertyId` หรือ `property{address,district,province,propertyTypeId}`
- `listingTitle`, `listingSourceCode` (`co_agent` | `owner`), `roomTypeId` (`GET /agent/rooms/room-types`), `prices` (`contractTypeId` จาก `GET /agent/rooms/contract-types`)
- `layout` ต้องมี `bedroom` และ `bathroom` (ตัวเลข ≥ 0)
- `medias` ≥ 5 รูป `room`
- `visibility` ∈ `private|published`

Optional: `roomId`, `listingDescription`, water/electric, facilities, nearby, documents

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
| `GET` | `/agent/rooms/room-types` | master ประเภทห้อง `{ id, code, bedroomCount }` |
| `GET` | `/agent/rooms/contract-types` | master ประเภทสัญญา `{ id, code, termMonths }` |
| `GET` | `/agent/rooms/contacts` | picker ผู้ติดต่อ |
| `GET` | `/agent/rooms/property-owners` | เจ้าของห้องจริง — ใช้ตอนทำสัญญา |
| `POST` | `/agent/rooms/media/upload` | อัปโหลดรูป |
