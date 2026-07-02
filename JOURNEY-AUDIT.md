# รายงาน Audit ตาม Workflow-Journey — WEARLLOOP

> ตรวจ 2 ก.ค. 2026 · วิธี: 28 agent ไล่ทีละ workflow ข้าม role แล้ว verify แบบ adversarial · ไล่ "ข้อมูล 1 ก้อน" ข้ามหน้า/RPC เพื่อจับบั๊ก "สะท้อนไม่ครบ" ที่จุดต่อ (seam) ซึ่ง audit รอบไฟล์มองไม่เห็น

**รวม 42 seam-issue ที่ยืนยันแล้ว** — วิกฤต 2 · สำคัญ 19 · ย่อย 21 (เอกสารนี้เสริม AUDIT.md รอบไฟล์ ไม่ทับซ้อน — เป็นมิติ "การส่งต่อข้อมูลข้ามตำแหน่ง")

---

## ภาพใหญ่ที่สุด: ระบบมี "2 โลก" ที่ไม่เชื่อมกัน

รอบ journey เปิดรากปัญหาที่กระจายเป็นหลาย finding ย่อย — ระบบแยกเป็น 2 โลกที่ backend คนละชุด client ไม่เย็บให้ต่อ:

| | โลกฝั่งชุด (garment) | โลกฝั่งออเดอร์/เงิน (rental) |
|---|---|---|
| คีย์ | `p_code` (g1, g2…) | `rental_id` |
| Backend | `ops-rpc` (staff+role) | `me-rpc`/`acct` edge fn |
| หน้า | intake, putaway, stock, laundry, garment, nfc | app.js my_rentals, pay, review, disputes, accounting |

รอยต่อระหว่าง 2 โลกนี้ **แทบไม่มีในโค้ด client** → เกิดอาการซ้ำ ๆ: จัดซื้อ/รับซื้อชุดแล้วชุดไม่โผล่ในคลัง, check-in ชุดไม่อ้าง rental_id, ค่าเสียหายตอน QC ไม่ผูกมัดจำ/ลูกค้า, ต้นทุนถูกกรอกซ้ำสองที่. ถ้าจะแก้เชิงระบบ ควรทำ "สะพาน" ให้ event ฝั่งชุดอัปเดตออเดอร์/บัญชีอัตโนมัติ (ผ่าน po_id / rental_id / garment_id ที่ผูกกันจริง)

---

## ประเด็นวิกฤต/สำคัญ ที่ควรแก้ก่อน

- 🔴 วิกฤต · `purchasing.html:216` — **PO ประเภท asset (ชุดให้เช่า) รับของแล้วไม่แปลงเป็น garment — เส้นทางขาด**
- 🔴 วิกฤต · `purchasing.html:199` — **buy flow ช้อปเพิ่ม: ขั้น "ส่งเข้าคลัง" ให้พิมพ์รหัสชุดที่ต้องมีอยู่แล้ว ไม่สร้างชุดจริง**
- 🟠 สำคัญ · `purchasing.html:254` — **รับของชุดให้เช่า (kind=asset) เป็น dead-end — ไม่สร้างชุดในคลัง ต้นทุนถูกกรอกซ้ำที่ intake ไม่ผูกกัน**
- 🟠 สำคัญ · `slips.html:137` — **กล่องสลิปไม่มีปุ่มยืนยัน/ปฏิเสธ — สลิป 'รอยืนยันมือ' ไปต่อขึ้นบัญชีไม่ได้**
- 🟠 สำคัญ · `accounting.html:196` — **ปุ่ม 'พิมพ์' ใบกำกับภาษีชี้ tax-doc.html ที่ไม่มีไฟล์ในโปรเจกต์ (404 ทุกใบ)**
- 🟠 สำคัญ · `nfc.html:189` — **nfc.html บังคับรหัสชุดเป็นตัวพิมพ์ใหญ่ (G1) สวนทางกับทั้งระบบที่ใช้ตัวพิมพ์เล็ก (g1) → ผูก tag/lookup ข้ามหน้าเพี้ยน**
- 🟠 สำคัญ · `shipout.html:84` — **shipout.html ไม่รับ ?code= ที่ today.html ส่งมา (ต้องพิมพ์โค้ดซ้ำเอง)**
- 🟠 สำคัญ · `app.js:3104` — **หน้า 'ออเดอร์ของฉัน' โชว์ courier/tracking/eta ได้ แต่ไม่มีหน้าไหนบันทึกเลขพัสดุเลย (dead-end)**
- 🟠 สำคัญ · `partner.html:684` — **service_modes (สตูดิโอ/นอกสถานที่/ออนไลน์) ที่สมัครไว้ ไม่ถูกใช้ที่ใด และการจองฝั่งลูกค้า hardcode 'studio'**
- 🟠 สำคัญ · `review.html:816` — **หน้ารีวิว (standalone) เช็คความสำเร็จด้วย j.ok ที่ me-rpc ไม่เคยส่งกลับ → รีวิวที่บันทึกสำเร็จถูกแสดงเป็น "ส่งไม่สำเร็จ"**
- 🟠 สำคัญ · `requests.html:346` — **คอลัมน์ "คนขอ" hardcode เลข 1 ทุกแถว — สัญญาณดีมานด์/โหวตจากฝั่งลูกค้าเป็น dead-end**
- 🟠 สำคัญ · `wishlist.html:767` — **submit_garment_request เรียกผ่าน anon client + p_uid ที่ client ส่งเอง — ข้าม gateway ที่ ops บังคับใช้เพราะเป็น PII**
- 🟠 สำคัญ · `today.html:138` — **คิวรับซื้อมือสอง (acq) เป็น dead-end — ไม่มีปุ่ม/ลิงก์ให้ทำต่อ**
- 🟠 สำคัญ · `seller.html:225` — **ไม่มี seam จาก acquisition → intake_garment: ฟิลด์ชุดมือสอง (brand/category/size/color/fabric/condition/price) ตกหล่นทั้งหมด**
- 🟠 สำคัญ · `case-file.html:135` — **acquisition.status / offered_price / voucher_no ถูกอ่านแต่ไม่มีหน้าไหนเขียน — เสนอราคา/ออกใบรับซื้อทำในระบบไม่ได้**
- 🟠 สำคัญ · `disputes.html:83` — **party_type 'employee'/'supplier' เปิดให้เชื่อมได้ แต่ทั้ง 2 หน้าไม่มี branch สร้างแฟ้มหลักฐาน**
- 🟠 สำคัญ · `pay.html:186` — **pay.html/event.html ไม่โหลด data.js → journey จ่ายรายคน→ยอดรวมกลุ่ม กลายเป็น mock ที่ไม่ต่อ Supabase (มิติ seam ใหม่ของบั๊ก data.js)**
- 🟠 สำคัญ · `purchasing.html:252` — **datalist วัสดุ value=UUID ทำให้ createPo จับชื่อไม่เจอ → supply_id หลุด + description กลายเป็น UUID**
- 🟠 สำคัญ · `disputes.html:64` — **influencer_no_return เปิดคดีได้แต่ไม่มี party_type และไม่มี evidence panel**
- 🟠 สำคัญ · `disputes.html:256` — **employee/supplier เลือกเป็นคู่กรณีได้ แต่ evidence panel ตกลง JSON ดิบ**
- 🟠 สำคัญ · `today.html:115` — **Deep-link คิว 'ต้องส่งวันนี้' → shipout.html?code= ถูกทิ้ง ชุดไม่โหลดอัตโนมัติ**

---

## รอบที่ 1 — Journey ข้าม role (10 เส้น)

### จัดซื้อ — PO → ซัพพลายเออร์ → รับเข้าคลัง → บัญชี
*ยืนยัน 1 · หักล้าง 2*

#### 🟠 สำคัญ · [รอยต่อขาด] `purchasing.html:254` — รับของชุดให้เช่า (kind=asset) เป็น dead-end — ไม่สร้างชุดในคลัง ต้นทุนถูกกรอกซ้ำที่ intake ไม่ผูกกัน

purchasing.html:230 มี kind='asset' (ชุดให้เช่า/สินทรัพย์); purchasing.html:210-217 renderPo/receivePo เรียก 'po_receive' ผ่าน edge function 'acct' (purchasing.html:79) toast 'รับของแล้ว + ลงบัญชี'. แต่ทั้งไฟล์ purchasing.html ไม่มี action ใดสร้าง garment record. garment ถูกสร้างจาก intake.html:186 sb.rpc('intake_garment') เท่านั้น (คนละ backend = ops-rpc) โดยกรอก acquisition_cost ใหม่ด้วยมือที่ intake.html:175 และ payload intake ไม่มี field supply_id/po_id/po_no อ้างถึง PO เลย. cockpit.html:136 คำนวณ ROI = รายได้ ÷ ต้นทุนซื้อ โดยใช้ acquisition_cost ของ garment (จาก intake) ไม่ใช่ยอด PO.

**อาการ:** จัดซื้อกดสร้าง PO ชุดให้เช่า 5 ตัว @1,200 แล้วกด 'รับของ' → บัญชีลงต้นทุน 6,000 แต่คลังชุด (stock.html/putaway.html) ยังไม่มีชุด 5 ตัวนั้น. พนักงานต้องไปหน้า intake.html สร้างชุดทีละตัวและพิมพ์ 'ต้นทุนชุด' 1,200 ซ้ำอีกรอบ. ผลคือต้นทุนถูกบันทึกสองที่ที่ไม่ผูกกัน — ถ้ากรอก intake ไม่ตรง PO ROI ที่ cockpit เพี้ยน และถ้าลืมกรอก intake ชุดที่ซื้อมาไม่มีในระบบให้เช่าเลย

**แก้:** ให้ po_receive ที่ kind=asset สร้าง garment ตามจำนวน qty (หรือมีปุ่ม 'ส่งเข้า intake' ที่ส่ง unit_cost→acquisition_cost + po_id ไปเปิดฟอร์ม intake) เพื่อให้ต้นทุน PO กับต้นทุนชุดเป็นตัวเลขเดียวกันและชุดโผล่ในคลังอัตโนมัติ


### บัญชี — ค่าเช่า/สลิป → ledger → ใบกำกับ → cockpit/analytics/forecast
*ยืนยัน 3 · หักล้าง 0*

#### 🟠 สำคัญ · [ทางตัน] `slips.html:137` — กล่องสลิปไม่มีปุ่มยืนยัน/ปฏิเสธ — สลิป 'รอยืนยันมือ' ไปต่อขึ้นบัญชีไม่ได้

slips.html เรียก edge function 'acct' แค่ 2 action เท่านั้น: api('slips') (slips.html:128) และ api('slip_view') (slips.html:157) — grep ทั้งไฟล์ไม่มี action confirm/verify/settle/reject เลย. render() ที่ slips.html:137-150 วาดการ์ดสลิปโดยมีปุ่มเดียวคือ 'ดูรูปสลิป' (viewSlip → slip_view). แต่ RES map (slips.html:99-108) มีสถานะ not_configured→'รอยืนยันมือ' และ pending→'รอยืนยัน' พร้อมแท็บ 'รอยืนยันมือ' (slips.html:82) กับหัวหน้าเพจโฆษณาว่า 'ตรวจผ่าน/ไม่ผ่าน/รอยืนยันมือ' (slips.html:77). ปลายทางบัญชี accounting.html:156 เขียนว่า 'งบจะขึ้นเองเมื่อมีการเช่า/ชำระ' โดยคาดว่าสลิปที่ยืนยันแล้วจะโพสต์ ledger เอง.

