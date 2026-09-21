# สรุป: การดึงสถานีรถไฟ / สถานที่ใกล้เคียง (Nearby Places)

เอกสารอ้างอิง logic เต็มจากโค้ดปัจจุบัน — วิธีดึง, กรอง, ตัดซ้ำ, จำกัดจำนวน, โครงข้อมูล, และไฟล์ที่เกี่ยวข้อง

> **แหล่งความจริง (source of truth):**  
> `apps/api/src/modules/places/places.service.ts` · `apps/api/src/modules/properties/listing-nearby-place.ts`  
> เอกสารนี้สรุป logic ให้ตรงกับโค้ด — ถ้าโค้ดเปลี่ยน ให้อัปเดตเอกสารนี้ด้วย

---

## 1. ภาพรวม

ระบบใช้ **Google Places Nearby Search** ผ่าน NestJS API  
**ไม่ได้** ดึงจากรายการสถานีใน DB หรือจาก `docs/data/location.json`

### Flow หลัก

```
พิกัดห้อง (lat, lng)
        │
        ▼
Client → GET /places/nearby?lat=&lng=&radiusMeters=&language=th
        │     (apps/mobile/lib/google/google-places.ts → searchNearbyPlaces)
        ▼
PlacesController.nearby()
        │
        ▼
PlacesService.nearbySearch(lat, lng, radiusMeters, language)
        │
        ├─ เรียก Google ขนานตาม NEARBY_PLACE_SEARCH_TYPES (6 type)
        │     typeRadius = min(radius จาก query, รัศมีต่อหมวด)
        │
        ├─ map แต่ละผลลัพธ์ → RankedNearbyPlace
        │     · ข้ามถ้าไม่มี placeId / name / geometry
        │     · ข้าม CLOSED_PERMANENTLY
        │     · คำนวณระยะ haversine → ตัดถ้าระยะ > รัศมีหมวด
        │     · isImportantNearbyCandidate() กรองคุณภาพ
        │     · รวม placeId ซ้ำ เก็บตัวสำคัญกว่า (compareNearbyImportance)
        │
        ├─ dedupeSameNearbyPlaces() — รวมหมุดซ้อนชื่อ/พิกัด
        ├─ limitNearbyByType() — limit ต่อ type
        ├─ เรียงระยะใกล้ → ไกล
        └─ slice(0, NEARBY_PLACE_RESULT_LIMIT=24)
                │
                ▼
ListingNearbyPlace[] → owner เลือกเก็บในประกาศ / โชว์บน UI
```

### Endpoint / API

| รายการ | ค่า |
|--------|-----|
| Client | `searchNearbyPlaces()` ใน `apps/mobile/lib/google/google-places.ts` |
| Nest | `GET /places/nearby` (`PlacesController`) |
| Query | `lat` (บังคับ), `lng` (บังคับ), `radiusMeters?` (default `3000`), `language?` (default `th`) |
| Google | `https://maps.googleapis.com/maps/api/place/nearbysearch/json` |
| สถานะที่ยอมรับ | `OK`, `ZERO_RESULTS` — อื่นๆ → `ServiceUnavailableException` |
| รัศมี clamp | `max(100, min(50000, round(radiusMeters)))` |

ตัวอย่างเรียก:

```
GET /places/nearby?lat=13.737&lng=100.560&radiusMeters=3000&language=th
```

---

## 2. ค่าคงที่ (จาก `listing-nearby-place.ts`)

### ประเภทที่ค้น (`NEARBY_PLACE_SEARCH_TYPES`)

ตัด `bus_station` / `school` / `convenience_store` ออกจากประเภทค้นหลัก เพราะมักเป็นจุดเล็กตามซอย

