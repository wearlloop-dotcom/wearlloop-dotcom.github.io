# Backend / Infra / Product TODO — WEARLLOOP

> รวมรายการที่ audit เจอแต่ "แก้ฝั่ง client ไม่ได้" — ต้องอาศัย backend, infra, หรือการตัดสินใจเชิงธุรกิจ
> (ส่วนที่แก้ได้แล้วอยู่ใน FIXES.md · commit บน branch นี้)

## ⭐ ฟีเจอร์จุดรับ-คืนชุด (pickup/dropoff) — เฟสถัดไป

- Owner toggle `hub_pickup_enabled` **มีอยู่แล้ว**ใน `settings.html` (เก็บผ่าน `hub_settings_set`→app_settings) · เฟสนี้ **ปิด** = ส่งพัสดุอย่างเดียว ✓
- ที่ต้องทำเพิ่มเพื่อเปิดใช้:
  1. **Backend**: RPC ให้ลูกค้าดึงรายการจุดรับ-คืน (เช่น `list_pickup_points`) + เพิ่ม param `pickup_id` ใน `book_with_backups`/`book_cart`/`book_group_*`
  2. **Client** (`app.js` checkout): เมื่อ `hub_pickup_enabled=true` แสดงตัวเลือก "รับเอง/จุดฟิตติ้ง" อ่านจาก branches แล้วส่ง `pickup_id`
  3. **`branches.html`**: ผูกจุดที่ตั้งไว้เข้ากับ RPC ข้างต้น (ตอนนี้เป็นข้อมูลลอย)

## ต้องแก้ Backend (RPC / data model)

- **`app.js`** — [0] หน้าออเดอร์โชว์ tracking ได้แต่ไม่มีที่บันทึกเลขพัสดุ (dead-end)
  - ต้องเพิ่ม UI+RPC ใหม่ (เช่น action set_shipment) ในหน้า shipout.html/today.html ให้สตาฟกรอก courier/tracking_no/eta เขียนกลับ ซึ่งอยู่นอก app.js และต้องมี backend action รองรับ — เกินขอบเขตไฟล์นี้และเป็น contract ใหม่กับ backend
- **`app.js`** — [2] ฝั่งลูกค้าไม่มีปุ่ม/สถานะ 'ส่งคืน'
  - ต้องเพิ่มปุ่มแจ้งส่งคืน + RPC เซ็ตสถานะ return_shipped/return_arrived และ hook ตอนของถึงร้าน ซึ่งเป็นฟีเจอร์ใหม่ที่ต้องมี backend action เซ็ต event เหล่านี้ (ปัจจุบันไม่มีที่ไหนเซ็ตเลย) — เกินขอบเขต client
- **`app.js`** — [5] hold expires_at มองไม่เห็นฝั่ง client + orderPay ไม่ re-check
  - การโชว์ countdown ต้องให้ bookWithBackups คืน expires_at (ฝั่ง backend ไม่ได้ส่งมา) และการ re-check hold หมดอายุก็ต้องพึ่งข้อมูล/สถานะ hold จาก server — แก้ฝั่ง client อย่างเดียวไม่ครบและเสี่ยงเดา contract
- **`app.js`** — [7] ยกเลิกชุดหลักไม่แตะชุดสำรอง (orphan spare)
  - การ cascade ยกเลิกสำรองที่ผูก primary_rental_id ควรทำฝั่ง server (atomic) การยิงยกเลิกสำรองตามฝั่ง client เสี่ยงสร้าง flow ครึ่ง ๆ และยืนยัน cascade behavior ของ backend ไม่ได้ — ปล่อยให้ backend จัดการ
- **`case-file.html`** — [2] หน้า evidence ยิง edge fn 'acct' ตรงด้วย raw idToken — role/PII gate เป็น server-only
  - การ gate role/owner/scope สาขาอยู่ที่ edge fn 'acct' ซึ่งไม่อยู่ใน repo ตรวจ/ยืนยันจาก client ไม่ได้ และการย้ายไปผ่าน ops-rpc gateway ต้องแก้ backend ด้วย — เกินขอบเขตไฟล์เดียว ไม่เดาแก้
- **`disputes.html`** — [0] party_type employee/supplier ไม่มี branch สร้างแฟ้มหลักฐาน
  - การแก้จริงต้องให้ backend (dispute_get) คืน evidence ชนิด employee/supplier ก่อน + แก้ case-file.html (อีกไฟล์) เพิ่ม stype ด้วย. เขียน branch renderEvidence ev.type==='employee'/'supplier' โดยไม่รู้ shape ข้อมูลที่ server คืน = เดา และปลายทางยังคืน JSON ดิบเหมือนเดิม. อยู่นอกขอบเขต client-safe (ต้องแก้ backend + ไฟล์อื่น) จึง skip
- **`disputes.html`** — [1] เปิดคดีไม่ผูก rental_id
  - ต้องเพิ่มฟิลด์ rental_id ใน payload dispute_open ซึ่งเป็นการเปลี่ยน contract/data model ฝั่ง backend (server ต้องรับ+เก็บ+ใช้ group evidence). ไม่ใช่การแก้ client ล้วน จึง skip
- **`disputes.html`** — [2] influencer_no_return ไม่มี party_type และไม่มี evidence panel
  - การเพิ่ม <option value='influencer'> ใน f_ptype เป็นการส่งค่า party_type ใหม่ที่ backend อาจไม่รองรับ (เปลี่ยน contract) และ branch renderEvidence influencer ต้องรอ server คืน evidence ชนิดนี้ก่อน + ต้องแก้ case-file.html ด้วย. อยู่นอกขอบเขต จึง skip
- **`disputes.html`** — [3] employee/supplier evidence panel ตกลง JSON ดิบ
  - ซ้ำกับ [0] — เพิ่ม branch renderEvidence โดยไม่รู้โครงสร้างข้อมูลที่ server คืน (ปัจจุบัน server ไม่มี branch นี้) ทำให้แก้ไม่ได้จริง ต้องแก้ backend + case-file.html. skip
