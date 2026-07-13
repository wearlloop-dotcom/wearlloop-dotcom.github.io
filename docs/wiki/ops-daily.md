# Ops รายวัน + คน (home / today / cockpit / staff / hr / looks)
> raw: [home.html](../../home.html) · [today.html](../../today.html) · [cockpit.html](../../cockpit.html) · [staff.html](../../staff.html) · [hr.html](../../hr.html) · [ops-looks.html](../../ops-looks.html) · เกี่ยวข้อง: [ops-api.js](../../ops-api.js) · [me-api.js](../../me-api.js) · [ops-menu.js](../../ops-menu.js) • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้
- `home.html` — หน้าแรกหลังบ้าน: ทักทายพนักงาน + ความหมายตำแหน่ง + impact eco + กริดเครื่องมือกรองตาม role (ผ่าน `opsVisibleNav`)
- `today.html` — "งานวันนี้": KPI + รายการที่ต้องส่ง/คืน/ซัก/ตรวจ/รับซื้อ + ชุดหายเกิน 14 วัน (`ops_today`, `tag_missing`) — เห็นทุก role
- `cockpit.html` — คอกพิตเจ้าของ: เงินสดวันนี้/เดือน, อัตราหมุนคลัง, ของค้าง, สมาชิก/หนี้/งบซื้อ, ROI ต่อตัว (`owner_cockpit`, `fleet_roi`) — owner-only
- `staff.html` — **พอร์ทัลพนักงาน (self-service)** เปิดผ่าน LINE OA: ลงเวลา, KPI, ประกาศ, ตารางเวร, ลา, เบิก, สลิป, เอกสาร, สัญญา, KYC — routed ผ่าน **me-rpc** (ไม่ใช่ ops!)
- `hr.html` — HR แอดมิน (owner): จัดการพนักงาน, จ้าง/ออก, payroll, KPI, สัญญา, ประกาศ, ลา/เบิก approve, เอกสาร — ผ่าน ops-rpc
- `ops-looks.html` — คัดลุคเด่นชุมชน Loop Looks: feature/ซ่อนลุค, จัดการคอมเมนต์/รายงาน (`ops_looks_recent`, `feature_look`, `ops_reports` ฯลฯ) — marketing/manager

## Flow (end-to-end ของโดเมน)
- **เข้าหลังบ้าน**: พนักงาน login LINE ผ่าน `ops-api.js` (LIFF ops) → `home.html` เรียก `opsMe()` (`ops_me`) ได้ role/is_owner → `ops-menu.js` เรนเดอร์เมนู + กริดเครื่องมือที่กรองตาม role (config กลาง `OPS_NAV`, เจ้าของเห็นหมด). เริ่มงานที่ `today.html`
- **งานประจำวัน**: `today.html` ดึง `ops_today` → KPI + section คลิกไป `shipout/laundry/acquisitions/garment` ตามงาน; เสริม `tag_missing` เตือนชุดไม่ถูกสแกนนาน
- **มุมเจ้าของ**: `cockpit.html` รวมตัวเลขธุรกิจจาก `owner_cockpit` + `fleet_roi` (owner-only, error ถ้าไม่ใช่ owner)
- **คน (2 ฝั่งแยก gateway)**:
  - พนักงานดูของตัวเอง → `staff.html` เปิดจาก LINE OA, ทุก RPC วิ่งผ่าน **me-rpc** (`hr_*_self`, `emp_contract_*_self`, ลงเวลา, ลา, เบิก). ส่ง `p_line_uid` จาก client ได้เพราะ me-rpc override ด้วย idToken (กัน IDOR). อัปโหลดเอกสาร/KYC ผ่าน edge function `kyc` (private bucket)
  - เจ้าของจัดการคน → `hr.html` ผ่าน **ops-rpc** (`hr_overview`, `hr_employee_*`, `hr_payroll_calc`, `emp_contract_*` ฯลฯ). ออกลิงก์ผูก UID/สัญญา/ประกาศ ให้พนักงานเปิดใน `staff.html?token=/ec=/ann=`
- **ชุมชน**: `ops-looks.html` เป็นเครื่องมือ moderation ของฝั่ง marketing เชื่อมกับฟีด Loop Looks ฝั่งลูกค้า (`looks.html`)

