-- ============================================================================
-- LLOOP · P0 Moat Migration — APPLIED 2026-07-03 (ตรงกับ schema จริง)
-- รันจริงผ่าน Supabase MCP บนโปรเจกต์ rprwilsbjptdnvsibjgi แล้ว + เทสต์ end-to-end ผ่าน
-- ไฟล์นี้เก็บไว้เป็น record ของสิ่งที่ deploy จริง (ชื่อตาราง/คอลัมน์เป็นของจริงทั้งหมด)
--
-- สรุป schema จริงที่ต่างจากที่เดาไว้รอบแรก:
--   · ตารางรีวิว (live) = customer_reviews (ไม่ใช่ reviews) — คอลัมน์ rating/fit/comment/photos/customer_id
--   · ตาราง care = care_jobs (ไม่ใช่ care_cycles) — มี wash_method + handler + closed_at + condition อยู่แล้ว
--     และ care_qc/care_wash_done เขียน wash_method+handler ให้อยู่แล้ว → ฝั่ง backend §2 แทบไม่ต้องแก้
--   · สะพานรับซื้อ→คลัง = acquisitions.garment_id (มี FK อยู่แล้ว) ไม่ใช่ garments.acquisition_id
--   · acquisitions.status default = 'submitted' (NOT NULL อยู่แล้ว) — flow: submitted→priced→accepted→paid→stocked | rejected
--   · customer_events.dress_code เป็น enum (casual/smart_casual/cocktail/formal) —
--     dress code จากลูกค้าเป็น free text จึงเก็บรวมไว้ใน note แทน
--   · security = grant-based: public read → anon+authenticated · me/ops → service_role เท่านั้น (+ rpc_never_anon)
-- ============================================================================


-- ============================================================================
-- §1 รีวิวติดสัดส่วนผู้รีวิว (moat: "รีวิวจากคนไซซ์เดียวกับคุณ")
-- ============================================================================
alter table customer_reviews add column if not exists reviewer_height_cm numeric;
alter table customer_reviews add column if not exists reviewer_size text;

create or replace function trg_review_snapshot() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  select c.height_cm, c.size into new.reviewer_height_cm, new.reviewer_size
  from customers c where c.id = new.customer_id;
  return new;
end $$;

drop trigger if exists review_snapshot on customer_reviews;
create trigger review_snapshot before insert on customer_reviews
  for each row when (new.reviewer_height_cm is null)
  execute function trg_review_snapshot();

create or replace function garment_reviews_sized(p_code text, p_height numeric default null, p_size text default null)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with r as (
    select rv.rating, rv.fit, rv.comment, rv.photos, rv.created_at,
           rv.reviewer_height_cm, rv.reviewer_size,
           coalesce(
             (p_height is not null and rv.reviewer_height_cm is not null and abs(rv.reviewer_height_cm - p_height) <= 4)
             or (p_size is not null and rv.reviewer_size = p_size), false) as near_you
    from customer_reviews rv
    join garments g on g.id = rv.garment_id
    where g.code = p_code
    order by near_you desc, rv.created_at desc limit 30
  )
  select jsonb_build_object(
    'reviews', coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb),
    'by_size', coalesce((select jsonb_object_agg(reviewer_size, n)
                from (select reviewer_size, count(*) n from r where reviewer_size is not null group by 1) t), '{}'::jsonb)
  ) from r;
$$;
grant execute on function garment_reviews_sized(text,numeric,text) to anon, authenticated, service_role;


-- ============================================================================
-- §2 สุขอนามัยตรวจสอบได้ (care_qc/care_wash_done เขียน wash_method+handler อยู่แล้ว)
-- ============================================================================
alter table care_jobs add column if not exists sanitize_method text;
alter table care_jobs add column if not exists sanitized_at timestamptz;