- **`disputes.html`** — [7] คดีผูกด้วย uuid อิสระ ไม่เจาะจง rental/contract + ไม่ validate
  - ทับซ้อนกับ [1] — ต้องเพิ่มฟิลด์ rental_id/contract_id ใน payload (เปลี่ยน data model) และการ validate ว่า uuid มีจริงต้องเรียก lookup ฝั่ง backend. ไม่ใช่ client-safe จึง skip
- **`forecast.html`** — [0] forecast.html ข้าม gateway ops-rpc ใช้ anon key + p_uid เป็น auth และ update_plan_price เขียนราคาจริงได้ด้วย UID
  - ปัญหาเชิงสถาปัตยกรรม auth ทั้งหน้า แนวทางแก้คือย้ายไปเรียกผ่าน window.opsRpc (ops-api.js) ให้ gateway verify idToken + owner_only ฝั่ง server ซึ่งต้องมี RPC action (forecast_actuals/update_plan_price/plan_economics) เปิดใน opsRpc gateway และตรวจ owner ฝั่ง backend — ยืนยันฝั่ง backend ไม่ได้และเปลี่ยน contract/auth ที่ต้องแก้ backend ด้วย ผิดกฎ (ห้ามเพิ่ม gateway/auth ที่ต้องแก้ backend, ห้ามเดา RPC action). แก้ปลอดภัยฝั่ง client เดี่ยว ๆ ไม่ได้เพราะเอาช่องวาง UID/anon key ออกอย่างเดียวจะทำให้ทั้งหน้าใช้ไม่ได้ทันที
- **`forecast.html`** — [2] หน้าการเงินเจ้าของ (forecast.html) ข้าม ops-rpc gateway ทั้งหน้า ใช้ LINE UID พิมพ์เองเป็นรหัสผ่านผ่าน anon key ทั้งอ่านและเขียนราคาแผน
  - เป็น finding ซ้ำกับ [0] (ประเด็นเดียวกัน) แนวทางแก้เหมือนกันคือย้าย forecast_actuals/update_plan_price/plan_economics ไปผ่าน window.opsRpc + ตัดสิทธิ์ owner_only จาก idToken ฝั่ง server และเลิกรับ p_uid/cache UID — ต้องแก้ backend gateway ด้วย ยืนยัน RPC action ในฝั่ง opsRpc ไม่ได้ จึงไม่เดาแก้ ผิดกฎ (backend/auth). ปล่อยให้ทีม backend จัดการ
- **`group-checkout.html`** — [0] book_group_cart/book_group_split ไม่มี idempotency → hold/ออเดอร์ซ้ำเมื่อ response หลุด
  - แนวทางแก้จริงคือส่ง p_idempotency_key ให้ server dedup ซึ่งเป็นการเพิ่ม param ใหม่ในสัญญา RPC ที่ backend ต้องรองรับด้วย (ไม่รู้ว่ามีจริงฝั่ง server) — เกินขอบเขต client. ส่วนการ 'ไม่คืนปุ่มก่อนยืนยัน commit' ก็ไม่ช่วยจริงถ้าไม่มี dedup ฝั่ง server (network error หลัง commit สำเร็จยังทำให้จองซ้ำได้). ปัจจุบันมี guard btn.disabled ระหว่าง await + คืนใน finally อยู่แล้ว (881,903). ปล่อยให้ backend จัดการ idempotency.
- **`live.html`** — [0] announce broadcast ไม่มี idempotency key → ส่งซ้ำเมื่อ response หาย
  - แกนหลัก (idempotency/dedup key ให้ edge fn กันยิงซ้ำ + optimistic result) ต้องทำฝั่ง edge fn live-broadcast → skip. แต่ทำ client-safe mitigation ให้: แก้ข้อความ catch (บรรทัด 278) จาก 'เชื่อมต่อไม่สำเร็จ: ...' เป็น 'ไม่ทราบผล — อาจกระจายไปแล้ว อย่ากดซ้ำจนกว่าจะตรวจสอบ (...)' เพื่อไม่ชวนให้ staff กดซ้ำจน broadcast ซ้ำ. ไม่ใส่ AbortController timeout เพราะ abort จะยิ่งทำให้เข้าใจผิดว่าล้มเหลวแล้วกดซ้ำ (เสี่ยงกว่าเดิม).
- **`live.html`** — [1] ไม่มี action ตั้งสถานะเป็น 'live' → ปุ่มจบไลฟ์เข้าไม่ถึง / announce ค้างเปิด
  - การเดินสถานะเป็น 'live' + set started_at เป็น state machine/ธุรกิจฝั่ง backend ไม่รู้ว่า live_set_status รับ p_status='live' และ set started_at ให้หรือไม่ ถ้าเดาเพิ่มปุ่มเรียก setStatus(id,'live') อาจยิง status ที่ backend ไม่รองรับ → เสี่ยง. ปล่อยให้ backend/edge fn flip status เอง.
- **`live.html`** — [2] broadcast ยิงตรงด้วย publishable key ไม่ผ่าน gateway → ข้าม guard login/role
  - การ verify id_token + เช็ค role ต้องทำใน edge fn live-broadcast (หรือย้ายไปผ่าน ops-rpc gateway) = backend → skip. ฝั่ง client ได้แนบ id_token เข้า body แล้วตาม finding [4] เป็น prerequisite แต่ enforce auth เองไม่ได้ ต้องให้ server ตรวจ.
- **`live.html`** — [3] live_upsert เขียนทับด้วย id ล้วน ไม่มี version/lock → last-write-wins
  - optimistic lock ต้องมี column updated_at/version และให้ live_upsert reject เมื่อไม่ตรง = แก้ backend + data model → skip. เพิ่มแค่ฝั่ง client ไม่พอและอาจ mismatch กับ schema จริง.
