# Agent leads — นัดดูห้องจากหน้าการจับคู่

| | |
|--|--|
| กลับ | [README](./README.md) |
| เกี่ยวข้อง | [match-settings.md](./match-settings.md) · [calendar](../calendar/README.md) |

---

## 1. หน้าจอ

แถบด้านล่างของหน้าห้องที่จับคู่ได้ (tab `leadRoom`) มีปุ่ม **นัดดูห้อง** ปุ่มเดียว (พื้นเหลือง เต็มความกว้าง ไอคอนปฏิทิน)

- ถ้าลีดมีนัดดูห้องนี้ที่ยังไม่ถึงเวลา ปุ่มเปลี่ยนเป็น **"นัดแล้ว · 5 ต.ค. 14:00"** กดแล้วเปิดแผ่นเดิมเพื่อเลื่อนนัด หรือยกเลิก (ยืนยันในแผ่น)
- ลีดที่ `booked` หรือ `lost` ปุ่มถูกปิด
- ดูรายละเอียดห้องยังทำได้จากการแตะรูป และเมนู ⋯ (เปิด modal เต็มจอ)

**แผ่นเลือกเวลา** (ไล่จากบนลงล่าง):

แบบแถวฟอร์ม (แบบหน้าเพิ่มนัดของแอปปฏิทินในระบบ) กางได้ทีละแถว:

1. **วันที่** — แสดง "ส. 4 ต.ค. 2569" กดแล้วกางปฏิทินเต็มเดือน (`react-native-calendars`) ใต้แถว วันที่ผ่านแล้วกดไม่ได้ เลือกแล้วพับเก็บเอง
2. **เวลา** — `@react-native-community/datetimepicker` ทีละ 15 นาที: iOS กางวงล้อใต้แถว · Android เปิดหน้าปัดนาฬิกาของระบบ (ปัดเศษเป็นช่วง 15 นาที) · เว็บกาง `<input type="time">` (`ViewingTimeField.web.tsx`)
3. เวลาที่ผ่านแล้ว: เตือนสีแดง บันทึกไม่ได้ · ห่างจากนัดอื่นในวันเดียวกันไม่ถึง 1 ชั่วโมง: เตือนสีส้ม ยังบันทึกได้
4. **นัดอื่นในวันเดียวกัน** — ดึง `GET /agent/viewings` ของวันที่เลือก (ไม่รวมนัดที่กำลังแก้ และนัดที่ยกเลิก)
5. หมายเหตุ · ปุ่มบันทึก · ลิงก์ยกเลิกนัด (เฉพาะนัดเดิม)

นัดใหม่เริ่มที่ชั่วโมงเต็มถัดไป (เช่น ตอนนี้ 17:20 → 18:00) · เลื่อนนัดเริ่มที่เวลาเดิม

ไฟล์: `LeadRoomActions.tsx` · `LeadViewingSheet.tsx` · `ViewingTimeField.tsx` / `.web.tsx`

---

## 2. ตาราง `lead_viewings`

Migration: `apps/api/migrations/20261002-lead-viewings.sql` · apply: `node apps/api/scripts/apply-lead-viewings.cjs [--check]`

| คอลัมน์ | ชนิด | หมายเหตุ |
|---------|------|----------|
| `id` | serial PK | |
| `lead_id` | int FK `leads` | cascade |
| `rent_room_id` | int FK `rent_rooms` | cascade |
| `created_by_user_id` | int FK `users` | restrict · เจ้าของนัด (agent) |
| `scheduled_at` | timestamptz | |
| `status` | varchar(20) | `scheduled` · `done` · `cancelled` (check) |
| `note` | varchar(500) NULL | |
| `created_at` / `updated_at` | timestamptz | |

Index: `(created_by_user_id, scheduled_at)` สำหรับปฏิทิน · `(lead_id, scheduled_at)` สำหรับรายลีด

**Invariant:** ลีดหนึ่งมีนัด `scheduled` ที่ยังไม่ถึงเวลาได้หนึ่งนัดต่อห้อง — ตรวจใน service ขณะล็อกแถวลีด (ไม่ใช้ unique index เพื่อไม่ให้นัดเก่าที่เลยเวลาแล้วขวางการนัดใหม่)

---

## 3. API (`@Roles('agent')`)

| Method | Path | หมายเหตุ |
|--------|------|----------|
| `POST` | `/agent/leads/:id/viewings` | `{ rentRoomId, scheduledAt, note? }` → `LeadViewing` (201) |
| `GET` | `/agent/leads/:id/viewings` | ทุกนัดของลีด เรียงตามเวลา |
| `GET` | `/agent/viewings?from=&to=` | นัดของ agent ในช่วง (ไม่เกิน 62 วัน) ไม่รวม `cancelled` |
| `PATCH` | `/agent/viewings/:id` | `{ scheduledAt?, status?, note? }` อย่างน้อยหนึ่งฟิลด์ |

Validation (400): `scheduledAt` ต้องเป็นอนาคต (เผื่อ 60 วินาที) และไม่เกินหนึ่งปี · `note` ไม่เกิน 500 ตัวอักษร

| สถานะ | กรณี |
|-------|------|
| 404 | ลีด / ห้อง / นัด ไม่ใช่ของ agent นี้ |
| 409 `LEAD_CLOSED` | ลีด `booked` หรือ `lost` |
| 409 `VIEWING_EXISTS` | มีนัดห้องนี้ที่ยังไม่ถึงเวลาอยู่แล้ว (ส่ง `viewingId` กลับ) |
| 409 `VIEWING_CLOSED` | เลื่อนเวลา / เปลี่ยนสถานะของนัดที่ไม่ใช่ `scheduled` (แก้หมายเหตุได้เสมอ) |

`LeadViewing`: `{ id, leadId, leadName, rentRoomId, roomTitle, roomNumber, scheduledAt, status, note, createdAt }` — `roomTitle` = ชื่อโครงการ หรือชื่อประกาศ หรือ `#id`

---

## 4. ปฏิทิน

เมนูปฏิทินดึง `GET /agent/viewings` ตามเดือนที่แสดง (เผื่อหนึ่งสัปดาห์ก่อนและหลัง) แล้วแสดงเป็นรายการประเภท "นัดดูห้อง" สถานะยืนยันแล้ว ส่วนติดตามลูกค้าและสัญญายังเป็นข้อมูลจำลอง — ดู [calendar](../calendar/README.md)

---

## 5. ทดสอบ

`npm run test:agent-leads` (ใน `apps/api`) รวม `test/lead-viewings.test.cjs`: validation และ HTTP (401 / 403 / 404 / 409 / สร้าง / รายลีด / ตามช่วง / เลื่อน / ยกเลิก)
