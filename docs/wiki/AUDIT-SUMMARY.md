# AUDIT SUMMARY — LLOOP end-to-end (2026-07-13)

static audit โดย multi-agent 11 โดเมน · รวม **61 issue** (critical 0 · high 6 · medium 21 · low 34)

> ⚠️ เป็น **static analysis** (รันเว็บจริงไม่ได้) — โดยเฉพาะเคส IDOR/authz ต้องยืนยันกับ SQL/gateway ฝั่ง Supabase (repo `lloop`) ก่อนสรุปว่าเป็นช่องโหว่จริง
> 🛠️ หน้า ops/liff แก้ที่ต้นทาง repo `lloop` (`lloop/ops/`, `lloop/liff/`) เท่านั้น — แก้ในรีโปนี้จะโดน auto-deploy ทับ

## 🔴 High (ยืนยันแล้ว/ต้องรีบดู)

- **[customer-journey]** เมนูลูกค้า "อยากได้ชุดไหน บอกเราได้" ชี้ไปหน้า OPS — `app.js:2230` ⏳ยังไม่ auto-verify
  - route ลูกค้าไป wishlist.html ซึ่งเป็นคอนโซลพนักงาน (ops-api/opsLogin) → ลูกค้าเจอ staff gateway no_access/วน login ไม่มีฟอร์มขอชุด
- **[customer-journey]** รีวิวสำเร็จถูกมองเป็น error เสมอ — `review.html:817` ⏳ยังไม่ auto-verify
  - เช็ก if(j.ok) แต่ me-rpc คืน {data,error} ไม่มี ok → ส่งรีวิวสำเร็จแต่โชว์ "ส่งรีวิวไม่สำเร็จ" ทุกครั้ง
- **[finance]** forecast.html ใช้ anon key + p_uid จาก client เป็น authz (weaker than idToken gateway) — `forecast.html` ✅ยืนยัน(adversarial)
  - forecast.html เรียก Supabase ตรงด้วย anon key ไม่ผ่าน gateway: client().rpc('forecast_actuals',{p_uid:uid}), plan_economics(), update_plan_price({p_uid,...}). การพิสูจน์ความเป็นเจ้าของอาศัย data.owner ที่ backend คืนจาก p_uid = LINE UID ที่ client ส่งเอง (พิมพ์วางในช่อง uidin บรรทัด ~426, อ่านจาก localStorage 'lloop_owner_uid' บรรทัด 422/438). ต่างจาก accounting.html/slips.html ที่ verify LINE idToken ผ่าน gateway. ผู้ที่ได้ LINE userId ของเจ้าของ (leak ได้จาก group member ids/logs) สามารถเข้าถึงงบการเงินทั้งหมด และเรียก update_plan_price แก้ราคาแพ็กที่มีผลต่อหน้าลูกค้าทันที. ทำซ้ำ: วาง owner UID ในช่องปลดล็อก → showMain() → เข้าถึงข้อมูล/แก้ราคาได้
- **[marketing-growth]** ลิงก์ placeholder ตายบนหน้า bio สาธารณะ (CTA หลัก) — `links.html` ✅ยืนยัน(adversarial)
  - บรรทัด 384 ปุ่มหลัก 'Start now/Try free' href="https://liff.line.me/YOUR_LIFF_ID", บรรทัด 450 lin.ee/YOUR_LINE_ID, บรรทัด 489 line.me/ti/g2/YOUR_OPENCHAT_ID ยังเป็น placeholder → กดแล้วไปหน้า error. LIFF_ID จริงมีใน config.js (2010486714-1g6lDuHo) แต่ links.html ไม่โหลด config ต้องแก้ค่ามือ. เป็นลิงก์แปลงลูกค้าหลักบนหน้าที่แปะใน bio โซเชียล
- **[ops-daily]** เอกสาร HR (PII) จัดการผ่าน anon-key storage ตรง ไม่ผ่าน gateway — `hr.html` ✅ยืนยัน(adversarial)
  - uploadDoc() เรียก sb.storage.from('hr-docs').upload(...) + getPublicUrl(path) แล้วเก็บ public URL ลง DB ผ่าน hr_doc_add; viewDoc() สร้าง signed URL เอง. ทั้งหมดใช้ publishable/anon key (public ใน config.js) ยิงตรงเข้า Supabase Storage. ถ้า bucket hr-docs มี policy อนุญาต anon = PII (บัตร ปชช./สัญญา) หลุดถึงใครก็ได้ที่มีคีย์; ถ้า private ล้วน flow ทำงานได้เฉพาะเมื่อ anon role มีสิทธิ์ storage (พื้นผิวสิทธิ์นอก gateway). ขัด CLAUDE.md (ops ต้องผ่าน ops-rpc) และขัดกับ staff.html ที่ย้ายไป edge function kyc แล้ว (line 511-514)
