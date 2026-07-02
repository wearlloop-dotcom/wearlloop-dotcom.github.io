# BACKEND-SPEC — สิ่งที่ฝั่งระบบ (Supabase) ต้องเพิ่ม ให้ข้อมูลเจ้าของครบ

เอกสารนี้เกิดจากการออดิท end-to-end ของหน้าเจ้าของ (owner) — ฝั่งหน้าเว็บเตรียม
โค้ดรอไว้แล้วแบบ **feature-detect**: ถ้า backend ยังไม่รองรับ หน้าจะ degrade
อย่างสุภาพ (ขึ้น "—" หรือซ่อนส่วนนั้น) และจะติดขึ้นมาเองทันทีที่ backend พร้อม
โดย **ไม่ต้องแก้หน้าเว็บอีก**

ที่อยู่ของ logic ฝั่งเซิร์ฟเวอร์: edge function `acct` และ `ops-rpc`
(อยู่นอก repo นี้ — repo นี้เป็น frontend อย่างเดียว)

---

## 1) ยอดเงินมัดจำลูกค้าที่ถือไว้ (deposit liability)

**ทำไม:** การจอง (`book_cart` / `book_group_cart`) เก็บมัดจำที่ต้องคืน
= หนี้สินของร้าน แต่ไม่มีจอไหนแสดงยอดรวม เจ้าของไม่รู้ว่าถือเงินคนอื่นอยู่เท่าไร

**เพิ่ม action ใน edge fn `acct`:**

```
POST /functions/v1/acct   { "action": "deposit_liability" }
→ 200 { "amount": 12500, "count": 9 }
```

- `amount` = ผลรวมมัดจำของรายการเช่าที่ยังไม่คืนเงิน/ยังไม่ริบ (สถานะ active/รอคืนของ)
- `count` = จำนวนรายการ
- สิทธิ์: owner/manager (เหมือน action `ap`)

**ฝั่งหน้าเว็บ (พร้อมแล้ว):** `cockpit.html` เรียก action นี้ในการ์ด
"ค้างจ่าย & หนี้สิน" — ถ้า error/ไม่มี จะขึ้น footnote เดิม

---

## 2) งบกำไรขาดทุนเลือกงวด + เทียบเดือนก่อน (period-aware P&L)

**ทำไม:** หน้า `accounting.html` ทุกแท็บเป็น "ข้อมูล ณ ปัจจุบัน" เลือกเดือน/ปี
ย้อนหลังไม่ได้ และไม่มีเทียบ MoM

**แก้ action `pnl` (และถ้าทำได้ `overview`) ให้รับ `period`:**

```
POST /functions/v1/acct   { "action": "pnl", "period": "2026-06" }
→ 200 { "period": "2026-06", "rows": [...] }        ← ต้อง echo period กลับมา
```

- **สำคัญ: ต้อง echo `period` กลับใน response** — หน้าเว็บใช้ echo นี้เป็น
  feature-detection ถ้าไม่มี echo หน้าจะถือว่า backend ยังไม่รองรับ และขึ้นคำเตือน
  แทนที่จะติดป้ายงวดผิดบนข้อมูลปัจจุบัน (ป้องกันข้อมูลหลอก)
- ไม่ส่ง `period` มา = พฤติกรรมเดิม (ข้อมูลปัจจุบัน)
- เมื่อรองรับแล้ว หน้าเว็บจะดึงงวดก่อนหน้ามาเทียบ MoM ให้อัตโนมัติ

---

## 3) ลงบัญชีเงินเดือน HR → สมุดบัญชี (payroll posting)

**ทำไม:** สลิปเงินเดือน/ค่าชดเชยอยู่ในระบบ HR (`hr_payslip_*`) แต่ไม่เคยลง GL
— งบกำไรขาดทุนที่เจ้าของเห็น **ไม่มีต้นทุนแรงงาน** (ตอนนี้หน้า accounting
แสดงการ์ด "ต้นทุนคน (จาก HR)" จาก `hr_analytics.labor_cost_base` เป็นข้อมูล
ประกอบเท่านั้น พร้อมหมายเหตุว่ายังไม่ลงงบ)

