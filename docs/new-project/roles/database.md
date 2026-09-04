# Roles — Database

Source of truth greenfield: [schema.sql](./schema.sql)

---

## 1. ER

```
master_roles (1) ──< user_roles >── (N) users
     │
     name: guest | owner | tenant | agent | admin
     └─ code-only catalog (display ผ่าน i18n client-side)
```

---

## 2. `master_roles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `name` | varchar(100) UNIQUE | `guest`, `owner`, `tenant`, `agent`, `admin` |
| `details` | varchar(255) NULL | metadata (ไม่ใช่ i18n column) |

**Seed** (ใน schema.sql):

```sql
INSERT INTO master_roles (name, details) VALUES
  ('guest',  'Default identity — not a gated management mode'),
  ('owner',  'Property owner — /owner'),
  ('tenant', 'Tenant — /tenant'),
  ('agent',  'Field agent — /agent'),
  ('admin',  'Admin operations — /admin');
```

---

## 3. `user_roles`

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | int FK → `users.id` CASCADE | |
| `role_id` | int FK → `master_roles.id` CASCADE | |
| PK | `(user_id, role_id)` | |

**Invariant**

- User ใหม่ → อย่างน้อย `guest`
- เพิ่ม management role → **ไม่ลบ** `guest`
- ลบ management role → **ไม่ลบ** `guest`
- หนึ่ง user มีหลาย management role ได้

---

## 4. `users` (auth fields)

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `supabase_user_id` | uuid UNIQUE NULL | หรือ auth subject id อื่น |
| `email` | varchar UNIQUE | |
| `profile_completed` | boolean | onboarding gate |

ไม่มี column `primary_role` — client อ่าน `roles[]` จาก sync API

---

## 5. Query patterns

```typescript
// Load user + roles
usersRepo.findOne({
  where: { id },
  relations: { user_roles: { role: true } },
});

// Check agent
user.user_roles?.some((ur) => ur.role.name === 'agent');
```

---

## 6. ความสัมพันธ์กับ pack อื่น

| ตาราง | ใช้ role |
|-------|----------|
| `rent_rooms.created_by_user_id` | user ที่มี role `agent` |
| `property_owners.created_by_user_id` | agent ที่เพิ่ม contact |

**หมายเหตุ:** greenfield **ไม่มี** role `assistant` — ใช้ `agent` / `admin` ตามงาน
