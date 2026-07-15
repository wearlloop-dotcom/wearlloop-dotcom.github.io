# ระบบ Avatar Video API Pipeline — เอกสารออกแบบ (LLOOP)

> **สถานะ:** ออกแบบ (ยังไม่ implement) · อัปเดตล่าสุด: 2026-07-15
> **เป้าหมาย:** ระบบหลังบ้านที่ gen คลิป avatar อัตโนมัติ — ตั้งแต่เขียนสคริปต์ (ground ด้วย
> second-brain/brand voice) จนได้ไฟล์ MP4 พร้อมโพสต์ — โดย **ไม่ผูกกับผู้ให้บริการรายเดียว**
> (สลับ HeyGen / D-ID / อื่น ๆ ได้ผ่าน adapter)
>
> **ที่มา:** สรุปจากการรีเสิร์ชเทียบ HeyGen / D-ID / Tavus / Creatify (2026-07)
> — ดูสรุปการเทียบท้ายเอกสาร (ภาคผนวก ก)

---

## 0. ข้อสรุปสำคัญจากรีเสิร์ช (ที่บังคับทิศทางการออกแบบ)

1. **HeyGen:** ภาพสวยสุด + API ต่อนาทีถูก ($1 มาตรฐาน / $4 Avatar IV) แต่
   **"หน้าตัวเองแบบอัดวิดีโอ (Digital Twin) ผ่าน API = Enterprise เท่านั้น"** —
   pay-as-you-go API ทำได้แค่ Photo Avatar (จากรูป)
2. **D-ID:** ตัวเดียวที่ผ่านครบ "หน้าตัวเอง (Video Avatar) + API self-serve (Pro ~$48/เดือน)
   + ยืนยันรองรับภาษาไทย" แต่ API แพงต่อนาที (~$5.90)
3. **เครดิต monthly plan กับ API เป็นกระเป๋าเงินแยกกัน** (ทั้ง HeyGen) — มี plan ไม่ได้แปลว่าได้ API
4. **ลิปซิงค์ภาษาไทยคือความเสี่ยงร่วมของทุกเจ้า** (รีวิวส่วนใหญ่เทสต์อังกฤษ) —
   ทางลดความเสี่ยง: **แยกเสียงออกจากภาพ** (ใช้ TTS ไทย/เสียงอัดจริง → ส่งเข้าโหมด audio-to-video)
5. อย่าลงทุนเขียนระบบก่อนพิสูจน์คุณภาพ → **เฟส 0 ต้องเทสต์มือก่อนเสมอ**

---

## 1. หลักการออกแบบ

| หลักการ | เหตุผล |
|---|---|
| **Vendor-agnostic (adapter layer)** | ยังไม่ฟันธงเจ้าไหน + กันโดน lock-in / ราคาเปลี่ยน |
| **แยกเสียงออกจากภาพ** | เสียงไทยคือจุดอ่อนของทุกเจ้า → pipeline ต้องรับ audio ภายนอกได้ตั้งแต่วันแรก |
| **Human-in-the-loop ก่อน แล้วค่อย auto** | สคริปต์/คลิปต้องผ่านตามนุษย์ก่อนเผยแพร่ในเฟสแรก (dark launch ตามธรรมเนียมรีโป) |
| **Cost guard ทุกชั้น** | ค่าเรนเดอร์คิดต่อนาที เงินจริง — ต้องมี budget cap + log ทุก job |
| **Ground สคริปต์ด้วย second-brain** | สคริปต์ทุกคลิปอิง brand voice + ข้อมูลสินค้า/โปรจริง ไม่ใช่ให้ LLM เดา |
| **ทุกอย่างอยู่ฝั่ง backend (repo `lloop`)** | ตามสถาปัตยกรรม: SQL + Edge Functions อยู่ repo `lloop` · API key ห้ามแตะ client |

---

## 2. สถาปัตยกรรมภาพรวม

