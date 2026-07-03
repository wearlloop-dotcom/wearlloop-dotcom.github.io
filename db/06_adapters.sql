-- ============================================================================
-- 06_adapters.sql — Thin adapter RPCs บน "ตารางจริง" ที่มีอยู่แล้ว (ไม่มีตารางใหม่)
-- ----------------------------------------------------------------------------
-- ไฟล์นี้เพิ่ม "เฉพาะฟังก์ชันที่ระบบยังไม่มี" เท่านั้น (ยืนยันผ่าน Supabase MCP)
-- อ่าน db/INTEGRATION.md ประกอบ: ทิศทางคือ "ต่อของเดิม" ไม่สร้างตาราง/ฟังก์ชันซ้ำ
--
-- ⚠️ ฟังก์ชันฝั่งลูกค้าเหล่านี้ "มีอยู่แล้วบน Supabase" — ห้ามสร้างซ้ำในไฟล์นี้
--    (สร้างซ้ำ = overload ชนกัน → PostgREST ambiguous / เปลี่ยน return type ไม่ได้):
--      add_customer_event(p_customer uuid, p jsonb) returns jsonb
--      my_events(p_customer uuid)                   returns jsonb
--      remove_customer_event(p_customer uuid, p_id uuid) returns jsonb
--    หน้าเว็บ (my-events.html / app.js / group-checkout.html) เรียกตัวจริงเหล่านี้อยู่แล้ว
--
-- ตารางจริงที่ไฟล์นี้ใช้ (project rprwilsbjptdnvsibjgi):
--   customer_events(id, customer_id, title, event_date, occasion, dress_code,
--                   source, notified, created_at, note)
--   pickup_interest(id bigint, customer_id uuid, area text, lat, lng, source, created_at)
--
-- สิทธิ์: SECURITY DEFINER + set search_path=public (ตาม convention เดิม)
--   · ลูกค้า: pickup_interest_add                          → anon + authenticated (ผ่าน me-rpc)
--   · ops:    mark_event_notified / upcoming_customer_events → service_role เท่านั้น (ผ่าน ops-rpc)
-- ============================================================================

-- ============================================================================
-- ops: mark_event_notified(p_id) — ประทับว่าแจ้งลูกค้าแล้ว (notified=true)
--   ฝั่ง ops/automation เรียกหลังส่ง LINE push แล้ว (กันแจ้งซ้ำ)
--   (customer_events ไม่มี UPDATE policy → เขียนได้ผ่านฟังก์ชัน SECURITY DEFINER นี้เท่านั้น)
-- ============================================================================
create or replace function public.mark_event_notified(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customer_events
     set notified = true
   where id = p_id;
  if not found then
    return json_build_object('error', 'not_found');
  end if;
  return json_build_object('ok', true);
end;
$$;

-- ============================================================================
-- ops: upcoming_customer_events(p_days default 14) — คิว T-14 ฝั่งสไตลิสต์
--   งานที่ event_date อยู่ระหว่างวันนี้..+N วัน และยัง notified=false
--   ใช้โดย automation/n8n-01 (T-14 ping). หน้า today.html อ่าน customer_events ตรง
--   ผ่าน policy ev_read อยู่แล้ว — ฟังก์ชันนี้ไว้ให้ฝั่ง service-role (cron/n8n)
--   ให้ service_role เท่านั้น (เห็นข้อมูลลูกค้าทุกคน)
-- ============================================================================
create or replace function public.upcoming_customer_events(p_days int default 14)
returns table (
  id          uuid,
  customer_id uuid,
  title       text,
  event_date  date,
  occasion    text,
  dress_code  dress_code,
  source      text,
  notified    boolean,
  created_at  timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select e.id, e.customer_id, e.title, e.event_date, e.occasion,
         e.dress_code, e.source, e.notified, e.created_at
  from public.customer_events e
  where e.event_date >= current_date
    and e.event_date <= current_date + p_days
    and e.notified = false
  order by e.event_date asc, e.created_at asc;
$$;

-- ============================================================================
-- pickup_interest_add(p_customer, p_area, p_lat, p_lng) — ลูกค้ากด "สนใจให้เปิดโซนนี้"
--   insert pickup_interest(customer_id, area, lat, lng, source='web')
--   dedupe ต่อ (customer_id, area) — กดซ้ำโซนเดิมไม่บันทึกเพิ่ม
--   คืน {ok, count} = จำนวนคนที่สนใจโซน (area) นี้
-- ฝั่งหน้าเว็บ (ผ่าน me-rpc): rpc('pickup_interest_add', {p_area,p_lat,p_lng})
-- ============================================================================
create or replace function public.pickup_interest_add(
  p_customer uuid,
  p_area     text,
  p_lat      numeric,
  p_lng      numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_area  text := nullif(trim(coalesce(p_area, '')), '');
  v_count bigint;
begin
  if p_customer is null then
    return json_build_object('error', 'missing_customer');
  end if;
  if v_area is null then
    return json_build_object('error', 'missing_area');
  end if;

  -- dedupe ต่อ (customer_id, area) — คนเดิมโซนเดิม = นับ 1
  if not exists (
    select 1 from public.pickup_interest i
    where i.customer_id = p_customer and i.area = v_area
  ) then
    insert into public.pickup_interest (customer_id, area, lat, lng, source)
    values (p_customer, v_area, p_lat, p_lng, 'web');
  end if;

  select count(*) into v_count
  from public.pickup_interest i
  where i.area = v_area;

  return json_build_object('ok', true, 'count', v_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- สิทธิ์เรียกใช้
-- ---------------------------------------------------------------------------
-- ลูกค้า (เรียกผ่าน me-rpc ที่เติม p_customer จาก idToken) → anon + authenticated
grant execute on function public.pickup_interest_add(uuid, text, numeric, numeric) to anon, authenticated;

-- ops เท่านั้น — เห็น/แก้ข้อมูลลูกค้าทุกคน ต้องผ่าน ops-rpc gateway (service role)
revoke execute on function public.mark_event_notified(uuid)     from public, anon, authenticated;
revoke execute on function public.upcoming_customer_events(int) from public, anon, authenticated;
grant  execute on function public.mark_event_notified(uuid)     to service_role;
grant  execute on function public.upcoming_customer_events(int) to service_role;

-- ---------------------------------------------------------------------------
-- ⚠️ me-rpc allowlist: เพิ่ม `pickup_interest_add` เข้า allowlist ของ edge function
--    `me-rpc` (ให้ gateway เติม p_customer จาก idToken ที่ verify แล้ว)
--    ฟังก์ชันปฏิทิน (add_customer_event / my_events / remove_customer_event) มีอยู่แล้ว
--    บน Supabase และอยู่ใน allowlist อยู่แล้ว — ไม่ต้องแก้
--    (mark_event_notified / upcoming_customer_events → ops-rpc allowlist เท่านั้น)
-- ---------------------------------------------------------------------------
