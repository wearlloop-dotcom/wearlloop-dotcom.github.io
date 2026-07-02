# LLOOP — LINE Flex Message Templates (ฉบับรีดีไซน์: ภาพนำ · ข้อความน้อย · ไม่มี emoji)

เทมเพลตพร้อมใช้ฝั่ง backend (Supabase Edge Function / DB trigger ผ่าน pg_net / n8n)
ยิงผ่าน `POST https://api.line.me/v2/bot/message/push`

```json
{ "to": "{{LINE_UID}}", "messages": [ { "type": "flex", "altText": "<altText>", "contents": <bubble> } ] }
```

## หลักการดีไซน์ (ทุกใบ)

- **ภาพนำเสมอ** — ใบที่ผูกกับชุดใช้**รูปชุดจริงจากเว็บ** (`{{PHOTO_URL}}` — รูปเดียวกับการ์ดหน้าร้าน) · ใบสถานะระบบใช้ **line art** โทนแบรนด์ที่โฮสต์ในเว็บ: `https://wearlloop-dotcom.github.io/line-flex/<ชื่อ>.png` (มี 20 ภาพในโฟลเดอร์ `line-flex/`)
- **ตัวอักษรน้อย**: kicker 2–4 คำ (สี sage) → บรรทัดหลักตัวใหญ่ 1 บรรทัด → ข้อมูลย่อ 1 บรรทัด จบ
- **ไม่มี emoji** ทุกใบ
- **ปุ่ม**: หลัก 1 ปุ่ม (primary `#6FB3A6`) + รองไม่เกิน 2 (link) — ทุกลิงก์เป็น LIFF permanent link `https://liff.line.me/{{LIFF_ID}}/...` (LIFF_ID: `2010486714-1g6lDuHo`) · `{{OA_CHAT_URL}}` = แชท LINE OA
- โทนสี: sage `#6FB3A6` · ink `#1A1A1A` · muted `#8C8B86` · เตือน `#A75F3A` (clay ตามเว็บ)

โครง hero ที่ใช้ซ้ำ:
- line art → `{ "type":"image", "url":"https://wearlloop-dotcom.github.io/line-flex/<ชื่อ>.png", "size":"full", "aspectRatio":"2:1", "aspectMode":"cover" }`
- รูปชุดจากเว็บ → เหมือนกันแต่ `"url":"{{PHOTO_URL}}"`, `"aspectRatio":"3:4"` (การ์ดชุด) หรือ `"4:3"` (ยืนยัน action)

---

## 1. `booking_confirmed` — รับคำจองแล้ว · hero = รูปชุดจากเว็บ

altText: `รับคำจองแล้ว · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{PHOTO_URL}}", "size": "full", "aspectRatio": "4:3", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "รับคำจองแล้ว", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "รับ {{START_DATE}} · คืน {{END_DATE}}", "size": "sm", "color": "#8C8B86" },
    { "type": "box", "layout": "baseline", "margin": "md", "contents": [
      { "type": "text", "text": "ชำระภายใน {{PAY_DEADLINE}}", "size": "xs", "color": "#A75F3A", "flex": 0 },
      { "type": "text", "text": "฿{{AMOUNT}}", "size": "lg", "weight": "bold", "align": "end" }
    ]}
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ชำระเงิน", "uri": "https://liff.line.me/{{LIFF_ID}}/pay.html?order={{ORDER_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ออเดอร์ของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me" } }
  ]}
}
```

## 2. `payment_confirmed` — ชำระเงินสำเร็จ · hero = `payment-ok.png`

altText: `ชำระเงินสำเร็จ · ออเดอร์ {{ORDER_CODE}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/payment-ok.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ชำระเงินสำเร็จ", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "฿{{AMOUNT}}", "weight": "bold", "size": "xxl" },
    { "type": "text", "text": "ออเดอร์ {{ORDER_CODE}} · {{PAID_AT}}", "size": "sm", "color": "#8C8B86" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูออเดอร์ของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me" } }
  ]}
}
```

## 3. `slip_rejected` — สลิปไม่ผ่าน · hero = `slip-x.png`

altText: `สลิปยังไม่ผ่าน · ออเดอร์ {{ORDER_CODE}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/slip-x.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "สลิปยังไม่ผ่าน", "size": "xs", "color": "#A75F3A", "weight": "bold" },
    { "type": "text", "text": "{{REASON}}", "weight": "bold", "size": "lg", "wrap": true },
    { "type": "text", "text": "ถือคิวให้ถึง {{HOLD_UNTIL}}", "size": "sm", "color": "#8C8B86" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ส่งสลิปใหม่", "uri": "https://liff.line.me/{{LIFF_ID}}/pay.html?order={{ORDER_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "คุยกับแอดมิน", "uri": "{{OA_CHAT_URL}}" } }
  ]}
}
```

