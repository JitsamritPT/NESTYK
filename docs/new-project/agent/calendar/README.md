# Agent — Calendar (UI demo)

เมนู **ปฏิทิน** ใน Consumer App โหมด Agent แสดง UI พร้อมข้อมูลจำลอง ยังไม่มี API หรือฐานข้อมูล

- ปฏิทินรายเดือน เลื่อนเดือน เลือกวัน และกลับวันนี้
- นัดดูห้อง ติดตามลูกค้า และเซ็นสัญญา พร้อมสถานะ
- เริ่มด้วย 3 นัดในวันปัจจุบัน และนัดในวันใกล้เคียง
- เพิ่มนัดจำลองสำหรับวันที่เลือก ตรวจหัวข้อและเวลา `HH:mm`
- เก็บรายการ วันที่ เดือน และร่างฟอร์มในหน่วยความจำของหน้าหลัก สลับเมนูแล้วกลับมาได้ รีโหลด/เริ่มแอปใหม่จะรีเซ็ต
- ใช้ shell เดิม สีเหลืองแบรนด์ และธีมสว่าง/มืด รองรับ TH/EN/ZH/JA

## ไฟล์หลัก

- `apps/consumer-app/components/AgentCalendarScreen.tsx` — UI body
- `apps/consumer-app/lib/agent-calendar-demo.ts` — fixtures และวันที่แบบ local
- `apps/consumer-app/app/index.tsx` — เชื่อมเมนูและเก็บ state
- `packages/i18n/src/locales/*` — `agent.calendar.*`

หน้า web แยกใน `apps/agent` และ role อื่นไม่ได้เปลี่ยนในงานนี้

[Flow](./flow.md) · [API](./api.md)
