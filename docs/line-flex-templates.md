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

# ภาค 2 — เติมให้ครบทั้ง customer journey

เทมเพลต 14–27: ปิดช่องที่เหลือของวงจรลูกค้า (ต้อนรับ → จ่าย → ใช้ → คืน → กลับมาใหม่)

## 14. `welcome_kyc_approved` — ยืนยันตัวตนผ่านแล้ว (หลัง KYC อนุมัติ)

altText: `ยืนยันตัวตนผ่านแล้ว เช่าได้เลยค่ะ 🎉`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "ยืนยันตัวตนผ่านแล้ว ✓", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "ยินดีต้อนรับสู่ LLOOP ค่ะ {{FIRST_NAME}}", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "เช่าได้ทุกชุดในร้านทันที — ลองทำควิซสไตล์ให้เราแนะนำชุดที่ใช่ก่อนก็ได้นะคะ", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "เริ่มเลือกชุดเลย", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ทำควิซสไตล์ (2 นาที)", "uri": "https://liff.line.me/{{LIFF_ID}}/quiz.html" } }
  ]}
}
```

## 15. `pay_deadline_reminder` — ใกล้หมดเวลาถือคิว (ออเดอร์ hold ยังไม่จ่าย)

altText: `อีก {{HOURS_LEFT}} ชม. คิวชุดจะหลุดนะคะ · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "คิวของคุณใกล้หมดเวลา ⏳", "size": "xs", "color": "#C0564A", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true, "margin": "md" },
    { "type": "text", "text": "ถือคิวให้ถึง {{HOLD_UNTIL}} (อีก {{HOURS_LEFT}} ชม.) — ยอด {{AMOUNT}} บาท", "size": "sm", "color": "#1A1A1A", "wrap": true },
    { "type": "text", "text": "เลยเวลาแล้วคิวจะเปิดให้คนถัดไปนะคะ", "size": "xs", "color": "#8C8B86", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ชำระเงินตอนนี้", "uri": "https://liff.line.me/{{LIFF_ID}}/pay.html?order={{ORDER_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ยกเลิกการจอง", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me" } }
  ]}
}
```

## 16. `booking_changed` — ยืนยันยกเลิก / เลื่อนวัน / ต่อเวลา (หลัง `cancel_rental` / `reschedule_rental` / `extend_rental`)

altText: `{{CHANGE_TITLE}} เรียบร้อยค่ะ · {{GARMENT_NAME}}`
(`{{CHANGE_TITLE}}` = "ยกเลิกการเช่า" / "เลื่อนวันเช่า" / "ต่อวันเช่า")

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "{{CHANGE_TITLE}} สำเร็จ ✓", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "{{CHANGE_DETAIL}}", "size": "sm", "color": "#1A1A1A", "wrap": true },
    { "type": "text", "text": "{{REFUND_LINE}}", "size": "xs", "color": "#8C8B86", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูออเดอร์ของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me" } }
  ]}
}
```
`{{CHANGE_DETAIL}}` เช่น "วันใช้ใหม่ 14 ก.พ. · คืน 16 ก.พ." · `{{REFUND_LINE}}` เช่น "คืนค่าเช่า ฿430 เป็นเครดิตแล้วค่ะ" (เว้นว่างได้)

## 17. `spare_swap_notice` — ชุดหลักไม่พร้อม สลับชุดสำรองให้ (จุดขายของระบบ backup — ลูกค้าต้องรู้ก่อนวันงาน)

altText: `เราสลับชุดสำรองให้แล้วค่ะ · {{SPARE_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{SPARE_PHOTO_URL}}", "size": "full", "aspectRatio": "3:4", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "สลับเป็นชุดสำรองให้แล้วค่ะ", "size": "xs", "color": "#C0564A", "weight": "bold" },
    { "type": "text", "text": "{{SPARE_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "ชุดหลัก ({{PRIMARY_NAME}}) {{REASON}} — เราสลับตัวสำรองที่คุณเลือกไว้ให้ทันที ไม่มีค่าใช้จ่ายเพิ่ม ส่งตามกำหนดเดิมค่ะ", "size": "sm", "color": "#1A1A1A", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูชุดที่จะได้รับ", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{SPARE_CODE}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "คุยกับแอดมิน", "uri": "{{OA_CHAT_URL}}" } }
  ]}
}
```