```
                        ┌──────────────────────────────────────────────┐
                        │              repo lloop (backend)             │
                        │                                              │
 [ops UI / trigger] ──▶ │  Edge Fn: video-script-gen                   │
  (settings flag เปิด)   │   1. อ่าน brand-voice + ข้อมูลสินค้า/โปร        │
                        │   2. เรียก LLM ด้วย prompt template (version ใน git)│
                        │   3. บันทึก draft ลง video_jobs (status=draft) │
                        └──────────────┬───────────────────────────────┘
                                       │  มนุษย์รีวิว/แก้สคริปต์ (เฟส 1-2)
                                       ▼
                        ┌──────────────────────────────────────────────┐
                        │  Edge Fn: video-render                       │
                        │   1. อ่าน job ที่ approve แล้ว                  │
                        │   2. เช็ค budget cap เดือนนี้ (cost guard)      │
                        │   3. (ทางเลือก) gen เสียงไทยจาก TTS ไทย/ไฟล์อัด │
                        │   4. เรียก provider ผ่าน ADAPTER →             │
                        │        heygen.ts | did.ts | ...              │
                        │   5. บันทึก provider_job_id (status=rendering) │
                        └──────────────┬───────────────────────────────┘
                                       │ webhook / cron poll
                                       ▼
                        ┌──────────────────────────────────────────────┐
                        │  Edge Fn: video-status                       │
                        │   - รับผลเสร็จ → เก็บ URL MP4 + ต้นทุนจริง      │
                        │   - status=done → แจ้งเตือน (LINE/ops)        │
                        └──────────────────────────────────────────────┘
```

**สิ่งที่อยู่ repo ไหน:**
- repo `lloop` → SQL (`supabase/*.sql`), Edge Functions ทั้ง 3 ตัว, adapter, secrets
- repo นี้ (หน้าเว็บ) → เฉพาะเอกสารนี้ + (อนาคต) การ์ดสวิตช์ใน `settings.html` ต้นทางที่ `lloop/ops/`

---

## 3. ฐานข้อมูล (ร่าง schema — ไปเขียนจริงเป็น `supabase/*.sql` ใน repo lloop)

```sql
-- งานผลิตคลิป 1 แถว = 1 คลิป
create table video_jobs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  topic           text not null,            -- โจทย์คลิป เช่น 'FAQ วัดไซซ์'
  script          text,                     -- สคริปต์ (LLM gen แล้วมนุษย์แก้ได้)
  script_prompt_version text,               -- เวอร์ชัน prompt template ที่ใช้ (audit)
  audio_source    text not null default 'provider_tts',
                    -- 'provider_tts' | 'thai_tts' | 'uploaded'  (แยกเสียงจากภาพ)
  audio_url       text,                     -- ถ้าใช้เสียงภายนอก
  provider        text not null,            -- 'heygen' | 'did'
  avatar_ref      text,                     -- avatar_id / presenter_id ฝั่ง provider
  provider_job_id text,
  status          text not null default 'draft',
                    -- draft → approved → rendering → done | failed | rejected
  video_url       text,
  duration_sec    int,
  cost_usd        numeric(8,4),             -- ต้นทุนจริงต่อคลิป (คุมงบ)
  error           text
);

-- เพดานงบต่อเดือน (cost guard) — เก็บใน app_settings ที่มีอยู่แล้วก็ได้
-- key: video_api_budget_usd_month (เช่น 20), video_api_enabled (dark launch switch)
```

**กฎ:** RPC/ตารางใหม่ต้องเพิ่มใน allowlist ของ gateway `ops-rpc` ตามธรรมเนียม repo lloop
และสวิตช์เปิดระบบ (`video_api_enabled`) ต้อง ship แบบ **ปิดไว้ก่อน**

---

## 4. Adapter layer (หัวใจของ vendor-agnostic)

Interface เดียว ทุก provider ต้อง implement:

```ts
// lloop/supabase/functions/_shared/avatar-provider.ts
export interface AvatarProvider {
  name: 'heygen' | 'did';
  // ส่งงานเรนเดอร์ — รับได้ทั้ง text (ให้ provider อ่าน) หรือ audioUrl (เสียงภายนอก)
  render(input: {
    avatarRef: string;
    script?: string;          // โหมด provider TTS
    audioUrl?: string;        // โหมดเสียงภายนอก (แนะนำสำหรับไทย)
    resolution?: '720p' | '1080p';
  }): Promise<{ providerJobId: string }>;
  // เช็คสถานะ
  status(providerJobId: string): Promise<
    { state: 'processing' } |
    { state: 'done'; videoUrl: string; durationSec: number } |
    { state: 'failed'; error: string }
  >;
  // ประเมินต้นทุนก่อนยิง (ใช้ทำ cost guard)
  estimateCostUsd(durationSecEstimate: number, tier: string): number;
}
```