## 4. `order_shipped` — จัดส่งแล้ว · hero = `shipped.png`

altText: `จัดส่งแล้ว · {{TRACKING_NO}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/shipped.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "จัดส่งแล้ว", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "{{CARRIER}} · {{TRACKING_NO}} · ถึงราว {{ETA_DATE}}", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ติดตามพัสดุ", "uri": "{{TRACKING_URL}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "วิธีคืนชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/rental-terms.html#return" } }
  ]}
}
```

## 5. `return_reminder` — พรุ่งนี้กำหนดคืน · hero = `return.png`

altText: `พรุ่งนี้กำหนดคืน · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/return.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "พรุ่งนี้กำหนดคืน", "size": "xs", "color": "#A75F3A", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "ใช้ถุง + ใบปะหน้าในกล่อง แล้วกรอกเลขพัสดุ", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "กรอกเลขพัสดุส่งคืน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&return={{RENTAL_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ต่อวันเช่า", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&extend={{RENTAL_ID}}" } }
  ]}
}
```

## 5.1 `return_tracking_received` — รับเลขพัสดุส่งคืนแล้ว · hero = `return-received.png` (หลัง RPC `return_tracking_submit`)

altText: `รับเลขพัสดุแล้ว · {{RETURN_TRACKING_NO}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/return-received.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "รับเลขพัสดุแล้ว", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{RETURN_COURIER}} · {{RETURN_TRACKING_NO}}", "weight": "bold", "size": "lg", "wrap": true },
    { "type": "text", "text": "ถึงร้านแล้วแจ้งผลตรวจ + คืนมัดจำทาง LINE", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ติดตามพัสดุขากลับ", "uri": "{{RETURN_TRACKING_URL}}" } }
  ]}
}
```

## 6. `return_received_review` — คืนสำเร็จ ขอรีวิว · hero = `qc-pass.png`

altText: `รับชุดคืนแล้ว สภาพผ่าน`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/qc-pass.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "รับคืนแล้ว · สภาพผ่าน", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "มัดจำ ฿{{DEPOSIT}} คืนภายใน {{REFUND_DAYS}} วัน", "weight": "bold", "size": "lg", "wrap": true },
    { "type": "text", "text": "รีวิวสั้น ๆ ช่วยเพื่อนเลือกไซส์ได้มาก", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "เขียนรีวิว รับเครดิต", "uri": "https://liff.line.me/{{LIFF_ID}}/review.html?rental={{RENTAL_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "หาชุดงานถัดไป", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html" } }
  ]}
}
```

## 7. `qc_fee_notice` — พบตำหนิ มีค่าดูแลเพิ่ม · hero = `qc-fee.png`

altText: `ผลตรวจสภาพ · ค่าดูแลเพิ่ม ฿{{FEE}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/qc-fee.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ผลตรวจสภาพชุด", "size": "xs", "color": "#A75F3A", "weight": "bold" },
    { "type": "text", "text": "{{ISSUE_SUMMARY}}", "weight": "bold", "size": "lg", "wrap": true },
    { "type": "box", "layout": "baseline", "margin": "md", "contents": [
      { "type": "text", "text": "หักจากมัดจำ ฿{{DEPOSIT}}", "size": "xs", "color": "#8C8B86", "flex": 0 },
      { "type": "text", "text": "฿{{FEE}}", "size": "lg", "weight": "bold", "align": "end", "color": "#A75F3A" }
    ]}
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูรูปหลักฐาน", "uri": "{{EVIDENCE_URL}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "คุยกับแอดมิน", "uri": "{{OA_CHAT_URL}}" } }
  ]}
}
```

## 8. `wishlist_available` — ชุดที่ขอไว้เข้าแล้ว · hero = รูปชุดจากเว็บ (3:4)

altText: `ชุดที่คุณขอไว้มาแล้ว · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{PHOTO_URL}}", "size": "full", "aspectRatio": "3:4", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ชุดที่คุณขอไว้ มาแล้ว", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "{{BRAND}} · ไซส์ {{SIZE}} · ฿{{PRICE}}", "size": "sm", "color": "#8C8B86" },
    { "type": "text", "text": "ถือคิวให้คุณก่อนใคร {{HOLD_HOURS}} ชม.", "size": "xs", "color": "#A75F3A", "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "จองเลย", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{GARMENT_CODE}}" } }
  ]}
}
```

## 9. `waitlist_date_open` — คิวของคุณว่างแล้ว · hero = รูปชุดจากเว็บ (ไม่มีรูปใช้ `queue.png`)

altText: `วันที่คุณรอ ว่างแล้ว · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{PHOTO_URL}}", "size": "full", "aspectRatio": "4:3", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "คิวของคุณมาถึงแล้ว", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "วันที่ {{DATE}} ว่างแล้ว · เลือกก่อนใคร {{HOLD_HOURS}} ชม.", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "จองวันนี้เลย", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{GARMENT_CODE}}&date={{DATE}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ออกจากคิว", "uri": "https://liff.line.me/{{LIFF_ID}}/wishlist.html?leave={{QUEUE_ID}}" } }
  ]}
}
```

## 10. `look_approved` — ลุคขึ้นฟีดแล้ว · hero = รูปลุคของลูกค้า (3:4)

altText: `ลุคของคุณขึ้นฟีดแล้ว`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{LOOK_PHOTO_URL}}", "size": "full", "aspectRatio": "3:4", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "อนุมัติแล้ว", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "ลุคของคุณขึ้นฟีดแล้ว", "weight": "bold", "size": "lg", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูในฟีด", "uri": "https://liff.line.me/{{LIFF_ID}}/looks.html?look={{LOOK_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "แชร์ให้เพื่อน", "uri": "https://liff.line.me/{{LIFF_ID}}/looks.html?look={{LOOK_ID}}&share=1" } }
  ]}
}
```

