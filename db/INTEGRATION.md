# LLOOP — Integration map: ฟีเจอร์ใหม่ → backend จริง (Supabase)

> อ่าน schema จริงผ่าน Supabase MCP แล้ว (โปรเจกต์ `rprwilsbjptdnvsibjgi`).
> **ทิศทางที่เลือก: ต่อของเดิม** — เลิกใช้ตารางซ้ำ (`customer_calendar`/`drop_points`/`fit_feedback`)
> แล้วให้หน้าเว็บเรียก RPC/ตารางจริงที่มีอยู่แล้ว ผ่าน gateway `me-rpc` (เติม `p_customer` จาก LINE idToken).

## Convention จริงของระบบ
- ลูกค้าอ้างด้วย **`customer_id uuid`** (ไม่ใช่ `line_uid`) — `me-rpc` เติม `p_customer` ให้เองหลัง verify idToken
- อ่านของตัวเองบางตารางมี RLS policy อนุญาต (เช่น `customer_events.ev_read` = SELECT public); เขียนต้องผ่าน RPC
- enum จริง: `dress_code` = casual/smart_casual/cocktail/formal · `color_season` = spring/summer/autumn/winter/neutral

## 1) ปฏิทินงาน + คิว T-14  (my-events.html · today.html)
มีอยู่แล้ว — **ห้ามสร้าง customer_calendar**:
- ตาราง `customer_events(id, customer_id, title, event_date, occasion, dress_code, source, notified, created_at)`
- ตาราง `event_suggestions(id, event_id, garment_id, fit_score, reason, created_at)` = ลุคที่สไตลิสต์/AI เตรียมให้
- cron `cron_event_suggestions()` = เครื่องจัดลุคล่วงหน้า (ทำงานอยู่แล้ว → นี่คือ T-14 engine)
- อ่าน: client อ่าน `customer_events` ตรงได้ (policy ev_read) กรอง `customer_id`
- เขียน (ลูกค้าเพิ่มงานเอง): ต้องมี RPC ใหม่บาง ๆ บน customer_events เช่น `add_customer_event(p_customer, p_date, p_occasion, p_title, p_dress_code)` — source='self'
- ⛔ `db/01_customer_events.sql` (customer_calendar) = **เลิกใช้** (ทำ deprecation note)

## 2) จุดรับ-ส่ง + ชุดฉุกเฉิน  (drop-points.html)
มีอยู่แล้ว — **ห้ามสร้าง drop_points/express_requests**:
- จุดรับส่ง: `pickup_list(p_include_inactive)` · `pickup_get(p_id)` · `pickup_points_active()`
  ตาราง `pickup_points(id, code, name, host_type, host_name, address, district, province, postcode, lat, lng, hours, services[], active, ...)`
  → หน้าเว็บกรองด้วย `postcode`/`district` (ไม่ใช่ postal), ประเภทจาก `host_type`
- ชุดฉุกเฉิน: `suggest_express(p_customer, p_use_date, p_limit)` · `express_cutoff_status()` · `express_dispatch_date()`
  (rentals มีคอลัมน์ `express boolean`, `pickup_point_id`, `return_point_id`, `fulfillment_method` อยู่แล้ว)
- สนใจเปิดโซน: ตาราง `pickup_interest(id, customer_id, area, lat, lng, source)` → ต้องมี RPC เขียนบาง ๆ `pickup_interest_add(p_customer, p_area, p_lat, p_lng)`
- ⛔ `db/04_drop_points.sql` = **เลิกใช้**

## 3) Fit DNA  (fit.html)
มีอยู่แล้ว — **ห้ามสร้าง fit_feedback**:
- เก็บ fit ผ่านรีวิว: `submit_review(p_rental_id, p_garment_id, p_uid, p_score, p_fit_score, p_occasion_tags, p_feel_tags, p_feel_note, p_photo_url)`
  และ `submit_video_review(..., p_fit, ...)` → `recompute_garment_fit(p_garment)` → `garments.fit_avg / fit_n / fit_label`
- อ่านความพอดี: `fit_confidence(p_customer, p_garment)` · `garment_fit_from_looks(p_code)` · ฟิลด์ fit_* บน garments
- รายการชุดที่เพิ่งคืน: `my_rentals(p_customer)` (rentals.status/returned_at/garment_id)
- fit.html = ทำเป็น "หน้าสรุป Fit + ชวนรีวิวที่ยังไม่ทำ" บนของจริง (ต่อกับ review.html เดิม)
- ⛔ `db/02_fit_dna.sql` = **เลิกใช้**

## 4) Loop Wrapped  (wrapped.html)  — ใหม่จริง ✅
- `db/05_wrapped.sql`: ปรับ `my_wrapped` ให้อ่าน schema จริง:
  - รับ `p_customer uuid` (ผ่าน me-rpc) แทน p_uid; แปลง line_uid→id ถ้าจำเป็น
  - `rentals`: นับจาก `customer_id`, ปีจาก `returned_at`/`reserved_at`, เงินจาก `price`(+`shipping_fee`), งานจาก distinct `occasion`
  - top garments: join `garments` เอา `name, brand, code, color_hex, retail_value, times_rented`
  - ประหยัด = ผลรวม `garments.retail_value` เทียบ `rentals.price` (retail จริงมีในตาราง ไม่ต้องเดา ×6)
  - โทนสี: `customers.color_season`/`my_color_season`

## 5) LLOOP Day / วันเปลี่ยนตู้  (closet-day.html)  — ใหม่จริง ✅
- ไม่มี ritual กล่องรายเดือนในระบบ (มี `subscriptions`/`subscription_plans` แต่คนละอย่าง)
- `db/03_closet_day.sql`: ปรับให้ key ด้วย `customer_id`, จัดกล่องจาก `garments` จริง
  (`code, name, brand, tier, color_season, color_hex, bust_min_in/max, waist_min_in/max, status='available'`)
  ให้คะแนนเทียบ `customers.bust_in/waist_in/my_color_season`
- ต่อ subscription จริงได้ภายหลัง (`subscriptions.rentals_per_cycle`)

## สรุปสิ่งที่ต้องทำ
1. wrapped + closet-day: ปรับ SQL (db/05, db/03) ให้ตรง schema จริง (customer_id + คอลัมน์จริง) — deploy ได้
2. my-events/today · drop-points · fit: รื้อหน้าเว็บให้เรียก RPC จริงผ่าน me-rpc (p_customer) + RPC เขียนบาง ๆ 3 ตัว
   (`add_customer_event`, `pickup_interest_add`) บน **ตารางที่มีอยู่** (ไม่ใช่ตารางใหม่)
3. db/01,02,04: ใส่ deprecation note ชี้มาที่ไฟล์นี้ (ไม่ต้อง deploy)
4. ⚠️ ยังไม่ apply อะไรลง production — รอรีวิว SQL adapter + ทดสอบก่อน