**จุดที่ต่างกันระหว่าง provider (ต้องรู้ตอน implement):**

| | HeyGen | D-ID |
|---|---|---|
| endpoint | `POST /v2/video/generate` + `GET /v1/video_status.get` | `POST /talks` (หรือ clips) + `GET /talks/{id}` |
| auth | header `X-Api-Key` (wallet แยกจาก plan) | Basic auth ด้วย API key |
| avatar หน้าตัวเองผ่าน API | ✅ Photo Avatar / Avatar IV (จากรูป) · ❌ Digital Twin = Enterprise | ✅ Photo → ทุก tier มี API · Video Avatar = Pro+ |
| รับ audio ภายนอก | ✅ | ✅ |
| ราคาโดยประมาณ | $1/นาที (มาตรฐาน) · $4/นาที (Avatar IV) | ~$5.90/นาที |

> ตัวเลขราคา ณ ก.ค. 2026 จากเอกสาร/รีวิวสาธารณะ — **เช็คหน้า pricing จริงก่อนเติมเงินเสมอ**

---

## 5. เสียงไทย (โมดูลแยก — ลดจุดอ่อนที่สุดของระบบ)

ลำดับความเนียน (มาก → น้อย): **อัดเสียงจริง > TTS ไทยเฉพาะทาง (เช่น Botnoi/iApp) > TTS ของ provider**

```
audio_source = 'uploaded'      → อัปไฟล์เสียงอัดเอง (เนียนสุด, เหมาะคลิปสำคัญ)
audio_source = 'thai_tts'      → Edge Fn เรียก TTS ไทย → ได้ไฟล์ → ส่งเข้า provider
audio_source = 'provider_tts'  → ให้ provider อ่านสคริปต์เอง (เร็วสุด, เสี่ยงวรรณยุกต์เพี้ยน)
```

ออกแบบให้สลับได้ **ต่อคลิป** — คลิป FAQ ทั่วไปใช้ TTS, คลิปหน้าแบรนด์สำคัญใช้เสียงอัด

---

## 6. Cost guard (บังคับมี ก่อนเปิด auto)

1. **เพดานเดือน:** ก่อน render ทุกครั้ง → รวม `cost_usd` เดือนนี้ + ค่าประเมินคลิปใหม่
   ถ้าเกิน `video_api_budget_usd_month` → ปฏิเสธ พร้อมแจ้งใน ops
2. **เพดานต่อคลิป:** จำกัดความยาวสคริปต์ (เช่น ≤ 90 วิ) กันสั่งยาวเผลอ ๆ
3. **บันทึกต้นทุนจริงทุก job** ลง `video_jobs.cost_usd` → ดู report ย้อนหลังได้
4. **kill switch:** `video_api_enabled` ใน `app_settings` ปิดได้ทันทีจาก settings.html

---

## 7. Secrets & ความปลอดภัย

- `HEYGEN_API_KEY` / `DID_API_KEY` / `THAI_TTS_API_KEY` → เก็บเป็น **Supabase secrets**
  (Edge Function env) เท่านั้น — **ห้าม** อยู่ใน client, repo, หรือหน้าเว็บ
- การสั่งงานทั้งหมดวิ่งผ่าน gateway `ops-rpc` (เช็คพนักงาน active + allowlist) ตามสถาปัตยกรรมเดิม
- วิดีโอ/เสียงที่มีหน้าคน = ข้อมูลส่วนบุคคล → avatar ต้องเป็นหน้าตัวเอง หรือมี
  **เอกสารยินยอม** จากเจ้าของหน้า (นางแบบ/พนักงาน) เก็บไว้เสมอ

---

## 8. แผนทำจริง — 4 เฟส (อย่าข้ามเฟส 0)

