# UX Copy Audit — ตรวจ "ข้อความเยอะเกินไป" ทุกหน้า (58 หน้า)

วันที่ตรวจ: 2026-07-02
วิธีตรวจ: วัดปริมาณข้อความจริงที่ผู้ใช้เห็น (ตัด script/style) + อ่านทุกหน้าแบบละเอียด รวมถึงข้อความไทยที่ฝังใน `<script>` (toast/alert/empty state) ซึ่งเรนเดอร์ขึ้น UI จริง

---

## สรุปภาพรวม

จาก 58 หน้า:
- 🔴 **ต้องแก้ก่อน (HIGH): 6 หน้า** — contract, staff, group-checkout, family, looks, join
- 🟠 **ควรแก้ (MEDIUM): 10 หน้า** — rental-terms, settings, forecast, partner, accounting, event, pay, disputes, stock, purchasing
- 🟡 **แก้ได้ถ้ามีเวลา (LOW-MED): ~8 หน้า** — hr, intake, analytics, ugc, quiz, g, nfc, branches
- 🟢 **พอดีแล้ว: ~34 หน้า** — รวมถึง privacy.html ที่ยาวแต่จัดโครงสร้างดี (ตัวอย่างที่ดี), about.html (storytelling ตั้งใจ), index.html, shop.html และหน้า ops ส่วนใหญ่

---

## ปัญหาซ้ำที่เจอทั่วทั้งระบบ (แก้ทีเดียวได้หลายหน้า)

### P1 — Dev-note หลุดเข้า UI ผู้ใช้จริง 🔴
ข้อความสำหรับนักพัฒนาแสดงให้ลูกค้า/เจ้าของร้านเห็น:
- `family.html:828,915` — toast บอกชื่อ RPC: "ของจริงเรียก group_respond(accept)..."
- `event.html:152` — "ของจริงต่อกับ Supabase ผ่าน api.js (group_event_status...)"
- `accounting.html:210`, `cockpit.html:170` — อ้าง "ดูสเปกใน BACKEND-SPEC.md" ใน UI
- `nfc.html:233` — "โครงระบบพร้อมแล้ว พอเปิดบนเครื่องที่รองรับก็ใช้ได้ทันที"

**แก้:** ลบออกทั้งหมด

### P2 — ยัดหลายไอเดียในประโยคเดียว คั่นด้วย `·` / `—`
เจอในเกือบทุก hero subline และ helper: `disputes.html:50`, `ugc.html:55`, `family.html:160`, `group-checkout.html`, `forecast.html:103`
**แก้:** เหลือ 1 ประโยคหลัก ที่เหลือย้ายเป็น tooltip หรือตัดทิ้ง

### P3 — คำอธิบายยาวยัดใน `<label>` และ `placeholder`
เช่น `intake.html:95` "เรทปกติก่อนลด (บาท) — ใส่แล้วหน้าเว็บโชว์ราคาขีดฆ่า ส่วน..." / `partner.html:376,436` placeholder เป็นประโยคตัวอย่างยาว
**แก้:** label = ชื่อฟิลด์ล้วน · ตัวอย่าง/เงื่อนไข → helper บรรทัดเล็กหรือ tooltip

### P4 — Empty/error state เขียนเป็นย่อหน้า 2 ประโยค
เจอมากใน pay, looks, join, group-checkout, family
**แก้:** สูตรกลาง = "หัวข้อสั้น + คำอธิบาย 1 บรรทัด + ปุ่ม" พอ

### P5 — Copy การตลาดเชิงกวีในหน้าเครื่องมือ staff
`.phead` hero ของหน้าหลังบ้านทุกหน้า เช่น accounting:78 "...โปร่งใสทุกบาท เพื่อให้ธุรกิจเดินหน้าต่อได้อย่างมั่นคง", purchasing:63, market:68, influencers:117, repair:72
**แก้:** หน้า staff ใช้คำอธิบายหน้าที่สั้น ๆ พอ — เก็บ copy กวีไว้เฉพาะหน้าลูกค้า

### P6 — พูดเรื่องเดิมซ้ำหลายจุดบนหน้าเดียว
- `event.html` — "ระบบเตือนอัตโนมัติ" ซ้ำ 3-4 ที่ (L141, L145, L333-334)
- `join.html` — value prop "จัดชุดเข้าตีม + เช่าพร้อมกัน" ซ้ำ 3 รอบ (L129, L139, L256/259)
- `stock.html` — confirm dialog (L125) ทวนเนื้อหา helper (L49) เกือบทั้งหมด
- `rental-terms.html` — effective date ซ้ำ 3 ที่ (L499, 506-509, 539-540)
- `index.html` — login consent note ซ้ำ 2 ที่ (L1254, 1269)
- `wed.html` — note เครดิต ฿50 ซ้ำ 2 หน้าจอ (L95, 152)

---

## 🔴 หน้าที่ต้องแก้ก่อน (HIGH)

