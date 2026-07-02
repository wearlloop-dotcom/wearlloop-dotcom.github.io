-- ============================================================
-- 02_fit_dna.sql — Fit DNA: ฟีดแบ็กความพอดีหลังคืนชุด
-- ฝั่งหน้าเว็บ: fit.html เรียก 3 RPC นี้ผ่าน anon key
--   1) fit_feedback_pending(p_uid)  → ชุดที่เพิ่งคืน ยังไม่ได้บอกความพอดี
--   2) submit_fit_feedback(...)     → บันทึกฟีดแบ็ก 4 จุด (อก/เอว/สะโพก/ความยาว)
--   3) my_fit_profile(p_uid)        → ฟีดแบ็กสะสมทั้งหมด (หน้าเว็บคำนวณความแม่นเอง)
-- ============================================================

-- ---------- ตารางเก็บฟีดแบ็กความพอดี ----------
create table if not exists public.fit_feedback (
  id           uuid primary key default gen_random_uuid(),
  line_uid     text not null,                 -- LINE userId ของลูกค้า
  rental_id    text,                          -- อ้างอิงรายการเช่า (text — รองรับ id ได้ทุกรูปแบบ)
  garment_code text,                          -- รหัสชุด
  bust         text,                          -- อก:     tight | fit | loose
  waist        text,                          -- เอว:    tight | fit | loose
  hip          text,                          -- สะโพก:  tight | fit | loose
  length       text,                          -- ความยาว: short | fit | long
  note         text,                          -- โน้ตสั้น ๆ จากลูกค้า (ไม่บังคับ)
  created_at   timestamptz default now(),

  -- ค่าที่ยอมรับเท่านั้น (enum-ish) — กันข้อมูลขยะจากฝั่ง client
  constraint fit_feedback_bust_chk   check (bust   is null or bust   in ('tight','fit','loose')),
  constraint fit_feedback_waist_chk  check (waist  is null or waist  in ('tight','fit','loose')),
  constraint fit_feedback_hip_chk    check (hip    is null or hip    in ('tight','fit','loose')),
  constraint fit_feedback_length_chk check (length is null or length in ('short','fit','long'))
);

-- ดึงฟีดแบ็กของลูกค้าเรียงตามเวลา — ใช้บ่อยสุด
create index if not exists fit_feedback_uid_created_idx
  on public.fit_feedback (line_uid, created_at);

-- ---------- RLS: เปิดไว้ ไม่มี policy สาธารณะ ----------
-- anon แตะตารางตรง ๆ ไม่ได้เลย — เข้าถึงได้ผ่านฟังก์ชัน SECURITY DEFINER ด้านล่างเท่านั้น
alter table public.fit_feedback enable row level security;
revoke all on public.fit_feedback from anon, authenticated;

-- ============================================================
-- RPC 1) fit_feedback_pending(p_uid)
-- ชุดที่ลูกค้าเพิ่งคืน (ภายใน 30 วัน) และยังไม่ได้ส่งฟีดแบ็ก
-- ⚠️ หมายเหตุ (ไทย): เราไม่รู้ schema จริงของระบบเช่า — ด้านล่างเขียนเทียบกับโครง
--    rentals(line_uid, garment_code, returned_at) + garments(code, name, brand, fabric)
--    ตอน deploy จริง "ต้องแก้ชื่อตาราง/คอลัมน์ให้ตรงกับตาราง rentals ที่ใช้อยู่จริง"
--    ถ้ายังไม่มีตาราง rentals ฟังก์ชันจะคืน [] เฉย ๆ (หน้าเว็บ fallback เป็น MOCK เอง)
-- ============================================================
create or replace function public.fit_feedback_pending(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb := '[]'::jsonb;
begin
  if p_uid is null or p_uid = '' then
    return '[]'::jsonb;
  end if;

  -- มีตาราง rentals ไหม — ถ้าไม่มี คืนลิสต์ว่าง (กัน migration/runtime พัง)
  if to_regclass('public.rentals') is null then
    return '[]'::jsonb;
  end if;

  -- ใช้ dynamic SQL เพื่อให้สร้างฟังก์ชันได้แม้ตาราง rentals/garments ยังไม่มีตอนรัน migration
  if to_regclass('public.garments') is not null then
    execute $q$
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select r.id::text        as rental_id,
               r.garment_code    as garment_code,
               g.name            as garment_name,
               g.brand           as brand,
               g.fabric          as fabric,
               r.returned_at     as returned_at
        from rentals r
        left join garments g on g.code = r.garment_code
        where r.line_uid = $1
          and r.returned_at is not null
          and r.returned_at > now() - interval '30 days'
          and not exists (
            select 1 from fit_feedback f
            where f.line_uid = $1 and f.rental_id = r.id::text
          )
        order by r.returned_at desc
        limit 5
      ) t
    $q$ into result using p_uid;
  else
    execute $q$
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select r.id::text     as rental_id,
               r.garment_code as garment_code,
               r.garment_code as garment_name,
               null::text     as brand,
               null::text     as fabric,
               r.returned_at  as returned_at
        from rentals r
        where r.line_uid = $1
          and r.returned_at is not null
          and r.returned_at > now() - interval '30 days'
          and not exists (
            select 1 from fit_feedback f
            where f.line_uid = $1 and f.rental_id = r.id::text
          )
        order by r.returned_at desc
        limit 5
      ) t
    $q$ into result using p_uid;
  end if;

  return result;