- **`looks.html`** — [0] submitShare: retry หลังส่งล้ม อัปรูป+share_look ซ้ำ → look pending ซ้ำ
  - การกันกดซ้ำระหว่าง await มีอยู่แล้ว (btn.disabled=true บรรทัด 689 คืนค่าใน guard บรรทัด 693). ปัญหาที่เหลือคือ retry หลัง response หาย ทำให้ share_look สร้าง look ซ้ำ — แก้ได้ต้องส่ง client idempotency key + ให้ RPC share_look dedupe ฝั่ง backend (เปลี่ยน contract) จึงเกินขอบเขต looks.html ไฟล์เดียว. ไม่แตะไฟล์.
- **`ops-partner.html`** — [0] ฝั่ง owner ไม่มี UI ดูรายชื่อ/ผู้สมัครพาร์ทเนอร์ (service_modes/socials/place_name ฯลฯ หายเงียบ)
  - ต้องสร้างฟีเจอร์/UI ใหม่ทั้งส่วน (section รายชื่อผู้สมัคร) + ต้องมี RPC list ผ่าน ops-rpc ที่ไม่รู้ว่ามีจริงฝั่ง backend (grep ทั้ง repo ไม่มีไฟล์ไหน render คีย์เหล่านี้เลย). เกินขอบเขต client-safe (ห้ามสร้างหน้า/เพิ่ม RPC action ที่ไม่แน่ใจว่ามี) — ปล่อยให้ทีม backend/product ตัดสินใจ
- **`partner.html`** — [0] IG/TikTok/พิกัด ที่พาร์ทเนอร์กรอกตอนสมัคร ไม่มีหน้าไหนอ่านต่อ
  - partner.html ฝั่งสมัคร (partner_self_register) ส่ง place_name/lat/lng/socials ถูกต้องอยู่แล้ว บั๊กจริงคือ schema ของ partner_profile_self/partner_profile_save (backend) ไม่มีฟิลด์เหล่านี้ให้อ่าน/บันทึกทับ และหน้า owner (stylist-bookings.html/ops-partner.html) ไม่มีการแสดง — ต้องแก้ backend + ไฟล์อื่น ไม่สามารถแก้ในไฟล์เดียวได้
- **`partner.html`** — [1] service_modes ไม่ถูกใช้ + การจองฝั่งลูกค้า hardcode 'studio'
  - partner.html ส่ง service_modes ถูกต้องแล้ว บั๊กอยู่ที่ app.js (stylistCardHtml ไม่แสดงโหมด, confirmStylistBooking hardcode 'studio' ส่งเข้า pcBookSlot) และ contract p_mode ฝั่ง backend — ต้องแก้ app.js/api.js/backend ไม่เกี่ยวกับ partner.html
- **`pay.html`** — [3] group_pay_confirm ไม่มี idempotency กดยืนยันซ้ำหลัง response หลุด
  - ต้องส่ง idempotency key และให้ backend คืน 'already_confirmed' ให้ถือเป็นสำเร็จ ซึ่งเป็นการเปลี่ยน contract/พฤติกรรมฝั่ง server (ไม่รู้ว่ามี key นี้จริงไหม) — เกินขอบเขต client-safe. หมายเหตุ: onPaid มี btn.disabled กันกดรัวในหน้าเดียวอยู่แล้ว (คงไว้).
- **`purchasing.html`** — [0] รับของชุด (kind=asset) เป็น dead-end ไม่สร้าง garment ต้นทุนซ้ำ
  - po_receive เป็น RPC ฝั่ง edge function 'acct' garment สร้างจาก intake_garment (ops-rpc คนละ backend). การให้ po_receive สร้าง garment/ผูก po_id ต้องแก้ backend + data model (เพิ่ม field supply_id/po_id ใน intake) ไม่สามารถทำฝั่ง client ปลอดภัยได้ และไม่มี RPC action ที่รู้ว่ามีจริงให้เรียกเชื่อม จึง skip
- **`purchasing.html`** — [1] PO asset รับของแล้วไม่แปลงเป็น garment
  - ซ้ำประเด็นกับ [0]. การเพิ่ม branch วน items เรียก intake_garment ตอน po_receive หรือปุ่มแปลงเป็นชุด ต้องมี action/หน้าใหม่และแก้ backend ให้เชื่อม PO↔garment จึงเกินขอบเขต client-only, skip
- **`purchasing.html`** — [2] buy flow __intake prompt ขอรหัสชุดที่ต้องมีอยู่แล้ว ไม่สร้างชุดจริง
  - การให้ __intake เปิด intake.html พร้อม prefill (สร้างหน้า/flow ใหม่) หรือให้ buy_status สร้าง garment เอง ต้องอาศัยหน้า intake + RPC ฝั่ง backend ที่ผูก buy item→garment ไม่มี contract ให้เรียกฝั่ง client จึง skip ไม่เดาแก้
- **`requests.html`** — [0] คอลัมน์ "คนขอ" hardcode เลข 1 ทุกแถว + หัวเพจอ้างว่าเรียงตามดีมานด์ (requests.html:346, :172)
  - ค่าโหวต/ดีมานด์ per-request ถูก aggregate ในฝั่ง backend และคืนผ่าน RPC 'trending_requests' (meRpc ฝั่งลูกค้า, api.js:441-447 คืน field votes) เท่านั้น. หน้านี้เรียก opsRpc 'wishlist_ops_list' (requests.html:284) ซึ่งคืน row garment_requests ราย record (status/brand/item_description/budget_max/notified_at/ops_note) และไม่มี field votes/demand ให้อ่าน. การเปลี่ยน `1` เป็น `r.votes ?? 1` จะไม่แก้อาการจริง (field ไม่มีในผลลัพธ์ → ยังโชว์ 1) และ sort ตาม field ที่ไม่มีก็เป็น no-op — ต้องให้ wishlist_ops_list คืน demand/votes count (แก้ backend/data-model) ก่อน. ส่วนทางเลือกตัดคอลัมน์ทิ้ง+แก้ข้อความหัวเพจเป็นการตัดฟีเจอร์ = product decision. ทั้งสองทางอยู่นอกขอบเขต client-safe จึง skip ไม่แก้ไฟล์.