### 1. contract.html — หน้าเซ็นสัญญาพาร์ทเนอร์
สัญญา ~12k อักษรไทย generate ใน JS เป็นกำแพงย่อหน้า
- `buildClauses()` สร้าง 24+ ข้อสัญญาเรียงยาวติดกัน ไม่มีสารบัญ/พับข้อ (L300-413) — ข้อ indemnification ประโยคเดียว 4 บรรทัด (L372), ข้อ quota 5 ย่อหน้าติด (L326-332)
- consent checkbox ประโยคเดียว 5 บรรทัด (L166)

**แก้:** accordion ต่อข้อ (พับ default) + สารบัญ + ชู "สรุปสาระสำคัญ" เป็น TL;DR + consent เหลือ 1 บรรทัด

### 2. staff.html — พอร์ทัลพนักงาน
- คู่มือ "วิธีการทำงาน" 8 หัวข้อ × 4 ภาษา (ไทย/EN/พม่า/ลาว) แต่ละข้อ 1-2 บรรทัดเต็ม (L108-165) = กำแพงข้อความ
- ย่อหน้ากฎหมายในสัญญาจ้าง (L256) + consent KYC ยาว (L277, 593-595)
- ข้อความ gate หลายบรรทัด (L332-334)

**แก้:** คู่มือเหลือหัวข้อ + วลี ≤10 คำ ซ่อนรายละเอียดใต้ "ดูเพิ่ม" · consent เหลือ 1 บรรทัด + ลิงก์ "อ่านฉบับเต็ม"

### 3. group-checkout.html — เช่าหมู่/จ่ายรวม
ข้อความยาวฝังใน JS เกือบทุก state
- KYC box ประโยคเดียวยาวมาก (L921) · holdnote 30 นาที เขียนซ้ำ 2 ที่ (L962, 1028)
- edge state 2 ประโยค (L500) · venuehint 2 บรรทัดซ้อน (L581-582)
- ตัวเลือกวิธีส่งมี bold + subtext อธิบายทุกอัน (L760-762)

**แก้:** ทุก state เหลือ 1 บรรทัด เหตุผลย้ายไปลิงก์ "ทำไม?"

### 4. family.html — กลุ่มครอบครัว
- hsub ยัด 3 ไอเดียในประโยคเดียว (L160) · empty state ยาว (L512)
- toast โชว์ dev-note (L828, 915) · aiqHint มีวงเล็บอธิบายซ้ำ (L320-323)

**แก้:** ลบ dev-note ทั้งหมด · hsub เหลือ 1 ประโยค · empty = หัวข้อสั้น + ปุ่ม

### 5. looks.html — ลุคของฉัน
- อธิบายลิงก์ referral ยาว (L636) · consent รีโพสต์ยาว (L667)
- empty state 2 ประโยค 3 จุด (L327, 465, 485) · placeholder/toast ยาว (L654, 695)

**แก้:** empty/consent เหลือประโยคเดียว

### 6. join.html — รับคำเชิญเข้ากลุ่ม
- value prop ซ้ำ 3 รอบ (L129, 139, 256/259)
- edge-state เป็นย่อหน้าและมีหลายเวอร์ชันใกล้เคียงกัน (L163, 328, 330, 354/358) · alert ยาว (L310)

**แก้:** value prop เหลือประโยคเดียว ลบ 3-step ที่ซ้ำ · edge message สั้นแบบ "ลิงก์นี้ใช้ไม่ได้แล้ว — ขอลิงก์ใหม่จากเพื่อน"

---

## 🟠 ควรแก้ (MEDIUM)

| หน้า | ปัญหาหลัก | แก้ |
|---|---|---|
| **rental-terms.html** | ยาวแบบกฎหมาย (โครงสร้าง heading/ตารางดีอยู่แล้ว) แต่ข้อ 4.4 ค่าเสียหายซ้อน 3 ตาราง (L739-841), ข้อ 3 ซ้อน callout+bullet+ตาราง+หมายเหตุ 4 ชั้น (L601-622) | ยุบข้อ 4.4 เป็น accordion "ดูวิธีคำนวณ" โชว์แค่บรรทัดสรุป |
| **settings.html** | ทุกสวิตช์มี desc+note+need ซ้อน 2-3 ชั้น (L119, 132, 161) + hint ท้ายหน้าอธิบาย architecture (L177-180) | desc เหลือประโยคเดียว เงื่อนไข → tooltip (i) |
| **forecast.html** | label input เป็นประโยคยาว (L103, 116) + note margin 3 บรรทัด (L137) | label เป็นคำสั้น ส่วนขยาย → helper |
| **partner.html** | placeholder เป็นประโยคตัวอย่างยาวทุกช่อง (L376, 436) + gate/disclaimer ยาว (L585, 225) — jump-nav มีแล้วดี | placeholder เหลือ 1-2 คำ ตัวอย่างยาว → helper "ตัวอย่าง:" |
| **accounting.html** | note/disclaimer แทรกเกือบทุกแท็บ (L139, 210, 266, 295, 314) + คำโปรโมต "คนน้อย AI มาก" | ตัดคำโปรโมต + เอา BACKEND-SPEC.md ออก |
| **event.html** | เรื่อง "เตือนอัตโนมัติ" ซ้ำ 3-4 จุด (L141, 145, 333-334) + demoNote โชว์ API (L152) | เก็บไว้ที่เดียวใต้ปุ่ม ลบ demoNote |
| **pay.html** | ทุก error/empty state เป็น 2 ประโยคเต็ม (L181, 205, 208, 219, 265, 359) | หัวข้อ + 1 ประโยคสั้น |
| **disputes.html** | sub 4 ท่อนคั่น · (L50), dropdown 14 ชนิดคดีมีมาตรากฎหมายทุก option (L58-72) | sub เหลือ 2 ท่อน มาตรา → helper ตอนเลือกแล้ว |
| **stock.html** | confirm dialog มี bullet 3 บรรทัด (L125) ซ้ำกับ helper (L49) | confirm เหลือคำถามสั้น รายละเอียดอยู่ที่ helper แล้ว |
| **purchasing.html** | helper อธิบายเกิน (L139, 152) + placeholder ยาว (L153, 189) | ย่อ helper เหลือ "วางลิงก์ Shopee/Lazada/IG แล้วกดดึง" |

