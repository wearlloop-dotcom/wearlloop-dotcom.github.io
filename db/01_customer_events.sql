-- ============================================================================
-- LLOOP · 01_customer_events.sql
-- ปฏิทินงานของลูกค้า (feature "ปฏิทินงานของฉัน" — my-events.html)
-- ลูกค้าบอกว่ามีงานอะไรล่วงหน้า → สไตลิสต์เตรียมลุคเชิงรุก แล้วทักไปทาง LINE
-- รันใน Supabase SQL editor ได้เลย (idempotent เท่าที่ทำได้)
-- ⚠️ ตารางชื่อ customer_calendar (ไม่ใช่ customer_events) — ระบบจริงมีตาราง
--    customer_events อยู่แล้ว (โครงอื่น: customer_id/notified ใช้โดย api.js) ห้ามชนกัน
-- ============================================================================

-- gen_random_uuid() ต้องมี pgcrypto (โปรเจกต์ Supabase ส่วนใหญ่เปิดไว้แล้ว)
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- ตารางหลัก: งานในปฏิทินของลูกค้า (1 แถว = 1 งาน)
--   line_uid   = LINE userId ของลูกค้า (ผูกกับ LIFF login ฝั่งหน้าเว็บ)
--   status     = 'planned' (เพิ่งบันทึก) · 'pinged' (สไตลิสต์ทักไปแล้ว)
--   pinged_at  = เวลาที่สไตลิสต์ทักลูกค้าไปทาง LINE แล้ว (กันทักซ้ำ)
-- ----------------------------------------------------------------------------
create table if not exists public.customer_calendar (
  id          uuid primary key default gen_random_uuid(),
  line_uid    text not null,
  date        date not null,
  occasion    text not null,          -- key จาก MOCK.OCCASIONS เช่น wedding_guest / dinner / party ...
  venue       text,                   -- ชื่องาน/สถานที่ (ข้อความอิสระ)
  dress_code  text,                   -- ค็อกเทล / ทางการ / สมาร์ทแคชชวล / ลำลอง / ตีมสี
  status      text default 'planned',
  pinged_at   timestamptz,
  created_at  timestamptz default now()
);

-- ดัชนีหลักตามรูปแบบการอ่าน: ดึงงานของลูกค้าคนหนึ่ง เรียงตามวันงาน
create index if not exists customer_calendar_uid_date_idx
  on public.customer_calendar (line_uid, date);

-- ----------------------------------------------------------------------------
-- ความปลอดภัย: เปิด RLS แต่ "ไม่สร้าง policy สาธารณะ" เลย
-- → ตารางนี้อ่าน/เขียนตรงจาก client ไม่ได้ ทุกอย่างต้องผ่านฟังก์ชัน
--   SECURITY DEFINER ด้านล่างเท่านั้น (ฟังก์ชันตรวจ line_uid ให้เอง)
-- ----------------------------------------------------------------------------
alter table public.customer_calendar enable row level security;
revoke all on public.customer_calendar from anon, authenticated;

-- ----------------------------------------------------------------------------
-- my_events(p_uid) — รายการงานทั้งหมดของลูกค้าคนนี้ เรียงตามวันงาน
-- ฝั่งหน้าเว็บ:  supabase.rpc('my_events', { p_uid })
-- ----------------------------------------------------------------------------
create or replace function public.my_events(p_uid text)
returns table (id uuid, "date" date, occasion text, venue text, dress_code text, status text)
language sql
security definer
set search_path = public
as $$
  select e.id, e.date, e.occasion, e.venue, e.dress_code, e.status
  from customer_calendar e
  where e.line_uid = p_uid
  order by e.date asc, e.created_at asc;
$$;

