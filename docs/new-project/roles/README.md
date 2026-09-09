# Roles & Access Control

| ฟิลด์ | ค่า |
|-------|-----|
| สถานะ | `blueprint` |
| Scope | Guest `/` · Tenant `/tenant` · Owner `/owner` · Agent `/agent` · Admin `/admin` |
| DB | `master_roles` + `user_roles` |
| Auth | JWT provider → `POST /auth/sync` → `public.users` |

แยก **App mode (UX/route)** จาก **DB role (สิทธิ)** — user หนึ่งคนมีหลาย role ใน `user_roles` แต่เข้าได้เฉพาะ route ของ role นั้น

---

## เอกสาร (แยกตาม layer)

| ไฟล์ | อ่านเมื่อ |
|------|-----------|
| [flow.md](./flow.md) | Login, mode picker, gate, Access Denied, dev grant |
| [api.md](./api.md) | `/auth/sync`, profile, dev roles, assert ใน service |
| [database.md](./database.md) | ตาราง, seed, invariant, query |
| [schema.sql](./schema.sql) | DDL runnable |

---

## สรุปเร็ว: App mode vs DB role

| App mode | Route prefix | ต้องมีใน `user_roles` | Guest UX |
|----------|--------------|------------------------|----------|
| **Guest** | `/`, `/search`, `/rooms/*` | ไม่บังคับ | สาธารณะ — ไม่ผูก tenant/owner/agent |
| **Tenant** | `/tenant` | `tenant` | — |
| **Owner** | `/owner` | `owner` | — |
| **Agent** | `/agent` | `agent` | — |
| **Admin** | `/admin` | `admin` | — |

| DB `master_roles.name` | ความหมาย |
|------------------------|----------|
| `guest` | default ตอนสร้าง user — **ไม่ใช่** app mode แยก |
| `owner` / `tenant` / `agent` / `admin` | management role — gate route + API |

---

## Bootstrap DB

```bash
psql "$DATABASE_URL" -f docs/new-project/roles/schema.sql
```

---

## Pack ถัดไป

- [Agent dashboard](../agent/dashboard/README.md) — landing `/agent/dashboard`
- [Agent create room](../agent/create-room/README.md) — ต้องมี role `agent` + gate จาก pack นี้ก่อน

**หมายเหตุ:** role ใน DB = `agent` · **ไม่มี** `assistant`
