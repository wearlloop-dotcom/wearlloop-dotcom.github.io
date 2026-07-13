-- =============================================================================
-- LLOOP · Video Studio — audit table + feature flag (dark launch)
--
-- ⚠️ ต้นทางจริงต้องอยู่ repo backend: wearlloop-dotcom/lloop → supabase/video_studio.sql
--    รันผ่าน GitHub Actions (supabase-sql.yml) หรือ bash scripts/sbql.sh supabase/video_studio.sql
--    ไฟล์ในรีโปหน้าเว็บนี้เป็นฉบับ staged ไว้รีวิว/ย้าย เท่านั้น
--
-- ปรับ schema ให้ตรงของจริงก่อนรัน: ตาราง employees ใช้คอลัมน์ line_user_id,
-- role, is_owner, active, name/nickname — ถ้าชื่อไม่ตรง แก้ที่ edge function ด้วย
-- =============================================================================

-- 1) ตารางออดิทการเจนคลิป -----------------------------------------------------
create table if not exists public.video_gen_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  employee_id   uuid,
  employee_name text,
  sku           text,
  provider      text,
  model         text,
  aspect        text,
  duration      int,
  preset        text,
  note          text,
  prompt        text,
  url           text,
  cost_thb      numeric default 0,
  status        text not null default 'pending',   -- pending | ok | error
  error         text,
  feedback_rating text,                            -- pass | fail | null
  feedback_note text,
  feedback_by   text,
  feedback_at   timestamptz
);

create index if not exists video_gen_log_emp_idx  on public.video_gen_log (employee_id, created_at desc);
create index if not exists video_gen_log_time_idx on public.video_gen_log (created_at desc);

-- edge function เข้าถึงด้วย service role อยู่แล้ว → เปิด RLS กันการอ่านตรงด้วย anon/auth
alter table public.video_gen_log enable row level security;
-- (ไม่สร้าง policy = อ่าน/เขียนตรงไม่ได้ นอกจาก service role ที่ bypass RLS — ตั้งใจ)

-- 2) seed feature flag (ปิดไว้ก่อน = dark launch) -----------------------------
insert into public.app_settings (key, value)
values ('video_studio_enabled', 'false')
on conflict (key) do nothing;

-- 3) allowlist ของ gateway hub_settings_set --------------------------------
--    ⚠️ hub_settings_set ถูกสร้างตรงใน Supabase dashboard (ไม่มีซอร์สในรีโป)
--    ต้องเพิ่มคีย์ 'video_studio_enabled' เข้า allowlist ของฟังก์ชันนั้นด้วยมือ
--    ไม่งั้นสวิตช์ในหน้า settings.html จะเซฟไม่ได้ (เจอ key_not_allowed)
--
--    ตัวอย่าง (ถ้า allowlist เป็น array ใน body ของฟังก์ชัน):
--        ... key in ('hub_pickup_enabled', ..., 'storyboard_studio_enabled',
--                    'video_studio_enabled')  -- << เพิ่มบรรทัดนี้
