# Partners / B2B (พาร์ตเนอร์ / สาขา / สัญญา)
> raw: `partner.html` · `ops-partner.html` · `branches.html` · `contracts.html` · `contract.html` · `requests.html` • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้
- `contracts.html` — หลังบ้าน (owner/manager): ร่าง/แก้/ส่งสัญญาพาร์ทเนอร์ (stylist/influencer/supplier), เลือกโครงค่าตอบแทน, สร้างลิงก์เซ็น + KPI
- `contract.html` — หน้า **public token-based** ให้พาร์ทเนอร์อ่าน + เซ็นสัญญาอิเล็กทรอนิกส์ (เขียน clause ทั้งฉบับใน JS, มี signature pad)
- `partner.html` — **พอร์ทัลพาร์ทเนอร์ฝั่ง LIFF (ลูกค้า/พาร์ทเนอร์เข้าเอง)**: gate ด้วยสัญญาที่ลงนาม, สมัครเอง, บันทึกผลวิเคราะห์ลูกค้า, ปฏิทินเวลาว่าง, คิวจอง, ค่าตอบแทน
- `ops-partner.html` — **เวอร์ชันหลังบ้าน (owner-only)** ของฟอร์มวิเคราะห์ลูกค้า ให้ staff กรอกแทนพาร์ทเนอร์
- `branches.html` — เฟส 2: จัดการสาขา/ฮับ + จุดรับ-ส่งเสื้อ (dark launch, ค่าเริ่มต้น "ปิด")
- `requests.html` — **จริง ๆ คือหน้า Wishlist/waitlist ลูกค้า** (ไม่ใช่ partner requests) — ดูดีมานด์ชุด ปรับสถานะ แจ้งลูกค้า ส่งเข้าจัดซื้อ

## Flow (end-to-end ของโดเมน)
- **เซ็นสัญญา**: staff เปิด `contracts.html` → `contract_upsert` (ผ่าน `ops-rpc`) ได้ token → ลิงก์เซ็น = LIFF deep link `liff.line.me/<id>/contract.html?token=…` → `contract_send` push ทาง LINE → พาร์ทเนอร์เปิด `contract.html` → `contract_get` (anon + token) แสดงสัญญา → เซ็น `contract_sign` + `record_consent` (PDPA). เทมเพลต stylist จะโชว์ปุ่มสะพานไป `partner.html`.
- **make customer**: `contracts.html → contract_make_customer` แปลงพาร์ทเนอร์เป็นลูกค้า (ได้ link_code) เพื่อผูกเข้าระบบ
- **พอร์ทัลพาร์ทเนอร์**: `partner.html` เรียก `partner_portal_me` (`me-rpc`) เพื่อ gate — ผ่านเมื่อ `is_partner=true` → บันทึกผลวิเคราะห์ (`partner_portal_lookup/get/history`, `partner_save` ผ่าน buildPayload), เปิดเวลาว่าง (`partner_slots_add/partner_calendar_self`), รับคิว (`partner_bookings_self/partner_booking_update`), ดูรายได้ (`partner_earnings_self`). ทุก RPC วิ่งผ่าน `me-rpc` (verify idToken → inject `p_line_uid`, กัน IDOR). Storage (อัปรูป) ใช้ publishable client ตรง
- **ฝั่ง ops กรอกแทน**: `ops-partner.html` ทำงานเหมือนกันแต่ผ่าน `ops-rpc` ด้วย RPC ชุด `partner_lookup/partner_get/partner_save`
- **สาขา/จุดรับ-ส่ง**: `branches.html` → `branch_upsert/branch_list/branch_set_active` + `pickup_upsert/pickup_list/pickup_set_active` + `hr_employee_list` (ผ่าน `ops-rpc`)
- **wishlist**: `requests.html` → `wishlist_ops_list/wishlist_ops_update` (ผ่าน gateway — R-4 ย้ายจาก `.from()` anon เพราะมี `customer_uid` PII), `request_to_buy` (ส่งเข้าจัดซื้อ), `notify_customer_wishlist`, `waitlist_ops_summary`

