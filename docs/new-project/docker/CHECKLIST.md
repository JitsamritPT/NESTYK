# Local DB checklist

- [ ] Docker Desktop / daemon ทำงาน
- [ ] `docker compose up -d` จาก root → container `nestyk-postgres` healthy
- [ ] `./docs/new-project/docker/apply-schema.sh` สำเร็จ
- [ ] มีตาราง: `users`, `master_roles`, `user_roles`, `rent_rooms`, `leads`, `tenants`, `lease_contracts`
- [ ] root `.env.api` ตั้ง `DATABASE_URL=...` (copy จาก `.env.api.example`)
- [ ] root `.env` สำหรับ front (copy จาก `.env.example`)
- [ ] (ทางเลือก) ปิดหรืออย่า sync entity เก่า `NESTYK_PROPTECH` ทับ `public` จนกว่าจะ migrate API
