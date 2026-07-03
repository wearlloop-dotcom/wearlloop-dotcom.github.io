-- ============================================================
-- 05_wrapped.sql — Loop Wrapped: สรุปปีของลูกค้า (การ์ดแชร์ IG)
-- ✅ ปรับให้อ่าน "schema จริง" แล้ว (ดู db/INTEGRATION.md · ยืนยันผ่าน Supabase MCP)
-- ฝั่งหน้าเว็บ: wrapped.html เรียก RPC เดียวผ่าน me-rpc (gateway เติม p_customer)
--   my_wrapped(p_customer, p_year) → jsonb สรุปทั้งปี:
--   { year, rentals, occasions, spent, saved_vs_buy, saved_note,
--     top_garments:[{code,name,brand,bg,times}], color_season, member_since }
-- ไม่มีตารางใหม่ — อ่านสรุปจากตารางจริงที่มีอยู่แล้วเท่านั้น
--
-- ตารางจริงที่ใช้:
--   rentals(customer_id uuid, garment_id uuid, status, reserved_at, returned_at,
--           price numeric, shipping_fee numeric, occasion text)
--   garments(id uuid, code, name, brand, color_hex, retail_value numeric, times_rented)
--   customers(id uuid, my_color_season color_season, color_season text, created_at)
-- ยังคง to_regclass guard ไว้: ถ้าตารางไหนหาย → คืน json ค่าศูนย์ (ไม่ error)
--   เพื่อให้ migration/หน้าเว็บไม่พังตอนตารางยังไม่พร้อม
-- ============================================================

-- ล้าง overload เก่า (เวอร์ชัน text/line_uid) ถ้าเคยถูก deploy ไว้ — ตัวจริงคือ (uuid,int)
drop function if exists public.my_wrapped(text, int);

