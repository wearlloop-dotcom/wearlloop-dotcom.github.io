# LLOOP — LINE Flex Templates (ตามฟอร์แมตการ์ดเดิมของแบรนด์)

อิงโครงการ์ดที่ระบบส่งอยู่แล้วในโปรดักชัน (การ์ด "จองสำเร็จ", "ลุคขึ้นฟีด", "มาใหม่ · คัดให้คุณ") — ทุกใบใหม่ใช้กายวิภาคเดียวกันนี้ ไม่หลุดคาแรกเตอร์:

```
[รูปชุดจากเว็บ — เฉพาะการ์ดที่ผูกกับชุด]
[ไอคอนลายเส้นทอง เล็ก กึ่งกลาง]      ← line art ชุดใหม่ 19 ตัว (line-flex/icon-*.png)
        L L O O P                    ← โลโก้กึ่งกลาง เว้นช่องไฟ
────────────────────────
kicker สีทอง (2–4 คำ)
หัวข้อดำหนา 1 บรรทัด
คำอธิบายสั้น 1–2 บรรทัด
────────────────────────
ป้ายเทา          ค่า                ← ตารางรายละเอียด (เฉพาะที่จำเป็น)
...
หมายเหตุสั้น 1 บรรทัด
ตัวเอียงเทา (fine print ≤ 2 บรรทัด)  ← สั้นกว่าของเดิม ตามโจทย์ลดตัวอักษร
[ปุ่มดำ]  [ลิงก์รอง]                 ← ถ้าจำเป็นต้องมี
```

- **ไม่มี emoji** · โทน: ทอง `#C9A86A` (kicker/ไอคอน) · ดำ `#1A1A1A` (หัวข้อ/ปุ่ม) · เทา `#8C8B86` (ป้าย/fine print)
- ปุ่มลิงก์ทุกปุ่ม → LIFF permanent link `https://liff.line.me/{{LIFF_ID}}/...` (LIFF_ID: `2010486714-1g6lDuHo`) · `{{OA_CHAT_URL}}` = แชท OA
- ไอคอนโฮสต์ที่ `https://wearlloop-dotcom.github.io/line-flex/icon-<ชื่อ>.png` (PNG โปร่งใส 400×400)

## โครง JSON กลาง (ใช้ทุกใบ — เปลี่ยนเฉพาะเนื้อหา)

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{PHOTO_URL}}", "size": "full", "aspectRatio": "4:3", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "paddingAll": "20px", "contents": [
    { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/icon-booking.png", "size": "60px" },
    { "type": "text", "text": "L L O O P", "weight": "bold", "size": "xl", "align": "center", "margin": "lg" },
    { "type": "separator", "margin": "xl" },
    { "type": "text", "text": "<kicker>", "size": "xs", "color": "#C9A86A", "weight": "bold", "margin": "xl" },
    { "type": "text", "text": "<หัวข้อ>", "weight": "bold", "size": "xl", "wrap": true, "margin": "sm" },
    { "type": "text", "text": "<คำอธิบาย>", "size": "sm", "color": "#1A1A1A", "wrap": true, "margin": "md" },
    { "type": "separator", "margin": "xl" },
    { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [
      { "type": "text", "text": "<ป้าย>", "size": "sm", "color": "#8C8B86", "flex": 2, "wrap": true },
      { "type": "text", "text": "<ค่า>", "size": "sm", "color": "#1A1A1A", "flex": 3, "wrap": true } ] },
    { "type": "text", "text": "<หมายเหตุ>", "size": "sm", "color": "#1A1A1A", "wrap": true, "margin": "xl" },
    { "type": "text", "text": "<fine print>", "size": "xs", "color": "#8C8B86", "style": "italic", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "paddingAll": "20px", "paddingTop": "0px", "contents": [
    { "type": "button", "style": "primary", "color": "#1A1A1A",
      "action": { "type": "uri", "label": "<ปุ่มหลัก>", "uri": "<ลิงก์>" } },
    { "type": "button", "style": "link", "height": "sm", "color": "#1A1A1A",
      "action": { "type": "uri", "label": "<ปุ่มรอง>", "uri": "<ลิงก์>" } }
  ]}
}
```

กติกาประกอบ: ใบไหนไม่ผูกกับชุด → ตัด `hero` ทิ้ง · แถวตารางเพิ่ม/ลดได้ (copy บล็อก `layout: "horizontal"`) · ไม่มีปุ่มรอง → ตัดปุ่ม link ทิ้ง · ใบเตือน/เงินค้าง เปลี่ยนสี kicker เป็น `#A75F3A`

