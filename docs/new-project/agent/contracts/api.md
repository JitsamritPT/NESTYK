# Agent contracts — API

| | |
|--|--|
| กลับ | [README](./README.md) |
| Leads | [../leads/api.md](../leads/api.md) |
| Flow | [flow.md](./flow.md) |

Base: `/agent/contracts` · role `agent`

---

## Prerequisite: book lead

ก่อนสร้างสัญญา (ถ้ายังไม่มี tenant):

**`POST /agent/leads/:id/book`** — ดู [leads/api.md](../leads/api.md)

---

## `POST /agent/contracts`

**จาก lead ที่ booked แล้ว (แนะนำ)**

```json
{
  "leadId": 101,
  "contractTypeCode": "monthly_12",
  "startDate": "2026-04-01",
  "endDate": "2027-03-31",
  "monthlyRent": 12000,
  "deposit": 24000,
  "notes": null
}
```

Server (transaction):

1. ตรวจ `leads.id = leadId` · `status = booked` · `tenant_id` NOT NULL
2. สร้าง `room_tenancies` (tenant + rent_room จาก lead)
3. สร้าง `lease_contracts` (`lead_id`, `tenant_id`, `room_tenancy_id`)

**Response `201`:**

```json
{
  "id": 100,
  "leadId": 101,
  "tenantId": 7,
  "roomTenancyId": 15,
  "status": "draft"
}
```

**แบบมี tenant แล้ว**

```json
{
  "tenantId": 7,
  "startDate": "2026-04-01",
  "monthlyRent": 12000
}
```

---

## อื่น ๆ

| Method | Path |
|--------|------|
| `GET` | `/agent/contracts` |
| `GET` | `/agent/contracts/:id` |
| `PATCH` | `/agent/contracts/:id/submit-for-signature` |
| `PATCH` | `/agent/contracts/:id/review` |
| `PATCH` | `/agent/contracts/:id/verify-payment` |
| `PATCH` | `/agent/contracts/:id/cancel` |

รายละเอียด transitions — ดู [flow.md](./flow.md)

---

## Validation

- `lead.status` ต้องเป็น `booked` และมี `tenant_id` ตรงกับ tenant ในสัญญา
- `lease_contracts.lead_id` = lead ต้นทาง (ชื่อยังอยู่ใน leads + tenants)
- ไม่ overlap สัญญา active ต่อ `room_tenancy_id`