- **`seller.html`** — [0] broken-seam: acquisition รับซื้อแล้วชุดไม่เข้า garment/stock
  - seller.html ส่ง payload เข้า RPC seller_submit ถูกต้องอยู่แล้ว (บรรทัด 219-237) การจะให้ชุดที่รับซื้อกลายเป็น garment ต้องเพิ่ม RPC/พารามิเตอร์ให้ intake.html รับ acquisition_id แล้ว prefill หรือมี RPC อ่าน acquisition มาสร้าง garment ซึ่งเป็นงานฝั่ง backend + ต้องแก้ไฟล์อื่น (intake.html) แก้ในไฟล์เดียว seller.html ไม่ได้ และห้ามเดาสร้าง action ใหม่ที่ไม่รู้ว่ามีจริงฝั่ง backend จึง skip
- **`slips.html`** — [0] กล่องสลิปไม่มีปุ่มยืนยัน/ปฏิเสธ — สลิป 'รอยืนยันมือ' ไปต่อขึ้นบัญชีไม่ได้ (slips.html:137)
  - ไฟล์นี้เรียก edge function 'acct' แค่ 2 action คือ api('slips') และ api('slip_view') เท่านั้น ไม่มี action confirm/verify/settle/reject อยู่เลย การเพิ่มปุ่มยืนยัน/ปฏิเสธต้องเรียก RPC action ใหม่ (เช่น slip_confirm/slip_reject) ที่ยังไม่รู้ว่ามีจริงฝั่ง backend และต้องให้ backend โพสต์ ledger เอง ตามกฎห้ามเดาเพิ่ม RPC action ที่ไม่รู้ว่ามีจริง และการโพสต์ ledger เป็นงานฝั่ง backend/edge function ล้วน จึง skip ให้ทีม backend implement action + posting ledger ก่อน แล้วค่อยผูกปุ่มในหน้านี้
- **`today.html`** — [0] คิวรับซื้อมือสอง (acq) เป็น dead-end
  - แนวทางแก้ต้องเพิ่มปุ่ม accept/ปฏิเสธ/แปลงเป็นชุด ซึ่งพึ่ง RPC action ฝั่ง backend ที่ยืนยันไม่ได้ว่ามีจริง และการลิงก์ไป case-file.html?ref=<acquisition_id> ก็ยืนยัน contract ปลายทางไม่ได้ (แก้ได้เฉพาะ today.html) เป็นการตัดสินใจ workflow+backend จึง skip
- **`wishlist.html`** — [0] submit_garment_request ผ่าน anon client + p_uid ที่ client ส่งเอง (auth-gap PII)
  - แก้ไม่ได้ฝั่ง client อย่างเดียว. การเปลี่ยน sb.rpc('submit_garment_request',{p_uid:uid,...}) ที่บรรทัด 767 ไปเป็น window.meRpc(...) ต้องแก้ backend ด้วย 2 จุด: (1) เพิ่ม 'submit_garment_request' เข้า allowlist ของ me-rpc gateway (ไม่งั้นได้ fn_not_allowed) และ (2) ให้ server function derive customer_uid จาก idToken ที่ verify แล้วแทนการรับ p_uid — เพราะ gateway ปัจจุบัน override เฉพาะ p_customer/p_line_uid (ดู me-api.js บรรทัด 2-3) ไม่ได้เติม p_uid ที่ RPC นี้ใช้. เป็นการเปลี่ยน contract/gateway ที่ยืนยันฝั่ง backend ไม่ได้ ตามกฎจึง skip ไม่เดาแก้.
- **`disputes.html`** — [0] garments_lent เป็นแค่ตัวเลขในสัญญา ไม่ผูกชุดจริง คดี influencer_no_return ไม่มีตารางชุดที่ยืม (disputes.html:248)
  - branch ev.type==='contract' ใน renderEvidence แสดงได้เฉพาะ esign_audit ที่ edge fn acct (dispute_get) ส่งมา ไม่มี field garments_lent/loan record ใน object ev เลย การจะแก้ต้อง (1) เปลี่ยน data model สร้าง rental/loan record ผูก garment จริง+due date ตอน active สัญญา และ (2) ให้ evidence resolver ฝั่ง backend คืนตารางชุดที่ยืมเข้ามา ทั้งสองอย่างเป็น backend/data-model ไม่ใช่ client-safe เพิ่ม branch render ฝั่ง client เฉย ๆ จะไม่มีข้อมูลให้แสดง จึง skip
- **`disputes.html`** — [1] การผูกคดีกับสัญญาต้องใช้ contract uuid แต่ contracts.html ไม่แสดง/คัดลอก id ให้ (disputes.html:87)
  - ช่อง f_pref รับ uuid แล้วส่งเป็น party_ref ให้ backend ถูกต้องตาม contract อยู่แล้ว ปัญหาอยู่ที่ contracts.html (คนละไฟล์ ห้ามแตะ) ไม่โชว์ uuid ให้คัดลอก แนวทางแก้คือเพิ่มปุ่มคัดลอก id ใน contracts.html หรือให้ backend resolve contract_no->id การเปลี่ยน disputes.html ให้ส่ง contract_no แทน uuid จะทำลาย contract กับ backend (party_ref คาดหวัง uuid) จึงไม่มีทางแก้ฝั่ง client ในไฟล์นี้ skip
