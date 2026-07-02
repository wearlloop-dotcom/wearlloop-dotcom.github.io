# LLOOP · ชุดงานอัตโนมัติ (n8n + LINE Messaging API)

โฟลเดอร์นี้คือ "แพ็กเกจงานอัตโนมัติ" ทั้ง 5 ตัวตามที่ระบุไว้ใน `db/README.md`
(หัวข้อ "งานอัตโนมัติที่ต้องตั้งเพิ่ม") — import เข้า n8n ได้เลย ไม่ต้องเขียนโค้ดเพิ่มค่ะ

| ไฟล์ | เวลา (ไทย) | ทำอะไร | ส่ง LINE หาใคร |
|---|---|---|---|
| `n8n-01-t14-ping.json` | ทุกวัน 09:00 | รวบงานลูกค้าที่จะถึงใน 14 วันที่ **ยังไม่ทัก** → สรุปเป็นข้อความเดียว | สไตลิสต์/เจ้าของร้าน |
| `n8n-02-closet-day-draft.json` | ทุกวัน 08:00 | สมาชิกที่วันนี้ = วันเปลี่ยนตู้ − 5 → จัดกล่อง draft + แจ้ง | สมาชิก LLOOP Day |
| `n8n-03-fit-nudge.json` | ทุกวัน 10:00 | ลูกค้าที่คืนชุด "เมื่อวาน" → ชวนบอกความพอดี 20 วิ | ลูกค้าที่เพิ่งคืนชุด |
| `n8n-04-group-fanout.json` | ทุกชั่วโมง | booking กลุ่มใหม่ → บันทึกวันงานลงปฏิทินแขก **ทุกคน** | แขกในกลุ่ม (ปิดได้) |
| `n8n-05-auto-confirm.json` | ทุกวัน 07:30 | กล่อง draft ที่เหลือ ≤ 5 วันก่อนวันเปลี่ยนตู้ → ล็อกเป็น confirmed | สมาชิกที่กล่องถูกล็อก |

ใน `line-flex/` มีไฟล์ flex message ทั้ง 5 แบบแยกไว้ต่างหาก เอาไปวางทดสอบใน
[LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/) ได้เลย
(ไฟล์เป็น "bubble" ตัวเดียวกับที่ workflow สร้างส่งจริง — ใน workflow จะถูกห่อด้วย
`{ to, messages: [{ type: 'flex', altText, contents: <bubble> }] }` อีกชั้น)

---

## 🔑 ค่าที่ต้องตั้ง "ครั้งเดียว" ก่อน import

workflow ทุกตัวอ่านค่าลับจาก **environment variables ของ n8n** (ผ่าน `{{ $env.XXX }}`)
— ตั้งครั้งเดียว ใช้ได้ทุก workflow ไม่ต้องแก้ไฟล์ JSON เลยค่ะ

| ตัวแปร | ค่า | หาได้จาก |
|---|---|---|
| `SUPABASE_URL` | `https://rprwilsbjptdnvsibjgi.supabase.co` | ค่าเดียวกับใน `config.js` |
| `SUPABASE_SERVICE_KEY` | **service_role key** (secret) | Supabase Dashboard → Project Settings → API keys → `service_role` |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token (long-lived) | LINE Developers → Messaging API channel → Messaging API → Channel access token |
| `STYLIST_LINE_UID` | LINE userId ของสไตลิสต์/เจ้าของร้าน (ขึ้นต้น `U...`) | LINE Developers → Basic settings → Your user ID (หรือดูจาก webhook log) |

### วิธีตั้ง env ใน n8n

- **n8n แบบ Docker / self-host:** เพิ่มลงไฟล์ `.env` หรือ `docker-compose.yml` แล้ว restart เช่น

  ```
  SUPABASE_URL=https://rprwilsbjptdnvsibjgi.supabase.co
  SUPABASE_SERVICE_KEY=eyJ...   (service_role)
  LINE_CHANNEL_ACCESS_TOKEN=xxxx
  STYLIST_LINE_UID=Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  GENERIC_TIMEZONE=Asia/Bangkok
  TZ=Asia/Bangkok
  ```

- **n8n Cloud:** ใช้เมนู Admin → Variables ไม่ได้กับ `$env` โดยตรง — ถ้าใช้ Cloud
  ให้เปลี่ยน `{{ $env.XXX }}` ในโหนด HTTP เป็น n8n **Credential** (Header Auth)
  หรือใช้ `{{ $vars.XXX }}` แทน (ตั้งค่าใน Variables) — จุดที่ต้องแก้มีแค่ header
  ของโหนด Supabase/LINE เท่านั้นค่ะ

### 🚨 คำเตือนความปลอดภัย (สำคัญมาก)

