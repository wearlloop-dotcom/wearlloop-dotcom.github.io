# Marketing & Growth (การตลาด/อินฟลู/ไลฟ์/ลิงก์)
> raw: `marketing.html` `influencers.html` `ugc.html` `creator.html` `live.html` `links.html` `ig-card.html` `seller.html` `market.html` • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้
- `marketing.html` — Marketing Studio (ops): ปฏิทินคอนเทนต์ + ช่วยเขียนแคปชัน + pipeline คอนเทนต์ (draft→published) · RPC: `mkt_overview` `content_upsert` `content_list` `content_set_status` `garments_pick`
- `influencers.html` — CRM อินฟลูเอนเซอร์ + ดีล collab (ops) · RPC: `influencer_upsert/list` `collab_upsert/list` `garments_pick`
- `ugc.html` — จัดการงานถ่าย UGC ฝั่งแอดมิน: เปิดงาน/คิวรีวิว/อนุมัติ-ปฏิเสธ (ops) · RPC: `gig_create` `gig_list` `gig_cancel` `ugc_review_queue` `gig_approve` `ugc_reject`
- `creator.html` — หน้าลูกค้า (me-rpc): กระดานงานถ่าย → รับงาน → อัปรูป → AI ตรวจ → ได้เครดิต · RPC: `gig_board` `gig_claim` `ugc_submit` + edge fn `ugc-audit`
- `live.html` — วางแผน/คุมไลฟ์ขายชุด หลายแพลตฟอร์ม (ops) · RPC: `live_upsert/list/set_status` `garments_pick`
- `links.html` — หน้า bio-link/linktree สาธารณะ (ไม่มี backend, i18n EN default สลับ TH ได้)
- `ig-card.html` — เครื่องมือสร้างการ์ดราคาลง IG (สาธารณะ ไม่ล็อกอิน, เรียก anon ตรง) · `garments.select('*')` + rpc `quote_rental`
- `seller.html` — "Closet Cash" รับซื้อชุดมือสอง (เก็บ PII: ชื่อ/เลขบัตร/ที่อยู่/บัญชี) · RPC: `seller_submit` `consent_text` `record_consent` + storage `uploads`
- `market.html` — เฝ้าตลาด/ชุดใหม่คู่แข่ง (ops) · RPC: `market_finds_list` `market_find_status/add` `market_brands_list` `market_brand_upsert`

## Flow (end-to-end ของโดเมน)
- **วงจร growth ฝั่งแอดมิน**: วางคอนเทนต์ (`marketing`) → ดึงอินฟลูมาทำ collab (`influencers`) → จัดไลฟ์ขาย (`live`) → เปิดงาน UGC ให้ลูกค้าถ่าย (`ugc`) → หาสต็อกใหม่ (`market` เฝ้าคู่แข่ง, `seller` รับซื้อของมือสอง). ทุกหน้า ops วิ่งผ่าน `ops-api.js` (`window.opsRpc`) → gateway `ops-rpc` (staff active + allowlist). หลายหน้ามี `garments_pick` ร่วมเพื่อผูกชุดกับคอนเทนต์/ดีล/ไลฟ์.
- **วงจร UGC (ต่อฝั่งลูกค้า)**: แอดมินเปิด gig ใน `ugc.html` (`gig_create`) → ลูกค้าเปิด `creator.html` เห็นกระดาน (`gig_board`) → รับงาน (`gig_claim`) → อัปรูปเข้า storage `uploads` → `ugc_submit` → เรียก edge fn `ugc-audit` (auth ด้วย LINE idToken) ตรวจอัตโนมัติ ผ่าน=จ่ายเครดิต · แอดมินเคลียร์เคสค้าง/เกินเพดานใน `ugc_review_queue`. ฝั่งลูกค้าใช้ `me-api.js` (`window.meRpc`, gateway inject p_customer กัน IDOR).
- **จุดสาธารณะ (ไม่ล็อกอิน)**: `links.html` = ปลายทางจาก bio โซเชียล ส่งคนเข้า LIFF/LINE/ร้านมาร์เก็ตเพลส · `ig-card.html` = ทีมทำการ์ดราคาไปโพสต์ (อ่าน garments + quote ด้วย anon key ตรง ไม่ผ่าน gateway).

## Insight (รู้อะไร)
- โดเมนนี้ผสม 3 ประเภทหน้า: **ops-gated** (marketing/influencers/ugc/live/market/seller ผ่าน ops-rpc), **customer** (creator ผ่าน me-rpc), และ **public** (links ไม่มี backend, ig-card เรียก anon ตรง). ต้องแยกกฎ security ต่อประเภท.
- UGC เป็น loop ปิดตัวเดียวที่ข้ามฝั่ง admin↔customer: `ugc.html` (เปิดงาน) กับ `creator.html` (ทำงาน) แชร์ entity เดียวกัน (gig/asset) แต่คนละ gateway — แก้ชื่อ RPC ต้องดูทั้งคู่.
- มาตรฐาน escape ไม่สม่ำเสมอ: `ugc.html` มี `esc()` ครบ แต่ `creator.html` แทรก server data ลง innerHTML/onclick ตรง ๆ.
- การวัดผลการตลาดยังไม่พร้อม: `config.js` ใส่ `GA4_ID:'G-XXXXXXXXXX'` (placeholder) และ `N8N_BASE_URL:''` ว่าง — Meta Pixel มีจริง (`META_PIXEL_ID`) แต่ GA4 ยังไม่ต่อ.