**อาการ:** เจ้าของเปิด slips.html เจอสลิปสถานะ 'รอยืนยันมือ' (auto-verify ไม่ได้ตั้งค่า/bank API ไม่ตรง) → เปิดดูรูปได้ แต่ไม่มีปุ่มกดยืนยันหรือปฏิเสธในหน้านี้เลย → สลิปค้างสถานะ pending ตลอด ไม่มีทางเปลี่ยนเป็น confirmed → รายได้ค่าเช่าใบนั้นไม่ถูกรับรู้ขึ้น ledger → หายไปจาก overview/pnl ใน accounting.html

**แก้:** เพิ่มปุ่มยืนยัน/ปฏิเสธในการ์ดสลิป (slips.html render) ที่เรียก action ใหม่บน edge function 'acct' เช่น api('slip_confirm',{id}) / api('slip_reject',{id,reason}) แล้วให้ backend โพสต์ ledger + reload; ถ้าตั้งใจให้ยืนยันที่หน้าอื่นต้องมีลิงก์ไปหน้านั้นชัดเจน

#### 🟠 สำคัญ · [รอยต่อขาด] `accounting.html:196` — ปุ่ม 'พิมพ์' ใบกำกับภาษีชี้ tax-doc.html ที่ไม่มีไฟล์ในโปรเจกต์ (404 ทุกใบ)

renderInvoices ที่ accounting.html:196 สร้างลิงก์ <a href="tax-doc.html?type=invoice&id=${r.id}" target="_blank">พิมพ์</a> โดยส่ง type=invoice + id ของใบกำกับ. ตรวจ ls root ทั้งโปรเจกต์และ grep แล้ว: ไม่มีไฟล์ tax-doc.html อยู่จริง (มีแค่ใน accounting.html เองกับใน AUDIT.md) — ปลายทางที่ควรรับ id ไปเรนเดอร์/พิมพ์ใบกำกับไม่มีอยู่.

**อาการ:** เจ้าของออกใบกำกับผ่านแท็บ 'ทำรายการ' (doInvoice → issue_invoice) สำเร็จ → ไปแท็บ 'ใบกำกับภาษี' เห็นรายการ → กด 'พิมพ์' → เบราว์เซอร์เปิด tax-doc.html?type=invoice&id=... แล้วได้ 404 (GitHub Pages) → พิมพ์ใบกำกับ/ให้ลูกค้าไม่ได้เลยทุกใบ

**แก้:** สร้างไฟล์ tax-doc.html ที่อ่าน query type/id เรียก edge function 'acct' ดึงข้อมูลใบกำกับ (base/vat/total/number/customer) มาเรนเดอร์เป็นฟอร์มพิมพ์ หรือแก้ลิงก์ไปยังหน้าที่มีจริง

#### 🟡 ย่อย · [field ไม่ตรง] `analytics.html:341` — 'รายได้ 30 วัน' ในหน้า analytics มาจากตารางเมตริกที่กรอกมือ ไม่เชื่อมกับ ledger บัญชี — ตัวเลขรายได้ขัดกัน 4 หน้า

เงินก้อนเดียว (รายได้ค่าเช่า) ถูกแสดงเป็น 'รายได้' ใน 4 หน้าแต่คนละแหล่ง: (1) accounting.html:147 rev=sum(d.pnl,'revenue') จาก edge function 'acct' (ledger, accrual); (2) cockpit.html:91-92 c.today/month.income จาก sb.rpc('owner_cockpit') ระบุ 'เกณฑ์เงินสด · จาก ledger'; (3) forecast.html:353 a.revenue จาก rpc('forecast_actuals') ระบุ 'จากบัญชีจริง'; (4) analytics.html:341-342 revenue_30d จาก rpc('mkt_overview') ซึ่งรวมค่าที่ทีมกรอกมือในฟอร์มรายวัน (analytics.html:524 source:'manual' → metrics_upsert ที่ analytics.html:531) เป็นรายได้ที่ผูกกับโฆษณา ไม่ใช่ค่าเช่าใน ledger.

**อาการ:** เจ้าของดู accounting overview เห็นรายได้ค่าเช่าจริงจาก ledger, แล้วเปิด analytics เห็น 'รายได้ 30 วัน' เป็นตัวเลขที่ทีมการตลาดกรอกมือ (ad-attributed) ซึ่งไม่ตรงกัน → เข้าใจผิดว่าตัวเลขใดตัวหนึ่งผิด ทั้งที่มาคนละตารางโดยไม่มี label แยกชัด

**แก้:** ติดป้ายให้ชัดว่า analytics 'รายได้ 30 วัน' = รายได้ที่ระบุจากโฆษณา (ad-attributed) ไม่ใช่รายได้บัญชี หรือให้ mkt_overview ดึง revenue จริงจาก ledger เดียวกับ accounting/cockpit เพื่อให้ตัวเลขสอดคล้อง


### พนักงานนับสต๊อก — lifecycle ชุด intake→putaway→stock→garment
*ยืนยัน 3 · หักล้าง 0*

#### 🟠 สำคัญ · [field ไม่ตรง] `nfc.html:189` — nfc.html บังคับรหัสชุดเป็นตัวพิมพ์ใหญ่ (G1) สวนทางกับทั้งระบบที่ใช้ตัวพิมพ์เล็ก (g1) → ผูก tag/lookup ข้ามหน้าเพี้ยน

nfc.html:189 doPair ทำ `$('pairCode').value.trim().toUpperCase()` แล้วส่ง tag_register({p_code:'G1'}) (input ยัง autocapitalize=characters + CSS text-transform:uppercase บรรทัด 29,81). แต่รหัสชุดทั้งระบบเป็นตัวพิมพ์เล็ก: intake.html:188 รับ auto-code (placeholder g7) แล้ว intake.html:192 ส่ง put_away({p_code:data}) ด้วยรหัสเดิม (เล็ก), garment.html:81 บังคับ `.toLowerCase()` ก่อนเรียก garment_timeline, labels.html:87 พิมพ์ QR เป็น `lloop.app/g/`+g.code, scan.js:9 คืน code ตามที่อยู่ใน QR (ไม่แปลง case). g.html:134/154 ฝั่งลูกค้าถึงกับ uppercase สองข้างเทียบแบบ case-insensitive เพราะ case ของ code ไม่การันตี — ยืนยันว่า case สำคัญ.

**อาการ:** พนักงาน intake ชุดได้ auto-code 'g12' (พิมพ์เล็ก) เก็บใน DB → ไปหน้า nfc.html โหมด 'ผูก tag ใหม่' พิมพ์ g12 ช่องแปลงเป็น G12 แล้ว doPair เรียก tag_register(p_code='G12'); ถ้า RPC จับคู่รหัสแบบ case-sensitive จะได้ garment_not_found เด้ง toast 'ไม่พบรหัสชุด G12' ผูก tag ไม่ติดเลย ขณะที่ garment.html/put_away ส่ง 'g12' ตัวเล็กปกติ — สองประตูเข้าระบบ (intake NFC ที่ intake.html:196 ส่ง p_code ตัวเล็ก vs nfc.html ส่งตัวใหญ่) เขียน tag_register ด้วย case ต่างกัน

**แก้:** ให้ nfc.html:189 ใช้ `.toLowerCase()` (และตัด autocapitalize/text-transform:uppercase) ให้ตรงกับ canonical ตัวพิมพ์เล็กที่ garment.html/intake ใช้ หรือทำ normalize case กลางที่เดียวก่อนยิงทุก RPC ที่อ้างรหัสชุด

#### 🟡 ย่อย · [สถานะตกหล่น] `putaway.html:95` — status map ของ putaway ขาดค่า lost และ needs_review ที่ต้นทาง (intake/stock) ตั้งได้ → แสดงเป็นภาษาอังกฤษดิบตอนตามหา/ภาพรวม

putaway.html:95 ST={available,reserved,out,cleaning,repair,retired,returned} ไม่มี key 'lost' และ 'needs_review'. แต่ stock.html:65 ST_TH มี lost:'หาย', needs_review:'รอตรวจ' และ stock.html:71 ใส่ทั้งสองไว้ใน order ของ by_status (ยืนยันว่า garment.status เป็น lost/needs_review ได้จริง) และ intake.html:109/199 ตั้งชุดใหม่เป็น needs_review. putaway ใช้ `ST[data.status]||data.status` ที่ doLocate (บรรทัด 113), doBin (123), loadOverview (135) จึง fallback เป็นคำอังกฤษดิบ

**อาการ:** ชุดเพิ่ง intake (status/needs_review) ยังไม่เก็บช่อง → โผล่ในลิสต์ 'ยังไม่เก็บเข้าช่อง' ของ loadOverview (putaway.html:135) แสดง tag ว่า 'needs_review' แทนคำไทย; หรือกด 'ตามหาชุด' ชุดที่ถูกมาร์ก lost จะได้ tag 'lost' แทน 'หาย'

**แก้:** เพิ่ม lost:'หาย', needs_review:'รอตรวจ' ลงใน ST ที่ putaway.html:95 (และให้ตรงกับ stock.html:65)

#### 🟡 ย่อย · [สถานะตกหล่น] `stock.html:65` — status map ของ stock ขาดค่า returned ที่ putaway รู้จักในฐานะสถานะ lifecycle → สรุปสต๊อกโชว์ 'returned' ดิบ

stock.html:65 ST_TH ไม่มี key 'returned' ขณะที่ putaway.html:95 นิยาม returned:'รับคืนแล้ว' เป็นสถานะ lifecycle ที่ระบบใช้จริง. stock.html:71 order ก็ไม่มี returned; loadSummary บรรทัด 72-73 merge Object.keys(bs) แล้ว render ด้วย `ST_TH[k]||k` จึงโชว์คำดิบ 'returned'

**อาการ:** ถ้ามีชุด status='returned' (สถานะที่ putaway การันตีว่ามีในระบบ) stock_summary.by_status จะมี key returned → การ์ด 'สต๊อกตามสถานะ' (stock.html:73) แสดง label ว่า 'returned' เป็นภาษาอังกฤษแทนคำไทย ต่างจากทุกสถานะอื่นที่แปลไทยหมด

**แก้:** เพิ่ม returned:'รับคืนแล้ว' ใน ST_TH (stock.html:65) และใส่ใน order (บรรทัด 71) ให้ครบชุดสถานะเดียวกับ putaway


### ส่งของ — today → เตรียมส่ง → courier/tracking → ลูกค้าติดตาม
*ยืนยัน 2 · หักล้าง 0*

#### 🟠 สำคัญ · [รอยต่อขาด] `shipout.html:84` — shipout.html ไม่รับ ?code= ที่ today.html ส่งมา (ต้องพิมพ์โค้ดซ้ำเอง)

ต้นทาง today.html:115 สร้างลิงก์แถว 'ต้องส่งวันนี้' เป็น '/shipout.html?code='+encodeURIComponent(x.code) → ปลายทาง shipout.html: load() (บรรทัด 83-88) อ่านค่าจากช่อง input #code เท่านั้น ($('code').value.trim()) และทั้งไฟล์ไม่มี location.search / URLSearchParams / อ่าน pathname เลย (grep ยืนยัน 0 match). ตัว load() ถูกเรียกจากปุ่ม/Enter เท่านั้น ไม่มี auto-run จาก param.

**อาการ:** สตาฟกดแถวออเดอร์ 'g1' ในหน้า today.html ที่บอกว่าต้องส่งวันนี้ → เด้งมา shipout.html?code=g1 แต่หน้าเปิดมาช่องกรอกว่างเปล่า สติ๊กเกอร์ไม่ถูกสร้าง สตาฟต้องพิมพ์ 'g1' ซ้ำเองแล้วกดเตรียม ค่า code ที่ deep-link ส่งมาถูกทิ้งทั้งหมด

