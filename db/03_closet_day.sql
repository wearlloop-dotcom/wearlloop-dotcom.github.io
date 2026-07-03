-- ============================================================================
-- 03_closet_day.sql — LLOOP Day / วันเปลี่ยนตู้ (กล่องหมุนเวียนรายเดือนสำหรับสมาชิก)
-- ----------------------------------------------------------------------------
-- ✅ ปรับให้ตรง schema จริงแล้ว (ดู db/INTEGRATION.md · ยืนยันผ่าน Supabase MCP):
--   · key ด้วย customer_id uuid (ไม่ใช่ line_uid) — me-rpc เติม p_customer ให้เอง
--   · จัดกล่องจาก garments จริง (code,name,brand,tier,color_season,color_hex,
--     status='available', bust_min_in/max, waist_min_in/max)
--   · ให้คะแนนเทียบ customers.bust_in / waist_in / my_color_season
--
-- 📌 หมายเหตุ: ตาราง closet_day_prefs / closet_boxes เป็น "ของใหม่แต่ integrate แล้ว"
--    — ระบบยังไม่มี ritual กล่องรายเดือน (subscriptions เป็นคนละเรื่อง) จึงสร้างใหม่
--    ที่นี่ แต่ทุกฟังก์ชันอ้าง customer_id + อ่าน garments จริง
--
-- แนวคิด: สมาชิกเลือก "วันเปลี่ยนตู้" ประจำเดือน (1–28) → ระบบจัดกล่อง 3 ชุด
-- จากโปรไฟล์ให้อัตโนมัติ (opt-out: ไม่กดอะไร = ยืนยันอัตโนมัติ) สลับได้ 2 ชิ้น/กล่อง
-- ข้ามเดือนได้แบบไม่เสียสิทธิ์
-- หน้าเว็บ: closet-day.html เรียก RPC 6 ตัวด้านล่างผ่าน me-rpc
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ตาราง 1: closet_day_prefs — วันเปลี่ยนตู้ที่สมาชิกแต่ละคนเลือก (key = customer_id)
-- ---------------------------------------------------------------------------
create table if not exists public.closet_day_prefs (
  customer_id uuid primary key,                             -- id ในตาราง customers
  day        int  not null check (day between 1 and 28),    -- วันที่ของทุกเดือน (เลี่ยง 29–31 กันเดือนสั้น)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ตาราง 2: closet_boxes — กล่องของแต่ละเดือน (1 คน 1 กล่อง/เดือน)
-- ---------------------------------------------------------------------------
create table if not exists public.closet_boxes (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  month       text not null,                                -- 'YYYY-MM' เช่น '2026-07'
  items       jsonb not null default '[]'::jsonb,           -- [{code,name,brand,tier,season,bg}]
  status      text not null default 'draft'
              check (status in ('draft','confirmed','skipped','shipped')),
  swaps_used  int  not null default 0,                      -- สลับไปแล้วกี่ชิ้น (สูงสุด 2)
  created_at  timestamptz not null default now(),
  unique (customer_id, month)                               -- กันจัดกล่องซ้ำในเดือนเดียวกัน
);

-- ---------------------------------------------------------------------------
-- RLS: เปิดไว้แต่ "ไม่มี" policy สาธารณะ — anon แตะตารางตรง ๆ ไม่ได้เลย
-- ทุกอย่างต้องผ่านฟังก์ชัน SECURITY DEFINER ด้านล่างเท่านั้นค่ะ
-- ---------------------------------------------------------------------------
alter table public.closet_day_prefs enable row level security;
alter table public.closet_boxes     enable row level security;

-- ============================================================================
-- ตัวช่วยภายใน: จัดกล่อง 3 ชุดจาก garments จริง ให้คะแนนตามโปรไฟล์ลูกค้าคนนี้
--   คะแนน = อกพอดี(+40) + เอวพอดี(+30) + เข้าโทนสี my_color_season(+25)
--   แล้วเลี่ยงชุดที่เคยอยู่ในกล่องเดือนก่อน ๆ ของคนนี้ (times_rented ต่ำมาก่อน)
--   เฉพาะ status='available'
-- ============================================================================
create or replace function public.closet_curate_items(p_customer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bust   numeric;
  v_waist  numeric;
  v_season color_season;
  v_items  jsonb;
begin
  select c.bust_in, c.waist_in, c.my_color_season
    into v_bust, v_waist, v_season
    from public.customers c
   where c.id = p_customer
   limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code',   g.code,
           'name',   g.name,
           'brand',  g.brand,
           'tier',   g.tier,
           'season', g.color_season::text,
           'bg',     coalesce(g.color_hex, '#E7E2DA')
         )), '[]'::jsonb)
    into v_items
    from (
      select g.code, g.name, g.brand, g.tier, g.color_season, g.color_hex
        from public.garments g
       where g.status = 'available'
         -- เลี่ยงชุดที่เคยอยู่ในกล่องของลูกค้าคนนี้แล้ว
         and not exists (
           select 1
             from public.closet_boxes b,
                  jsonb_array_elements(b.items) e
            where b.customer_id = p_customer
              and e->>'code' = g.code
         )
       order by (
           case when v_bust is not null and g.bust_min_in is not null and g.bust_max_in is not null
                     and v_bust between g.bust_min_in and g.bust_max_in then 40 else 0 end
         + case when v_waist is not null and g.waist_min_in is not null and g.waist_max_in is not null
                     and v_waist between g.waist_min_in and g.waist_max_in then 30 else 0 end
         + case when v_season is not null and g.color_season = v_season then 25 else 0 end
       ) desc,
       coalesce(g.times_rented, 0) asc,
       random()
       limit 3
    ) g;

  return v_items;
