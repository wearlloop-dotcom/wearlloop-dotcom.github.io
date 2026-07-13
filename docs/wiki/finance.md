# Finance (บัญชี / พยากรณ์ / ชำระเงิน)
> raw: `accounting.html` `forecast.html` `pay.html` `slips.html` `promptpay.js` `pixel.js` • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้
- `accounting.html` — บัญชีหลังบ้าน (owner/manager): งบกำไรขาดทุน/ดุล/ทดลอง, ภ.พ.30, ภ.ง.ด.3/53, ใบกำกับ, ลูกหนี้/เจ้าหนี้, ภาษีนิติบุคคล, OCR อ่านเอกสาร→ลงบัญชีคู่, ทำรายการ
- `forecast.html` — หน้าเจ้าของ: ประมาณการ (target→คน/ชุด/ทีม/กำไร) + โหมด "ของจริงเดือนนี้" + มาร์จิ้นแพ็กสมาชิก + แก้ราคาแพ็ก (เขียนกลับ DB)
- `pay.html` — บิลรายคนของ split-pay (ลูกค้า): แสดงส่วนที่ตัวเองต้องจ่าย, QR พร้อมเพย์ฝังยอด, ปุ่ม "ฉันโอนแล้ว"
- `slips.html` — กล่องสลิปโอน (owner/manager): ตรวจสลิปที่ลูกค้าส่ง, ดูรูป, ยืนยัน/ปฏิเสธ
- `promptpay.js` — สร้าง payload PromptPay (EMVCo + CRC16) + วาด QR แบรนด์ LLOOP (`window.promptpayPayload` / `promptpayBrandedQR`)
- `pixel.js` — Meta Pixel scaffold (no-op ถ้ายังไม่ตั้ง `CONFIG.META_PIXEL_ID`)

## Flow (end-to-end ของโดเมน)
- **ลูกค้าจ่าย (pay.html):** เปิดจาก deep-link LINE `?order=<order_group>` → `API.init()` (LIFF) → `group_order_summary(p_order,p_requester)` ผ่าน **me-rpc** → แสดงบิล + `pay_info()` (anon) โชว์บัญชี/พร้อมเพย์ → `promptpayBrandedQR` วาด QR ฝังยอด → กด "ฉันโอนแล้ว" → `group_pay_confirm` ปลด hold. มี MOCK ในไฟล์เมื่อไม่ได้ login/`USE_MOCK`.
- **ตรวจเงินเข้า (slips.html):** owner login LINE → `acct` function `action:'slips'` ดึงสลิป → `slip_view` เปิดรูปผ่าน signed URL 10 นาที → ยืนยันเรียก `confirm_payment(p_payment)` ผ่าน **ops-rpc** (ลง GL รายได้ + ปลด hold + แจ้งลูกค้า).
- **ลงบัญชี (accounting.html):** owner login LINE (idToken) → POST ไป Edge Function `acct` (Bearer idToken, gateway เช็ค owner/manager) ทุก action (pnl/balance/vat/wht/issue_invoice/pay_partner/acquire/recognize/depreciate…). OCR ไป `acct-ocr` สกัดเอกสาร→ลงบัญชีคู่.
- **วางแผน (forecast.html):** เจ้าของ → เรียก Supabase **ตรงด้วย anon key** (ไม่ผ่าน gateway): `forecast_actuals(p_uid)`, `plan_economics()`, `update_plan_price(p_uid,...)`. gating = ค่า `data.owner` ที่ backend คืนจาก `p_uid` (LINE UID ที่ client ส่ง/วาง/เก็บใน localStorage).

## Insight
- **สองสถาปัตยกรรม auth ปนกันในโดเมนเดียว:** accounting.html + slips.html ทำถูกตามกติกา (Bearer LINE idToken → gateway `acct`/`ops-rpc` verify ฝั่ง server). แต่ **forecast.html เป็นข้อยกเว้น** — เรียก RPC ตรงด้วย anon key แล้วใช้ `p_uid` (LINE UID) ที่ client ส่งเองเป็นตัวพิสูจน์ความเป็นเจ้าของ = UID กลายเป็น "รหัสผ่าน" โดยพฤตินัย (เก็บใน localStorage, วางมือได้).
- `promptpay.js` คำนวณ payload เองครบ (tag 01 เบอร์ / 02 บัตร ปชช / 03 e-wallet) + CRC16 + QR EC level H เผื่อโลโก้บัง ~22% — พึ่งพา CDN `qrcode-generator@1.4.4` (โหลดใน pay.html).
- `pay_info` และ `plan_economics` เปิดให้ anon เรียกได้ (แสดงบัญชีรับเงิน/ราคาแพ็ก) — ตั้งใจให้ public, ไม่ถือความลับ.
- slips.html map ผล verify สลิปเป็นป้ายไทย 3 กลุ่ม (confirmed/pending/problem) รวม `not_configured`→"รอยืนยันมือ".