- **`garment.html`** — [0] Timeline ชุดไม่แสดงประวัติซ่อม/ช่าง/ค่าซ่อม — repair.html เก็บไว้แต่ garment ไม่ render (garment.html:95)
  - รากของปัญหาคือ RPC garment_timeline ไม่ได้ส่งข้อมูลซ่อมมาเลย: cycles คืนแค่ condition/opened_at/handler/complete/damage_fee/notes/wash_method/photos/stage และ events คืนแค่ at/kind/note ไม่มี repair_type/vendor/cost หรือ event kind ของงานซ่อมอยู่ใน payload เลย. การเพิ่ม kind ซ่อมใน EVT map ต้องเดา string ที่ backend ส่ง (ไม่รู้ว่าใช้ค่าอะไร) และการเพิ่ม branch render repair_type/vendor/cost เป็น no-op เพราะ field เหล่านั้นไม่มีในข้อมูลที่ RPC คืนมา. brief เองระบุว่า 'ต้องให้ garment_timeline ส่ง field มาด้วย' ซึ่งเป็นการแก้ฝั่ง backend/data-model แก้ฝั่ง client อย่างเดียวไม่ได้ผลและเสี่ยงเดา contract ผิด จึง skip.
- **`quiz.html`** — [1] quiz ไม่บันทึกผลที่ใดเลย + ไม่เก็บ personal-color season ตามชื่อ flow
  - การผูกผล quiz เข้าโปรไฟล์ต้องยิง meRpc/saveProfile ซึ่งหน้านี้ไม่เคยเรียกและเป็นการเพิ่ม behavior/contract ใหม่กับ backend, ส่วนการเพิ่มคำถามโทนสี (season/undertone) เพื่อคง framing 'Personal Color' เป็นการเพิ่มฟีเจอร์/เนื้อหาเชิง product. ทั้งสองเกินขอบเขต client-safe (สร้างฟีเจอร์/เปลี่ยน contract). ออกแบบเดิมตั้งใจส่ง state ผ่าน URL param เท่านั้น จึงไม่แก้.

## ต้องแก้ Infra (storage bucket / DNS / หน้าใหม่)

- **`accounting.html`** — [0] ปุ่ม 'พิมพ์' ใบกำกับภาษีชี้ tax-doc.html ที่ไม่มีไฟล์ (404)
  - ไฟล์ tax-doc.html ไม่มีอยู่จริงในโปรเจกต์ การแก้ต้องสร้างหน้าใหม่ (tax-doc.html) ที่อ่าน query type/id แล้วเรียก edge function 'acct' มาเรนเดอร์ ซึ่งเป็นการสร้างไฟล์/หน้าใหม่ที่กฎห้าม และต้องพึ่ง backend/infra ไม่มีหน้าปลายทางอื่นที่มีอยู่จริงให้ชี้ไปแทนได้อย่างปลอดภัย จึง skip ไม่เดาแก้ลิงก์
- **`case-file.html`** — [3] รูป QC render จาก URL ตรง (คาด bucket public) ต่างจาก KYC signed
  - การเปลี่ยน QC photos ให้เป็น bucket private + ออก signed URL เป็นการเปลี่ยน storage bucket/สิทธิ์ (public→private) และต้องแก้ฝั่งอัปโหลด/backend ที่ออก signed URL — ห้ามแก้ตามกฎ (infra) client เปลี่ยนเองไม่ได้
- **`csv.html`** — [0] ส่วนย่อย: หน้ากำพร้าไม่อยู่ใน OPS_NAV + ไม่มี client-side role gate
  - การเพิ่มลิงก์ csv.html เข้า OPS_NAV ต้องแก้ ops-menu.js (คนละไฟล์ ห้ามแตะ) และ role gate ฝั่ง client เป็นเรื่อง auth/allowlist ที่พึ่ง ops-rpc gateway อยู่แล้ว — เกินขอบเขต csv.html ไฟล์เดียว จึง skip
- **`forecast.html`** — [1] forecast.html เป็นหน้ากำพร้า ไม่มีลิงก์เข้าจาก OPS_NAV/nav ไหนเลย
  - การแก้ต้องเพิ่ม entry { href:'forecast.html', ... } ใน OPS_NAV ของไฟล์ ops-menu.js ซึ่งไม่ใช่ไฟล์ที่ได้รับมอบหมาย (แก้ได้เฉพาะ forecast.html) — เพิ่ม nav ในไฟล์นี้เองไม่ได้ ต้องให้ agent เจ้าของ ops-menu.js เป็นคนแก้ และควรทำหลังปิดช่องโหว่ auth ตาม finding ก่อนหน้า
- **`hr.html`** — [1] เอกสาร HR อัปโหลดเข้า public bucket 'hr-docs' (สำเนาบัตร ปชช. รั่ว)
  - การแก้ต้องย้ายไปอัปโหลดผ่าน edge function (แบบ kyc) เข้า private bucket และเปิดด้วย signed URL เหมือน slip_view — เป็นการเปลี่ยน storage bucket จาก public เป็น private + ต้องมี edge function/RPC ฝั่ง backend รองรับ ซึ่งอยู่นอกขอบเขต client และเปลี่ยน contract กับ backend จึงไม่เดาแก้
- **`links.html`** — [0] ปุ่ม LINE Official (lin.ee/YOUR_LINE_ID) และ LINE OpenChat (line.me/ti/g2/YOUR_OPENCHAT_ID) ยัง placeholder ลิงก์ตาย
  - ต้องใช้ ID จริงของ LINE OA (lin.ee) และ OpenChat ซึ่งไม่มีอยู่ที่ไหนเลยในโค้ด (config.js มีแค่ LIFF_ID/PIXEL_ID ไม่มี lin.ee/OpenChat). ตามกฎเหล็กห้ามใส่ค่า secret/ID จริงที่ไม่มีในโค้ด — ไม่มีก็ skip. การซ่อนการ์ดถือเป็นตัดฟีเจอร์/ตัดสินใจ product จึงไม่ทำ ต้องให้เจ้าของแทน YOUR_LINE_ID/YOUR_OPENCHAT_ID ด้วย URL จริงเอง

