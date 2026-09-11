# Docker — Local Postgres

Local database สำหรับ apply schema จาก `docs/new-project/`.

## Quick start

จาก root monorepo:

```bash
docker compose up -d
./docs/new-project/docker/apply-schema.sh
./docs/new-project/docker/seed-dev-user.sh
./docs/new-project/docker/seed-agent-demo.sh
```

Connection (ตรงกับ root `.env.api`):

```
postgresql://postgres:password@localhost:5432/nestyk_db
```

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

Schema อยู่ที่ `public` ตาม blueprint (ไม่ใช้ `NESTYK_PROPTECH` ของ skeleton เก่า)

## Files

| File | Role |
|------|------|
| [CHECKLIST.md](./CHECKLIST.md) | ขั้นตอนตรวจก่อน/หลัง apply |
| [apply-schema.sh](./apply-schema.sh) | รัน DDL ตามลำดับ |
| [seed-dev-user.sql](./seed-dev-user.sql) | Seed sample admin profile |
| [seed-dev-user.sh](./seed-dev-user.sh) | รัน seed ผ่าน `psql` หรือ `docker exec` (fallback) |
| [seed-agent-demo.sql](./seed-agent-demo.sql) | Seed **10** scout rooms + 6 leads สำหรับ agent demo |
| [seed-agent-demo.sh](./seed-agent-demo.sh) | รัน agent demo seed (`psql` หรือ `docker exec`) |