## Decision (ตัดสินใจอะไรไปแล้ว)
- UGC ใช้ AI ตรวจรูปก่อน (edge fn `ugc-audit`) แล้วค่อยจ่ายเครดิตอัตโนมัติ; เคสที่ AI ไม่ชัด/เกินเพดานวันเข้า review queue ให้แอดมินตัดสินเอง.
- ทุกหน้าหลังบ้านย้ายจาก anon key ตรง → gateway `ops-rpc` (คอมเมนต์ R-4 ใน seller.html) เพื่อบังคับ staff role.
- seller.html เก็บ PII พร้อม consent PDPA (พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล 2562) ผ่าน `consent_text`/`record_consent`.
- `links.html` ตั้ง i18n เป็นอังกฤษ default (สลับไทยได้) ต่างจากหน้า ops ที่ไทยล้วน.

## Issues (จาก static audit — severity)
- [high] ลิงก์ placeholder ตายบนหน้า bio สาธารณะ — `links.html` — 3 CTA ยังเป็นค่า placeholder: `YOUR_LIFF_ID` (ปุ่มหลัก "Start now/Try free" บรรทัด 384), `YOUR_LINE_ID` (lin.ee เพิ่มเพื่อน บรรทัด 450), `YOUR_OPENCHAT_ID` (OpenChat บรรทัด 489). ลิงก์แปลงลูกค้าหลักพากดไปหน้า error. LIFF_ID จริงมีใน config.js (`2010486714-1g6lDuHo`) แต่หน้านี้ไม่โหลด config ต้องแก้ค่ามือ.
- [medium] หน้าผู้ขายสาธารณะถูกล็อกด้วย staff gate — `seller.html` — copy เป็น consumer ("อยากขายแบบไหนคะ", "เปลี่ยนตู้เสื้อผ้าเป็นเงิน") แต่บรรทัด 30/35-36 ใช้ `ops-api.js` + `opsLogin()` + `sb.rpc=opsRpc` → ผู้ขายทั่วไปที่ไม่ใช่พนักงานจะโดน `no_access` ส่ง `seller_submit` ไม่ได้. ถ้าตั้งใจให้เป็นฟอร์ม intake ของสตาฟก็ควรแก้ copy; ถ้าให้ผู้ขายกรอกเองต้องเปลี่ยนไปใช้ me-rpc/anon.
- [medium] หน้า public อ่าน table เกิน whitelist — `ig-card.html` — บรรทัด 211 `sb().from('garments').select('*')` ด้วย anon key (ไม่ล็อกอิน) ดึงทุกคอลัมน์ (อาจมีต้นทุน/ซัพพลายเออร์/โน้ตภายใน) แทนที่จะ select เฉพาะฟิลด์ที่ whitelist ตามกฎ CLAUDE.md; และเรียก rpc `quote_rental` ด้วย anon ตรงไม่ผ่าน gateway (ต้องเป็น RPC ที่ตั้งใจเปิด public + RLS จำกัดคอลัมน์ ไม่งั้นรั่ว).
- [low] escape ไม่ครบเสี่ยง XSS อ่อน — `creator.html` — บรรทัด 100-118 `render()` แทรก `g.name`/`g.photo`/`g.gig_id` ลง innerHTML และ attribute `onclick` โดยไม่ escape (ต่างจาก ugc.html). ชื่อชุดมาจาก backend เองจึงเสี่ยงต่ำ แต่ถ้าชื่อมี `'`/`<` จะ break markup.
- [low] RPC ต้องอยู่ใน allowlist ของ gateway — ทุกหน้า — RPC ใหม่เยอะ (`mkt_overview` `content_*` `collab_*` `live_*` `market_*` `gig_*` `ugc_*` `seller_submit` `consent_text`) แต่ละตัวต้องถูกเพิ่มใน allowlist ของ ops-rpc/me-rpc ไม่งั้น `fn_not_allowed`. ตรวจ static ที่รีโปนี้ไม่เห็น backend — ต้องเทียบกับ `wearlloop-dotcom/lloop` (gateway) ก่อนถือว่าใช้ได้จริง.
- [low] การวัดผลการตลาดยังไม่ต่อ — `config.js` — `GA4_ID` เป็น `G-XXXXXXXXXX` (placeholder) + `N8N_BASE_URL` ว่าง → รายงานผล growth/attribution ฝั่ง GA4 และ automation n8n ยังไม่ทำงาน.

## Next action
- [ ] แก้ 3 placeholder ใน `links.html` เป็นลิงก์จริง (LIFF/lin.ee/OpenChat) — แก้ที่ต้นทาง `lloop/liff/` กัน auto-deploy ทับ
- [ ] ตัดสินใจ intent ของ `seller.html`: consumer (ย้ายไป me-rpc/anon) หรือ staff intake (แก้ copy) แล้วทำให้สอดคล้อง
- [ ] จำกัดคอลัมน์ `ig-card.html` เป็น select เฉพาะฟิลด์ที่โชว์ + ยืนยัน RLS/whitelist ของ `garments` + `quote_rental` สำหรับ anon
- [ ] เพิ่ม `esc()` ใน `creator.html` render() ให้เท่ากับ ugc.html
- [ ] เทียบ allowlist gateway ในรีโป lloop ให้ครบทุก RPC ของโดเมนนี้ก่อนถือว่า live
- [ ] ต่อ GA4 Measurement ID จริงใน config.js เพื่อวัดผลการตลาด

## Links
- [[customer-journey]] — creator.html เป็นจุดต่อของ loop ลูกค้า (เครดิต/รีวอร์ด)
- [[stock-inventory]] — market.html (เฝ้าคู่แข่ง) + seller.html (รับซื้อ) ป้อนสต็อกใหม่
- [[ops-daily]] — งาน ops ประจำวัน (marketing/live/ugc review)
