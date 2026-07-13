# Trust & Moats (passport / trust / เงื่อนไข / นโยบาย)
> raw: `passport.html` · `trust.html` · `rental-terms.html` · `privacy.html` · `about.html` · `charity.html` · อ้างอิงแผน `audit-moats-2026-07.md`, `supabase-p0-moats.sql`, `docs/expansion-strategy.md` • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้
- `passport.html` — **หน้าลูกค้า (public, anon)** "เรื่องราวของชุดตัวนี้": สแกน `?g=<code>`/`?code=` → RPC `passport_public` โชว์แกลเลอรี/เนื้อผ้า/ชุมชนใส่ชุดนี้/กองบุญ + ปุ่มไปเช่า
- `trust.html` — **หน้าลูกค้า (LIFF login)** "สมุดพกของฉัน": RPC `trust_me` ผ่าน gateway `me-rpc` โชว์ tier (Bronze/Silver/Gold), คะแนน, สิทธิ์ไม่วางมัดจำ, สถิติคืนสมบูรณ์/ช้า/เสียหาย
- `rental-terms.html` — **สัญญาเช่า (static, ไม่มี backend)** ค่าเช่า/มัดจำ 100% retail/ค่าปรับคืนช้า/ระดับความเสียหาย/ข้อกฎหมายไทย/เขตอำนาจศาล
- `privacy.html` — **นโยบายความเป็นส่วนตัว (static)** PDPA พ.ร.บ. 2562, ข้อมูลที่เก็บ (LINE UID ฯลฯ), การแชร์บุคคลที่สาม, สิทธิ์เจ้าของข้อมูล
- `about.html` — **หน้าเล่าเรื่องแบรนด์ (static, การตลาด)** hero video, manifesto, 3 pillars, the loop, impact 1:7 — CTA เข้า LIFF
- `charity.html` — **หน้าหลังบ้าน owner-only (ops)** ไม่ใช่หน้าลูกค้า: จัดการกองบุญ/มูลนิธิ/การโอน/สิทธิภาษี/โพสต์กิจกรรม ผ่าน `ops-rpc` (`charity_overview/disburse/partner_upsert/post_upsert`)

## Flow (end-to-end ของโดเมน)
- **เส้นทางความเชื่อใจ (trust loop):** ลูกค้าเช่า→คืน → backend คิดคะแนน (คืนตรง+เรียบร้อย +10, ช้า −15, เสียหาย −20, พิพาท −40) → `trust.html` แสดง tier + ปลดสิทธิ์ "ไม่วางมัดจำ" เมื่อ ยืนยันตัวตน + คืนครบเกณฑ์ + ไม่มีเคสใน 6 เดือน. เชื่อม backend ผ่าน `me-rpc` (gateway inject `p_customer` เอง กัน IDOR — client ไม่เคยส่ง id)
- **เส้นทางเรื่องราวของชุด (passport):** ชุดมีป้าย NFC/QR (`g.html?c=`, `care-label.html`) → คนสแกนเปิด `passport.html` แบบ public เรียก `passport_public` (whitelist ฟิลด์แล้ว, GRANT anon) + `community_feed` (anon) เพื่อโชว์ "คนไซซ์เดียวกันใส่ชุดนี้" → ปิดท้ายด้วยการ์ดกองบุญ (charity latest_post) → ปุ่มไป `garment.html`
- **เส้นทางกองบุญ (charity):** พนักงาน owner จัดการใน `charity.html` (ops) → ยอด/โพสต์ที่บันทึกไปโผล่บนการ์ด "Giving Back" ใน `passport.html` ฝั่งลูกค้า
- **เอกสาร trust แบบ static:** `rental-terms.html` / `privacy.html` เป็นหลักฐานเชิงกฎหมาย (ไม่มี RPC) · `about.html` เป็น storytelling ดันเข้า LIFF

## Insight (รู้อะไร)
- โดเมนนี้คือ "กำแพงที่ 1 (ความเชื่อใจ/ไม่มัดจำ)" + "กำแพงที่ 5 (สุขอนามัยตรวจสอบได้)" ของแผน moats — passport เป็นหน้าโชว์เครดิต, trust เป็นเครื่องยนต์รักษาลูกค้า
- `passport_public` และ `garment_hygiene_public` ถูก GRANT ให้ `anon` โดยตั้งใจ (`supabase-p0-moats.sql`) และ whitelist ฟิลด์ — เป็นรูปแบบ public-RPC ที่ถูกต้องตาม CLAUDE.md (ไม่ได้เรียกตารางตรง)
- ทุกหน้าลูกค้ามี state ครบ (loading / off = feature flag ปิด / not-found / error) — dark-launch ได้ตามแนวทางโปรเจค
- `charity.html` **ไม่ใช่หน้าลูกค้า** แม้อยู่ในโดเมน trust — เป็น ops owner-only (ผ่าน `ops-rpc` + `ops_me`) ที่ auto-deploy มาจาก `lloop/ops/`
- `passport.html` ดึง `community_feed` ทั้งฟีด (60 รายการ) แล้ว filter ฝั่ง client ด้วย `garment_code` — เปลืองเล็กน้อยแต่ไม่ใช่บั๊ก (ยังไม่มี RPC กรองตามชุด)

