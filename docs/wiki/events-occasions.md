# Events & Occasions (งานแต่ง / อีเวนต์ / ครอบครัว)
> raw: [`wed.html`](../../wed.html) · [`event.html`](../../event.html) · [`family.html`](../../family.html) · API: [`api.js`](../../api.js) · gateway: [`me-api.js`](../../me-api.js) • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้
- `wed.html` — ลิงก์งานแต่งแบบแชร์: เจ้าภาพสร้าง `?code=` แชร์ให้แขก แขกเห็นชุดที่ว่างวันงาน + ใครจองชุดไหนแล้ว (กันใส่ชนกัน)
- `event.html` — dashboard หัวหน้ากลุ่ม (split pay): เปิดด้วย `?event=<event_group>` ดูว่าใครในตีมจ่ายแล้ว/ยังค้าง + ยอดรวม
- `family.html` — ผูกกลุ่มครอบครัว/แก๊งเพื่อน + AI จัดชุด "เข้าตีม" ทั้งกลุ่ม (โทนสี auto/ฤดู/เฉดสี/ตามสถานที่) → ส่งต่อ group-checkout

## Flow (end-to-end ของโดเมน)
- **wed.html**: `boot()` → `API.init()` เอา CUSTOMER · ถ้าไม่มี `code` → `renderCreate()` (สร้างงาน: `wed_share_create`) · มี code → `wed_share_join` (แขกเข้าร่วม) → `wed_share_summary` (title/date/taken[]/member_count) → `available_garments_on(date)` กรองชุดว่าง → grid · กด "เลือกเป็นของฉัน" → `wed_share_pick(code, garmentCode, 'reserved')` แล้วเด้งไป `g.html?code=` เพื่อจองจริง
- **family.html**: bootstrap LIVE ผ่าน `API.init()` (LINE+Supabase) ไม่งั้น fallback mock arrays ในไฟล์ · `reloadGroups()` = `my_groups` → แยก `my_status==='invited'` ไป INVITES ที่เหลือเป็น GROUPS · จัดการ `?join=<token>` → `join_group` · จัดชุดตีม: เลือกโหมดโทน (auto/season/shades/venue) → venue เรียก Edge `stylist` เอาพาเลต (หักโควต้า AI เดียวกับหน้าแรก) → `group_theme_suggest(group, occasion, from, to, {season|palette})` → paintTheme → ปุ่ม "เช่าทั้งกลุ่ม" ลิงก์ `group-checkout.html?group=`
- **event.html**: อ่าน `?event=` (หรือ `liff.state`) → `group_event_status(event, requester)` ทุก ~20s (auto-refresh) → roster เรียงคนค้างจ่ายบนสุด + progress bar · มี MOCK ในไฟล์เมื่อไม่ล็อกอิน
- **Backend**: ทุก write/read ที่มีตัวตนวิ่งผ่าน gateway `me-rpc` (`window.meRpc`, verify LINE idToken) · เฉพาะ `available_garments_on` / `group_invite_preview` / `group_discount_pct` เรียก Supabase ตรงด้วย anon key (public RPC)

## Insight (รู้อะไร)
- gateway `me-rpc` **override เฉพาะ `p_customer` / `p_line_uid`** เท่านั้น (ระบุชัดใน `me-api.js` บรรทัด 2-3) — identity ผ่านชื่อพารามอื่นไม่ถูก override
- โดเมนนี้ส่ง identity ด้วยชื่อพารามหลากหลาย: `wed_share_*`/`group_respond`/`join_group` ใช้ `p_customer` (ปลอดภัย, ถูก override) แต่ `group_event_status`/`group_theme_suggest` ใช้ `p_requester`, `wed_share_create` ใช้ `p_host`, `group_join_token` ใช้ `p_actor`, `create_group` ใช้ `p_creator`, `group_invite` ใช้ `p_inviter`, `add_managed_profile` ใช้ `guardian` (nested) — พวกนี้ backend ต้อง re-verify เองด้วย identity ที่ inject แล้ว ไม่งั้นเป็น IDOR
- `event.html` handle `st.error==='denied'` → บ่งชี้ว่า backend `group_event_status` มี membership check อยู่ (ดี) แต่ยังต้องมั่นใจว่าเช็คกับตัวตนจาก idToken ไม่ใช่ `p_requester` ที่ client ส่ง
- family.html + event.html มี MOCK mode เต็มรูปแบบ (พรีวิว UI โดยไม่ล็อกอิน) — wed.html **ไม่มี** mock, ต้องล็อกอิน LINE เท่านั้น
- โทนสีตีมมี 3 แหล่ง: auto (groupSeason จาก majority ของสมาชิก), season/เฉดสีเลือกเอง, venue (AI วิเคราะห์สถานที่ผ่าน Google Places + Edge `stylist`)

## Decision (ตัดสินใจอะไรไปแล้ว)
- IDOR mitigation กลาง = gateway `me-rpc` inject `p_customer` — โค้ด client "ส่ง p_customer มาด้วยก็ได้ ถูก override ทิ้ง"
- family.html เลือก dark-launch UX: footer ติด "หน้าตัวอย่าง" ค้างไว้ (ไม่ผูกกับ LIVE)
- ปุ่ม "เตือนเพื่อนที่ยังไม่จ่าย" (event.html) เป็น affordance อธิบายเฉย ๆ — ระบบเตือนอัตโนมัติอยู่แล้ว (ตั้งใจไม่ให้ทำงานจริง)