**แก้:** ใน shipout.html เพิ่มการอ่าน param ตอนโหลด เช่น const p=new URLSearchParams(location.search).get('code'); if(p){ $('code').value=p; load(); } (วางหลัง define load())

#### 🟠 สำคัญ · [ทางตัน] `app.js:3104` — หน้า 'ออเดอร์ของฉัน' โชว์ courier/tracking/eta ได้ แต่ไม่มีหน้าไหนบันทึกเลขพัสดุเลย (dead-end)

ปลายทางฝั่งลูกค้า app.js:3104-3108 อ่าน r.courier, r.tracking_no, r.eta จาก my_rentals (api.js:391-395) และมีตาราง COURIER_TRACK (app.js:2953) + trackUrl() เพื่อ deep-link ไปหน้า track ของขนส่ง โดยเงื่อนไขแสดงผลคือ (r.courier && r.tracking_no). แต่ต้นทางไม่มีที่เขียนค่า: grep 'tracking' ทั้ง repo ในไฟล์ .html = 0 match; p_courier ถูกส่งเฉพาะตอนจอง (api.js:570 quote, api.js:605 book_cart) ไม่ใช่ตอนส่งจริง; p_eta มีเฉพาะ repair.html:221 (ETA ช่างซ่อม คนละเรื่อง). หน้า 'เตรียมส่ง' (shipout.html) ที่ควรเป็นจุดบันทึกการส่ง เรียกแค่ shipout_info (อ่านอย่างเดียว บรรทัด 85) แล้วพิมพ์สติ๊กเกอร์ ไม่มี RPC เขียน tracking_no/eta/สถานะส่งกลับเลย

**อาการ:** สตาฟแพ็ก+ส่งชุด g1 ผ่าน shipout.html ได้เลขพัสดุ Flash มาในมือ แต่ไม่มีช่อง/ปุ่มให้กรอกเลขนี้ที่ไหนในระบบ → tracking_no ใน DB เป็น null ตลอด → เงื่อนไข (r.courier && r.tracking_no) ในการ์ดออเดอร์ลูกค้าเป็น false เสมอ → ลูกค้าเปิด 'ออเดอร์ของฉัน' ไม่เห็นชื่อขนส่ง เลขพัสดุ หรือ ETA และกดติดตามพัสดุไม่ได้เลย ทั้งที่โค้ดแสดงผล+ลิงก์ track พร้อมใช้

**แก้:** เพิ่ม UI+RPC ในหน้า shipout.html (หรือ today.html) ให้สตาฟกรอก courier/tracking_no/eta ต่อออเดอร์แล้วเขียนกลับผ่าน ops-rpc (เช่น action set_shipment) เพื่อให้ my_rentals คืนค่าที่ app.js:3104 ใช้งานได้จริง


### Partner/สไตลิสต์ — ลูกค้าจอง → พาร์ทเนอร์วัดตัว → owner เห็นคิว
*ยืนยัน 2 · หักล้าง 0*

#### 🟠 สำคัญ · [ทางตัน] `partner.html:684` — service_modes (สตูดิโอ/นอกสถานที่/ออนไลน์) ที่สมัครไว้ ไม่ถูกใช้ที่ใด และการจองฝั่งลูกค้า hardcode 'studio'

ต้นทาง: partner.html:684 partner_self_register ส่ง service_modes จาก checkbox rModes (partner.html:191-195 ค่า studio/onsite/online). ปลายทางไม่มีใครอ่านค่านี้: การ์ดสไตลิสต์ในหน้าลูกค้า app.js stylistCardHtml 2516-2531 แสดงแค่ specialties/headline/area — ไม่โชว์ service_modes และไม่ให้ลูกค้าเลือกโหมด · ตอนยืนยันจอง confirmStylistBooking app.js:2576 เรียก pcBookSlot(_stSlot, note, 'studio') โดย hardcode 'studio' ทุกครั้ง (api.js:165-167 ส่ง p_mode ตามนั้น) · owner stylist-bookings.html render() 149-156 ก็ไม่แสดง mode ของ appointment

**อาการ:** สไตลิสต์ที่เลือกให้บริการเฉพาะ 'ออนไลน์' หรือ 'นอกสถานที่' ตอนสมัคร — เมื่อลูกค้าจองผ่านแอป ระบบส่ง mode='studio' เสมอ ทำให้นัดถูกบันทึกเป็นที่สตูดิโอผิดจากที่สไตลิสต์เปิดรับ และค่า service_modes ที่กรอกไว้ไม่ปรากฏให้ลูกค้าหรือ owner เห็นเลย

**แก้:** ให้หน้าเลือกสไตลิสต์อ่าน service_modes มาแสดง/ให้ลูกค้าเลือกโหมด แล้วส่งค่าจริงเข้า pcBookSlot แทน 'studio' ที่ hardcode และแสดง mode ในคิวฝั่ง owner

#### 🟡 ย่อย · [ทางตัน] `partner.html:685` — IG/TikTok + พิกัด (place_name/lat/lng) ที่พาร์ทเนอร์กรอกตอนสมัคร ไม่มีหน้าไหนอ่านต่อ — owner มองไม่เห็น

ต้นทางเขียน: partner.html:683-685 partner_self_register ส่ง place_name/lat/lng (683) และ socials{ig,tiktok} (685). ปลายทางที่ควรอ่าน กลับไม่มีเลย: (1) โปรไฟล์พาร์ทเนอร์เอง loadProfile partner.html:734-742 อ่านแค่ display_name/studio_name/headline/bio/area/specialties/session_note/photo_url/is_public — ไม่มี ig/tiktok/พิกัด · saveProfile partner.html:763-772 ก็ไม่ส่งกลับ (พาร์ทเนอร์แก้ทีหลังไม่ได้ และถ้า backend overwrite ทั้ง row จะถูกล้างทิ้ง) · (2) directory/หน้าลูกค้า api.js:155-163 partner_directory/partner_public + stylistCardHtml app.js:2516-2531 ไม่แตะ ig/tiktok/พิกัด · (3) owner: stylist-bookings.html render() 150-155 แสดงแค่ partner/studio/customer/phone/code/notes และ ops-partner.html เป็นฟอร์มวิเคราะห์ลูกค้า (partner_lookup/get/save) ไม่ใช่ไดเรกทอรีพาร์ทเนอร์ (ops-menu.js:45-46 ยืนยันว่ามีแค่ 2 หน้านี้)

**อาการ:** สไตลิสต์สมัครเองผ่าน partner.html กรอก IG/TikTok และปักพิกัดสตูดิโอบนแผนที่ (lat/lng) กดยืนยัน — เจ้าของเปิด ops-partner.html และ stylist-bookings.html ก็ไม่เห็น IG/TikTok/พิกัดของสไตลิสต์คนนั้นที่ไหนเลย และตัวสไตลิสต์เองก็เปิดแท็บโปรไฟล์แล้วช่องพวกนี้ว่าง แก้ไขต่อไม่ได้

**แก้:** เพิ่ม socials/place_name/lat/lng เข้า schema ของ partner_profile_self/partner_profile_save เพื่อให้แก้ไข/แสดงได้ และเพิ่มการแสดง IG/TikTok/พิกัดในหน้า owner (เช่น stylist-bookings หรือหน้าไดเรกทอรีพาร์ทเนอร์ใหม่)


### ลูกค้า — วงจรเช่าเต็ม จอง→จ่าย→สัญญา→ติดตาม→รีวิว
*ยืนยัน 2 · หักล้าง 0*

#### 🟠 สำคัญ · [รอยต่อขาด] `review.html:816` — หน้ารีวิว (standalone) เช็คความสำเร็จด้วย j.ok ที่ me-rpc ไม่เคยส่งกลับ → รีวิวที่บันทึกสำเร็จถูกแสดงเป็น "ส่งไม่สำเร็จ"

ต้นทาง gateway me-rpc คืน contract แบบ {data, error} เท่านั้น ไม่มี field ok — ยืนยันได้จาก me-api.js:47,57 (`if(!r.ok||out.error)` แล้ว `return {data: out.data, error: null}`) และในไฟล์เดียวกัน review.html:757 ที่เรียก me_profile ก็อ่าน `data = j.data` ตรง ๆ (ไม่แตะ j.ok). แต่ปลายทาง review.html:815-816 กลับเช็ค `if (j.ok) data = j.data; else error = {message: j.message || j.error || 'ส่งรีวิวไม่สำเร็จ'}`. เมื่อ submit_review สำเร็จ gateway คืน {data:...} (ไม่มี ok) → j.ok = undefined → เข้า else เสมอ → ตั้ง error → บล็อก success ที่ review.html:822-825 โชว์ 'เกิดข้อผิดพลาด: ... ส่งรีวิวไม่สำเร็จ' ทั้งที่ค่าถูกบันทึกในระบบแล้ว

**อาการ:** ลูกค้าคืนชุดแล้วเปิด review.html จาก LINE flex กดดาว+แนบรูปแล้วกดส่ง → gateway บันทึกรีวิวสำเร็จและควรได้ +10 เครดิต แต่หน้าเด้ง error 'ส่งรีวิวไม่สำเร็จ' ทุกครั้ง (success screen/เครดิตที่ review.html:828-842 ไม่เคยรัน) ลูกค้าเข้าใจว่าล้มเหลว กดส่งซ้ำ → รีวิว/รูปซ้ำหลายรอบ และ seam impact/เครดิตปลายทางไม่สะท้อนผลให้ผู้ใช้เห็น

#### 🟡 ย่อย · [ตรรกะ] `review.html:623` — decode ซ้ำสองชั้นบน query param (garment_name/size/date_range) ทำให้สคริปต์ทั้งหน้าตายถ้าค่ามี '%'

review.html:620-625 ใช้ `params.get('garment_name')` ซึ่ง URLSearchParams ถอดรหัส URL ให้ครบหนึ่งชั้นแล้ว จากนั้นเอาผลไปเข้า `decodeURIComponent(...)` อีกชั้น (บรรทัด 623-625). ถ้าชื่อชุด/ไซส์/ช่วงวันที่มีอักขระ '%' (เช่น 'ลด 20%OFF') หลัง get ถอดมาเป็นสตริงที่มี '%' ตัวเดียวไม่ตามด้วยเลขฐาน 16 → decodeURIComponent โยน URIError ที่ระดับ top-level ของ <script> (บรรทัดนี้อยู่นอก try) → สคริปต์หยุดทำงานทั้งไฟล์ → submitBtn/handler ที่ review.html:772 ไม่ถูกผูก ปุ่มส่งรีวิวใช้ไม่ได้เลย

**อาการ:** flex/ลิงก์ที่พาลูกค้ามา review.html แนบชื่อชุดที่มีเครื่องหมาย '%' → เปิดหน้าปุ๊บ JS ตายทั้งหน้า ฟอร์มรีวิวกดอะไรไม่ได้ (ไม่ใช่แค่ชื่อผิด)


### คำขอชุด → จัดหา
*ยืนยัน 2 · หักล้าง 0*

#### 🟠 สำคัญ · [ทางตัน] `requests.html:346` — คอลัมน์ "คนขอ" hardcode เลข 1 ทุกแถว — สัญญาณดีมานด์/โหวตจากฝั่งลูกค้าเป็น dead-end

ต้นทาง: wishlist.html:844-890 ลูกค้าโหวตคำขอผ่าน meRpc('vote_request') และ trending_requests คืน r.votes (render ที่ wishlist.html:858-861). ปลายทาง ops: requests.html:284 เรียก wishlist_ops_list แล้ว renderTable() บรรทัด 346 ใส่ค่าคงที่ `<div class="demand-num">1</div>` โดยไม่อ่าน field ใด ๆ (ไม่มี r.votes/r.demand) และ loadData→applyFilters (requests.html:303-317) ไม่ sort ตามดีมานด์เลย ขณะที่หัวเพจ requests.html:172 อ้างว่า 'เรียงตามดีมานด์สูงสุด'