- `SUPABASE_SERVICE_KEY` คือกุญแจ **ข้าม RLS ได้ทุกตาราง** — ให้อยู่ **ใน n8n ที่เดียวเท่านั้น**
  ห้าม commit ลง repo, ห้ามใส่ใน `config.js`, ห้ามโผล่ในหน้าเว็บ/ frontend เด็ดขาด
- **ห้ามใช้ publishable/anon key** (`sb_publishable_...` ใน `config.js`) กับ workflow พวกนี้ —
  มันเรียก `upcoming_customer_events` ไม่ได้อยู่แล้ว (revoke ไว้) และตาราง prefs/boxes ก็ปิด RLS ไว้
- ถ้าสงสัยว่า key รั่ว: Supabase Dashboard → API keys → Rotate ได้ทันที แล้วมาแก้ env ใน n8n จุดเดียว

---

## 📥 วิธี import workflow เข้า n8n

1. เปิด n8n → เมนูซ้าย **Workflows** → ปุ่ม **Add workflow** → เมนู `...` มุมขวาบน →
   **Import from File...** → เลือกไฟล์ `n8n-01-...json` (ทำทีละไฟล์จนครบ 5)
2. เปิด workflow ที่ import แล้ว เช็คว่า Settings ของ workflow (เมนู `...` → Settings)
   เป็น **Timezone: Asia/Bangkok** (ไฟล์ตั้งมาให้แล้ว แต่เช็คซ้ำนิดนึงนะคะ)
3. กด **Execute workflow** ทดสอบมือก่อน 1 รอบ (ดู checklist ด้านล่าง) แล้วค่อยเปิดสวิตช์
   **Active** ทีละตัว
4. ไฟล์ import มาเป็นสถานะ **ไม่ active** เสมอ — ตั้งใจไว้แบบนั้น จะได้ไม่ยิงหาลูกค้าก่อนทดสอบค่ะ

หมายเหตุ timezone: ทุก workflow ตั้ง `Asia/Bangkok` ในไฟล์แล้ว และโค้ดคำนวณวันที่ข้างใน
บวก UTC+7 ตรง ๆ (ไทยไม่มี daylight saving) — ถ้า server n8n อยู่ต่างประเทศก็ยังตรงค่ะ
แนะนำตั้ง `GENERIC_TIMEZONE=Asia/Bangkok` ที่ตัว n8n ด้วยเพื่อให้ workflow ใหม่ ๆ ได้ค่าเดียวกัน

---

## รายละเอียดรายตัว + สิ่งที่ต้องแก้ก่อนเปิดใช้

### 01 · T-14 ping สไตลิสต์ (`n8n-01-t14-ping.json`)

- **ไหลยังไง:** 09:00 → เรียก RPC `upcoming_customer_events(p_days=14)` (service role) →
  กรองเฉพาะแถวที่ `pinged_at` ยังว่าง → จัดกลุ่มตามวันที่ → ส่ง flex สรุป 1 ข้อความหา
  `STYLIST_LINE_UID`: "มีงานลูกค้าใกล้ถึง N งานค่ะ" + ปุ่มเปิด `today.html`
- **ตั้งใจให้คนอยู่ในลูป:** workflow นี้ **ไม่** mark pinged เอง — สไตลิสต์จัดลุค ทักลูกค้า
  แล้วกด "ทักแล้ว" ใน `today.html` (ซึ่งเรียก `mark_event_pinged`) เอง กันเครื่องทักแทนคน
- ไม่มีงานค้างทัก = ไม่ส่งอะไรเลย (เงียบ ไม่สแปม)

### 02 · กล่อง LLOOP Day draft (`n8n-02-closet-day-draft.json`)

- **ไหลยังไง:** 08:00 → อ่าน `closet_day_prefs` (line_uid, day) → คัดคนที่ "วันนี้ =
  วันเปลี่ยนตู้ − 5" (ถ้า day−5 ติดลบ จะวนไปปลายเดือนปัจจุบันให้เอง เช่น day=3 → ทักวันที่
  26–29 ของเดือนก่อนหน้าตามความยาวเดือน) → เรียก `closet_day_get(p_uid)` ให้จัดกล่อง
  draft ของเดือนนี้ (เรียกซ้ำไม่สร้างซ้ำ) → flex หาสมาชิก: "กล่องเดือนนี้จัดให้แล้วค่ะ" + ปุ่ม `closet-day.html`
- ⚠️ **ก่อนเปิดใช้:** ต้อง deploy `db/03_closet_day.sql` แล้ว และ `closet_day_get` อ้างตาราง
  `public.garments` ตรง ๆ — ถ้ายังไม่มีตารางนี้ RPC จะ error ทันที (ดูหมายเหตุใน `db/README.md`)

### 03 · Fit DNA nudge (`n8n-03-fit-nudge.json`)

