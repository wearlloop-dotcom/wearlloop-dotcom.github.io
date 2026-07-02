# UX/UI Audit — มุมมองลูกค้า end-to-end (ก.ค. 2026)

วิธีตรวจ: ไล่อ่านโค้ดทุกหน้า customer-facing + เปิดหน้าเว็บจริงด้วย browser จำลองมือถือ (iPhone viewport) ตั้งแต่หน้าแรก → เลือกชุด → จอง → จ่าย → หลังเช่า

---

## TL;DR — ทำไมลูกค้ารู้สึก "เด้งไปเด้งมา"

อาการเด้งมาจาก 5 สาเหตุที่ซ้อนกัน เรียงตามความแรง:

1. **ทั้งร้านถูกล็อกหลัง LINE login** — ลูกค้าใหม่ยังไม่เห็นชุดสักตัวก็โดนบังคับเด้งไป LINE ก่อน (`app.js:3808` → `showLoginGate()`)
2. **Splash เปิดร้านเล่นเอง 3 วิ แล้วโดน login gate ทับ** — จอขยับเอง 2 จังหวะโดยลูกค้าไม่ได้กดอะไร (`index.html:1075`)
3. **เด้งไป LINE กลางทางตอนจอง แล้วของที่เลือกหาย** — token หมดอายุเมื่อไหร่ ระบบ redirect ไป LINE ทันทีโดยไม่เตือน และ redirectUri ตัด query ทิ้ง (`me-api.js:23-41`, `liffAuth.js:11`) กลับมาเจอหน้าแรกเปล่า ๆ ชุด/วัน/ไซซ์ที่เลือกไว้หายหมด ไม่มี resume
4. **แต่ละหน้าใช้ logic login คนละแบบ** — `wishlist.html:895` และ `review.html:850` เด้งไป LINE *ทันทีที่เปิดหน้า* / `quiz.html` ไม่ต้อง login เลย / `family.html` ไม่ login ก็โชว์ข้อมูล mock ปลอม ๆ / `join.html` login ตอนกดแล้ว auto เด้งต่อไป `family.html` ใน 1.2 วิ (`join.html:314`) — ลูกค้าเจอ 4 พฤติกรรมใน 4 หน้าพี่น้องกัน
5. **งานเดียวกันมี UI 4 ชุด** — จองชุดผ่าน index (sheet), `g.html` (สแกน QR), `group-checkout.html` (กลุ่ม), `pay.html` (หารบิล) — โค้ดแยกกันหมด หน้าตาไม่เหมือนกัน ลูกค้ารู้สึกโดนโยนไปคนละที่ตลอด

---

## ปัญหาระดับ Critical

| # | ปัญหา | หลักฐาน |
|---|---|---|
| C1 | ล็อกทั้งร้านหลัง LINE login ก่อน browse — ฆ่า conversion ของลูกค้าใหม่ที่มาจากโฆษณา/IG | `app.js:3808`, `index.html:1256-1262` |
| C2 | เด้ง LINE กลาง booking แล้ว state หาย ไม่มี resume (นี่คือ "เด้งไปเด้งมา" ตัวจริง) | `me-api.js:23-41`, `app.js:3889` restore จาก query ที่ถูกตัดทิ้ง |
| C3 | `links.html` (หน้า bio link สาธารณะ — first touch จาก IG) ปุ่มหลัก "Start now" ชี้ไป `https://liff.line.me/YOUR_LIFF_ID` = ลิงก์ตาย, ครัวเซลรูปยังเป็น "Photo 1/2/3" placeholder | `links.html:381`, `links.html:335-360` |
| C4 | หน้า ops ปนกับหน้าลูกค้าโดยไม่มีการกันจริง — `requests.html`, `market.html`, `live.html`, `nfc.html`, `care-label.html`, `home.html` แค่ `opsLogin().catch(()=>{})` (กลืน error) ลูกค้าเปิด URL ตรงจะเจอหน้า staff ครึ่ง ๆ กลาง ๆ ไม่มีทางกลับร้าน | เช่น `requests.html:262` |

## ปัญหาระดับ Major

| # | ปัญหา | หลักฐาน |
|---|---|---|
| M1 | หลังโอนเงิน หน้า confirm ของ index และ g.html บอก "โอนแล้ว แนบสลิปในแชต LINE นี้" — แต่ลูกค้าที่สแกน QR จากป้ายชุดอยู่ใน browser ธรรมดา **ไม่มีแชต LINE เปิดอยู่** และไม่มีปุ่ม "ฉันโอนแล้ว" (มีเฉพาะ `pay.html`) = ทางตันหลังจ่ายเงิน | `app.js:1387-1389`, `g.html:325` vs `pay.html:294` |
| M2 | ไม่มีหน้า "ออเดอร์ของฉัน / กำหนดคืนชุด" สำหรับลูกค้า — journey หลังจองจบที่ฟอร์มรีวิว ไม่รู้สถานะ ไม่รู้ต้องคืนเมื่อไหร่ยังไง | `review.html` เป็นแค่ฟอร์มรีวิว |
| M3 | Error ถูกกลืนเงียบ — `catch` เปล่าจำนวนมาก กดปุ่มแล้วไม่เกิดอะไร ดูเหมือนเว็บพัง | `g.html:160,167,168`, `app.js:1248,1295,1577` |
| M4 | Date picker 4-5 จุด (hero, ใต้กริด, ใน sheet, ใน cart, ใน g.html) sync กันหลวม ๆ — ลูกค้าถูกถามวันซ้ำหลายที่ | `index.html:1149`, `app.js:739,990,1935` |
| M5 | ภาษา TH/EN มี 2 ระบบไม่คุยกัน — ร้านใช้ `I18N`, หน้าอื่นใช้ `nav.js`+`localStorage 'lloop_lang'` → เปลี่ยนภาษาแล้วข้ามหน้าเด้งกลับภาษาเดิม | `index.html:1109`, `nav.js:16` |
| M6 | หน้า browse ซ้ำซ้อน: `index.html` (ร้านจริง) vs `shop.html` ("canonical" แต่ orphan — การ์ดสินค้าลิงก์ไป LINE, tile "เลือกตามงาน" เป็น `<div>` กดแล้วไม่ไปไหน) vs `looks.html` | `shop.html:105-110,165` |
| M7 | `wed.html` ไม่มี topbar/ปุ่มกลับ — ลูกค้าที่ได้ลิงก์แชร์มาติดทางตัน | `wed.html:43-53` |
| M8 | ปุ่มจองใน index ไม่เช็ค login ก่อน — กดแล้วเด้ง LINE แบบเซอร์ไพรส์ ทั้งที่ `g.html` ทำถูกแล้ว (โชว์ปุ่ม "เข้าสู่ระบบด้วย LINE เพื่อจอง" ชัดเจน) | `app.js:1555` vs `g.html:198` |

