# Agent dashboard — API

| | |
|--|--|
| กลับ | [README](./README.md) |
| Flow | [flow.md](./flow.md) |
| Database | [database.md](./database.md) |

Base: `/agent/dashboard` · Auth: Bearer JWT + role `agent`

---

## `GET /agent/dashboard`

สรุปข้อมูลสำหรับหน้า dashboard — **endpoint เดียว** (แนะนำ greenfield)

**Response `200`**

```json
{
  "greetingName": "คุณสมศักดิ์",
  "stats": {
    "scoutRooms": 12,
    "publishedRooms": 4,
    "privateRooms": 8,
    "newLeads": 5,
    "activeLeads": 9,
    "pendingContracts": 2,
    "activeContracts": 7
  },
  "reminders": [
    {
      "id": "lead-101",
      "kind": "lead",
      "leadId": 101,
      "title": "สมหญิง ใจดี",
      "meta": "ห้อง #42 · ลุมพินี พาร์ค",
      "statusKey": "new",
      "badgeTone": "warning",
      "updatedAt": "2026-04-01T09:00:00Z"
    },
    {
      "id": "contract-55",
      "kind": "contract",
      "contractId": 55,
      "title": "สัญญา #55",
      "meta": "ห้อง #42 · รอลายเซ็น",
      "statusKey": "awaiting_signatures",
      "badgeTone": "default",
      "updatedAt": "2026-03-31T16:00:00Z"
    }
  ]
}
```

**Server scope (บังคับทุก aggregate)**

```
rent_rooms.created_by_user_id = :agentId   (scout rooms)
leads.created_by_user_id = :agentId
lease_contracts.created_by_user_id = :agentId   (หรือ join ผ่าน tenant/lead ของ agent)
```

---

## Field notes

### `stats.scoutRooms`

`COUNT(*)` FROM `rent_rooms` WHERE `is_scout_room = true` AND `created_by_user_id = agent`

### `stats.publishedRooms` / `privateRooms`

subset ของ scout rooms ตาม `visibility`

### `stats.newLeads`

`COUNT(*)` FROM `leads` WHERE `status = 'new'` AND `created_by_user_id = agent`

### `stats.activeLeads`

`status IN ('inprogress', 'viewed')`

### `stats.pendingContracts`

`lease_contracts.status IN (`

`draft`, `awaiting_signatures`, `awaiting_agent_review`,

`awaiting_payment`, `awaiting_payment_verification`

`)`

### `stats.activeContracts`

`status = 'active'`

### `reminders`

- Union lead + contract rows
- Order by `updated_at DESC`
- Limit `10` (configurable `?reminderLimit=`)

---

## Alternative (ไม่บังคับ)

ถ้าไม่ทำ aggregate endpoint — client เรียก parallel:

| Call | Pack |
|------|------|
| `GET /agent/listings?limit=1` | ใช้ `total` เป็น scoutRooms |
| `GET /agent/leads?status=new&limit=1` | ใช้ `total` |
| `GET /agent/contracts?page=1&limit=20` | filter client-side |

Greenfield **แนะนำ endpoint เดียว** — ลด round-trip และ logic ซ้ำบน client

---

## Errors

| Code | กรณี |
|------|------|
| 401 | ไม่มี JWT |
| 403 | ไม่มี role `agent` |
