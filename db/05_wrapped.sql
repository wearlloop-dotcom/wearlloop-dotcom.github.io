-- ============================================================
-- 05_wrapped.sql — Loop Wrapped: สรุปปีของลูกค้า (การ์ดแชร์ IG)
-- ฝั่งหน้าเว็บ: wrapped.html เรียก RPC เดียวผ่าน anon key
--   my_wrapped(p_uid, p_year) → jsonb สรุปทั้งปี:
--   { year, rentals, occasions, spent, saved_vs_buy,
--     top_garments:[{code,name,brand,bg,times}], color_season, member_since }
-- ไม่มีตารางใหม่ — อ่านสรุปจากตารางเช่า/ตารางชุด/ตารางลูกค้าที่มีอยู่แล้วเท่านั้น
-- ⚠️ TODO (ไทย): เราไม่รู้ schema จริงของระบบเช่า — ด้านล่างเขียนเทียบกับโครง
--    rentals(line_uid, garment_code, rate, starts_at, returned_at)
--    + garments(code, name, brand, color_hex)
--    + customers(line_uid, my_color_season, created_at)
--    ตอน deploy จริง "ต้องแก้ชื่อตาราง/คอลัมน์ให้ตรงกับ schema ที่ใช้อยู่จริง"
--    ถ้ายังไม่มีตาราง rentals ฟังก์ชันจะคืน json ค่าศูนย์เฉย ๆ (หน้าเว็บ fallback เป็น demo เอง)
-- ============================================================

