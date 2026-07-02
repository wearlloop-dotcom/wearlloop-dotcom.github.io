# LLOOP — LINE Flex Message Templates (หลัง action ของลูกค้า/ทีมงาน)

ชุดเทมเพลต Flex Message พร้อมปุ่ม สำหรับใช้ฝั่ง backend (Supabase Edge Function / DB trigger ผ่าน pg_net / n8n)
ยิงผ่าน LINE Messaging API `POST https://api.line.me/v2/bot/message/push`

**วิธีใช้:** แทนที่ตัวแปร `{{...}}` ด้วยค่าจริงก่อนส่ง แล้วห่อด้วย

```json
{ "to": "{{LINE_UID}}", "messages": [ { "type": "flex", "altText": "<altText ของเทมเพลต>", "contents": <JSON bubble ด้านล่าง> } ] }
```

**โทนสีแบรนด์** (ตามการ์ดเชิญกลุ่มใน `family.html`): เขียวมิ้นต์ `#6FB3A6` · ตัวอักษรหลัก `#1A1A1A` · ตัวรอง `#8C8B86` · แดงเตือน `#C0564A`

**ลิงก์ปุ่ม:** ทุกปุ่มใช้ LIFF permanent link `https://liff.line.me/{{LIFF_ID}}/<page>` (LIFF_ID ปัจจุบัน: `2010486714-1g6lDuHo`) เพื่อเปิดในแอป LINE ได้เลย
`{{OA_CHAT_URL}}` = ลิงก์แชท LINE OA เช่น `https://line.me/R/ti/p/@lloop`

---

## 1. `booking_confirmed` — ยืนยันการจอง (หลังลูกค้ากดจอง `book_with_backups` / `book_cart`)

altText: `รับคำจองแล้วค่ะ · {{GARMENT_NAME}} {{DATE_RANGE}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "รับคำจองแล้วค่ะ 🎉", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true, "margin": "md" },
    { "type": "text", "text": "รับ {{START_DATE}} · คืน {{END_DATE}}", "size": "sm", "color": "#8C8B86" },
    { "type": "text", "text": "ยอดชำระ {{AMOUNT}} บาท (รวมมัดจำ {{DEPOSIT}} บาท)", "size": "sm", "color": "#1A1A1A", "margin": "md" },
    { "type": "text", "text": "โอนภายใน {{PAY_DEADLINE}} เพื่อยืนยันคิวนะคะ", "size": "xs", "color": "#C0564A", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ชำระเงินเลย", "uri": "https://liff.line.me/{{LIFF_ID}}/pay.html?order={{ORDER_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ดูออเดอร์ของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me" } }
  ]}
}
```

## 2. `payment_confirmed` — ยืนยันรับยอด/สลิปผ่านแล้ว (หลังระบบ `acct` ตรวจสลิปผ่าน)

altText: `ยืนยันการชำระเงินแล้วค่ะ · ออเดอร์ {{ORDER_CODE}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "ชำระเงินสำเร็จ ✓", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "ออเดอร์ {{ORDER_CODE}} ยืนยันแล้วค่ะ", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "ยอดรับ {{AMOUNT}} บาท · {{PAID_AT}}", "size": "sm", "color": "#8C8B86" },
    { "type": "text", "text": "เราจะเตรียมชุดและแจ้งเมื่อจัดส่งนะคะ", "size": "sm", "color": "#1A1A1A", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูออเดอร์ของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "กำหนดรับ–คืนชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&order={{ORDER_ID}}" } }
  ]}
}
```

## 3. `slip_rejected` — สลิปไม่ผ่าน/ยอดไม่ตรง (ผล `slip_invalid` / `amount_low`)

altText: `สลิปยังไม่ผ่านการตรวจ · ออเดอร์ {{ORDER_CODE}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "สลิปยังไม่ผ่านการตรวจ", "size": "xs", "color": "#C0564A", "weight": "bold" },
    { "type": "text", "text": "{{REASON}}", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "ออเดอร์ {{ORDER_CODE}} · คิวจะถูกถือไว้ถึง {{HOLD_UNTIL}}", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ส่งสลิปใหม่ / ชำระอีกครั้ง", "uri": "https://liff.line.me/{{LIFF_ID}}/pay.html?order={{ORDER_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "คุยกับแอดมิน", "uri": "{{OA_CHAT_URL}}" } }
  ]}
}
```