### เฟส 0 — พิสูจน์คุณภาพไทยด้วยมือ (0฿ – หลักร้อย)
- [ ] เขียนสคริปต์ไทยมาตรฐาน 30 วิ 1 ชุด (ใช้เทสต์ทุกเจ้าเหมือนกัน)
- [ ] HeyGen free: gen ด้วย provider TTS ไทย → ให้คะแนน เสียง/ลิปซิงค์/ภาพ (1-5)
- [ ] D-ID trial: เทสต์เดียวกัน
- [ ] เทสต์โหมด audio-to-video: เสียงอัดจริง/TTS ไทย + ภาพ avatar
- [ ] **เกณฑ์ผ่าน:** มีอย่างน้อย 1 combo ที่ยอมรับได้จริง → ค่อยไปเฟส 1 · ไม่ผ่าน = หยุด ประหยัดเงินทั้งหมด

### เฟส 1 — Semi-auto: gen สคริปต์อัตโนมัติ เรนเดอร์มือ
- [ ] สร้าง prompt template สคริปต์ (ground ด้วย brand voice + ข้อมูลโปร/สินค้า) เก็บใน git
- [ ] Edge Fn `video-script-gen` + ตาราง `video_jobs` (PR เข้า repo lloop)
- [ ] มนุษย์ copy สคริปต์ไป render ในหน้าเว็บ provider เอง (ยังไม่จ่าย API)

### เฟส 2 — ต่อ API render (human approve ก่อนยิง)
- [ ] เติม API wallet ขั้นต่ำ ($5-10) + ตั้ง budget cap
- [ ] Adapter ตัวแรก (เลือกจากผลเฟส 0) + `video-render` + `video-status`
- [ ] ปุ่ม approve ใน ops (สวิตช์ dark launch ปิดไว้จนพร้อม)

### เฟส 3 — Auto เต็มระบบ (เมื่อ volume คุ้มจริงเท่านั้น)
- [ ] trigger ตามเหตุการณ์ (เช่น ชุดใหม่เข้า → คลิปแนะนำอัตโนมัติ)
- [ ] adapter ตัวที่สอง (สำรอง/เทียบราคา)

---

## 9. ตัวชี้วัดว่าระบบเวิร์ก

- ✅ คลิปทุกตัวมีสคริปต์ที่อิง brand voice เดียวกัน (โทนนิ่ง)
- ✅ ต้นทุน/คลิปรู้ชัด และไม่เคยทะลุ budget cap
- ✅ เวลาในการผลิตคลิป 1 ตัว ลดลงชัดเจนเทียบกับทำมือ
- ✅ สลับ provider ได้โดยแก้แค่ config ไม่แก้ business logic

---

## 10. Realism Playbook — ทำยังไงให้เนียนสุดโดยไม่ใช้คน (จากออดิทแนวปฏิบัติ 2026)

> ข้อค้นพบหลัก: ความเนียนไม่ได้มาจากตัวเครื่องมืออย่างเดียว แต่มาจาก 4 ขั้นตอนรอบ ๆ

### 10.1 เสียง: โคลนเสียงตัวเอง (สูตรมาตรฐาน: HeyGen หน้า + ElevenLabs เสียง)
- โคลนเสียงตัวเองด้วย ElevenLabs (รองรับไทย) จากเสียงอัดสะอาด ~30 นาที
  — คุณภาพวัตถุดิบ = คุณภาพเสียงโคลน
- ตอน gen: **ทีละ 1-2 ประโยค** (ไม่ใช่ทั้งย่อหน้า) + gen 3 เทคต่อประโยค เลือกเทคดีสุดมาต่อกัน
- เข้ากับ pipeline นี้ตรง ๆ: `audio_source = 'thai_tts'` → เพิ่ม ElevenLabs เป็นอีก provider
  ของโมดูลเสียง (เทียบกับ Botnoi/อัดจริง ในเฟส 0)

### 10.2 วัตถุดิบวันอัด: energy in = energy out
- HeyGen Avatar V (ใหม่กว่า IV) ใช้ 3 อย่าง: รูปถ่ายจริง (ชัด ครึ่งตัว แสงดี ห้ามใช้รูป AI)
  + เสียงโคลน + **วิดีโออ้างอิง 15 วิ** ที่สอนโมเดลว่าเราขยับยังไง
