ปรับแอนิเมชัน Loading ของ NESTYK เป็นเวอร์ชัน Honey & Cream 2.5D

อ้างอิง:
- output/nestyk-hatch/nestyk-egg-idle-v2.svg
- output/nestyk-hatch/nestyk-egg-hatch-v2.svg
- output/nestyk-hatch/nestyk-honey-cream-peek-v3.png
- output/nestyk-hatch/nestyk-honey-cream-success-v3.png
- output/nestyk-hatch/preview-v2.html
- packages/ui (MobileNestykHatchLoader + assets/nestyk/hatch/)

ดีไซน์
- มาสคอต clay 2.5D: ตัวเหลืองทอง หน้า/ท้องครีม ตาเงา แก้มชมพู ปีกคาราเมล
- ไม่ใช้เส้นขอบดำ / flat vector สำหรับตัวนก
- ไข่เป็น gradient นุ่ม พื้นหลังโปร่งใส
- ขนาดแสดงผลประมาณ 80–100 px

Idle (~5.6s วน)
ไข่เต็ม → โยกเบา → ร้าว → โผล่ peek PNG → โยก/เอียงเบา → กลับเป็นไข่

Success (ครั้งเดียวแล้วค้าง)
ไข่ร้าว/จาง → success PNG เด้งนุ่ม → ค้างท่าหลับตายิ้มยกปีก → ประกายทองวน

Reduce Motion
- Idle = ไข่เต็มใบนิ่ง
- Success = ภาพ success PNG นิ่ง

ขอบเขตเดิมของ asset: เก็บไฟล์ v1 ไว้ · อย่าทับต้นฉบับ PNG

---

สรุปที่ปรับ (Honey & Cream)
- SVG v2 ฝัง PNG peek/success เป็นต้นแบบหลัก
- แอป: MobileNestykHatchLoader ใช้ Image PNG + SoftEgg (ไม่ใช่ flat bird)
- preview-v2: สลับโหมดไม่ cache-bust ทุกครั้ง (Replay เท่านั้น)
- Runtime assets: peek ~112KB · success ~124KB (RGBA โปร่ง)
