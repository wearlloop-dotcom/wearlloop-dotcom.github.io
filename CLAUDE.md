# CLAUDE.md — wearlloop-dotcom.github.io (หน้าเว็บ)

Repo นี้คือ **หน้าเว็บ static ของ LLOOP** (เช่าชุด + AI สไตลิสต์) เสิร์ฟผ่าน GitHub Pages —
merge เข้า `main` = ขึ้นเว็บจริง https://wearlloop-dotcom.github.io ภายใน ~1-2 นาที
Backend (SQL + Edge Functions) อยู่คนละ repo: `wearlloop-dotcom/lloop`

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

## หลักออกแบบหน้าลูกค้า (UI ต้องคลีน — บังคับทุกหน้าที่หันหน้าเข้าหาลูกค้า)

- **รูปนำ ตัวหนังสือตาม** — ชุดคือพระเอก ให้ภาพกับช่องว่างทำงาน ไม่ใช่ย่อหน้า
- **เพดานข้อความต่อจอ**: หัวข้อ ≤1 บรรทัด · ปุ่มหลัก 1 ปุ่มต่อจอ · เนื้อหาบนจออ่านจบใน ~5 วินาที
- **กฎหนึ่งประโยค**: ทุกฟีเจอร์อธิบายจบในประโยคเดียว (อธิบายไม่จบ = ยังไม่พร้อม ship)
- **ชิป/ไอคอน/ตัวเลข แทนย่อหน้า** (เช่น "พอดี 11/12 คน" แทนคำอธิบายไซซ์ยาว ๆ)
- **รายละเอียดพับหลังแตะ** (progressive disclosure): เงื่อนไข ตำหนิ เครื่องคิดเลข buyback ฯลฯ อยู่หลังแตะ "ดูเพิ่ม" ไม่กองบนหน้าแรก
- **โทนคำแบบเพื่อนคุย** ไม่ใช่ประกาศราชการ และหน้าแรกของลูกค้าแต่ละคนแสดงเฉพาะสิ่งที่เกี่ยวกับตัวเอง ไม่ใช่ทุกโปรแกรมที่ระบบมี

## Feature flags

สวิตช์เปิด-ปิดฟีเจอร์อยู่หน้า `settings.html` (การ์ดต่าง ๆ) เก็บใน `app_settings` ฝั่ง Supabase —
เพิ่มสวิตช์ใหม่: การ์ดใน settings.html + seed คีย์ + เพิ่ม allowlist `hub_settings_set` (repo lloop)
ฟีเจอร์ใหม่ควร ship แบบปิดไว้ก่อน (dark launch) ให้ user เขี่ยเปิดเองเมื่อพร้อม

## เอกสารสำคัญ

- `docs/expansion-strategy.md` — แผนขยายธุรกิจ 6 โมเดล + 3 เฟส (trust score, passport, ฝากเช่า, resale loop ฯลฯ)
- `docs/market-research-resale-loop.md` — ผลศึกษาตลาดมือสอง/buyback/ฝากขาย (ข้อมูลผ่านการตรวจสอบ, ก.ค. 2026)
- งานที่เสร็จแล้ว: trust score (trust.html), garment passport (passport.html), สวิตช์ทั้งหมดใน settings.html