**อาการ:** ลูกค้า 15 คนโหวตอยากได้ชุด A (votes=15) อีกชุด B มีคนเดียว → พนักงาน marketing เปิด requests.html เห็นทุกแถวขึ้น '1 คน' เท่ากันหมด และลำดับไม่เรียงตามดีมานด์ → ตัดสินใจสั่งจัดหา/เติมสต๊อกผิดลำดับความสำคัญ ทั้งที่ระบบเก็บโหวตไว้จริงแต่ไม่ถูกนำมาใช้

**แก้:** ให้ wishlist_ops_list คืน demand/votes count ต่อคำขอ (หรือ group คำขอที่ซ้ำกัน) แล้ว render `r.votes ?? 1` พร้อม sort ฝั่ง client ตามดีมานด์ — หรือถ้ายังไม่มีข้อมูลจริง ให้ตัดคอลัมน์และแก้ข้อความหัวเพจที่อ้างว่าเรียงตามดีมานด์ออก

#### 🟠 สำคัญ · [สิทธิ์] `wishlist.html:767` — submit_garment_request เรียกผ่าน anon client + p_uid ที่ client ส่งเอง — ข้าม gateway ที่ ops บังคับใช้เพราะเป็น PII

ต้นทางเขียน: wishlist.html:620 สร้าง sb = anon client, บรรทัด 767 เรียก sb.rpc('submit_garment_request', {p_uid: uid, ...}) โดย uid = profile.userId (client ควบคุมได้) — ไม่ผ่าน window.meRpc. แต่ไฟล์เดียวกันใช้ meRpc (verify LINE idToken → derive uid ฝั่ง server) สำหรับ waitlist/vote ทุกจุด: บรรทัด 802 my_waitlist, 840 leave_waitlist, 848 trending_requests, 883 vote_request. และฝั่ง ops requests.html:283 ระบุชัดว่า garment_requests มี customer_uid = PII จึงย้ายมาใช้ gateway (wishlist_ops_list/update ผ่าน opsRpc)

**อาการ:** การ insert คำขอชุดเข้าตาราง garment_requests ทำผ่าน anon key โดยส่ง customer_uid มากับ payload ตรง ๆ → ใครก็ยิง RPC สร้างคำขอปลอมในนามลูกค้าคนอื่น (หรือ spam) ได้ เพราะ uid ไม่ได้มาจาก idToken ที่ verify แล้วเหมือน path อื่นในไฟล์นี้และเหมือนที่ ops ตั้งใจปิดช่องไว้

**แก้:** เปลี่ยน submit ให้เรียกผ่าน window.meRpc('submit_garment_request', {...}) โดยให้ me-api gateway ดึง customer_uid จาก LINE idToken ที่ verify แล้ว แทนการรับ p_uid จาก client — ให้สอดคล้องกับ vote/waitlist ในไฟล์เดียวกันและเจตนา PII ฝั่ง ops


### รับซื้อมือสอง → เข้าคลัง
*ยืนยัน 4 · หักล้าง 0*

#### 🟠 สำคัญ · [ทางตัน] `today.html:138` — คิวรับซื้อมือสอง (acq) เป็น dead-end — ไม่มีปุ่ม/ลิงก์ให้ทำต่อ

seller.html:237 ส่ง seller_submit สร้าง acquisition record. ปลายทางฝั่ง ops ที่โผล่ผลคือ today.html:134-138 section 'รับซื้อรอจัดการ' ซึ่ง render ด้วย rowLink(null, name, seller, tag) — arg แรก href=null และไม่มีปุ่มใด ๆ (ต่างจาก review section today.html:126-133 ที่มีปุ่ม approveGarment และ shipout ที่มี href). x.id มีอยู่ (today.html:138 ใช้เป็น fallback 'คำขอ #'+x.id) แต่ไม่ถูกทำเป็นลิงก์ไป case-file/garment. ทั้ง ops-menu.js:10-50 ก็ไม่มีหน้า 'จัดการรับซื้อ/ประเมินราคา' แยก

**อาการ:** ผู้ขายกรอกที่ seller.html แล้วกดส่ง → คำขอโผล่ที่ today.html หมวด 'รับซื้อรอจัดการ' แต่สตาฟกดอะไรไม่ได้เลย เปิดดูรูป/ราคา/สภาพ/เลขบัตรที่ผู้ขายส่งมาก็ไม่ได้ รับซื้อ/ปฏิเสธก็ไม่ได้ในระบบ — คิวค้างเป็นแค่ตัวเลขโชว์

**แก้:** ทำ acq row ให้ลิงก์ไป case-file.html?ref=<acquisition_id> (มี renderSeller อยู่แล้ว) และเพิ่มปุ่ม accept/ปฏิเสธ/แปลงเป็นชุด

#### 🟠 สำคัญ · [รอยต่อขาด] `seller.html:225` — ไม่มี seam จาก acquisition → intake_garment: ฟิลด์ชุดมือสอง (brand/category/size/color/fabric/condition/price) ตกหล่นทั้งหมด

ต้นทาง seller.html:225-227 ส่ง payload พร้อม name, brand, category, size, color_name, fabric, condition, defects, asking_price, occasion_tags, photos เข้า seller_submit (seller.html:237). ปลายทางที่ทำให้ชุดเข้าคลังจริงคือ intake.html:171-186 sb.rpc('intake_garment', payload) ซึ่งเป็นฟอร์มกรอกมือล้วน ไม่มีพารามิเตอร์รับ acquisition_id/prefill และไม่มี RPC ใดอ่าน acquisition มาสร้าง garment (grep ทั้ง repo: intake_garment ถูกเรียกเฉพาะ intake.html:186 และ csv.html:92 เท่านั้น). ผลคือชุดที่ 'รับซื้อ' แล้วจะไม่กลายเป็น garment เว้นแต่พนักงานพิมพ์ใหม่ทั้งหมดด้วยมือ — ระหว่างทางไม่มีที่รับข้อมูลชุดจาก seller เลย

**อาการ:** รับซื้อเดรส 1 ตัวจากผู้ขาย (บันทึก brand/size/condition/สภาพ/ราคาครบใน acquisition) → จะให้เป็นชุดปล่อยเช่าต้องเปิด intake.html พิมพ์ทุกช่องใหม่เอง ถ้าไม่พิมพ์ ชุดหายไปไม่เข้า stock/garment เลย (broken-seam ตามโจทย์ 'รับซื้อแล้วชุดหายไปไม่เข้าคลัง')

**แก้:** เพิ่ม RPC/พารามิเตอร์ให้ intake.html รับ acquisition_id แล้ว prefill ฟอร์มจาก acquisition (name/brand/category/size/color_name/fabric/condition/asking_price→cost)

#### 🟠 สำคัญ · [ทางตัน] `case-file.html:135` — acquisition.status / offered_price / voucher_no ถูกอ่านแต่ไม่มีหน้าไหนเขียน — เสนอราคา/ออกใบรับซื้อทำในระบบไม่ได้

ฟิลด์ status, offered_price, voucher_no ของ acquisition ถูก render อ่านที่ case-file.html:135-136 และ disputes.html:254 (a.voucher_no, a.offered_price, a.status). แต่ grep ทั้ง repo ไม่พบหน้าใดตั้งค่า offered_price, ออก voucher_no, หรือ transition status ของ acquisition เลย (ไม่มี RPC seller_decide/acquisition_* ฝั่ง client). seller.html:81 เก็บเลขบัตร 'สำหรับใบรับซื้อ/ภาษี' และ seller.html:82 เก็บที่อยู่ พร้อม consent PDPA — แต่ขั้นตอนออกใบรับซื้อ (voucher) + เสนอราคาที่ต่อยอดจากข้อมูลนี้ไม่มี UI รองรับ

**อาการ:** ทีมอยากเสนอราคาซื้อ (offered_price) หรือออกใบรับซื้อ (voucher_no) ให้ผู้ขายหลังตกลง → ทำในระบบไม่ได้ ค่าเหล่านี้จะว่างตลอด ทำให้แฟ้มหลักฐาน (case-file/disputes) แสดง voucher/สถานะไม่ครบ และ KYC ที่เก็บมาไม่ถูกใช้ต่อ

**แก้:** เพิ่มหน้า/ปุ่มฝั่ง ops สำหรับ set offered_price + accept + ออก voucher_no (อัปเดต status) บน acquisition

#### 🟡 ย่อย · [field ไม่ตรง] `seller.html:101` — ค่า condition/size ของ seller เป็นคนละ vocabulary กับ intake และ garment timeline

seller.html:101 <select id=gcond> options ไม่มี attribute value จึง .value = ข้อความไทย 'ใหม่ป้ายห้อย'/'ดีมาก'/'ดี'/'พอใช้' และ seller.html:99 size เป็น input ข้อความอิสระ. ปลายทางที่ใช้จริง intake.html:90 f_condition เป็น enum new/good/fair/poor และ intake.html:89 f_size เป็น enum XS..FREE. ยังต่างกับ garment.html:77 COND (good/stain/damage/missing) ที่ใช้แสดง timeline. เพราะไม่มี seam อัตโนมัติ (finding 2) ค่านี้จึงไม่ถูกส่งข้ามหน้าอยู่แล้ว แต่ถ้าเพิ่ม bridge ตามข้อ 2 โดยแมป field ตรง ๆ ค่า condition/size จะเข้า enum ไม่ได้ทันที

**อาการ:** ถ้าทำ prefill acquisition→intake แบบ map ชื่อ field ตรง ๆ: condition='ดีมาก' จะไม่แมตช์ option ใน f_condition (new/good/fair/poor) → dropdown ตกไปค่า default 'new' และ size ข้อความอิสระอาจไม่ตรง enum → ข้อมูลสภาพ/ไซส์เพี้ยน

**แก้:** กำหนด value enum ให้ตรงกันทั้งสามหน้า หรือใส่ mapping ตอนแปลง acquisition→garment


### ข้อพิพาท → แฟ้มหลักฐาน (ภาพรวม)
*ยืนยัน 2 · หักล้าง 0*

#### 🟠 สำคัญ · [สถานะตกหล่น] `disputes.html:83` — party_type 'employee'/'supplier' เปิดให้เชื่อมได้ แต่ทั้ง 2 หน้าไม่มี branch สร้างแฟ้มหลักฐาน

ต้นทาง disputes.html:83-84 ให้เลือกผูกคู่กรณีเป็น party_type='employee' และ 'supplier' (คู่กับ dispute_type employee_fraud/labor_dispute/supplier_breach ที่ f_type บรรทัด 68-70). ปลายทางฝั่ง render หลักฐานใน disputes.html renderEvidence() มี branch เฉพาะ ev.type==='customer' (บรรทัด 239), 'contract' (247), 'seller' (252) เท่านั้น — ที่เหลือตก fallback ทิ้งเป็น JSON ดิบ (บรรทัด 256). ส่วน case-file.html ตัวเลือก subject มีแค่ customer/contract/seller (บรรทัด 39) เลือก employee/supplier ไม่ได้เลย. ที่สำคัญคือข้อมูลสัญญาพนักงานถูกลงนาม+เก็บจริง (staff.html:301-303 emp_contract_sign ส่ง signer_id_card/body_snapshot) แต่ไม่มีหน้าไหนในระบบเคส/แฟ้มคดีอ่านมันได้