ด้านล่างคือ**สเปกเนื้อหาของแต่ละใบ** (icon · kicker · หัวข้อ · คำอธิบาย · ตาราง · หมายเหตุ · fine · ปุ่ม) — เอาไปเสียบโครงข้างบนได้ตรง ๆ

---

## กลุ่มจอง–จ่าย

### 1. `booking_confirmed` — จองสำเร็จ *(มีในระบบแล้ว — เพิ่มปุ่ม)*
- hero: รูปชุดจากเว็บ · icon: `icon-booking` · kicker: `จองสำเร็จ`
- หัวข้อ: `จองชุด "{{GARMENT_NAME}}" แล้ว`
- คำอธิบาย: `ล็อกคิวให้แล้วค่ะ โอนแล้วส่งสลิปในแชตนี้เพื่อยืนยันการจองได้เลย`
- ตาราง: วันรับชุด (วันแรก) → `{{START_DATE}}` · กำหนดคืน → `{{END_DATE}}` · ค่าเช่า → `฿{{PRICE}} · {{DAYS}} วัน` · มัดจำ (คืนหลังตรวจ) → `฿{{DEPOSIT}}` · ค่าส่ง → `{{SHIP_FEE}}` · **รวมโอน → `฿{{TOTAL}}`** · ชุดสำรอง → `{{BACKUP_NAMES}}`
- หมายเหตุ: `เราจัดส่งถึงมือคุณราว {{SHIP_DATE}} ซึ่งนับเป็นวันแรกของการเช่าค่ะ`
- fine: `โอนภายใน 30 นาที เพื่อรักษาคิวไว้ให้นะคะ`
- ปุ่ม: **ชำระเงิน / ส่งสลิป** → `pay.html?order={{ORDER_ID}}` · ลิงก์: `ดูออเดอร์ของฉัน` → `index.html?tab=me`

### 2. `payment_confirmed` — รับยอดแล้ว *(ใหม่)*
- icon: `icon-payment-ok` · kicker: `ชำระเงินสำเร็จ`
- หัวข้อ: `ยืนยันออเดอร์ {{ORDER_CODE}} แล้ว`
- คำอธิบาย: `รับยอดเรียบร้อยค่ะ เราจะเตรียมชุดและแจ้งเมื่อจัดส่งนะคะ`
- ตาราง: ยอดรับ → `฿{{AMOUNT}}` · เมื่อ → `{{PAID_AT}}` · จัดส่งราว → `{{SHIP_DATE}}`
- ปุ่ม: **ดูออเดอร์ของฉัน** → `index.html?tab=me`

### 3. `slip_rejected` — สลิปไม่ผ่าน *(ใหม่)*
- icon: `icon-slip-x` · kicker (clay): `สลิปยังไม่ผ่านการตรวจ`
- หัวข้อ: `{{REASON}}` (เช่น "ยอดโอนไม่ตรง")
- คำอธิบาย: `ส่งสลิปใหม่หรือทักแอดมินได้เลยค่ะ`
- ตาราง: ออเดอร์ → `{{ORDER_CODE}}` · ถือคิวถึง → `{{HOLD_UNTIL}}`
- ปุ่ม: **ส่งสลิปใหม่ / ชำระอีกครั้ง** → `pay.html?order={{ORDER_ID}}` · ลิงก์: `คุยกับแอดมิน` → `{{OA_CHAT_URL}}`

### 4. `pay_deadline_reminder` — ใกล้หมดเวลาถือคิว *(ใหม่)*
- icon: `icon-pay-clock` · kicker (clay): `อีก {{MINS_LEFT}} นาที คิวจะหลุด`
- หัวข้อ: `ชุด "{{GARMENT_NAME}}" รอคุณอยู่`
- ตาราง: รวมโอน → `฿{{TOTAL}}` · ถือคิวถึง → `{{HOLD_UNTIL}}`
- fine: `เลยเวลาแล้วคิวจะเปิดให้คนถัดไปนะคะ`
- ปุ่ม: **ชำระเงินตอนนี้** → `pay.html?order={{ORDER_ID}}`