## 4. `order_shipped` — จัดส่งชุดแล้ว (หลังออปส์พิมพ์ใบปะหน้าใน `shipout.html`)

altText: `ชุดของคุณออกเดินทางแล้ว 🚚 · {{TRACKING_NO}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "จัดส่งแล้ว 🚚", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true, "margin": "md" },
    { "type": "text", "text": "{{CARRIER}} · เลขพัสดุ {{TRACKING_NO}}", "size": "sm", "color": "#8C8B86" },
    { "type": "text", "text": "ถึงโดยประมาณ {{ETA_DATE}} · ในกล่องมีถุงส่งคืน+ใบปะหน้าขากลับให้แล้วค่ะ", "size": "sm", "color": "#1A1A1A", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ติดตามพัสดุ", "uri": "{{TRACKING_URL}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "วิธีคืนชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/rental-terms.html#return" } }
  ]}
}
```

## 5. `return_reminder` — เตือนคืนชุดพรุ่งนี้ (cron ก่อนวันคืน 1 วัน)

altText: `พรุ่งนี้วันคืนชุดแล้วนะคะ · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "เตือนคืนชุด ⏰", "size": "xs", "color": "#C0564A", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true, "margin": "md" },
    { "type": "text", "text": "กำหนดคืน {{END_DATE}} — ส่งกลับด้วยถุง+ใบปะหน้าที่แนบไปในกล่องได้เลยค่ะ", "size": "sm", "color": "#1A1A1A", "wrap": true },
    { "type": "text", "text": "ส่งแล้วอย่าลืมกรอกเลขพัสดุใน \"ออเดอร์ของฉัน\" นะคะ · ใส่สนุกอยู่? ต่อวันเช่าได้เลย", "size": "xs", "color": "#8C8B86", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "กรอกเลขพัสดุส่งคืน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&return={{RENTAL_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ต่อวันเช่า", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&extend={{RENTAL_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "วิธีคืนชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/rental-terms.html#return" } }
  ]}
}
```

## 5.1 `return_tracking_received` — รับเลขพัสดุส่งคืนแล้ว (หลังลูกค้ากรอกเลขพัสดุผ่านปุ่ม "แจ้งส่งคืน · กรอกเลขพัสดุ" ใน "ออเดอร์ของฉัน" → RPC `return_tracking_submit`)

altText: `รับเลขพัสดุส่งคืนแล้วค่ะ · {{RETURN_TRACKING_NO}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "รับเลขพัสดุส่งคืนแล้ว ✓", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "{{RETURN_COURIER}} · {{RETURN_TRACKING_NO}}", "size": "sm", "color": "#8C8B86" },
    { "type": "text", "text": "ชุดถึงร้านแล้วเราจะตรวจสภาพและแจ้งผล+คืนมัดจำให้ทาง LINE เลยค่ะ", "size": "sm", "color": "#1A1A1A", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ติดตามพัสดุขากลับ", "uri": "{{RETURN_TRACKING_URL}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ดูออเดอร์ของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me" } }
  ]}
}
```

## 6. `return_received_review` — รับชุดคืน + QC ผ่าน + คืนมัดจำ + ขอรีวิว (หลัง `care_checkin`/`care_qc` ผ่าน)

