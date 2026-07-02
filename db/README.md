# LLOOP — SQL migrations ชุด "ขาดเราไม่ได้" (Life-cycle features)

สคริปต์ฝั่ง Supabase สำหรับฟีเจอร์ชุดใหม่ 4 ตัว ที่หน้าเว็บเรียกผ่าน RPC
(หน้าเว็บทุกหน้า **ทำงานได้ก่อน deploy SQL** — จะ fallback เป็น localStorage/ข้อมูลตัวอย่างอัตโนมัติ
พอรัน SQL แล้วข้อมูลจะเริ่มลงฐานจริงทันทีโดยไม่ต้องแก้หน้าเว็บ)

## ลำดับการรัน (Supabase Dashboard → SQL Editor)

| ลำดับ | ไฟล์ | ฟีเจอร์ | หน้าที่ใช้ |
|---|---|---|---|
| 1 | `01_customer_events.sql` | ปฏิทินงานลูกค้า + คิวสไตลิสต์ T-14 | `my-events.html`, `today.html` |
| 2 | `02_fit_dna.sql` | Fit DNA — feedback ความพอดีหลังคืนชุด | `fit.html` |
| 3 | `03_closet_day.sql` | LLOOP Day — วันเปลี่ยนตู้/กล่องประจำเดือน | `closet-day.html` |
| 4 | `04_drop_points.sql` | จุดรับ-ส่งใกล้บ้าน + ชุดฉุกเฉิน | `drop-points.html` |

## สิ่งที่ต้องปรับก่อนใช้จริง

- ฟังก์ชันที่ join กับตารางเช่า/ตารางชุด (`fit_feedback_pending`, การจัดกล่องใน `closet_day_get`)
  เขียนไว้กับโครงตารางแบบกลาง ๆ — **ต้องแก้ชื่อตาราง/คอลัมน์ให้ตรง schema จริง** (มีคอมเมนต์ `-- TODO` กำกับในไฟล์)
- ⚠️ `closet_day_get` และ `closet_box_swap` อ้าง `public.garments` **ตรง ๆ** — ถ้ายังไม่มีตารางนี้
  (หรือชื่อจริงเป็นอย่างอื่น) ฟังก์ชัน **จะ error ทันที ไม่ใช่ fallback** — ต้องสร้าง/เปลี่ยนชื่อให้ตรง
  schema จริงก่อนเปิดใช้ LLOOP Day เท่านั้น
- `04_drop_points.sql` มี seed จุดรับ-ส่งตัวอย่าง 3 จุด (กทม.) — แก้เป็นจุดพาร์ทเนอร์จริงก่อนเปิดใช้
- ทุกตารางเปิด RLS และไม่มี public policy — เข้าถึงผ่านฟังก์ชัน SECURITY DEFINER เท่านั้น (ตาม convention เดิมของระบบ)

## ต้องเพิ่มใน ops-rpc allowlist

- `upcoming_customer_events` และ `mark_event_pinged` ถูก **revoke จาก anon/authenticated แล้ว**
  (เห็นข้อมูลลูกค้าทุกคน + เปลี่ยนสถานะ pinged ได้ — เป็นฟังก์ชันฝั่ง ops เท่านั้น)
- `today.html` เรียกสองฟังก์ชันนี้ผ่าน **ops-rpc edge function** (service role) — ดังนั้นต้องเพิ่ม
  ชื่อทั้งสองเข้า function allowlist ของ ops-rpc ด้วย ไม่งั้นหน้า ops จะเรียกไม่ได้เลย
  (หลังแก้สิทธิ์แล้ว gateway นี้คือ **ทางเดียว** ที่เรียกได้)

## งานอัตโนมัติที่ต้องตั้งเพิ่ม (n8n หรือ pg_cron + LINE Messaging API)

1. **T-14 ping** — ทุกเช้า: `select * from upcoming_customer_events(14)` ที่ `pinged_at is null`
   → สไตลิสต์จัดลุค → ส่ง LINE push → กด "ทักแล้ว" ใน `today.html` (หรือเรียก `mark_event_pinged`)
2. **กล่อง LLOOP Day** — ทุกวัน: หาสมาชิกที่ `closet_day_prefs.day - 5 = วันนี้` → สร้าง/แจ้งกล่อง draft ทาง LINE
3. **Fit DNA nudge** — หลังสถานะเช่าเป็น "คืนแล้ว" 1 วัน → ส่งลิงก์ `fit.html` ทาง LINE
4. **Auto-confirm กล่อง LLOOP Day** — ทุกวัน: `update closet_boxes set status='confirmed'`
   เฉพาะกล่อง `status='draft'` ที่วันเปลี่ยนตู้ของสมาชิก (จาก `closet_day_prefs.day`) เหลือ ≤ 5 วัน
   (คู่กับ LINE notification แจ้งลูกค้า) — ⚠️ ระหว่างที่ job นี้ยังไม่มี ข้อความบนหน้าเว็บตอนนี้
   บอกลูกค้าว่า "สไตลิสต์จะยืนยันทาง LINE ก่อนจัดส่ง" แทน auto-confirm

`CONFIG.N8N_BASE_URL` ใน `config.js` เว้นไว้รองรับข้อ 1-4 แล้ว