- ตอนอัดวิดีโออ้างอิง: แสดงออกเกินธรรมชาตินิดหน่อย — พลังที่ใส่ = พลังที่ avatar มี
- Avatar V เป็น audio-driven: อารมณ์ในไฟล์เสียงคุมท่าทาง avatar โดยตรง
  → เสียงโคลนมีอารมณ์ = ท่าทางธรรมชาติตาม (ข้อ 10.1 จึงสำคัญสองเด้ง)

### 10.3 ตัดต่อ = ตัวปิดจุดอ่อน (สำคัญสุด โดยเฉพาะภาษาไทย)
- avatar เต็มเฟรมตลอดคลิป = ดูออกทันทีว่า AI · มือโปรให้ avatar อยู่บนจอแค่บางช่วง
- ที่เหลือคัตไป **B-roll ที่มีเหตุผล** (ชุดจริง, ผ้า, ลูกค้าลองชุด, กราฟิก/ซับ)
  — ลิปซิงค์ไทยยิ่งอ่อน ยิ่งต้องพึ่ง B-roll → LLOOP ได้เปรียบเพราะมีชุดจริงถ่ายได้เยอะ
- นัยต่อระบบ: pipeline นี้ผลิต "ก้อน avatar พูด" — ต้องมีขั้น **ประกอบ/ตัดต่อ**
  (มือ หรืออนาคตใช้ template ตัดต่ออัตโนมัติ) ก่อนเผยแพร่เสมอ อย่าโพสต์ก้อนดิบ

### 10.4 สคริปต์: เขียนให้ AI อ่าน ไม่ใช่ให้คนอ่าน
- ประโยคสั้น สลับจังหวะยาว-สั้น กัน monotone
- คำเฉพาะ/ชื่อแบรนด์ใส่คำอ่านกำกับ เช่น "LLOOP (ลูป)"
- กติกานี้ต้องเข้าไปอยู่ใน prompt template ของ `video-script-gen` ตั้งแต่แรก

### 10.5 ผลต่อแผนเฟส (อัปเดตเฟส 0)
- [ ] เพิ่ม ElevenLabs voice clone ไทย เข้า matrix เทสต์เฟส 0 (เทียบ Botnoi / อัดจริง / provider TTS)
- [ ] เทสต์ HeyGen **Avatar V** (photo + voice clone + reference 15 วิ) ไม่ใช่แค่ Avatar IV
- [ ] คลิปเทสต์ต้องตัดต่อแบบมี B-roll จริง 1 ตัว เพื่อดูผลลัพธ์สุดท้ายจริง ไม่ใช่ดูก้อนดิบ

---

## ภาคผนวก ก — สรุปเทียบ 4 เจ้า (ณ ก.ค. 2026)

| เกณฑ์ | HeyGen | D-ID | Tavus | Creatify |
|---|---|---|---|---|
| ภาพสมจริง | ⭐ สูงสุด | ดี | ⭐ สูงมาก (NeRF) | ปานกลาง |
| หน้าตัวเอง (อัดวิดีโอ) ผ่าน API | 🔴 Enterprise | ✅ Pro ~$48 | ✅ Starter $39 | 🔴 Enterprise |
| ภาษาไทย | ✅ (ลิปซิงค์อ่อน) | ✅ ยืนยันมี | ⚠️ ไม่ยืนยัน | ✅ TTS |
| API ต่อนาที | $1 / $4 (IV) | ~$5.90 | pay-as-you-go | – |
| เหมาะกับ | ทำมือ/ภาพสวย/ต่อนาทีถูก | pipeline หน้าตัวเอง+ไทย | real-time (อนาคต) | ตัดออก (ลิปซิงค์อ่อน) |

**ข้อควรระวัง:** ราคา/เงื่อนไขเปลี่ยนบ่อย ตัวเลขในเอกสารนี้เป็น snapshot จากรีวิวสาธารณะ
ต้องเช็คหน้า pricing จริงของแต่ละเจ้า ณ วันตัดสินใจจ่ายเสมอ
