# Agent dashboard — Database

| | |
|--|--|
| กลับ | [README](./README.md) |
| Flow | [flow.md](./flow.md) |

**ไม่มีตารางใหม่** — dashboard อ่าน aggregate จากตารางใน pack อื่น

---

## 1. ตารางที่ใช้

| ตาราง | Pack | ใช้สำหรับ |
|--------|------|-----------|
| `rent_rooms` | [create-room](../create-room/database.md) | stat ห้อง scout |
| `leads` | [leads](../leads/database.md) | stat + reminders lead |
| `lease_contracts` | [contracts](../contracts/database.md) | stat + reminders สัญญา |
| `users` | [roles](../../roles/database.md) | greeting name |

---

## 2. Scout room counts

```sql
SELECT
  COUNT(*) FILTER (WHERE TRUE)                    AS scout_rooms,
  COUNT(*) FILTER (WHERE visibility = 'published') AS published_rooms,
  COUNT(*) FILTER (WHERE visibility = 'private')   AS private_rooms
FROM rent_rooms
WHERE is_scout_room = TRUE
  AND created_by_user_id = :agent_user_id;
```

---

## 3. Lead counts

```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'new') AS new_leads,
  COUNT(*) FILTER (WHERE status IN ('inprogress', 'viewed')) AS active_leads
FROM leads
WHERE created_by_user_id = :agent_user_id;
```

---

## 4. Contract counts

```sql
SELECT
  COUNT(*) FILTER (WHERE status IN (
    'draft', 'awaiting_signatures', 'awaiting_agent_review',
    'awaiting_payment', 'awaiting_payment_verification'
  )) AS pending_contracts,
  COUNT(*) FILTER (WHERE status = 'active') AS active_contracts
FROM lease_contracts
WHERE created_by_user_id = :agent_user_id;
```

ถ้า contract ไม่มี `created_by_user_id` — join:

```sql
FROM lease_contracts lc
INNER JOIN leads l ON l.id = lc.lead_id
WHERE l.created_by_user_id = :agent_user_id
```

---

## 5. Reminders query (union)

```sql
(
  SELECT
    'lead-' || id::text AS id,
    'lead' AS kind,
    id AS lead_id,
    NULL::int AS contract_id,
    name AS title,
    status AS status_key,
    updated_at
  FROM leads
  WHERE created_by_user_id = :agent_user_id
    AND status IN ('new', 'inprogress')
)
UNION ALL
(
  SELECT
    'contract-' || lc.id::text,
    'contract',
    NULL,
    lc.id,
    'สัญญา #' || lc.id::text,
    lc.status,
    lc.updated_at
  FROM lease_contracts lc
  WHERE lc.created_by_user_id = :agent_user_id
    AND lc.status IN (
      'draft', 'awaiting_signatures', 'awaiting_agent_review',
      'awaiting_payment', 'awaiting_payment_verification'
    )
)
ORDER BY updated_at DESC
LIMIT 10;
```

Enrich `meta` ด้าน application layer ด้วย join `rent_rooms` / `properties` ตาม `lead.rent_room_id`

---

## 6. Index ที่ช่วย performance

| Index | ตาราง |
|-------|--------|
| `idx_rent_rooms_created_by_user_id` | `rent_rooms` |
| `idx_leads_created_by_user_id` | `leads` |
| `idx_leads_status` | `leads` |

เพิ่ม index บน `lease_contracts(created_by_user_id, status)` เมื่อ implement จริง

---

## 7. ไม่ต้อง migrate แยก

Dashboard pack **ไม่มี `schema.sql`** — bootstrap ตามลำดับใน [new-project/README.md](../../README.md)