| Google `type` | หมวด UI (`NearbyPlaceCategory`) | รัศมีสูงสุด | Limit ต่อ type |
|---------------|----------------------------------|------------|----------------|
| `subway_station` | `transit` | **1,000 m** | 5 |
| `train_station` | `transit` | **1,000 m** | 5 |
| `university` | `education` | 2,500 m | 5 |
| `hospital` | `health` | 2,500 m | 5 |
| `shopping_mall` | `shopping` | 3,000 m | 5 |
| `park` | `recreation` | 2,000 m | 3 |

| ค่าคงที่ | ค่า |
|----------|-----|
| `NEARBY_SEARCH_RADIUS_METERS` | `3000` (รัศมี query สูงสุดโดยรวม / default client) |
| `NEARBY_PLACE_RESULT_LIMIT` | `24` (ผลรวมสูงสุดหลังกรอง) |
| `NEARBY_PLACE_MIN_RATINGS.park` | `120` (park ต้องมีรีวิวอย่างน้อยนี้) |

### แผนที่ type → category

| type | category |
|------|----------|
| `transit_station`, `subway_station`, `train_station`, `bus_station` | `transit` |
| `university`, `school` | `education` |
| `hospital` | `health` |
| `shopping_mall`, `supermarket`, `convenience_store` | `shopping` |
| `park` | `recreation` |
| `custom_nearby` | `other` |
| อื่นๆ | `other` |

ลำดับหมวดบน UI (`NEARBY_PLACE_CATEGORY_ORDER`):  
`transit` → `education` → `health` → `shopping` → `recreation` → `other`

### รัศมีต่อรอบค้นจริง

```
typeRadius = min(radius จาก query, getNearbyRadiusForType(type))
```

เช่น query `radiusMeters=3000` แต่ `subway_station` ใช้ได้แค่ **1000 m**

---

## 3. Logic ใน `PlacesService.nearbySearch()` (ทีละขั้น)

### 3.1 เรียก Google ขนาน

สำหรับแต่ละ type ใน `NEARBY_PLACE_SEARCH_TYPES`:

1. สร้าง query: `location=lat,lng` · `radius=typeRadius` · `type` · `key` · `language`
2. `fetch` Nearby Search
3. คืน `{ type, typeRadius, results }`

### 3.2 Map แต่ละ place จาก Google

ข้ามทันทีถ้าขาด `place_id` / `name` / `geometry.location`

| ฟิลด์ | ที่มา |
|-------|--------|
| `placeId` | `place_id` |
| `name` | `name` (ไม่แต่งชื่อเอง) |
| `type` | `pickPrimaryType(types)` ถ้ามีในรายการค้น ไม่งั้นใช้ `batch.type` |
| `distanceMeters` | `round(haversine(ห้อง ↔ place))` |
| `latitude` / `longitude` | `geometry.location` |
| `vicinity` | optional |
| `userRatingsTotal` / `rating` | ใช้แค่จัดอันดับภายใน แล้วตัดออกก่อนคืน |

ตัดทิ้งถ้า:

- `business_status === 'CLOSED_PERMANENTLY'`
- `distanceMeters > categoryRadius` (รัศมีของ type ที่ resolve แล้ว)
- `!isImportantNearbyCandidate(place, googleTypes)`

### 3.3 รวม `placeId` ซ้ำ

ถ้า placeId เดิมมีอยู่แล้ว เก็บตัวที่ `compareNearbyImportance` ดีกว่า

### 3.4 Pipeline หลังรวม

```
byPlaceId.values()
  → sort(compareNearbyImportance)
  → dedupeSameNearbyPlaces()
  → limitNearbyByType()
  → sort(distanceMeters ASC)
  → slice(0, 24)
  → map ตัด userRatingsTotal / rating ออก
  → ListingNearbyPlace[]
```

---

## 4. การกรองคุณภาพ — `isImportantNearbyCandidate()`

### 4.1 Pattern ตัดทิ้ง

**ชื่อร้านเล็ก / มินิมาร์ท** (`MINOR_PLACE_NAME_PATTERN`) — ตัดทุกประเภทถ้าชื่อ match:

```
/7[\s-]?eleven|เซเว่น|familymart|แฟมิลี่\s?มาร์ท|family\s?mart|lawson|
โลตัส\s?โก\s?เฟรช|lotus\s?go\s?fresh|mini\s?mart|มินิมาร์ท|
cj\s?express|ซีเจ|big\s?c\s?mini|แม็คโคร\s?ฟู้ด|makro\s?food/i
```

**จุดเดินทางระดับซอย / ป้ายเล็ก** (`MINOR_TRANSIT_PATTERN`):

```
/ซอย|soi\b|ซ\.\s*|alley|ป้ายรถ|bus\s*stop|busstop|รถตู้|วิน\s*|
motorcycle|มอเตอร์ไซ|สองแถว|songthaew|ท่าเรือเล็ก|ferry\s*pier/i
```

**สถานีใหญ่** (`MAJOR_TRANSIT_NAME_PATTERN`) — ใช้กับ `transit_station` ที่ไม่ใช่ subway/train:

```
/bts|mrt|รถไฟฟ้า|airport\s*rail|แอร์พอร์ต\s*เรล|สถานีรถไฟ|train\s*station|railway/i
```

### 4.2 กฎ Transit

ถือว่าเป็น transit ถ้า type เป็น `subway_station` | `train_station` | `transit_station` หรือ Google types มี `bus_station`

| กรณี | พฤติกรรม |
|------|----------|
| type = `subway_station` / `train_station` | **เก็บไว้เสมอ** (ไม่ตัดเพราะ vicinity มีคำว่า “ซอย”) — ตัดเฉพาะถ้า**ชื่อ** match `MINOR_TRANSIT_PATTERN` |
| type อื่นที่เป็น transit | ตัดถ้าชื่อหรือ vicinity match `MINOR_TRANSIT_PATTERN` |
| Google types มี `bus_station` (และไม่ใช่ major rail type) | ตัดทิ้ง |
| type = `transit_station` และชื่อ**ไม่มี** MAJOR pattern | ตัดทิ้ง |

### 4.3 ตัดประเภท Google ที่ไม่ต้องการ

ถ้า Google types มี `convenience_store` | `supermarket` | `school` | `primary_school` | `secondary_school` | `bus_station`  
→ ตัดทิ้ง **ยกเว้น** type หลักเป็น `university` | `shopping_mall` | `hospital` | `subway_station` | `train_station`

### 4.4 ขั้นต่ำรีวิว

ถ้า type มีใน `NEARBY_PLACE_MIN_RATINGS` และ `userRatingsTotal < ขั้นต่ำ` → ตัด  
ปัจจุบันบังคับแค่ **`park` ≥ 120**

---

## 5. จัดอันดับ / ตัดซ้ำ / limit

### 5.1 `compareNearbyImportance` (สำคัญกว่ามาก่อน)

1. `userRatingsTotal` มากกว่าดีกว่า  
2. ถ้าเท่ากัน → `rating` สูงกว่าดีกว่า  
3. ถ้ายังเท่า → `distanceMeters` น้อยกว่าดีกว่า  

### 5.2 ความสำคัญ type ตอน merge (`NEARBY_TYPE_PRIORITY`)

ตัวเลขน้อย = สำคัญกว่า:

| type | priority |
|------|----------|
| `subway_station` | 1 |
| `train_station` | 2 |
| `shopping_mall` | 3 |
| `university` | 4 |
| `hospital` | 5 |
| `park` | 6 |

### 5.3 `dedupeSameNearbyPlaces` — หมุดซ้อน

ถือว่าเป็นที่เดียวกัน (`isSameNearbyPlace`) เมื่อระยะ ≤ **120 m** (`SAME_PLACE_DISTANCE_METERS`) และอย่างน้อยหนึ่งข้อ:

