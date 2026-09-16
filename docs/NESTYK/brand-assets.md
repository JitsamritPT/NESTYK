# NESTYK — Brand Logo & Icon Assets

> **Canonical asset root:** `packages/ui/assets/nestyk/`  
> **Runtime imports (apps):** `@nestyk/ui` → `brandAssets` · `NestykLogo` · `MobileNestykLogo`

---

## 1. โครงสร้างโฟลเดอร์

```
packages/ui/assets/nestyk/
├── svg/          # Web / Marketing / Print — ใช้ SVG เป็นหลัก (คมชัดทุกขนาด)
├── png/          # Mobile (Expo / React Native) — Metro bundler
├── *.ai          # Master source สำหรับดีไซน์ / ส่งโรงพิมพ์ (ห้าม import ใน runtime)
└── (legacy) ../logo/IconApp/  # App Store / Play Store / Adaptive icons — ยังใช้ชุดเดิม
```

---

## 2. คู่มือการตั้งชื่อ (Naming)

| Prefix | ความหมาย | ตัวอย่าง |
|---|---|---|
| `icon-nestyk-*` | **Mark** — สัญลักษณ์รังนกอย่างเดียว (square ~1:1) | `icon-nestyk-standard.png` |
| `logo-nestyk-*` | **Wordmark** — สัญลักษณ์ + คำว่า NESTYK (~3:1) | `logo-nestyk-standard.svg` |

| Suffix | สี / พื้นหลังที่เหมาะ | ใช้เมื่อ |
|---|---|---|
| `standard` | สีแบรนด์บนพื้นขาว / `#F8FAFC` | Header หลัก, Splash, การ์ดสว่าง |
| `white` | โลโก้ขาว | Hero สีเข้ม, Gradient header, Login บนพื้นมืด |
| `black` | โลโก้ดำ `#211E1E` | พื้นขาวที่ต้องการ contrast สูง, เอกสาร |
| `grey` | โทนเทา | Footer, watermark, สถานะ inactive |
| `grey-reverse` | โทนเทากลับ | พื้นเทา / secondary surface |
| `secondary` | สีรอง (mark เท่านั้น) | Tab Services, badge รอง |
| `onYellow` | lockup บนพื้น `#F8B615` | CTA banner, ปุ่มแบรนด์, Smart App Banner |
| `onBlack` | lockup บนพื้น `#211E1E` / Deep Slate | Admin shell, dark mode hero |

---

## 3. ตารางเลือกไฟล์ตามบริบท (Usage Matrix)

### 3.1 Icon (Mark) — `icon-nestyk-*`

| บริบท UI | ไฟล์ที่ใช้ | Component |
|---|---|---|
| พื้นขาว / `#F8FAFC` | `icon-nestyk-standard` | `variant="mark"` |
| Preload วงกลมเหลือง `#F8B615` | `icon-nestyk-standard` | `variant="mark"` |
| Header สี role / พื้นดำ | `icon-nestyk-white` | `variant="markOnDark"` |
| Bottom tab Services | `icon-nestyk-secondary` | `variant="markSecondary"` |
| Smart App Banner (พื้น `#211E1E`) | `icon-nestyk-white` | `variant="markOnDark"` |
| App icon / favicon | `icon-nestyk-standard` | `apps/consumer-app/assets/icon.png` |
| Monochrome / PDF | `icon-nestyk-black` | import `brandIconBlack` |

### 3.2 Logo (Wordmark) — `logo-nestyk-*`

| บริบท UI | ไฟล์ที่ใช้ | Component |
|---|---|---|
| Web header, Workspace header | `logo-nestyk-standard` | `variant="wordmark"` |
| Login, Profile drawer (role สี) | `logo-nestyk-white` | `variant="wordmarkOnDark"` |
| Guest header / hero เหลือง `#F8B615` | `logo-nestyk-onYellow` | `variant="wordmarkOnYellow"` |
| Hero บนพื้นดำ `#211E1E` | `logo-nestyk-onBlack` | `variant="wordmarkOnBlack"` |
| Footer / muted | `logo-nestyk-grey` | import `brandLogoGrey` |
| Surface เทา | `logo-nestyk-grey-reverse` | import `brandLogoGreyReverse` |
| เอกสารขาวดำ | `logo-nestyk-black` | import `brandLogoBlack` |

---

## 4. การใช้งานในโค้ด (ห้าม hardcode path กระจาย)

### 4.1 แนะนำ — ใช้ Component กลาง