**อาการ:** เปิดคดี 'พนักงานทุจริต' (employee_fraud) แล้วเลือกเชื่อม party_type='employee' วาง employee id → ระบบโฆษณาว่า 'ผูกหลักฐานอัตโนมัติ' (disputes.html:50) แต่ renderEvidence ไม่มี branch employee จึงได้แค่ JSON ดิบ (บรรทัด 256) ไม่มีสัญญาพนักงาน/ลายเซ็น/บัตร มาเป็นหลักฐาน และเปิดใน case-file.html ก็เลือกประเภทพนักงานไม่ได้ → แฟ้มคดีพนักงาน/ซัพพลายเออร์เป็น dead-end

**แก้:** เพิ่ม branch ev.type==='employee'/'supplier' ใน renderEvidence (disputes.html) และเพิ่มตัวเลือกใน <select id='stype'> ของ case-file.html:39 ให้ backend case_file/dispute_get รองรับ subject_type เดียวกัน (ดึง emp_contract esign_audit เหมือน contract)

#### 🟡 ย่อย · [รอยต่อขาด] `disputes.html:162` — เปิดคดีไม่ผูก rental_id → แฟ้มหลักฐานเป็นข้อมูลทั้งตัวลูกค้า ไม่เจาะจงรายการเช่าที่พิพาท