### 5. `group_pay_nudge` — เตือนหารกลุ่ม *(ใหม่)*
- icon: `icon-group` · kicker: `กลุ่ม {{GROUP_NAME}} รอคุณอยู่`
- หัวข้อ: `ส่วนของคุณ ฿{{AMOUNT}}`
- ตาราง: จ่ายแล้ว → `{{PAID_COUNT}}/{{TOTAL_COUNT}} คน` · ครบภายใน → `{{DEADLINE}}`
- fine: `ครบทุกคนเมื่อไหร่ คิวชุดทั้งกลุ่มถึงจะล็อกค่ะ`
- ปุ่ม: **จ่ายส่วนของฉัน** → `pay.html?group={{GROUP_ORDER_ID}}&member={{MEMBER_ID}}` · ลิงก์: `ดูสถานะกลุ่ม` → `event.html?order={{GROUP_ORDER_ID}}`

## กลุ่มส่ง–ใช้–คืน

### 6. `order_shipped` — จัดส่งแล้ว *(ใหม่ — ปิด gap ใหญ่)*
- icon: `icon-shipped` · kicker: `จัดส่งแล้ว`
- หัวข้อ: `ชุด "{{GARMENT_NAME}}" ออกเดินทางแล้ว`
- ตาราง: ขนส่ง → `{{CARRIER}}` · เลขพัสดุ → `{{TRACKING_NO}}` · ถึงราว → `{{ETA_DATE}}`
- หมายเหตุ: `ในกล่องมีถุงส่งคืน + ใบปะหน้าขากลับให้แล้วค่ะ`
- ปุ่ม: **ติดตามพัสดุ** → `{{TRACKING_URL}}` · ลิงก์: `วิธีคืนชุด` → `rental-terms.html#return`

### 7. `spare_swap_notice` — สลับชุดสำรอง *(ใหม่)*
- hero: รูปชุดสำรองจากเว็บ · icon: `icon-dress` · kicker (clay): `สลับเป็นชุดสำรองให้แล้ว`
- หัวข้อ: `คุณจะได้รับ "{{SPARE_NAME}}"`
- คำอธิบาย: `ชุดหลัก{{REASON}} เราจึงส่งชุดสำรองที่คุณเลือกไว้แทน — ไม่มีค่าใช้จ่ายเพิ่ม ส่งตามกำหนดเดิมค่ะ`
- ปุ่ม: **ดูชุดที่จะได้รับ** → `g.html?code={{SPARE_CODE}}` · ลิงก์: `คุยกับแอดมิน` → `{{OA_CHAT_URL}}`

### 8. `return_reminder` — พรุ่งนี้กำหนดคืน *(webhooks stub เดิมตายอยู่ — ใบนี้แทน)*
- icon: `icon-return` · kicker (clay): `พรุ่งนี้กำหนดคืน`
- หัวข้อ: `ชุด "{{GARMENT_NAME}}"`
- คำอธิบาย: `ส่งกลับด้วยถุง + ใบปะหน้าในกล่อง แล้วกรอกเลขพัสดุในปุ่มด้านล่างได้เลยค่ะ`
- ตาราง: กำหนดคืน → `{{END_DATE}}`
- fine: `ใส่สนุกอยู่ ต่อวันเช่าได้จากปุ่มล่างนะคะ`
- ปุ่ม: **กรอกเลขพัสดุส่งคืน** → `index.html?tab=me&return={{RENTAL_ID}}` · ลิงก์: `ต่อวันเช่า` → `index.html?tab=me&extend={{RENTAL_ID}}`

### 9. `return_tracking_received` — รับเลขพัสดุแล้ว *(ใหม่ — คู่กับ RPC `return_tracking_submit`)*
- icon: `icon-return-received` · kicker: `รับเลขพัสดุส่งคืนแล้ว`
- หัวข้อ: `ขอบคุณค่ะ กำลังรอรับชุด`
- ตาราง: ขนส่ง → `{{RETURN_COURIER}}` · เลขพัสดุ → `{{RETURN_TRACKING_NO}}`
- หมายเหตุ: `ชุดถึงร้านแล้วเราจะตรวจสภาพ แจ้งผล และคืนมัดจำทาง LINE ค่ะ`
- ปุ่ม: **ติดตามพัสดุขากลับ** → `{{RETURN_TRACKING_URL}}`

