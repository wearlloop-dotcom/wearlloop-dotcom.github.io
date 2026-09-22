# ออดิทระบบ RFID / NFC — สถานะจริง

อัปเดต: 2026-08-06 · ตรวจจากซอร์สจริง (repo `lloop` + `wearlloop`) และฐานข้อมูล/edge functions
จริงบน Supabase project `rprwilsbjptdnvsibjgi` (read-only)

## สรุปฟันธง

**RFID ยังไม่ได้ "ทำจริง" — ไม่เคยถูกใช้งานเลย** แต่ **โครงซอฟต์แวร์มีครบและ deploy แล้ว**
เพียงแต่ยัง "หลับ" อยู่ (ไม่มีฮาร์ดแวร์ / ไม่มีแท็กจริง / ไม่มีหน้าจอเรียกใช้)

ยิ่งกว่านั้น **ระบบแท็กทั้งระบบ (รวม NFC) ยังไม่ได้ roll out** — ยังไม่มีชุดไหนติดแท็กเลยสักตัว

## หลักฐานจากฐานข้อมูลจริง (2026-08-06)

| ตัวชี้วัด (live DB) | ค่า |
|---|---|
| `garment_tags` ทั้งหมด | 0 |
| — ชนิด nfc | 0 |
| — ชนิด rfid | 0 |
| `tag_scans` ทั้งหมด | 5 (source rfid = 0 · น่าจะเป็นสแกนทดสอบ) |
| ชุดที่มี `last_seen_at` | 4 |
| Edge function `rfid-scan` | deploy แล้ว ACTIVE (v26) · fail-closed · ไม่เคยมี RFID scan เข้ามา |

## สิ่งที่ "มีจริง" (build แล้ว + บางส่วน deploy แล้ว)

ต้นทางอยู่ที่ repo `lloop`:

- **`supabase/tags.sql`** — ระบบแท็กรวม NFC + RFID ใช้โครงเดียวกัน (ยืนยันว่าตารางมีจริงบน DB):
  - `garment_tags(tag_uid, garment_id, tag_type)` — `tag_uid` เก็บได้ทั้ง **NFC UID และ RFID EPC**, `tag_type` = `nfc` / `rfid`
  - `tag_scans(tag_uid, garment_id, action, source, location, scanned_at)` — log การสแกน
  - `garments.last_seen_at / last_seen_action / last_seen_source` — ติดตามชุด (กันหาย)
  - RPC: `tag_register`, `tag_lookup`, `tag_scan`, **`tag_scan_bulk`** (อ่านทั้งราว/ตะกร้าทีเดียว — สำหรับ RFID), `tag_missing`
- **`supabase/functions/rfid-scan/index.ts`** — Edge function รับ EPC จากเครื่องอ่าน (ทีละหลายตัว)
  → ยิงเข้า `tag_scan_bulk` · **deploy แล้ว ACTIVE บน Supabase จริง** · fail-closed: ต้องตั้ง secret
  `RFID_SCAN_SECRET` ไม่งั้นปิด (403)

## สิ่งที่ "ยังไม่ได้ทำ" (ช่องว่างจริง)

- ไม่มีแท็ก RFID จริงสักตัว (และไม่มี NFC ด้วย — `garment_tags` = 0)
- ไม่มีฝั่ง frontend เรียก `tag_scan_bulk` เลย — หน้าที่ใช้ tag ทั้งหมดเป็น **NFC ล้วน**
  (`nfc.html`, `laundry.html`, `today.html`)
- ไม่มีเครื่องอ่าน UHF / middleware ที่ POST เข้า `rfid-scan`
- ไม่มี UI encode แท็ก RFID (`nfc.html` เขียนได้แค่ NFC ผ่าน Web NFC ซึ่งจำกัดเฉพาะ Android Chrome)
- ยังไม่ได้ตั้ง secret `RFID_SCAN_SECRET` ให้เปิดใช้ endpoint (สถานะปัจจุบัน = ปิด/fail-closed)

## ทำไม RFID ถึงเป็น "ก้อนใหญ่"

ไม่ใช่เพราะโค้ด (หลังบ้านพร้อมแล้ว) แต่เพราะเป็นงาน **กายภาพ + จัดซื้อ + ตัดสินใจลงทุน**:

1. **ฮาร์ดแวร์ทำในเว็บ/มือถือไม่ได้** — UHF (860–960MHz) คนละคลื่นกับ NFC (13.56MHz)
   มือถืออ่านไม่ได้ ต้องมีเครื่องอ่าน UHF แยก (ปืนสแกน/เสาอากาศติดราว)
2. **ต้องจัดซื้อ + ทดสอบของจริงก่อน** — ตาราง supplier ในชีตยังว่างเกือบหมด (2 ราย ไม่มีสเปก/ราคา)
   ต้องเลือกเจ้า → ขอตัวอย่าง → ทดสอบซักซ้ำ (จุดสำคัญของ Laundry Tag คือทนซัก) → เช็ก lead time
3. **เป็นการลงทุน** — แท็กมีต้นทุนต่อชิ้น + เครื่องอ่านเป็นค่าลงทุนก้อน ต้องคุ้ม ROI ก่อน

## ถ้าจะ "ทำ RFID จริง" — เหลืออะไร (งานซอฟต์แวร์เล็ก เพราะหลังบ้านพร้อม)

1. เลือก/ซื้อเครื่องอ่าน UHF + แท็ก (แนะนำ RFID UHF Laundry Tag — ทนซัก ตามสรุปในชีต)
2. ทดสอบทนซัก + ระยะอ่าน กับชุดจริงหลายเนื้อผ้า
3. ตั้ง secret `RFID_SCAN_SECRET` เปิด endpoint `rfid-scan`
4. ต่อ middleware จากเครื่องอ่าน → POST `{ epcs:[...], action, location }` เข้า `rfid-scan`
5. encode แท็ก + ผูกกับชุด (เรียก `tag_register` ด้วย `p_type='rfid'`)
6. ทำหน้าจอ ops 1 หน้า "นับสต๊อกบนราว / ตรวจรับ-คืน" ที่เรียก `tag_scan_bulk`
   (มี `tag_missing` สำหรับรายการชุดที่หายจากการนับอยู่แล้ว — `today.html` ใช้อยู่)

## หมายเหตุ

- ค่าที่ query จาก DB เป็น snapshot วันที่ออดิท — deploy จริงบน Supabase อาจใหม่กว่าซอร์สในรีโป `lloop`
  เสมอ (ตามที่ CLAUDE.md เตือน) ให้เทียบก่อนแก้
- เอกสารนี้เป็นบันทึกอ้างอิงเฉย ๆ ไม่กระทบการทำงานของเว็บ