ต้นทาง openCase() payload (disputes.html:162-165) ส่งเฉพาะ party_type/party_ref (id ลูกค้า/สัญญา) + title/description ไม่มี field rental_id เลย. ปลายทาง evidence ที่รวบรวมมา group ตาม rental_id ได้ (disputes.html:229 และ case-file.html:77) แต่เพราะเคสผูกที่ 'ตัวลูกค้า' ไม่ใช่ 'การเช่าใบเดียว' หลักฐาน rentals/qc_photos/payments จึงเป็นทั้งประวัติของลูกค้า ส่วนรายการเช่าที่พิพาทจริง (เช่น #D012) อยู่แค่ในข้อความอิสระ f_desc

**อาการ:** ลูกค้าเช่าหลายครั้ง เปิดคดี customer_no_return เรื่องชุด #D012 → แฟ้มหลักฐาน/qcPhotos แสดงการเช่าและรูปทุกใบของลูกค้าคนนั้น ไม่มีทางระบุด้วย id ว่าใบไหนคือใบที่ไม่คืน (บันทึกอ้างได้แค่ข้อความ)

**แก้:** เพิ่ม field rental_id ในฟอร์มเปิดคดีและใน payload dispute_open เพื่อผูกเคสกับรายการเช่าที่พิพาทโดยตรง แล้วให้ evidence ไฮไลต์ใบนั้น


### กลุ่ม/อีเวนต์ — เงินรายคน → ยอดรวม
*ยืนยัน 1 · หักล้าง 0*

#### 🟠 สำคัญ · [รอยต่อขาด] `pay.html:186` — pay.html/event.html ไม่โหลด data.js → journey จ่ายรายคน→ยอดรวมกลุ่ม กลายเป็น mock ที่ไม่ต่อ Supabase (มิติ seam ใหม่ของบั๊ก data.js)

pay.html โหลดสคริปต์ที่ pay.html:117-125 และ event.html:155-161 ไม่มี data.js (ต่างจาก family.html:271 ที่โหลด). CONFIG.USE_MOCK=false (config.js:3) ทั้งสองหน้าจึงเข้า path LIVE แล้วเรียก window.API.init() (pay.html:188, event.html:229). ใน api.js:69 init ทำ `let customer = window.MOCK.CUSTOMER;` แต่ window.MOCK ถูกนิยามใน data.js เท่านั้น → undefined.CUSTOMER โยน TypeError → ตกเข้า catch → LIVE คงเป็น false ตลอด

**อาการ:** ลูกค้าจริงเปิดลิงก์บิลใน LINE (pay.html?order=OG-REAL): เพราะ LIVE=false groupOrderSummary ไม่ถูกเรียก หน้าโชว์ MOCK_SUMMARY เสมอ (pay.html:218 → 'คุณยายสมร' ฿780) ไม่ตรงกับ order จริง; กด 'ฉันโอนแล้ว' เข้า branch mock ok=true (pay.html:319) โดย groupPayConfirm ไม่เคยถูกเรียก แล้วขึ้นจอ 'จ่ายแล้ว' (renderPaid) = false success. ฝั่งเจ้าภาพเปิด event.html?event=EVT-REAL ก็เข้า mock (event.html:262) โชว์ MOCK_STATUS (2/3 จ่าย ฿1151) เสมอ ไม่ว่า event จริงคืออะไร → 'เงินรายคนสะท้อนยอดรวม' พังทั้งเส้น: การจ่ายไม่ถูกบันทึก และ dashboard เจ้าภาพแสดงตัวเลขปลอม

**แก้:** เพิ่ม <script src="data.js?v=..."> ใน pay.html และ event.html (ก่อน api.js) เหมือน family.html:271 หรือทำให้ api.js init ไม่พึ่ง window.MOCK เมื่อ USE_MOCK=false


## รอบที่ 2 — เจาะลึกตามที่ระบุ (ซื้อของใหม่ · พิพาท 14 กรณี · แพคจอง→ส่ง)

### ซื้อของใหม่/เติมชุด (เจาะลึก) — restock/buy → PO → รับเข้าเป็นชุดเช่า
*ยืนยัน 5 · หักล้าง 0*

**ความครบของการสะท้อน:** buy status (source: BST idea/approved/ordered/received/intaked/dropped): แสดงครบทุกค่าใน BST; buyRow next-action ครอบ idea/approved/ordered/received; intaked+dropped เป็น terminal ไปกอง done — ครบ. | buy source (shopee/lazada/ig/customer/manual): SRC ครบ + fallback ค่าอื่นเป็น raw — ครบ. | PO kind (supply/asset/inventory): create options(line230)=3, renderPo label(line210)=3 — ครบด้านแสดงผล แต่ asset ไม่มีปลายทางสร้าง garment (broken-seam). | PO status (draft/ordered/received): label map ครบ 3, pill CSS ขาด draft; ไม่มีสถานะ 'paid' แสดง (หายจาก unpaid หลังจ่าย). | garment status (available/reserved/out/cleaning/repair/retired/lost/needs_review/returned): สะท้อนไม่ครบ/ไม่ตรงข้ามหน้า — stock.html มี 8 ค่า, putaway.html ขาด needs_review+lost และ label 'out' ต่างกัน, garment.html ไม่ map เลย. | intake condition (new/good/fair/poor) & season (spring/summer/autumn/winter): purchasing ST มี neutral เพิ่ม ครอบคลุมเผื่อ backend forecast คืน neutral — ครบ. | restock wishlist: มาจาก toggle_wishlist/my_wishlist (garment-level, api.js:400/406) เป็น wishlist ของชุดที่มีอยู่จริง สอดคล้องกับ \"wishlist แต่ไม่ว่าง\" — สะท้อนตรง. | AP: purchasing po_unpaid(supplier,total) vs accounting ap(vendor_name,amount,description) เป็นคนละ action คนละ field shape — แต่ละหน้าใช้ของตัวเอง (ไม่ยืนยัน backend ว่าตารางเดียวกันได้).

#### 🔴 วิกฤต · [รอยต่อขาด] `purchasing.html:216` — PO ประเภท asset (ชุดให้เช่า) รับของแล้วไม่แปลงเป็น garment — เส้นทางขาด

create tab เปิดให้เลือก kind='asset' "ชุดให้เช่า (สินทรัพย์)" (purchasing.html:230) แล้ว po_create ส่งไป (line 254). เมื่อของมา staff กด "รับของ" → receivePo/po_receive (line 212-216) ซึ่ง toast บอกแค่ "รับของแล้ว + ลงบัญชี" — เป็น accounting ล้วน ไม่มี branch สร้าง garment. ตลอดทั้ง repo garment ถูกสร้างจาก intake_garment เท่านั้น (intake.html:186, csv.html:92) ซึ่ง purchasing.html/po_receive ไม่เคยเรียก. ผลคือ PO สั่งชุดใหม่ "จบที่ตัวเอง" ไม่ต่อเข้าคลังชุดให้เช่า.

**อาการ:** เจ้าของสั่งเดรสใหม่ 10 ตัวผ่าน create PO (kind=asset) → กดรับของ → ระบบลงบัญชีค่าซื้อ แต่ไม่มีชุดโผล่ในสต๊อก/garment/stock.html เลย. ต้องไปกรอกที่ intake.html ใหม่ทีละตัวเองทั้งหมด ระบบไม่เชื่อมให้.

**แก้:** ให้ po_receive (เมื่อ kind=asset) วน items เรียก intake_garment สร้างชุดพร้อม acquisition_cost=unit_cost เป็น draft/needs_review หรือเพิ่มปุ่ม "แปลงเป็นชุดให้เช่า" ที่ po ที่รับแล้ว ลิงก์ไป intake พร้อม prefill.

#### 🔴 วิกฤต · [ทางตัน] `purchasing.html:199` — buy flow ช้อปเพิ่ม: ขั้น "ส่งเข้าคลัง" ให้พิมพ์รหัสชุดที่ต้องมีอยู่แล้ว ไม่สร้างชุดจริง

ในแท็บ "ช้อปเพิ่ม" การ์ดที่สถานะ received มี next=__intake (line 162). กดแล้ว buyNext (line 199) แค่ prompt ขอ "รหัสชุดที่ขึ้นคลังแล้ว" แล้วเรียก buy_status status:intaked โดยส่ง garment:code เฉย ๆ — ไม่มีการเรียก intake_garment/ไม่สร้างชุด/ไม่ validate ว่ารหัสมีจริง. ดังนั้น pipeline wishlist/Shopee→อยากซื้อ→PO→รับ→เข้าคลัง ปลายทางตัน: ต้องไปสร้างชุดที่ intake.html แยกก่อน แล้วย้อนมาพิมพ์รหัสปิดการ์ด. สอดคล้องกับ finding asset-PO — ทั้งสองเส้นซื้อของใหม่ไม่มี seam อัตโนมัติเข้า garment.

**อาการ:** staff วางลิงก์ Shopee → ดึงเป็น idea → อนุมัติ → สั่งซื้อ (buy_to_po) → ของถึงกด received → กด "ส่งเข้าคลัง" ระบบถามรหัสชุด. staff ยังไม่ได้สร้างชุด เลยกรอกมั่ว/เว้นว่าง (code=''); ระบบปิดการ์ดเป็น intaked ทันทีทั้งที่ไม่มีชุดในคลังจริง.

**แก้:** ให้ __intake เปิด intake.html (prefill title/price/image/cost จาก buy item) เพื่อสร้าง garment จริง แล้วรับ code ที่ได้กลับมา set intaked; หรือให้ buy_status สร้าง garment ให้เองเมื่อยังไม่มี code.

#### 🟠 สำคัญ · [ตรรกะ] `purchasing.html:252` — datalist วัสดุ value=UUID ทำให้ createPo จับชื่อไม่เจอ → supply_id หลุด + description กลายเป็น UUID

drawItems สร้าง datalist option ด้วย value=s.id (UUID) แต่ label เป็นชื่อ (line 239) และ input ผูก oninput="ITEMS[i].description=this.value" (line 241). พฤติกรรม <datalist>: เมื่อผู้ใช้เลือก suggestion ค่า value(=UUID)จะถูกใส่ลง input → ITEMS[i].description กลายเป็น UUID. createPo (line 251-252) จับด้วย SUPPLIES.find(s=>s.name===it.description) ซึ่ง name ไม่มีทางเท่ากับ UUID → m=null → supply_id ตกเป็น null และ description ที่ส่งไป backend = UUID ดิบ. เฉพาะแถวแรกที่มาจาก quickPo/seed (line 226 มี supply_id ติดมา) เท่านั้นที่รอด. ทุกแถววัสดุที่ผู้ใช้เพิ่มเองแล้วเลือกจาก datalist จะเสีย.

**อาการ:** staff เปิด create PO เลือกซัพพลายเออร์ พิมพ์ในช่องรายการแล้วคลิกเลือก "ถุงผ้า LLOOP" จาก dropdown → ช่องกลายเป็น 'a1b2-...uuid'. กดสร้าง PO → บรรทัดนั้น supply_id=null, description=UUID. ตอน po_receive backend ไม่รู้ว่าเป็นวัสดุตัวไหน → qty_on_hand ของ 'ถุงผ้า' ไม่ถูกเติม และใบ PO โชว์ UUID แทนชื่อ.

**แก้:** เปลี่ยน option เป็น value=s.name (ให้ autocomplete ใส่ชื่อ → match ได้) หรือเก็บ mapping ชื่อ→id ตอน onchange แล้ว set ITEMS[i].supply_id เอง.

#### 🟡 ย่อย · [สถานะตกหล่น] `putaway.html:95` — map สถานะชุดไม่ครบ/ไม่ตรงกันข้ามหน้า ops (needs_review, lost, out)

intake สร้างชุดสถานะ needs_review หรือ ready (intake.html:199) และ intake ก็สั่ง put_away ให้ชุด needs_review ได้ทันที (intake.html:192). แต่ putaway.html ST (line 95) = available/reserved/out/cleaning/repair/retired/returned — ไม่มี needs_review และไม่มี lost → ชุดที่เพิ่งรับเข้าจะโชว์ raw 'needs_review' ใน overview/locate/bin. อีกทั้ง label 'out' หน้า putaway='อยู่กับลูกค้า' แต่ stock.html:65 ST_TH 'out'='ออกไป' และมี lost/needs_review; garment.html:106 โชว์ g.status ดิบไม่มี map เลย. คำ vocab เดียวกันสะท้อนไม่ตรงกันหลายหน้า.

**อาการ:** รับเดรสใหม่แบบไม่ติ๊ก publish (needs_review) พร้อมระบุช่อง A-03 → เปิด putaway ดู bin A-03 เห็นชุดขึ้น tag ว่า 'needs_review' (ภาษาอังกฤษดิบ) แทนคำไทย.

**แก้:** รวม map สถานะเป็นชุดเดียว (เช่นใน ops-ui/ops-api) แล้วให้ทุกหน้า import; เติม needs_review/lost/out ให้ครบและตรงกัน.

#### 🟡 ย่อย · [สถานะตกหล่น] `purchasing.html:210` — pill สถานะ PO 'draft' ไม่มีคลาส CSS รองรับ

renderPo (line 210) ใช้ class="pill ${p.status}" และ label map มี draft='ร่าง'. แต่ CSS (line 29-30) กำหนดสีเฉพาะ .pill.ordered/.pill.received/.pill.low เท่านั้น — ไม่มี .pill.draft. PO สถานะ draft จึงแสดง pill ไม่มีสี (เป็นกรอบ default) ขณะที่ ordered/received มีสี. เป็น cosmetic reflection gap.

**อาการ:** มี PO ที่ backend คืน status='draft' → ตารางใบสั่งซื้อโชว์ป้าย 'ร่าง' สีจืดผิดจากดีไซน์ที่ ordered/received มีสี.

**แก้:** เพิ่ม .pill.draft ใน CSS หรือ map draft ไปใช้คลาสกลาง.


### พิพาท 14 กรณี (เจาะลึก) — ประเภท × สถานะ × evidence panel
*ยืนยัน 8 · หักล้าง 0*

**ความครบของการสะท้อน:** (A) dispute_type 14 ค่า vs TYPES map (disputes.html:150): customer_no_return/customer_damage/customer_unpaid/customer_fraud/customer_claim/influencer_no_return/partner_breach/partner_solicit/seller_fake/employee_fraud/labor_dispute/supplier_breach/ip_violation/other — ครบ 14/14 ทั้งใน <option> (disputes.html:59-72) และ TYPES map. ไม่มีตกหล่นในระดับ label.
party_type ที่เลือกได้ (disputes.html:78-86): customer / contract(=partner) / seller / employee / supplier / other = 6 ค่า. คู่กรณีที่ dispute_type บ่งชี้ = customer, influencer, partner, seller, employee, supplier. ตกหล่น: influencer ไม่มี party_type ให้เลือก (influencer_no_return จึงเชื่อมได้แค่ "อื่นๆ"). case-file.html stype (line 39) มีแค่ customer/contract/seller = ขาด employee/supplier/influencer.

(B) STATUS 7 ค่า (open/notice_sent/negotiating/police/court/settled/closed): STATUS map disputes.html:151 ครบ 7/7; filter dropdown (line 111-120) ครบ 7/7; u_status build จาก STATUS (line 215) ครบ 7/7. ev_kind 6 ค่า (note/reply/demand_sent/police/court/settled) disputes.html:208 ครบ 6/6. badge.red: list ใช้ red เฉพาะ police/court ถูก (line 180) แต่ detail view (line 198) ไม่เคยใส่ red เลย → คดี police/court ใน detail ไม่ถูกไฮไลต์.

(C) evidence panel ev.type รองรับ: customer(line 239), contract(line 247), seller(line 252), else→JSON ดิบ(line 256). เทียบกับ party_type ที่เปิดคดีได้: customer✓ contract✓ seller✓ employee✗ supplier✗ influencer✗ other(catch-all). → 3 คู่กรณี (employee/supplier/influencer) เปิดคดีได้แต่ไม่มี evidence view แบบมีโครงสร้าง (dead-end → JSON dump). case-file.html รองรับแค่ 3 ชนิดเดียวกัน ยิ่งขาด employee/supplier/influencer.

(D) รูป/หลักฐาน: imgs() (disputes.html:226 / case-file.html:85) จัดการลิงก์หมดอายุด้วย f.url==null → แสดง "(ลิงก์หมดอายุ)". qcPhotos จัดกลุ่มเฉพาะ phase==='before'/'after' (disputes.html:233 / case-file.html:79) — phase อื่น/null ถูกทิ้งเงียบ (qc-photo.js:2 ส่งแค่ before/after จึงเสี่ยงต่ำ). bucket ของหลักฐานอยู่ฝั่ง edge fn 'acct' (ไม่อยู่ใน repo) เทียบ hr-docs ไม่ได้จากโค้ด client; ฝั่งลูกค้า KYC ใช้ bucket 'uploads' (api.js:481 getPublicUrl = public).

(E) การผูกคดี: party_ref เป็น uuid พิมพ์มืออิสระ (disputes.html:87) / sref (case-file.html:40) ไม่มี validation และไม่ผูก rental_id/contract_id ที่เจาะจง — evidence ดึงประวัติทั้งหมดของ subject ไม่ใช่รายการเช่าที่พิพาทจริง.

(F) auth: disputes.html + case-file.html ยิง FN='.../functions/v1/acct' ตรง (disputes.html:145,155 / case-file.html:47,54) ด้วย raw idToken ไม่ผ่าน ops-rpc gateway (ไม่มี fn allowlist). role/owner gate อยู่ server-side ทั้งหมด (edge fn ไม่อยู่ใน repo ตรวจไม่ได้); client ปล่อยให้ staff ที่ผ่าน gate วาง uuid ใดก็ได้เพื่อดึง PII เต็ม (เลขบัตร/ที่อยู่/รูป KYC) โดยไม่มี scoping สาขา/เจ้าของฝั่ง client.

#### 🟠 สำคัญ · [รอยต่อขาด] `disputes.html:64` — influencer_no_return เปิดคดีได้แต่ไม่มี party_type และไม่มี evidence panel

dispute_type 'influencer_no_return' มีใน <option> (disputes.html:64) และ TYPES map (disputes.html:150) แต่ dropdown party_type (disputes.html:78-86) ไม่มีตัวเลือก 'influencer' เลย — เชื่อมคู่กรณีได้แค่ 'อื่นๆ'. ซ้ำร้าย renderEvidence (disputes.html:239-256) ไม่มี branch ev.type==='influencer' → ตกไปที่ JSON dump (line 256) และ case-file.html stype (line 39) ก็ไม่มี influencer. อินฟลูจึงเป็น dead-end ทั้งการเชื่อมและการดูหลักฐาน.

**อาการ:** แอดมินเปิดคดี 'อินฟลูไม่คืนชุดยืม' เลือกชนิดได้ แต่ช่อง 'เชื่อมโยงคู่กรณี' ไม่มี 'อินฟลูเอนเซอร์' ให้เลือก จึงเลือก 'อื่นๆ' หรือไม่เชื่อม; พอเปิด detail แฟ้มหลักฐานโชว์ JSON ดิบแทนตาราง KYC/การยืม/รูปชุด → ออกหนังสือทวงถาม/แจ้งความอินฟลูไม่มีหลักฐานประกอบ.

**แก้:** เพิ่ม <option value="influencer"> ใน f_ptype, เพิ่ม stype ใน case-file.html, และเพิ่ม branch ev.type==='influencer' ใน renderEvidence (รวมทั้งฝั่ง server action ให้คืน evidence ชนิด influencer).

#### 🟠 สำคัญ · [ทางตัน] `disputes.html:256` — employee/supplier เลือกเป็นคู่กรณีได้ แต่ evidence panel ตกลง JSON ดิบ

party_type dropdown ให้เลือก employee (disputes.html:83) และ supplier (disputes.html:84) และมี dispute_type employee_fraud/labor_dispute/supplier_breach (disputes.html:68-70) แต่ renderEvidence รองรับแค่ customer/contract/seller (disputes.html:239-252); ev.type employee/supplier ตกไปที่ JSON.stringify ดิบ (line 256). case-file.html stype (line 39) มีแค่ customer/contract/seller จึงสร้างเอกสารแฟ้มหลักฐานให้ employee/supplier ไม่ได้เลย.

**อาการ:** เปิดคดี 'พนักงานทุจริต' เชื่อม party_type=employee วาง uuid พนักงาน → detail แสดงแฟ้มหลักฐานเป็นก้อน JSON อ่านไม่รู้เรื่อง ไม่มีตารางสัญญาจ้าง/หลักฐานทุจริต และไปหน้า case-file.html เพื่อพิมพ์เอกสารก็ไม่มีประเภท 'พนักงาน'/'ซัพพลายเออร์' ให้เลือก → ปิด seam ไม่ครบ.

**แก้:** เพิ่ม branch ev.type==='employee' และ ev.type==='supplier' ใน renderEvidence + เพิ่ม stype ใน case-file.html และ subject_type ฝั่ง server.

#### 🟡 ย่อย · [สถานะตกหล่น] `disputes.html:263` — ปุ่ม 'บันทึก: ส่งหนังสือแล้ว' ลง event อย่างเดียว ไม่เลื่อนสถานะเป็น notice_sent

markDemandSent (disputes.html:263-266) ยิง dispute_event kind='demand_sent' เท่านั้น ไม่ได้เรียก dispute_update ให้ status→'notice_sent'. label ปุ่ม (line 203) สื่อว่าเปลี่ยนสถานะ. หากฝั่ง server ไม่ auto-transition สถานะจะค้างที่ 'open' ทั้งที่ส่งหนังสือแล้ว.

**อาการ:** แอดมินกด 'บันทึก: ส่งหนังสือแล้ว' แล้วดูทะเบียนคดี — badge ยังเป็น 'เปิด' ไม่ใช่ 'ส่งหนังสือแล้ว' ทำให้กรองสถานะ notice_sent ไม่เจอคดีที่ส่งหนังสือไปแล้วจริง.

**แก้:** ให้ markDemandSent เรียก dispute_update ตั้ง status='notice_sent' ควบคู่ หรือให้ server auto-transition เมื่อรับ event demand_sent.

#### 🟡 ย่อย · [field ไม่ตรง] `disputes.html:198` — badge สถานะใน detail view ไม่เคยเป็นสีแดง แม้เป็น police/court

ในทะเบียนคดี badge ใส่ class red เมื่อ status เป็น police/court (disputes.html:180 + css .badge.red line 34) แต่ใน renderDetail (disputes.html:198) เขียน <span class="badge"> ตายตัว ไม่มีเงื่อนไข red → คดีที่แจ้งความ/ฟ้องศาลไม่ถูกไฮไลต์แดงในหน้ารายละเอียด.

**อาการ:** เปิด detail คดีที่ status='court' — badge สถานะเป็นสีเขียว navy ปกติเหมือนคดีทั่วไป ไม่มีสัญญาณภาพว่าคดีนี้ถึงชั้นศาลแล้ว ต่างจากในตาราง.

**แก้:** ใช้ ${['police','court'].includes(c.status)?'red':''} กับ badge ใน renderDetail line 198 ให้สอดคล้องกับ list.

#### 🟡 ย่อย · [field ไม่ตรง] `case-file.html:115` — แฟ้มหลักฐานสัญญาแสดง status เป็น enum อังกฤษดิบ (signed/sent) ไม่มี label ไทย

renderContract (case-file.html:115) แสดง esc(c.status) ตรง ๆ ขณะที่ contracts.html มี pill() map เป็นไทย (contracts.html:292: draft/sent/viewed/signed/declined/void → ฉบับร่าง/รอลงนาม/…). สถานะการเช่าก็แสดงดิบเช่นกัน (disputes.html:243, case-file.html:102). เอกสารนี้ใช้ยื่นศาล/พนักงานสอบสวน แต่โชว์คำอังกฤษ.

**อาการ:** พิมพ์แฟ้มหลักฐานสัญญาพาร์ทเนอร์เพื่อยื่นศาล — ช่อง 'สถานะ' ขึ้นคำว่า 'signed' แทน 'ลงนามแล้ว' ทำให้เอกสารทางการดูไม่เรียบร้อยและอาจสื่อสารผิดกับเจ้าหน้าที่.

**แก้:** นำ map ไทยของ contract status/rental status มาใช้ใน case-file.html และ disputes.html evidence render.

#### 🟡 ย่อย · [ทางตัน] `disputes.html:233` — qcPhotos ทิ้งรูปที่ phase ไม่ใช่ before/after เงียบ ๆ

qcPhotos จัดเข้าคอลัมน์ด้วย p.phase==='before' และ ==='after' เท่านั้น (disputes.html:233 / case-file.html:79). รูปที่ phase เป็นค่าอื่นหรือ null จะไม่ตกในคอลัมน์ใดเลย → หายจากแฟ้มหลักฐานโดยไม่มีการเตือน. qc-photo.js ส่งแค่ before/after (qc-photo.js:2) จึงเสี่ยงต่ำ แต่ไม่มี catch-all กันข้อมูลนำเข้าเก่า/ผิด.

**อาการ:** รูป QC ที่ถูก import มาโดย phase ว่าง (เช่น migrate ข้อมูลเก่า) จะไม่ปรากฏในแฟ้มหลักฐานทั้งฝั่ง 'ก่อนส่ง' และ 'ตอนรับคืน' ทำให้หลักฐานความเสียหายหายไปเงียบ ๆ.

**แก้:** เพิ่มคอลัมน์/กลุ่ม 'อื่น ๆ' สำหรับ phase ที่ไม่รู้จัก หรือ default เข้าคอลัมน์หนึ่งพร้อมป้ายกำกับ.

#### 🟡 ย่อย · [ตรรกะ] `disputes.html:87` — คดีผูกด้วย uuid อิสระ ไม่เจาะจง rental/contract ที่พิพาท

party_ref (disputes.html:87) และ sref (case-file.html:40) เป็นช่องพิมพ์ uuid อิสระ ไม่มี validation/ตรวจว่ามีอยู่จริง และคดีผูกกับ subject (customer/contract/seller) เท่านั้น ไม่ผูก rental_id/contract_id ที่เจาะจงรายการพิพาท. evidence จึงดึงประวัติทั้งหมดของบุคคลนั้น ไม่ใช่รายการเช่าที่เป็นเหตุ (ข้อ E).

**อาการ:** ลูกค้าเช่า 5 ครั้ง มีพิพาทเฉพาะครั้งที่ 3 — แฟ้มหลักฐานแสดงการเช่า/การชำระทั้ง 5 ครั้งปนกัน ทำให้เอกสารทวงถาม/แจ้งความอ้างรายการที่ไม่เกี่ยวข้อง และหากวาง uuid ผิดตัวก็ไม่มีการเตือน.

**แก้:** เพิ่มฟิลด์ rental_id/contract_id เจาะจงในการเปิดคดี และ validate uuid กับ subject ก่อนบันทึก.

#### 🟡 ย่อย · [สิทธิ์] `case-file.html:54` — หน้า evidence ยิง edge fn 'acct' ตรงด้วย raw idToken — role/PII gate เป็น server-only ตรวจไม่ได้จาก client

disputes.html (145,155) และ case-file.html (47,54) POST ตรงไป .../functions/v1/acct ด้วย Bearer idToken ไม่ผ่าน ops-rpc gateway (ไม่มี fn allowlist/owner_only map แบบ ops-api.js:41-42). การ gate role/owner และการ scope สาขาอยู่ฝั่ง edge fn ทั้งหมด (ไม่อยู่ใน repo). client ปล่อยให้ staff ที่ผ่าน gate วาง uuid ใดก็ได้เพื่อดึง PII เต็ม (เลขบัตร/ที่อยู่/รูป KYC/PDPA) โดยไม่มี scoping ฝั่ง client — ถ้า server ไม่ตรวจ owner/branch = staff คนใดก็ดู PII คู่กรณีของทุกสาขาได้.

**อาการ:** staff ระดับล่างที่ผ่าน login LINE วาง customer uuid ใดก็ได้ในหน้า case-file.html → ดึงเลขบัตรประชาชน ที่อยู่ รูปบัตร และประวัติการชำระของลูกค้าคนนั้นได้ทันที หาก edge fn 'acct' เช็คแค่ 'เป็น staff' ไม่เช็ค role/owner/branch. (ยืนยันไม่ได้เพราะ edge fn ไม่อยู่ใน repo).

**แก้:** ยืนยันว่า edge fn 'acct' บังคับ role owner/manager + scope สาขา และ log การเข้าถึง PII; พิจารณาย้ายผ่าน ops-rpc gateway ที่มี allowlist เดียวกัน.


### แพค/จอง → เตรียมส่ง → ส่ง (เจาะลึก item integrity)
*ยืนยัน 3 · หักล้าง 1*

**ความครบของการสะท้อน:** 1) BACKUP/SPARE packing: ต้นทางสร้าง rental item ได้ 2 role = primary + backup (api.js:336-341, p_backups). ปลายทาง shipout.html รับ p_code เดียว/แสดง 1 ชุด (shipout.html:85,89-135) — ไม่มี branch รวมทั้งใบจอง. แต่ตาม copy ลูกค้า (app.js:3137-3139) spare เป็น standby ที่สตูดิโอ ไม่ส่งให้ลูกค้า → การแพคเฉพาะ primary ถือว่า by-design ไม่ใช่ bug (ต้องยืนยันว่า ops_today ไม่ push spare เข้า to_ship ซึ่งเป็นฝั่ง backend มองไม่เห็น). role ครบ 2 ค่า: primary/backup สะท้อนครบใน orderCard (app.js:3099-3101,3129).
2) STATUS: ต้นทาง (api.js:391 doc) status ที่ frontend รองรับ = reserved/hold/out/returned/cancelled (rentalStatusLabel app.js:2966 + stClass app.js:3102-3103). ตกหล่น: ไม่มี shipped/delivered แยก — 'out'=จัดส่ง/กำลังใช้ ยุบ 2 เฟส (in-transit vs กำลังใช้) และไม่มี delivered. ถ้า backend คืน token อื่นจะหลุดเป็น raw string + badge ไร้สี.
3) COURIER: COURIER_TRACK รองรับ flash/kerry/kex/jt/thaipost/ninja (app.js:2953-2960). ต้นทาง quote รู้จัก 'ems' ด้วย (api.js:563) แต่ไม่มี key 'ems' ใน track map → tracking ไม่เป็นลิงก์. default ทุกทางคือ 'flash' จึงยังไม่ trigger จริงในผู้ใช้ปัจจุบัน.
4) ADDRESS/ผู้รับ: ลูกค้ากรอก address (app.js:2170 pAddrDetail → composeAddress 3523) + phone. shipout แสดง c.name/c.address/c.phone เฉพาะช่อง "ผู้ส่ง(ลูกค้า)" บนถุงส่งกลับ (shipout.html:124-128) — ไม่มี label จ่าหน้า "ส่งออกถึงลูกค้า" เลย (หน้าเตรียมส่งพิมพ์แค่ป้ายชุด+fragile+ถุงส่งกลับ shipout.html:92-135).
5) RETURN seam: ปิดครบ — return QR g/code → scan.js parseCode (scan.js:9) → laundry care_checkin (laundry.html:119) → QC conditions good/stain/damage/missing (laundry.html:147-150) ครบ.
6) my_rentals field mapping: courier/tracking_no/eta/price/deposit/rent_days/covered_by_sub/role/primary_rental_id/status/use_date/due_at สะท้อนครบใน orderCard (app.js:3104-3166) เทียบชื่อ field ตรง.