```tsx
// Web (Next.js)
import { NestykLogo } from '@nestyk/ui';
<NestykLogo variant="wordmark" height={28} />           // พื้นขาว
<NestykLogo variant="wordmarkOnYellow" height={24} />   // พื้นเหลือง
<NestykLogo variant="markOnDark" height={38} />         // พื้นดำ
<NestykLogo variant="wordmarkOnDark" height={34} />     // overlay มืด

// Mobile (Expo)
import { MobileNestykLogo } from '@nestyk/ui/native';
<MobileNestykLogo variant="wordmark" height={24} />
<MobileNestykLogo variant="mark" height={128} />         // preload วงกลมเหลือง
<MobileNestykLogo variant="markSecondary" height={22} /> // tab Services
<MobileNestykLogo variant="wordmarkOnYellow" height={30} /> // guest hero
```

**Variants ทั้งหมด:** `mark` · `markOnDark` · `markOnBrand` · `markSecondary` · `wordmark` · `wordmarkOnDark` · `wordmarkOnYellow` · `wordmarkOnBlack`

### 4.2 กรณีพิเศษ — import จาก `brandAssets`

```tsx
import {
  brandIcon,
  brandLogo,
  brandLogoWhite,
  brandLogoOnYellow,
  brandIconSecondary,
} from '@nestyk/ui';
```

แหล่งรวมอยู่ที่ `packages/ui/src/assets/brandAssets.ts` — **อัปเดต path ที่นี่ที่เดียว** ไม่ copy ไฟล์ไปแต่ละ app

### 4.3 Static asset โดยตรง (OG / Email / CMS)

```ts
// Next.js public หรือ import ใน Server Component
import logoSvg from '@nestyk/ui/assets/nestyk/svg/logo-nestyk-standard.svg';
```

---

## 5. รูปแบบไฟล์ตาม Platform

| Platform | รูปแบบ | เหตุผล |
|---|---|---|
| **Expo / React Native** | `png/` | Metro bundler — ใช้ PNG เท่านั้นใน runtime |
| **Next.js / Web** | `svg/` ผ่าน `NestykLogo` หรือ `<img>` | คมชัด retina, ขนาดเล็ก |
| **Marketing / Print** | `*.ai` | แก้ไข vector ต้นฉบับ — ไม่ commit เป็น runtime import |
| **App Store icons** | `packages/ui/assets/logo/IconApp/` | ขนาด fixed 1024/512/180 — ชุด legacy แยก |

---

## 6. Aspect Ratio (สำหรับกำหนด width จาก height)

| Variant | viewBox / สัดส่วน |
|---|---|
| Mark (`icon-*`) | **1 : 1** |
| Wordmark (`logo-*`) | **322 : 107** (~3.01 : 1) |

---

## 7. กฎการใช้งาน (Do / Don't)

**Do**
- ใช้ไฟล์จาก `packages/ui/assets/nestyk/` เท่านั้น — ห้ามให้ AI วาดโลโก้ใหม่
- เว้น clear space รอบ mark อย่างน้อย ½ ความสูง mark
- ใช้ `wordmarkOnDark` / `white` บนพื้น gradient สีเข้มเสมอ

**Don't**
- ห้ามยืด-non-uniform, ห้ามเปลี่ยนสี, ห้ามใส่ shadow บนโลโก้
- ห้าม import `*.ai` ในแอป
- ห้าม duplicate ไฟล์ไปที่ `apps/*/assets/` — ใช้ `@nestyk/ui` แทน

---

## 8. Catalog ไฟล์ทั้งหมด

### Icon (Mark)
| File (base name) | svg | png |
|---|---|---|
| `icon-nestyk-standard` | ✓ | ✓ |
| `icon-nestyk-white` | ✓ | ✓ |
| `icon-nestyk-black` | ✓ | ✓ |
| `icon-nestyk-secondary` | ✓ | ✓ |

### Logo (Wordmark)
| File (base name) | svg | png |
|---|---|---|
| `logo-nestyk-standard` | ✓ | ✓ |
| `logo-nestyk-white` | ✓ | ✓ |
| `logo-nestyk-black` | ✓ | ✓ |
| `logo-nestyk-grey` | ✓ | ✓ |
| `logo-nestyk-grey-reverse` | ✓ | ✓ |
| `logo-nestyk-onYellow` | ✓ | ✓ |
| `logo-nestyk-onBlack` | ✓ | ✓ |
