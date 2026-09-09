# Agent listings — Database

| | |
|--|--|
| กลับ | [README](./README.md) |
| DDL | [create-room/schema.sql](../create-room/schema.sql) |
| Column catalog | [create-room/database.md](../create-room/database.md) |

**ไม่มีตารางใหม่** — listings อ่านจาก **`rent_rooms`** + join ที่มีอยู่แล้วใน create-room pack

---

## 1. Query หลัก (list)

```sql
SELECT room.*
FROM rent_rooms room
INNER JOIN properties property ON property.id = room.properties_id
LEFT JOIN property_owners po ON po.id = room.property_owner_id
WHERE room.is_scout_room = TRUE
  AND room.created_by_user_id = :agent_user_id
  -- optional: AND room.visibility = :visibility
  -- optional: AND (
  --   property.name ILIKE :q OR room.listing_title ILIKE :q
  --   OR po.name ILIKE :q OR po.phone ILIKE :q
  -- )
ORDER BY room.id DESC
LIMIT :limit OFFSET :offset;
```

---

## 2. Query รายละเอียด

```sql
SELECT room.*
FROM rent_rooms room
WHERE room.id = :id
  AND room.is_scout_room = TRUE
  AND room.created_by_user_id = :agent_user_id;
```

Load relations: `properties`, `property_owners`, `room_medias`, `room_layout_values`, `room_facilities`, `rent_room_documents`

---

## 3. Fields บนการ์ด list (UI)

| Field | แหล่ง |
|-------|--------|
| Cover | `room_medias` WHERE `is_cover = true` · fallback รูปแรก |
| Title | `rent_rooms.listing_title` |
| Property name | `properties.name` |
| District / province | `properties.district`, `properties.province` |
| Price | `rent_rooms.prices[0].price` (display ตาม contract type หลัก) |
| Visibility badge | `rent_rooms.visibility` |
| Status | `master_room_statuses.code` via `room_status_id` |
| Owner contact | `property_owners.name` |
| Lead count (opt) | `COUNT(leads)` WHERE `rent_room_id = room.id` |

---

## 4. Fields บน detail

ครบตาม [create-room/database.md §4](../create-room/database.md#4-column-catalog-ครบทุก-field) + child tables

---

## 5. Visibility update

```sql
UPDATE rent_rooms
SET visibility = :visibility,
    updated_at = NOW()
WHERE id = :id
  AND is_scout_room = TRUE
  AND created_by_user_id = :agent_user_id;
```

---

## 6. Index ที่ใช้

| Index | ใช้เมื่อ |
|-------|----------|
| `idx_rent_rooms_is_scout_room` | filter scout |
| `idx_rent_rooms_created_by_user_id` | filter agent |
| `idx_rent_rooms_public_scout_listing` | Guest search (`published`) |

---

## 7. สิทธิ์ vs query อื่น

| ใครดู | เงื่อนไข |
|-------|----------|
| Agent listings (pack นี้) | `is_scout_room = true AND created_by_user_id = me` |
| Guest public search | `is_scout_room = true AND visibility = 'published' AND status = available` |
| Owner listings (อนาคต) | `is_scout_room = false AND owner_id = me` |
