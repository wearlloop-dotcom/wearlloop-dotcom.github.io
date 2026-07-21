# รายงานออดิทความพร้อมเว็บไซต์ LLOOP — 3 ตำแหน่ง (End-to-End)

วันที่: 2026-07-21 · ขอบเขต: หน้าหลังบ้าน (ops) ของ **บุคคล (HR) · จัดซื้อ · การตลาด**
วิธีตรวจ: อ่านหน้าเว็บทุกบรรทัด + **ยืนยันกับของจริงบน Supabase** (edge functions, allowlist ใน gateway, DB functions, สิทธิ์ grant, ข้อมูลพนักงานจริง)

โปรเจกต์จริง: `rprwilsbjptdnvsibjgi` (ap-southeast-1, ACTIVE_HEALTHY)

---

## 1. สรุปผล: 3 ตำแหน่ง — สายเชื่อมพร้อมใช้งานจริงครบ

| ตำแหน่ง | หน้า | Backend | คำสั่ง (RPC/action) | ผลตรวจ |
|---|---|---|---|---|
| บุคคล (HR) | `hr.html` | gateway `ops-rpc` (v65, ACTIVE) | 44 RPC | **อยู่ใน allowlist ครบ + DB function มีจริงครบทุกตัว** |
| จัดซื้อ | `purchasing.html` | edge `acct` (v40, ACTIVE) | 11 action | **มีครบใน acct ทุก action** |
| การตลาด | `marketing.html` | `ops-rpc` + `marketing-ai` (ACTIVE) | 5 RPC + AI | **อยู่ใน allowlist ครบ** |

- ลิงก์เมนู ops ทั้ง 37 หน้า มีไฟล์จริงครบ — ไม่มีลิงก์ตาย
- ไม่พบ mock data / TODO / โค้ดค้าง / "coming soon" ในทั้ง 3 หน้า
- edge functions ที่ทุกหน้าเรียกใช้ deploy แล้วและสถานะ ACTIVE ทั้งหมด

**purchasing ใช้คนละสายกับอีก 2 หน้า:** เรียก edge function `acct` แบบ `{action}` โดยตรง (ไม่ผ่าน gateway ops-rpc) — เหมือน accounting/slips/disputes/case-file ที่ใช้ `acct` ร่วมกัน · ยืนยันแล้วว่า `acct` รองรับครบ: suppliers, supplies, restock, low_stock, po_list, po_unpaid, po_receive, po_pay, po_create, supply_upsert, supplier_upsert

---

## 2. ความปลอดภัย: การแยกสิทธิ์ (พนักงานใหม่ต้องไม่แตะสิทธิ์เจ้าของ)

### ชั้นล่างแน่นดี (ยืนยันจากข้อมูลจริง)
พนักงานในระบบตอนตรวจ: เจ้าของ 1 (is_owner=true), การตลาด 1 (hired), **ผู้สมัคร 1 (status=applicant, ยังไม่ verified)**

- ผู้สมัคร / คนยังไม่ verified → `hr_check_access` ตีกลับ `not_verified`/`inactive` = **เรียก RPC หลังบ้านไม่ได้เลยสักตัว** ปิดสนิท
- พนักงานทั่วไป (care/stock/marketing) → คำสั่งระดับเจ้าของ (owner_cockpit, การเงิน, forecast, การกุศล, จ่ายพาร์ทเนอร์) **ถูกบล็อกด้วย `is_owner` ทุกตัว**
- HR (เงินเดือน/PII/จ้าง) → จำกัดเฉพาะ role `manager`/`hr_admin` (การตลาดเรียกไม่ได้)
- ฟังก์ชันอ่อนไหว (`hr_employee_upsert` ฯลฯ) grant ให้แค่ `service_role`/`postgres` — **ใช้ anon key เรียกตรงข้าม gateway ไม่ได้**

