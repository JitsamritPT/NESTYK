# Agent listings — API

| | |
|--|--|
| กลับ | [README](./README.md) |
| Flow | [flow.md](./flow.md) |
| Database | [database.md](./database.md) |

Base: `/agent/listings` · Auth: Bearer JWT + role `agent`

**Scope:** อ่าน/แก้ scout room ที่ `created_by_user_id = agent` เท่านั้น

สร้างห้องใหม่ → [create-room/api.md](../create-room/api.md) (`POST /agent/rooms`)

---

## `GET /agent/listings`

รายการห้อง scout ของ agent

**Query**

| Param | Type | หมายเหตุ |
|-------|------|----------|
| `page` | int | default `1` |
| `limit` | int | default `20` · max `50` |
| `q` | string | ค้นหา property name · listing title · property owner name/phone |
| `visibility` | `private` \| `published` | optional filter |

**Server filter (บังคับ)**

```
is_scout_room = true
AND created_by_user_id = :currentAgentId
```

**Response `200`**

```json
{
  "items": [
    {
      "id": 42,
      "listingTitle": "ห้องสวย วิวดี",
      "visibility": "private",
      "isScoutRoom": true,
      "roomStatusCode": "available",
      "property": {
        "id": 5,
        "name": "ลุมพินี พาร์ค",
        "district": "พญาไท",
        "province": "กรุงเทพมหานคร"
      },
      "propertyOwner": {
        "id": 12,
        "name": "คุณสมชาย",
        "phone": "0812345678"
      },
      "prices": [{ "contractTypeCode": "monthly_12", "price": 12000 }],
      "coverMediaUrl": "https://...",
      "leadCount": 3
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

`leadCount` optional — aggregate จาก `leads` ที่ `rent_room_id = id`

---

## `GET /agent/listings/:id`

รายละเอียดห้อง scout — 403/404 ถ้าไม่ใช่ของ agent หรือไม่ใช่ scout

**Response `200`**

```json
{
  "id": 42,
  "listingTitle": "ห้องสวย วิวดี",
  "listingDescription": "...",
  "visibility": "published",
  "isScoutRoom": true,
  "roomStatusCode": "available",
  "availableFromDate": "2026-04-01",
  "waterRatePerUnit": 18,
  "electricRatePerUnit": 7,
  "prices": [{ "contractTypeCode": "monthly_12", "price": 12000 }],
  "property": { "id": 5, "name": "...", "address": "..." },
  "propertyOwner": { "id": 12, "name": "...", "phone": "..." },
  "layout": [{ "code": "bedroom", "value": "1" }],
  "facilities": [],
  "medias": [{ "mediaUrl": "...", "category": "room", "isCover": true, "sortOrder": 0 }],
  "documents": [],
  "nearbyPlaces": [],
  "viewCount": 0,
  "createdAt": "2026-03-01T10:00:00Z"
}
```

---

## `PATCH /agent/listings/:id/visibility`

สลับ tag public/private

```json
{ "visibility": "published" }
```

**Validation**

- `visibility` ∈ `private` | `published`
- room ต้อง `is_scout_room = true` และเป็นของ agent

**Response `200`**

```json
{ "id": 42, "visibility": "published" }
```

---

## `PATCH /agent/listings/:id`

แก้ประกาศ scout (partial update)

```json
{
  "listingTitle": "ห้องใหม่ ราคาพิเศษ",
  "prices": [{ "contractTypeCode": "monthly_12", "price": 11500 }],
  "visibility": "private",
  "propertyOwnerId": 12
}
```

**ห้าม** ส่ง `isScoutRoom`, `ownerId`, `createdByUserId`

**Response `200`:** body เหมือน `GET /agent/listings/:id`

---

## Endpoints ที่เกี่ยวข้อง (create-room pack)

| Method | Path | ใช้เมื่อ |
|--------|------|----------|
| `POST` | `/agent/rooms` | สร้างห้องใหม่ |
| `POST` | `/agent/rooms/media/upload` | อัปโหลดรูปใน wizard |
| `GET` | `/agent/rooms/property-owners` | picker เจ้าของห้อง |
| `GET` | `/agent/rooms/properties` | reuse โครงการ |

---

## Errors

| Code | กรณี |
|------|------|
| 401 | ไม่มี JWT |
| 403 | ไม่มี role `agent` |
| 404 | ไม่พบห้อง / ไม่ใช่ scout / ไม่ใช่ของ agent |
| 400 | visibility ไม่ถูกต้อง |
