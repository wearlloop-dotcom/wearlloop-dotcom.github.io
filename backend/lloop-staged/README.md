# Video Studio — backend (staged สำหรับย้ายเข้า repo `lloop`)

โฟลเดอร์นี้คือ backend ของฟีเจอร์ **Video Studio** ที่เขียนไว้ในรีโปหน้าเว็บ
เพื่อ **รีวิว** เท่านั้น — ต้นทางจริง (canonical) ต้องอยู่ที่ repo `wearlloop-dotcom/lloop`
เพราะ `deploy-site.yml` ของ lloop จะ copy `ops/*` + `liff/*` มาทับรีโปหน้าเว็บ
แต่ **ไม่ deploy edge function / ไม่รัน SQL ให้** — สองอย่างนั้นต้องทำจาก lloop เอง

## ไฟล์
- `functions/video-gen/index.ts` → ย้ายไป `lloop/supabase/functions/video-gen/index.ts`
- `supabase/video_studio.sql`     → ย้ายไป `lloop/supabase/video_studio.sql`

## ขั้นตอน go-live (ตามลำดับ)

1. **ย้ายไฟล์เข้า lloop** ตาม path ด้านบน แล้วเปิด PR ใน repo `lloop`
2. **รัน SQL**: merge เข้า main ของ lloop → `supabase-sql.yml` รันให้ หรือ
   `actions_run_trigger` เจาะจงไฟล์ `supabase/video_studio.sql`
   (สร้างตาราง `video_gen_log` + seed flag `video_studio_enabled=false`)
3. **เพิ่ม allowlist**: แก้ `hub_settings_set` (อยู่ใน Supabase dashboard, ไม่มีซอร์สในรีโป)
   ให้รับคีย์ `video_studio_enabled` — ไม่งั้นสวิตช์หน้า settings เซฟไม่ได้ (`key_not_allowed`)
4. **ตั้ง secrets** ใน Supabase → Edge Functions:
   - `GOOGLE_AI_API_KEY` (ใช้ซ้ำจาก storyboard-gen ได้)
   - `LINE_OPS_CHANNEL_ID` (client_id ของ ops LIFF — ใช้ verify idToken)
   - (ออปชัน) `VIDEO_PROVIDER`, `VEO_MODEL`, `VEO_THB_PER_SECOND`
5. **deploy edge function**: `supabase functions deploy video-gen` (จาก repo lloop)
6. **หน้า ops จะมาเอง**: `video.html` + การ์ด settings + เมนู อยู่ในรีโปหน้าเว็บแล้ว
   แต่ **ต้องมิเรอร์เข้า `lloop/ops/` ด้วย** ไม่งั้น auto-deploy รอบถัดไปจะทับหาย
   (ดูหมายเหตุ "ต้นทางจริงคือ lloop/ops/" ใน CLAUDE.md)
7. **เปิดใช้**: เจ้าของเข้า `settings.html` → เปิดสวิตช์ "Video Studio"
   (ก่อนเปิด เจ้าของทดสอบเองได้เลยเพราะ dark launch ปล่อยเจ้าของผ่านตลอด)

## ต้องเช็คกับ schema จริงก่อน deploy
- ชื่อตาราง/คอลัมน์พนักงาน: `employees(line_user_id, role, is_owner, active, name, nickname)`
- ตารางชุด: `garments(code, photos[])` — ใช้ `photos[0]` เป็นรูปตั้งต้น
- ชื่อ RPC `garments_pick`, `ops_me`, `hub_settings_get/set`, `app_settings` — มีอยู่แล้วในระบบ

## เรื่องต้องระวัง (ธุรกิจ)
- **คลิปเสียก็คิดเงิน** — ทุกการเจนบันทึก `cost_thb` แม้ status=error ให้เจ้าของเห็นต้นทุนจริง
- Veo คลิปสั้น 4 วิ ถูกสุด + เพี้ยนน้อยสุด → ตั้งเป็นค่าเริ่มต้นในหน้า studio แล้ว
- โมเดล/endpoint ของ Veo อาจเปลี่ยนตามเวอร์ชัน — จุดแก้อยู่ที่ `genVeo()` จุดเดียว
- สลับไป Higgsfield ได้ผ่าน `VIDEO_PROVIDER=higgsfield` (ยังต้อง implement `generateVideo` ฝั่ง HF)
