# Agent calendar — API (UI demo)

| | |
|--|--|
| กลับ | [README](./README.md) |
| Flow | [flow.md](./flow.md) |

---

## สถานะ

**ยังไม่มี API** — เมนูปฏิทิน Agent ใน Consumer App ใช้ข้อมูลจำลองและ React state เท่านั้น ไม่เรียก backend

---

## อนาคต (draft)

เมื่อเริ่ม implement อาจมีรูปแบบใกล้เคียง:

| Method | Path | หมายเหตุ |
|--------|------|----------|
| `GET` | `/agent/calendar/events` | `?from=&to=` — นัดดูห้อง / follow-up |
| `POST` | `/agent/calendar/events` | สร้างนัด manual |
| `PATCH` | `/agent/calendar/events/:id` | แก้ / ยกเลิก |

หรือ **derive-only** — ไม่มีตาราง events แยก แต่ aggregate จาก `leads.viewed_at`, viewing slots ฯลฯ
