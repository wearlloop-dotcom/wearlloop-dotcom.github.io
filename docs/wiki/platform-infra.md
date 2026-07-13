# Platform & Infra (skills / docs / sql / storyboard / video)
> raw: `.claude/skills/*` • `.claude/settings.json` • `docs/*.md` • `sql/*.sql` • `supabase-p0-moats.sql` • `storyboard.html` • `video.html` • อัปเดตล่าสุด: 2026-07-13

## หน้า/ไฟล์ในโดเมนนี้

**Skills (`.claude/skills/`)** — สกิลที่ทีมเขียนเองในรีโปนี้ (ตรวจสอบได้ทั้งไฟล์)
- `banana/` — gen/แก้รูปด้วย Gemini Nano Banana (`scripts/nano_banana.py`) · text-to-image + image-to-image · เซฟลง scratchpad ห้าม commit
- `lloop-ig-9grid/` — gen IG 9 รูปแรกสไตล์ lookbook ด้วย self-reference chain (ล็อกหน้านางแบบทั้งชุด)
- `movie-vibe/` — ถอดสูตรวิชวลหนัง → prompt ถ่ายภาพจริง · จังหวะ 0 ดึงชุดจริงจาก Supabase `garments` (SELECT เท่านั้น)
- `fact-check/` — โหมดกันมั่ว (แยกข้อเท็จจริง/คาดเดา + คะแนนมั่นใจ) · เป็น prompt-discipline ล้วน
- `scrape/` — ดึงเว็บสาธารณะฟรี (WebFetch → Playwright fallback) เทียบราคาคู่แข่ง

**Docs (`docs/`)** — คลังความรู้/prompt
- `second-brain-memo.md` + `second-brain-plan.md` — สถาปัตยกรรม LLM-wiki 3 ชั้น + กติกา ingest/lint/PARA (ต้นทางของ wiki นี้)
- `expansion-strategy.md` — แผนขยาย 5 โมเดล/3 เฟส
- `lloop-ig-ai-prompts.md` + `lloop-ig-visual-template.md` — prompt pack + ผังกริดของสกิล ig-9grid
- `master-prompts.md` — คลัง `[DRESS SPEC]`/`[SCENE]` ของสกิล movie-vibe

**SQL (`sql/` + root)** — record ของ migration
- `supabase-p0-moats.sql` — record migration P0 moat ที่ apply จริง 2026-07-03 (reviews-by-size, hygiene, event calendar, Closet Cash)
- `sql/2026-07-video-studio.sql` — stub ชี้ทางไป lloop (canonical) + go-live checklist ของ Video Studio
- `sql/2026-07-expansion-flags-trust.sql` — stub ชี้ทางไป lloop (trust score v1 + flags)

**Ops pages (AI studio)**
- `storyboard.html` — ทีมการตลาดเจนภาพ storyboard ของ Hero Video (เรียก edge fn `storyboard-gen`)
- `video.html` — เจนคลิปสั้น 4–8 วิ image-to-video (เรียก edge fn `video-gen`)

**Config** — `.claude/settings.json` เปิดใช้ปลั๊กอิน `watch@claude-video` จาก marketplace `bradautomates/claude-video`

## Flow (end-to-end ของโดเมน)

- **Skills → คอนเทนต์การตลาด**: user สั่ง `/banana`, `/lloop-ig-9grid`, `/movie-vibe` → สกิลประกอบ prompt → เรียก Gemini (nano_banana.py หรือ API ตรง) ด้วย `GOOGLE_AI_API_KEY`/`GEMINI_API_KEY` จาก env → เซฟรูป scratchpad → `SendUserFile` (ห้าม commit รูป/คีย์ลงรีโป public)
- **Studio ops pages (in-app)**: พนักงานการตลาดเปิด `storyboard.html`/`video.html` → `opsLogin()` (LIFF) → หน้าส่ง `id_token: liff.getIDToken()` + task ไป edge function (`storyboard-gen`/`video-gen`) ตรง ๆ ผ่าน `fetch` → edge fn verify idToken ฝั่ง server + เช็ค role (marketing/manager/owner) + feature flag + คีย์ Gemini ฝั่ง server → คืนผล + เขียน audit (ใครเจน/ช็อตไหน/ค่าใช้จ่ายสะสม/ผ่าน-ไม่ผ่าน) · การค้นชุดใช้ `window.opsRpc('garments_pick')` + `ops_me` ผ่าน ops-rpc gateway
- **Feature flag gating**: การ์ดใน `settings.html` (`storyboard_studio_enabled`, `video_studio_enabled`) เก็บใน `app_settings` → ปิดไว้ = เฉพาะเจ้าของ (dark launch) → เจ้าของเปิดเมื่อพร้อม · เมนูเข้าหน้าอยู่ใน `ops-menu.js`
- **SQL/backend**: ต้นทางจริงของ moat/flag/edge-fn อยู่ repo `lloop` (รันผ่าน `supabase-sql.yml` จาก main) — ไฟล์ sql ในรีโปนี้เป็น record/stub เท่านั้น

## Insight (รู้อะไร)

