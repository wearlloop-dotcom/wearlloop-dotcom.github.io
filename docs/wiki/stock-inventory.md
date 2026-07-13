# Stock & Inventory (สต็อก/รับเข้า/จัดซื้อ)
> raw: [stock.html](../../stock.html) · [intake.html](../../intake.html) · [putaway.html](../../putaway.html) · [purchasing.html](../../purchasing.html) · [acquisitions.html](../../acquisitions.html) · [garment.html](../../garment.html) · [garment-colors.html](../../garment-colors.html) · [care-label.html](../../care-label.html) · [labels.html](../../labels.html) · [nfc.html](../../nfc.html) · [csv.html](../../csv.html) • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้
- `stock.html` — แดชบอร์ดคลังทั้งหมด: ค้นหา/กรอง, drawer แก้ไขชุด, เปลี่ยนสถานะ, สรุปตามสถานะ, ตรวจ+อุด "รอยรั่ว", export CSV
- `intake.html` — รับชุดใหม่เข้าระบบ (ฟอร์ม + AI ช่วยกรอกจากรูป) → สร้างชุดสถานะ `needs_review` + เก็บเข้าช่องได้ทันที
- `putaway.html` — เก็บเข้าช่อง (put-away), ตามหาชุด (locate), ดูของในช่อง, จัดการช่องเก็บ (bins)
- `purchasing.html` — จัดซื้อ: พยากรณ์ดีมานด์, ควรเติมชุด/ไซซ์/โทนสี, ใบสั่งซื้อ (PO), เจ้าหนี้, วัสดุ/ซัพพลายเออร์ (ผ่าน edge function `acct`)
- `acquisitions.html` — รับซื้อตู้เสื้อผ้า (Closet Cash): ตีราคา → ตกลง → จ่าย → ส่งเข้าคลัง
- `garment.html` — ไทม์ไลน์ราย 1 ชุด (รอบดูแล/สภาพ/รูป/เหตุการณ์จัดส่ง) เปิดจาก QR `?code=`
- `garment-colors.html` — ตั้งกลุ่มสี (color_family) ให้แต่ละชุด มีผลกับตัวกรองสีหน้าลูกค้า
- `care-label.html` — ปริ้นป้ายเย็บติดชุด (วิธีดูแล + QR) มี 2 แบบ: ป้ายหลัก / ป้ายสำรองซ่อน
- `labels.html` — ปริ้นป้าย QR แปะถุง (กรองด้วยข้อความ/ระบุโค้ด)
- `nfc.html` — แตะ NFC เช็คชุด/ผูก tag (Web NFC, Android Chrome) มี PIN gate ฝั่งสตาฟ
- `csv.html` — export/import ชุดทั้งคลังเป็น CSV (import ใช้ `intake_garment` ต่อแถว)
- `color-report.html` — **ไม่ใช่หน้าสต็อกจริง**: เป็นหน้า "สรุปสไตล์ของฉัน" ฝั่งลูกค้า (personal color/season) เรียก `my_style_summary` ผ่าน me-rpc — จัดหมวดผิดโดเมน ควรย้ายไป customer/styling

## Flow (end-to-end ของโดเมน)
- **รับเข้า → หมุนเวียน**: ชุดเข้าระบบผ่าน `intake.html` (หรือ import `csv.html`, หรือมาจากดีลรับซื้อ `acquisitions.html`) → สถานะเริ่มต้น `needs_review` (ยังไม่ขึ้นหน้าลูกค้า) → สตาฟตรวจข้อมูลใน `stock.html` drawer แล้วกด "ข้อมูลครบ → พร้อมขึ้นเว็บ" (`mark_garment_ready`)
- **จัดเก็บ/ค้นหา**: `putaway.html` เก็บชุดเข้าช่อง (`put_away`) → ตอนแพ็กส่งใช้ `locate`/`bin_contents` หาได้เร็ว · `stock.html` drawer ก็ย้ายช่องได้
- **ป้าย/แท็ก**: `labels.html`+`care-label.html` ปริ้น QR, `nfc.html` ผูก NFC tag — ทุก tag/QR ชี้ไป `g.html?c=<code>` (หน้าเช็คชุด)
- **วงจรชีวิต**: `garment.html` แสดงไทม์ไลน์ต่อชุด (`garment_timeline`); เปลี่ยนสถานะผ่าน `garment_transition` (client มิเรอร์ transition map ของ backend)
- **เติมของ**: `purchasing.html` อ่านดีมานด์จริง (forecast/restock/wishlist) แล้วออก PO; `acquisitions.html` ป้อนชุดมือสองเข้าคลัง
- **Backend**: ทุกหน้าสร้าง supabase client ด้วย anon key แล้ว **override `sb.rpc = window.opsRpc`** → RPC วิ่งผ่าน gateway `ops-rpc` (verify LINE idToken + staff/allowlist). `purchasing.html` เรียก edge function `acct` ตรงด้วย LINE idToken. `color-report.html` เรียก `me-rpc` (ลูกค้า)