## Issues (จาก static audit — severity)
- [medium] **IDOR ที่ต้องยืนยันฝั่ง backend** — `api.js` (`group_event_status`/`group_theme_suggest` ส่ง `p_requester`, `wed_share_create` ส่ง `p_host`, `group_join_token` ส่ง `p_actor`) — gateway `me-rpc` override เฉพาะ `p_customer`/`p_line_uid` (`me-api.js:2`) ถ้า RPC เหล่านี้เชื่อ `p_requester`/`p_host` ที่ client ส่ง (แทนตัวตนจาก idToken) จะดึง roster+ยอดจ่าย+ชื่อสมาชิก (PII) ของกลุ่มอื่นได้โดยใส่ id คนอื่น — ต้องตรวจ SQL ในรีโป lloop ว่า re-verify membership ด้วย injected identity
- [medium] **copy หลอกแขกที่ยังไม่ล็อกอิน** — `wed.html` — `wed_share_summary` ต้องล็อกอิน (meRpc) ถ้าแขกเปิดลิงก์ในเบราว์เซอร์นอก LINE → error → `renderNotFound()` โชว์ "ไม่พบงานนี้ · ลิงก์อาจหมดอายุหรือพิมพ์ผิด" ทั้งที่สาเหตุจริงคือยังไม่ล็อกอิน — ลิงก์นี้ตั้งใจแชร์ให้แขกหมู่มาก ควรมี state "เข้าสู่ระบบด้วย LINE เพื่อดูงานนี้"
- [low] **pick ล็อกชุดก่อนจองจริง** — `wed.html` — กด "เลือกเป็นของฉัน" ส่ง `wed_share_pick(..., 'reserved')` ซึ่ง renderEvent ถือเป็น hard-taken (เทา + "เพื่อนเลือกแล้ว") ก่อนจะจองจริงใน g.html — ถ้าแขกกดแล้วเลิก ชุดจะขึ้น "ถูกจอง" ให้คนอื่นเห็นค้าง (ขึ้นกับ TTL ฝั่ง backend)
- [low] **footer "หน้าตัวอย่าง" ค้างในโหมด LIVE** — `family.html:259` — `.demo` เป็น static text ไม่เคยอัปเดตแม้ LIVE (ต่างจาก event.html ที่อัปเดต `#demoNote`) → ผู้ใช้จริงเห็น "ข้อมูลเป็นตัวอย่าง" ทั้งที่ข้อมูลจริง
- [low] **cache-bust เวอร์ชันไม่ตรงกันข้ามหน้า** — `wed.html` โหลด `config.js?v=51`,`api.js?v=55`,`data.js?v=51` แต่ `event.html`/`family.html` ใช้ `config.js?v=38`,`api.js?v=54` — สคริปต์ก้อนเดียวกันคนละเวอร์ชัน เสี่ยง cache เพี้ยน/สับสนเวลา deploy
- [low] **demoNote อ้าง path ที่ไม่มีในรีโป + ปุ่มไม่ทำงาน** — `event.html:155` เขียน "ต่อกับ Supabase ผ่าน liff/api.js" แต่ในรีโปนี้ไฟล์คือ `api.js` (path `liff/` เป็นของต้นทาง lloop) · ปุ่ม "เตือนเพื่อน" ทำได้แค่ alert (ตั้งใจ)
- [low] **nav.js โหลดแต่ไม่ได้ใช้ + ไม่มี nav** — `wed.html:53` โหลด `nav.js?v=1` แต่ไม่มี placeholder `<header class="lloop-topbar">` → no-op (dead include) และหน้าไม่มีปุ่มย้อนกลับ/nav ให้แขกเลย
- [low] **ไม่มี i18n** — ทั้ง 3 หน้า hardcode ไทยล้วน ไม่โหลด `i18n.js`/`nav.js` engine (ต่างจากหลายหน้าในแอป) — ยังไม่รองรับ EN

## Next action
- [ ] ตรวจ SQL ของ `group_event_status`/`group_theme_suggest`/`wed_share_create`/`group_join_token` ในรีโป `lloop` ว่า re-verify ตัวตนด้วย injected `p_customer` ไม่ใช่ `p_requester`/`p_host`/`p_actor` จาก client (ปิดช่อง IDOR)
- [ ] เพิ่ม state "ล็อกอิน LINE เพื่อดูงานนี้" ใน wed.html แยกจาก renderNotFound (แก้ที่ต้นทาง `lloop/liff/wed.html`)
- [ ] sync เวอร์ชัน cache-bust ของ config/api/data ให้ตรงกันทั้งโดเมน
- [ ] ยืนยัน TTL ของ `wed_share_pick('reserved')` ว่า auto-release คลิกที่ทิ้งไว้
- [ ] อัปเดต footer family.html ให้ซ่อน/เปลี่ยนเมื่อ LIVE (เหมือน event.html)

## Links
- [[index]]