## ต้องตัดสินใจ Product

- **`analytics.js`** — ชั้น analytics ไม่มีวันยิง event + 3 หน้าโหลด analytics.js โดยไม่มี config.js
  - ตัว analytics.js เองถูกต้องครบ (init GA, analyticsIdentify/Track, gaEvents helper ครบ) ไม่มีบั๊กในไฟล์นี้. ปัญหาทั้งหมดอยู่ไฟล์อื่นที่แก้ไม่ได้: (1) privacy.html/rental-terms.html/contract.html ต้องเพิ่ม <script src='config.js'> ก่อน analytics.js — เป็นไฟล์อื่น ห้ามแตะ (2) การเรียก gaEvents.* ตามจุด flow (contract_signed/begin_checkout/wishlist_*) ต้องไปแก้หน้าที่เกี่ยวข้อง — ไฟล์อื่นเช่นกัน และการตัดสินใจว่าจะใช้ GA ต่อหรือลบชั้น gaEvents เป็น product decision. ภายใน analytics.js ไม่มีสิ่งที่แก้ได้อย่างปลอดภัยโดยไม่เปลี่ยน contract จึง skip
- **`case-file.html`** — [0] acquisition.status/offered_price/voucher_no อ่านแต่ไม่มีหน้าเขียน
  - ต้องสร้าง UI/ปุ่มฝั่ง ops สำหรับ set offered_price + accept + ออก voucher_no พร้อม RPC action ใหม่ฝั่ง backend (acquisition_*) ซึ่งไม่มีในระบบ client และเป็นการตัดสินใจเชิง product/flow การรับซื้อ — เกินขอบเขต แก้ใน case-file.html ไม่ได้ (ไฟล์นี้แค่ render อ่านค่า)
- **`config.js`** — [0] GA4 ตายสนิท: GA4_ID ยังเป็น placeholder และ gaEvents ไม่ถูกเรียกจากที่ไหนเลย
  - แก้ไม่ได้ภายใน config.js อย่างปลอดภัย เพราะ (1) ต้องใช้ Measurement ID จริงจาก GA4 Admin ซึ่งเป็นค่าที่ทีมการตลาดต้องกำหนด (ห้ามเดา/แต่ง ID เอง และกฎห้ามแก้คีย์ config) (2) ส่วนสำคัญของบั๊กคือ funnel ไม่เคยเรียก gaEvents.checkoutStart/paymentInitiated ต้องไปแก้ที่ app.js reserve() ซึ่งเป็นไฟล์อื่น (นอกขอบเขตไฟล์เดียวที่รับผิดชอบ). การเปลี่ยนแค่ placeholder G-XXXXXXXXXX เป็น ID ปลอมจะทำให้ analytics.js โหลด gtag ด้วย ID ผิด แย่กว่าเดิม จึงไม่แตะ
- **`hr.html`** — [2] คำศัพท์ role ของ HR (13 ค่า) ไม่ตรงกับ role matrix ของ ops-menu (5 ค่า)
  - การ sync จริงต้องแก้ ops-menu.js (เพิ่ม role ลง OPS_NAV.roles) ซึ่งเป็นอีกไฟล์ที่ห้ามแตะ · ทางเลือกในไฟล์ hr.html คือตัด dropdown ให้เหลือ 5 role แต่เป็นการลบตัวเลือก/เปลี่ยนโมเดลสิทธิ์และตำแหน่งงาน = การตัดสินใจเชิง product/นโยบายสิทธิ์ ไม่ควรเดาแก้ฝั่งเดียว
- **`rental-terms.html`** — [1] กล่อง checkbox 'ยืนยันการยอมรับ' เป็น checkbox หลอก (ติ๊กแล้วไม่บันทึก) แต่อ้างว่าใช้เป็นหลักฐานทางกฎหมาย
  - การเอากล่อง checkbox ออก/เปลี่ยนเป็นข้อความอธิบาย เป็นการตัดฟีเจอร์+ตัดสินใจเชิง UX/กฎหมาย (นโยบายการยอมรับสัญญา) ส่วนการเก็บ consent จริงต้องยิง RPC record_consent ผ่าน gateway ซึ่งต้องแก้ backend — เกินขอบเขตที่แก้ได้ฝั่ง client จึง skip ตามกฎ (ห้ามลบฟีเจอร์/ตัดสินใจเชิง product/เพิ่ม RPC ที่ไม่รู้ว่ามีจริง). หมายเหตุ: การยอมรับจริงเกิดตอนกดยืนยันการเช่าใน flow จอง (api.js acceptTerms) อยู่แล้ว
- **`shipout.html`** — [1] หน้าเตรียมส่งไม่มีใบจ่าหน้า 'ส่งออกถึงลูกค้า'
  - เป็นการตัดสินใจเชิง product/ธุรกิจว่าจ่าหน้าขาออกทำที่หน้านี้หรือที่ระบบขนส่ง การเพิ่มบล็อกใบจ่าหน้าใหม่ (ผู้รับ=ลูกค้า) เป็นการเพิ่มฟีเจอร์/เปลี่ยน flow ไม่ใช่บั๊ก client-safe จึง skip ไว้ให้เจ้าของตัดสินใจ ยังไม่แก้.
- **`wed.html`** — [1] wed.html หลุดจากระบบ i18n และ topbar ทั้งหน้า (ไม่มีปุ่มสลับภาษา/ย้อนกลับ)
  - การเพิ่ม i18n เต็มหน้าต้องเขียนคำแปล EN ให้ทุกข้อความที่ hardcode ไทย (hero, badge, alert, ปุ่ม ฯลฯ) = การตัดสินใจเชิง content/ฟีเจอร์ ไม่ใช่ bugfix ฝั่ง client ที่ปลอดภัยและ minimal ตามกฎ; ถ้าใส่แค่ topbar placeholder โดยไม่แปล ปุ่มสลับภาษาก็ไม่มีผล จึงควรให้ทีมตัดสินใจก่อนว่าจะทำ i18n เต็มหรือคงไทยล้วน