## Decision
- OCR + ลงบัญชีคู่อัตโนมัติ ("คนน้อย AI มาก") — มี preview ก่อน post เสมอ, ยืนยันด้วยมือก่อนลงจริง.
- ระบบตั้งใจให้ recognize รายได้ / depreciate รันอัตโนมัติทุกวันที่ 1 — ปุ่มในแท็บ "ทำรายการ" ไว้รันเพิ่มเอง.
- แก้ราคาแพ็กจาก forecast.html เขียนกลับ DB ทันที มีผลหน้าลูกค้าเลย (`update_plan_price`).
- `pixel.js` dark-launch: ปิดสนิทจนกว่าจะใส่ Pixel ID.

## Issues (จาก static audit — severity)
- [high] **forecast.html ใช้ anon key + `p_uid` จาก client เป็น authz** — `forecast.html` — เรียก `forecast_actuals`/`update_plan_price` ตรง (ไม่ผ่าน gateway) โดย gating ด้วย LINE UID ที่ client ส่งเอง (พิมพ์วางในช่อง `uidin` / อ่านจาก `localStorage 'lloop_owner_uid'`). ต่างจาก accounting.html/slips.html ที่ verify idToken. ใครได้ UID เจ้าของ (LINE userId leak ได้จาก group member ids/logs) = เข้าถึงงบการเงินทั้งหมด + แก้ราคาแพ็กที่มีผลหน้าลูกค้า. ควรย้ายไป gateway ที่ verify idToken แล้ว inject identity เอง (เหมือน `acct`).
- [medium] **pay.html ส่ง `p_requester` (customer id) จาก client** — `pay.html`/`api.js:801,807` — `group_order_summary`/`group_pay_confirm` รับ `p_requester: requester.id` จาก client เป็นตัวตัดสิน "บิลนี้ของคุณไหม" (มี path `denied`→"นี่ไม่ใช่บิลของคุณ"). กติกาโปรเจคระบุ me-rpc ควร inject identity ที่ verify แล้ว — พารามิเตอร์ชื่อ `p_requester` (ไม่ใช่ `p_customer` ที่ gateway inject) ต้องยืนยันกับ backend ว่า gateway override จริง ไม่งั้นเป็น IDOR (ดู/กดยืนยันจ่ายบิลของสมาชิกคนอื่นได้ถ้ารู้ order_group + customer id).
- [medium] **ลิงก์พิมพ์ใบกำกับชี้ไฟล์ที่ไม่มีในรีโป** — `accounting.html:202` — ปุ่ม "พิมพ์" ในแท็บใบกำกับลิงก์ `tax-doc.html?type=invoice&id=…` แต่ **ไม่มี `tax-doc.html`** ในรีโป → 404. (อาจเป็นหน้าที่ยังไม่ deploy หรือลืม publish จาก lloop).
- [low] **ปุ่ม "ปฏิเสธ" สลิปเป็น no-op** — `slips.html:187` — `rejectSlip` แค่ toast ว่ายังไม่เชื่อม backend (ต้องเพิ่ม RPC void/reject payment). ปุ่มดูใช้งานได้แต่ไม่ทำอะไร → พนักงานเข้าใจผิดว่าปฏิเสธแล้ว. (โค้ดยอมรับไว้ในคอมเมนต์).
- [low] **Function URL/anon config hardcode + version querystring ไม่ตรงกัน** — `accounting.html:106`,`slips.html:96`,`pay.html` — ฝัง `…/functions/v1/acct` ตรง ๆ ไม่ดึงจาก CONFIG; pay.html โหลด `config.js?v=38` แต่ `api.js?v=54` (cache-bust ไม่ซิงก์). ไม่ใช่ช่องโหว่ (URL/anon เป็น public) แต่เสี่ยง config drift.

## Next action
- [ ] ย้าย forecast.html ไปใช้ gateway ที่ verify idToken (owner-only) แทน anon+`p_uid` — เลิกใช้ UID เป็นรหัสผ่าน
- [ ] ยืนยันกับ repo `lloop` ว่า me-rpc override `p_requester` ของ group_order_summary/group_pay_confirm ฝั่ง server (กัน IDOR); ถ้าไม่ ต้องแก้ gateway
- [ ] publish/สร้าง `tax-doc.html` (ต้นทาง `lloop/ops` หรือ `liff`) หรือเอาลิงก์ "พิมพ์" ออกจน backend พร้อม
- [ ] เพิ่ม RPC void/reject payment แล้วต่อปุ่มปฏิเสธใน slips.html (ปิดปุ่มไว้ก่อนถ้ายังไม่มี)

## Links
- [[stock]] · [[customer-journey]] · [[settings]] (feature flags / pay config)