-- ============================================================
-- RPC: my_wrapped(p_uid, p_year default null = ปีปัจจุบัน)
-- สูตรประหยัดเทียบซื้อ: ราคาเต็มโดยประมาณ = ค่าเช่า ×6 (ระบบยังไม่เก็บราคาเต็ม)
--   → saved_vs_buy = Σ(rate×6 − rate) = Σ(rate) × 5  (หน้าเว็บมี footnote บอกสมมติฐานนี้แล้ว)
-- "งานที่ไป" = จำนวนวันเริ่มเช่าที่ไม่ซ้ำกัน (ยังไม่มีคอลัมน์ occasion ในตารางเช่า
--   — TODO: ถ้า schema จริงเก็บ occasion ต่อการเช่า ให้เปลี่ยนมานับจากคอลัมน์นั้นแทน)
-- ============================================================
create or replace function public.my_wrapped(p_uid text, p_year int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year     int := coalesce(p_year, extract(year from now())::int);
  v_rentals  bigint  := 0;
  v_occas    bigint  := 0;
  v_spent    numeric := 0;
  v_top      jsonb   := '[]'::jsonb;
  v_season   text;
  v_since    text;
begin
  -- โครง json ค่าศูนย์ — ใช้ตอบทุกกรณีที่ยังไม่มีข้อมูล (ห้าม error ใส่หน้าเว็บ)
  if p_uid is null or p_uid = '' then
    return jsonb_build_object(
      'year', v_year, 'rentals', 0, 'occasions', 0, 'spent', 0, 'saved_vs_buy', 0,
      'top_garments', '[]'::jsonb, 'color_season', null, 'member_since', null);
  end if;

  -- โทนสีประจำตัว + เป็นสมาชิกตั้งแต่ — จากตารางลูกค้า (ถ้ามี)
  -- ⚠️ TODO: แก้ชื่อตาราง/คอลัมน์ (customers.my_color_season / created_at) ให้ตรง schema จริง
  if to_regclass('public.customers') is not null then
    begin
      execute $q$
        select c.my_color_season, to_char(c.created_at, 'YYYY-MM')
        from customers c where c.line_uid = $1 limit 1
      $q$ into v_season, v_since using p_uid;
    exception when undefined_column then
      -- ชื่อคอลัมน์ไม่ตรง schema จริง — ข้ามส่วนนี้ไป (ค่าที่เหลือยังสรุปได้)
      v_season := null; v_since := null;
    end;
  end if;

  -- มีตาราง rentals ไหม — ถ้าไม่มี คืน json ค่าศูนย์ (กัน migration/runtime พัง)
  if to_regclass('public.rentals') is null then
    return jsonb_build_object(
      'year', v_year, 'rentals', 0, 'occasions', 0, 'spent', 0, 'saved_vs_buy', 0,
      'top_garments', '[]'::jsonb, 'color_season', v_season, 'member_since', v_since);
  end if;

  -- ใช้ dynamic SQL เพื่อให้สร้างฟังก์ชันได้แม้ตาราง rentals/garments ยังไม่มีตอนรัน migration
  -- ⚠️ TODO: แก้ชื่อคอลัมน์ (rate / starts_at / returned_at) ให้ตรง schema จริงตอน deploy
  begin
    execute $q$
      select count(*),
             count(distinct coalesce(r.starts_at, r.returned_at)::date),
             coalesce(sum(coalesce(r.rate, 0)), 0)
      from rentals r
      where r.line_uid = $1
        and extract(year from coalesce(r.starts_at, r.returned_at))::int = $2
    $q$ into v_rentals, v_occas, v_spent using p_uid, v_year;
  exception when undefined_column then
    -- ชื่อคอลัมน์ยังไม่ตรง schema จริง — คืนศูนย์แทน error (ตามสัญญา "ห้าม error")
    v_rentals := 0; v_occas := 0; v_spent := 0;
  end;

  -- top-3 ลุคแห่งปี — join garments เพื่อเติมชื่อ/แบรนด์/สีบล็อก (ถ้ามีตาราง)
  if to_regclass('public.garments') is not null then
    execute $q$
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select r.garment_code                       as code,
               coalesce(g.name, r.garment_code)     as name,
               g.brand                              as brand,
               coalesce(g.color_hex, '#E4F0EC')     as bg,
               count(*)                             as times
        from rentals r
        left join garments g on g.code = r.garment_code
        where r.line_uid = $1
          and extract(year from coalesce(r.starts_at, r.returned_at))::int = $2
          and r.garment_code is not null
        group by 1, 2, 3, 4
        order by times desc, code
        limit 3
      ) t
    $q$ into v_top using p_uid, v_year;
  else
    execute $q$
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
        select r.garment_code as code,
               r.garment_code as name,
               null::text     as brand,
               '#E4F0EC'      as bg,
               count(*)       as times
        from rentals r
        where r.line_uid = $1
          and extract(year from coalesce(r.starts_at, r.returned_at))::int = $2
          and r.garment_code is not null
        group by 1
        order by times desc, code
        limit 3
      ) t
    $q$ into v_top using p_uid, v_year;
  end if;

  return jsonb_build_object(
    'year',          v_year,
    'rentals',       v_rentals,
    'occasions',     v_occas,
    'spent',         round(v_spent),
    'saved_vs_buy',  round(v_spent * 5),   -- ราคาเต็ม ≈ ค่าเช่า×6 → ส่วนที่ประหยัด = ×5
    'top_garments',  v_top,
    'color_season',  v_season,
    'member_since',  v_since);
end;
$$;

-- ---------- สิทธิ์เรียกใช้: ฟังก์ชันฝั่งลูกค้า (customer-scope) ----------
-- ให้ anon/authenticated เรียกได้ตาม convention เดิม (ตารางเบื้องหลังยังปิด RLS สนิท)
-- ⚠️ อย่าลืมเพิ่ม `my_wrapped` เข้า allowlist ของ edge function me-rpc ด้วย
--    (ดูหัวข้อ "ปิดช่อง IDOR ฝั่งลูกค้า" ใน db/README.md — หลัง allowlist ใช้งานจริงแล้ว
--    ค่อย revoke จาก anon/authenticated เพื่อปิดเส้นยิงตรงที่เชื่อ p_uid จาก client)
grant execute on function public.my_wrapped(text, int) to anon, authenticated;