## 18. `overdue_notice` — เลยกำหนดคืน (inbox kind `late` มีอยู่แล้ว — ส่งวันที่ +1, +3 หลังครบกำหนด)

altText: `เลยกำหนดคืนชุดแล้วนะคะ · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "เลยกำหนดคืนแล้ว {{DAYS_LATE}} วัน", "size": "xs", "color": "#C0564A", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true, "margin": "md" },
    { "type": "text", "text": "กำหนดคืน {{END_DATE}} · ค่าปรับล่าช้า {{LATE_FEE_PER_DAY}} บาท/วัน (ตอนนี้ {{LATE_FEE_TOTAL}} บาท)", "size": "sm", "color": "#1A1A1A", "wrap": true },
    { "type": "text", "text": "ส่งแล้วแค่กรอกเลขพัสดุ ค่าปรับหยุดนับทันทีค่ะ · ติดขัดอะไรทักมาคุยได้เลยนะคะ", "size": "xs", "color": "#8C8B86", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "กรอกเลขพัสดุส่งคืน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&return={{RENTAL_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ต่อวันเช่าแทน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&extend={{RENTAL_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "คุยกับแอดมิน", "uri": "{{OA_CHAT_URL}}" } }
  ]}
}
```

## 19. `deposit_refunded` — คืนมัดจำ/เงินคืนโอนแล้วจริง (ปิดจบเรื่องเงิน — ใบ #6 บอกว่า "กำลังคืน" ใบนี้ยืนยันว่า "คืนแล้ว")

altText: `คืนมัดจำ {{AMOUNT}} บาทเรียบร้อยค่ะ ✓`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "คืนเงินเรียบร้อย ✓", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{AMOUNT}} บาท", "weight": "bold", "size": "xl", "margin": "md" },
    { "type": "text", "text": "{{REFUND_KIND}} · {{METHOD}} · {{REFUNDED_AT}}", "size": "sm", "color": "#8C8B86", "wrap": true },
    { "type": "text", "text": "ขอบคุณที่เช่ากับ LLOOP นะคะ แล้วพบกันลุคหน้าค่ะ 💚", "size": "sm", "color": "#1A1A1A", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูชุดใหม่เข้าร้าน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?sort=new" } }
  ]}
}
```
`{{REFUND_KIND}}` = "มัดจำ" / "ค่าเช่า (ยกเลิก)" · `{{METHOD}}` = "โอนคืนบัญชีเดิม" / "เครดิต LLOOP"

## 20. `new_arrival` — ชุดใหม่เข้าตรงสไตล์คุณ (ยิงจาก `mark_garment_ready` — จับคู่ตามสี/ไซส์/ควิซ)

altText: `ชุดใหม่เข้าร้าน ตรงสไตล์คุณเลยค่ะ · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{PHOTO_URL}}", "size": "full", "aspectRatio": "3:4", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "เข้าใหม่ · ตรงสไตล์ที่คุณชอบ", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "{{BRAND}} · ไซส์ {{SIZE}} · เช่า {{PRICE}} บาท · มูลค่าชุด {{RETAIL}} บาท", "size": "sm", "color": "#8C8B86", "wrap": true },
    { "type": "text", "text": "{{MATCH_REASON}}", "size": "xs", "color": "#8C8B86", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูชุดนี้", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{GARMENT_CODE}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ดูของเข้าใหม่ทั้งหมด", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?sort=new" } }
  ]}
}
```
`{{MATCH_REASON}}` เช่น "โทน autumn เหมือนผลวิเคราะห์สีของคุณ" — ใส่เหตุผลให้รู้ว่าไม่ใช่สแปม · ส่งเป็น carousel ได้ (หลาย bubble ในข้อความเดียว สูงสุด 12 ใบ)

## 21. `credit_expiring` — เครดิตใกล้หมดอายุ (inbox kind `credit_expiring` มีแล้ว)

altText: `เครดิต {{AMOUNT}} บาทจะหมดอายุ {{EXPIRE_DATE}} นะคะ`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "เครดิตใกล้หมดอายุ", "size": "xs", "color": "#C0564A", "weight": "bold" },
    { "type": "text", "text": "฿{{AMOUNT}}", "weight": "bold", "size": "xl", "margin": "md" },
    { "type": "text", "text": "ใช้ได้ถึง {{EXPIRE_DATE}} — เอาไปหักค่าเช่าชุดไหนก็ได้เลยค่ะ", "size": "sm", "color": "#1A1A1A", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ใช้เครดิตเลือกชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html" } }
  ]}
}
```

