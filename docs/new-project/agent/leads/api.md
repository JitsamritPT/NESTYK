# Agent leads — API

| | |
|--|--|
| กลับ | [README](./README.md) |
| Flow | [flow.md](./flow.md) |
| Database | [database.md](./database.md) |

Base: `/agent/leads` · Auth: Bearer JWT + role `agent`

---

## `GET /agent/leads`

Query: `rentRoomId`, `status`, `q` (name/phone), `page`, `limit`

---

## `GET /agent/leads/:id`

---

## `POST /agent/leads`

```json
{
  "rentRoomId": 42,
  "name": "สมหญิง ใจดี",
  "phone": "0898765432",
  "email": "line:id",
  "source": "walk_in",
  "notes": "สนใจเฟอร์นิเจอร์ครบ",
  "status": "new"
}
```

**Response `201`:** `{ "id": 101, "status": "new", "tenantId": null }`

---

## `PATCH /agent/leads/:id`

อัปเดต contact / เปลี่ยนสถานะ

```json
{
  "status": "viewed",
  "viewedAt": "2026-04-01T14:00:00Z",
  "notes": "ดูห้องแล้ว ชอบวิว"
}
```

Allowed status: `new` | `inprogress` | `viewed` | `lost` | `booked`

**`booked` ผ่าน PATCH อย alone ได้** — แต่ถ้าจะทำสัญญา ใช้ promote endpoint ด้านล่าง (สร้าง tenant ด้วย)

---

## `POST /agent/leads/:id/book`

จอง / เลือกเช่า — **promote เป็น tenant** (transaction)

1. `leads.status = booked`
2. `INSERT tenants` (copy name, phone, email จาก lead · `lead_id`)
3. `leads.tenant_id = tenants.id`

**Response `200`:**

```json
{
  "lead": {
    "id": 101,
    "status": "booked",
    "tenantId": 7
  },
  "tenant": {
    "id": 7,
    "leadId": 101,
    "name": "สมหญิง ใจดี",
    "phone": "0898765432",
    "userId": null
  }
}
```

**Errors**

| Code | กรณี |
|------|------|
| 409 | lead เป็น `booked` แล้ว / มี `tenant_id` แล้ว |
| 409 | ห้องมี tenant active อยู่แล้ว |

จากนั้น → [POST /agent/contracts](../contracts/api.md) ด้วย `leadId` หรือ `tenantId`

---

## `POST /agent/leads/:id/mark-lost`

```json
{ "lostReason": "เลือกห้องอื่น" }
```

→ `status = lost`