## 11. `repair_quote` — ผลประเมินซ่อม · hero = `repair.png`

altText: `ผลประเมินซ่อม · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/repair.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ผลประเมินซ่อม", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "lg", "wrap": true },
    { "type": "text", "text": "{{ASSESSMENT}} · ฿{{COST}} · {{DAYS}} วัน", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ยืนยันให้ซ่อม", "uri": "https://liff.line.me/{{LIFF_ID}}/repair.html?job={{JOB_ID}}&approve=1" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "คุยกับแอดมินก่อน", "uri": "{{OA_CHAT_URL}}" } }
  ]}
}
```

## 12. `group_pay_nudge` — กลุ่มรอคุณจ่าย · hero = `group.png`

altText: `กลุ่ม {{GROUP_NAME}} รอคุณอยู่ · ฿{{AMOUNT}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/group.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "กลุ่ม {{GROUP_NAME}} รอคุณอยู่", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "฿{{AMOUNT}}", "weight": "bold", "size": "xxl" },
    { "type": "text", "text": "จ่ายแล้ว {{PAID_COUNT}}/{{TOTAL_COUNT}} คน · ครบภายใน {{DEADLINE}}", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "จ่ายส่วนของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/pay.html?group={{GROUP_ORDER_ID}}&member={{MEMBER_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "สถานะกลุ่ม", "uri": "https://liff.line.me/{{LIFF_ID}}/event.html?order={{GROUP_ORDER_ID}}" } }
  ]}
}
```

## 13. `contract_copy` — สำเนาสัญญา · hero = `contract.png`

altText: `สำเนาสัญญา {{CONTRACT_NO}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/contract.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ลงนามเรียบร้อย", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "สัญญา {{CONTRACT_NO}}", "weight": "bold", "size": "lg", "wrap": true },
    { "type": "text", "text": "{{SIGNED_AT}}", "size": "sm", "color": "#8C8B86" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "เปิดดูสัญญา", "uri": "https://liff.line.me/{{LIFF_ID}}/contract.html?token={{CONTRACT_TOKEN}}" } }
  ]}
}
```

## 14. `welcome_kyc_approved` — ยืนยันตัวตนผ่าน · hero = `welcome.png`

