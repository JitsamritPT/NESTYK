# Agent contracts — Database

| | |
|--|--|
| กลับ | [README](./README.md) |
| Leads | [../leads/database.md](../leads/database.md) |
| DDL | [schema.sql](./schema.sql) |

**Prerequisite:** [leads/schema.sql](../leads/schema.sql)

---

## 1. ERD

```
leads (many per room) ──booked──► tenants (1:1 via lead_id)
                                      │
                                 room_tenancies
                                      │
                                 lease_contracts
                                      │
                                 users + tenant role (claim)
```

---

## 2. `tenants` — ผู้เช่าที่ทำสัญญา

| Column | Notes |
|--------|-------|
| `lead_id` | UNIQUE → `leads` — สร้างจาก lead booked เท่านั้น |
| `name`, `phone`, `email` | copy จาก lead ตอน promote (**ชื่ออยู่ทั้ง 2 ตาราง**) |
| `user_id` | NULL จน claim → **tenant** ในแอป |

**ไม่เก็บ** คนที่แค่มาดูห้อง — อยู่ใน `leads` เท่านั้น

---

## 3. `leads` (cross-ref)

หลังทำสัญญา lead ต้นทาง:

| Field | ค่า |
|-------|-----|
| `status` | `booked` |
| `tenant_id` | ชี้ `tenants.id` |
| `name`, `phone` | **ยังอยู่** — ไม่ลบแถว |

---

## 4. `room_tenancies`

| Column | Notes |
|--------|-------|
| `tenant_id` | FK → tenants |
| `rent_room_id` | จาก lead.rent_room_id |
| `status` | `prospect` → `active` เมื่อสัญญา active |

Partial unique: ห้องละ 1 `active`

---

## 5. `lease_contracts`

| Column | Notes |
|--------|-------|
| `room_tenancy_id` | FK หลัก |
| `tenant_id` | denormalize |
| **`lead_id`** | denormalize — อ้าง lead ที่ booked |
| `status` | ดู flow.md |

---

## 6. Promote transaction (`POST .../leads/:id/book`)

```sql
-- 1) tenant
INSERT INTO tenants (lead_id, name, phone, email, created_by_user_id)
SELECT id, name, phone, email, created_by_user_id FROM leads WHERE id = :leadId;

-- 2) lead
UPDATE leads SET status = 'booked', tenant_id = :tenantId WHERE id = :leadId;
```

---

## 7. Create contract transaction

```sql
INSERT INTO room_tenancies (rent_room_id, tenant_id, created_by_user_id)
SELECT l.rent_room_id, l.tenant_id, :agentId
FROM leads l WHERE l.id = :leadId AND l.status = 'booked';

INSERT INTO lease_contracts (room_tenancy_id, rent_room_id, tenant_id, lead_id, ...)
VALUES (...);
```
