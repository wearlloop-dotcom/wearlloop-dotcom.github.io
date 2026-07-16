# CLAUDE.md — wearlloop-dotcom.github.io (หน้าเว็บ)

Repo นี้คือ **หน้าเว็บ static ของ LLOOP** (เช่าชุด + AI สไตลิสต์) เสิร์ฟผ่าน GitHub Pages —
merge เข้า `main` = ขึ้นเว็บจริง https://wearlloop-dotcom.github.io ภายใน ~1-2 นาที
Backend (SQL + Edge Functions) อยู่คนละ repo: `wearlloop-dotcom/lloop`

## สไตล์: ห้ามใช้ emoji ทั้งโปรเจค

โปรเจคนี้ **ไม่ใช้ emoji เลย** ทั้งใน UI หน้าเว็บ, ปุ่ม, ข้อความ, ไอคอนช่วยเหลือ ฯลฯ —
ใช้ตัวหนังสือ/สัญลักษณ์เรียบ ๆ (เช่น `?`, `▾`, `·`) หรือ SVG แทน · ห้าม commit emoji ลงหน้าเว็บ

## ⚠️ ห้ามแก้หน้า ops ตรงในรีโปนี้ — จะโดน auto-deploy ทับ

repo `lloop` มี workflow `deploy-site.yml` (อยู่บน branch ที่กำลังพัฒนา เช่น `new-arrivals-notify-fix`)
คอย **copy `lloop/ops/*` + `lloop/liff/*` มาเขียนทับรีโปนี้** ทุกครั้งที่มี push
(commit ชื่อ "Auto-deploy from lloop@…" / "Publish customer site") —
เคยเกิดแล้ว: หน้า stock ใหม่ merge ที่นี่ตรง ๆ แล้วโดนทับกลับเป็นของเก่าภายใน 20 นาที

**ต้นทางจริงคือ `lloop/ops/`**: ทุกหน้า ops (`stock.html`, `home.html`, `today.html` ฯลฯ)
+ `ops-api.js`, `ops-ui.css`, `ops-menu.js`, `scan.js`, `qc-photo.js`
→ แก้ที่ `lloop/ops/` แล้วให้ deploy-site publish มาเอง (path ใน lloop ใช้ `../liff/config.js`
— ตัว deploy sed เป็น `config.js` ให้ตอน publish) · หน้าลูกค้าต้นทางอยู่ `lloop/liff/`

## ⚡ ถ้างานต้องแตะ SQL/backend

ไม่ต้องให้ user ก็อบ SQL ไปวางใน SQL Editor เอง — ขอ add repo `wearlloop-dotcom/lloop` เข้าเซสชัน แล้ว:
เขียนไฟล์ `supabase/*.sql` → เปิด PR ให้ user เห็นชอบ → เมื่อ merge เข้า main ของ lloop แล้ว
GitHub Actions (`supabase-sql.yml`) รันเข้า Supabase ให้อัตโนมัติ (secret ตั้งแล้ว) —
trigger เจาะจงไฟล์ผ่าน `actions_run_trigger` ก็ได้ และรายงานผลรันให้ user รู้เสมอ
รายละเอียดอยู่ใน `CLAUDE.md` + `SETUP.md` ของ repo lloop

## สถาปัตยกรรมหน้าเว็บ

- ทุกหน้าเป็น HTML เดี่ยว self-contained (style + script ในไฟล์) โหลด `config.js` เป็นค่ากลาง
- **หน้าลูกค้า**: login LINE (LIFF) → เรียก RPC ผ่าน `me-api.js` (`window.meRpc`) —
  gateway `me-rpc` verify idToken แล้ว inject `p_customer` เอง (กัน IDOR) ห้ามส่ง id จาก client
- **หน้าหลังบ้าน (ops)**: เรียกผ่าน `ops-api.js` (`window.opsRpc`) — gateway `ops-rpc`
  เช็คพนักงาน active + allowlist + owner-only
- **RPC ใหม่ต้องถูกเพิ่มใน allowlist ของ gateway** ไม่งั้นเจอ `fn_not_allowed` —
  ตัว deploy จริงบน Supabase dashboard อาจใหม่กว่าซอร์สในรีโป lloop เสมอ ให้เทียบก่อนแก้
- หน้า public แท้ ๆ (ไม่ login) เรียก Supabase ตรงด้วย anon key ได้ เฉพาะ RPC ที่ whitelist ฟิลด์แล้ว
  (ตัวอย่าง: `passport.html` → `passport_public`)

## Feature flags

สวิตช์เปิด-ปิดฟีเจอร์อยู่หน้า `settings.html` (การ์ดต่าง ๆ) เก็บใน `app_settings` ฝั่ง Supabase —
เพิ่มสวิตช์ใหม่: การ์ดใน settings.html + seed คีย์ + เพิ่ม allowlist `hub_settings_set` (repo lloop)
ฟีเจอร์ใหม่ควร ship แบบปิดไว้ก่อน (dark launch) ให้ user เขี่ยเปิดเองเมื่อพร้อม

## สกิล /banana — สร้าง/แก้รูปด้วย Gemini (Nano Banana)

สกิลอยู่ที่ `.claude/skills/banana/` (เขียนขึ้นเองในรีโปนี้ ตรวจสอบได้ทั้งไฟล์) —
ใช้สั่งสร้างรูป หรืออัปโหลดรูปให้ redesign เช่น จัดห้องใหม่แบบ interior designer
หรือแต่งรูปสินค้า/ชุดของ LLOOP · **ต้องตั้ง env var `GOOGLE_AI_API_KEY`**
ใน environment settings ของ Claude Code ก่อน (ขอคีย์ฟรีที่ https://aistudio.google.com/apikey)
— ห้าม commit คีย์ลงรีโป และห้าม commit รูปที่ generate ลงรีโป (เซฟลง scratchpad แล้วส่งให้ user)

## เอกสารสำคัญ

- `docs/expansion-strategy.md` — แผนขยายธุรกิจ 5 โมเดล + 3 เฟส (trust score, passport, ฝากเช่า ฯลฯ)
- งานที่เสร็จแล้ว: trust score (trust.html), garment passport (passport.html), สวิตช์ทั้งหมดใน settings.html
