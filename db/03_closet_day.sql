-- ============================================================================
-- 03_closet_day.sql — LLOOP Day / วันเปลี่ยนตู้ (กล่องหมุนเวียนรายเดือนสำหรับสมาชิก)
-- ----------------------------------------------------------------------------
-- แนวคิด: สมาชิกเลือก "วันเปลี่ยนตู้" ประจำเดือน (1–28) → ระบบจัดกล่อง 3 ชุด
-- จากโปรไฟล์ให้อัตโนมัติ (opt-out: ไม่กดอะไร = ยืนยันอัตโนมัติ) สลับได้ 2 ชิ้น/กล่อง
-- ข้ามเดือนได้แบบไม่เสียสิทธิ์
--
-- หน้าเว็บ: closet-day.html เรียก RPC 6 ตัวด้านล่าง (ถ้า RPC ล้ม จะ fallback
-- localStorage + MOCK ฝั่ง client เอง)
-- รันใน Supabase SQL editor ได้เลยค่ะ
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ตาราง 1: closet_day_prefs — วันเปลี่ยนตู้ที่สมาชิกแต่ละคนเลือก
-- ---------------------------------------------------------------------------
create table if not exists public.closet_day_prefs (
  line_uid   text primary key,                              -- LINE UID ของสมาชิก
  day        int  not null check (day between 1 and 28),    -- วันที่ของทุกเดือน (เลี่ยง 29–31 กันเดือนสั้น)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ตาราง 2: closet_boxes — กล่องของแต่ละเดือน (1 คน 1 กล่อง/เดือน)
-- ---------------------------------------------------------------------------
create table if not exists public.closet_boxes (
  id         uuid primary key default gen_random_uuid(),
  line_uid   text not null,
  month      text not null,                                 -- 'YYYY-MM' เช่น '2026-07'
  items      jsonb not null default '[]'::jsonb,            -- [{code,name,brand,tier,season,bg}]
  status     text not null default 'draft'
             check (status in ('draft','confirmed','skipped','shipped')),
  swaps_used int  not null default 0,                       -- สลับไปแล้วกี่ชิ้น (สูงสุด 2)
  created_at timestamptz not null default now(),
  unique (line_uid, month)                                  -- กันจัดกล่องซ้ำในเดือนเดียวกัน
);

-- ---------------------------------------------------------------------------
-- RLS: เปิดไว้แต่ "ไม่มี" policy สาธารณะ — anon แตะตารางตรง ๆ ไม่ได้เลย
-- ทุกอย่างต้องผ่านฟังก์ชัน SECURITY DEFINER ด้านล่างเท่านั้นค่ะ
-- ---------------------------------------------------------------------------
alter table public.closet_day_prefs enable row level security;
alter table public.closet_boxes     enable row level security;

-- ============================================================================
-- RPC 1: closet_day_get(p_uid) → สถานะทั้งหมดของหน้า
--   {day, box:[{code,name,brand,tier,season,bg}], status, swaps_used}
--   ถ้าเดือนนี้ยังไม่มีกล่อง → จัดกล่อง draft ให้อัตโนมัติ (เลือก 3 ชุดจากคลัง)
-- ============================================================================
create or replace function public.closet_day_get(p_uid text)
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
  if p_uid is null or p_uid = '' then
    return jsonb_build_object('error', 'missing_uid');
  end if;

  -- วันเปลี่ยนตู้ที่เคยเลือกไว้ (null = ยังไม่เลือก)
  select day into v_day from public.closet_day_prefs where line_uid = p_uid;

  -- กล่องของเดือนนี้
  select * into v_box from public.closet_boxes
   where line_uid = p_uid and month = v_month;

  -- ยังไม่มีกล่องเดือนนี้ → จัด draft ให้อัตโนมัติ 3 ชุด
  if v_box.id is null then
    -- ⚠️ หมายเหตุ (ไทย): ด้านล่างเขียนกับโครง garments(code, name, brand, tier, season)
    --    ต้อง "ปรับชื่อตาราง/คอลัมน์ให้ตรง schema จริง" ก่อนใช้งาน เช่น เงื่อนไขชุดว่าง
    --    (status = 'available') และคอลัมน์สีพื้นหลังรูปถ้ามี
    select coalesce(jsonb_agg(jsonb_build_object(
             'code',   g.code,
             'name',   g.name,
             'brand',  g.brand,
             'tier',   g.tier,
             'season', g.season,
             'bg',     '#E7E2DA'          -- placeholder สีพื้นการ์ด — แทนด้วยคอลัมน์จริงถ้ามี
           )), '[]'::jsonb)
      into v_items
      from (
        select code, name, brand, tier, season
          from public.garments
         where true                        -- TODO: เฉพาะชุดที่ว่างให้เช่าจริง เช่น status = 'available'
         -- TODO(scoring): เรียงตามคะแนนความเหมาะของลูกค้าคนนี้แทน random() —
         --   ฟิตไซส์ (bust/waist อยู่ในช่วงของชุด) + เข้าโทนสี my_color_season (+25)
         --   + ไม่เคยอยู่ในกล่องเดือนก่อน ๆ (join closet_boxes ย้อนหลัง)
         order by random()
         limit 3
      ) g;

    insert into public.closet_boxes (line_uid, month, items, status, swaps_used)
    values (p_uid, v_month, v_items, 'draft', 0)
    on conflict (line_uid, month) do nothing;      -- กันชนกันตอนยิงพร้อมกัน

    select * into v_box from public.closet_boxes
     where line_uid = p_uid and month = v_month;
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
-- RPC 2: closet_day_set(p_uid, p_day) → บันทึกวันเปลี่ยนตู้ (upsert)
-- ============================================================================
create or replace function public.closet_day_set(p_uid text, p_day int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_uid is null or p_uid = '' then
    return jsonb_build_object('error', 'missing_uid');
  end if;
  if p_day is null or p_day < 1 or p_day > 28 then
    return jsonb_build_object('error', 'bad_day');   -- รับเฉพาะ 1–28 ค่ะ
  end if;

  insert into public.closet_day_prefs (line_uid, day)
  values (p_uid, p_day)
  on conflict (line_uid)
  do update set day = excluded.day, updated_at = now();

  return jsonb_build_object('ok', true, 'day', p_day);
end;
$$;

-- ============================================================================
-- RPC 3: closet_box_swap(p_uid, p_out_code, p_in_code)
--   สลับชิ้นในกล่อง draft ของเดือนนี้ — สูงสุด 2 ครั้ง/กล่อง
-- ============================================================================
create or replace function public.closet_box_swap(p_uid text, p_out_code text, p_in_code text)
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
  if p_uid is null or p_uid = '' then
    return jsonb_build_object('error', 'missing_uid');
  end if;

  select * into v_box from public.closet_boxes
   where line_uid = p_uid and month = v_month
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

  -- ดึงชิ้นใหม่จากคลัง
  -- ⚠️ ปรับชื่อตาราง/คอลัมน์ garments(code,name,brand,tier,season) ให้ตรง schema จริงด้วยนะคะ
  select jsonb_build_object(
           'code', g.code, 'name', g.name, 'brand', g.brand,
           'tier', g.tier, 'season', g.season, 'bg', '#E7E2DA')
    into v_in
    from public.garments g
   where g.code = p_in_code
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
-- RPC 4: closet_box_confirm(p_uid) → ยืนยันกล่องเดือนนี้ (draft → confirmed)
-- ============================================================================
create or replace function public.closet_box_confirm(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_id    uuid;
begin
  if p_uid is null or p_uid = '' then
    return jsonb_build_object('error', 'missing_uid');
  end if;

  update public.closet_boxes
     set status = 'confirmed'
   where line_uid = p_uid and month = v_month and status = 'draft'
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('error', 'no_draft_box');  -- ไม่มีกล่อง draft ให้ยืนยันค่ะ
  end if;
  return jsonb_build_object('ok', true, 'status', 'confirmed');
end;
$$;

-- ============================================================================
-- RPC 5: closet_box_skip(p_uid) → ข้ามเดือนนี้แบบไม่เสียสิทธิ์ (draft → skipped)
-- ============================================================================
create or replace function public.closet_box_skip(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_id    uuid;
begin
  if p_uid is null or p_uid = '' then
    return jsonb_build_object('error', 'missing_uid');
  end if;

  update public.closet_boxes
     set status = 'skipped'
   where line_uid = p_uid and month = v_month and status in ('draft','confirmed')
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('error', 'no_box');
  end if;
  return jsonb_build_object('ok', true, 'status', 'skipped');
end;
$$;

-- ============================================================================
-- RPC 6: closet_box_unskip(p_uid) → เปลี่ยนใจหลังกดข้าม (skipped → draft)
--   หน้าเว็บ closet-day.html เรียก supabase.rpc('closet_box_unskip', { p_uid })
-- ============================================================================
create or replace function public.closet_box_unskip(p_uid text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(now(), 'YYYY-MM');
  v_box   public.closet_boxes%rowtype;
begin
  if p_uid is null or p_uid = '' then
    return json_build_object('error', 'missing_uid');
  end if;

  select * into v_box from public.closet_boxes
   where line_uid = p_uid and month = v_month
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
-- สิทธิ์: หน้าเว็บเรียกด้วย anon key → grant execute ให้ anon (และ authenticated)
-- ---------------------------------------------------------------------------
grant execute on function public.closet_day_get(text)              to anon, authenticated;
grant execute on function public.closet_day_set(text, int)         to anon, authenticated;
grant execute on function public.closet_box_swap(text, text, text) to anon, authenticated;
grant execute on function public.closet_box_confirm(text)          to anon, authenticated;
grant execute on function public.closet_box_skip(text)             to anon, authenticated;
grant execute on function public.closet_box_unskip(text)           to anon, authenticated;