---

## 🟡 แก้ได้ถ้ามีเวลา (LOW-MEDIUM)

- **hr.html** — option role มีวงเล็บอธิบายยาว (L121-122, 339) + hint ยาวต่อ tab (L367, 454) → เก็บชื่อ role ล้วน สิทธิ์แสดงตอนเลือก
- **intake.html** — label ยัดคำอธิบาย (L68, 95) + note ท้ายปุ่ม 2 บรรทัด (L122) → ย่อ label ย้ายเป็น helper
- **analytics.html** — setup guide 4 ขั้นโชว์ตลอดแม้ตั้งค่าเสร็จ (L262-293) → พับเป็น accordion โชว์เฉพาะยังไม่เชื่อม
- **ugc.html** — sub ยัด flow ทั้งเส้นในบรรทัดเดียว (L55) + desc 3 เคสในประโยคเดียว (L73) → แตก bullet สั้น
- **quiz.html** — helper ใต้ผลลัพธ์ 2 บรรทัดทับกับ lead (L193) → เหลือบรรทัดเดียว
- **g.html** — note KYC/paynote/trust line ยาว (L249, 316, 372) → เหลือใจความเดียว
- **nfc.html** — ข้อความ no-NFC เป็นย่อหน้า + dev-note (L233) → ตัดท่อนหลัง เหลือ 1 ประโยค
- **branches.html** — banner เฟส 2 ยาว (L60) → "เฟส 2 · สร้างไว้ก่อนได้ ค่าเริ่มต้นปิด"
- **wed.html** — note ฿50 ซ้ำ 2 ที่ (L95, 152) → เหลือที่เดียว
- **cockpit.html** — หมายเหตุอ้าง BACKEND-SPEC.md (L170) → ลบ
- **seller.html** — consent PDPA ประโยคยาว (L86) → "ยินยอมให้เก็บข้อมูลเพื่อออกใบรับซื้อ (PDPA)" + ลิงก์
- **index.html** — login consent ซ้ำ 2 ที่ (L1254, 1269) → เหลือที่เดียว
- **requests.html** — sub waitlist ยาว (L242) → ตัดครึ่งหลัง
- **case-file.html** — หมายเหตุรูป QC ในวงเล็บยาว (L76) → ย่อ (disclaimer พ.ร.บ. ที่ L73 คงไว้ได้ เป็นเอกสารหลักฐาน)

---

## 🟢 หน้าที่พอดีแล้ว ไม่ต้องแก้

privacy (โครงสร้างดีมาก — ใช้เป็นต้นแบบหน้ากฎหมายได้), about (storytelling ตั้งใจ เว้นจังหวะดี), home (motivational copy เยอะแต่รับได้ในฐานะหน้า culture), index, shop, ops-partner, review, slips, laundry, laundry-shops, stylist-bookings, labels, care-label, wishlist, marketing, live, ig-card, links, csv, putaway, market, influencers, today, garment, ops-looks, tax-doc, creator, repair, shipout, wed (แก้จุดซ้ำจุดเดียว), cockpit (แก้จุดเดียว)

---

## หลักการเขียน copy ที่แนะนำ (ใช้ตอนแก้)

1. **Empty/error state:** หัวข้อ ≤6 คำ + คำอธิบาย 1 บรรทัด + ปุ่ม
2. **Label ฟอร์ม:** ชื่อฟิลด์ล้วน · เงื่อนไข/ตัวอย่าง → helper เล็กหรือ tooltip
3. **Consent/กฎหมายในแอป:** 1 บรรทัด + ลิงก์ "อ่านฉบับเต็ม"
4. **เนื้อหายาวจำเป็น (สัญญา/เงื่อนไข):** accordion พับ default + TL;DR ด้านบน
5. **เรื่องเดียวพูดที่เดียว:** ก่อนเพิ่ม note ใหม่ เช็กว่ามีที่อื่นบนหน้าพูดแล้วหรือยัง
6. **ห้าม dev-note ใน UI:** ชื่อ API/ไฟล์สเปก/สถานะระบบภายใน ไม่โชว์ผู้ใช้
