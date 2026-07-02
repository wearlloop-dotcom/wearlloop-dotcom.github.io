-- ============================================================================
-- 04_drop_points.sql — จุดรับ-ส่งใกล้บ้าน + ชุดฉุกเฉิน (หน้า drop-points.html)
-- ----------------------------------------------------------------------------
-- แนวคิด: ใช้ร้านซักพาร์ทเนอร์/คาเฟ่/ล็อกเกอร์เป็น "จุดรับ-ส่ง" ให้ลูกค้า
--   1) drop_points          — ทะเบียนจุดรับ-ส่ง (ข้อมูลสาธารณะ อ่านผ่าน RPC เท่านั้น)
--   2) drop_point_interest  — ลูกค้ากด "สนใจให้เปิดโซนนี้" (เก็บรหัสไปรษณีย์)
--   3) express_requests     — คำขอ "ชุดฉุกเฉิน" (สั่งก่อน 15:00 รับใน 3 ชม.)
-- ความปลอดภัย: เปิด RLS ทุกตาราง + ไม่มี policy ให้ anon อ่าน/เขียนตรง ๆ
--   ทุกอย่างวิ่งผ่านฟังก์ชัน SECURITY DEFINER 3 ตัว (ตรงกับ rpc ฝั่งหน้าเว็บ):
--   drop_points_list() · drop_point_interest(p_uid,p_postal) · express_request(...)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ตารางจุดรับ-ส่ง
-- ---------------------------------------------------------------------------
create table if not exists drop_points (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                                   -- ชื่อจุด เช่น "ร้านซักพาร์ทเนอร์ ลาดพร้าว"
  type       text not null check (type in ('laundry','cafe','locker')),  -- ร้านซัก / คาเฟ่ / ล็อกเกอร์
  address    text,                                            -- ที่อยู่แบบอ่านง่าย (โชว์บนการ์ด)
  district   text,                                            -- เขต/อำเภอ — ใช้จับคู่กับรหัสไปรษณีย์ของลูกค้า
  postal     text,                                            -- รหัสไปรษณีย์ของจุด
  lat        numeric,                                         -- พิกัดสำหรับลิงก์ "เปิดแผนที่"
  lng        numeric,
  hours      text,                                            -- เวลาเปิด เช่น "09:00–20:00 ทุกวัน"
  services   text[] not null default '{return,pickup}',       -- บริการ: return=คืนชุด, pickup=รับชุด, express=ชุดฉุกเฉิน
  active     boolean not null default true,                   -- ปิดชั่วคราวได้โดยไม่ลบ
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2) ตารางความสนใจรายโซน (ลูกค้ากด "สนใจให้เปิดโซนนี้")
-- ---------------------------------------------------------------------------
create table if not exists drop_point_interest (
  id         uuid primary key default gen_random_uuid(),
  line_uid   text,                                            -- LINE UID (null ได้ — ยังไม่ล็อกอินก็กดสนใจได้)
  postal     text not null,                                   -- รหัสไปรษณีย์โซนที่อยากให้เปิด
  created_at timestamptz not null default now()
);
create index if not exists idx_dp_interest_postal on drop_point_interest (postal);

-- ---------------------------------------------------------------------------
-- 3) ตารางคำขอชุดฉุกเฉิน
-- ---------------------------------------------------------------------------
create table if not exists express_requests (
  id         uuid primary key default gen_random_uuid(),
  line_uid   text not null,                                   -- ต้องล็อกอิน LINE ก่อนส่ง (สไตลิสต์ทักกลับไปยืนยัน)
  need_date  date not null,                                   -- วันที่ต้องใส่
  occasion   text,                                            -- ประเภทงาน เช่น งานแต่ง/ดินเนอร์/รับปริญญา
  point_id   uuid references drop_points (id),                -- จุดรับที่ลูกค้าสะดวก
  size       text,                                            -- S/M/L/XL หรือ 'profile' = มีโปรไฟล์แล้ว
  status     text not null default 'new'
             check (status in ('new','picking','confirmed','ready','done','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists idx_express_requests_status on express_requests (status);

-- ---------------------------------------------------------------------------
-- เปิด RLS ทุกตาราง — ไม่มี policy = ห้าม anon แตะตารางตรง ๆ
-- (อ่าน/เขียนได้ผ่านฟังก์ชัน SECURITY DEFINER ด้านล่างเท่านั้น)
-- ---------------------------------------------------------------------------
alter table drop_points         enable row level security;
alter table drop_point_interest enable row level security;
alter table express_requests    enable row level security;

revoke all on drop_points         from anon, authenticated;
revoke all on drop_point_interest from anon, authenticated;
revoke all on express_requests    from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC 1: drop_points_list() — รายชื่อจุดรับ-ส่งที่เปิดอยู่ (ข้อมูลสาธารณะ)
-- คืน jsonb array: [{id,name,type,address,district,postal,lat,lng,hours,services[]}]
-- ---------------------------------------------------------------------------
create or replace function drop_points_list()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',       p.id,
    'name',     p.name,
    'type',     p.type,
    'address',  p.address,
    'district', p.district,
    'postal',   p.postal,
    'lat',      p.lat,
    'lng',      p.lng,
    'hours',    p.hours,
    'services', to_jsonb(p.services)
  ) order by p.created_at), '[]'::jsonb)
  from drop_points p
  where p.active;                                             -- โชว์เฉพาะจุดที่เปิดใช้งาน
