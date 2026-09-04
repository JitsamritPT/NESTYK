# Agent — สร้างห้อง (create room)

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | `blueprint` |
| โหมด | Agent `/agent` |
| ตารางหลัก | **`rent_rooms`** (ร่วมกับ Owner listing ในอนาคต) |
| สร้าง | `/agent/rooms/create` |
| Role | `agent` |

Agent สร้างห้อง scout → แถวใน **`rent_rooms`** โดย:

- **`is_scout_room = true`** — แยกจากห้อง Owner จริง
- **`visibility`** — `private` (agent เท่านั้น) หรือ `published` (public search)
- **`owner_id = NULL`** · **`property_owner_id`** → contact เจ้าของห้องจริง

**กรอกเฉพาะ field ที่จำเป็น** — column อื่น nullable / default · ดู [database.md § Required](./database.md#3-rent_rooms--required-vs-optional-agent-create)

**Prerequisite:** [roles pack](../../roles/README.md)

---

## เอกสาร

| ไฟล์ | อ่านเมื่อ |
|------|-----------|
| [flow.md](./flow.md) | wizard, visibility, discriminator |
| [api.md](./api.md) | `POST /agent/rooms` |
| [database.md](./database.md) | column catalog ครบ + invariant |
| [schema.sql](./schema.sql) | DDL `rent_rooms` + child tables |

---

## Unified table (อนาคต)

| | **Agent scout** | **Owner listing** |
|--|-----------------|-------------------|
| ตาราง | `rent_rooms` | `rent_rooms` |
| `is_scout_room` | `true` | `false` |
| `visibility` | `private` / `published` | `NULL` |
| `owner_id` | `NULL` | owner user id |
| `property_owner_id` | ✅ | `NULL` |
| `created_by_user_id` | agent | `NULL` |

---

## Bootstrap

```bash
psql "$DATABASE_URL" -f docs/new-project/roles/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/create-room/schema.sql
```

---

## Pack ถัดไป

- [listings](../listings/README.md) — รายการห้อง scout หลังสร้าง
- [leads](../leads/README.md) — `leads.rent_room_id`
- [contracts](../contracts/README.md) — tenant + สัญญา

ใช้ตาราง **`rent_rooms`** ร่วมกับ Owner listing ในอนาคต — ไม่แยก `scout_rooms`
