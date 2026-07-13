# Backend / API layer (config · api · gateways)
> raw: [`config.js`](../../config.js) · [`api.js`](../../api.js) · [`app.js`](../../app.js) · [`me-api.js`](../../me-api.js) · [`ops-api.js`](../../ops-api.js) · [`ops-menu.js`](../../ops-menu.js) · [`ops-feedback.js`](../../ops-feedback.js) · [`liffAuth.js`](../../liffAuth.js) · [`i18n.js`](../../i18n.js) · [`nav.js`](../../nav.js) · [`data.js`](../../data.js) · [`brands.js`](../../brands.js) · [`analytics.js`](../../analytics.js) · [`webhooks.js`](../../webhooks.js) · [`scan.js`](../../scan.js) · [`qc-photo.js`](../../qc-photo.js) • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้
- `config.js` — ค่ากลางทั้งเว็บ: `USE_MOCK`, `SUPABASE_URL/ANON_KEY`, `LIFF_ID`, pixel/GA4/maps key, ลิงก์วิดีโอ hero
- `api.js` (`window.API`) — data layer หน้าลูกค้า: init แคตตาล็อก + โปรไฟล์, จอง/ชำระ, wishlist, กลุ่ม, ครีเอเตอร์ ฯลฯ (public surface ~150 ฟังก์ชัน)
- `app.js` — SPA logic ของ `index.html` (ฟิลเตอร์ชุด, สไตลิสต์, checkout, KYC gate); ใหญ่มาก
- `me-api.js` (`window.meRpc`) — drop-in `client.rpc` ฝั่งลูกค้า → ยิงผ่าน gateway `me-rpc` (verify idToken, inject `p_customer`)
- `ops-api.js` (`window.opsRpc`, `opsLogin`) — drop-in `sb.rpc` ฝั่งพนักงาน → ยิงผ่าน gateway `ops-rpc` (staff active + role)
- `ops-menu.js` (`window.opsMenu`, `OPS_NAV`) — side menu หลังบ้าน กรองเมนูตาม role/owner (เรียก `ops_me`)
- `ops-feedback.js` (`window.opsFeedback`) — ปุ่มลอยส่ง feedback ทีม → edge function `ops-feedback` (private)
- `liffAuth.js` (`window.LiffAuth`) — LINE LIFF login + ดึง UID (guest ถ้าไม่ได้อยู่ในแอป LINE)
- `i18n.js` (`window.I18N`) — dictionary TH/EN สำหรับหน้าลูกค้า; `nav.js` (`window.NAV`) — topbar ร่วม + เอนจิน i18n แบบ `data-i18n`
- `data.js` (`window.MOCK`) — mock garments/customer/venues (fallback เมื่อ `USE_MOCK=true` หรือ backend ล่ม)
- `brands.js` (`window.LLOOP_BRANDS`) — taxonomy แบรนด์ (lookup/canon/origin) สำหรับ chips + ค้นหา
- `analytics.js` — GA4 loader + `gaEvents.*`; `webhooks.js` — n8n stubs (no-op ถ้าไม่ตั้ง `N8N_BASE_URL`)
- `scan.js` — สแกน QR/NFC ป้ายชุด → เติมช่อง input; `qc-photo.js` — ถ่าย+ย่อ+อัปโหลดรูป QC ผ่าน `opsRpc('qc_photo_upload')`