-- ============================================================
-- RPC: my_wrapped(p_customer uuid, p_year default null = ปีปัจจุบัน)
-- ปีของการเช่า = ปีจาก coalesce(returned_at, reserved_at)
-- "งานที่ไป"   = count(distinct occasion) ในปีนั้น (rentals.occasion เป็นคอลัมน์จริง)
-- เงินที่จ่าย  = Σ price + Σ shipping_fee ในปีนั้น
-- ประหยัดเทียบซื้อ = Σ garments.retail_value − Σ rentals.price ของการเช่าปีนั้น
--   (retail_value เป็น "ราคาเต็มจริงในระบบ" แล้ว — เลิกใช้สูตรประมาณ ×6)
-- ============================================================
create or replace function public.my_wrapped(p_customer uuid, p_year int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year   int     := coalesce(p_year, extract(year from now())::int);
  v_rentals bigint  := 0;
  v_occas  bigint   := 0;
  v_spent  numeric  := 0;
  v_saved  numeric  := 0;
  v_top    jsonb    := '[]'::jsonb;
  v_season text;
  v_since  text;
  v_saved_note text := 'จากราคาเต็มจริงในระบบ';
begin
  -- โครง json ค่าศูนย์ — ใช้ตอบทุกกรณีที่ยังไม่มีข้อมูล (ห้าม error ใส่หน้าเว็บ)
  if p_customer is null then
    return jsonb_build_object(
      'year', v_year, 'rentals', 0, 'occasions', 0, 'spent', 0, 'saved_vs_buy', 0,
      'saved_note', v_saved_note, 'top_garments', '[]'::jsonb,
      'color_season', null, 'member_since', null);
  end if;

  -- โทนสีประจำตัว + เป็นสมาชิกตั้งแต่ — จากตารางลูกค้าจริง (customers.id = p_customer)
  -- โทนสี: ใช้ my_color_season (enum) ก่อน แล้วค่อย fallback color_season (text)
  if to_regclass('public.customers') is not null then
    select coalesce(c.my_color_season::text, c.color_season),
           to_char(c.created_at, 'YYYY-MM')
      into v_season, v_since
      from public.customers c
     where c.id = p_customer
     limit 1;
  end if;

  -- ไม่มีตาราง rentals → คืน json ค่าศูนย์ (กัน migration/runtime พัง)
  if to_regclass('public.rentals') is null then
    return jsonb_build_object(
      'year', v_year, 'rentals', 0, 'occasions', 0, 'spent', 0, 'saved_vs_buy', 0,
      'saved_note', v_saved_note, 'top_garments', '[]'::jsonb,
      'color_season', v_season, 'member_since', v_since);
  end if;

  -- จำนวนเช่า / จำนวนงาน(distinct occasion) / เงินที่จ่าย ในปีนั้น
  select count(*),
         count(distinct r.occasion) filter (where r.occasion is not null),
         coalesce(sum(coalesce(r.price, 0)), 0)
           + coalesce(sum(coalesce(r.shipping_fee, 0)), 0)
    into v_rentals, v_occas, v_spent
    from public.rentals r
   where r.customer_id = p_customer
     and extract(year from coalesce(r.returned_at, r.reserved_at))::int = v_year;

  -- ประหยัดเทียบซื้อ + top-3 ลุคแห่งปี ต้องพึ่งตาราง garments (retail_value/ชื่อ/สี)
  if to_regclass('public.garments') is not null then
    -- Σ retail_value − Σ price ของการเช่าปีนั้น (join garment_id)
    select coalesce(sum(coalesce(g.retail_value, 0)), 0)
             - coalesce(sum(coalesce(r.price, 0)), 0)
      into v_saved
      from public.rentals r
      left join public.garments g on g.id = r.garment_id
     where r.customer_id = p_customer
       and extract(year from coalesce(r.returned_at, r.reserved_at))::int = v_year;

    -- top-3: นับจำนวนครั้งที่เช่าชุดนั้นในปี → เติมชื่อ/แบรนด์/รหัส/สีบล็อก
    select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v_top from (
      select coalesce(g.code, r.garment_id::text)  as code,
             coalesce(g.name, g.code)              as name,
             g.brand                               as brand,
             coalesce(g.color_hex, '#E4F0EC')      as bg,
             count(*)                              as times
      from public.rentals r
      join public.garments g on g.id = r.garment_id
      where r.customer_id = p_customer
        and extract(year from coalesce(r.returned_at, r.reserved_at))::int = v_year
      group by 1, 2, 3, 4
      order by times desc, code
      limit 3
    ) t;
  else
    -- ไม่มี garments → ประหยัดคิดไม่ได้ (คืน 0) + top ว่าง
    v_saved := 0;
    v_top   := '[]'::jsonb;
  end if;

  -- ประหยัดติดลบไม่สมเหตุผลกับการ์ดแชร์ — clamp ที่ 0
  if v_saved < 0 then
    v_saved := 0;
  end if;

  return jsonb_build_object(
    'year',          v_year,
    'rentals',       v_rentals,
    'occasions',     v_occas,
    'spent',         round(v_spent),
    'saved_vs_buy',  round(v_saved),
    'saved_note',    v_saved_note,     -- footnote: ประหยัดจากราคาเต็มจริงในระบบ
    'top_garments',  v_top,
    'color_season',  v_season,
    'member_since',  v_since);
end;
$$;

-- ---------- สิทธิ์เรียกใช้: ฟังก์ชันฝั่งลูกค้า (customer-scope) ----------
-- เรียกผ่าน me-rpc ที่เติม p_customer จาก idToken → ให้ anon/authenticated เรียกได้
-- ⚠️ อย่าลืมเพิ่ม `my_wrapped` เข้า allowlist ของ edge function me-rpc ด้วย
--    (ดู db/INTEGRATION.md — gateway เติม p_customer เอง ปลอม uuid ไม่ได้)
grant execute on function public.my_wrapped(uuid, int) to anon, authenticated;