- **[stock-inventory]** QR ป้ายเย็บติดชุดชี้โดเมน/พาธที่ยังไม่มีจริง — `care-label.html` ✅ยืนยัน(adversarial)
  - บรรทัด 97/147/148: QR_BASE='https://lloop.app/g/' + code สร้าง URL เช่น https://lloop.app/g/g1 ต่างจากหน้าอื่นทั้งหมด (labels/intake/nfc) ที่ใช้ CONFIG.SITE_URL + /g.html?c=<code> ซึ่ง g.html อ่าน ?c= จริง. โดเมน lloop.app ยังไม่ผูก DNS (config SITE_URL = wearlloop-dotcom.github.io) และพาธ /g/g1 ไม่มี route → QR บนป้ายที่เย็บติดถาวรกับชุดสแกนแล้วเปิดหน้าชุดไม่ได้

## 🟠 Medium

- **[backend-api]** anon-key เข้าตารางตรง เลี่ยง gateway (พึ่ง RLS ล้วน) — `api.js`
- **[backend-api]** KYC gate ยิง anon RPC ด้วย customer id จาก client (IDOR pattern) — `app.js`
- **[customer-journey]** หน้า public อ่านตาราง garments ตรงด้วย anon — `shop.html:171`
- **[customer-journey]** อัปโหลดรูปรีวิวด้วย anon key ตรง bypass gateway — `review.html:731`
- **[customer-journey]** ส่ง id ลูกค้าจาก client (p_uid) — `review.html:809`
- **[events-occasions]** IDOR ที่ต้องยืนยันฝั่ง backend: identity ส่งผ่าน p_requester/p_host/p_actor ที่ gateway ไม่ override — `api.js`
- **[events-occasions]** copy หลอกแขกที่ยังไม่ล็อกอิน — เห็น 'ไม่พบงานนี้' แทนที่จะให้ล็อกอิน — `wed.html`
- **[finance]** pay.html ส่ง p_requester (customer id) จาก client เป็นตัวตัดสินเจ้าของบิล — เสี่ยง IDOR — `pay.html`
- **[finance]** ลิงก์ 'พิมพ์' ใบกำกับชี้ tax-doc.html ที่ไม่มีในรีโป (404) — `accounting.html`
- **[logistics-fulfillment]** ไม่มี HTML-escaping ใน repair.html (stored/self-XSS) — `repair.html`
- **[logistics-fulfillment]** repair-advise เรียกนอก ops-rpc gateway (endpoint AI เปิด) — `repair.html`
- **[marketing-growth]** หน้าผู้ขายสาธารณะถูกล็อกด้วย staff gate (intent mismatch) — `seller.html`
- **[marketing-growth]** หน้า public อ่าน table เกิน whitelist ด้วย anon key — `ig-card.html`
- **[ops-daily]** ลิงก์เอกสารในพอร์ทัลพนักงานใช้ raw url อาจเปิดไม่ขึ้น/ชี้ลิงก์สาธารณะ — `staff.html`
- **[partners-b2b]** ดีมานด์ wishlist hardcode เป็น 1 ทุกแถว — `requests.html`
- **[platform-infra]** Storyboard Studio ไม่มี record/stub ใน sql/ (go-live untracked) — `sql/2026-07-video-studio.sql`
- **[stock-inventory]** ลิงก์ ส่งเข้าคลัง ส่ง query params ที่ intake.html ไม่อ่าน (prefill ไม่ทำงาน) — `acquisitions.html`
- **[trust-moats]** passport footer ชี้ผิดหน้า — 'ทีมงาน LLOOP' ไปหน้าเครื่องมือ NFC ของพนักงาน — `passport.html`
- **[trust-moats]** og:image ชี้ GitHub org ผิด (lloop-studio) น่าจะ 404 เวลาแชร์ — `about.html`
- **[trust-moats]** Instagram handle ไม่ตรงกันข้ามหน้า (@lloop.studio vs @lloop.th) — `about.html`
- **[trust-moats]** สัญญาเช่าไม่พูดถึงสิทธิ์ไม่วางมัดจำ ขัดกับหน้า trust — `rental-terms.html`

## 🟡 Low

