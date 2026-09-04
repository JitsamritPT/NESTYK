# Agent — สัญญาเช่า (contracts)

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | `blueprint` |
| โหมด | Agent `/agent` |
| รายการ | `/agent/contracts` |
| สร้าง | `/agent/contracts/create` |
| Role | `agent` |

**Tenant** = ผู้เช่าที่ทำสัญญา (สร้างจาก [lead booked](../leads/README.md))  
สัญญาอ้าง **`room_tenancies`** + **`lease_contracts`**

**Prerequisite:** [roles](../../roles/README.md) · [create-room](../create-room/README.md) · **[leads](../leads/README.md)**

---

## Lead → Tenant → Contract

```
leads (10 คนดูห้อง)
  └─ 1 คน status = booked + tenant_id
         └─ tenants (ชื่อซ้ำจาก lead)
                └─ room_tenancies → lease_contracts
```

- **Lead ที่ทำสัญญา:** ยังอยู่ใน `leads` · `status = booked` · มีชื่อ contact
- **Tenant:** แถวใหม่ 1:1 กับ lead (`tenants.lead_id`)

---

## เอกสาร

| ไฟล์ | อ่านเมื่อ |
|------|-----------|
| [flow.md](./flow.md) | สร้างจาก lead/tenant, สถานะสัญญา |
| [api.md](./api.md) | endpoints |
| [database.md](./database.md) | tenants, room_tenancies, lease_contracts |
| [schema.sql](./schema.sql) | DDL (หลัง leads/schema.sql) |

---

## Bootstrap

```bash
psql "$DATABASE_URL" -f docs/new-project/roles/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/create-room/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/leads/schema.sql
psql "$DATABASE_URL" -f docs/new-project/agent/contracts/schema.sql
```

---

## คำศัพพ์

| คำ | ตาราง |
|----|--------|
| **Lead** | `leads` — ทุกคนที่มาดู (รวม booked) |
| **Tenant** | `tenants` — เฉพาะคนทำสัญญา |
| **Tenant (app role)** | `users` + role `tenant` — ผู้เช่าที่ claim แอป |