## Insight (รู้อะไร)
- โดเมนนี้คร่อม **2 gateway**: หน้า ops แท้ (home/today/cockpit/hr/ops-looks) ใช้ `ops-rpc`; แต่ `staff.html` คือหน้า "ลูกค้า/พนักงาน" ใช้ `me-rpc` + LIFF ลูกค้า (`CONFIG.LIFF_ID`) — ชื่อไฟล์ทำให้เข้าใจผิดง่ายว่าเป็นหน้า ops
- `me-rpc` และ `ops-rpc` เป็น drop-in ของ `sb.rpc` (คืน `{data,error}`) — ทุกหน้าสร้าง supabase client ด้วย anon key แล้ว override `sb.rpc` เป็น gateway → anon key ไม่ได้ให้สิทธิ์ RPC ตรง ๆ
- การกรองเมนูตาม role ใน `ops-menu.js` เป็น **UX เท่านั้น** ไม่ใช่ authz — ใครพิมพ์ URL `cockpit.html`/`hr.html` ตรงก็เข้าถึง fetch ได้ แต่ gateway (owner-only/allowlist) เป็นตัวบล็อกจริง (cockpit/hr โชว์ error ถ้าไม่ผ่าน) — ถูกต้องตามดีไซน์ แต่ห้ามถือว่าเมนู = ความปลอดภัย
- `staff.html` ถูก hardening แล้ว: ย้ายอัปโหลดเอกสาร/KYC จาก direct storage ไป edge function `kyc` (คอมเมนต์: "กันลิงก์สาธารณะรั่ว") — แต่ `hr.html` ฝั่งเจ้าของ **ยังไม่ย้าย** (ดู Issues)
- RPC ที่โดเมนพึ่ง (ต้องอยู่ใน allowlist ของ gateway ที่ deploy จริง มิฉะนั้น `fn_not_allowed`):
  - ops-rpc: `ops_me`, `ops_my_journey`, `ops_impact`, `ops_today`, `tag_missing`, `owner_cockpit`, `fleet_roi`, `ops_looks_recent`, `feature_look`, `ops_comments_recent`, `hide_comment`, `ops_reports`, `reject_look`, `publish_look`, และชุด `hr_*`/`emp_contract_*`/`branch_list` ใน hr.html
  - me-rpc: `hr_verify_bind`, `hr_check_access`, `hr_employee_self`, `hr_*_self` (claim/leave/schedule/task/payslip/kpi/doc/attendance/announcement), `hr_check_in/out`, `emp_contract_*` (self/sign/decline), `consent_text`
- `cockpit.html` แก้ CSS cascade เอง: `ops-ui.css` ออกแบบ `.kpi` ไว้สำหรับ hero พื้นเข้ม (ตัวเลขสีขาว) โหลดทีหลังเลยทับ → cockpit override คืนสีตัวเลขบนการ์ดพื้นสว่าง (คอมเมนต์อธิบายไว้ชัด)
- home/today/cockpit เป็นไทยล้วน (ops ภายใน) ส่วน `staff.html` มี i18n ไทย/อังกฤษ/พม่า/ลาว เพื่อพนักงานต่างชาติ — ตั้งใจ ไม่ใช่ตกหล่น

## Decision (ตัดสินใจอะไรไปแล้ว)
- แยก gateway ชัด: พนักงานดูข้อมูลตัวเอง = me-rpc (identity = LINE ของตัวเอง, override id กัน IDOR); เจ้าของจัดการคนอื่น = ops-rpc (staff+owner check)
- `staff.html` เก็บเอกสาร/KYC ลง private bucket ผ่าน edge function `kyc` แทน public storage (กัน PII รั่วผ่านลิงก์สาธารณะ)
- `cockpit.html` เข้าได้เฉพาะ owner — โชว์ error ชี้แจงถ้าไม่ใช่ (ไม่พยายามซ่อนเงียบ)
- เมนู/กริดเครื่องมือคุมที่เดียว (`OPS_NAV` ใน ops-menu.js) ใช้ทั้ง home + drawer

