# Local DB checklist

- [ ] Docker Desktop / daemon ทำงาน
- [ ] `docker compose up -d` จาก root → container `nestyk-postgres` healthy
- [ ] `./docs/new-project/docker/apply-schema.sh` สำเร็จ
- [ ] มีตาราง: `users`, `master_roles`, `user_roles`, `rent_rooms`, `leads`, `tenants`, `lease_contracts`
- [ ] `./docs/new-project/docker/seed-dev-user.sh` → user `admin@jitsamrit.com` + roles
- [ ] `./docs/new-project/docker/seed-agent-demo.sh` → 10 scout rooms + 6 leads (agent)
- [ ] root `.env.api` ตั้ง `DATABASE_URL=...` + `ALLOW_DEV_AUTH=true` (copy จาก `.env.api.example`)
- [ ] root `.env` สำหรับ front: `EXPO_PUBLIC_USE_DEV_AUTH=true` + `EXPO_PUBLIC_DEV_LOGIN_*` (copy จาก `.env.example`)
- [ ] Consumer app: Sign In ด้วย `admin@jitsamrit.com` / `Jitsamrit2026` → sync → Sign Out
- [ ] (ทางเลือก) ปิดหรืออย่า sync entity เก่า `NESTYK_PROPTECH` ทับ `public` จนกว่าจะ migrate API