$$;

-- ---------------------------------------------------------------------------
-- RPC 2: drop_point_interest(p_uid, p_postal) — บันทึกความสนใจรายโซน
-- คืน {ok:true, count:<จำนวนคนที่สนใจโซนนี้>} เอาไปโชว์ "มีคนสนใจแล้ว N คน"
-- ---------------------------------------------------------------------------
create or replace function drop_point_interest(p_uid text, p_postal text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count bigint;
begin
  -- กันข้อมูลขยะ: รหัสไปรษณีย์ไทยต้องเป็นตัวเลข 5 หลัก
  if p_postal is null or p_postal !~ '^[0-9]{5}$' then
    return jsonb_build_object('error', 'invalid_postal');
  end if;

  -- คนเดิมกดซ้ำโซนเดิม → ไม่บันทึกเพิ่ม (นับ 1 คนต่อโซน)
  if p_uid is not null and exists (
    select 1 from drop_point_interest i
    where i.line_uid = p_uid and i.postal = p_postal
  ) then
    null; -- ข้ามการ insert
  else
    insert into drop_point_interest (line_uid, postal) values (p_uid, p_postal);
  end if;

  select count(*) into v_count from drop_point_interest i where i.postal = p_postal;
  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC 3: express_request(p_uid, p_date, p_occasion, p_point, p_size)
-- คำขอ "ชุดฉุกเฉิน" — ต้องมี LINE UID (สไตลิสต์จะทักกลับไปยืนยันใน 30 นาที)
-- ---------------------------------------------------------------------------
create or replace function express_request(
  p_uid      text,
  p_date     date,
  p_occasion text,
  p_point    uuid,
  p_size     text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_uid is null or p_uid = '' then
    return jsonb_build_object('error', 'login_required');    -- ต้องล็อกอิน LINE ก่อนค่ะ
  end if;
  if p_date is null or p_date < current_date then
    return jsonb_build_object('error', 'invalid_date');      -- วันที่ต้องเป็นวันนี้เป็นต้นไป
  end if;
  if p_point is not null and not exists (
    select 1 from drop_points d where d.id = p_point and d.active
  ) then
    return jsonb_build_object('error', 'point_not_found');   -- จุดรับไม่ถูกต้อง/ปิดอยู่
  end if;

  insert into express_requests (line_uid, need_date, occasion, point_id, size)
  values (p_uid, p_date, p_occasion, p_point, p_size)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'status', 'new');
end;
$$;

-- ---------------------------------------------------------------------------
-- ให้ anon (หน้าเว็บ static) เรียก 3 RPC นี้ได้ — ตารางยังแตะตรงไม่ได้เหมือนเดิม
-- ---------------------------------------------------------------------------
grant execute on function drop_points_list()                                  to anon, authenticated;
grant execute on function drop_point_interest(text, text)                     to anon, authenticated;
grant execute on function express_request(text, date, text, uuid, text)       to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: จุดตัวอย่าง 3 จุด (ชุดเดียวกับ demo บนหน้าเว็บ)
-- ⚠️ หมายเหตุ: ตรงนี้เป็น "จุดตัวอย่าง" — แก้ชื่อ/ที่อยู่/พิกัด/เวลาเปิด
--    ให้เป็นจุดพาร์ทเนอร์จริงก่อนเปิดใช้งานจริงนะคะ
-- ---------------------------------------------------------------------------
insert into drop_points (name, type, address, district, postal, lat, lng, hours, services) values
  ('ร้านซักพาร์ทเนอร์ ลาดพร้าว',   'laundry', 'ปากซอยลาดพร้าว 23 (ใกล้ MRT ลาดพร้าว)',   'จตุจักร', '10900', 13.8160, 100.5610, '09:00–20:00 ทุกวัน', '{return,pickup,express}'),
  ('คาเฟ่พาร์ทเนอร์ อารีย์',        'cafe',    'ซอยอารีย์ 1 (เดิน 3 นาทีจาก BTS อารีย์)', 'พญาไท',   '10400', 13.7795, 100.5447, '08:00–19:00 ทุกวัน', '{return,pickup}'),
  ('ร้านซักพาร์ทเนอร์ สุขุมวิท 49', 'laundry', 'สุขุมวิท 49 (ใกล้ BTS ทองหล่อ)',           'วัฒนา',   '10110', 13.7330, 100.5735, '09:00–20:00 ทุกวัน', '{return,pickup,express}');