- **`wed.html`** — [2] wed.html โหลด nav.js แต่ไม่มี .lloop-topbar placeholder และไม่มี data-i18n เลย
  - ซ้ำกับ [1] — เป็น finding เดียวกัน (i18n/topbar หายทั้งหน้า) การแก้ต้องเพิ่มคำแปล EN ทุกสตริง = content/product decision + เพิ่มฟีเจอร์ นอกขอบเขต safe client fix จึง skip พร้อมให้ทีมตัดสินใจแนวทาง (ทำ topbar+TH/EN เต็ม หรือถอด nav.js ออกถ้าตั้งใจไทยล้วน)
- **`app.js`** — [0] gQuizMood ถูกเก็บแต่ไม่เคยถูกใช้ (คำถามข้อ 2 ของ quiz เป็น dead-end) — app.js:3950
  - การเชื่อม gQuizMood เข้า pipeline จริงทำฝั่ง client ปลอดภัยไม่ได้: (1) ส่ง mood ไป window.API.stylist ต้องเพิ่ม param เข้า RPC contract ที่ไม่รู้ว่า backend รองรับ (ห้ามเปลี่ยน contract) (2) เอาไปกรอง/ถ่วงน้ำหนักผ่าน setMood/personalScore ก็ map ไม่ได้ เพราะ taxonomy quiz (effortless/statement/refined/relaxed) กับ shop MOOD_ORDER/garmentGroup ทับกันแค่คำเดียว (statement) — ตาม finding quiz.html:219 ถ้า setMood(gQuizMood) ตรงๆ กริดจะว่างเปล่า การสร้าง mapping table quiz mood→brand-group เป็นการตัดสินใจ product/taxonomy ต้องให้เจ้าของนิยาม จึง skip
- **`branches.html`** — [0] จุดรับ-ส่ง (pickup/dropoff/fitting) เป็นข้อมูลลอย — ลูกค้าเลือกจุดรับ-คืนตอนจอง/คืนไม่ได้จริง (branches.html:120)
  - แก้ในไฟล์ branches.html อย่างเดียวไม่ได้ ต้องอาศัย 3 อย่างที่อยู่นอกขอบเขต: (1) เพิ่ม UI เลือกจุดรับ-ส่งฝั่งลูกค้าใน index/app.js ซึ่งเป็นไฟล์ของ agent อื่น ห้ามแตะ; (2) เพิ่ม field pickup_id/branch_id เข้า RPC book_with_backups/book_cart = เปลี่ยน contract กับ backend; (3) ตัดสินใจ product ว่าเฟสนี้ให้ลูกค้าจอง/คืนที่จุด dropoff ได้ไหม (โจทย์ระบุชัดว่า 'dropoff จองได้ไหม' เป็น product decision). อีกทั้งหน้านี้ระบุ 'เฟส 2' ชัดเจนทั้ง title/tag/banner (บรรทัด 6,51,60) แสดงว่าเจตนายังไม่เชื่อมฝั่งลูกค้า. ไม่มีจุดใดใน branches.html ที่แก้แบบปลอดภัยฝั่ง client ได้โดยไม่กระทบ contract/ไฟล์อื่น จึง skip.
- **`ig-card.html`** — [0] การ์ดราคา IG ไม่ฝัง QR/ลิงก์/รหัสที่สแกนได้ → ไม่มีเส้นสแกน→ลงหน้าชุด (ig-card.html:186)
  - การแก้จริงต้องเพิ่ม library qrcodejs (เหมือน care-label.html บรรทัด 93,147-148 ที่ใช้ QR_BASE=g.html?c=<code>) แล้วฝัง element QR ลงในการ์ดดีไซน์ 1080x1350, จัดการ redraw ทุกครั้งที่ render() (ต้องเคลียร์ container กัน canvas ซ้อน) และต้องมั่นใจว่า html2canvas จับ QR ได้ตอน download. นี่คือการเพิ่มฟีเจอร์ + เปลี่ยนดีไซน์ของ asset การตลาด (จะวาง QR มุมไหน/ใส่ไหม เป็นการตัดสินใจดีไซน์/product) ไม่ใช่ minimal safe client fix ตามกฎ จึง skip. หมายเหตุ: base URL g.html?c=<code> มีอยู่จริงในระบบแล้ว (care-label) ถ้าจะทำสามารถ replicate pattern เดิมได้เลย โดยดึง code จาก f-meta (เหมือน download() บรรทัด 248) แล้ว new QRCode(container,{text:'https://wearlloop-dotcom.github.io/g.html?c='+code,...})
- **`laundry.html`** — [1] ของขาดชิ้น (missing/complete=false) ไม่มีเส้นทางแก้กลับ ต้อง re-QC เอง (laundry.html:173)
  - การเพิ่มปุ่ม 'ยืนยันครบแล้ว' ต้องตัดสินใจ product/backend: (1) จะเรียก care_qc ด้วย condition อะไร (ชุดเดิมอาจ stain/damage ไม่ใช่ good — การยัด 'good' จะเขียนทับสภาพจริงผิด), (2) ไม่รู้ว่า backend อนุญาต update complete-only โดยไม่ re-QC ทั้งรอบไหม, ไม่มี RPC action สำหรับ 'ปลดล็อก missing' ที่ยืนยันว่ามีจริง. การ re-QC ด้วยปุ่ม 'ดี ครบ' (qc('good',true,0)) มีอยู่แล้วในพาเนล เป็น workaround ปัจจุบัน. เพิ่ม action ใหม่ = data-model/product decision จึง skip