- **[backend-api]** coupling กับ allowlist ของ gateway ที่อยู่คนละรีโป — `api.js`
- **[backend-api]** ฟีเจอร์ wired แต่ inert ใน production — `config.js`
- **[backend-api]** Google Maps key เปิดในไฟล์ static พึ่ง referrer restriction ล้วน — `config.js`
- **[backend-api]** double liff.init ต่อการโหลดหน้า — `liffAuth.js`
- **[customer-journey]** หน้า ops ปนในเซ็ตหน้าลูกค้า — `wishlist.html,feedback.html`
- **[customer-journey]** i18n ตกหล่น — `shop/g/join/review/quiz`
- **[customer-journey]** config drift — `config.js`
- **[events-occasions]** wed_share_pick ล็อกชุดเป็น 'reserved' (hard-taken) ก่อนจองจริง — `wed.html`
- **[events-occasions]** footer 'หน้าตัวอย่าง' ค้างในโหมด LIVE — `family.html`
- **[events-occasions]** เวอร์ชัน cache-bust ของสคริปต์ร่วมไม่ตรงกันข้ามหน้า — `wed.html`
- **[events-occasions]** demoNote อ้าง path liff/api.js ที่ไม่มีในรีโปนี้ + nav.js dead include — `event.html`
- **[finance]** ปุ่ม 'ปฏิเสธ' สลิปเป็น no-op (ยังไม่ต่อ backend) — `slips.html`
- **[finance]** Function URL hardcode + version querystring ไม่ซิงก์กัน (config drift) — `accounting.html`
- **[logistics-fulfillment]** esc() ไม่ escape quote + ค่าเข้าไปใน attribute — `disputes.html`
- **[logistics-fulfillment]** close-of-loop put-away ไม่สม่ำเสมอระหว่างหน้าซัก — `laundry.html`
- **[logistics-fulfillment]** partial-failure ในการส่งซ่อม (assess+assign แยก 2 คำสั่ง) — `repair.html`
- **[marketing-growth]** escape ไม่ครบเสี่ยง XSS อ่อนใน render — `creator.html`
- **[marketing-growth]** RPC ต้องอยู่ใน allowlist ของ gateway (ตรวจ static ไม่ได้) — `marketing.html`
- **[marketing-growth]** การวัดผลการตลาดยังไม่ต่อ (GA4/n8n) — `config.js`
- **[ops-daily]** แท็บ ROI ตั้ง label เป็นการกรองแต่โค้ดไม่กรองจริง — `cockpit.html`
- **[ops-daily]** คีย์/URL Supabase ฝังซ้ำหลายไฟล์แทนอ่านจาก CONFIG — `today.html / cockpit.html / ops-looks.html / hr.html`
- **[partners-b2b]** line_uid client-supplied ไม่ verify ใน e-sign — `contract.html`
- **[partners-b2b]** dead code เส้นทางลายเซ็นแบบพิมพ์ชื่อ — `contract.html`
- **[partners-b2b]** ฟอร์มวิเคราะห์ลูกค้าซ้ำ 2 ไฟล์ — `ops-partner.html`
- **[partners-b2b]** requests.html ชื่อ/หมวดไม่ตรงเนื้อหา — `requests.html`
- **[platform-infra]** ยังไม่มีบันทึกยืนยันว่า storyboard_studio_enabled ถูกเพิ่มใน allowlist hub_settings_set — `settings.html`
- **[platform-infra]** auto-enable ปลั๊กอิน third-party watch@claude-video — `.claude/settings.json`
- **[platform-infra]** sql/2026-07-expansion-flags-trust.sql เป็น comment ล้วน (no-op ถ้าถูกรัน) — `sql/2026-07-expansion-flags-trust.sql`
- **[stock-inventory]** stored-XSS ในหน้าปริ้น (ฟิลด์ชุดไม่ escape) — `labels.html`
- **[stock-inventory]** id อิลิเมนต์สร้างจากโค้ดชุดแบบ raw ไม่ sanitize — `care-label.html`
- **[stock-inventory]** ไฟล์จัดหมวดผิดโดเมน (เป็นหน้าลูกค้า ไม่ใช่สต็อก) — `color-report.html`
- **[trust-moats]** charity.html hardcode SUPABASE_URL/KEY inline แทน config.js — `charity.html`
- **[trust-moats]** charity.html upload storage ด้วย anon client ตรง ไม่ผ่าน gateway — `charity.html`
- **[trust-moats]** PDPA/สัญญาใช้ personal gmail เป็น data-controller contact ไม่มีนิติบุคคล/DPO — `privacy.html`