1. ชื่อ normalize แล้วเหมือน / รวมกันได้ (`namesLikelySame`)  
2. type เดียวกัน และระยะ ≤ **55 m** (`SAME_TYPE_COLLAPSE_METERS`)  
3. ทั้งคู่เป็น transit types และระยะ ≤ **55 m**

**normalize ชื่อ** (`normalizeNearbyPlaceName`):

- lower case + NFKC  
- ตัดข้อความในวงเล็บ  
- ตัดคำ: สถานี / station / bts / mrt / รถไฟฟ้า / airport rail link / แอร์พอร์ต เรล ลิงก์  
- ตัดช่องว่างและเครื่องหมาย  

**merge:** เก็บตัวสำคัญกว่า + type ที่ priority ดีกว่า + ชื่อที่สั้นกว่าถ้าชื่อเกือบเหมือนกัน

### 5.4 `limitNearbyByType`

เดินตามลำดับหลังจัดอันดับ เก็บไม่เกิน limit ต่อ type  
type ที่ไม่อยู่ในตาราง → default limit **3**

---

## 6. โครงข้อมูลที่คืน / เก็บ

```json
{
  "placeId": "ChIJ....",
  "name": "อโศก",
  "type": "subway_station",
  "distanceMeters": 420,
  "latitude": 13.7372,
  "longitude": 100.5604,
  "vicinity": "สุขุมวิท"
}
```

| ฟิลด์ | หมายเหตุ |
|-------|----------|
| `name` | จาก Google โดยตรง — ระบบไม่ตั้งชื่อเอง |
| `language` | พารามิเตอร์ query (default `th`) มีผลต่อชื่อ |
| `userRatingsTotal` / `rating` | **ไม่** ส่งออกใน response สุดท้าย |

### Normalize ฝั่งแอป / ตอนอ่านประกาศ

`normalizeListingNearbyPlaces()`:

- รับ array เท่านั้น  
- ต้องมี `placeId`, `name`, `distanceMeters`, `lat/lng` ที่เป็นตัวเลขได้  
- ตัด `placeId` ซ้ำ  
- type ว่าง → `"point_of_interest"`  
- เรียงตาม `distanceMeters` ASC  

---

## 7. ตัวอย่างชื่อที่ดึงได้และโชว์

### ผลทดสอบจริง (พิกัดอโศก `13.737, 100.560` · รัศมี 1 กม. · `language=th`)

Google Nearby Search (`type=subway_station`) คืน:

| ชื่อจาก Google (`name`) | type | ระยะโดยประมาณ | หมายเหตุ |
|-------------------------|------|---------------|----------|
| `นานา` | `subway_station` | ~630 m | ชื่อสั้น ไม่มีคำว่า BTS |
| `อโศก` | `subway_station` | ~34 m | ชื่อสั้น ไม่มีคำว่า BTS |
| `สุขุมวิท` | `subway_station` | ~231 m | มักเป็น MRT แต่ชื่อสั้น |

`type=train_station` ในรัศมี 1 กม. → `ZERO_RESULTS`

> ชื่อจริงจาก Google มักเป็นแค่ชื่อสถานี (`อโศก`) **ไม่ใช่** `BTS อโศก` — อย่าคาดหวัง prefix ในเอกสาร UI

### ตัวอย่างที่ระบบมักตัดทิ้ง

| ตัวอย่างชื่อ | เหตุผล |
|-------------|--------|
| `ป้ายรถเมล์สุขุมวิท 21` | ป้ายรถ / `bus_station` / MINOR_TRANSIT |
| `วินมอเตอร์ไซค์ซอย...` | MINOR_TRANSIT ในชื่อ |
| `Bus Stop ...` | `bus_station` |
| `7-Eleven ...` | MINOR_PLACE_NAME |
| สวนเล็กที่รีวิวน้อย | `park` และ ratings &lt; 120 |

---

## 8. การแสดงผลบน UI / ที่เก็บข้อมูล

