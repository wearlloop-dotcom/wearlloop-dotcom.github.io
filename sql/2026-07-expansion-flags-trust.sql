-- =============================================================================
-- LLOOP · โมเดลขยายเฟส 1 — feature flags + trust score v1
-- คู่กับ: settings.html (การ์ด "โมเดลขยายเฟส 1") และ docs/expansion-strategy.md
--
-- วิธีติดตั้ง: รันทีละส่วนใน Supabase SQL Editor (ส่วน 1 → 4)
-- แล้วอย่าลืม 2 จุดที่อยู่นอกไฟล์นี้ (ดูส่วน 5)
--
-- หลักคิด:
--   · "การเก็บข้อมูล" ไม่มีสวิตช์ — ประวัติเช่า-คืน-QC ถูกบันทึกอยู่แล้วทุกวัน
--     คะแนนคำนวณสด (derive) จากประวัติ จึงสะสมเงียบ ๆ ตั้งแต่วันนี้โดยอัตโนมัติ
--   · สวิตช์คุมแค่ 2 ชั้นบน: แสดงผลให้ลูกค้าเห็น (trust_show_enabled)
--     กับมีผลกับมัดจำจริง (trust_pricing_enabled) — เช็คฝั่ง server เท่านั้น
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- ส่วน 1) seed คีย์ใหม่ลง app_settings (มีอยู่แล้วไม่ทับ)
-- ─────────────────────────────────────────────────────────────────────────────
insert into app_settings (key, value) values
  ('trust_show_enabled',      'false'),  -- ลูกค้าเห็นสมุดพก/tier ของตัวเอง
  ('trust_pricing_enabled',   'false'),  -- คะแนนมีผลกับมัดจำใน quote_rental
  ('passport_public_enabled', 'false'),  -- หน้าประวัติชุดสาธารณะ (แตะ NFC)
  ('consign_open_enabled',    'false'),  -- เปิดรับฝากเช่า (เฟส 2)
  ('trust_waive_min_returns', '3')       -- คืนสมบูรณ์กี่ครั้งขึ้นไปถึงยกเว้นมัดจำ
on conflict (key) do nothing;


