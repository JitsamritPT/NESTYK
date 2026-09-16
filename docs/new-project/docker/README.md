# Docker — Local Supabase (DB + Storage)

Local stack mirrors hosted Supabase: **one** `supabase start` provides Postgres (app DB) + Storage (+ Auth/Studio).  
Deploy later by swapping `.env.api` URL/keys to the cloud project — same code paths.

## Quick start

จาก root monorepo:

```bash
# 1) Supabase local (Postgres :54422 + API/Storage :54421)
./docs/new-project/docker/start-supabase-local.sh
# → คัดลอก SUPABASE_* ใส่ root `.env.api` ถ้ายังไม่ตรงกับ status
# → DATABASE_URL ชี้ 127.0.0.1:54422 (ดู .env.api.example)

# 2) App schema + demo data (ใน Postgres ของชุดเดียวกัน)
./docs/new-project/docker/apply-schema.sh
./docs/new-project/docker/seed-dev-user.sh
./docs/new-project/docker/seed-agent-demo.sh

# 3) Demo photos → Storage + room_medias
./docs/new-project/docker/seed-agent-photos.sh
```

Connection แอป (ตรงกับ root `.env.api`):

```
postgresql://postgres:postgres@127.0.0.1:54422/postgres
```

Local Supabase API / Storage:

```
http://127.0.0.1:54421
```

> `supabase db reset` จะล้างทั้ง DB รวมตารางแอป — ใช้เมื่อตั้งใจเริ่มใหม่เท่านั้น  
> Auth มือถือยังใช้ `ALLOW_DEV_AUTH` ได้ตามเดิม

### Dev login (portable)

| Field | Value |
|-------|--------|
| Email | `admin@jitsamrit.com` |
| Password | `Jitsamrit2026` |
| UUID | `00000000-0000-4000-8000-000000000001` |

Requires root `.env`: `EXPO_PUBLIC_USE_DEV_AUTH=true` (+ matching `EXPO_PUBLIC_DEV_LOGIN_*`) and API `.env.api`: `ALLOW_DEV_AUTH=true`.

- Frontend env: root `.env` / `.env.example`
- Backend env: root `.env.api` / `.env.api.example`
- Auth rules: `.cursor/rules/auth-supabase.mdc`
- Photos: `docs/new-project/agent/create-room/photos.md`

Schema อยู่ที่ `public` ตาม blueprint (ไม่ใช้ `NESTYK_PROPTECH` ของ skeleton เก่า)

## Files

| File | Role |
|------|------|
| [start-supabase-local.sh](./start-supabase-local.sh) | `npx supabase start` — DB + Storage ใน Docker |
| [apply-schema.sh](./apply-schema.sh) | Apply schemas + migrations บน `supabase_db_NESTYK` |
| [seed-dev-user.sql](./seed-dev-user.sql) / [.sh](./seed-dev-user.sh) | Seed sample admin profile |
| [seed-agent-demo.sql](./seed-agent-demo.sql) / [.sh](./seed-agent-demo.sh) | Seed **10** scout rooms + 6 leads |
| [seed-agent-photos.mjs](./seed-agent-photos.mjs) / [.sh](./seed-agent-photos.sh) | อัปโหลดรูป mock → `property-images` + `room_medias` |
| root `supabase/config.toml` | Config สำหรับ Supabase CLI local stack |