- **`quiz.html`** — [0] vocabulary ของ mood ระหว่าง quiz กับ shop ไม่ตรงกัน (effortless/statement/refined/relaxed vs minimal/feminine/statement/party/korean/outer/swim)
  - การสร้าง mapping table จาก quiz mood ไปเป็น brand-group ของ shop เป็นการตัดสินใจเชิง product/taxonomy — ค่า effortless/refined/relaxed ไม่มีคู่ที่ชัดเจนในกลุ่มแบรนด์ shop ต้องให้ทีมกำหนดเกณฑ์เอง. นอกจากนี้ app.js ไม่ได้บริโภค mood เลย (gQuizMood เป็น dead-end ซึ่งเป็น finding ของไฟล์ app.js) ดังนั้นการแก้ค่า mood ใน quiz.html ไฟล์เดียวไม่ช่วยแก้อาการจริง และห้ามแตะ app.js ตามกฎ. คง key เดิมไว้ ไม่แก้.
- **`stylist-bookings.html`** — [0] สถานะ no_show เป็น dead-end — โชว์ได้แต่ไม่มีหน้าไหนตั้งค่าได้ (stylist-bookings.html:90)
  - หน้านี้เป็นฝั่งเจ้าของ/แสดงผลเท่านั้น การแสดง no_show เป็น badge/STLABEL ถูกต้องอยู่แล้ว (defensive) ไม่ใช่บั๊กในไฟล์นี้. ตัวผลิตสถานะ no_show ต้องเพิ่มที่ partner.html (partner_booking_update p_action='no_show') ซึ่งเป็นไฟล์ของ agent อื่น แก้ไม่ได้ (กฎข้อ 1) หรือฝั่ง backend. ส่วนทางเลือก 'ลบ no_show ทิ้ง' เป็น product decision (จะรองรับสถานะนี้ไหม) จึง skip. หมายเหตุ: ได้เพิ่มการมองเห็น/กรอง no_show ในหน้าเจ้าของแล้วตาม finding [1] เพื่อให้ไม่ถูกซ่อนเมื่อ backend คืนสถานะนี้มา

## เสี่ยง — ต้องข้อมูลเพิ่ม

- **`app.js`** — [11] การ์ดแจ้งเตือน CTA แตะแล้วไม่ไปไหน
  - ต้องแมป kind→target ที่ถูกต้องต่อชนิด (review_request→openReview(rental_id), abandon_checkout→pay/checkout) ซึ่งขึ้นกับ payload shape ที่ไม่แน่ชัดและเป็นการตัดสินใจ product ว่าปุ่มไหนพาไปไหน — เดาแล้วเสี่ยงพาไปผิดหน้า (บรีฟเองระบุ code→reRentByCode พาผิดทาง) จึงไม่แก้
- **`partner.html`** — [4] i18n: ข้อความ dynamic ไม่ถูกแปลแม้มีคำแปลใน PARTNER_EN
  - เป็นข้อจำกัดของ i18n engine ที่ collectI18n() เก็บ DOM ครั้งเดียวตอนโหลด การแก้ให้ครบต้องครอบ tr() ที่จุด render dynamic ~30 จุด (empty states, ปุ่มคิว, badge ปฏิทิน, earnings, toast ทุกตัว, gate) พร้อมเพิ่มคีย์เต็มประโยคที่ยังขาดจำนวนมาก (เช่น 'ยังไม่มีช่องเวลา — เพิ่มด้านบนได้เลย' มีแค่คีย์ย่อย 'ยังไม่มีช่องเวลา') — เป็นการรื้อทั้งไฟล์ ระดับ minor เสี่ยงทำ regression ถ้าแก้บางส่วนจะได้ UI แปลครึ่งเดียว เกินขอบเขต minimal-fix จึง skip
- **`seller.html`** — [1] field-mismatch: condition/size ของ seller เป็นคนละ vocabulary กับ intake/garment
  - gcond (บรรทัด 101) ถูกส่งเป็น condition:$('gcond').value เข้า seller_submit ตอนนี้ค่าเป็นข้อความไทย ('ใหม่ป้ายห้อย' ฯลฯ) ซึ่งเหมาะกับทีมประเมินอ่าน ถ้าเปลี่ยน option ให้มี value=new/good/fair/poor จะเปลี่ยน payload ที่ backend seller_submit เก็บ = เปลี่ยน contract กับ backend โดยไม่รู้ว่า schema acquisition รับ enum หรือไม่ อีกทั้ง finding เองระบุว่าตอนนี้ค่านี้ยังไม่ถูกส่งข้ามหน้า (ไม่มี seam ตาม [0]) การแก้จะมีความหมายก็ต่อเมื่อสร้าง bridge ตาม [0] ซึ่งเป็นงาน backend/product จึง skip ไม่เดาแก้
- **`webhooks.js`** — [0] webhooks.js เป็น dead code — ไม่มีหน้าไหนโหลดและไม่มีใครเรียก window.webhooks
  - ยืนยันแล้วว่า webhooks.js นิยาม window.webhooks (orderConfirmed/newArrivals/returnReminder/requestReview) ถูกต้องและ syntax ครบ ตัวไฟล์เองไม่มีบั๊กฝั่ง client ที่แก้ได้ ปัญหาคือ 'ไม่มีการ wire' — ทางแก้ทั้งสองทางอยู่นอกขอบเขตไฟล์นี้: (1) ลบ webhooks.js ทิ้ง = ลบฟีเจอร์ (ห้ามตามกฎ) และเป็นการแตะ/ลบไฟล์ (2) โหลด+เรียกใช้ในหน้า flow (slips.html, intake.html, laundry.html) ต้องแก้ไฟล์ HTML อื่นซึ่งห้ามแตะ เนื่องจากกฎบังคับแก้ได้เฉพาะ webhooks.js ไฟล์เดียว และการเปิดใช้งานจริงต้องอาศัยการตัดสินใจว่าจะเดินหน้า integrate n8n หรือลบทิ้ง (เชิง product/infra) จึง skip ไว้ให้ทีมตัดสินใจ ไม่แก้เอง
