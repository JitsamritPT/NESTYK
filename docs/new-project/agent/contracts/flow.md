# Agent contracts — Flow

| | |
|--|--|
| กลับ | [README](./README.md) |
| Leads | [../leads/flow.md](../leads/flow.md) |
| API | [api.md](./api.md) |

---

## 1. ก่อนสัญญา — Leads

10 คนมาดูห้อง → [leads](../leads/flow.md) 10 แถว (`new` … `viewed`)

Agent เลือก 1 คน → **`POST /agent/leads/:id/book`**

- `leads.status = booked`
- สร้าง **`tenants`** (ชื่อ/เบอร์จาก lead)
- `leads.tenant_id = tenants.id`

**Lead แถวนั้นยังอยู่** — ไม่ลบ · มีชื่อ + status booked

---

## 2. เปิดสัญญา

```
Lead (booked) + Tenant
        │
        ▼
room_tenancies (tenant + rent_room, prospect)
        │
        ▼
POST /agent/contracts  →  draft
        │
        ▼
… awaiting_signatures → … → active
        │
        ▼
room_tenancies.status = active
```

Lead อีก 9 คน → `lost` หรือคง `viewed` — ไม่มี tenant

---

## 3. สถานะสัญญา

| ลำดับ | Code |
|------:|------|
| 1 | `draft` |
| 2 | `awaiting_signatures` |
| 3 | `awaiting_agent_review` |
| 4 | `awaiting_payment` |
| 5 | `awaiting_payment_verification` |
| 6 | `active` |

นอกสาย: `cancelled`, `expired`, `terminated`

---

## 4. Tenant → Resident (แอป)

เมื่อ tenant สมัคร/claim บัญชี:

- `tenants.user_id` → `users`
- เพิ่ม role **`tenant`** ใน `user_roles`
- เข้า `/tenant/*` ได้

Lead + Tenant ยังอยู่ — `tenant` เป็น app role ไม่ใช่ตารางแยก