- Studio pages ไม่ส่ง customer/staff id จาก client เลย — ยืนยันตัวตนด้วย `id_token` ที่ edge fn verify เอง (กัน IDOR ตามสถาปัตยกรรม me-rpc/ops-rpc)
- Public anon RPC ใน moat migration (`garment_reviews_sized`, `garment_hygiene_public`) เป็น security-definer + fixed search_path + คืนเฉพาะฟิลด์ที่ whitelist แล้ว ไม่มี PII (ไม่มีชื่อ/เบอร์/customer_id) — ตรงกฎ public RPC
- me/ops RPC (`my_events`, `add/remove_customer_event`, `seller_*`) ถูก `revoke ... from anon` + ใส่ `rpc_never_anon` + grant เฉพาะ service_role ครบทุกตัว — โครง security แน่น
- `seller_offer_get` จงใจคืน `bank_account: null` (ไม่หลุดเลขบัญชีผู้ขาย) — PII discipline ดี
- คีย์ Gemini ไม่ hardcode ที่ไหนเลย — สกิลอ่านจาก env, studio pages ใช้คีย์ฝั่ง server (edge fn) · fallback `SUPABASE_URL` ที่ hardcode เป็น project URL สาธารณะ ไม่ใช่ความลับ
- `storyboard.html`/`video.html` เป็นหน้า ops (opsRpc/ops-menu) — ตามกติกา CLAUDE.md หน้า ops ต้นทางควรอยู่ `lloop/ops/`; `video-studio.sql` ยืนยันว่า `video.html` canonical อยู่ lloop/ops (deploy-site publish มา) ส่วน `settings.html`+`ops-menu.js` แก้ตรงในรีโปนี้ได้

## Decision (ตัดสินใจอะไรไปแล้ว)

- P0 moat (reviews-by-size / hygiene / event calendar / Closet Cash) apply จริงบน Supabase `rprwilsbjptdnvsibjgi` แล้ว 2026-07-03 + เทส end-to-end ผ่าน — ยึด schema จริง (customer_reviews, care_jobs, acquisitions) ไม่ใช่ที่เดารอบแรก
- ย้ายต้นทาง SQL/edge-fn ทั้งหมดไป repo `lloop` (รันผ่าน CI) — ไฟล์ sql ในรีโปหน้าเว็บเหลือเป็น record/stub กันเดา schema ผิดซ้ำ
- Studio 2 ตัว ship แบบ dark launch (flag ปิดไว้ก่อน เจ้าของเปิดเอง)
- event calendar horizon ขยาย 7 → 14 วัน + guard `line_uid is not null` ให้ตรงวิชัน "อีก 2 สัปดาห์"

## Issues (จาก static audit — severity)

- [medium] Storyboard Studio ไม่มี record/stub ใน `sql/` — `sql/` มี `2026-07-video-studio.sql` เอกสาร Video Studio ครบ (PR #41, allowlist `video_studio_enabled`, deploy `video-gen`, go-live checklist) แต่ **ไม่มีไฟล์คู่ของ storyboard** ทั้งที่มี flag `storyboard_studio_enabled`, edge fn `storyboard-gen`, และ `settings.html` อ้าง `supabase/storyboard_studio.sql` — สถานะ go-live ของ storyboard (PR ไหน, allowlist `hub_settings_set` เพิ่มคีย์แล้วยัง, deploy edge-fn แล้วยัง) ไม่มีที่ tracking → เสี่ยงลืม/เปิดสวิตช์แล้วเจอ `fn_not_allowed` หรือ `no_api_key`
- [low] `storyboard_studio_enabled` / `video_studio_enabled` ต้องอยู่ใน allowlist `hub_settings_set` (gateway) ไม่งั้นเซฟสวิตช์ไม่ได้ (`fn_not_allowed`) — `video-studio.sql` ระบุว่าเพิ่ม `video_studio_enabled` แล้ว แต่ **ไม่มีบันทึกยืนยันว่า `storyboard_studio_enabled` ถูกเพิ่ม** (verify ฝั่ง lloop/dashboard ไม่ได้จากรีโปนี้)
- [low] `.claude/settings.json` auto-enable ปลั๊กอิน third-party `watch@claude-video` (`bradautomates/claude-video`) — โค้ด external ถูก trust โดย default ให้ทุกคนที่เปิดรีโปใน. Claude Code · ควรตรวจ/pin ก่อนพึ่งพา (supply-chain)
- [low] `sql/2026-07-expansion-flags-trust.sql` เป็น comment ล้วน (ไม่มี SQL รันได้จริง) — ถ้ามีสคริปต์ไล่รันไฟล์ใน `sql/` จะเป็น no-op เงียบ ๆ · เป็น stub โดยตั้งใจ แต่ตั้งชื่อเหมือนไฟล์รันได้ อาจสับสน
- [info] ไม่พบ `docs/wiki/index.md` — เทมเพลต second-brain กำหนดให้ index เป็นสารบัญ routing ที่ "อ่านก่อนเสมอ" แต่ยังไม่มี → หน้า wiki ทุกโดเมนตอนนี้ยังไม่มีสารบัญกลาง

## Next action

- [ ] เพิ่มไฟล์ record `sql/2026-07-storyboard-studio.sql` (stub) ให้คู่กับ video: ชี้ PR ต้นทางใน lloop, ยืนยัน allowlist `storyboard_studio_enabled` + deploy `storyboard-gen` + go-live checklist
- [ ] verify ฝั่ง lloop/Supabase: `storyboard_studio_enabled` อยู่ใน allowlist `hub_settings_set` แล้วจริงไหม
- [ ] pin/ตรวจ commit ของปลั๊กอิน `watch@claude-video` ก่อน trust (หรือถอดถ้าไม่ใช้)
- [ ] สร้าง `docs/wiki/index.md` เป็นสารบัญ routing ตามเทมเพลต second-brain (จัด PARA + 1 บรรทัด/หน้า)

## Links
- [[marketing-growth]] — Storyboard/Video Studio + skills เป็นเครื่องมือสายคอนเทนต์การตลาด
- [[trust-moats]] — `supabase-p0-moats.sql` คือ migration ของ moat (reviews-by-size, hygiene, Closet Cash)
- [[ops-daily]] — studio pages เดินผ่าน ops gateway เดียวกับหน้า ops อื่น