### 10. `overdue_notice` — เลยกำหนดคืน *(ใหม่ — inbox kind `late` มีรออยู่แล้ว)*
- icon: `icon-overdue` · kicker (clay): `เลยกำหนดคืน {{DAYS_LATE}} วัน`
- หัวข้อ: `ชุด "{{GARMENT_NAME}}"`
- ตาราง: กำหนดคืน → `{{END_DATE}}` · ค่าปรับ → `฿{{LATE_FEE_PER_DAY}}/วัน` · **รวมตอนนี้ → `฿{{LATE_FEE_TOTAL}}`**
- หมายเหตุ: `กรอกเลขพัสดุแล้วค่าปรับหยุดนับทันที · ติดขัดอะไรทักมาคุยได้เลยนะคะ`
- ปุ่ม: **กรอกเลขพัสดุส่งคืน** → `index.html?tab=me&return={{RENTAL_ID}}` · ลิงก์: `คุยกับแอดมิน` → `{{OA_CHAT_URL}}`

### 11. `return_received_review` — รับคืนแล้ว ขอรีวิว *(ใหม่)*
- icon: `icon-dress` · kicker: `รับชุดคืนแล้ว · สภาพผ่าน`
- หัวข้อ: `ขอบคุณที่ดูแลชุดอย่างดีค่ะ`
- ตาราง: มัดจำ → `฿{{DEPOSIT}}` · คืนภายใน → `{{REFUND_DAYS}} วันทำการ`
- หมายเหตุ: `รีวิวสั้น ๆ ช่วยเพื่อนเลือกไซส์ได้มาก แถมได้เครดิตด้วยค่ะ`
- ปุ่ม: **เขียนรีวิว รับเครดิต** → `review.html?rental={{RENTAL_ID}}` · ลิงก์: `หาชุดงานถัดไป` → `index.html`

### 12. `qc_fee_notice` — พบตำหนิ มีค่าดูแลเพิ่ม *(ใหม่ — จุดเก็บเงินที่เดิมเงียบสนิท)*
- icon: `icon-qc-fee` · kicker (clay): `ผลตรวจสภาพชุด`
- หัวข้อ: `{{ISSUE_SUMMARY}}`
- ตาราง: ชุด → `{{GARMENT_NAME}}` · ค่าดูแลเพิ่ม → `฿{{FEE}}` · หักจากมัดจำ → `฿{{DEPOSIT}}`
- หมายเหตุ: `เราแนบรูปหลักฐานให้ตรวจได้ทุกจุด สงสัยตรงไหนทักได้เลยนะคะ`
- ปุ่ม: **ดูรูปหลักฐาน** → `{{EVIDENCE_URL}}` · ลิงก์: `คุยกับแอดมิน` → `{{OA_CHAT_URL}}`

### 13. `deposit_refunded` — คืนเงินแล้วจริง *(ใหม่ — ใบปิดจบเรื่องเงิน)*
- icon: `icon-refund` · kicker: `คืนเงินเรียบร้อย`
- หัวข้อ: `โอนคืน ฿{{AMOUNT}} แล้วค่ะ`
- ตาราง: ประเภท → `{{REFUND_KIND}}` · ช่องทาง → `{{METHOD}}` · เมื่อ → `{{REFUNDED_AT}}`
- หมายเหตุ: `ขอบคุณที่เช่ากับ LLOOP นะคะ แล้วพบกันลุคหน้าค่ะ`
- ปุ่ม: **ดูชุดใหม่เข้าร้าน** → `index.html?sort=new`

### 14. `booking_changed` — ยกเลิก/เลื่อน/ต่อเวลา สำเร็จ *(ใหม่)*
- icon: `icon-booking` · kicker: `{{CHANGE_TITLE}}สำเร็จ` (ยกเลิก/เลื่อนวัน/ต่อเวลา)
- หัวข้อ: `ชุด "{{GARMENT_NAME}}"`
- ตาราง (ตามกรณี): วันใช้ใหม่ → `{{NEW_DATE}}` · คืนเงิน → `฿{{REFUND}} ({{METHOD}})`
- ปุ่ม: **ดูออเดอร์ของฉัน** → `index.html?tab=me`

