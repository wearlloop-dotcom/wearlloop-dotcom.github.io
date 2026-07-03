# LLOOP — SQL migrations ชุด "ขาดเราไม่ได้" (Life-cycle features)

> ➡️ **อ่าน [`INTEGRATION.md`](./INTEGRATION.md) ก่อน** — เป็น map ที่ตัดสินใจแล้วว่า "ต่อของเดิม"
> (เลิกใช้ตารางซ้ำ ให้เรียกตาราง/RPC จริงบน Supabase ผ่าน gateway `me-rpc`).
> ผลคือ **01/02/04 = DEPRECATED**, **03/05 = ปรับให้ตรง schema จริงแล้ว**, และเพิ่ม
> **06_adapters.sql** เป็น RPC บาง ๆ บนตารางจริง.

สคริปต์ฝั่ง Supabase — หน้าเว็บเรียกผ่าน RPC (fallback เป็น localStorage/ข้อมูลตัวอย่าง
อัตโนมัติก่อน deploy). ทุกฟังก์ชันฝั่งลูกค้ารับ `p_customer uuid` ที่ `me-rpc` เติมให้จาก
LINE idToken ที่ verify แล้ว (server-trusted — ไม่เชื่อ uid จาก client).

## ลำดับการรัน (Supabase Dashboard → SQL Editor)

| ลำดับ | ไฟล์ | สถานะ | ฟีเจอร์ | หน้าที่ใช้ |
|---|---|---|---|---|
| — | `01_customer_events.sql` | ⛔ DEPRECATED | ใช้ตาราง customer_events จริง + RPC ใน 06 แทน | `my-events.html`, `today.html` |
| — | `02_fit_dna.sql` | ⛔ DEPRECATED | ใช้ submit_review/recompute_garment_fit จริงแทน | `fit.html` |
| 1 | `03_closet_day.sql` | ✅ ADAPTED | LLOOP Day — key ด้วย customer_id, จัดกล่องจาก garments จริง | `closet-day.html` |
| — | `04_drop_points.sql` | ⛔ DEPRECATED | ใช้ pickup_points/pickup_* + pickup_interest จริงแทน | `drop-points.html` |
| 2 | `05_wrapped.sql` | ✅ ADAPTED | Loop Wrapped — อ่าน rentals/garments/customers จริง | `wrapped.html` |
| 3 | `06_adapters.sql` | ✅ NEW | RPC ที่ระบบยังไม่มี: mark_event_notified · upcoming_customer_events (ops) · pickup_interest_add | `today.html`, `drop-points.html`, n8n |

> **Deploy เฉพาะ 03 → 05 → 06 เท่านั้น** — 01/02/04 ห้าม deploy (เก็บไว้อ้างอิง).

## สิ่งที่ต้องปรับก่อนใช้จริง

- 03/05/06 อ้าง schema จริงแล้ว (customer_id + คอลัมน์จริงของ rentals/garments/customers/
  customer_events/pickup_interest) — **deploy ได้** โดยไม่ต้องแก้ชื่อคอลัมน์อีก
- `03_closet_day.sql`: ตาราง `closet_day_prefs`/`closet_boxes` เป็น **ของใหม่แต่ integrate แล้ว**
  (ระบบยังไม่มี ritual กล่องรายเดือน) — ฟังก์ชันจัดกล่องอ่าน `garments` จริง (`status='available'`)
  ให้คะแนนเทียบ `customers.bust_in/waist_in/my_color_season`
- `05_wrapped.sql`: ยังคง `to_regclass` guard — ถ้าตาราง rentals/garments หายจะคืน json ค่าศูนย์
  (ไม่ error). ประหยัดเทียบซื้อคิดจาก `garments.retail_value` จริง (เลิกใช้สูตร ×6)
- ทุกตารางใหม่เปิด RLS และไม่มี public policy — เข้าถึงผ่านฟังก์ชัน SECURITY DEFINER เท่านั้น

## ต้องเพิ่มใน ops-rpc allowlist

- `upcoming_customer_events` และ `mark_event_notified` (ใน `06_adapters.sql`) ถูก **revoke จาก
  anon/authenticated แล้ว** (เห็น/แก้ข้อมูลลูกค้าทุกคน — ฝั่ง ops เท่านั้น, grant ให้ `service_role`)