## Next actions รวม (ต่อโดเมน)

### customer-journey
- [ ] แก้ route ปุ่ม "อยากได้ชุดไหน" (app.js:2230) ไปหน้าลูกค้าจริง ไม่ใช่ wishlist.html (ops)
- [ ] แก้ review.html:817 เช็ก j.error/j.data แทน j.ok
- [ ] ย้าย wishlist/feedback ออกจากหมวดหน้าลูกค้า
- [ ] เพิ่ม LINE_OA_URL/GA4_ID/N8N_BASE_URL ใน config.js

### events-occasions
- [ ] ตรวจ SQL ของ group_event_status/group_theme_suggest/wed_share_create/group_join_token ในรีโป lloop ว่า re-verify ด้วย injected p_customer ไม่ใช่ p_requester/p_host/p_actor จาก client
- [ ] เพิ่ม state 'ล็อกอิน LINE เพื่อดูงานนี้' ใน wed.html แยกจาก renderNotFound (แก้ที่ต้นทาง lloop/liff/wed.html)
- [ ] sync เวอร์ชัน cache-bust ของ config/api/data ให้ตรงกันทั้งโดเมน
- [ ] ยืนยัน TTL ของ wed_share_pick('reserved') ว่า auto-release คลิกที่ทิ้งไว้
- [ ] อัปเดต footer family.html ให้ซ่อน/เปลี่ยนเมื่อ LIVE เหมือน event.html

### stock-inventory
- [ ] แก้ care-label.html ให้ QR ใช้ CONFIG.SITE_URL + /g.html?c=encodeURIComponent(code) (แก้ที่ lloop/ops/ ต้นทาง ไม่ใช่รีโปนี้)
- [ ] ให้ intake.html อ่าน query params มา prefill ฟอร์ม + ผูก acquisition id ตอน save หรือไม่ก็ตัดคำโฆษณา/ลิงก์ใน acquisitions.html
- [ ] escape ฟิลด์ชุด (name/brand/color_name) ใน labels.html และ garment-colors.html ให้เหมือนหน้าอื่น
- [ ] ยืนยัน RPC ทั้งชุด (โดยเฉพาะ garment_update, seller_offer_*) อยู่ใน allowlist ของ ops-rpc ที่ deploy จริง
- [ ] ย้าย color-report.html ออกจาก index หมวดสต็อกไปโดเมน customer/styling

### ops-daily
- [ ] ย้าย hr.html การจัดการเอกสาร HR ไปใช้ edge function kyc/gateway เหมือน staff.html (เลิ่ก sb.storage.from('hr-docs') + getPublicUrl ตรง) — แก้ที่ lloop/ops
- [ ] ยืนยัน policy ของ bucket hr-docs ว่าไม่เปิด anon และไม่มี public URL ค้างใน DB
- [ ] ให้ staff.html เปิดเอกสารผ่าน signed URL แทนฝัง d.url ตรง
- [ ] เพิ่ม filter จริงในแท็บ ROI 2 อันของ cockpit ไม่พึ่ง sort backend อย่างเดียว
- [ ] ยืนยัน RPC ทั้งชุดของโดเมนอยู่ใน allowlist ของ ops-rpc และ me-rpc ที่ deploy จริง

### finance
- [ ] ย้าย forecast.html ไปใช้ gateway ที่ verify idToken (owner-only) แทน anon+p_uid — เลิกใช้ UID เป็นรหัสผ่าน
- [ ] ยืนยันกับ repo lloop ว่า me-rpc override p_requester ของ group_order_summary/group_pay_confirm ฝั่ง server กัน IDOR
- [ ] publish/สร้าง tax-doc.html หรือเอาลิงก์ 'พิมพ์' ออกจน backend พร้อม
- [ ] เพิ่ม RPC void/reject payment แล้วต่อปุ่มปฏิเสธใน slips.html (ปิดปุ่มไว้ก่อนถ้ายังไม่มี)

### logistics-fulfillment
- [ ] เพิ่ม esc() ใน repair.html แล้วครอบทุกจุดที่ interpolate ค่าจาก DB/AI ลง innerHTML (แก้ที่ lloop/ops/repair.html ต้นทาง)
- [ ] ตัดสินใจ auth ของ repair-advise: ย้ายเป็น RPC ผ่าน ops-rpc หรือให้ฟังก์ชัน verify idToken + เช็ค staff เอง
- [ ] รวม esc() ให้ escape quote ด้วยเป็นมาตรฐานเดียวทั้งโดเมน โดยเฉพาะจุดที่ค่าเข้า attribute (disputes.html)
- [ ] ทำ laundry.html washDone() อ่าน needs_putaway เหมือน laundry-shops.html เพื่อปิดลูป put-away ให้ครบ
- [ ] ยืนยันว่า RPC ทุกตัวในโดเมน + edge function acct/repair-advise อยู่ใน allowlist/deploy จริงบน Supabase (เทียบ repo lloop)