end;
$$;

-- ============================================================
-- RPC 2) submit_fit_feedback(...)
-- บันทึกฟีดแบ็ก 1 ชุด — ค่า bust/waist/hip = tight|fit|loose · length = short|fit|long
-- (check constraint บนตารางกันค่าผิดอีกชั้น)
-- ============================================================
create or replace function public.submit_fit_feedback(
  p_uid     text,
  p_rental  text,
  p_garment text,
  p_bust    text,
  p_waist   text,
  p_hip     text,
  p_length  text,
  p_note    text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_uid is null or p_uid = '' then
    return jsonb_build_object('error', 'missing uid');
  end if;

  -- กันส่งซ้ำ rental เดิม — ครั้งใหม่ทับความหมายครั้งเก่าไม่ได้ ให้ตอบว่าเคยส่งแล้ว
  if p_rental is not null and exists (
    select 1 from fit_feedback where line_uid = p_uid and rental_id = p_rental
  ) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  insert into fit_feedback (line_uid, rental_id, garment_code, bust, waist, hip, length, note)
  values (
    p_uid, p_rental, p_garment,
    nullif(p_bust,''), nullif(p_waist,''), nullif(p_hip,''), nullif(p_length,''),
    nullif(left(coalesce(p_note,''), 300), '')   -- จำกัดโน้ต 300 ตัวอักษร
  )
  returning id into new_id;

  return jsonb_build_object('ok', true, 'id', new_id);
end;
$$;

-- ============================================================
-- RPC 3) my_fit_profile(p_uid)
-- ฟีดแบ็กสะสมทั้งหมดของลูกค้า (พร้อมแบรนด์/เนื้อผ้าของชุด ถ้ามีตาราง garments)
-- หน้าเว็บใช้คำนวณ: ความแม่น 60% +4/ครั้ง +5/ชุดที่พอดีทุกจุด (เพดาน 98%)
-- ============================================================
create or replace function public.my_fit_profile(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  fb jsonb := '[]'::jsonb;
begin
  if p_uid is null or p_uid = '' then
    return jsonb_build_object('feedback', '[]'::jsonb);
  end if;

  -- join garments เพื่อเติมชื่อ/แบรนด์/เนื้อผ้า — ⚠️ แก้ชื่อตาราง/คอลัมน์ให้ตรง schema จริงตอน deploy
  if to_regclass('public.garments') is not null then
    execute $q$
      select coalesce(jsonb_agg(row_to_json(t) order by t.created_at), '[]'::jsonb) from (
        select f.rental_id, f.garment_code,
               g.name  as garment_name,
               g.brand as brand,
               g.fabric as fabric,
               f.bust, f.waist, f.hip, f.length, f.note, f.created_at
        from fit_feedback f
        left join garments g on g.code = f.garment_code
        where f.line_uid = $1
      ) t
    $q$ into fb using p_uid;
  else
    select coalesce(jsonb_agg(row_to_json(t) order by t.created_at), '[]'::jsonb) into fb from (
      select f.rental_id, f.garment_code,
             f.garment_code as garment_name,
             null::text as brand,
             null::text as fabric,
             f.bust, f.waist, f.hip, f.length, f.note, f.created_at
      from fit_feedback f
      where f.line_uid = p_uid
    ) t;
  end if;

  return jsonb_build_object('feedback', fb);
end;
$$;

-- ---------- สิทธิ์เรียกใช้: ให้ anon เรียก RPC ได้ (ตารางยังปิดสนิท) ----------
grant execute on function public.fit_feedback_pending(text) to anon;
grant execute on function public.submit_fit_feedback(text, text, text, text, text, text, text, text) to anon;
grant execute on function public.my_fit_profile(text) to anon;