altText: `ยืนยันตัวตนผ่านแล้ว เช่าได้เลย`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/welcome.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ยืนยันตัวตนผ่านแล้ว", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "ยินดีต้อนรับ {{FIRST_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "เช่าได้ทุกชุดในร้านทันที", "size": "sm", "color": "#8C8B86" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "เริ่มเลือกชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ควิซสไตล์ 2 นาที", "uri": "https://liff.line.me/{{LIFF_ID}}/quiz.html" } }
  ]}
}
```

## 15. `pay_deadline_reminder` — ใกล้หมดเวลาถือคิว · hero = `pay-clock.png`

altText: `อีก {{HOURS_LEFT}} ชม. คิวจะหลุด · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/pay-clock.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "อีก {{HOURS_LEFT}} ชม. คิวจะหลุด", "size": "xs", "color": "#A75F3A", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "ยอด ฿{{AMOUNT}} · ถึง {{HOLD_UNTIL}}", "size": "sm", "color": "#8C8B86" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ชำระเงินตอนนี้", "uri": "https://liff.line.me/{{LIFF_ID}}/pay.html?order={{ORDER_ID}}" } }
  ]}
}
```

## 16. `booking_changed` — ยกเลิก/เลื่อน/ต่อเวลา สำเร็จ · hero = `booking.png`

altText: `{{CHANGE_TITLE}}สำเร็จ · {{GARMENT_NAME}}` (`{{CHANGE_TITLE}}` = ยกเลิก / เลื่อนวัน / ต่อเวลา)

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/booking.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "{{CHANGE_TITLE}}สำเร็จ", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "lg", "wrap": true },
    { "type": "text", "text": "{{CHANGE_DETAIL}}", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูออเดอร์ของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me" } }
  ]}
}
```
`{{CHANGE_DETAIL}}` เช่น "วันใช้ใหม่ 14 ก.พ. · คืนค่าเช่า ฿430 เป็นเครดิต"

## 17. `spare_swap_notice` — สลับชุดสำรองให้แล้ว · hero = รูปชุดสำรองจากเว็บ (3:4)

altText: `สลับชุดสำรองให้แล้ว · {{SPARE_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{SPARE_PHOTO_URL}}", "size": "full", "aspectRatio": "3:4", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "สลับเป็นชุดสำรองให้แล้ว", "size": "xs", "color": "#A75F3A", "weight": "bold" },
    { "type": "text", "text": "{{SPARE_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "ไม่มีค่าใช้จ่ายเพิ่ม · ส่งตามกำหนดเดิม", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูชุดที่จะได้รับ", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{SPARE_CODE}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "คุยกับแอดมิน", "uri": "{{OA_CHAT_URL}}" } }
  ]}
}
```

## 18. `overdue_notice` — เลยกำหนดคืน · hero = `overdue.png`

altText: `เลยกำหนดคืน {{DAYS_LATE}} วัน · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/overdue.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "เลยกำหนดคืน {{DAYS_LATE}} วัน", "size": "xs", "color": "#A75F3A", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "box", "layout": "baseline", "margin": "md", "contents": [
      { "type": "text", "text": "ค่าปรับ ฿{{LATE_FEE_PER_DAY}}/วัน", "size": "xs", "color": "#8C8B86", "flex": 0 },
      { "type": "text", "text": "฿{{LATE_FEE_TOTAL}}", "size": "lg", "weight": "bold", "align": "end", "color": "#A75F3A" }
    ]},
    { "type": "text", "text": "กรอกเลขพัสดุแล้วค่าปรับหยุดนับทันที", "size": "xs", "color": "#8C8B86", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "กรอกเลขพัสดุส่งคืน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&return={{RENTAL_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "คุยกับแอดมิน", "uri": "{{OA_CHAT_URL}}" } }
  ]}
}
```

## 19. `deposit_refunded` — คืนเงินเรียบร้อย · hero = `refund.png`