## Decision (ตัดสินใจอะไรไปแล้ว)
- มัดจำมาตรฐาน = 100% ของราคาขายปลีก, คืนภายใน 3 วันทำการหลังตรวจสภาพ (`rental-terms.html`)
- เกณฑ์คะแนน trust + ระดับ Bronze/Silver(50)/Gold(120) ตายตัวและโชว์ให้ลูกค้าเห็นในหน้า (`trust.html`)
- ใช้ personal gmail + LINE OA เป็นช่องติดต่อ PDPA/สัญญา (ยังไม่มีชื่อนิติบุคคล/DPO)
- ชิป waive-deposit เปิดผ่าน feature flag (แสดง `off` state ถ้ายังปิด)

## Issues (จาก static audit — severity)
- [medium] passport footer ชี้ผิดหน้า — `passport.html:151` ลิงก์ข้อความ "ทีมงาน LLOOP" → `nfc.html` ซึ่งเป็นเครื่องมือ ops แตะ NFC ที่มี PIN gate (`nfc_staff_ok`, opsRpc) ลูกค้าที่กดจะเจอหน้าใส่ PIN พนักงาน ควรชี้ `about.html`
- [medium] og:image ชี้คนละ org — `about.html:9` `og:image = https://lloop-studio.github.io/liff/og-cover.jpg` แต่เว็บจริงคือ `wearlloop-dotcom.github.io` (config `SITE_URL`) รูปพรีวิวตอนแชร์น่าจะ 404 (เป็น lloop-studio ที่เดียวในรีโป)
- [medium] IG handle ไม่ตรงกัน — `about.html:242` ใช้ `@lloop.studio` แต่ `links.html` (IG/TikTok/FB/Shopee) ใช้ `@lloop.th` แพลตฟอร์มเดียวกัน (Instagram) สองแฮนเดิล ลูกค้าไปผิดบัญชี — เลือกอันเดียว
- [medium] สัญญาไม่พูดถึงสิทธิ์ไม่วางมัดจำ — `rental-terms.html` ระบุมัดจำ 100% เก็บทุกครั้งตอนรับชุด ไม่มีข้อยกเว้น แต่ `trust.html` โฆษณา "เช่าได้เลยไม่ต้องวางมัดจำ" สำหรับลูกค้าเครดิตดี → เอกสารสัญญาขัดกับคำสัญญาบนหน้า trust (ควรเพิ่มข้อยกเว้น waive-deposit ในสัญญา)
- [low] `charity.html:200-202` hardcode `SUPABASE_URL`/`SUPABASE_KEY` inline แทนอ่านจาก `config.js` → drift risk (ตรงกับ note เดิมใน audit เรื่อง ops-looks/live) · เป็น ops page auto-deploy จาก lloop
- [low] `charity.html:385` upload storage `uploads` ด้วย anon client ตรง (ไม่ผ่าน gateway) — ขึ้นกับ RLS ของ bucket · เป็นหน้า staff-login แต่ควรตรวจ policy ฝั่ง Supabase
- [low] PDPA/สัญญาใช้ `thanchanok.khong@gmail.com` เป็น data controller contact ไม่มีชื่อนิติบุคคล/DPO — อ่อนเชิงกฎหมายสำหรับหน้าที่อ้าง PDPA (`privacy.html:551`, `rental-terms.html:968`)

## Next action
- [ ] แก้ลิงก์ footer `passport.html` "ทีมงาน LLOOP" → `about.html` (ต้องแก้ที่ `lloop/liff/` ต้นทาง ไม่ใช่รีโปนี้ — จะโดน auto-deploy ทับ)
- [ ] อัปเดต `about.html` og:image เป็นโดเมน `wearlloop-dotcom.github.io` + รวม IG handle ให้เหลือหนึ่ง (@lloop.th หรือ @lloop.studio)
- [ ] เพิ่มข้อ "ยกเว้นมัดจำสำหรับลูกค้าเครดิตดี (LLOOP Trust)" ใน `rental-terms.html` ให้ตรงกับ `trust.html`
- [ ] ให้ `charity.html` อ่าน `SUPABASE_URL/KEY` จาก `config.js` (แก้ต้นทาง `lloop/ops/`) + ทบทวน RLS bucket `uploads`
- [ ] (backend) เพิ่ม RPC กรอง community ตาม `garment_code` เพื่อลด over-fetch ใน passport

## Links
- [[customer-journey]] — trust/deposit เป็นจุดตัดสินใจใน funnel ลูกค้า
- [[logistics-fulfillment]] — hygiene/NFC/QR (passport) ต่อกับ care cycle + shipout
- [[finance]] — waive-deposit + กองบุญ/สิทธิภาษี (charity) กระทบกระแสเงิน
- [[marketing-growth]] — passport community feed + about storytelling ดันเข้า LIFF
