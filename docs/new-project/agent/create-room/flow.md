# Agent create room — Flow

| | |
|--|--|
| กลับ | [README](./README.md) |
| Database | [database.md](./database.md) |

---

## 1. สรุป

Agent สร้างห้อง → **`rent_rooms`** แถวเดียวกับ Owner ในอนาคต แต่ตั้ง:

- `is_scout_room = true`
- `visibility = private | published` (tag public/private)

---

## 2. User journey

```mermaid
flowchart TD
    A["Agent login<br/>/agent/login"] --> B["Wizard<br/>/agent/rooms/create"]
    B --> C["POST /agent/rooms"]
    C --> D["rent_rooms<br/>is_scout_room=true"]
    D --> E{visibility?}
    E -->|private| F["/agent/listings<br/>เฉพาะ agent"]
    E -->|published| G["Guest search<br/>public listing"]
    D --> H["PATCH visibility<br/>(ภายหลัง)"]
```

---

## 2b. ERD (ตารางที่เกี่ยวข้อง)

```mermaid
erDiagram
    users ||--o{ property_owners : "created_by (agent)"
    users ||--o| property_owners : "user_id claim"
    users ||--o{ rent_rooms : "created_by_user_id"
    users ||--o{ rent_rooms : "owner_id (owner only)"

    properties ||--o{ rent_rooms : properties_id
    property_owners ||--o{ rent_rooms : property_owner_id
    master_room_statuses ||--o{ rent_rooms : room_status_id

    rent_rooms ||--o{ room_medias : rent_id
    rent_rooms ||--o{ rent_room_documents : rent_id
    rent_rooms ||--o{ room_layout_values : rent_room_id
    rent_rooms ||--o{ room_facilities : rent_room_id

    rent_rooms {
        boolean is_scout_room "true=agent false=owner"
        varchar visibility "private|published|null"
        int property_owner_id "agent scout"
        int owner_id "owner listing"
    }
```

---

## 2c. DB write order (Agent create)

```mermaid
flowchart LR
    subgraph req [Required]
        PO[property_owners]
        PR[properties]
        RR["rent_rooms<br/>is_scout_room=true<br/>visibility"]
        M[room_medias x5+]
    end

    subgraph opt [Optional]
        LY[room_layout_values]
        FC[room_facilities]
        DOC[rent_room_documents]
    end

    PO --> RR
    PR --> RR
    RR --> M
    RR --> LY
    RR --> FC
    RR --> DOC
```

---

## 3. Wizard — required vs optional

| Step | หัวข้อ | DB |
|-----:|--------|-----|
| 1 | โครงการ / ที่ตั้ง | `properties` ✅ |
| 2 | layout | `room_layout_values` opt |
| 3 | facilities | `room_facilities` opt |
| 4 | nearby | `nearby_*` opt |
| 5 | ค่าเช่า | `prices`, water/electric ✅ |
| 6 | รูป | `room_medias` ✅ (≥5) |
| 7 | Promo AI | ไม่ persist |
| 8 | เอกสาร | `rent_room_documents` opt |
| 9 | เจ้าของห้อง + **visibility** | `property_owners` ✅ · `visibility` ✅ |

Server ตั้งอัตโนมัติ: `is_scout_room=true`, `owner_id=NULL`, `room_status=available`, `created_by_user_id=agent`

---

## 4. Visibility tag

| ค่า | ความหมาย |
|-----|----------|
| `private` | Agent + ผู้สร้างเท่านั้น — ไม่ public |
| `published` | โชว์ Guest search (public listing) |

เปลี่ยนทีหลัง: `PATCH /agent/listings/:id/visibility` — ดู [listings pack](../listings/README.md)

---

## 5. Unified table (อนาคต)

```mermaid
flowchart TB
    subgraph rent_rooms ["rent_rooms (ตารางเดียว)"]
        SCOUT["Agent scout<br/>is_scout_room=true<br/>visibility private|published<br/>property_owner_id"]
        OWNER["Owner listing<br/>is_scout_room=false<br/>visibility NULL<br/>owner_id"]
    end

    SCOUT --> LEADS[leads.rent_room_id]
    SCOUT --> GUEST[Guest search if published]
    OWNER --> OWNERUI[/owner/listings/]
```

Lead / contract อ้าง **`rent_rooms.id`** ไม่ว่าแหล่ง scout หรือ owner
