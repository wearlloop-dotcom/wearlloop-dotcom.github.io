# Logistics & Fulfillment (ส่ง/แพ็ค/ซัก/ซ่อม/ข้อพิพาท)
> raw: `shipout.html` · `logistics-pack.html` · `laundry.html` · `laundry-shops.html` · `repair.html` · `disputes.html` • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้
- `shipout.html` — เตรียมส่ง: พิมพ์สติ๊กเกอร์ชุด + ป้ายระวังของ + ใบปะหน้าถุงส่งกลับ (QR ชี้ `g.html`), ถ่ายรูป QC "ก่อนส่ง"
- `logistics-pack.html` — เอกสาร static ล้วน (ไม่ต่อ backend): ข้อมูลประกอบเจรจาเรทค่าขนส่งกับผู้ให้บริการ (volume deal)
- `laundry.html` — รับชุดกลับเข้าคิว → ตรวจสภาพ (QC: ดี/เปื้อน/ชำรุด/ของขาด) → ถ่ายรูป "ตอนรับคืน" → ปล่อยซักต่อ; NFC/QR check-in
- `laundry-shops.html` — ส่งชุดไปร้านซัก/รับกลับ + ทะเบียนร้านซัก (partner/in-house) + SLA alert ค้างเกิน 7 วัน + put-away หลังซัก
- `repair.html` — ประเมินซ่อม (ได้/ไม่ได้) → เลือกประเภท/ช่าง → ส่งซ่อม → ปิดงาน; มีปุ่ม "AI ช่วยประเมิน" + ทะเบียนช่าง
- `disputes.html` — ทะเบียนคดี/ข้อพิพาท: เปิดคดี, ผูกคู่กรณี (customer/contract/seller ฯลฯ) เพื่อดึงหลักฐานอัตโนมัติ, ออกหนังสือทวงถาม

## Flow (end-to-end ของโดเมน)
วงจร reverse-logistics ของชุดเช่า 1 รอบ:
1. **ส่งออก** (`shipout.html`): staff ใส่โค้ดชุด → `shipout_info` คืนข้อมูลชุด+ลูกค้า+ที่อยู่ส่งกลับ → พิมพ์สติ๊กเกอร์/ใบปะถุง, ถ่ายรูป QC `before` (`qc-photo.js` → `window.qcPhotoCapture`).
2. **รับกลับ + QC** (`laundry.html`): สแกน QR/NFC หรือพิมพ์โค้ด → `care_checkin` → ถ่ายรูป `after` → `care_qc` (condition = good/stain/damage/missing, ตั้งค่าเสียหาย) → ถ้า damage เข้าคิวซ่อม.
3. **ซัก** (`laundry.html` `care_wash_done` หรือ `laundry-shops.html`): ส่งร้านซัก `wash_send` → รับกลับ `care_wash_done` → ถ้าซักเสร็จและยังไม่เก็บช่อง → `put_away`.
4. **ซ่อม** (`repair.html`): งาน damage จาก QC โผล่ใน `repair_queue` → `repair_assess` + `repair_assign` (ส่งช่าง) → `repair_complete` (กลับเข้าคิวซัก) หรือ `repair_cant` (แจ้งเจ้าของ).
5. **ข้อพิพาท** (`disputes.html`): เคสไม่คืน/เสียหาย/ค้างจ่าย → เปิดคดีผ่าน gateway `acct` → ผูกคู่กรณี → ระบบรวบหลักฐาน (KYC, สัญญา, การเช่า, **รูป QC ก่อน/หลัง** จากขั้น 1-2, การชำระ, PDPA) → ออกหนังสือทวงถาม.

**การเชื่อม backend:** ทุกหน้ายกเว้น `logistics-pack.html` สร้าง supabase client ด้วย publishable key แล้ว override `sb.rpc = window.opsRpc` → RPC ทั้งหมดวิ่งผ่าน gateway `ops-rpc` (เช็ค staff active + role). ข้อยกเว้น 2 จุด: `disputes.html` เรียก edge function `acct` ตรง ๆ ด้วย `Authorization: Bearer <LINE idToken>` (gateway เดียวกับ accounting, owner/manager-only), และ `repair.html` เรียก `repair-advise` ผ่าน `sb.functions.invoke` (ไม่ผ่าน ops-rpc).

