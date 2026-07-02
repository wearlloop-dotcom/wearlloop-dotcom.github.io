-- ============================================================================
-- LLOOP · P0 Moat Migration — กรกฎาคม 2026
-- คู่กับรายงาน audit-moats-2026-07.md — รันใน Supabase SQL Editor
--
-- ⚠️ สำคัญ: schema จริงอยู่นอก repo นี้ — ชื่อตาราง/คอลัมน์ด้านล่างอนุมานจาก
--    contract ที่ frontend เรียกใช้ (add_review, care_qc, seller_submit, ฯลฯ)
--    ก่อนรัน ตรวจชื่อจริงด้วย:  select table_name from information_schema.tables;
--    จุดที่ต้องเช็คชื่อ มีคอมเมนต์ [CHECK] กำกับทุกจุด
--
-- ลำดับ: §0 ตรวจก่อนรัน · §1 รีวิวติดไซซ์ · §2 สุขอนามัยตรวจสอบได้
--        §3 ปฏิทินงานลูกค้า · §4 เครื่องยนต์รับซื้อ Closet Cash · §5 สิทธิ์
-- วิธีรัน: รันทีละส่วน (§) — ส่วนไหน error ให้ก๊อปข้อความ error ส่งกลับมา ส่วนอื่นรันต่อได้
-- ============================================================================

-- ============================================================================
-- §0 ตรวจก่อนรัน — รัน 3 คำสั่งนี้ก่อน แล้วเทียบชื่อกับธง [CHECK] ข้างล่าง
-- ============================================================================
-- 0.1 มีตารางอะไรบ้าง:
--   select table_name from information_schema.tables where table_schema='public' order by 1;
-- 0.2 คอลัมน์ของตารางหลักที่สคริปต์นี้แตะ:
--   select table_name, column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name in
--     ('reviews','customers','garments','care_cycles','customer_events','acquisitions')
--   order by table_name, ordinal_position;
-- 0.3 ส่วนลดกลุ่มจริงตรงกับที่หน้าเว็บสัญญาไหม (family/group-checkout โชว์ 2→5% · 3→10% · 4→15%):
--   select * from pg_proc where proname like '%group_discount%';   -- หรือดูค่าใน app_settings
--   ถ้า DB ให้แบน 5% อย่างเดียว → ต้องแก้ DB หรือแก้หน้าเว็บ อย่าปล่อยให้สัญญาเกินจริง


-- ============================================================================
-- §1 รีวิวติดสัดส่วนผู้รีวิว (กำแพงที่ 1+4: "รีวิวจากคนไซซ์เดียวกับคุณ")
--    วิธี: ใช้ trigger snapshot ตอน insert — ไม่ต้องแก้ไส้ add_review เดิมเลย
-- ============================================================================

alter table reviews add column if not exists reviewer_height_cm numeric;   -- [CHECK] ชื่อตาราง reviews
alter table reviews add column if not exists reviewer_size text;

create or replace function trg_review_snapshot() returns trigger
language plpgsql as $$
begin
  -- snapshot ส่วนสูง/ไซซ์จากโปรไฟล์ ณ วันรีวิว (โปรไฟล์เปลี่ยนทีหลัง รีวิวเก่าไม่เพี้ยน)
  select c.height_cm, c.size
    into new.reviewer_height_cm, new.reviewer_size
  from customers c where c.id = new.customer_id;                           -- [CHECK] reviews.customer_id
  return new;
end $$;

drop trigger if exists review_snapshot on reviews;
create trigger review_snapshot before insert on reviews
  for each row when (new.reviewer_height_cm is null)
  execute function trg_review_snapshot();