## 22. `birthday_free_rental` — สิทธิ์เช่าฟรีวันเกิด (มี flow `birthday_reserve` ในแอปแล้ว — ใบนี้คือตัวพาเข้า)

altText: `สุขสันต์วันเกิดค่ะ 🎂 รับสิทธิ์เช่าฟรี 1 ชุด`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "สุขสันต์วันเกิดค่ะ 🎂", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "เช่าฟรี 1 ชุด เดือนเกิดนี้", "weight": "bold", "size": "xl", "wrap": true, "margin": "md" },
    { "type": "text", "text": "เลือกชุดได้ถึง {{BUDGET}} บาท ใช้สิทธิ์ได้ถึง {{VALID_UNTIL}} — ให้ลุควันเกิดปีนี้เป็นหน้าที่เรานะคะ", "size": "sm", "color": "#1A1A1A", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ใช้สิทธิ์วันเกิดเลย", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?birthday=1" } }
  ]}
}
```

## 23. `referral_credit` — ได้เครดิตจากชวนเพื่อน (inbox kind `referral_credit` มีแล้ว)

altText: `เพื่อนของคุณเช่าครั้งแรกแล้ว รับเครดิต {{AMOUNT}} บาทค่ะ 🎁`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "เครดิตชวนเพื่อนเข้าแล้ว 🎁", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "+฿{{AMOUNT}}", "weight": "bold", "size": "xl", "margin": "md" },
    { "type": "text", "text": "{{FRIEND_NAME}} เช่าครั้งแรกสำเร็จ — เครดิตเข้ากระเป๋าคุณแล้ว ชวนต่อได้ไม่จำกัดค่ะ", "size": "sm", "color": "#1A1A1A", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ใช้เครดิตเลือกชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "แชร์โค้ดชวนเพื่อนต่อ", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&referral=1" } }
  ]}
}
```

## 24. `style_ready` — ผลวิเคราะห์สี/สไตล์เสร็จแล้ว (inbox kind `style_ready` มีแล้ว — จาก Personal Color)

altText: `ผลวิเคราะห์สีของคุณเสร็จแล้วค่ะ ✨ คุณคือโทน {{SEASON}}`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "ผลวิเคราะห์เสร็จแล้ว ✨", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "คุณคือโทน {{SEASON}}", "weight": "bold", "size": "xl", "wrap": true, "margin": "md" },
    { "type": "text", "text": "เราคัดชุดที่ตรงโทนสีของคุณไว้ให้แล้ว — เปิดดูผลเต็ม พร้อมพาเลตต์สีที่ใช่ได้เลยค่ะ", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูผลวิเคราะห์ของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?style=result" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ดูชุดตรงโทนของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?season={{SEASON_KEY}}" } }
  ]}
}
```

## 25. `stylist_appointment` — ยืนยัน/เตือนนัดสไตลิสต์ (หลัง `pc_book_slot` + เตือนก่อนนัด 1 วัน)

altText: `{{KIND}}นัดสไตลิสต์ · {{APPT_DATE}} {{APPT_TIME}}` (`{{KIND}}` = "ยืนยัน" / "พรุ่งนี้")

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "{{KIND}}นัดสไตลิสต์ ✓", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{STYLIST_NAME}}", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "{{APPT_DATE}} · {{APPT_TIME}} · {{MODE}}", "size": "sm", "color": "#1A1A1A" },
    { "type": "text", "text": "{{LOCATION_OR_LINK_NOTE}}", "size": "xs", "color": "#8C8B86", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูนัดของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&appt={{APPT_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "เลื่อน / ยกเลิกนัด", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&appt={{APPT_ID}}&manage=1" } }
  ]}
}
```