## Issues (จาก static audit — severity)
- [high] เอกสาร HR (PII: บัตร ปชช./สัญญา) จัดการผ่าน anon-key storage ตรง ไม่ผ่าน gateway — `hr.html` — `uploadDoc()` เรียก `sb.storage.from('hr-docs').upload(...)` + `getPublicUrl(path)` แล้วเก็บ **public URL** ลง DB ผ่าน `hr_doc_add`; `viewDoc()` สร้าง signed URL เอง. ทั้งหมดใช้ publishable/anon key (public ใน config.js) ยิงตรงเข้า Supabase Storage — ถ้า bucket `hr-docs` มี policy อนุญาต anon = PII หลุดถึงใครก็ได้ที่มีคีย์; ถ้า private ล้วน = flow นี้ทำงานได้เฉพาะเมื่อ anon role มีสิทธิ์ storage (พื้นผิวสิทธิ์นอก gateway). ขัดกับสถาปัตยกรรม CLAUDE.md (ops ต้องผ่าน ops-rpc) และขัดกับ `staff.html` ที่ย้ายไป edge function `kyc` แล้ว — ควรย้าย hr.html ไปใช้เส้นทางเดียวกัน
- [medium] ลิงก์เอกสารในพอร์ทัลพนักงานใช้ raw url อาจเปิดไม่ขึ้น/ชี้ลิงก์สาธารณะ — `staff.html` — `loadDocTab()` เรนเดอร์ `<a href="${d.url}" target="_blank">` ตรง ๆ ขณะที่ `hr.html` จงใจไม่ทำแบบนี้ (คอมเมนต์: hr-docs เป็น bucket ส่วนตัว getPublicUrl เปิดไม่ขึ้น ต้องขอ signed URL). ถ้า `hr_doc_self` คืน path/public url ของ bucket ส่วนตัว ลิงก์เอกสารของพนักงานจะเปิดไม่ได้ (หรือถ้าเปิดได้แปลว่าเป็นลิงก์สาธารณะ = รั่ว) — จัดการข้อมูลชุดเดียวกันคนละแบบระหว่าง 2 หน้า
- [low] แท็บ ROI ตั้ง label เป็นการกรองแต่โค้ดไม่กรองจริง — `cockpit.html` — ปุ่ม "ทุนยังไม่คืน / ชุดนิ่ง" กับ "ทำเงินสูงสุด" ทำแค่ `ROI.slice(0,12)` กับ `.slice().reverse()` โดยไม่ filter ตาม `roi<1`/idle เลย → ผลลัพธ์พึ่งลำดับ sort ของ `fleet_roi` ฝั่ง backend ทั้งหมด ไม่มี guard ฝั่ง client ถ้า backend เรียงไม่ตรงสมมติฐาน แท็บ "ทุนยังไม่คืน" อาจโชว์ตัวที่คืนทุนแล้ว (label ไม่ตรงเนื้อหา)
- [low] คีย์/URL ฝังซ้ำหลายไฟล์แทนอ่านจาก CONFIG — `today.html` / `cockpit.html` / `ops-looks.html` / `hr.html` — hardcode `SUPABASE_URL` + `SUPABASE_KEY` เป็น const ในไฟล์ ขณะที่ `staff.html` อ่านจาก `CONFIG.SUPABASE_URL/SUPABASE_ANON_KEY`. ไม่ใช่การรั่วความลับ (เป็น publishable key ที่อยู่ใน config.js อยู่แล้ว) แต่เปลี่ยนโปรเจค/คีย์ต้องไล่แก้หลายที่ เสี่ยงหลุดไฟล์ (ต้นทางจริง `lloop/ops/`)

## Next action
- [ ] ย้าย `hr.html` การอัปโหลด/ดูเอกสาร HR ไปใช้ edge function `kyc`/gateway เหมือน `staff.html` (เลิก `sb.storage.from('hr-docs')` + getPublicUrl ตรง) — แก้ที่ `lloop/ops/` ให้ deploy ทับ ห้ามแก้รีโปนี้ตรง
- [ ] ยืนยัน policy ของ bucket `hr-docs` ว่าไม่เปิด anon และไม่มี public URL ค้างใน DB (`hr_documents.url`)
- [ ] ให้ `staff.html` เปิดเอกสารผ่าน signed URL (หรือ RPC ที่คืน signed) แทนการฝัง `d.url` ตรง
- [ ] เพิ่ม filter จริงใน ROI 2 แท็บของ cockpit (roi<1/idle vs top) ไม่พึ่ง sort backend อย่างเดียว
- [ ] ยืนยัน RPC ทั้งชุดของโดเมนอยู่ใน allowlist ของ `ops-rpc` และ `me-rpc` ที่ deploy จริง (dashboard อาจใหม่กว่าซอร์ส lloop)

## Links
- [[stock-inventory]]
- [[customer-journey]]
- [[events-occasions]]