-- ─────────────────────────────────────────────────────────────────────────────
-- ส่วน 2) ★ จุดเดียวที่ต้องปรับให้ตรง schema จริง ★
-- ตัวอ่าน "ประวัติการเช่าที่จบแล้ว" ของลูกค้า 1 คน — ทุกอย่างที่เหลือ derive จากนี่
-- แก้ชื่อตาราง/คอลัมน์ในบล็อกนี้ให้ตรงกับตารางเช่าจริง แล้วส่วน 3–4 ใช้ได้เลย
-- ─────────────────────────────────────────────────────────────────────────────
-- ตรงกับ schema จริงของตาราง rentals (ตรวจกับ information_schema ก.ค. 2026):
--   · ครบกำหนด = due_at · "คืนแล้ว" = returned_at is not null (ไม่อิงค่า status)
--   · ตรงเวลา: นับวันที่ลูกค้าส่งคืน (return_shipped_at) ถ้ามี — ไม่ลงโทษความช้าของขนส่ง
--   · QC proxy v1: ถูกหักมัดจำ = สภาพไม่ผ่าน (deposit_refund_amount < deposit)
--     ต่อท่อ QC จริง/ตารางพิพาท (dispute_*) ได้ภายหลังโดยแก้ฟังก์ชันนี้ฟังก์ชันเดียว
create or replace function trust_history(p_customer uuid)
returns table (
  on_time  boolean,   -- คืนภายในกำหนด
  qc_ok    boolean,   -- สภาพผ่าน (proxy: ไม่ถูกหักมัดจำ)
  disputed boolean,   -- มีเคส/พิพาท (v1: ยังไม่ต่อท่อ — false ไว้ก่อน)
  ended_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    (coalesce(r.return_shipped_at, r.returned_at)::date <= r.due_at::date) as on_time,
    not (coalesce(r.deposit, 0) > 0
         and r.deposit_refund_amount is not null
         and r.deposit_refund_amount < r.deposit)                          as qc_ok,
    false                                                                  as disputed,
    r.returned_at                                                          as ended_at
  from rentals r
  where r.customer_id = p_customer
    and r.returned_at is not null
    and r.cancelled_at is null
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ส่วน 3) trust score v1 — สูตร 3 ปัจจัย อธิบายได้ในประโยคเดียว:
-- "คืนสมบูรณ์ +10 · คืนช้า −15 · สภาพไม่ผ่าน −20 · มีพิพาท −40"
-- tier: NEW (ยังไม่เคยเช่า) → BRONZE (>0) → SILVER (≥50) → GOLD (≥120 และไม่มีพิพาทใน 12 เดือน)
-- ยกเว้นมัดจำเมื่อ: KYC ผ่าน + คืนสมบูรณ์ ≥ trust_waive_min_returns + ไม่มีพิพาทใน 6 เดือน
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function trust_score_get(p_customer uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_perfect int; v_late int; v_damage int; v_dispute int; v_total int;
  v_dispute_12m int; v_dispute_6m int;
  v_score int; v_tier text;
  v_waive_min int := coalesce(nullif(get_setting('trust_waive_min_returns'),'')::int, 3);
  v_kyc boolean;
begin
  select
    count(*) filter (where on_time and qc_ok and not disputed),
    count(*) filter (where not on_time),
    count(*) filter (where not qc_ok),
    count(*) filter (where disputed),
    count(*),
    count(*) filter (where disputed and ended_at > now() - interval '12 months'),
    count(*) filter (where disputed and ended_at > now() - interval '6 months')
  into v_perfect, v_late, v_damage, v_dispute, v_total, v_dispute_12m, v_dispute_6m
  from trust_history(p_customer);

  v_score := greatest(0, v_perfect*10 - v_late*15 - v_damage*20 - v_dispute*40);
  v_tier  := case
    when v_total = 0 then 'NEW'
    when v_score >= 120 and v_dispute_12m = 0 then 'GOLD'
    when v_score >= 50 then 'SILVER'
    else 'BRONZE' end;

  -- KYC: ใช้แหล่งเดียวกับ quote_rental เดิม  ★ ปรับให้ตรงของจริง
  select coalesce(c.kyc_verified, false) into v_kyc
  from customers c where c.id = p_customer;

  return jsonb_build_object(
    'score', v_score, 'tier', v_tier,
    'perfect_returns', v_perfect, 'late', v_late, 'damage', v_damage, 'disputes', v_dispute,
    'waive_deposit', (v_kyc and v_perfect >= v_waive_min and v_dispute_6m = 0),
    'waive_min', v_waive_min,
    'next_step', case
      when not v_kyc then 'ยืนยันตัวตน (KYC) เพื่อเริ่มสะสมสิทธิ์'
      when v_perfect < v_waive_min then format('คืนสมบูรณ์อีก %s ครั้ง → ไม่ต้องวางมัดจำ', v_waive_min - v_perfect)
      when v_dispute_6m > 0 then 'ไม่มีเคสใหม่ 6 เดือน → สิทธิ์กลับมา'
      else 'คุณอยู่ระดับสูงสุดของสิทธิ์มัดจำแล้ว' end
  );
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ส่วน 4) RPC ฝั่งลูกค้า trust_me — สมุดพกของฉัน
-- gate ด้วย trust_show_enabled: ปิดสวิตช์ = ลูกค้าไม่เห็นอะไรเลย (แต่คะแนนยังสะสม)
-- เรียกผ่าน gateway me-rpc เหมือน RPC ลูกค้าตัวอื่น (อย่าเปิด anon ตรง ๆ)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function trust_me(p_customer uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(get_setting('trust_show_enabled'),'false') <> 'true' then
    return jsonb_build_object('enabled', false);
  end if;
  return trust_score_get(p_customer) || jsonb_build_object('enabled', true);
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ส่วน 5) สองจุดที่ต้องแก้นอกไฟล์นี้ (สำคัญ — สวิตช์ยังไม่ครบวงจรถ้าข้าม)
-- ─────────────────────────────────────────────────────────────────────────────
-- 5.1  hub_settings_set: เพิ่ม 5 คีย์ใหม่เข้า allowlist (ไม่งั้นสวิตช์หน้า owner
--      จะได้ key_not_allowed):
--        trust_show_enabled, trust_pricing_enabled, passport_public_enabled,
--        consign_open_enabled, trust_waive_min_returns
--
-- 5.2  quote_rental: เสียบตรรกะมัดจำ (ตำแหน่งเดียวกับกติกา kyc_verified เดิม)
--      — เช็ค flag ฝั่ง server เสมอ ห้ามเชื่อค่าจากหน้าเว็บ:
--
--        if coalesce(get_setting('trust_pricing_enabled'),'false') = 'true'
--           and p_customer is not null
--           and (trust_score_get(p_customer)->>'waive_deposit')::boolean then
--          v_deposit := 0;
--        end if;
--
--      (กติกา KYC เดิมคงไว้เป็นชั้นแรกเสมอ — trust แค่ "ลดเพิ่ม" ไม่แทนที่)
--
-- 5.3  me-rpc gateway: เพิ่ม 'trust_me' เข้า allowlist ของ edge function
--      (หน้าลูกค้า trust.html "สมุดพกของฉัน" พร้อมแล้ว — เรียก meRpc('trust_me', {})
--       gateway เติมตัวตนจาก idToken เอง จึงไม่ต้องส่ง p_customer จากหน้าเว็บ)
--
-- ทดสอบเร็ว ๆ หลังติดตั้ง:
--   select trust_score_get(id) from customers limit 5;      -- คะแนนย้อนหลังต้องมาทันที
--   select trust_me('<customer-uuid>');                     -- ปิดสวิตช์ → {"enabled": false}
-- =============================================================================