altText: `รับชุดคืนเรียบร้อย มัดจำกำลังคืนให้ค่ะ 💚`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "รับชุดคืนแล้ว · สภาพผ่าน ✓", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "ขอบคุณที่ดูแลชุดอย่างดีค่ะ", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "มัดจำ {{DEPOSIT}} บาท คืนภายใน {{REFUND_DAYS}} วันทำการ", "size": "sm", "color": "#1A1A1A", "wrap": true },
    { "type": "text", "text": "เล่าหน่อยว่าชุดเป็นยังไง — รีวิวของคุณช่วยเพื่อนเลือกไซส์ได้เยอะเลย", "size": "xs", "color": "#8C8B86", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "เขียนรีวิว (รับเครดิต)", "uri": "https://liff.line.me/{{LIFF_ID}}/review.html?rental={{RENTAL_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "หาชุดงานถัดไป", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html" } }
  ]}
}
```

## 7. `qc_fee_notice` — พบตำหนิ/ของขาด มีค่าดูแลเพิ่ม (หลัง `care_qc` แบบ damage/missing)

altText: `แจ้งผลตรวจสภาพชุด · มีค่าดูแลเพิ่ม {{FEE}} บาท`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "ผลตรวจสภาพชุด", "size": "xs", "color": "#C0564A", "weight": "bold" },
    { "type": "text", "text": "{{ISSUE_SUMMARY}}", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "{{GARMENT_NAME}} · ค่าดูแลเพิ่ม {{FEE}} บาท (หักจากมัดจำ {{DEPOSIT}} บาท)", "size": "sm", "color": "#1A1A1A", "wrap": true },
    { "type": "text", "text": "เราแนบรูปหลักฐานให้ตรวจสอบได้ทุกจุด — สงสัยตรงไหนทักได้เลยนะคะ", "size": "xs", "color": "#8C8B86", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูรูปหลักฐาน", "uri": "{{EVIDENCE_URL}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "คุยกับแอดมิน", "uri": "{{OA_CHAT_URL}}" } }
  ]}
}
```

## 8. `wishlist_available` — ชุดที่ขอไว้เข้าคลังแล้ว (ปุ่ม "แจ้งลูกค้า" ใน `requests.html` → RPC `notify_customer_wishlist`)

altText: `ชุดที่คุณขอไว้มาแล้วค่ะ! · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{PHOTO_URL}}", "size": "full", "aspectRatio": "3:4", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ชุดที่คุณขอไว้ มาแล้วค่ะ! ✨", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "{{BRAND}} · ไซส์ {{SIZE}} · เช่า {{PRICE}} บาท", "size": "sm", "color": "#8C8B86" },
    { "type": "text", "text": "จองก่อนใครภายใน {{HOLD_HOURS}} ชม. — เราถือคิวให้คุณเป็นคนแรกค่ะ", "size": "xs", "color": "#C0564A", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "จองเลย", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{GARMENT_CODE}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ดูรายละเอียดชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{GARMENT_CODE}}&view=detail" } }
  ]}
}
```

## 9. `waitlist_date_open` — วันที่ต่อคิวไว้ว่างแล้ว (ตามคำสัญญาใน `app.js:1251` "พอวันนี้ว่างเราแจ้งให้เลือกก่อนใคร")

altText: `วันที่คุณรอ ว่างแล้วค่ะ · {{GARMENT_NAME}} {{DATE}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "คิวของคุณมาถึงแล้ว 🔔", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true, "margin": "md" },
    { "type": "text", "text": "วันที่ {{DATE}} ว่างแล้ว — คุณคือคิวแรก เลือกก่อนใครได้ {{HOLD_HOURS}} ชม.", "size": "sm", "color": "#1A1A1A", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "จองวันนี้เลย", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{GARMENT_CODE}}&date={{DATE}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ออกจากคิว", "uri": "https://liff.line.me/{{LIFF_ID}}/wishlist.html?leave={{QUEUE_ID}}" } }
  ]}
}
```

## 10. `look_approved` — ลุคที่แชร์ผ่านการอนุมัติ (ตามคำสัญญาใน `looks.html:695` "ผ่านแล้วจะขึ้นฟีดและแจ้งใน LINE")