## Insight (รู้อะไร)
- ทั้งโดเมนใช้รูปแบบ ops เดียวกัน: anon key ฝังใน HTML แต่ทุก RPC ถูกดันผ่าน `ops-rpc` gateway → anon key ไม่ได้ให้สิทธิ์อะไรตรง ๆ (ปลอดภัยตามดีไซน์ที่ CLAUDE.md ระบุ)
- QR/ลิงก์เช็คชุดของ **labels/intake/nfc** ใช้ `CONFIG.SITE_URL + /g.html?c=` (config-driven, เปลี่ยนโดเมนที่เดียว) — แต่ `care-label.html` hardcode คนละสคีมา (ดู Issues)
- RPC ที่โดเมนนี้พึ่ง: `ops_garments`, `stock_export_rows`, `stock_summary`, `stock_audit`, `stock_reconcile`, `garment_transition`, `garment_update`, `garment_timeline`, `mark_garment_ready/unready`, `put_away`, `locate`, `bin_contents`, `bins_list/summary`, `bin_add`, `bin_set_active`, `intake_garment`, `ops_set_garment_color`, `care_label_rows`, `tag_lookup/scan/register`, `nfc_staff_ok`, `seller_offers_*` — ต้องอยู่ใน allowlist ของ gateway ครบ
- `stock.html` มี fallback ข้อความบอกเองว่า `garment_update` อาจยังไม่ deploy ("ฟีเจอร์แก้ไขรอ backend merge") — เป็น dark-launch ที่รู้ตัว
- `acquisitions.html` ต้องรัน `supabase-p0-moats.sql` ก่อน ไม่งั้นโชว์แบนเนอร์ (มี guard `missingRpc`) — dark-launch
- `csv.html` import ใช้ `intake_garment` ทั้งเพิ่มและอัปเดต (พึ่ง upsert semantics ฝั่ง backend) และ export ครอบคอลัมน์กว้างกว่าฟอร์ม intake (rate_1d, dress_code, stretch, has_lining ฯลฯ)
- `stock.html` เก็บ transition map (`TRANS`) ฝั่ง client ที่ "ต้องตรงกับ `garment_transition`" — coupling เปราะ ถ้า backend เปลี่ยนกติกาแล้วลืมแก้ที่นี่ ปุ่มจะเสนอ transition ผิด/ตกหล่น

## Decision (ตัดสินใจอะไรไปแล้ว)
- ชุดใหม่เริ่มที่ `needs_review` เสมอ (ไม่ขึ้นหน้าลูกค้าจนกว่าตรวจ) — กันข้อมูลดิบหลุดหน้าเช่า
- ต้นทุนตอนส่งเข้าคลังจากดีลรับซื้อใช้ราคาที่ตกลงซื้อ (`offered_price`) เท่านั้น ห้าม fallback ไป `asking_price` (คอมเมนต์ระบุกันทุนเพี้ยน)
- reconcile อุดเฉพาะเคสปลอดภัย (จองค้างเลยวัน/สถานะไม่ตรง/ค้างไม่ว่าง) เคสวิกฤตให้คนจัดการเอง
- NFC เขียน URL หน้าลูกค้าลง tag เพื่อให้ลูกค้าแตะแล้วเด้งหน้าชุด ไม่ใช่หลังบ้าน