-- รีวิวของชุด + ธง "คนตัวใกล้คุณ" (สูงต่าง ≤ 4 ซม. หรือไซซ์ตรง) + สรุปต่อไซซ์
create or replace function garment_reviews_sized(p_code text, p_height numeric default null, p_size text default null)
returns jsonb language sql stable security definer as $$
  with r as (
    select rv.rating, rv.fit, rv.comment, rv.photos, rv.created_at,
           rv.reviewer_height_cm, rv.reviewer_size,
           (p_height is not null and rv.reviewer_height_cm is not null
             and abs(rv.reviewer_height_cm - p_height) <= 4)
           or (p_size is not null and rv.reviewer_size = p_size) as near_you
    from reviews rv
    join garments g on g.id = rv.garment_id                                -- [CHECK] reviews.garment_id
    where g.code = p_code
    order by near_you desc, rv.created_at desc limit 30
  )
  select jsonb_build_object(
    'reviews', coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb),
    'by_size', (select coalesce(jsonb_object_agg(reviewer_size, n), '{}'::jsonb)
                from (select reviewer_size, count(*) n from r
                      where reviewer_size is not null group by 1) t)
  ) from r;
$$;


-- ============================================================================
-- §2 สุขอนามัยตรวจสอบได้ (กำแพงที่ 5)
--    frontend แก้แล้ววันนี้: laundry.html ส่ง p_method + p_handler จริงแล้ว
--    ฝั่ง DB ต้องแน่ใจว่า care_qc / care_wash_done "เขียน" ค่านั้นลง cycle
-- ============================================================================

-- ฟิลด์ฆ่าเชื้อราย cycle (เดิมไม่มีคำว่า sanitize ในระบบเลย)
alter table care_cycles add column if not exists sanitize_method text;     -- [CHECK] ชื่อตาราง care_cycles
alter table care_cycles add column if not exists sanitized_at timestamptz;

-- [CHECK] เปิดดู body ของ care_wash_done: ถ้ายังไม่เขียน wash_method/handler
-- ให้เพิ่มใน UPDATE เช่น:
--   update care_cycles set wash_method = coalesce(p_method, wash_method),
--          handler = coalesce(p_handler, handler),
--          sanitize_method = case when p_method like '%ฆ่าเชื้อ%' or p_method like '%อบ%'
--                                 then p_method end,
--          sanitized_at   = case when p_method like '%ฆ่าเชื้อ%' or p_method like '%อบ%'
--                                 then now() end
--   where ... (cycle ปัจจุบันของ p_code)

-- ประวัติความสะอาดแบบพับลิก — ให้หน้า g.html (ลูกค้าสแกนป้าย) เรียกได้
-- เปิดเผยเฉพาะ: จำนวนรอบ, เกรด, ซักล่าสุดเมื่อไหร่/วิธีไหน, QC ผ่านเมื่อไหร่
-- ไม่เปิดเผย: ชื่อพนักงาน, ค่าปรับ, เคสพิพาท
create or replace function garment_hygiene_public(p_code text)
returns jsonb language sql stable security definer as $$
  select jsonb_build_object(
    'wash_count', g.wash_count,
    'grade', g.condition_grade,
    'last_cleaned_at', (select max(c.completed_at) from care_cycles c      -- [CHECK] completed_at
                        where c.garment_id = g.id),
    'last_method', (select c.wash_method from care_cycles c
                    where c.garment_id = g.id and c.wash_method is not null
                    order by c.completed_at desc limit 1),
    'last_qc_pass', (select max(c.completed_at) from care_cycles c
                     where c.garment_id = g.id and c.condition = 'good')
  ) from garments g where g.code = p_code;
$$;
grant execute on function garment_hygiene_public(text) to anon;            -- หน้า g.html เรียกแบบ public ได้


-- ============================================================================
-- §3 ปฏิทินงานของลูกค้า (กำแพงที่ 1: สไตลิสต์ทักก่อนงาน)
--    คู่กับหน้าใหม่ my-events.html — เรียกผ่าน gateway me-rpc
--    (gateway verify LINE idToken แล้ว inject p_customer เอง — ห้าม grant ให้ anon)
-- ============================================================================

alter table customer_events add column if not exists note text;
alter table customer_events add column if not exists source text default 'self';  -- self | ops | quiz