## ปัญหาระดับ Minor

- ชื่อไฟล์กับดัก: `g.html` (ลูกค้า) vs `garment.html` (staff timeline — โชว์ประวัติซัก/ตำหนิ) ต่างกันตัวเดียว ส่งลิงก์ผิดง่ายมาก
- "หน้าหลัก" มี 2 หน้า: `index.html` (ลูกค้า) กับ `home.html` (หลังบ้าน ป้ายว่า "หน้าหลัก" ใน ops-menu) — โลโก้ nav.js ชี้ index เสมอ staff กดโลโก้แล้วหลุดมาหน้าร้านลูกค้า
- `pay.html` โชว์ debug text ให้ลูกค้าเห็น: "ของจริงต่อกับ Supabase ผ่าน liff/api.js (group_order_summary / group_pay_confirm)" (footer)
- Wishlist ชนกัน 2 ความหมาย: `wishlist.html` (ลูกค้า) vs `requests.html` (staff แต่หัวข้อภายในเขียนว่า "Wishlist")
- กดเปลี่ยนไซซ์ใน detail sheet = re-render ทั้ง sheet + ยิง pixel ViewContent ซ้ำ (`app.js:948`)
- Terms overlay เวอร์ชันใหม่เด้งทับกลาง session ได้ (`app.js:3634-3644`)
- เลือกไซซ์/วันแล้วโดน KYC sheet แทรก *หลัง* กดจอง (เฉพาะชุด premium) — ควรบอกก่อนหน้า

## สิ่งที่ทำดีอยู่แล้ว (เก็บไว้)

- `g.html` มี empty state ดีมาก: "โหลดไม่สำเร็จ → ลองสแกนใหม่ หรือดูทั้งร้าน" พร้อมปุ่มกลับร้าน (ยืนยันจาก screenshot จริง)
- `pay.html` empty state อธิบายชัดว่าต้องเปิดจากปุ่มใน LINE
- `quiz.html` เป็นหน้าที่ flow ดีที่สุด — ไม่บังคับ login, จบเกมแล้วพากลับเข้า stylist flow ใน index พร้อม context (`quiz.html:287`)
- `nav.js` ให้ปุ่มกลับ + โลโก้กลับร้านครบ 21 หน้า
- ไม่บังคับอ่าน rental-terms ยาว ๆ ก่อนจอง (สรุปมัดจำ inline แทน) — ถูกต้องแล้ว
- `liffAuth.js` มี guard กัน redirect loop (`liffLoginTried`) — แนวคิดถูก แต่ wishlist/review ไม่ได้ใช้มัน

---

## ลำดับการแก้ที่แนะนำ (impact ต่อ effort)

1. **เปิดให้ browse ได้โดยไม่ login** — ย้าย gate จากตอนเข้าเว็บไปตอน "กดจอง/กดหัวใจ" แบบเดียวกับ `g.html` (แก้ C1, ลด "เด้ง" ครั้งแรกสุด)
2. **ทำ resume หลัง LINE redirect** — ก่อน `liff.login()` เก็บ `{garmentId, date, size, backups}` ลง `sessionStorage` แล้ว restore + เปิด sheet เดิมหลังกลับมา และให้ redirectUri คง query string (แก้ C2 — หัวใจของ "เด้งไปเด้งมา")
3. **แก้ `links.html`** — ใส่ LIFF ID จริง + รูปจริง (แก้ C3, งานไม่กี่นาที)
4. **เพิ่มปุ่ม "ฉันโอนแล้ว" + เลขออเดอร์ + บอกขั้นถัดไป** ใน confirm ของ index/g.html ให้เหมือน `pay.html` (แก้ M1)
5. **รวม login behavior เป็นแบบเดียว**: ทุกหน้า defer login จนถึง action ที่จำเป็น เลิก redirect-on-load ใน wishlist/review (แก้ข้อ 4 ของ TL;DR)
6. **กันหน้า ops จริงจัง** — ถ้า `opsLogin` fail ให้โชว์ "หน้านี้สำหรับทีมงาน" + ปุ่มกลับร้าน แทนหน้าเปล่า (แก้ C4)
7. **ทำหน้า "ออเดอร์ของฉัน"** โชว์สถานะ + กำหนดคืน + วิธีคืน (แก้ M2)
8. เก็บกวาด: รวมระบบภาษา, ลด date picker เหลือจุดเดียว + สรุปที่เลือกไว้, ตัดสินใจลบหรือซ่อม `shop.html`, เติม topbar ให้ `wed.html`, ลบ debug text ใน `pay.html`, เปลี่ยนชื่อ `garment.html` → `ops-garment.html`