altText: `คืนเงิน ฿{{AMOUNT}} เรียบร้อย`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/refund.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "คืนเงินเรียบร้อย", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "฿{{AMOUNT}}", "weight": "bold", "size": "xxl" },
    { "type": "text", "text": "{{REFUND_KIND}} · {{METHOD}} · {{REFUNDED_AT}}", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูชุดใหม่เข้าร้าน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?sort=new" } }
  ]}
}
```

## 20. `new_arrival` — ชุดใหม่ตรงสไตล์ · hero = รูปชุดจากเว็บ (3:4) · ส่งเป็น carousel ได้ (สูงสุด 12 bubble)

altText: `เข้าใหม่ ตรงสไตล์คุณ · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{PHOTO_URL}}", "size": "full", "aspectRatio": "3:4", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "เข้าใหม่ · ตรงสไตล์คุณ", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "{{BRAND}} · ไซส์ {{SIZE}} · ฿{{PRICE}}", "size": "sm", "color": "#8C8B86" },
    { "type": "text", "text": "{{MATCH_REASON}}", "size": "xs", "color": "#8C8B86", "wrap": true, "margin": "md" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูชุดนี้", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{GARMENT_CODE}}" } }
  ]}
}
```

## 21. `credit_expiring` — เครดิตใกล้หมดอายุ · hero = `credit.png`

altText: `เครดิต ฿{{AMOUNT}} หมดอายุ {{EXPIRE_DATE}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/credit.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "เครดิตใกล้หมดอายุ", "size": "xs", "color": "#A75F3A", "weight": "bold" },
    { "type": "text", "text": "฿{{AMOUNT}}", "weight": "bold", "size": "xxl" },
    { "type": "text", "text": "ใช้ได้ถึง {{EXPIRE_DATE}}", "size": "sm", "color": "#8C8B86" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ใช้เครดิตเลือกชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html" } }
  ]}
}
```

## 22. `birthday_free_rental` — เช่าฟรีเดือนเกิด · hero = `birthday.png`

altText: `เดือนเกิดนี้ เช่าฟรี 1 ชุด`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/birthday.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "สุขสันต์วันเกิด", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "เช่าฟรี 1 ชุด เดือนเกิดนี้", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "ถึง ฿{{BUDGET}} · ใช้สิทธิ์ได้ถึง {{VALID_UNTIL}}", "size": "sm", "color": "#8C8B86" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ใช้สิทธิ์วันเกิด", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?birthday=1" } }
  ]}
}
```

## 23. `referral_credit` — เครดิตชวนเพื่อนเข้าแล้ว · hero = `credit.png`

altText: `รับเครดิตชวนเพื่อน ฿{{AMOUNT}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/credit.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "เครดิตชวนเพื่อนเข้าแล้ว", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "+฿{{AMOUNT}}", "weight": "bold", "size": "xxl" },
    { "type": "text", "text": "{{FRIEND_NAME}} เช่าครั้งแรกสำเร็จ", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ใช้เครดิตเลือกชุด", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ชวนเพื่อนต่อ", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&referral=1" } }
  ]}
}
```

## 24. `style_ready` — ผลวิเคราะห์สีเสร็จ · hero = `style.png`

altText: `ผลวิเคราะห์สีของคุณเสร็จแล้ว · โทน {{SEASON}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/style.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ผลวิเคราะห์เสร็จแล้ว", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "คุณคือโทน {{SEASON}}", "weight": "bold", "size": "xl", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูผลวิเคราะห์", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?style=result" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "ชุดตรงโทนของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?season={{SEASON_KEY}}" } }
  ]}
}
```

## 25. `stylist_appointment` — ยืนยัน/เตือนนัดสไตลิสต์ · hero = `stylist.png`

altText: `{{KIND}}นัดสไตลิสต์ · {{APPT_DATE}} {{APPT_TIME}}` (`{{KIND}}` = ยืนยัน / พรุ่งนี้)

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/stylist.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "{{KIND}}นัดสไตลิสต์", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{STYLIST_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "{{APPT_DATE}} · {{APPT_TIME}} · {{MODE}}", "size": "sm", "color": "#8C8B86", "wrap": true }
  ]},
  "footer": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "ดูนัดของฉัน", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&appt={{APPT_ID}}" } },
    { "type": "button", "style": "link", "height": "sm",
      "action": { "type": "uri", "label": "เลื่อน / ยกเลิกนัด", "uri": "https://liff.line.me/{{LIFF_ID}}/index.html?tab=me&appt={{APPT_ID}}&manage=1" } }
  ]}
}
```

## 26. `group_invite_accepted` — เพื่อนเข้ากลุ่มแล้ว · hero = `group.png`

altText: `{{FRIEND_NAME}} เข้ากลุ่ม {{GROUP_NAME}} แล้ว`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "https://wearlloop-dotcom.github.io/line-flex/group.png", "size": "full", "aspectRatio": "2:1", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "สมาชิกใหม่เข้ากลุ่ม", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{FRIEND_NAME}} ตอบรับแล้ว", "weight": "bold", "size": "lg", "wrap": true },
    { "type": "text", "text": "กลุ่ม {{GROUP_NAME}} · {{MEMBER_COUNT}} คน", "size": "sm", "color": "#8C8B86" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "จัดธีมกลุ่ม", "uri": "https://liff.line.me/{{LIFF_ID}}/family.html?group={{GROUP_ID}}" } }
  ]}
}
```

## 27. `abandon_checkout` — ตะกร้าค้าง · hero = รูปชุดจากเว็บ (3:4)

