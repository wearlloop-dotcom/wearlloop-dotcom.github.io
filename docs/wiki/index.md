# Wiki Index — ⚠️ อ่านหน้านี้ก่อนเสมอ แล้วเปิดเฉพาะหน้าที่เกี่ยว

_second brain ของ LLOOP · สร้างจาก multi-agent e2e audit (2026-07-13) · 1 บรรทัด/หน้า · จัดตาม PARA_

> วิธีใช้ (สำหรับ AI): ถามอะไรที่ต้องรู้บริบทโปรเจค → อ่าน index นี้ → เปิดเฉพาะหน้า `docs/wiki/<domain>.md` ที่เกี่ยว **ห้าม** scan ไฟล์ .html/.js ใหญ่ทั้งก้อน

## Areas (ความรับผิดชอบต่อเนื่อง)
- [customer-journey](customer-journey.md) — หน้าลูกค้า — index(SPA ใน app.js), quiz, looks, shop(public), g.html(สแกน QR จอง), review, my-events, join/group-checkout · login LINE ผ่าน me-rpc · ⚠️2 high
- [events-occasions](events-occasions.md) — งานแต่ง/อีเวนต์/ครอบครัว — wed.html (แชร์ลิงก์งานแต่งกันชุดชน), event.html (dashboard split-pay), family.html (ผูกกลุ่ม + AI จัดชุดเข้าตีม)
- [stock-inventory](stock-inventory.md) — สต็อก/รับเข้า/จัดซื้อ/รับซื้อ + ป้าย QR/NFC/CSV — ทุกหน้า ops วิ่งผ่าน gateway ops-rpc, ชุดใหม่เริ่มที่ needs_review · ⚠️1 high
- [ops-daily](ops-daily.md) — Ops รายวัน + คน: home/today/cockpit (ops-rpc), staff self-portal (me-rpc), hr admin, ops-looks — คร่อม 2 gateway; จุดเสี่ยงหลักคือ hr.html จัดการเอกสาร PII ผ่าน anon-key storage ตรง · ⚠️1 high
- [finance](finance.md) — โดเมนการเงิน: บัญชีหลังบ้าน (idToken gateway), พยากรณ์/แก้ราคาแพ็ก, บิล split-pay + QR พร้อมเพย์, ตรวจสลิป — auth ปนสองแบบ (idToken vs anon+UID) · ⚠️1 high
- [logistics-fulfillment](logistics-fulfillment.md) — Reverse logistics ของชุดเช่า: ส่งออก → รับกลับ+QC → ซัก → ซ่อม → ข้อพิพาท (ทุกหน้าผ่าน ops-rpc ยกเว้น disputes/acct + repair-advise)
- [marketing-growth](marketing-growth.md) — การตลาด/growth ของ LLOOP: content studio + อินฟลู + ไลฟ์ + UGC loop (admin↔customer) + รับซื้อ/เฝ้าตลาด + หน้า bio/การ์ดราคาสาธารณะ · ⚠️1 high
- [partners-b2b](partners-b2b.md) — พาร์ทเนอร์/สาขา/สัญญา: e-sign สัญญา (token), พอร์ทัลสไตลิสต์พาร์ทเนอร์ (LIFF + ops), สาขา/จุดรับ-ส่ง (เฟส 2) และหน้า wishlist ลูกค้า

## Resources (อ้างอิง/สถาปัตยกรรม)
- [trust-moats](trust-moats.md) — Trust & Moats — สมุดพกความเชื่อใจ (trust.html), เรื่องราวของชุด/passport (public anon), สัญญาเช่า+PDPA (static), about storytelling, และกองบุญ charity (ops owner-only)
- [backend-api](backend-api.md) — Backend/API layer — config กลาง + data layer ลูกค้า (api.js/app.js) + 2 gateway (me-rpc กัน IDOR, ops-rpc เช็ค role) + LIFF/i18n/analytics/webhook helpers
- [platform-infra](platform-infra.md) — Skills (banana/ig-9grid/movie-vibe/fact-check/scrape), second-brain docs, moat SQL records, และ AI studio ops pages (storyboard/video) — เครื่องมือ + คลังความรู้ + record ของ backend ที่ต้นทางจริงอยู่ repo lloop

## หน้าสรุปพิเศษ
- [AUDIT-SUMMARY](AUDIT-SUMMARY.md) — รวม issue ทุกโดเมนเรียงตาม severity (จาก e2e audit)
- [log](log.md) — บันทึกการ ingest/decision