#### 🟠 สำคัญ · [รอยต่อขาด] `today.html:115` — Deep-link คิว 'ต้องส่งวันนี้' → shipout.html?code= ถูกทิ้ง ชุดไม่โหลดอัตโนมัติ

today.html:115 สร้างลิงก์แถวต้องส่งเป็น '/shipout.html?code='+encodeURIComponent(x.code) แต่ shipout.html ไม่เคยอ่าน query param เลย — load() (shipout.html:83-88) อ่านค่าจาก $('code').value เท่านั้น และ input#code (shipout.html:59) เริ่มต้นว่าง ไม่มี URLSearchParams/location.search ในสคริปต์ทั้งไฟล์. seam จาก queue ไปหน้าเตรียมส่งจึงขาด: code ที่ส่งมากับ URL ตกหาย.

**อาการ:** staff เปิด today.html เห็นชุด g1 ในหมวด 'ต้องส่งวันนี้' กดแถวนั้น → เด้งไป shipout.html?code=g1 แต่หน้าโชว์ placeholder 'ใส่โค้ดชุดเพื่อสร้างสติ๊กเกอร์' ช่องกรอกว่าง ต้องพิมพ์ g1 เองซ้ำ เสี่ยงพิมพ์ผิด/แพคผิดใบ

**แก้:** ใน shipout.html ต้นสคริปต์ อ่าน code จาก URL: const q=new URLSearchParams(location.search).get('code'); if(q){ $('code').value=q; load(); } ให้ auto-load เหมือนที่ laundry/garment ทำ

#### 🟡 ย่อย · [field ไม่ตรง] `app.js:2953` — COURIER_TRACK ขาด 'ems' ที่ระบบราคาขนส่งรองรับ → tracking ไม่เป็นลิงก์

quote() คำนวณค่าส่งโดยรู้จัก courier 'ems' อย่างชัดเจน (api.js:563: String(courier||'flash')==='ems'? 60 : ...) แต่ COURIER_TRACK (app.js:2953-2960) มีแค่ flash/kerry/kex/jt/thaipost/ninja ไม่มี 'ems'. trackUrl (app.js:2962) จึงคืน null สำหรับ ems ทำให้ orderCard แสดง courier·tracking เป็นข้อความเฉย ๆ กดตามพัสดุไม่ได้ (app.js:3104-3107). ปัจจุบัน caller ทุกจุดใส่ default 'flash' (api.js:570,605,679,720; group-checkout.html:424) จึงยังไม่ trigger แต่เป็น latent gap เมื่อใดที่ rental.courier='ems'.