- `today.html` เรียกสองฟังก์ชันนี้ผ่าน **ops-rpc edge function** (service role) — ต้องเพิ่มชื่อทั้งสอง
  เข้า function allowlist ของ ops-rpc ด้วย ไม่งั้นหน้า ops จะเรียกไม่ได้เลย
  (หมายเหตุ: ทั้งสองอ้างตาราง `customer_events` จริง — **แทนที่** เวอร์ชันเดิมใน 01 ที่ deprecated)

## ปิดช่อง IDOR ฝั่งลูกค้า (me-rpc allowlist) — 2 ขั้น

หน้าลูกค้าเรียกผ่าน gateway `me-rpc` ก่อนเสมอเมื่อล็อกอิน (verify LINE idToken ฝั่ง server แล้ว
เติม `p_customer uuid` ให้เอง) — ทำ 2 ขั้นนี้เมื่อพร้อม:

1. **เพิ่มใน allowlist ของ edge function `me-rpc`** (gateway เติม `p_customer` จาก idToken ที่ verify แล้ว)
   — ฟังก์ชันฝั่งลูกค้าบนตารางจริงทั้งหมด:
   `pickup_interest_add`  *(06_adapters.sql)* · `my_wrapped`  *(05)* ·
   *(add_customer_event · my_events · remove_customer_event มีอยู่แล้วบน Supabase — อยู่ใน allowlist แล้ว)* ·
   `closet_day_get` `closet_day_set` `closet_box_swap` `closet_box_confirm` `closet_box_skip`
   `closet_box_unskip`  *(03_closet_day.sql)* ·  `my_wrapped`  *(05_wrapped.sql)*
2. **หลัง allowlist ใช้งานจริงแล้ว** ค่อย `revoke execute ... from anon, authenticated` กับฟังก์ชันด้านบน
   → เส้นยิงตรง (ที่เชื่อ uid จาก client) ตายสนิท เหลือแต่เส้น gateway ที่ปลอม uuid ไม่ได้
   (`mark_event_notified` / `upcoming_customer_events` = ops-rpc allowlist เท่านั้น ไม่อยู่ใน me-rpc)

## งานอัตโนมัติที่ต้องตั้งเพิ่ม (n8n หรือ pg_cron + LINE Messaging API)

1. **T-14 ping** — ทุกเช้า: `select * from upcoming_customer_events(14)` ที่ `pinged_at is null`
   → สไตลิสต์จัดลุค → ส่ง LINE push → กด "ทักแล้ว" ใน `today.html` (หรือเรียก `mark_event_pinged`)
2. **กล่อง LLOOP Day** — ทุกวัน: หาสมาชิกที่ `closet_day_prefs.day - 5 = วันนี้` → สร้าง/แจ้งกล่อง draft ทาง LINE
3. **Fit DNA nudge** — หลังสถานะเช่าเป็น "คืนแล้ว" 1 วัน → ส่งลิงก์ `fit.html` ทาง LINE
4. **Fan-out ปฏิทินแขกทั้งกลุ่ม** — เมื่อ book_group_cart/split สำเร็จ: สร้างแถว `customer_calendar`
   ให้สมาชิกทุกคนในกลุ่มที่มี line_uid (วันที่+occasion เดียวกับออเดอร์) — ฝั่งหน้าเว็บบันทึกให้เฉพาะ
   หัวหน้ากลุ่มแล้ว (`saveGroupCalendar` ใน group-checkout.html) เพราะ frontend ไม่รู้ uid ของแขก
5. **Auto-confirm กล่อง LLOOP Day** — ทุกวัน: `update closet_boxes set status='confirmed'`
   เฉพาะกล่อง `status='draft'` ที่วันเปลี่ยนตู้ของสมาชิก (จาก `closet_day_prefs.day`) เหลือ ≤ 5 วัน
   (คู่กับ LINE notification แจ้งลูกค้า) — ⚠️ ระหว่างที่ job นี้ยังไม่มี ข้อความบนหน้าเว็บตอนนี้
   บอกลูกค้าว่า "สไตลิสต์จะยืนยันทาง LINE ก่อนจัดส่ง" แทน auto-confirm

`CONFIG.N8N_BASE_URL` ใน `config.js` เว้นไว้รองรับข้อ 1-5 แล้ว

➡️ **workflow ทั้ง 5 ตัวสร้างไว้ให้แล้ว — import เข้า n8n ได้เลยที่โฟลเดอร์ [`automation/`](../automation/README.md)** (พร้อม LINE flex templates + คู่มือติดตั้ง)