- **ไหลยังไง:** 10:00 → คำนวณช่วง "เมื่อวาน" ตามเวลาไทย → query PostgREST
  `rentals?returned_at=gte.<เมื่อวาน>&returned_at=lt.<วันนี้>&select=line_uid,garment_code` →
  รวมเหลือ 1 ข้อความ/คน → flex: "ชุดล่าสุดใส่เป็นยังไงคะ บอก 20 วิ..." + ปุ่ม `fit.html`
- 🚨 **TODO ก่อนเปิดใช้ (สำคัญ):** เรายังไม่รู้ schema จริงของตารางเช่า — query เขียนเทียบโครง
  `rentals(line_uid, garment_code, returned_at)` แบบเดียวกับที่ `db/02_fit_dna.sql` เดาไว้
  ถ้าชื่อตาราง/คอลัมน์จริงต่างไป ให้แก้ URL ในโหนดที่ชื่อขึ้นต้น "⚠️ TODO: Supabase อ่าน rentals..."

### 04 · Fan-out ปฏิทินแขกทั้งกลุ่ม (`n8n-04-group-fanout.json`)

- **ไหลยังไง:** ทุกชั่วโมง → หา booking กลุ่มที่เกิดใน 65 นาทีล่าสุด (เผื่อเหลื่อม 5 นาที) →
  แปลงเป็นรายชื่อแขก → เรียก `upsert_event(p_uid, p_id=null, p_date, p_occasion, ...)`
  ต่อแขกหนึ่งคน → (ทางเลือก) flex แจ้งแขก: "วันงานถูกบันทึกลงปฏิทินแล้วค่ะ" + ปุ่ม `my-events.html`
- **รันซ้ำปลอดภัย:** `customer_calendar` มี unique index `(line_uid, date, occasion)` —
  ยิง upsert_event ซ้ำกี่รอบก็ได้ 1 งาน = 1 แถวเสมอ (dedupe ฝั่ง DB)
- 🚨 **TODO ก่อนเปิดใช้ (สำคัญ):** schema ของ booking กลุ่มยังไม่รู้ — มีโหนด TODO 2 ตัว:
  1. โหนด HTTP ใช้ชื่อตาราง `group_bookings` เป็น **placeholder** ต้องแก้เป็นตารางจริงของ
     `book_group_cart`/`book_group_split` (โหนดตั้ง on-error = continue ไว้ จะไม่ล้มถ้าตารางยังไม่มี)
  2. โหนด Code "แปลง booking → รายชื่อแขก" เดาชื่อฟิลด์ `members / event_date / occasion` ไว้ —
     แก้ให้ตรงของจริง
- ไม่อยากทักแขกอัตโนมัติ? ปิด (disable) โหนดสุดท้ายโหนดเดียว — ปฏิทินยังบันทึกครบ
- เกร็ด: หน้าเว็บ (`group-checkout.html`) บันทึกปฏิทินให้เฉพาะ "หัวหน้ากลุ่ม" อยู่แล้ว —
  job นี้เก็บตกสมาชิกที่เหลือที่มี line_uid

### 05 · Auto-confirm กล่อง LLOOP Day (`n8n-05-auto-confirm.json`)

- **ไหลยังไง:** 07:30 → อ่าน `closet_day_prefs` → คัดคนที่วันเปลี่ยนตู้ครั้งถัดไปเหลือ **≤ 5 วัน**
  (รองรับข้ามเดือน) → `PATCH closet_boxes?status=eq.draft&month=eq.<เดือนของวันเปลี่ยนตู้>&line_uid=eq.<uid>`
  ตั้ง `status=confirmed` → ส่ง flex **เฉพาะคนที่กล่องเพิ่งถูกล็อกรอบนี้จริง ๆ**:
  "กล่องของคุณล็อกแล้วค่ะ เจอกันวันที่ X นะคะ 💚"
- PATCH กรอง `status=eq.draft` — กล่องที่ confirm ไปแล้ว/ลูกค้ากด skip จะไม่ถูกแตะ และ
  ไม่ถูกส่งข้อความซ้ำ (workflow เช็คจากจำนวนแถวที่ PATCH โดนจริง)
- 📝 **หลัง workflow นี้เปิดใช้จริงแล้ว:** ข้อความบน `closet-day.html` ตอนนี้ถูกลดโทนไว้ว่า
  "สไตลิสต์จะยืนยันทาง LINE ก่อนจัดส่ง" — พอ auto-confirm ทำงานจริง กลับไปแก้ copy หน้านั้น
  ให้เป็น auto-confirm เต็มรูปแบบได้เลยค่ะ (opt-out: ไม่กดอะไร = ยืนยันอัตโนมัติ)

---

## ✅ Testing checklist (ทำทีละ workflow ก่อนเปิด Active)

