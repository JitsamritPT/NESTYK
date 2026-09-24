# Agent leads — Flow

| | |
|--|--|
| กลับ | [README](./README.md) |
| API | [api.md](./api.md) |
| Database | [database.md](./database.md) |

---

## 1. สรุป

Agent บันทึกทุกคนที่สนใจห้องเป็น **lead** — ไม่ต้องรอทำสัญญา  
ตัวอย่าง: ห้อง A มีคนมาดู 10 คน → **`leads` 10 แถว** สถานะต่างกันได้

---

## 2. Status pipeline

| Status | ความหมาย | ใครตั้ง |
|--------|----------|---------|
| `new` | ใหม่ — เพิ่งสร้าง | อัตโนมัติตอนสร้าง |
| `inprogress` | กำลังดูแล | Agent เลือกเอง |
| `lost` | ไม่ไปต่อ | Agent เลือก + เหตุผล |
| `booked` | จองแล้ว — พร้อม/กำลังทำสัญญา | อัตโนมัติเมื่อ promote เป็น tenant |

```
new → inprogress ──→ booked ──→ (สร้าง tenant + สัญญา)
         │              │
         └────→ lost    └── lead ยังอยู่ · status = booked
```

---

## 3. Lead → Tenant (เมื่อทำสัญญา)

**กฎ:** แถว lead **ไม่ลบ** — อัปเดตเป็น `booked` และผูก tenant

```
Lead (inprogress)
    │ Agent กดทำสัญญา / จอง
    ▼
Lead.status = booked
Lead.tenant_id = {new tenant id}
    │
    ▼
INSERT tenants (lead_id, name, phone, …)   ← ชื่ออยู่ทั้ง lead และ tenant
    │
    ▼
POST /agent/contracts (roomTenancyId / จาก tenant)
```

หลัง promote:

| ที่เก็บ | มีชื่อ contact | หมายเหตุ |
|---------|----------------|----------|
| `leads` | ✅ | `status = booked`, `tenant_id` ชี้ tenant |
| `tenants` | ✅ | แถวใหม่ — ลูกบ้นตามสัญญา |

Lead อีก 9 คน → คงเป็น `inprogress` / `lost` — **ไม่มี** แถวใน `tenants`

---

## 4. Lead อื่นในห้องเดียวกัน

เมื่อ lead หนึ่งเป็น `booked` / มีสัญญา active:

- Lead คนอื่น → แนะนำตั้งเป็น `lost` (optional bulk / manual)
- ห้องมี tenant active ได้คนเดียว (ดู contracts pack)

---

## 5. หน้าจอ

| หน้า | Route |
|------|-------|
| รายการ lead ต่อห้อง | `/agent/leads?rentRoomId=` |
| รายการ lead ทั้งหมด | `/agent/leads` |
| สร้าง lead | `/agent/leads/create` |
| รายละเอียด | `/agent/leads/[id]` |
| ทำสัญญา | จาก lead `booked` → `/agent/contracts/create?leadId=` |