**ทางที่แนะนำ (ฝั่ง server ล้วน ไม่ต้องแตะหน้าเว็บ):**
เมื่อ `hr_payslip_status` ถูกตั้งเป็น "จ่ายแล้ว" ให้ post รายการเข้า ledger
อัตโนมัติ (Dr เงินเดือน 5xxx / Cr เงินสด 1010) — แล้วการ์ด P&L จะถูกต้องเอง

**ทางเลือก:** เพิ่ม action `payroll_post { period }` ใน `acct`
ที่รวมสลิปงวดนั้นแล้ว post ก้อนเดียว (ถ้าอยากให้กดจากหน้า accounting
แจ้งมาแล้วจะเพิ่มปุ่มให้ — ยังไม่ใส่ เพื่อไม่ให้มีปุ่มที่กดแล้ว error)

---

## 4) เปิดใบกำกับรายใบ (invoice_get)

**ทำไม:** หน้า `tax-doc.html` (พิมพ์ใบกำกับ) ตอนนี้ต้องดึงรายการ invoices
ทั้งหมดมา find ฝั่ง client — ถ้า action `invoices` มี limit/pagination ในอนาคต
ใบเก่าจะพิมพ์ไม่ได้

```
POST /functions/v1/acct   { "action": "invoice_get", "id": "<uuid หรือเลขที่ใบ>" }
→ 200 { "row": { "number", "issue_date", "customer_name", "customer_tax_id",
                  "base", "vat", "total" } }
→ ไม่พบ: { "row": null }
```

**ฝั่งหน้าเว็บ (พร้อมแล้ว):** tax-doc ลอง `invoice_get` ก่อน → fallback
list-find → fallback ข้อมูลที่แนบมากับลิงก์

---

## 5) ย้าย forecast.html เข้า gateway ops-rpc

**สถานะตอนนี้:** forecast.html เรียก RPC ตรงด้วย anon key + `p_uid`
(ตรวจสิทธิ์ฝั่ง server จาก p_uid) — ใช้งานได้ แต่ไม่สอดคล้องกับหน้า ops อื่น

**ต้องทำ 2 อย่างก่อนย้าย:**
1. เพิ่ม `forecast_actuals`, `plan_economics`, `update_plan_price`
   เข้า allowlist ของ edge fn `ops-rpc` (gate เป็น owner-only) และให้ตัว RPC
   รับตัวตนจาก gateway แทน `p_uid` จาก client
2. หน้าต้องเลิกใช้ LIFF ลูกค้า (`CONFIG.LIFF_ID`) แล้วใช้ `OPS_LIFF_ID` ตัวเดียว
   — LIFF SDK init สองไอดีพร้อมกันบน `liff` object เดียวไม่ได้ (เคยลองแล้ว
   เกิด race จนล็อกเจ้าของออกจากหน้า จึง revert)

---

## 6) กระทบยอดสลิป ↔ บิล (reconciliation) — ขั้นถัดไป

หน้า `slips.html` มียอดรวม/ฟิลเตอร์แล้ว แต่สลิปยังไม่ผูกกับ invoice/booking
ถ้าเพิ่ม `invoice_id`/`rental_id` ในข้อมูลสลิปที่ action `slips` ส่งกลับ
จะทำมุมมอง "สลิปที่ยังไม่จับคู่กับบิล" ต่อได้ทันที

---

## หมายเหตุการทดสอบ

ทุกข้อ frontend ใช้ feature-detection — deploy backend ทีละข้อได้อิสระ
ไม่ต้อง sync release กับหน้าเว็บ และถ้า response ไม่ตรง contract หน้าจะ
ถือว่า "ยังไม่รองรับ" (ไม่พังและไม่แสดงข้อมูลผิดป้าย)