## Flow (end-to-end ของโดเมน)
- **ลูกค้า (index.html):** โหลด script ตามลำดับ supabase→liff→config→…→me-api→api→app. `API.init()` → `LiffAuth.login()` ดึง UID → อ่านโปรไฟล์ผ่าน `meRpc('me_profile')` → โหลด `garments` (anon, `data_status='ready'`) → ทุก action (จอง/ชำระ/wishlist/รีวิว) วิ่งผ่าน `meRpc(...)` โดย gateway override `p_customer` เอง กัน IDOR
- **พนักงาน (ops/*):** หน้า ops ตั้ง `sb.rpc = window.opsRpc` → `opsLogin()` (LIFF ops) → ทุก RPC ยิงผ่าน `ops-rpc` ที่เช็ค staff active + role + owner-only; `ops-menu.js` เรียก `ops_me` มาสร้างเมนูตามสิทธิ์ และ mount ปุ่ม feedback
- **Public anon (ไม่ login):** เรียก RPC/edge function ตรงด้วย anon key เฉพาะที่ whitelist ฟิลด์ (เช่น `garment_available_on`, `current_terms`, `recent_charity`, `consent_text`, `hair-style`, `kyc`)
- **i18n:** `nav.js` อ่าน `localStorage.lloop_lang` แปล `data-i18n`; JS หน้าอ่าน `NAV.t(th,en)` + ฟัง event `lloop:lang`

## Insight (รู้อะไร)
- gateway 2 ตัวแยกกันชัด: `me-rpc` (idToken → `p_customer` server-side) กับ `ops-rpc` (staff + role + owner). การส่ง `p_customer` จาก client ในเส้นทาง `meRpc` ปลอดภัยเพราะถูก override ทิ้ง (ยืนยันในคอมเมนต์ `me-api.js`)
- ทุก external secret ใน `config.js` เป็น key ฝั่ง client โดยตั้งใจ (publishable Supabase, LIFF, Meta pixel, Maps) — ไม่มี service-role/secret รั่ว
- ระบบออกแบบ "non-breaking": ทุกขั้น login/โปรไฟล์ห่อ try/catch แยก เพื่อไม่ให้แคตตาล็อกพังถ้า anon write โดน RLS บล็อก
- feature flag ระดับ config: `GA4_ID` ยังเป็น placeholder และ `N8N_BASE_URL` ว่าง → analytics GA4 + webhooks n8n ทั้งหมด (order-confirmed / new-arrivals / return-reminder / request-review) เป็น no-op จนกว่าจะเติมค่า
- `ops-menu.js` OPS_NAV อ้าง 37 หน้า ops — ตรวจแล้วมีไฟล์ครบทุกหน้าในรีโป (ไม่มีลิงก์เมนูตาย)
- โดเมนนี้ผูกแน่นกับ repo `lloop`: RPC/edge function ทั้งหมด (allowlist ของ gateway) อยู่คนละรีโป ตรวจ static จากที่นี่ไม่ได้

## Decision (ตัดสินใจอะไรไปแล้ว)
- ย้ายการอ่านโปรไฟล์ลูกค้าจาก anon `.from('customers').select('*')` → `meRpc('me_profile')` เพื่อกัน anon อ่าน PII ทุกแถว (คอมเมนต์ระบุ R-1) — แต่ยังเหลือ direct-table calls อื่นอยู่ (ดู Issues)
- ทำ `me-api.js`/`ops-api.js` เป็น drop-in ของ `sb.rpc` เพื่อ convert หน้าเดิมแบบ find-replace ไม่ต้องรื้อโค้ด
- แยก LIFF ops (`2010486714-lDr0nzy0`) ออกจาก LIFF ลูกค้า เพื่อไม่ให้ login หลังบ้านเด้งไปหน้าลูกค้า
- ปิดฟีเจอร์ analytics/n8n ไว้ก่อน (dark launch) รอเติมค่าใน config

## Issues (จาก static audit — severity)
- [medium] **anon-key เข้าตารางตรง เลี่ยง gateway (พึ่ง RLS ล้วน)** — `api.js` — `init()` อ่าน `customer_events` ด้วย anon key กรองด้วย `customer_id` ที่มาจาก client (บรรทัด ~102) และ upsert `customers` / insert `customer_touchpoints` โดยใส่ `line_uid` จาก client (บรรทัด 76,79,125,325,347,1031,1036). ต่างจากกติกา CLAUDE.md ที่ให้ public/anon แตะเฉพาะ RPC ที่ whitelist ฟิลด์ — ถ้า RLS ไม่รัดกุมจะเป็น IDOR (อ่าน event ของลูกค้าคนอื่น) หรือ spoof touchpoint ของ `line_uid` ใครก็ได้ ตรวจ RLS ฝั่ง Supabase ไม่ได้จากรีโปนี้
- [medium] **KYC gate ยิง anon RPC ด้วย id จาก client** — `app.js` — `customerCanRent()` สร้าง client แยก (`kycSb`) แล้วเรียก `sb.rpc('customer_can_rent', { p_customer: CUSTOMER.id })` ด้วย anon key ไม่ผ่าน `me-rpc` (บรรทัด ~1855) ส่ง customer id จาก client ตรง ๆ = รูปแบบ IDOR ที่ CLAUDE.md เตือน ถ้า RPC ไม่ verify ตัวตนซ้ำ จะเช็คสิทธิ์เช่าของลูกค้าคนอื่นได้ ควรย้ายไป `meRpc('customer_can_rent', {})`
- [low] **coupling กับ allowlist ของ gateway (คนละรีโป)** — `api.js`/`app.js`/`qc-photo.js`/`ops-feedback.js` — RPC/edge function ที่เรียกมีจำนวนมาก (เช่น `customer_can_rent`, `qc_photo_upload`, `hair-style`, `look-audit`, `comment-audit`, `ops-feedback`) ถ้าตัวไหนยังไม่อยู่ใน allowlist ของ gateway จะได้ `fn_not_allowed`/404 เงียบ ๆ (หลาย call ห่อ try/catch กลืน error) ตรวจ static จากรีโปนี้ไม่ได้ ต้องเทียบกับ deploy จริงใน repo `lloop`
- [low] **ฟีเจอร์ wired แต่ inert ใน production** — `config.js` — `GA4_ID='G-XXXXXXXXXX'` (analytics.js guard ปิดตัวเอง) และ `N8N_BASE_URL=''` (webhooks.js ทุกตัว no-op) โค้ดที่เรียก `gaEvents.*`/`webhooks.*` ทั่วเว็บจะไม่ทำงานจนกว่าจะเติมค่า — ตั้งใจ (dark launch) แต่ควรมี checklist ก่อนบอกว่า "analytics/แจ้งเตือนพร้อม"
- [low] **Google Maps key เปิดในไฟล์ static** — `config.js` — `GOOGLE_MAPS_KEY` hardcode (โดยธรรมชาติของ browser key ต้อง public) ความปลอดภัยขึ้นกับ referrer/API restriction ใน Google Cloud ล้วน ตามคอมเมนต์ล็อกไว้ที่ github.io/lloop.app + 3 API — ต้องคงการล็อกนี้ไว้เสมอ ไม่งั้นถูกนำไปใช้เกินโควตา
- [low] **double `liff.init` ต่อโหลด** — `liffAuth.js` + `me-api.js` — ทั้งคู่เรียก `liff.init({ liffId: CONFIG.LIFF_ID })` แยกกันบนหน้าลูกค้า (ค่า LIFF_ID เดียวกัน SDK จัดการ idempotent ได้) ไม่พังแต่ซ้ำซ้อน ควรรวม init ที่เดียว

## Next action
- [ ] ยืนยัน RLS ของ `customer_events` / `customers` / `customer_touchpoints` ฝั่ง Supabase ว่ารัด `line_uid`/`customer_id` ต่อผู้ใช้จริง (ปิดช่อง IDOR ของ direct-table anon)
- [ ] ย้าย `customer_can_rent` (และ direct-table calls ที่พึ่ง RLS) ไปเรียกผ่าน `meRpc` เพื่อให้ gateway inject id เอง
- [ ] เทียบรายชื่อ RPC/edge function ที่โดเมนนี้เรียก กับ allowlist จริงใน repo `lloop` (กัน `fn_not_allowed`)
- [ ] เติม `GA4_ID` + `N8N_BASE_URL` เมื่อพร้อม แล้วทดสอบ event/webhook ยิงจริง

## Links
- [[customer-journey]] [[ops-daily]] [[stock-inventory]] [[partners-b2b]] [[marketing-growth]]