### marketing-growth
- [ ] แก้ 3 placeholder link ใน links.html (YOUR_LIFF_ID/YOUR_LINE_ID/YOUR_OPENCHAT_ID) เป็นลิงก์จริง — แก้ที่ต้นทาง lloop/liff/
- [ ] ตัดสิน intent seller.html: consumer (ย้าย me-rpc/anon) หรือ staff intake (แก้ copy) ให้สอดคล้องกับ gateway ที่ใช้
- [ ] จำกัดคอลัมน์ ig-card.html เป็น select เฉพาะฟิลด์ + ยืนยัน RLS/whitelist ของ garments และ quote_rental สำหรับ anon
- [ ] เพิ่ม esc() ใน creator.html render()
- [ ] เทียบ allowlist gateway ในรีโป lloop ให้ครบทุก RPC ของโดเมน
- [ ] ต่อ GA4 Measurement ID จริงใน config.js

### partners-b2b
- [ ] แก้ requests.html: ให้ backend aggregate demand count จริงแทน hardcode 1 หรือปรับ copy 'เรียงตามดีมานด์สูงสุด'/'คนขอ' ให้ตรง (ทำที่ repo lloop/ops)
- [ ] ทบทวนว่า backend ใช้ line_uid จาก contract.html ทำอะไร — ถ้าใช้ให้สิทธิ์ควร verify ผ่าน idToken แทน client value
- [ ] รวมฟอร์มวิเคราะห์ partner.html/ops-partner.html เป็น shared script ลด divergence
- [ ] ล้าง dead code typed-signature ใน contract.html (ok var + fallback ที่เข้าไม่ถึง)
- [ ] ตรวจ allowlist gateway ให้ครบ (partner_*, contract_*, branch_*, pickup_*, wishlist_ops_*, request_to_buy, notify_customer_wishlist, hr_employee_list)

### trust-moats
- [ ] แก้ลิงก์ footer passport.html 'ทีมงาน LLOOP' จาก nfc.html → about.html (แก้ที่ต้นทาง lloop/liff/ ไม่ใช่รีโปนี้)
- [ ] อัปเดต about.html og:image เป็นโดเมน wearlloop-dotcom.github.io + รวม IG handle ให้เหลือหนึ่ง (@lloop.th vs @lloop.studio)
- [ ] เพิ่มข้อยกเว้นมัดจำสำหรับลูกค้าเครดิตดี (LLOOP Trust) ใน rental-terms.html ให้ตรงกับ trust.html
- [ ] ให้ charity.html อ่าน SUPABASE_URL/KEY จาก config.js (แก้ต้นทาง lloop/ops/) + ทบทวน RLS bucket uploads
- [ ] backend: เพิ่ม RPC กรอง community ตาม garment_code ลด over-fetch ใน passport

### backend-api
- [ ] ยืนยัน RLS ของ customer_events / customers / customer_touchpoints ฝั่ง Supabase ว่ารัดต่อผู้ใช้จริง ปิดช่อง IDOR ของ direct-table anon
- [ ] ย้าย customer_can_rent และ direct-table calls ที่พึ่ง RLS ไปเรียกผ่าน meRpc ให้ gateway inject id เอง
- [ ] เทียบรายชื่อ RPC/edge function ที่โดเมนเรียก กับ allowlist จริงใน repo lloop กัน fn_not_allowed
- [ ] เติม GA4_ID + N8N_BASE_URL เมื่อพร้อม แล้วทดสอบ event/webhook ยิงจริง

### platform-infra
- [ ] เพิ่ม sql/2026-07-storyboard-studio.sql (stub) คู่กับ video: ชี้ PR ต้นทาง lloop + ยืนยัน allowlist + deploy storyboard-gen + go-live checklist
- [ ] verify ว่า storyboard_studio_enabled อยู่ใน allowlist hub_settings_set แล้ว (ฝั่ง lloop/dashboard)
- [ ] pin/ตรวจ commit ปลั๊กอิน watch@claude-video ก่อน trust หรือถอดถ้าไม่ใช้
- [ ] สร้าง docs/wiki/index.md เป็นสารบัญ routing ตามเทมเพลต second-brain