## กลุ่มค้นหา–ชุดเข้า

### 15. `wishlist_available` — ชุดที่ขอไว้เข้าแล้ว *(RPC `notify_customer_wishlist` มีแล้ว — ใบนี้คือหน้าตาข้อความ)*
- hero: รูปชุดจากเว็บ · icon: `icon-queue` · kicker: `ชุดที่คุณขอไว้ มาแล้ว`
- หัวข้อ: `"{{GARMENT_NAME}}" พร้อมให้จอง`
- ตาราง: แบรนด์ → `{{BRAND}}` · ไซส์ → `{{SIZE}}` · ค่าเช่า → `฿{{PRICE}}`
- fine: `ถือคิวให้คุณก่อนใคร {{HOLD_HOURS}} ชม. นะคะ`
- ปุ่ม: **จองเลย** → `g.html?code={{GARMENT_CODE}}` · ลิงก์: `ดูชุดอื่น` → `index.html`

### 16. `waitlist_date_open` — คิวว่างแล้ว *(ใหม่ — ปิดคำสัญญา "แจ้งให้เลือกก่อนใคร")*
- hero: รูปชุดจากเว็บ · icon: `icon-queue` · kicker: `คิวของคุณมาถึงแล้ว`
- หัวข้อ: `วันที่ {{DATE}} ว่างแล้ว`
- ตาราง: ชุด → `{{GARMENT_NAME}}` · เลือกก่อนใครถึง → `{{HOLD_UNTIL}}`
- ปุ่ม: **จองวันนี้เลย** → `g.html?code={{GARMENT_CODE}}&date={{DATE}}` · ลิงก์: `ออกจากคิว` → `wishlist.html?leave={{QUEUE_ID}}`

### 17. `new_arrival` — มาใหม่ คัดให้คุณ *(มีในระบบแล้ว — ฟอร์แมตตรงเดิม)*
คงของเดิมทั้งใบ (hero รูปชุด · kicker `มาใหม่ · คัดให้คุณ` · ตารางโทนสี/ความพอดี/ไซส์/สี/ค่าเช่า · ปุ่มดำ `ดูชุดนี้` + ลิงก์ `ดูชุดอื่น`) — เดิมดีอยู่แล้วค่ะ

### 18. `abandon_checkout` — ตะกร้าค้าง *(ใหม่)*
- hero: รูปชุดจากเว็บ · icon: `icon-dress` · kicker: `ยังเก็บไว้ให้อยู่`
- หัวข้อ: `"{{GARMENT_NAME}}" รอคุณกดจองต่อ`
- ตาราง: วันที่เลือกไว้ → `{{DATE_RANGE}}` (ยังว่าง)
- ปุ่ม: **จองต่อให้จบ** → `g.html?code={{GARMENT_CODE}}&resume=1`

## กลุ่มสมาชิก–ไลฟ์สไตล์

### 19. `welcome_kyc_approved` — ยืนยันตัวตนผ่าน *(ใหม่)*
- icon: `icon-dress` · kicker: `ยืนยันตัวตนผ่านแล้ว`
- หัวข้อ: `ยินดีต้อนรับค่ะ {{FIRST_NAME}}`
- คำอธิบาย: `เช่าได้ทุกชุดในร้านทันที`
- ปุ่ม: **เริ่มเลือกชุด** → `index.html` · ลิงก์: `ควิซสไตล์ 2 นาที` → `quiz.html`

### 20. `credit_expiring` — เครดิตใกล้หมดอายุ *(ใหม่ — kind มีแล้ว)*
- icon: `icon-credit` · kicker (clay): `เครดิตใกล้หมดอายุ`
- หัวข้อ: `฿{{AMOUNT}} ใช้ได้ถึง {{EXPIRE_DATE}}`
- ปุ่ม: **ใช้เครดิตเลือกชุด** → `index.html`