### ช่องโหว่ที่พบ + แก้แล้ว
**[HIGH] ยกระดับสิทธิ์ผ่าน `hr_employee_upsert`** — RPC นี้รับค่า `is_owner` / `is_manager` / `role` จาก payload ได้ตรง ๆ และ gateway อนุญาตให้ role `manager`/`hr_admin` เรียกได้
→ วันที่จ้างผู้จัดการ/hr_admin เข้ามา เขาสามารถตั้ง `is_owner=true` ให้ตัวเอง = กลายเป็นเจ้าของ ผ่านทุก gate
(ตอนตรวจยังไม่มีใครใช้ได้จริงเพราะยังไม่มี role นั้น — แต่เป็นช่องรอเปิดพอขยายทีม)

**แก้แล้วที่ gateway `ops-rpc`** (repo lloop): เพิ่มด่านกันยกระดับ — ถ้าผู้เรียก **ไม่ใช่เจ้าของ** จะสตริป `is_owner`/`is_manager` ออกจาก payload เสมอ และปฏิเสธการตั้ง `role=owner|hr_admin` (`escalation_denied`) · **เจ้าของยังตั้ง is_owner / ใช้ได้ทุกอย่างเหมือนเดิม**

**[MED] สิทธิ์ข้ามแผนก — สัญญาพาร์ทเนอร์** — `contract_list/send/upsert` (หน้า `contracts.html`) เดิมไม่ผูก role = สตาฟ active คนไหนก็เรียกได้ (พนักงานคลังสร้าง/ส่งสัญญาพาร์ทเนอร์ได้)
**แก้แล้ว:** ผูกเป็น `['manager']` (เจ้าของ bypass) ให้ตรงกับเมนู owner/manager

---

## 3. บั๊ก/ปัญหาอื่นที่พบ

| # | ปัญหา | หน้า | สถานะ |
|---|---|---|---|
| 1 | ลิงก์ยืนยันตัวตน (UID) + สัญญาจ้าง 404 — `STAFF_BASE` ชี้ `/liff/staff.html` แต่ไฟล์อยู่ที่ root | hr.html | **แก้แล้ว** → `/staff.html` |
| 2 | emoji ผิดกฎ zero-emoji (`⚠ ✓ ✕`) | hr.html | **แก้แล้ว** (เปลี่ยนเป็นข้อความ) |
| 3 | emoji `✓` 2 จุด | purchasing.html | **แก้แล้ว** |
| 4 | ปุ่มเลือกแพลตฟอร์ม "โพสต์จากชุดจริง" อ้าง element `gplat` ที่ไม่ถูก render → โพสต์ถูกบังคับเป็น instagram เสมอ | marketing.html | **ค้าง** (แนะนำแก้รอบหน้า) |
| 5 | เมนูโชว์ hr.html เฉพาะ owner แต่ backend ให้ manager/hr_admin ใช้ได้ → ผู้จัดการหาเมนูไม่เจอ | ops-menu | UX gap (ปลอดภัย) |

---

## 4. สิ่งที่แก้ในรอบนี้

**repo `wearlloop-dotcom/lloop`** (ต้นทางจริง — ผ่าน PR):
- `supabase/functions/ops-rpc/index.ts` — ด่านกันยกระดับสิทธิ์ is_owner + ผูก role สัญญาพาร์ทเนอร์
- `ops/hr.html` — แก้ STAFF_BASE path (404) + ลบ emoji

**repo นี้ (`wearlloop-dotcom.github.io`)**:
- `purchasing.html` — ลบ emoji (หน้านี้ไม่ได้ sourced จาก lloop จึงแก้ตรงได้)
- ไฟล์รายงานนี้

> หมายเหตุ: หน้า ops (hr/marketing) + gateway + SQL ต้นทางจริงอยู่ที่ repo `lloop` — ถ้าแก้ในรีโปนี้ตรง ๆ จะโดน auto-deploy ทับ จึงต้องแก้ที่ lloop แล้วให้ deploy publish มาเอง

## 5. คำแนะนำต่อ (optional)
- แก้บั๊ก `gplat` ใน marketing.html ให้เลือกแพลตฟอร์มได้จริง
- เพิ่ม hr.html ในเมนูสำหรับ role manager/hr_admin ให้ตรงกับสิทธิ์ backend
- purchasing.html: เพิ่ม `rows = rows||[]` ใน render 5 ฟังก์ชัน ให้ error หลังบ้านโชว์ข้อความจริง
