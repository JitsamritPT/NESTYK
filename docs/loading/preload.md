ปรับแอนิเมชัน Loading ของ NESTYK เป็นเวอร์ชัน Honey & Cream 2.5D

อ้างอิง:
- output/nestyk-hatch/nestyk-egg-idle-v2.svg
- output/nestyk-hatch/nestyk-egg-hatch-v2.svg
- output/nestyk-hatch/nestyk-honey-cream-head-v3.png
- output/nestyk-hatch/nestyk-honey-cream-peek-v3.png (reference only)
- output/nestyk-hatch/nestyk-honey-cream-success-v3.png
- output/nestyk-hatch/preview-v2.html
- packages/ui (MobileNestykHatchLoader + assets/nestyk/hatch/)

ดีไซน์
- มาสคอต clay 2.5D: ตัวเหลืองทอง หน้า/ท้องครีม ตาเงา แก้มชมพู ปีกคาราเมล
- ไม่ใช้เส้นขอบดำ / flat vector สำหรับตัวนก
- ไข่เป็น gradient นุ่ม พื้นหลังโปร่งใส
- ขนาดแสดงผลประมาณ 80–100 px

Idle (~6.2s วน)
ไข่นิ่ง → โยกเบา → ร้าว → ฝาแง้ม + หัวนก (head PNG) อยู่หลัง → มองเล็กน้อย → หลบก่อนฝาปิด → ปิด

Success (ครั้งเดียวแล้วค้าง)
ต่อจากสถานะเปิด (ไม่ย้อนไข่เต็มใบ) → success PNG เด้งนุ่ม → ค้างท่ายกปีก → ประกายทองวน

Reduce Motion
- Idle = ไข่ปิดนิ่ง (base+cap)
- Success = ภาพ success PNG นิ่ง

ขอบเขตเดิมของ asset: เก็บไฟล์ v1 ไว้ · อย่าทับต้นฉบับ PNG

---

สรุปที่ปรับ (ตรงดีไซน์ล่าสุด)
- Idle ใช้ `nestyk-honey-cream-head-v3.png` (ไม่ใช้ peek ทั้งตัว+เปลือก)
- แยก EggBase (นิ่ง) + EggCap (แง้ม) + head ด้านหลัง
- ลูป 6.2s ตาม keyframes ใน nestyk-egg-idle-v2.svg
- Success ไม่บังคับ eggOpacity=1 / ไข่เต็มก่อนเด้งนก
- Runtime: head + success PNG · SoftEgg ใบเดียวเลิกใช้ใน idle