-- ----------------------------------------------------------------------------
-- upsert_event(...) — เพิ่มงานใหม่ (p_id เป็น null) หรือแก้งานเดิม (ส่ง p_id มา)
-- แก้ได้เฉพาะงานของ line_uid ตัวเองเท่านั้น
-- ฝั่งหน้าเว็บ:  supabase.rpc('upsert_event',
--                 { p_uid, p_id, p_date, p_occasion, p_venue, p_dress_code })
-- ----------------------------------------------------------------------------
create or replace function public.upsert_event(
  p_uid text,
  p_id uuid,
  p_date date,
  p_occasion text,
  p_venue text,
  p_dress_code text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- ตรวจข้อมูลขั้นต่ำก่อน (กันแถวขยะ)
  if p_uid is null or p_uid = '' then
    return json_build_object('error', 'missing uid');
  end if;
  if p_date is null or p_occasion is null or p_occasion = '' then
    return json_build_object('error', 'missing date/occasion');
  end if;

  if p_id is null then
    -- งานใหม่
    insert into customer_calendar (line_uid, date, occasion, venue, dress_code)
    values (p_uid, p_date, p_occasion, nullif(trim(p_venue), ''), nullif(trim(p_dress_code), ''))
    returning id into v_id;
  else
    -- แก้งานเดิม — ต้องเป็นเจ้าของ (line_uid ตรง) เท่านั้น
    update customer_calendar
       set date       = p_date,
           occasion   = p_occasion,
           venue      = nullif(trim(p_venue), ''),
           dress_code = nullif(trim(p_dress_code), '')
     where id = p_id and line_uid = p_uid
    returning id into v_id;
    if v_id is null then
      return json_build_object('error', 'not found');
    end if;
  end if;

  return json_build_object('id', v_id);
end;
$$;

-- ----------------------------------------------------------------------------
-- delete_event(p_uid, p_id) — ลบงาน (เฉพาะของตัวเอง)
-- ฝั่งหน้าเว็บ:  supabase.rpc('delete_event', { p_uid, p_id })
-- ----------------------------------------------------------------------------
create or replace function public.delete_event(p_uid text, p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from customer_calendar
   where id = p_id and line_uid = p_uid;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return json_build_object('error', 'not found');
  end if;
  return json_build_object('deleted', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- ฝั่ง ops/สไตลิสต์: upcoming_customer_events(p_days default 14)
-- งานทั้งหมดที่จะถึงภายใน N วัน (นับจากวันนี้) เรียงตามวันงาน
-- ใช้ทำคิวงานประจำวันของสไตลิสต์ — "ใครมีงานใน 2 สัปดาห์ → เตรียมลุค + ทัก LINE"
-- ----------------------------------------------------------------------------
create or replace function public.upcoming_customer_events(p_days int default 14)
returns table (
  id uuid, line_uid text, "date" date, occasion text, venue text,
  dress_code text, status text, pinged_at timestamptz, created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.line_uid, e.date, e.occasion, e.venue,
         e.dress_code, e.status, e.pinged_at, e.created_at
  from customer_calendar e
  where e.date >= current_date
    and e.date <= current_date + p_days
  order by e.date asc, e.created_at asc;
$$;

-- ----------------------------------------------------------------------------
-- mark_event_pinged(p_id) — สไตลิสต์ทักลูกค้าแล้ว → ประทับเวลา + เปลี่ยนสถานะ
-- (กันทักซ้ำ: ฝั่ง ops กรองเอาเฉพาะแถวที่ pinged_at เป็น null ไปทักได้)
-- ----------------------------------------------------------------------------
create or replace function public.mark_event_pinged(p_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  update customer_calendar
     set pinged_at = now(),
         status    = 'pinged'
   where id = p_id;
  if not found then
    return json_build_object('error', 'not found');
  end if;
  return json_build_object('ok', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- สิทธิ์เรียกใช้: หน้าเว็บเรียกด้วย anon key → ให้ execute กับ anon
-- (ตัวตารางยังปิดสนิทด้วย RLS — เข้าได้ทางฟังก์ชันพวกนี้เท่านั้น)
-- ----------------------------------------------------------------------------
grant execute on function public.my_events(text)                                   to anon, authenticated;
grant execute on function public.upsert_event(text, uuid, date, text, text, text)  to anon, authenticated;
grant execute on function public.delete_event(text, uuid)                          to anon, authenticated;

-- ----------------------------------------------------------------------------
-- ⚠️ ฝั่ง ops เท่านั้น: upcoming_customer_events / mark_event_pinged
-- สองฟังก์ชันนี้เห็นปฏิทิน + LINE UID ของลูกค้า "ทุกคน" และเปลี่ยนสถานะ pinged ได้
-- ห้ามให้ anon/authenticated เรียกเด็ดขาด — ต้องเรียกผ่าน ops-rpc edge function
-- (service role) gateway เท่านั้นค่ะ (today.html เรียกผ่าน gateway ตัวนี้อยู่แล้ว)
-- ----------------------------------------------------------------------------
revoke execute on function public.upcoming_customer_events(int) from public, anon, authenticated;
revoke execute on function public.mark_event_pinged(uuid)       from public, anon, authenticated;
grant  execute on function public.upcoming_customer_events(int) to service_role;
grant  execute on function public.mark_event_pinged(uuid)       to service_role;