## Insight (รู้อะไร)
- โดเมนนี้คือหัวใจ reverse logistics: 1 การเช่า = 2 shipment (ส่งออก+ส่งคืน) และรูป QC `before`/`after` ที่ถ่ายในขั้นส่ง/รับ กลายเป็นหลักฐานสำคัญในหน้า `disputes.html` โดยอัตโนมัติ — โดเมนนี้จึงผูกกับ dispute/ประกันความเสียหายแน่น
- QR ทุกใบ (shipout) ชี้ `SITE_URL + /g.html?c=<code>` — โดเมนกลางมาจาก `config.js` (`SITE_URL`), เปลี่ยนที่เดียวได้
- `disputes.html` มี PII surface สูงมาก: ส่ง `party_ref` (uuid) จาก client → `acct` ดึง KYC/เลขบัตร/ที่อยู่/การชำระ/PDPA/รูป QC ของคู่กรณีคืนมาเต็ม — ความปลอดภัยพึ่ง server-side owner/manager check ใน `acct` ทั้งหมด (client เลือก uuid ได้อิสระ ตามดีไซน์ทำแฟ้มคดี)
- `logistics-pack.html` เป็นเอกสารเจรจา static ล้วน ตัวเลขมาจาก `ramp-plan.html`/forecast (ประมาณการ) ยังไม่มีตัวนับพัสดุจริงใน cockpit — เป็น doc ไม่ใช่ tool
- RPC ที่โดเมนนี้พึ่ง (ต้องอยู่ใน ops-rpc allowlist): `shipout_info`, `care_checkin`, `care_qc`, `care_wash_done`, `care_queue`, `tag_lookup`, `tag_scan`, `wash_send`, `laundry_vendors_list`, `laundry_vendor_upsert`, `laundry_vendor_set_active`, `put_away`, `bins_list`, `repair_types_list`, `repair_vendors_list`, `repair_queue`, `repair_assess`, `repair_assign`, `repair_cant`, `repair_complete`, `repair_vendor_upsert` — ตัวใหม่ถ้าตกจาก allowlist จะเจอ `fn_not_allowed`
- edge function ที่พึ่ง: `acct` (actions: dispute_open/list/get/event/update, demand_letter), `repair-advise` (AI, optional/dark — โค้ดรับกรณี "ยังไม่ deploy")

## Decision (ตัดสินใจอะไรไปแล้ว)
- ทุกหน้า ops รวมศูนย์ auth ผ่าน `ops-rpc` gateway (LINE login + role) — ไม่เรียกตารางตรงด้วย anon key
- ซักเริ่มจาก partner ก่อน (ลดแรงคน) แล้วค่อยขยับมา in-house — ทะเบียนร้านรองรับทั้ง 2 ชนิด
- QC form ใน `laundry.html` เปลี่ยนจาก `prompt()` ซ้อน 2 ชั้น (ค่าเพี้ยนบนมือถือ) มาเป็นฟอร์มในหน้า — decision ที่จดไว้ในคอมเมนต์
- ตั้งเป้าเจรจาขนส่งให้ต้นทุนจริง/ขา < ~฿40/การเช่า และล็อก auto-tier ตาม volume (logistics-pack)

