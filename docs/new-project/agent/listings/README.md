# Agent — Listings (รายการห้อง scout)

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | `blueprint` |
| โหมด | Agent `/agent` |
| รายการ | `/agent/listings` |
| รายละเอียด | `/agent/listings/[id]` |
| แก้ไข | `/agent/listings/edit/[id]` |
| สร้างใหม่ | `/agent/rooms/create` → [create-room pack](../create-room/README.md) |
| Role | `agent` |

Agent ดูและจัดการห้อง scout ที่ตัวเองสร้าง — แถวใน **`rent_rooms`** ที่:

- **`is_scout_room = true`**
- **`created_by_user_id = agent ปัจจุบัน`**

**Prerequisite:** [roles pack](../../roles/README.md) · [create-room/schema.sql](../create-room/schema.sql)

---

## เอกสาร

| ไฟล์ | อ่านเมื่อ |
|------|-----------|
| [flow.md](./flow.md) | list UX, detail, visibility, ลิงก์ leads |
| [api.md](./api.md) | `GET/PATCH /agent/listings` |
| [database.md](./database.md) | query, card fields — ไม่มีตารางใหม่ |

---

## สรุปฟีเจอร์

| ฟีเจอร์ | Route / API |
|---------|-------------|
| รายการห้องของฉัน | `GET /agent/listings` |
| รายละเอียด | `GET /agent/listings/:id` |
| สลับ public/private | `PATCH /agent/listings/:id/visibility` |
| แก้ประกาศ | `PATCH /agent/listings/:id` |
| สร้างห้องใหม่ | `POST /agent/rooms` · [create-room](../create-room/api.md) |
| ดู lead ต่อห้อง | `/agent/leads?rentRoomId=` · [leads pack](../leads/README.md) |

---

## Bootstrap

ไม่มี DDL แยก — ใช้ [create-room/schema.sql](../create-room/schema.sql)

```bash
psql "$DATABASE_URL" -f docs/new-project/roles/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/create-room/schema.sql
```

---

## Pack ที่เกี่ยวข้อง

| Pack | ความสัมพันธ์ |
|------|----------------|
| [dashboard](../dashboard/README.md) | landing หลัง login |
| [create-room](../create-room/README.md) | สร้างห้อง → กลับมา list |
| [leads](../leads/README.md) | lead ผูก `rent_room_id` |
| [contracts](../contracts/README.md) | สัญญาหลัง lead `booked` |