end;
$$;

-- ============================================================================
-- RPC 1: closet_day_get(p_customer) → สถานะทั้งหมดของหน้า
--   {day, box:[{code,name,brand,tier,season,bg}], status, swaps_used}
--   ถ้าเดือนนี้ยังไม่มีกล่อง → จัดกล่อง draft ให้อัตโนมัติ (3 ชุด scored จาก garments จริง)
-- ============================================================================
create or replace function public.closet_day_get(p_customer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_day   int;
  v_box   public.closet_boxes%rowtype;
  v_items jsonb;
begin
  if p_customer is null then
    return jsonb_build_object('error', 'missing_customer');
  end if;

  -- วันเปลี่ยนตู้ที่เคยเลือกไว้ (null = ยังไม่เลือก)
  select day into v_day from public.closet_day_prefs where customer_id = p_customer;

  -- กล่องของเดือนนี้
  select * into v_box from public.closet_boxes
   where customer_id = p_customer and month = v_month;

  -- ยังไม่มีกล่องเดือนนี้ → จัด draft ให้อัตโนมัติ 3 ชุด (scored)
  if v_box.id is null then
    v_items := public.closet_curate_items(p_customer);

    insert into public.closet_boxes (customer_id, month, items, status, swaps_used)
    values (p_customer, v_month, v_items, 'draft', 0)
    on conflict (customer_id, month) do nothing;      -- กันชนกันตอนยิงพร้อมกัน

    select * into v_box from public.closet_boxes
     where customer_id = p_customer and month = v_month;
  end if;

  return jsonb_build_object(
    'day',        v_day,
    'box',        coalesce(v_box.items, '[]'::jsonb),
    'status',     coalesce(v_box.status, 'draft'),
    'swaps_used', coalesce(v_box.swaps_used, 0)
  );
end;
$$;

-- ============================================================================
-- RPC 2: closet_day_set(p_customer, p_day) → บันทึกวันเปลี่ยนตู้ (upsert)
-- ============================================================================
create or replace function public.closet_day_set(p_customer uuid, p_day int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_customer is null then
    return jsonb_build_object('error', 'missing_customer');
  end if;
  if p_day is null or p_day < 1 or p_day > 28 then
    return jsonb_build_object('error', 'bad_day');   -- รับเฉพาะ 1–28 ค่ะ
  end if;

  insert into public.closet_day_prefs (customer_id, day)
  values (p_customer, p_day)
  on conflict (customer_id)
  do update set day = excluded.day, updated_at = now();

  return jsonb_build_object('ok', true, 'day', p_day);
end;
$$;

-- ============================================================================
-- RPC 3: closet_box_swap(p_customer, p_out_code, p_in_code)
--   สลับชิ้นในกล่อง draft ของเดือนนี้ — สูงสุด 2 ครั้ง/กล่อง
--   ชิ้นใหม่ต้องเป็น garments จริงที่ status='available'
-- ============================================================================
create or replace function public.closet_box_swap(p_customer uuid, p_out_code text, p_in_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month  text := to_char(now(), 'YYYY-MM');
  v_box    public.closet_boxes%rowtype;
  v_kept   jsonb;
  v_in     jsonb;
begin
  if p_customer is null then
    return jsonb_build_object('error', 'missing_customer');
  end if;

  select * into v_box from public.closet_boxes
   where customer_id = p_customer and month = v_month
   for update;                                       -- ล็อกแถวกันกดรัว

  if v_box.id is null then
    return jsonb_build_object('error', 'no_box');    -- ให้เรียก closet_day_get ก่อนค่ะ
  end if;
  if v_box.status <> 'draft' then
    return jsonb_build_object('error', 'not_draft'); -- ยืนยัน/ข้ามไปแล้ว สลับไม่ได้
  end if;
  if v_box.swaps_used >= 2 then
    return jsonb_build_object('error', 'swap_limit'); -- สลับได้ 2 ชิ้นต่อกล่องนะคะ
  end if;

  -- สลับชิ้นเดิมกับตัวเอง = เสียสิทธิ์สลับฟรี ๆ — ไม่ให้ค่ะ
  if p_in_code = p_out_code then
    return jsonb_build_object('error', 'same_code');
  end if;

  -- ชิ้นที่จะเอาเข้า "อยู่ในกล่องอยู่แล้ว" → กันชุดซ้ำในกล่องเดียวกัน
  if exists (
    select 1 from jsonb_array_elements(v_box.items) e
    where e->>'code' = p_in_code and e->>'code' <> p_out_code
  ) then
    return jsonb_build_object('error', 'already_in_box');
  end if;

  -- ตัดชิ้นที่เอาออก — ต้องอยู่ในกล่องจริง
  select coalesce(jsonb_agg(e), '[]'::jsonb)
    into v_kept
    from jsonb_array_elements(v_box.items) e
   where e->>'code' <> p_out_code;

  if jsonb_array_length(v_kept) = jsonb_array_length(v_box.items) then
    return jsonb_build_object('error', 'out_not_in_box');
  end if;

  -- ดึงชิ้นใหม่จาก garments จริง (เฉพาะที่ว่างให้เช่า)
  select jsonb_build_object(
           'code', g.code, 'name', g.name, 'brand', g.brand,
           'tier', g.tier, 'season', g.color_season::text,
           'bg', coalesce(g.color_hex, '#E7E2DA'))
    into v_in
    from public.garments g
   where g.code = p_in_code
     and g.status = 'available'
   limit 1;

  if v_in is null then
    return jsonb_build_object('error', 'in_not_found');
  end if;

  update public.closet_boxes
     set items = v_kept || jsonb_build_array(v_in),
         swaps_used = swaps_used + 1
   where id = v_box.id;

  return jsonb_build_object('ok', true,
                            'swaps_used', v_box.swaps_used + 1,
                            'box', v_kept || jsonb_build_array(v_in));
end;
$$;

-- ============================================================================
-- RPC 4: closet_box_confirm(p_customer) → ยืนยันกล่องเดือนนี้ (draft → confirmed)
-- ============================================================================
create or replace function public.closet_box_confirm(p_customer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_id    uuid;
begin
  if p_customer is null then
    return jsonb_build_object('error', 'missing_customer');
  end if;

  update public.closet_boxes
     set status = 'confirmed'
   where customer_id = p_customer and month = v_month and status = 'draft'
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('error', 'no_draft_box');  -- ไม่มีกล่อง draft ให้ยืนยันค่ะ
  end if;
  return jsonb_build_object('ok', true, 'status', 'confirmed');
end;
$$;

-- ============================================================================
-- RPC 5: closet_box_skip(p_customer) → ข้ามเดือนนี้แบบไม่เสียสิทธิ์ (draft → skipped)
-- ============================================================================
create or replace function public.closet_box_skip(p_customer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_id    uuid;
begin
  if p_customer is null then
    return jsonb_build_object('error', 'missing_customer');
  end if;

  update public.closet_boxes
     set status = 'skipped'
   where customer_id = p_customer and month = v_month and status in ('draft','confirmed')
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('error', 'no_box');
  end if;
  return jsonb_build_object('ok', true, 'status', 'skipped');
end;
$$;

-- ============================================================================
-- RPC 6: closet_box_unskip(p_customer) → เปลี่ยนใจหลังกดข้าม (skipped → draft)
--   หน้าเว็บ closet-day.html เรียก supabase.rpc('closet_box_unskip', { p_customer })
-- ============================================================================
create or replace function public.closet_box_unskip(p_customer uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_box   public.closet_boxes%rowtype;
begin
  if p_customer is null then
    return json_build_object('error', 'missing_customer');
  end if;

  select * into v_box from public.closet_boxes
   where customer_id = p_customer and month = v_month
   for update;                                       -- ล็อกแถวกันกดรัว (สไตล์เดียวกับ swap)

  if v_box.id is null or v_box.status <> 'skipped' then
    return json_build_object('error', 'no_skipped_box');  -- เดือนนี้ไม่มีกล่องที่ข้ามไว้ค่ะ
  end if;

  update public.closet_boxes
     set status = 'draft'
   where id = v_box.id;

  return json_build_object('ok', true, 'status', 'draft');
end;
$$;

-- ---------------------------------------------------------------------------
-- สิทธิ์: เรียกผ่าน me-rpc (เติม p_customer จาก idToken) → grant ให้ anon+authenticated
--   ⚠️ closet_curate_items เป็นตัวช่วยภายใน — ไม่ต้อง grant ให้ anon
-- ---------------------------------------------------------------------------
grant execute on function public.closet_day_get(uuid)               to anon, authenticated;
grant execute on function public.closet_day_set(uuid, int)          to anon, authenticated;
grant execute on function public.closet_box_swap(uuid, text, text)  to anon, authenticated;
grant execute on function public.closet_box_confirm(uuid)           to anon, authenticated;
grant execute on function public.closet_box_skip(uuid)              to anon, authenticated;
grant execute on function public.closet_box_unskip(uuid)            to anon, authenticated;
