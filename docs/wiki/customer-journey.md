# Customer Journey (หน้าลูกค้า)
> raw: `index.html`, `quiz.html`, `looks.html`, `shop.html`, `wishlist.html`, `join.html`, `group-checkout.html`, `my-events.html`, `review.html`, `feedback.html`, `g.html` · `api.js` `me-api.js` `config.js` `app.js` • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้
- `index.html` — หน้าหลักลูกค้า (SPA จริงอยู่ใน `app.js` 336KB) — AI สไตลิสต์, ร้าน, ตะกร้า, ออเดอร์, เมนู Discover
- `quiz.html` — เกมการ์ด "งานนี้ใส่อะไรดี" (public, ไม่ login) → ส่งค่าเข้า `index.html?go=stylist&occasion=&mood=`
- `looks.html` — ชุมชน The Loop Looks (ฟีด, like/save/follow, คอมเมนต์, แชร์ลุค) ผ่าน `window.API`
- `shop.html` — หน้าร้าน public (canonical) ดึงชุดสดจาก `garments` แสดงกริด → ปุ่มทักไลน์
- `wishlist.html` — **หน้า OPS (พนักงาน)** จัดการดีมานด์ wishlist ลูกค้า (ไม่ใช่หน้าลูกค้า — ดู Issues)
- `join.html` — รับคำเชิญเข้ากลุ่ม (ครอบครัว/เพื่อน/คู่รัก) ผ่าน `?token=` → `window.API.joinGroup`
- `group-checkout.html` — จัดชุดเข้าตีม + เช่าพร้อมกันทั้งกลุ่ม (theme suggest, split/cart booking)
- `my-events.html` — บันทึกวันงานของลูกค้า (meRpc `my_events`/`add_customer_event`/`del_customer_event`)
- `review.html` — ฟอร์มรีวิวชุดหลังเช่า (คะแนน/fit/โอกาส/รูป +เครดิต) ผ่าน me-rpc `submit_review`
- `feedback.html` — **หน้า OPS (พนักงาน)** อ่าน feedback ทีม (ไม่ใช่หน้าลูกค้า — ดู Issues)
- `g.html` — สแกน QR ป้ายชุด (`?c=<code>`) → ดูชุด+ราคา → เลือกวัน → จอง (`window.API.bookCart`) + PromptPay

## Flow (end-to-end ของโดเมน)
- **ค้นพบ → เลือก**: ลูกค้าเข้า `index.html` (เมนู Discover ใน app.js) เชื่อมไป `quiz.html` (เกมเลือกโอกาส/มู้ด) → กลับเข้า `index.html?go=stylist` ให้ AI Atelier คัดชุด · หรือ `looks.html` (ชุมชน) · หรือสแกน QR ที่ป้าย → `g.html`
- **จอง/จ่าย**: `g.html` และ index ใช้ `window.API` (`api.js`) → `quote` → `bookCart`/`bookGroupCart` → PromptPay QR (`promptpay.js`). ยอดจริงมาจาก `book_cart` (สะท้อนสิทธิ์สมาชิก) ไม่ใช่ quote
- **กลุ่ม**: เพื่อนแชร์ลิงก์ → `join.html?token=` → `groupInvitePreview` → `joinGroup` → เด้งไป `family.html` → `group-checkout.html` เช่าพร้อมกัน
- **หลังเช่า**: `my-events.html` เตือนวันงาน · `review.html` รีวิว+รูปได้เครดิต
- **Backend**: หน้า login LINE เรียกผ่าน gateway `me-rpc` (`me-api.js` `window.meRpc`) ที่ verify idToken แล้ว inject identity เอง · หน้า public (shop/quiz) เรียก Supabase ตรงด้วย anon key (REST/`.from`) · หน้า ops (wishlist/feedback) ใช้ `ops-rpc`/`opsLogin`

## Insight (รู้อะไร)
- `index.html` เป็นแค่เปลือก — logic ลูกค้าเกือบทั้งหมดอยู่ `app.js` (โหลด `?v=84`); เมนู Discover เป็นตัว route ไปหน้าลูกค้าอื่น (quiz/looks/wishlist/creator)
- me-rpc มี "สัญญา" ชัดจาก `me-api.js`: สำเร็จ = ไม่มี `out.error`, ข้อมูลอยู่ `out.data` — **ไม่มีฟิลด์ `ok`**. หน้าไหน hand-roll fetch เองต้องยึดสัญญานี้ (review.html พลาดข้อนี้)
- `wishlist.html` และ `feedback.html` ที่ลิสต์ไว้ในโดเมนนี้ จริง ๆ เป็นหน้า **หลังบ้าน (ops)** — ใช้ `ops-api.js`/`opsLogin`/ops-menu ทั้งคู่ ไม่ใช่ touch point ลูกค้า
- หน้า public แยกสองแบบ: `shop.html` อ่าน `garments` ตรงด้วย anon `.from()` ส่วน `quiz.html` เรียก RPC funnel (`quiz_event_log`,`quiz_lead_submit`,`quiz_flags`) ตรงด้วย anon — ต่างจากรูปแบบ passport.html ที่ใช้ RPC whitelist ฟิลด์แล้ว
- lead capture ใน quiz อยู่หลัง feature flag `quiz_flags.lead_capture` (dark launch — ปิดอยู่กล่องไม่โผล่)
- i18n มีจริงแค่ index + my-events (i18n.js/nav.js); หน้าลูกค้าอื่นเป็นไทยล้วน