## Issues (จาก static audit — severity)
- [medium] ไม่มี HTML-escaping ใน `repair.html` — `repair.html` — ทั้งไฟล์ไม่มี helper `esc()` แต่ interpolate ค่าจาก DB/staff ลง `innerHTML` ตรง ๆ: `${current}`, ชื่อชุด `${j.name}`, ชื่อช่าง `${v.name}`, และ **วิธีซ่อม/instructions** `${j.instructions}`/`${ex.instructions}` (free text จาก staff หรือผล AI advise) → stored/self-XSS ถ้า string มี `<`/`>`. หน้าพี่น้อง (`shipout.html`, `laundry.html`, `laundry-shops.html`, `disputes.html`) ทุกหน้ามี `esc()` — repair เป็นข้อยกเว้นเดียว
- [medium] `repair-advise` เรียกนอก gateway — `repair.html` — บรรทัด `sb.functions.invoke('repair-advise', …)` ใช้ raw supabase client (publishable key) ไม่ผ่าน `ops-rpc` และไม่ส่ง LINE idToken → ฟังก์ชันไม่รู้ว่า staff คนไหน + ใครถือ publishable key (public) ก็ยิงได้ = endpoint AI เปิด (เสี่ยง cost abuse). ขัดกับ pattern "ทุก RPC/ฟังก์ชัน ops ผ่าน gateway" ใน CLAUDE.md — ควรย้ายเป็น RPC ผ่าน ops-rpc หรือให้ตัวฟังก์ชัน verify idToken เอง
- [low] `esc()` ไม่ escape quote + ค่าเข้าไปใน attribute — `disputes.html` — `esc` แทนแค่ `&<>` ไม่แทน `"`; ค่าที่ admin กรอก (`police_report_no`, `court_case_no`) ถูกวางใน `value="${esc(...)}"` และ URL รูปหลักฐาน `<img src="${p.url||''}">` วางใน attribute โดยไม่ escape → ถ้ามี `"` จะหลุด attribute (แหล่งข้อมูล admin/signed-url → self-XSS, ผลกระทบต่ำ). `esc()` ระหว่างหน้าไม่สม่ำเสมอ: `laundry.html` escape `"` ด้วย ส่วน `shipout.html`/`disputes.html` ไม่
- [low] close-of-loop ไม่สม่ำเสมอ — `laundry.html` vs `laundry-shops.html` — `care_wash_done` คืน `needs_putaway`; `laundry-shops.html` `doDone()` ใช้ prompt เก็บเข้าช่องต่อทันที แต่ `laundry.html` `washDone()` ไม่อ่าน `needs_putaway` เลย (แค่ toast) → ชุดที่ปิดซักจากหน้า `laundry.html` ไม่ถูกเตือนให้ put-away, ต้องไปหน้า `putaway.html` แยก
- [low] partial-failure ในการส่งซ่อม — `repair.html` — `sendRepair()` ยิง `repair_assess` แล้วตามด้วย `repair_assign` แบบ 2 คำสั่งแยก ไม่มี rollback: ถ้า assess ผ่านแต่ assign fail จะได้ state ค้างครึ่งทาง (ประเมินแล้วแต่ยังไม่ส่งช่าง)

## Next action
- [ ] เพิ่ม `esc()` ใน `repair.html` แล้วครอบทุกจุดที่ interpolate ค่าจาก DB/AI ลง innerHTML (แก้ที่ `lloop/ops/repair.html` ต้นทาง ไม่ใช่รีโปนี้)
- [ ] ตัดสินใจ auth ของ `repair-advise`: ย้ายเป็น RPC ผ่าน ops-rpc หรือให้ฟังก์ชัน verify idToken + เช็ค staff เอง
- [ ] รวม `esc()` ให้ escape `"` ด้วย (มาตรฐานเดียวทั้งโดเมน) โดยเฉพาะจุดที่ค่าเข้าไปใน attribute (`disputes.html`)
- [ ] ทำ `laundry.html` `washDone()` อ่าน `needs_putaway` เหมือน `laundry-shops.html` เพื่อปิดลูปให้ครบ
- [ ] ยืนยันว่า RPC ทุกตัวในโดเมน + edge function `acct`/`repair-advise` อยู่ใน allowlist/deploy จริงบน Supabase (เทียบกับ repo `lloop`)

## Links
- [[ops-daily]] · [[stock-inventory]] · [[finance]] · [[customer-journey]]