## Issues (จาก static audit — severity)
- [high] QR ป้ายเย็บติดชุดชี้โดเมน/พาธที่ยังไม่มีจริง — `care-label.html` — `QR_BASE='https://lloop.app/g/'` + code → เช่น `https://lloop.app/g/g1` ต่างจากหน้าอื่นทั้งหมดที่ใช้ `SITE_URL + /g.html?c=<code>` (`g.html` อ่าน `?c=`). โดเมน `lloop.app` ยังไม่ผูก DNS (config: SITE_URL = github.io) และพาธ `/g/g1` ไม่มี route รองรับ → QR บนป้ายที่ **เย็บติดถาวรกับชุด** สแกนแล้วเปิดไม่ได้ ควรใช้ `CONFIG.SITE_URL + /g.html?c=` ให้ตรงกับ labels/nfc
- [medium] ลิงก์ "ส่งเข้าคลัง → รับเข้า" ส่งพารามิเตอร์ที่ปลายทางไม่อ่าน — `acquisitions.html` / `intake.html` — `intakeLink()` สร้าง `intake.html?acq=&name=&brand=&size=&condition=&cost=&color=&fabric=&photo=` แต่ `intake.html` ไม่มีการอ่าน `URLSearchParams`/`location.search` เลย (0 อ้างอิง) → ฟอร์มไม่ prefill, ต้นทุน (cost) และ acq id ไม่ถูกผูก ทั้งที่ UI บอกว่า "เปิดหน้ารับเข้าพร้อมข้อมูลเติมให้แล้ว" (คำโฆษณาไม่ตรงจริง)
- [low] stored-XSS ในหน้าปริ้น (auth-only, staff→staff) — `labels.html` / `garment-colors.html` — ฟิลด์ชุด (`g.name`,`g.brand`,`g.color_name`) ถูกยัดเข้า `innerHTML` โดยไม่ผ่าน `esc()` (ต่างจาก stock/care-label/nfc ที่ escape). ถ้าชื่อชุดมี HTML/`<img onerror>` จะรันในหน้าหลังบ้าน ผลกระทบจำกัดเพราะข้อมูลมาจากสตาฟและหน้าอยู่หลัง gateway
- [low] id อิลิเมนต์จากโค้ดชุดไม่ sanitize — `labels.html` (`qr_${g.code}`), `care-label.html` (id ผ่าน `esc` แต่ `getElementById('cq_'+g.code)` ใช้ค่า raw), `garment-colors.html` (`nm_${g.code}`, onclick inline) — ถ้าโค้ดชุดมีอักขระพิเศษ/ช่องว่าง QR/ปุ่มจะจับ element ไม่เจอ ปัจจุบันโค้ดเป็นแบบง่าย (g1) จึงยังไม่กระทบ
- [low] จัดหมวดผิดโดเมน — `color-report.html` — เป็นหน้าลูกค้า (สรุปสไตล์/สีผิว ผ่าน me-rpc `my_style_summary`) ไม่เกี่ยวสต็อก ควรย้ายไปโดเมน customer-journey/styling

## Next action
- [ ] แก้ `care-label.html` ให้ QR ใช้ `CONFIG.SITE_URL + '/g.html?c=' + encodeURIComponent(code)` (ต้นทางจริงอยู่ `lloop/ops/` — แก้ที่นั่นแล้วให้ deploy ทับ ห้ามแก้รีโปนี้ตรง)
- [ ] ให้ `intake.html` อ่าน query params (`name/brand/size/condition/cost/color/fabric/photo/acq`) มา prefill ฟอร์ม + ผูก acquisition id ตอน save; หรือถ้าไม่ทำ ให้ตัดคำโฆษณา/ลิงก์ใน `acquisitions.html`
- [ ] escape ฟิลด์ชุดใน `labels.html` + `garment-colors.html` ให้เหมือนหน้าอื่นในโดเมน
- [ ] ยืนยันว่า RPC ทั้งชุด (โดยเฉพาะ `garment_update`, `seller_offer_*`) อยู่ใน allowlist ของ `ops-rpc` ที่ deploy จริง (dashboard อาจใหม่กว่าซอร์ส lloop)
- [ ] พิจารณาย้าย `color-report.html` ออกจาก index หมวดสต็อก

## Links
- [[events-occasions]]