## Insight (รู้อะไร)
- โดเมนนี้ครอบ 3 เรื่องที่ต่างกัน: **สัญญา** (KYC/e-sign), **พอร์ทัลสไตลิสต์พาร์ทเนอร์** (บันทึกผลวิเคราะห์ลูกค้า), และ **สาขา/จุดรับ-ส่ง** (เฟส 2)
- มีพอร์ทัลวิเคราะห์ลูกค้า 2 หน้าที่ทำงานทับซ้อนกัน: `partner.html` (พาร์ทเนอร์เข้าเองผ่าน LIFF/`me-rpc`) กับ `ops-partner.html` (staff กรอกแทนผ่าน `ops-rpc`) — โครงฟอร์ม/`fillForm`/`resetForm`/`buildPayload`/i18n เกือบเหมือนกันแต่อยู่คนละไฟล์
- `contract.html` เก็บ **เนื้อสัญญาเต็มทั้งฉบับใน JS** (`buildClauses`, `compSentence`, template stylist/influencer/supplier/custom) และ snapshot ข้อความไว้เป็นหลักฐานตอนเซ็น — ไม่ได้ดึงข้อความ clause จาก backend
- สัญญารองรับ comp 5 แบบ: commission / fixed / per_job / mixed / **quota** (เงินล่วงหน้าต่อหัว + คืนเงินส่วนที่ใช้ไม่ครบ) — quota เป็นดีลหลัก (พรีเซ็ต Classis 100×฿2,000)
- ลิงก์เซ็นใช้ LIFF deep link ตั้งใจให้ domain-agnostic (ย้าย github.io → lloop.app ได้โดยไม่ต้องแก้ token base)
- `branches.html` เป็น dark launch — สร้างไว้ล่วงหน้าได้ ค่าเริ่มต้น "ปิด" ไม่โชว์ลูกค้าจนกดเปิด (ตรงหลักการ feature flag ของโปรเจค)

## Decision (ตัดสินใจอะไรไปแล้ว)
- RPC ทั้งหมดของพอร์ทัลลูกค้าวิ่งผ่าน gateway (`me-rpc`/`ops-rpc`) ไม่เรียก `.from()` ตรง — `requests.html` มีคอมเมนต์ R-4 ระบุว่าย้ายจาก anon `.from()` มา gateway เพราะ `garment_requests` มี `customer_uid` (PII)
- e-sign ยึด **token ใน URL เป็นความลับ** (ไม่ผ่าน gateway) — เปิดใน browser ปกติหรือ LINE ก็ได้ (`contract.html` boot: LIFF init แบบไม่บังคับ)
- แยกพอร์ทัล 2 audience: พาร์ทเนอร์เข้าเอง (LIFF) vs staff กรอกแทน (ops) — ยอมรับ code duplication

