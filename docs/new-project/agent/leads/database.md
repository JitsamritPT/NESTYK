# Agent leads — Database

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| **`rent_room_id`** | int → **rent_rooms** | ห้องที่สนใจ (scout หรือ owner listing) |
| `name` | varchar(255) | |
| `phone` | varchar(50) | |
| `email` | varchar(255) NULL | |
| `source` | varchar(64) NULL | |
| **`status`** | varchar(20) | `new` \| `inprogress` \| `viewed` \| `lost` \| `booked` |
| `viewed_at` | timestamptz NULL | |
| `lost_reason` | varchar(500) NULL | |
| `notes` | text NULL | |
| **`tenant_id`** | int → tenants NULL | เมื่อ booked |
| `created_by_user_id` | int → users | agent |

**Prerequisite:** [create-room/schema.sql](../create-room/schema.sql) — ตาราง `rent_rooms`

---

## Query

| ใครดู | เงื่อนไข |
|-------|----------|
| Lead ต่อห้อง | `WHERE rent_room_id = ?` |

Partial unique: `(rent_room_id) WHERE status = 'booked'`

---

ดู [README](./README.md) · [schema.sql](./schema.sql) · lead ↔ tenant ใน [flow.md](./flow.md)