create or replace function garment_hygiene_public(p_code text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'wash_count', g.wash_count,
    'grade', g.condition_grade,
    'last_cleaned_at', (select max(j.closed_at) from care_jobs j where j.garment_id=g.id and j.stage='done'),
    'last_method', (select j.wash_method from care_jobs j
                    where j.garment_id=g.id and j.wash_method is not null and j.stage='done'
                    order by j.closed_at desc nulls last limit 1),
    'last_qc_pass', (select max(j.closed_at) from care_jobs j where j.garment_id=g.id and j.condition='good')
  ) from garments g where g.code = p_code;
$$;
grant execute on function garment_hygiene_public(text) to anon, authenticated, service_role;


-- ============================================================================
-- §3 ปฏิทินงานของลูกค้า (me-rpc gateway inject p_customer)
-- ============================================================================
alter table customer_events add column if not exists note text;

create or replace function my_events(p_customer uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'event_date', e.event_date, 'occasion', e.occasion,
    'dress_code', e.dress_code, 'note', e.note) order by e.event_date), '[]'::jsonb)
  from customer_events e
  where e.customer_id = p_customer and e.event_date >= current_date;
$$;

create or replace function add_customer_event(p_customer uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid;
begin
  if (p->>'event_date')::date < current_date then return jsonb_build_object('error','past_date'); end if;
  -- dress_code จากลูกค้าเป็น free text (คอลัมน์ dress_code เป็น enum) → เก็บรวมไว้ใน note
  insert into customer_events(customer_id, event_date, occasion, note, source, notified)
  values (p_customer, (p->>'event_date')::date, nullif(p->>'occasion',''),
          nullif(concat_ws(' · ', nullif(p->>'dress_code',''), nullif(p->>'note','')), ''),
          'self', false)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function remove_customer_event(p_customer uuid, p_id uuid)
returns jsonb language sql security definer set search_path to 'public' as $$
  delete from customer_events where id = p_id and customer_id = p_customer
  returning jsonb_build_object('ok', true);
$$;

revoke execute on function my_events(uuid) from public, anon, authenticated;
revoke execute on function add_customer_event(uuid,jsonb) from public, anon, authenticated;
revoke execute on function remove_customer_event(uuid,uuid) from public, anon, authenticated;
grant execute on function my_events(uuid) to service_role;
grant execute on function add_customer_event(uuid,jsonb) to service_role;
grant execute on function remove_customer_event(uuid,uuid) to service_role;
insert into rpc_never_anon(name)
select x from (values ('my_events'),('add_customer_event'),('remove_customer_event')) v(x)
where not exists (select 1 from rpc_never_anon r where r.name = v.x);

-- TODO (n8n/cron): ทุกวันดึง customer_events ที่อีก 14 วันถึงกำหนด + notified=false
-- → แจ้งทีมจัดลุค + ทัก LINE ลูกค้า แล้ว set notified=true (ธง notified พร้อมแล้ว)


-- ============================================================================
-- §4 เครื่องยนต์รับซื้อ Closet Cash (acquisitions · flow submitted→priced→accepted→paid→stocked)
-- ============================================================================
alter table acquisitions add column if not exists pay_ref text;
create sequence if not exists acq_voucher_seq;

create or replace function seller_offers_list(p_status text default 'pending')
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with f as (
    select a.id, a.mode, a.name, a.brand, a.size, a.condition, a.item_count,
           a.asking_price, a.offered_price, a.status, a.seller_name, a.seller_phone, a.created_at
    from acquisitions a
    where case p_status
      when 'pending' then a.status in ('submitted','priced')
      when 'all'     then true
      else a.status = p_status end
    order by a.created_at desc limit 100
  )
  select jsonb_build_object(
    'offers', coalesce((select jsonb_agg(to_jsonb(f)) from f), '[]'::jsonb),
    'kpi', (select jsonb_build_object(
       'pending',  count(*) filter (where status in ('submitted','priced')),
       'accepted', count(*) filter (where status = 'accepted'),
       'paid',     count(*) filter (where status = 'paid')) from acquisitions));
$$;

create or replace function seller_offer_get(p_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'offer', jsonb_build_object(
      'id', a.id, 'mode', a.mode, 'name', a.name, 'brand', a.brand, 'size', a.size,
      'condition', a.condition, 'defects', a.defects, 'item_count', a.item_count,
      'asking_price', a.asking_price, 'offered_price', a.offered_price, 'status', a.status,
      'voucher_no', a.voucher_no, 'color_name', a.color_name, 'fabric', a.fabric,
      'lot_note', a.lot_note, 'reject_reason', a.reject_reason),
    'seller', jsonb_build_object('name', a.seller_name, 'phone', a.seller_phone,
      'bank_name', a.seller_bank, 'bank_account', null),
    'photos', to_jsonb(coalesce(a.photos, '{}')))
  from acquisitions a where a.id = p_id;
$$;

create or replace function seller_offer_price(p_id uuid, p_offered numeric)
returns jsonb language sql security definer set search_path to 'public' as $$
  update acquisitions set offered_price = p_offered,
     status = case when status = 'submitted' then 'priced' else status end
   where id = p_id and status in ('submitted','priced') and p_offered >= 0
  returning jsonb_build_object('ok', true, 'status', status);
$$;

create or replace function seller_offer_decide(p_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if p_decision not in ('accepted','rejected') then return jsonb_build_object('error','bad_decision'); end if;
  update acquisitions
     set status = p_decision,
         reject_reason = case when p_decision='rejected' then p_note else reject_reason end,
         approved_at   = case when p_decision='accepted' then now() else approved_at end
   where id = p_id and status in ('submitted','priced');
  if not found then return jsonb_build_object('error','bad_state'); end if;
  return jsonb_build_object('ok', true, 'status', p_decision);
end $$;

create or replace function seller_offer_paid(p_id uuid, p_ref text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_no text;
begin
  v_no := 'CC-' || to_char(now(),'YYMM') || '-' || lpad(nextval('acq_voucher_seq')::text, 4, '0');
  update acquisitions set status='paid', paid_at=now(), pay_ref=p_ref,
     voucher_no = coalesce(voucher_no, v_no)
   where id = p_id and status = 'accepted';
  if not found then return jsonb_build_object('error','bad_state'); end if;
  return (select jsonb_build_object('ok', true, 'voucher_no', voucher_no) from acquisitions where id = p_id);
end $$;

revoke execute on function seller_offers_list(text) from public, anon, authenticated;
revoke execute on function seller_offer_get(uuid) from public, anon, authenticated;
revoke execute on function seller_offer_price(uuid,numeric) from public, anon, authenticated;
revoke execute on function seller_offer_decide(uuid,text,text) from public, anon, authenticated;
revoke execute on function seller_offer_paid(uuid,text) from public, anon, authenticated;
grant execute on function seller_offers_list(text) to service_role;
grant execute on function seller_offer_get(uuid) to service_role;
grant execute on function seller_offer_price(uuid,numeric) to service_role;
grant execute on function seller_offer_decide(uuid,text,text) to service_role;
grant execute on function seller_offer_paid(uuid,text) to service_role;
insert into rpc_never_anon(name)
select x from (values ('seller_offers_list'),('seller_offer_get'),('seller_offer_price'),('seller_offer_decide'),('seller_offer_paid')) v(x)
where not exists (select 1 from rpc_never_anon r where r.name = v.x);

-- สะพานรับซื้อ→คลัง: intake_garment รับ acquisition_id → ผูก acquisitions.garment_id + ดัน status='stocked'
-- (แพตช์เข้ากับ body เดิมของ intake_garment ที่มีอยู่ · เก็บ logic เดิมไว้ครบ เพิ่มแค่ท้ายฟังก์ชัน)
create or replace function intake_garment(p jsonb)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_code text; v_gid uuid; v_acq uuid;
begin
  v_code := nullif(p->>'code','');
  if v_code is null then v_code := 'g'||to_char(now() at time zone 'utc','YYMMDDHH24MISS'); end if;
  insert into garments (code,name,brand,tier,status,rental_price,data_status,category,dress_code,
     occasion_tags,color_hex,color_name,color_season,bust_min_in,bust_max_in,waist_min_in,waist_max_in,length_cm,
     stretch,fabric_composition,has_lining,is_sheer,fabric_weight,styling_tips,photos,acquisition_cost,missing_fields)
  values (v_code, p->>'name', p->>'brand', coalesce(nullif(p->>'tier',''),'Standard'),'available',
     nullif(p->>'rental_price','')::numeric,'needs_review',
     nullif(p->>'category','')::garment_category, nullif(p->>'dress_code','')::dress_code,
     coalesce((select array_agg(value) from jsonb_array_elements_text(p->'occasion_tags')),'{}'),
     p->>'color_hex', p->>'color_name', nullif(p->>'color_season','')::color_season,
     nullif(p->>'bust_min_in','')::numeric,nullif(p->>'bust_max_in','')::numeric,
     nullif(p->>'waist_min_in','')::numeric,nullif(p->>'waist_max_in','')::numeric,nullif(p->>'length_cm','')::numeric,
     coalesce(nullif(p->>'stretch',''),'none')::stretch_level, p->>'fabric_composition',
     nullif(p->>'has_lining','')::boolean, nullif(p->>'is_sheer','')::boolean, p->>'fabric_weight',
     coalesce((select array_agg(value) from jsonb_array_elements_text(p->'styling_tips')),'{}'),
     coalesce((select array_agg(value) from jsonb_array_elements_text(p->'photos')),'{}'),
     nullif(p->>'acquisition_cost','')::numeric, '{}')
  on conflict (code) do update set name=excluded.name, brand=excluded.brand, photos=excluded.photos,
     occasion_tags=excluded.occasion_tags, color_hex=excluded.color_hex, color_name=excluded.color_name,
     fabric_composition=excluded.fabric_composition, styling_tips=excluded.styling_tips
  returning id into v_gid;
  v_acq := nullif(p->>'acquisition_id','')::uuid;
  if v_acq is not null then
    update acquisitions set garment_id = v_gid, status = 'stocked',
       received_at = coalesce(received_at, now())
     where id = v_acq and status in ('paid','accepted');
  end if;
  return v_code;
end $function$;

-- ops_today: ซ่อนดีลที่ paid/rejected/stocked จากคิว "งานวันนี้" (กันของ stocked โผล่ซ้ำ)
-- (แพตช์ acq filter: status not in ('paid','rejected','stocked') — เดิมไม่มี 'stocked')


-- ============================================================================
-- §5 ปฏิทินงาน → จัดลุคก่อนงาน (APPLIED 2026-07-03)
-- พบว่าระบบมี cron `event-suggestions` (cron_event_suggestions, ทุกวัน 01:00) อยู่แล้ว:
--   หา customer_events ที่ยังไม่แจ้ง + ใกล้ถึง → เรียก edge fn /event-suggest (AI เลือก 3 ชุด)
--   → insert notification_queue (kind 'event_suggest') → send-line ส่ง LINE → set notified=true
-- เดิมไม่ทำงานเพราะลูกค้าเพิ่มงานเองไม่ได้ — my-events.html + add_customer_event (§3) เปิดทางเข้าให้แล้ว
-- ปรับ horizon 7 → 14 วัน ให้ตรงวิชัน "อีก 2 สัปดาห์" + เพิ่ม guard c.line_uid is not null:
--
--   create or replace function public.cron_event_suggestions() ... 
--     where not e.notified
--       and e.event_date between current_date and current_date + 14   -- เดิม +7
--       and c.line_uid is not null;
--
-- (โค้ดเต็มอยู่ในฟังก์ชันจริงบน Supabase — ส่วนที่เหลือของ body คงเดิมทุกบรรทัด)