| จุดใช้งาน | พฤติกรรม |
|-----------|----------|
| Owner สร้างประกาศ | เรียก `searchNearbyPlaces(lat, lng)` → ให้เลือก → เก็บใน `rentRoom.nearbyPlaces` |
| Room detail (Guest) | **ไม่เรียก Google ใหม่** — โชว์ `listing.nearbyPlaces` ที่เก็บในประกาศ |
| หน้าโหลด detail | `room-detail-page.tsx` → fetch room → ส่งต่อ `listing.nearbyPlaces` |

ไฟล์ UI หลัก: `apps/mobile/components/rooms/room-detail-location-nearby-section.tsx`

ใช้ `AppListRow`:

| ส่วน UI | แหล่งข้อมูล | ตัวอย่าง |
|---------|-------------|----------|
| **title** | `place.name` | `อโศก` |
| **subtitle** | `formatNearbyDistanceMeters(distanceMeters)` | `420 m` หรือ `1.2 km` |
| ไอคอนหมวด | หมวด `transit` → สีน้ำเงิน + ไอคอน train | — |

ฟอร์แมตระยะ (`listing-nearby-place.ts` ฝั่งแอป):

- `< 1000` → `420 m`
- `≥ 1000` → `1.2 km`

แผนที่ / tooltip ใช้ `place.name` เหมือนกัน  
(`room-detail-nearby-place-tooltip.tsx`, `owner-nearby-places-map*.tsx`)

### ตัวอย่างแถวบนหน้าจอ

```
🚇  อโศก
    420 m                              ↗

🚇  สุขุมวิท
    350 m                              ↗
```

---

## 9. ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | บทบาท |
|------|--------|
| `apps/api/src/modules/places/places.service.ts` | logic หลัก: เรียก Google + กรอง/เรียง/ตัดซ้ำ/`nearbySearch` |
| `apps/api/src/modules/places/places.controller.ts` | `GET /places/nearby` |
| `apps/api/src/modules/places/dto/places-query.dto.ts` | validate query `lat`/`lng`/`radiusMeters`/`language` |
| `apps/api/src/modules/properties/listing-nearby-place.ts` | type, รัศมี, limit, category, normalize |
| `apps/mobile/lib/google/google-places.ts` | client `searchNearbyPlaces` |
| `apps/mobile/lib/owner/listing-nearby-place.ts` | types + `formatNearbyDistanceMeters` ฝั่งแอป |
| `apps/mobile/components/owner/owner-nearby-places-step.tsx` | ขั้นตอนเลือก nearby ตอนสร้างประกาศ |
| `apps/mobile/components/rooms/room-detail-location-nearby-section.tsx` | รายการ nearby บน detail |
| `apps/mobile/components/rooms/room-detail-page.tsx` | โหลด listing (nearby มาพร้อมประกาศ ไม่ fetch ใหม่) |

ดูเพิ่ม: [features/rooms.md](./rooms.md) (โซนที่อยู่และสถานที่ใกล้เคียงบน room detail)

---

## 10. สรุปสั้นๆ

1. ดึงจาก **Google Places Nearby Search** ผ่าน `GET /places/nearby` — ไม่ใช้ master สถานีใน DB  
2. ค้น 6 type ขนาน · รัศมีต่อหมวด (สถานี **1 กม.**) · สูงสุด **5 ต่อ type** · รวม ≤ **24**  
3. กรอง: ปิดถาวร · ระยะเกิน · มินิมาร์ท · ป้ายรถ/จุดเล็ก · park รีวิวน้อย · ตัดซ้ำชื่อ/พิกัด  
4. `subway_station` / `train_station` เก็บแม้ vicinity มีคำว่าซอย — ตัดเฉพาะชื่อที่เป็นจุดเล็ก  
5. ชื่อที่โชว์ = **`name` จาก Google** + ระยะ `m` / `km`  
6. Room detail **อ่านจากประกาศ** — ไม่ยิง Google ทุกครั้งที่เปิดหน้า