create or replace function my_events(p_customer uuid)
returns jsonb language sql stable security definer as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'event_date', e.event_date, 'occasion', e.occasion,
    'dress_code', e.dress_code, 'note', e.note) order by e.event_date), '[]'::jsonb)
  from customer_events e
  where e.customer_id = p_customer and e.event_date >= current_date;
$$;

create or replace function add_customer_event(p jsonb, p_customer uuid)
returns jsonb language plpgsql security definer as $$
declare v_id uuid;
begin
  if (p->>'event_date')::date < current_date then
    return jsonb_build_object('error','past_date');
  end if;
  insert into customer_events (customer_id, event_date, occasion, dress_code, note, source, notified)
  values (p_customer, (p->>'event_date')::date, p->>'occasion',
          nullif(p->>'dress_code',''), nullif(p->>'note',''), 'self', false)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function remove_customer_event(p_id uuid, p_customer uuid)
returns jsonb language sql security definer as $$
  delete from customer_events where id = p_id and customer_id = p_customer
  returning jsonb_build_object('ok', true);
$$;

-- TODO (n8n/cron): งานแจ้งเตือนสไตลิสต์ — ทุกวันดึง event ที่อีก 14 วันถึงกำหนด
-- และ notified=false → แจ้งทีมจัดลุค + ทัก LINE ลูกค้า แล้ว set notified=true
-- (ธง notified มีอยู่แล้ว — ตอนนี้แค่ไม่มีอะไรยิง)


-- ============================================================================
-- §4 เครื่องยนต์รับซื้อ Closet Cash (กำแพงที่ 2)
--    คู่กับหน้าใหม่ acquisitions.html — เรียกผ่าน gateway ops-rpc (role: care/manager)
--    สถานะ: new → priced → accepted → paid → stocked  |  rejected
-- ============================================================================

alter table acquisitions add column if not exists status text default 'new';  -- [CHECK] ชื่อตาราง acquisitions
update acquisitions set status = 'new' where status is null;                   -- backfill แถวเก่า
alter table acquisitions alter column status set not null;                     -- ตัดปัญหา NULL ทิ้งทั้งระบบ
alter table acquisitions add column if not exists offered_price numeric;
alter table acquisitions add column if not exists decision_note text;
alter table acquisitions add column if not exists paid_at timestamptz;
alter table acquisitions add column if not exists pay_ref text;
-- voucher_no มีอยู่แล้ว (case-file.html อ่านโชว์) — [CHECK] ว่ามีจริง
create sequence if not exists acq_voucher_seq;

create or replace function seller_offers_list(p_status text default 'pending')
returns jsonb language sql stable security definer as $$
  with f as (
    select a.id, a.mode, a.name, a.brand, a.size, a.condition, a.item_count,
           a.asking_price, a.offered_price, a.status,
           a.seller_name, a.seller_phone, a.created_at                      -- [CHECK] ชื่อคอลัมน์ผู้ขาย
    from acquisitions a
    where case p_status
      when 'pending'  then a.status in ('new','priced')
      when 'all'      then true
      else a.status = p_status end
    order by a.created_at desc limit 100
  )
  select jsonb_build_object(
    'offers', coalesce((select jsonb_agg(to_jsonb(f)) from f), '[]'::jsonb),
    'kpi', (select jsonb_build_object(                       -- นับทุก KPI ในสแกนเดียว
      'pending',  count(*) filter (where status in ('new','priced')),
      'accepted', count(*) filter (where status = 'accepted'),
      'paid',     count(*) filter (where status = 'paid'))
      from acquisitions));
$$;

create or replace function seller_offer_get(p_id uuid)
returns jsonb language sql stable security definer as $$
  select jsonb_build_object(
    'offer', to_jsonb(a) - 'id_card_no',            -- ไม่ส่งเลขบัตรกลับหน้า list ทั่วไป
    'seller', jsonb_build_object('name', a.seller_name, 'phone', a.seller_phone,
              'bank_name', a.bank_name, 'bank_account', a.bank_account),   -- [CHECK]
    'photos', coalesce(a.photos, '[]'::jsonb))
  from acquisitions a where a.id = p_id;
$$;