## 26. `group_invite_accepted` — เพื่อนตอบรับเข้ากลุ่มแล้ว (ปิดคำสัญญาใน `family.html:827` — แจ้งหัวหน้ากลุ่ม)

altText: `{{FRIEND_NAME}} เข้ากลุ่ม {{GROUP_NAME}} แล้วค่ะ 🎉`

```json
{
  "type": "bubble",
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "LLOOP", "weight": "bold", "size": "lg", "color": "#1A1A1A" },
    { "type": "text", "text": "สมาชิกใหม่เข้ากลุ่ม 🎉", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{FRIEND_NAME}} ตอบรับแล้ว", "weight": "bold", "size": "lg", "wrap": true, "margin": "md" },
    { "type": "text", "text": "กลุ่ม {{GROUP_NAME}} ตอนนี้มี {{MEMBER_COUNT}} คน — ชวนครบแล้วจัดธีมและจองพร้อมกันได้เลยค่ะ (ยิ่งหลายคน ส่วนลดกลุ่มยิ่งเพิ่ม)", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "จัดธีมกลุ่มเลย", "uri": "https://liff.line.me/{{LIFF_ID}}/family.html?group={{GROUP_ID}}" } }
  ]}
}
```

## 27. `abandon_checkout` — ตะกร้าค้าง/จองไม่จบ (inbox kind `abandon_checkout` มีแล้ว — ส่งหลังทิ้งตะกร้า ~3 ชม.)

altText: `ชุดในตะกร้ายังรออยู่นะคะ · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{PHOTO_URL}}", "size": "full", "aspectRatio": "3:4", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ยังเก็บไว้ให้อยู่นะคะ", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "วันที่ {{DATE_RANGE}} ยังว่างอยู่ — แต่ชุดยอดนิยมมักถูกจองไวค่ะ", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "จองต่อให้จบเลย", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{GARMENT_CODE}}&resume=1" } }
  ]}
}
```
> kinds ที่เหลือ (`reengagement`, `winback`, `event_suggest`, `charity_update`) เป็นแคมเปญการตลาด — ใช้โครงเดียวกับ #20/#27 เปลี่ยนข้อความได้เลย ไม่ต้องมีเทมเพลตแยก

---

## หมายเหตุการต่อระบบ

1. **จุดยิงที่แนะนำ:** DB trigger (pg_net) หรือ Edge Function หลัง RPC สำเร็จ — ตาราง/ฟังก์ชันที่เกี่ยว: `book_with_backups`, `book_cart`, `care_qc`, `care_checkin`, `mark_garment_ready`, `notify_customer_wishlist`, `contract_sign`, `group_pay_confirm`, `return_tracking_submit`
   - **RPC ใหม่ที่ backend ต้องสร้าง:** `return_tracking_submit(p_rental, p_courier, p_tracking_no)` — frontend เรียกผ่าน me-rpc gateway แล้ว (ปุ่ม "แจ้งส่งคืน · กรอกเลขพัสดุ" ใน "ออเดอร์ของฉัน") ให้บันทึกเป็น timeline event `return_shipped` (มี enum นี้อยู่แล้วใน `garment_timeline`) แล้วยิงเทมเพลต 5.1 กลับหาลูกค้า และ `my_rentals` ต้องส่งฟิลด์ `return_courier`, `return_tracking_no` เพิ่ม
2. `webhooks.js` ในรีโปนี้เป็น stub n8n ที่**ไม่มีใครเรียกใช้** และ `N8N_BASE_URL` ยังว่าง — ถ้าจะใช้เส้นทาง n8n ต้องใส่ URL ใน `config.js` และเรียก `webhooks.orderConfirmed(...)` ฯลฯ จาก handler จริง (แต่แนะนำยิงจาก backend มากกว่า เพราะ frontend เชื่อถือไม่ได้/ปิดหน้าก่อนได้)
3. ทุกเทมเพลตควร insert ลง notification inbox ในแอปด้วย (kinds ที่มีอยู่แล้ว: `wishlist_available`, `new_arrival`, `review_request`, `late` ฯลฯ) เพื่อให้กระดิ่งในแอปตรงกับ LINE