### 21. `birthday_free_rental` — เช่าฟรีเดือนเกิด *(flow `birthday_reserve` มีในแอปแล้ว)*
- icon: `icon-birthday` · kicker: `สุขสันต์วันเกิดค่ะ`
- หัวข้อ: `เช่าฟรี 1 ชุด เดือนเกิดนี้`
- ตาราง: เลือกได้ถึง → `฿{{BUDGET}}` · ใช้สิทธิ์ได้ถึง → `{{VALID_UNTIL}}`
- ปุ่ม: **ใช้สิทธิ์วันเกิด** → `index.html?birthday=1`

### 22. `referral_credit` — เครดิตชวนเพื่อนเข้าแล้ว *(kind มีแล้ว)*
- icon: `icon-credit` · kicker: `เครดิตชวนเพื่อนเข้าแล้ว`
- หัวข้อ: `+฿{{AMOUNT}} เข้ากระเป๋าคุณแล้ว`
- คำอธิบาย: `{{FRIEND_NAME}} เช่าครั้งแรกสำเร็จค่ะ ชวนต่อได้ไม่จำกัด`
- ปุ่ม: **ใช้เครดิตเลือกชุด** → `index.html` · ลิงก์: `แชร์โค้ดต่อ` → `index.html?tab=me&referral=1`

### 23. `style_ready` — ผลวิเคราะห์สีเสร็จ *(kind มีแล้ว)*
- icon: `icon-style` · kicker: `ผลวิเคราะห์เสร็จแล้ว`
- หัวข้อ: `คุณคือโทน{{SEASON_TH}} ({{SEASON}})`
- คำอธิบาย: `เราคัดชุดตรงโทนสีของคุณรอไว้แล้วค่ะ`
- ปุ่ม: **ดูผลวิเคราะห์** → `index.html?style=result` · ลิงก์: `ชุดตรงโทนของฉัน` → `index.html?season={{SEASON_KEY}}`

### 24. `stylist_appointment` — ยืนยัน/เตือนนัดสไตลิสต์ *(ใหม่)*
- icon: `icon-stylist` · kicker: `{{KIND}}นัดสไตลิสต์` (ยืนยัน/พรุ่งนี้)
- หัวข้อ: `{{STYLIST_NAME}}`
- ตาราง: วันเวลา → `{{APPT_DATE}} · {{APPT_TIME}}` · รูปแบบ → `{{MODE}}`
- ปุ่ม: **ดูนัดของฉัน** → `index.html?tab=me&appt={{APPT_ID}}` · ลิงก์: `เลื่อน / ยกเลิกนัด` → `index.html?tab=me&appt={{APPT_ID}}&manage=1`

## กลุ่มคอมมูนิตี้–กลุ่ม–สัญญา

### 25. `look_approved` — ลุคขึ้นฟีด *(มีในระบบแล้ว — เพิ่มปุ่ม + ใส่รูปลุค)*
คงข้อความเดิม (kicker `ลุคของคุณขึ้นฟีดแล้ว` · หัวข้อ `ขอบคุณที่แชร์ลุค`) + เพิ่ม hero รูปลุคของลูกค้า และปุ่ม: **ดูลุคในฟีด** → `looks.html?look={{LOOK_ID}}` · ลิงก์: `แชร์ต่อ` → `looks.html?look={{LOOK_ID}}&share=1`
*(fine print เดิมเรื่องส่วนแบ่งเครดิตเก็บไว้ 1 บรรทัดพอ: "ทุกคนที่เช่าตามลุค คุณได้ส่วนแบ่งเครดิตค่ะ")*

### 26. `group_invite_accepted` — เพื่อนเข้ากลุ่มแล้ว *(ใหม่ — ปิดคำสัญญาใน family.html)*
- icon: `icon-group` · kicker: `สมาชิกใหม่เข้ากลุ่ม`
- หัวข้อ: `{{FRIEND_NAME}} ตอบรับแล้ว`
- ตาราง: กลุ่ม → `{{GROUP_NAME}}` · สมาชิก → `{{MEMBER_COUNT}} คน`
- ปุ่ม: **จัดธีมกลุ่ม** → `family.html?group={{GROUP_ID}}`