ทุกตัวทดสอบ 3 ขั้นเหมือนกัน: **รันมือ → เช็ค LINE → เช็ค DB**

**เตรียมก่อน:** เพิ่ม LINE ทางการของร้านเป็นเพื่อนด้วยบัญชี LINE ของตัวเอง แล้วใช้
userId ตัวเองแทนลูกค้าจริงตอนทดสอบ (สร้างแถวทดสอบใน DB ด้วย uid ตัวเอง)

**01 · T-14 ping**
1. ใส่งานทดสอบ: SQL Editor → `select upsert_event('<uid ทดสอบ>', null, current_date + 7, 'dinner', 'ทดสอบระบบ', null);`
2. กด Execute workflow ใน n8n → ต้องได้ flex ใน LINE ของสไตลิสต์ นับจำนวนงานถูก
3. เช็ค DB: `pinged_at` ต้อง **ยังเป็น null** (workflow นี้ห้ามแตะ) → เปิด `today.html`
   กด "ทักแล้ว" → รัน workflow ซ้ำ → งานนั้นต้องหายจากสรุป
4. ลบแถวทดสอบทิ้ง

**02 · กล่อง draft**
1. ตั้งวันทดสอบ: `select closet_day_set('<uid ทดสอบ>', <วันนี้+5>);` (เช่น วันนี้ 10 → ใส่ 15)
2. Execute → ต้องได้ flex "กล่องเดือนนี้จัดให้แล้วค่ะ" ใน LINE ตัวเอง
3. เช็ค DB: `select * from closet_boxes where line_uid='<uid>';` ต้องมีแถวเดือนนี้ `status='draft'`
   → รันซ้ำอีกรอบ ต้อง **ไม่** เกิดกล่องแถวที่สอง
4. เปิด `closet-day.html` จากปุ่มใน LINE — ต้องเห็นกล่องเดียวกัน

**03 · Fit nudge**
1. แก้ TODO ชื่อตาราง/คอลัมน์ให้เรียบร้อยก่อน แล้วใส่แถวเช่าทดสอบที่ `returned_at` = เมื่อวาน
2. Execute → ได้ flex "ชุดล่าสุดใส่เป็นยังไงคะ" → กดปุ่มต้องเปิด `fit.html`
3. ส่งฟีดแบ็กจากหน้า `fit.html` → เช็ค `select * from fit_feedback where line_uid='<uid>';`
4. คืน 2 ชุดในวันเดียว → ต้องได้ข้อความ **ครั้งเดียว** (dedupe ต่อคน)

**04 · Group fan-out**
1. แก้ TODO ตาราง booking + ชื่อฟิลด์ก่อน แล้วสร้าง booking กลุ่มทดสอบ (สมาชิก = uid ตัวเอง)
2. Execute → เช็ค `select * from customer_calendar where line_uid='<uid>';` ต้องมีงานของแขก
3. Execute ซ้ำ → จำนวนแถว **ต้องเท่าเดิม** (unique index กันซ้ำ)
4. ถ้าเปิดโหนด push ไว้: ได้ flex "วันงานถูกบันทึกลงปฏิทินแล้วค่ะ" → ปุ่มเปิด `my-events.html`

**05 · Auto-confirm**
1. ตั้ง `closet_day_set('<uid>', <วันนี้+3>)` และมีกล่อง draft เดือนนั้น (รัน workflow 02 หรือเรียก `closet_day_get` ก่อน)
2. Execute → เช็ค `select status from closet_boxes ...` ต้องเป็น `confirmed` + ได้ flex "กล่องของคุณล็อกแล้วค่ะ"
3. Execute ซ้ำ → ต้อง **ไม่มี** ข้อความซ้ำ (กล่องไม่ใช่ draft แล้ว)
4. ทดสอบเคส skip: กด "ข้ามเดือนนี้" ใน `closet-day.html` → รัน workflow → กล่อง skipped ต้องไม่ถูกล็อก ไม่ได้ข้อความ

---

## โครงไฟล์

```
automation/
├── README.md                      ← ไฟล์นี้
├── n8n-01-t14-ping.json           ← import เข้า n8n
├── n8n-02-closet-day-draft.json
├── n8n-03-fit-nudge.json
├── n8n-04-group-fanout.json
├── n8n-05-auto-confirm.json
└── line-flex/                     ← flex bubble สำหรับวางทดสอบใน Flex Simulator
    ├── 01-t14-ping.json
    ├── 02-closet-day-draft.json
    ├── 03-fit-nudge.json
    ├── 04-group-fanout.json
    └── 05-auto-confirm.json
```

พอ deploy n8n แล้ว อย่าลืมกลับไปใส่ URL ที่ `CONFIG.N8N_BASE_URL` ใน `config.js` ด้วยนะคะ 💚