create or replace function seller_offer_price(p_id uuid, p_offered numeric)
returns jsonb language sql security definer as $$
  update acquisitions
     set offered_price = p_offered,
         status = case when status = 'new' then 'priced' else status end
   where id = p_id and status in ('new','priced') and p_offered >= 0
  returning jsonb_build_object('ok', true, 'status', status);
$$;

create or replace function seller_offer_decide(p_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer as $$
begin
  if p_decision not in ('accepted','rejected') then
    return jsonb_build_object('error','bad_decision');
  end if;
  update acquisitions
     set status = p_decision, decision_note = p_note
   where id = p_id and status in ('new','priced');
  if not found then return jsonb_build_object('error','bad_state'); end if;
  -- TODO: แจ้งผู้ขายทาง LINE (ตอนนี้ผู้ขายได้แค่ "ทีมจะติดต่อกลับ" ครั้งเดียวแล้วเงียบ)
  return jsonb_build_object('ok', true, 'status', p_decision);
end $$;

create or replace function seller_offer_paid(p_id uuid, p_ref text default null)
returns jsonb language plpgsql security definer as $$
declare v_no text;
begin
  v_no := 'CC-' || to_char(now(),'YYMM') || '-' || lpad(nextval('acq_voucher_seq')::text, 4, '0');
  update acquisitions
     set status = 'paid', paid_at = now(), pay_ref = p_ref,
         voucher_no = coalesce(voucher_no, v_no)
   where id = p_id and status = 'accepted';
  if not found then return jsonb_build_object('error','bad_state'); end if;
  return (select jsonb_build_object('ok', true, 'voucher_no', voucher_no)
          from acquisitions where id = p_id);
end $$;

-- สะพานรับซื้อ→คลัง: ผูกชุดที่ intake กับ offer ต้นทาง (วัดต้นทุน-ผลตอบแทนรายดีลได้)
alter table garments add column if not exists acquisition_id uuid;         -- [CHECK]
-- [CHECK] แพตช์ intake_garment (สำคัญ — frontend ส่ง p->>'acquisition_id' มาแล้ว):
--   ใน body ของ intake_garment เพิ่มหลัง insert garments สำเร็จ:
--     if (p ? 'acquisition_id') and (p->>'acquisition_id') is not null then
--       update garments set acquisition_id = (p->>'acquisition_id')::uuid where code = v_code;
--       update acquisitions set status = 'stocked'
--        where id = (p->>'acquisition_id')::uuid and status in ('paid','accepted');
--     end if;
--   (intake.html เก็บ ?acq= ไว้ใน payload แล้ว — ไม่แพตช์ = ดีลค้างสถานะ paid ตลอด)


-- ============================================================================
-- §4.5 [CHECK] fit_confidence() parity — ฝั่ง client (app.js) เพิ่มเทอมสะโพกแล้ว:
--   if customer.hip_in > garment.hip_in + slack → หักคะแนน (hip_in - g.hip - slack) * 12
--   ให้ปรับ SQL fit_confidence() ให้คิดเหมือนกัน เพื่อไม่ให้เลข Fits% สองฝั่งเพี้ยนกัน
-- ============================================================================

-- ============================================================================
-- §5 สิทธิ์การเรียกใช้ — ตามแพทเทิร์นเดิมของระบบ
-- ============================================================================
-- · ฟังก์ชัน me-* (my_events / add_customer_event / remove_customer_event):
--     เรียกผ่าน gateway me-rpc เท่านั้น → revoke execute from anon, authenticated;
--     grant ให้ role ที่ gateway ใช้ (service_role)
-- · ฟังก์ชัน seller_offer_* : เรียกผ่าน gateway ops-rpc (role care/manager) →
--     revoke จาก anon เช่นเดียวกัน — [CHECK] เทียบกับ grant ของ seller_submit เดิม
-- · garment_hygiene_public + garment_reviews_sized : ตั้งใจให้ public (anon) ได้
-- ตัวอย่าง:
--   revoke execute on function my_events(uuid) from public, anon, authenticated;
--   grant  execute on function my_events(uuid) to service_role;