## Decision (ตัดสินใจอะไรไปแล้ว)
- ย้ายการเรียก RPC ที่แตะ PII ไป gateway: review.html เดิมยิง `sb.rpc` ตรง anon → lockdown (R-1) แล้วเปลี่ยนเป็น me-rpc; wishlist ops เปลี่ยนจาก `.from()` เป็น `wishlist_ops_*` ผ่าน gateway (R-4) — เห็นคอมเมนต์ในโค้ด
- g.html ตัดสินว่างจริงจาก `book_cart` เป็นหลัก (rangeBusy/availableOn เป็นแค่ UX hint กันชนนาทีสุดท้าย)
- join.html บังคับยืนยัน LINE เสมอ ไม่มีโหมดข้าม (mock ใช้โชว์ดีไซน์ตอน preview เท่านั้น)

## Issues (จาก static audit — severity)
- [high] เมนูลูกค้า "อยากได้ชุดไหน บอกเราได้" ชี้ไปหน้า OPS — `wishlist.html` — `app.js:2230` route ลูกค้าไป `wishlist.html` ซึ่งเป็นคอนโซลพนักงาน (ops-api/opsLogin, nav home/stock, `wishlist_ops_list`). ลูกค้าที่กดจะเจอ staff gateway → `no_access`/วน login ไม่มีฟอร์มให้ลูกค้าขอชุดจริงที่ปลายทางนี้
- [high] รีวิวสำเร็จถูกมองเป็น error เสมอ — `review.html:817` — เช็ก `if (j.ok)` แต่ me-rpc คืน `{data,error}` ไม่มี `ok` (ยืนยันจาก `me-api.js:33-38` และ `loadProfile` ในไฟล์เดียวกันที่อ่าน `j.data` ตรง ๆ) → ทุกครั้งที่ส่งรีวิวจะโชว์ "ส่งรีวิวไม่สำเร็จ" แม้บันทึกเข้าจริง (ขึ้นกับ shape ของ gateway ที่ deploy จริง)
- [medium] หน้า public อ่านตาราง garments ตรงด้วย anon — `shop.html:171` — `sb.from('garments').select(...)` แทน RPC/วิว whitelist (ต่างจาก passport_public) พึ่ง RLS ล้วน เปิดคอลัมน์ rate_1d/rental_price/times_rented/status และคอลัมน์อื่นที่ anon อ่านได้
- [medium] อัปโหลดรูปรีวิวด้วย anon key ตรง bypass gateway — `review.html:731` — POST ไป storage bucket `review-photos` ด้วย Bearer anon + x-upsert:true, ชื่อไฟล์ client กำหนด (`${uid}_${Date.now()}`) → ใครถือ anon key ก็เขียน object ลง bucket ได้ (สแปม/abuse)
- [medium] ส่ง id ลูกค้าจาก client — `review.html:809` — ส่ง `p_uid: uid` (LINE userId) เข้า submit_review; CLAUDE.md ระบุ gateway ต้อง inject identity เอง ห้ามส่ง id จาก client (พึ่ง gateway override — เป็น IDOR ถ้า RPC/allowlist เผลอเชื่อ p_uid)
- [low] หน้า ops ปนในเซ็ตหน้าลูกค้า — `wishlist.html`,`feedback.html` — เป็นหน้าพนักงาน (ops-api/opsLogin/ops-menu) ไม่ใช่ touch point ลูกค้า; ควรจัดหมวดใหม่
- [low] i18n ตกหล่น — `shop.html` (และ g/join/review/quiz) — ไม่มี data-i18n/สลับภาษา ขณะที่ index/my-events รองรับ EN → ลูกค้า EN เจอไทยล้วน
- [low] config drift — `config.js` — ไม่มี `LINE_OA_URL` (shop/quiz อ้าง `C.LINE_OA_URL` แล้ว fallback hardcode `@lloop`), `GA4_ID` ยังเป็น placeholder `G-XXXXXXXXXX`, `N8N_BASE_URL` ว่าง

## Next action
- [ ] ชี้เมนู "อยากได้ชุดไหน บอกเราได้" (app.js:2230) ไปหน้าฟอร์มลูกค้าจริง ไม่ใช่ wishlist.html (ops) — หรือสร้างหน้า request ฝั่งลูกค้า
- [ ] review.html: เปลี่ยนเงื่อนไขสำเร็จเป็น "ไม่มี error" (ยึดสัญญา me-api.js) หรือใช้ `window.meRpc` แทน hand-roll fetch
- [ ] ยืนยัน RLS ของ `garments` + policy bucket `review-photos` ให้ปลอดภัยกับ anon (หรือย้าย shop ไปใช้ RPC/วิว whitelist และอัปโหลดรูปผ่าน gateway)
- [ ] เพิ่ม `LINE_OA_URL` + GA4 Measurement ID จริงใน config.js
- [ ] แยก wishlist.html/feedback.html ออกจากโดเมนลูกค้าในสารบัญ (เป็น ops)

## Links
- [[events-occasions]]