## Issues (จาก static audit — severity)
- [medium] ดีมานด์ hardcode เป็น "1" — `requests.html` (บรรทัด ~346) ทุกแถว wishlist render `<div class="demand-num">1</div> คน` ตายตัว ขณะที่หัวคอลัมน์ "คนขอ" + คำโปรย "เรียงตามดีมานด์สูงสุด" สื่อว่าเป็นยอดรวมคนขอ → เข้าใจผิดว่าไม่มีชุดไหนมีดีมานด์ >1 (ยอดรวมจริงอยู่ในการ์ด waitlist แยกต่างหาก)
- [low] `line_uid` client-supplied ไม่ถูก verify — `contract.html` ส่ง `line_uid:lineUid` (มาจาก `liff.getProfile()` ฝั่ง client) เข้า `contract_get`/`contract_sign` ด้วย anon key ไม่ผ่าน gateway → backend เชื่อ identity นี้ไม่ได้ (spoof ได้) ต้องพึ่ง token เป็น guard เดียว; ถ้า backend ใช้ line_uid ให้สิทธิ์/ผูกตัวตน = เสี่ยง
- [low] โค้ดตายในเส้นทางลายเซ็นพิมพ์ — `contract.html` `checkReady()` (บรรทัด ~520-522) คำนวณ `const ok=…` แล้วไม่ใช้ และบังคับ `hasInk` เสมอ ทำให้ fallback ลายเซ็นแบบพิมพ์ชื่อใน `doSign` (`hasInk ? … : signerName`) เข้าไม่ถึง — เส้นทาง typed-signature ตายจริง
- [low] ฟอร์มวิเคราะห์ลูกค้าซ้ำ 2 ไฟล์ — `partner.html` กับ `ops-partner.html` มี `fillForm`/`resetForm`/`buildPayload`/preset 12-season/i18n เกือบเหมือนกัน แก้ schema วิเคราะห์ทีต้องแก้ 2 ที่ เสี่ยง diverge
- [low] ชื่อ/หมวดไฟล์เพี้ยน — `requests.html` (title "คำขอชุดจากลูกค้า", ops-menu label "คำขอชุดลูกค้า") จริง ๆ คือหน้า **Wishlist/waitlist ลูกค้า** ไม่ใช่ partner request/B2B — เนื้อหาใกล้ stock/customer-journey มากกว่า partners-b2b (จัดมาที่นี่ตามโจทย์ แต่ควรรู้ว่าคาบเกี่ยว)
- [info] allowlist ต้องมีครบ (ยืนยัน static ไม่ได้) — RPC `partner_*`, `contract_*`, `branch_*`, `pickup_*`, `wishlist_ops_*`, `waitlist_ops_summary`, `request_to_buy`, `notify_customer_wishlist`, `hr_employee_list` ต้องอยู่ใน allowlist ของ gateway และ RPC anon ของ `contract.html` (`contract_get/sign/decline`, `record_consent`) ต้อง expose ให้ anon — ถ้า allowlist drift จะเจอ `fn_not_allowed`

## Next action
- [ ] แก้ `requests.html`: ถ้า wishlist ควรโชว์ยอดรวมคนขอต่อชุด ให้ backend aggregate แล้วส่ง count จริง (เลิก hardcode 1) หรือปรับ copy "เรียงตามดีมานด์สูงสุด"/หัว "คนขอ" ให้ตรงว่าเป็นรายคำขอ *(ทำที่ repo lloop/ops — ห้ามแก้ที่รีโปนี้)*
- [ ] ทบทวนว่า backend ใช้ `line_uid` จาก `contract.html` ทำอะไร — ถ้าใช้ให้สิทธิ์/ผูกพาร์ทเนอร์ ควร verify ผ่าน idToken แทน client value
- [ ] พิจารณารวมฟอร์มวิเคราะห์ของ `partner.html`/`ops-partner.html` เป็น shared script เพื่อลด divergence
- [ ] ล้าง dead code typed-signature ใน `contract.html` (`ok` var + fallback ที่เข้าไม่ถึง) ให้ชัดว่ารองรับเฉพาะลายเซ็นวาด
- [ ] ตรวจ allowlist gateway ให้ครบตามรายการ RPC ข้างต้น (โดยเฉพาะ RPC สาขา/สัญญาที่เพิ่งเพิ่ม)

## Links
- [[stock-inventory]] — waitlist/wishlist เชื่อมกับสต๊อก + จัดซื้อ (`request_to_buy`)
- [[customer-journey]] — พาร์ทเนอร์บันทึกผลวิเคราะห์ที่ลูกค้าเห็นในแอป
- [[ops-daily]] — เมนู ops (ops-menu.js) ที่ลิงก์เข้าหน้าเหล่านี้ตาม role
- [[finance]] — ค่าตอบแทนพาร์ทเนอร์ / หัก ณ ที่จ่าย / quota advance
