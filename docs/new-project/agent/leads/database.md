# Agent leads — Database

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| **`rent_room_id`** | int → **rent_rooms** | NULL ได้ — เก็บ Lead ก่อนเลือกห้อง และตั้ง NULL หากห้องถูกลบ |
| `name` | varchar(255) | |
| `phone` | varchar(50) | |
| `email` | varchar(255) NULL | |
| `source` | varchar(64) NULL | ที่มาของ Lead เช่น Facebook / walk-in |
| `desired_room_type_id` | int → master_room_types NULL | ประเภทห้องที่ต้องการ เช่น studio / one_bedroom |
| `budget_min` | decimal(12,2) NULL | งบต่ำสุด บาท/เดือน |
| `budget_max` | decimal(12,2) NULL | งบสูงสุด บาท/เดือน |
| `other_contacts` | jsonb default [] | ช่องทางอื่นหลายช่องทาง เช่น `[ {"channel":"line","value":"@example"} ]` |
| **`status`** | varchar(20) | `new` \| `inprogress` \| `viewed` \| `lost` \| `booked` |
| `viewed_at` | timestamptz NULL | |
| `lost_reason` | varchar(500) NULL | |
| `notes` | text NULL | |
| **`tenant_id`** | int → tenants NULL | เมื่อ booked |
| `created_by_user_id` | int → users | agent |

**Prerequisite:** [create-room/schema.sql](../create-room/schema.sql) — ตาราง `rent_rooms`

---

## Query

| ใครดู | เงื่อนไข |
|-------|----------|
| Lead ต่อห้อง | `WHERE rent_room_id = ?` |

Partial unique: `(rent_room_id) WHERE status = 'booked'`

---

ดู [README](./README.md) · [schema.sql](./schema.sql) · lead ↔ tenant ใน [flow.md](./flow.md)

## Room seekers (2026-09-08)

A lead can be created before selecting a room: `rent_room_id = NULL`. Name, phone
and the agent (`created_by_user_id`) remain required. Preference fields can be
filled as the requirements become known. A single budget can use `budget_max`;
a range uses both fields. Amounts are monthly THB. Negative amounts, a zero maximum,
NaN and a minimum greater than the maximum are rejected by the database.
`other_contacts` must be a JSON array; API validation should enforce nonblank
`channel` and `value` on each entry when the Leads API is implemented.

Existing databases: apply [migration](./migrations/20260908-room-seeker-preferences.sql).
The standard Docker schema script includes it. The migration is repeatable and keeps
existing lead data. Removing a linked room no longer deletes the person's lead.
When booking, the future Leads API must require a selected room.

Create Lead, Listing Lead and read-only lead details are now available in the agent mobile Leads tab.


## Full profile (2026-09-08)

Only name and phone are mandatory. Existing budget fields and desired room type are reused.

| User field | Database column | Format |
|---|---|---|
| ชื่อ * | name | required text |
| เบอร์ติดต่อ * | phone | required text |
| สัญชาติ | nationality | optional text |
| งบประมาณ | budget_min / budget_max | existing monthly THB range |
| โลเคชั่นที่สนใจ | preferred_location | optional free text, one or more areas |
| แพลนย้ายเข้า | move_in_plan | optional text: immediately, month or exact date |
| เลี้ยงสัตว์ | has_pets | nullable boolean |
| อาชีพ | occupation | optional text |
| ประเภทวีซ่า (เฉพาะต่างชาติ) | visa_type_id | optional FK → master_visa_types |
| ระยะเวลาเช่า | lease_duration_months | 3 / 6 / 12 months from master_contract_types |
| ใช้รถ | uses_car | nullable boolean |
| จำนวนผู้พักอาศัย | occupant_count | positive whole number |
| สูบบุหรี่ | is_smoker | nullable boolean |
| ประเภทห้อง | desired_room_type_id | existing room-type foreign key |

NULL boolean values mean not yet specified, never an implicit No.
Apply [profile migration](./migrations/20260908-lead-profile.sql) after the preference migration.

Visa types are a master catalog (`master_visa_types`, codes only). Labels use
`masters.visaTypes.<code>`. Existing databases: apply
[visa-type migration](./migrations/20260908-master-visa-types.sql) after the
profile migration. Rental duration must match an active `master_contract_types.term_months`.

API (authenticated agent):
- GET /api/v1/agent/leads/visa-types: active visa catalog (`id`, `code`).
- POST /api/v1/agent/leads: create a lead; server assigns agent and status=new.
- GET /api/v1/agent/leads?q=&page=1&limit=20: own leads, searchable by name, phone or area.
- GET /api/v1/agent/leads/:id: own lead details; other agents receive 404.

Mobile: Leads tab → Listing Lead → Create Lead. After save the list refreshes;
tapping a card shows all profile fields. Existing email/source/contact-channel columns remain intact.