### 27. `repair_quote` — ผลประเมินซ่อม *(ใหม่ — เดิมแจ้งแค่เจ้าของ)*
- icon: `icon-repair` · kicker: `ผลประเมินการซ่อม`
- หัวข้อ: `ชุด "{{GARMENT_NAME}}"`
- ตาราง: ผลประเมิน → `{{ASSESSMENT}}` · ค่าซ่อม → `฿{{COST}}` · ระยะเวลา → `{{DAYS}} วัน`
- ปุ่ม: **ยืนยันให้ซ่อม** → `repair.html?job={{JOB_ID}}&approve=1` · ลิงก์: `คุยกับแอดมินก่อน` → `{{OA_CHAT_URL}}`

### 28. `contract_copy` — สำเนาสัญญา *(คำสัญญาใน contract.html)*
- icon: `icon-contract` · kicker: `ลงนามเรียบร้อย`
- หัวข้อ: `สัญญาเลขที่ {{CONTRACT_NO}}`
- ตาราง: ลงนามเมื่อ → `{{SIGNED_AT}}`
- ปุ่ม: **เปิดดูสัญญา** → `contract.html?token={{CONTRACT_TOKEN}}`

> แคมเปญ (`reengagement`, `winback`, `event_suggest`, `charity_update`) ใช้โครงเดียวกัน เปลี่ยน kicker/เนื้อหา · การ์ดชวนเข้ากลุ่มที่ลูกค้าแชร์เอง (family.html) ปรับเป็นฟอร์แมตนี้แล้วเช่นกัน

---

## ตัวอย่าง JSON เต็ม 2 ใบ (ที่เหลือเสียบโครงกลางตามสเปก)

