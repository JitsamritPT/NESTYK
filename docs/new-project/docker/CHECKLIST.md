# Local Supabase checklist (DB + Storage ชุดเดียว)

- [ ] Docker Desktop / daemon ทำงาน
- [ ] `./docs/new-project/docker/start-supabase-local.sh` → containers `*_NESTYK` healthy (API **54421**, Postgres **54422**)
- [ ] root `.env.api` ตั้ง `DATABASE_URL=…54422/postgres` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` จาก `npx supabase status` + `ALLOW_DEV_AUTH=true`
- [ ] `./docs/new-project/docker/apply-schema.sh` สำเร็จ (รวม migration ลบ local photo URL เก่า)
- [ ] มีตาราง: `users`, `master_roles`, `user_roles`, `rent_rooms`, `room_medias`, `leads`, `tenants`, `lease_contracts`
- [ ] `./docs/new-project/docker/seed-dev-user.sh` → user `admin@jitsamrit.com` + roles
- [ ] `./docs/new-project/docker/seed-agent-demo.sh` → 10 scout rooms + 6 leads (agent)
- [ ] `./docs/new-project/docker/seed-agent-photos.sh` → รูป demo ใน bucket `property-images` + `room_medias`
- [ ] รีสตาร์ท API หลังแก้ `.env.api`
- [ ] root `.env` สำหรับ front: `EXPO_PUBLIC_USE_DEV_AUTH=true` + `EXPO_PUBLIC_DEV_LOGIN_*`
- [ ] Consumer app: Sign In ด้วย `admin@jitsamrit.com` / `Jitsamrit2026` → sync → เปิด Listings เห็นรูป
- [ ] (ทางเลือก) ปิดหรืออย่า sync entity เก่า `NESTYK_PROPTECH` ทับ `public` จนกว่าจะ migrate API