**อาการ:** ถ้ามีออเดอร์ที่ courier ถูกตั้งเป็น 'ems' (Thailand Post EMS) ลูกค้าเห็น 'ems · EA123...' แต่ไม่มีลิงก์กดติดตาม ต้องคัดเลขไปเปิดเว็บไปรษณีย์เอง ทั้งที่ thaipost มีใน map อยู่แล้ว

**แก้:** เพิ่ม ems:'https://track.thailandpost.co.th/?trackNumber=' ใน COURIER_TRACK (app.js:2953-2960) ให้ตรงกับ courier vocabulary ที่ quote รองรับ

#### 🟡 ย่อย · [ทางตัน] `shipout.html:116` — หน้าเตรียมส่งไม่มีใบจ่าหน้า 'ส่งออกถึงลูกค้า' — ที่อยู่ลูกค้าโผล่เฉพาะช่องผู้ส่งของถุงส่งกลับ

ลูกค้ากรอกที่อยู่รับของอย่างละเอียด (app.js:2170 pAddrDetail + composeAddress app.js:3523-3533) และเบอร์โทร. แต่หน้า shipout พิมพ์แค่ ป้ายชุด + สติ๊กเกอร์ระวัง + 'ใบปะหน้าถุง—สำหรับส่งกลับ' (shipout.html:116-135). c.name/c.address/c.phone ถูกวางในช่อง 'ผู้ส่ง(ลูกค้า)' ของถุงส่งกลับเท่านั้น (shipout.html:124-128) ไม่มี label จ่าหน้าขาส่งออกที่ระบุลูกค้าเป็น 'ผู้รับ'. ที่อยู่ที่ลูกค้ากรอกจึงไม่ถูกสะท้อนในบทบาท 'ปลายทางส่งออก' บนหน้าที่ชื่อว่า 'เตรียมส่ง' เลย.

**อาการ:** staff ใช้หน้าเตรียมส่งเพื่อแพค+จ่าหน้าพัสดุขาออก แต่ไม่มีใบจ่าหน้าถึงลูกค้าให้พิมพ์ ต้องไปเปิดที่อยู่ลูกค้าจากที่อื่น เสี่ยงส่งผิดที่/ลืมแนบ ถ้าเข้าใจผิดว่า c.address บนถุงส่งกลับคือที่อยู่ปลายทางขาออก

**แก้:** ถ้าตั้งใจให้พิมพ์ใบจ่าหน้าขาออกที่นี่ ให้เพิ่มบล็อกผู้รับ=ลูกค้า (c.name/c.address/c.phone) เป็นใบจ่าหน้าส่งออกแยก; ถ้าจ่าหน้าขาออกทำที่ระบบขนส่ง ควรระบุใน UI ให้ชัดกันสับสน


## รอบที่ 3 — เส้นส่งกลับ/รับคืน end-to-end

### ส่งกลับ/รับคืน (เจาะลึก) — คืน→QC→check-in→คลัง→มัดจำ→ลูกค้า
*ยืนยัน 4 · หักล้าง 3*

**ความครบของการสะท้อน:** STATUS ฝั่งชุด (garment.status) ที่ระบบตั้งได้ = available/reserved/out/cleaning/repair/retired/lost/needs_review/returned. ปลายทางที่อ่าน: (1) stock.html ST_TH = มีครบยกเว้น 'returned' → ถ้า check-in ตั้ง 'returned' จะโชว์ดิบ + เสี่ยงไม่ถูกนับ rentable; (2) putaway.html ST = มี 'returned' แต่ขาด 'lost','needs_review' → โชว์ดิบ; (3) garment.html = ไม่ map เลย โชว์ esc(g.status) ดิบทุกค่า (staff เห็นอังกฤษ). 
EVENT ขนส่งขากลับ (garment_timeline.events.kind) = shipped/delivered/return_shipped/returned/in_transit/out_for_delivery/return_arrived: garment.html EVT map ครบทั้ง 7 ค่า (read ครบ) แต่ "ฝั่งเซ็ต" ทั้งหมดนี้ไม่มีที่ไหนในโค้ด static เลย — ไม่มีหน้าไหนบันทึก event เหล่านี้ (ต้องมาจาก webhook/GAS ภายนอกที่มองไม่เห็น). 
STATUS ฝั่งออเดอร์ (rental.status) = reserved/hold/out/returned/cancelled/backup: app.js rentalStatusLabel map ครบทุกค่า (read ครบ). แต่ "ผู้เซ็ต returned" ในขากลับมองไม่เห็น (care_* คีย์ด้วย p_code ไม่มี rental_id). 
PHASE รูป QC = before/after: upload (shipout=before, laundry=after) ↔ reader (case-file:79, disputes:233 filter before/after) ตรงกันครบ — ผ่าน. 
มัดจำ/ค่าเสียหาย: ไม่มีปลายทางรองรับเลยในขากลับ (มีแค่ path ยกเลิกใน api.js cancelRental).

#### 🟡 ย่อย · [รอยต่อขาด] `app.js:3098` — ฝั่งลูกค้าไม่มีปุ่ม/สถานะ 'ส่งคืน' และขาส่งกลับล่องหนตลอดทาง

orderCard (app.js:3098-3172) มีปุ่ม pay/rent-again/reschedule/extend/cancel/review แต่ไม่มีปุ่มให้ลูกค้าแจ้ง 'ส่งคืนแล้ว' และไม่มีการโชว์สถานะขากลับ. สถานะขนส่งขากลับ return_shipped/in_transit/out_for_delivery/return_arrived ถูก 'อ่าน' ครบใน garment.html:78 EVT แต่ค้นทั้ง repo ไม่มีที่ไหน 'เซ็ต' event เหล่านี้เลย. ป้ายถุงส่งกลับสร้างที่ shipout.html แต่ render() เรียกแค่ shipout_info (อ่านอย่างเดียว, shipout.html:85) — พิมพ์ใบปะหน้าถุงโดยไม่เซ็ตสถานะ return_shipped ใด ๆ.

**อาการ:** ลูกค้าส่งชุดกลับทางขนส่ง → ระหว่างทางออเดอร์ใน my_rentals ยังโชว์ 'out' = 'จัดส่ง/กำลังใช้' ตลอด ไม่มี 'กำลังส่งคืน/ถึงร้านแล้ว' และไม่มีปุ่มให้แจ้งว่าส่งแล้ว → ลูกค้าไม่รู้ว่าระบบรับรู้การคืนของตนหรือยัง จนกว่าจะ flip เป็น 'returned' เอง

**แก้:** เพิ่มปุ่ม 'ฉันส่งคืนแล้ว' (แนบเลขพัสดุ) ตั้ง rental → return_shipped, map สถานะขากลับใน rentalStatusLabel, และมีหน้า/hook ที่เซ็ต return_arrived ตอนของถึงร้าน

#### 🟡 ย่อย · [สถานะตกหล่น] `stock.html:65` — ST_TH ขาด 'returned' + ชุดค้างหลัง check-in หลุดจากกอง rentable

stock.html ST_TH (บรรทัด 65) ไม่มีคีย์ 'returned' — ถ้า care_checkin ตั้ง garment.status='returned' (ซึ่ง putaway.html:95 ยืนยันว่าเป็นสถานะจริง 'returned':'รับคืนแล้ว') stock_summary จะโชว์สถานะดิบ 'returned'. ที่หนักกว่าคือ care_wash_done ถูก gate ให้ต้องผ่าน QC + ครบชิ้นก่อน (laundry.html:173 'ยังไม่ได้ตรวจสภาพ / ของไม่ครบ') → ชุดที่ check-in แล้วแต่ยังไม่ได้กด 'ซักเสร็จ ปล่อยเช่าต่อ' จะค้างที่ returned/cleaning ไม่ถูกนับใน rentable และเงียบหายจากกองปล่อยเช่า.

**อาการ:** รับคืน g1 (สถานะ→returned) แล้วป้าลืม/ยังไม่กด 'ซักเสร็จ ปล่อยเช่าต่อ' (หรือ QC ระบุ 'ของขาดชิ้น' p_complete=false ทำให้ wash_done ถูกบล็อก) → g1 ค้างสถานะ returned, stock.html โชว์ดิบ 'returned' และไม่นับเป็น rentable → ชุดหายจากคลังปล่อยเช่า ลูกค้าจองไม่ได้ทั้งที่ของอยู่ที่ร้าน

**แก้:** เพิ่ม 'returned' (+ 'cleaning' ให้ครบทุกหน้า) ใน ST_TH และทำ leak-rule ใน stock_audit จับ 'ชุด check-in ค้างเกิน N วันไม่ปล่อยเช่า' ให้ reconcile ได้

#### 🟡 ย่อย · [สถานะตกหล่น] `garment.html:106` — garment.html โชว์ g.status ดิบ ไม่มี map ภาษาไทย

garment.html:106 แสดง `สถานะ: ${esc(g.status)}` ดิบ ๆ ไม่มี map ต่างจาก stock.html/putaway.html ที่แปลไทย → staff (ป้าแม่บ้าน) เห็นค่าอังกฤษดิบเช่น 'returned','cleaning','needs_review' บนไทม์ไลน์ชุด ไม่สอดคล้องกับหน้าอื่น. ส่วน EVT (บรรทัด 78) map ครบทุก event ขากลับแล้ว จุดนี้ไม่มีปัญหา.

**อาการ:** เปิดไทม์ไลน์ชุด g1 หลังรับคืน → pill สถานะโชว์ 'returned' เป็นภาษาอังกฤษ ขณะที่หน้าสต๊อก/เก็บเข้าช่องโชว์ 'รับคืนแล้ว' — คำไม่ตรงกันข้ามหน้า สร้างความสับสน

**แก้:** ใช้ตาราง map สถานะไทยชุดเดียวกัน (shared) ทุกหน้า ops รวมถึง gradePill/status pill ใน garment.html

#### 🟡 ย่อย · [อื่นๆ] `case-file.html:81` — รูป QC ถูก render จาก URL ตรง (คาดว่า bucket public) ต่างจาก KYC ที่เป็น signed

qcPhotos (case-file.html:81, และ disputes.html:233) แสดง <img src='${p.url}'> ตรง ๆ โดยไม่มีการจัดการลิงก์หมดอายุ ต่างจาก imgs() ของ KYC (case-file.html:86) ที่เช็ค f.url และแสดง 'ลิงก์หมดอายุ' เมื่อเป็น signed URL หมดอายุ. บ่งชี้ว่ารูป QC สภาพชุด (ก่อน/หลัง) เก็บใน bucket public แบบ URL ถาวร — เข้าถึงได้โดยไม่ต้อง auth หากรู้ลิงก์ ทั้งที่ถูกใช้เป็นหลักฐานในแฟ้มคดี/ข้อพิพาท.

**อาการ:** รูปสภาพชุดตอนรับคืน (อาจติดข้อมูล/บริบทลูกค้า) ถูกอัปโหลดผ่าน qc_photo_upload เข้า bucket public → ใครก็ตามที่ได้ URL เปิดดูได้โดยไม่ผ่าน LINE login/role ต่างจากไฟล์ KYC ที่เป็น signed URL หมดอายุ

**แก้:** ถ้า QC photos เป็นหลักฐาน ควรเก็บ bucket private แล้วออก signed URL ตอน render (เหมือน KYC) พร้อม handle ลิงก์หมดอายุ