altText: `ลุคของคุณขึ้นฟีดแล้วค่ะ 🎉`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{LOOK_PHOTO_URL}}", "size": "full", "aspectRatio": "3:4", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ลุคของคุณขึ้นฟีดแล้ว 🎉", "weight": "bold", "size": "lg", "wrap": true },
    { "type": "text", "text": "เพื่อน ๆ ในคอมมูนิตี้เห็นลุคนี้แล้ว — แชร์ต่อให้เพื่อนดูได้เลยค่ะ", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูลุคของฉันในฟีด", "uri": "https://liff.line.me/{{LIFF_ID}}/looks.html?look={{LOOK_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "แชร์ให้เพื่อน", "uri": "https://liff.line.me/{{LIFF_ID}}/looks.html?look={{LOOK_ID}}&share=1" } }
  ]}
}
```

## 11. `repair_quote` — แจ้งผลประเมินซ่อม/ค่าซ่อม (จาก `repair.html` — ปัจจุบันแจ้งแค่เจ้าของ ไม่แจ้งลูกค้า)

altText: `ผลประเมินการซ่อม · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "ผลประเมินการซ่อม", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "{{ASSESSMENT}} · ค่าซ่อม {{COST}} บาท · ใช้เวลา {{DAYS}} วัน", "size": "sm", "color": "#1A1A1A", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ยืนยันให้ซ่อมเลย", "uri": "https://liff.line.me/{{LIFF_ID}}/repair.html?job={{JOB_ID}}&approve=1" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "คุยกับแอดมินก่อน", "uri": "{{OA_CHAT_URL}}" } }
  ]}
}
```

## 12. `group_pay_nudge` — เตือนสมาชิกกลุ่มจ่ายส่วนของตัวเอง (group/event split-pay — `event.html` สัญญาว่า "ระบบเตือนให้อัตโนมัติ")

altText: `เตือนชำระส่วนของคุณ · กลุ่ม {{GROUP_NAME}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "กลุ่ม {{GROUP_NAME}} รอคุณอยู่นะคะ 💛", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "ส่วนของคุณ {{AMOUNT}} บาท", "weight": "bold", "size": "xl", "margin": "md" },
    { "type": "text", "text": "{{PAID_COUNT}}/{{TOTAL_COUNT}} คนจ่ายแล้ว · ครบทุกคนภายใน {{DEADLINE}} คิวชุดถึงจะล็อกค่ะ", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "จ่ายส่วนของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/pay.html?group={{GROUP_ORDER_ID}}&member={{MEMBER_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ดูสถานะกลุ่ม", "uri": "https://liff.line.me/{{LIFF_ID}}/event.html?order={{GROUP_ORDER_ID}}" } }
  ]}
}
```

## 13. `contract_copy` — สำเนาสัญญา (พาร์ทเนอร์ลงนามแล้ว — `contract.html:171` สัญญาว่า "สำเนาสัญญาจะส่งให้คุณทาง LINE")

altText: `สำเนาสัญญาของคุณ · {{CONTRACT_NO}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "ลงนามสัญญาเรียบร้อย ✓", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "สัญญาเลขที่ {{CONTRACT_NO}}", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "ลงนามเมื่อ {{SIGNED_AT}} · เก็บสำเนานี้ไว้อ้างอิงได้เลยค่ะ", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "เปิดดูสัญญา", "uri": "https://liff.line.me/{{LIFF_ID}}/contract.html?token={{CONTRACT_TOKEN}}" } }
  ]}
}
```

---

## หมายเหตุการต่อระบบ

1. **จุดยิงที่แนะนำ:** DB trigger (pg_net) หรือ Edge Function หลัง RPC สำเร็จ — ตาราง/ฟังก์ชันที่เกี่ยว: `book_with_backups`, `book_cart`, `care_qc`, `care_checkin`, `mark_garment_ready`, `notify_customer_wishlist`, `contract_sign`, `group_pay_confirm`, `return_tracking_submit`
   - **RPC ใหม่ที่ backend ต้องสร้าง:** `return_tracking_submit(p_rental, p_courier, p_tracking_no)` — frontend เรียกผ่าน me-rpc gateway แล้ว (ปุ่ม "แจ้งส่งคืน · กรอกเลขพัสดุ" ใน "ออเดอร์ของฉัน") ให้บันทึกเป็น timeline event `return_shipped` (มี enum นี้อยู่แล้วใน `garment_timeline`) แล้วยิงเทมเพลต 5.1 กลับหาลูกค้า และ `my_rentals` ต้องส่งฟิลด์ `return_courier`, `return_tracking_no` เพิ่ม
2. `webhooks.js` ในรีโปนี้เป็น stub n8n ที่**ไม่มีใครเรียกใช้** และ `N8N_BASE_URL` ยังว่าง — ถ้าจะใช้เส้นทาง n8n ต้องใส่ URL ใน `config.js` และเรียก `webhooks.orderConfirmed(...)` ฯลฯ จาก handler จริง (แต่แนะนำยิงจาก backend มากกว่า เพราะ frontend เชื่อถือไม่ได้/ปิดหน้าก่อนได้)
3. ทุกเทมเพลตควร insert ลง notification inbox ในแอปด้วย (kinds ที่มีอยู่แล้ว: `wishlist_available`, `new_arrival`, `review_request`, `late` ฯลฯ) เพื่อให้กระดิ่งในแอปตรงกับ LINE
