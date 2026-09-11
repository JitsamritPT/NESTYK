# Agent — สัญญาเช่า (contracts)

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | API รายการ / รายละเอียด / ฉบับร่างพร้อมโค้ดใช้งาน · การลงนามยังเป็น blueprint |
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

## Implementation: tenant-first workspace

The agent tab is now **ผู้เช่า / Clients**. It lists tenants promoted from leads,
including tenants with no contracts. Cards group contracts by tenant ID, support
search/status filters, and show active contracts ending within 30 days. Detail has
Overview and Contracts tabs. Payment data is not available and is not simulated.

Create tenant: select an eligible Lead → confirm name, phone, optional email/note,
and select a managed room → review → save. Saving creates the tenant and links
`leads.tenant_id`, `leads.rent_room_id`, and `leads.status = booked` atomically.
Original Lead contact fields are preserved. Duplicate promotions are rejected under
a Lead row lock. This does not create a contract or activate occupancy.

Tenant API (agent-authenticated and scoped to the current agent):
- `GET /agent/tenants`: tenant cards and their contracts.
- `GET /agent/tenants/:id`: tenant detail.
- `GET /agent/tenants/leads?q=`: up to 30 searchable eligible leads; excludes lost
  leads and leads already linked to tenants.
- `GET /agent/tenants/rooms?q=`: up to 30 searchable rooms managed by this agent.
- `POST /agent/tenants`: `{leadId, rentRoomId, name, phone, email?, note?}`.

Contracts are created inside tenant detail using `GET /agent/contracts`,
`GET /agent/contracts/:id`, and `POST /agent/contracts`. The form uses the selected
tenant's Lead automatically. It requires start/end dates, positive monthly rent,
and non-negative deposit; notes are optional. Creation locks the Lead and room,
rejects overlapping non-closed contracts (including drafts), and writes a prospect
tenancy and draft contract in one transaction. Signing dates come from stored data.

The existing schema above supports this change; no schema migration is required.
The separate `/agent/leads/:id/book` blueprint endpoint remains unimplemented;
the tenant creation endpoint now handles promotion from this workspace.
Document generation, online signature submission/verification, payment transitions,
and draft editing remain future work.

Validation: `npm run test:agent-tenants --workspace=@nestyk/api` covers tenant and
contract validation, promotion/transaction behavior with test doubles, grouping,
access scoping, and HTTP authentication/role checks. It does not replace a full
PostgreSQL integration test. No sample rows are inserted into the live database.

## Agreement type master (2026-09-11)

`master_agreement_types` is the document-type catalog, separate from the existing
`master_contract_types` rental-duration catalog. Initial codes: `reservation`
(สัญญาจองห้อง) and `lease` (สัญญาเช่า). `GET /agent/contracts/types` returns active
rows ordered by `sort_order` then ID; the picker loads this API with loading/error
and retry states. `code` is a stable FK; labels, icons, sorting and activation may
change independently. New categories can reuse `form_kind` reservation/lease;
a genuinely new form needs matching UI/server validation and an extended constraint.

`lease_contracts.agreement_type_code` references the master and defaults existing
records to `lease`. The old duration `contract_type_code` remains unchanged.
Reservation drafts use `start_date`/`end_date` as booking date/expiry and store money
in `reservation_fee`; monthly rent and deposit stay null. The lease flow stores
rent/deposit. A person's reservation does not block that same person's subsequent
lease; conflicting agreements for other tenants remain blocked. A reservation
alone never makes the client status “ผู้เช่าแล้ว”. Signing remains future work.

Migration: `node apps/api/scripts/apply-agreement-types.cjs` (repository root).
Use `--check` to execute then roll back; the migration is idempotent, transactional,
uses configured `DB_SCHEMA`, and has lock/statement timeouts. The master has RLS
and is accessed through the role-guarded server API, not direct client table reads.
