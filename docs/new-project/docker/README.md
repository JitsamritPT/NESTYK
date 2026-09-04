# Docker — Local Postgres

Local database สำหรับ apply schema จาก `docs/new-project/`.

## Quick start

จาก root monorepo:

```bash
docker compose up -d
./docs/new-project/docker/apply-schema.sh
```

Connection (ตรงกับ root `.env.api`):

```
postgresql://postgres:password@localhost:5432/nestyk_db
```

- Frontend env: root `.env` / `.env.example`
- Backend env: root `.env.api` / `.env.api.example`

Schema อยู่ที่ `public` ตาม blueprint (ไม่ใช้ `NESTYK_PROPTECH` ของ skeleton เก่า)

## Files

| File | Role |
|------|------|
| [CHECKLIST.md](./CHECKLIST.md) | ขั้นตอนตรวจก่อน/หลัง apply |
| [apply-schema.sh](./apply-schema.sh) | รัน DDL ตามลำดับ |