altText: `ชุดในตะกร้ายังรออยู่ · {{GARMENT_NAME}}`

```json
{
  "type": "bubble",
  "hero": { "type": "image", "url": "{{PHOTO_URL}}", "size": "full", "aspectRatio": "3:4", "aspectMode": "cover" },
  "body": { "type": "box", "layout": "vertical", "spacing": "sm", "contents": [
    { "type": "text", "text": "ยังเก็บไว้ให้อยู่", "size": "xs", "color": "#6FB3A6", "weight": "bold" },
    { "type": "text", "text": "{{GARMENT_NAME}}", "weight": "bold", "size": "xl", "wrap": true },
    { "type": "text", "text": "วันที่ {{DATE_RANGE}} ยังว่าง", "size": "sm", "color": "#8C8B86" }
  ]},
  "footer": { "type": "box", "layout": "vertical", "contents": [
    { "type": "button", "style": "primary", "color": "#6FB3A6",
      "action": { "type": "uri", "label": "จองต่อให้จบ", "uri": "https://liff.line.me/{{LIFF_ID}}/g.html?code={{GARMENT_CODE}}&resume=1" } }
  ]}
}
```

> แคมเปญที่เหลือ (`reengagement`, `winback`, `event_suggest`, `charity_update`) ใช้โครง #20/#27 เปลี่ยนข้อความ · การ์ดชวนเข้ากลุ่มฝั่งลูกค้าแชร์เอง อยู่ใน `family.html` (ใช้ hero `group.png` เหมือนกัน)

---

## คลังภาพ line art (`line-flex/` — 1600×800 PNG, พื้น `#FBFAF8`)

| ไฟล์ | ใช้กับใบ | | ไฟล์ | ใช้กับใบ |
|---|---|---|---|---|
| `welcome.png` | #14 | | `refund.png` | #19 |
| `booking.png` | #16 | | `overdue.png` | #18 |
| `pay-clock.png` | #15 | | `queue.png` | #9 (fallback) |
| `payment-ok.png` | #2 | | `credit.png` | #21, #23 |
| `slip-x.png` | #3 | | `birthday.png` | #22 |
| `shipped.png` | #4 | | `style.png` | #24 |
| `return.png` | #5 | | `stylist.png` | #25 |
| `return-received.png` | #5.1 | | `group.png` | #12, #26, การ์ดชวน |
| `qc-pass.png` | #6 | | `repair.png` | #11 |
| `qc-fee.png` | #7 | | `contract.png` | #13 |

ต้นฉบับ SVG อยู่ในสคริปต์ generator — แก้สี/ลายแล้ว render ใหม่ได้ · ภาพจะออนไลน์ที่ `https://wearlloop-dotcom.github.io/line-flex/…` ทันทีที่ push ขึ้น GitHub Pages

## หมายเหตุการต่อระบบ

1. **จุดยิงที่แนะนำ:** DB trigger (pg_net) หรือ Edge Function หลัง RPC สำเร็จ — ตาราง/ฟังก์ชันที่เกี่ยว: `book_with_backups`, `book_cart`, `care_qc`, `care_checkin`, `mark_garment_ready`, `notify_customer_wishlist`, `contract_sign`, `group_pay_confirm`, `return_tracking_submit`
   - **RPC ใหม่ที่ backend ต้องสร้าง:** `return_tracking_submit(p_rental, p_courier, p_tracking_no)` — frontend เรียกผ่าน me-rpc gateway แล้ว (ปุ่ม "แจ้งส่งคืน · กรอกเลขพัสดุ" ใน "ออเดอร์ของฉัน") ให้บันทึกเป็น timeline event `return_shipped` แล้วยิงเทมเพลต 5.1 กลับหาลูกค้า และ `my_rentals` ต้องส่งฟิลด์ `return_courier`, `return_tracking_no` เพิ่ม
2. `{{PHOTO_URL}}` = รูปชุดชุดเดียวกับหน้าเว็บ (คอลัมน์ `photos[0]` ของ garments — เป็น URL สาธารณะอยู่แล้ว) · ต้องเป็น HTTPS และ ≤ 10MB ตามข้อกำหนด LINE
3. `webhooks.js` ในรีโปเป็น stub n8n ที่ไม่มีใครเรียก และ `N8N_BASE_URL` ว่าง — แนะนำยิงจาก backend แทน
4. ทุก push ควร insert ลง notification inbox ในแอปคู่กัน (kinds ใน `app.js:3676-3698`)