### `order_shipped` (ไม่มี hero)

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "paddingAll": "20px", "contents": [
    { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/icon-shipped.png", "size": "60px" },
    { "type": "text", "text": "L L O O P", "weight": "bold", "size": "xl", "align": "center", "margin": "lg" },
    { "type": "separator", "margin": "xl" },
    { "type": "text", "text": "จัดส่งแล้ว", "size": "xs", "color": "#C9A86A", "weight": "bold", "margin": "xl" },
    { "type": "text", "text": "ชุด \"{{GARMENT_NAME}}\" ออกเดินทางแล้ว", "weight": "bold", "size": "xl", "wrap": true, "margin": "sm" },
    { "type": "separator", "margin": "xl" },
    { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [
      { "type": "text", "text": "ขนส่ง", "size": "sm", "color": "#8C8B86", "flex": 2 },
      { "type": "text", "text": "{{CARRIER}}", "size": "sm", "color": "#1A1A1A", "flex": 3 } ] },
    { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [
      { "type": "text", "text": "เลขพัสดุ", "size": "sm", "color": "#8C8B86", "flex": 2 },
      { "type": "text", "text": "{{TRACKING_NO}}", "size": "sm", "color": "#1A1A1A", "flex": 3 } ] },
    { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [
      { "type": "text", "text": "ถึงราว", "size": "sm", "color": "#8C8B86", "flex": 2 },
      { "type": "text", "text": "{{ETA_DATE}}", "size": "sm", "color": "#1A1A1A", "flex": 3 } ] },
    { "type": "text", "text": "ในกล่องมีถุงส่งคืน + ใบปะหน้าขากลับให้แล้วค่ะ", "size": "sm", "color": "#1A1A1A", "wrap": true, "margin": "xl" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "paddingAll": "20px", "paddingTop": "0px", "contents": [
    { "type": "button", "style": "primary", "color": "#1A1A1A",
      "action": { "type": "uri", "label": "ติดตามพัสดุ", "uri": "{{TRACKING_URL}}" } },
    { "type": "button", "style": "link", "height": "sm", "color": "#1A1A1A",
      "action": { "type": "uri", "label": "วิธีคืนชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/rental-terms.html#return" } }
  ]}
}
```

### `wishlist_available` (มี hero รูปชุดจากเว็บ)

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{PHOTO_URL}}", "size": "full", "aspectRatio": "4:3", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "paddingAll": "20px", "contents": [
    { "type": "text", "text": "L L O O P", "weight": "bold", "size": "xl", "align": "center", "margin": "sm" },
    { "type": "separator", "margin": "xl" },
    { "type": "text", "text": "ชุดที่คุณขอไว้ มาแล้ว", "size": "xs", "color": "#C9A86A", "weight": "bold", "margin": "xl" },
    { "type": "text", "text": "\"{{GARMENT_NAME}}\" พร้อมให้จอง", "weight": "bold", "size": "xl", "wrap": true, "margin": "sm" },
    { "type": "separator", "margin": "xl" },
    { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [
      { "type": "text", "text": "แบรนด์", "size": "sm", "color": "#8C8B86", "flex": 2 },
      { "type": "text", "text": "{{BRAND}}", "size": "sm", "color": "#1A1A1A", "flex": 3 } ] },
    { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [
      { "type": "text", "text": "ไซส์", "size": "sm", "color": "#8C8B86", "flex": 2 },
      { "type": "text", "text": "{{SIZE}}", "size": "sm", "color": "#1A1A1A", "flex": 3 } ] },
    { "type": "box", "layout": "horizontal", "margin": "lg", "contents": [
      { "type": "text", "text": "ค่าเช่า", "size": "sm", "color": "#8C8B86", "flex": 2 },
      { "type": "text", "text": "฿{{PRICE}}", "size": "sm", "color": "#1A1A1A", "flex": 3 } ] },
    { "type": "text", "text": "ถือคิวให้คุณก่อนใคร {{HOLD_HOURS}} ชม. นะคะ", "size": "xs", "color": "#8C8B86", "style": "italic", "wrap": true, "margin": "xl" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "paddingAll": "20px", "paddingTop": "0px", "contents": [
    { "type": "button", "style": "primary", "color": "#1A1A1A",
      "action": { "type": "uri", "label": "จองเลย", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{GARMENT_CODE}}" } },
    { "type": "button", "style": "link", "height": "sm", "color": "#1A1A1A",
      "action": { "type": "uri", "label": "ดูชุดอื่น", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html" } }
  ]}
}
```

---

## คลังไอคอนลายเส้นทอง (`line-flex/icon-*.png` — 400×400 โปร่งใส เส้น `#C9A86A`)

`booking` ปฏิทิน+หัวใจ · `shipped` รถส่งของ · `return` กล่อง+ลูกศรกลับ · `return-received` กล่อง+เช็ค · `payment-ok` ใบเสร็จ+เช็ค · `slip-x` ใบเสร็จ+ตกใจ · `pay-clock` นาฬิกาทราย · `dress` เดรส · `qc-fee` แว่นขยาย+ผ้า · `refund` แบงก์+ลูกศรกลับ · `overdue` นาฬิกาปลุก · `queue` กระดิ่ง · `credit` กระเป๋าเงิน+เหรียญ · `birthday` เค้ก+เทียน · `style` พัดสวอตช์ · `stylist` ปฏิทิน+นาฬิกา · `group` เดรสคู่บนไม้แขวน · `repair` เข็มด้าย+กระดุม · `contract` เอกสาร+ลายเซ็น

ต้นฉบับ SVG อยู่ใน `line-flex/src/icon-generator.html` (แก้แล้ว render ใหม่ด้วย `render-icons.js`) · ไอคอนออนไลน์เมื่อ push ขึ้น GitHub Pages แล้ว

## หมายเหตุการต่อระบบ

1. **จุดยิง:** DB trigger (pg_net) / Edge Function หลัง RPC สำเร็จ: `book_with_backups`, `book_cart`, `care_qc`, `care_checkin`, `mark_garment_ready`, `notify_customer_wishlist`, `contract_sign`, `group_pay_confirm`, `return_tracking_submit`
2. **RPC ใหม่ที่ต้องสร้าง:** `return_tracking_submit(p_rental, p_courier, p_tracking_no)` — frontend เรียกผ่าน me-rpc แล้ว (ปุ่ม "แจ้งส่งคืน · กรอกเลขพัสดุ" ใน "ออเดอร์ของฉัน") บันทึก event `return_shipped` แล้วยิงใบ #9 · `my_rentals` ต้องคืนฟิลด์ `return_courier`, `return_tracking_no`
3. `{{PHOTO_URL}}` = รูปชุดเดียวกับหน้าเว็บ (`photos[0]` ของ garments) — HTTPS, ≤10MB ตามข้อกำหนด LINE
4. `webhooks.js` เป็น stub n8n ที่ไม่ถูกเรียกและปิดอยู่ — ยิงจาก backend แทน
5. ทุก push ควร insert ลง notification inbox ในแอปคู่กัน (kinds ใน `app.js:3676-3698`)
