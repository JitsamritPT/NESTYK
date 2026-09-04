# Agent — Calendar (placeholder)

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | `placeholder` — ยังไม่ implement ฟีเจอร์ |
| โหมด | Agent `/agent` |
| หน้า | `/agent/calendar` |
| Role | `agent` |

เมนู **Calendar** ใน nav agent — ตอนนี้เป็น **หน้าเปล่า** (empty / coming soon) ยังไม่มี API · DB · business logic

**Prerequisite:** [roles pack](../../roles/README.md)

---

## เอกสาร

| ไฟล์ | อ่านเมื่อ |
|------|-----------|
| [flow.md](./flow.md) | placeholder UX, nav, อนาคต |
| [api.md](./api.md) | ยังไม่มี endpoint |

---

## สรุป (ปัจจุบัน)

| ส่วน | สถานะ |
|------|--------|
| Route + nav item | ✅ blueprint |
| หน้า UI | Empty state เท่านั้น |
| API | ❌ ยังไม่มี |
| Database | ❌ ยังไม่มี |

---

## Navigation (agent)

| ลำดับ | เมนู | Route |
|------:|------|-------|
| 1 | Dashboard | `/agent/dashboard` |
| 2 | Listings | `/agent/listings` |
| 3 | Create room | `/agent/rooms/create` |
| 4 | Leads | `/agent/leads` |
| 5 | **Calendar** | `/agent/calendar` |
| 6 | Contracts | `/agent/contracts` |

---

## อนาคต (ไม่ใช่ scope ตอนนี้)

- นัดดูห้อง / follow-up lead
- ปฏิทินรวม lead `viewed_at` · สัญญา milestone
- อาจใช้ lib มาตรฐาน (เช่น `react-native-calendars` — มี pattern ใน `AppDateField`)
