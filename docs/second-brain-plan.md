# แผน Second Brain + Multi-Agent สำหรับ LLOOP

> ถอดจากโพสต์ Claude Thailand Community (2026-07) + gist ของ Karpathy (LLM wiki)
> เป้าหมาย: ทำให้ Claude "คิดแทนทีม LLOOP" ได้แม่นขึ้น โดยไม่เปลือง token และ scale ได้ตอนคลังโต
> สถานะ: **แผน (ยังไม่ลงมือ)** — รอยืนยันก่อนเริ่ม Phase 0

---

## 0) การตัดสินใจเชิงสถาปัตยกรรม (อ่านก่อน — กันหลงทาง)

เธรดนั้นมี 2 ค่ายเถียงกัน สรุปแล้วเลือกทางที่เหมาะกับ LLOOP:

- **ค่ายทำ infra หนัก** (Tor/Yim): Obsidian → พังตอน ~30k ไฟล์ → ต้องไป graphiti (temporal
  knowledge graph บน Neo4j) + ARRA Oracle เป็น memory หลัก
- **ค่าย keep it simple** (ThaiDeploy/JayJay): ระบบพวกนั้นเหมาะกับ tool ที่ **ไม่มี** memory
  (เช่น Claw/Cline) — **Claude มี memory + skill + subagent + workflow อยู่แล้ว** สั่งให้จัด
  memory index / ทำ skill เองได้ ไม่ต้องตั้ง DB ภายนอกให้เปลือง

**LLOOP เลือกค่าย keep-it-simple + Karpathy LLM-wiki pattern** เพราะ:
1. รันบน Claude Code อยู่แล้ว (มี skill/agent/workflow/CLAUDE.md ครบ)
2. คลังยังหลักสิบไฟล์ ไม่ถึงจุดที่ Obsidian พัง — แต่ปัญหา token มีจริง (`AUDIT.md`=159KB,
   `JOURNEY-AUDIT.md`=103KB, `FIXES.md`=90KB → Claude scan ทั้งก้อน = เปลือง ตรงกับที่ Tor เตือน)
3. เก็บทุกอย่างเป็น **markdown + git** = ย้ายค่าย LLM ได้ (codex/gemini) โดย second brain ไปด้วย
   — ตอบโจทย์ที่เจ้าของโพสต์กังวล ("ถ้าย้ายไป codex ข้อมูลไปด้วยมั้ย" → ไปด้วย เพราะเป็นไฟล์)

**หลักการหัวใจ (Karpathy):** อย่าโหลดทั้ง vault — *อ่าน `index.md` ก่อนเสมอ แล้ว route ไปเฉพาะ
หน้าที่เกี่ยว* = ประหยัด token + scale ได้เรื่อย ๆ ไม่พังตอนไฟล์เยอะ

---

## 1) สองแกนที่ถอดจากโพสต์

### แกน A — Second Brain (จัดความรู้)
**Karpathy LLM-wiki = 3 ชั้น:**
- **Raw Sources** — ไฟล์ดิบ อ่านได้ห้ามแก้ (ของเรา = AUDIT/JOURNEY/FIXES/expansion ที่มีอยู่)
- **Wiki** — หน้า markdown ที่ LLM กลั่นเอง (entity/concept/summary) + `index.md` + `log.md`
- **Schema** — ไฟล์กำหนดกติกา (ของเรา = `CLAUDE.md`) "ไฟล์สำคัญที่สุดในรีโป"

**4 workflow (Pisit = CODE/PARA):** Capture → Organize (Project/Area/Resource/Archive) →
Distill (ดึง Insight/Decision/Next-action) → Retrieve & Execute (อ่าน index → route → ตอบ)

**ข้อสังเกตที่คนในกลุ่มย้ำ (กันพลาด):**
- "ไม่ใช่มีโน้ตเยอะ แต่ต้องเชื่อมกันและเรียกกลับมาใช้ได้ตอนตัดสินใจ" (Pisit)
- "input คือทุกอย่าง — ฉลาดแค่ไหนอยู่ที่สิ่งที่ยัดเข้า payload ครั้งเดียว" (Wake Up)
- main rule ของ **retrieval + linking system** สำคัญกว่าปริมาณ (Np Karin)
- ต้องมี **MoC / Map of Content** = หน้า index ที่ลิงก์หัวข้อย่อย (Anaecha)
- **Lint เป็นระยะ** — หา contradiction/stale/orphan ไม่งั้นคลัง drift (Karpathy)

### แกน B — Multi-agent orchestration (วิธีลงมือ)
**สูตร Pariwat:** Opus=หัวหน้าประเมิน scope → ซับซ้อนเรียก `fable` ออกแบบ / ง่ายทำเอง →
เรียกเพื่อนหลายตัว (`fast-worker`) รุมทำขนาน → test ด้วย `haiku` ~100 cases → `codex` ตรวจ →
เจอผิดซ่อมตัวเอง · ภาพ terminal ยืนยันจริง (`fable-architect`, `Dispatching 5 parallel builders`)

**map เข้าเซสชันนี้:** หัวหน้า=main loop Opus · ออกแบบ=subagent `Plan`/model `fable` ·
รุมทำ=`Agent` หลายตัว หรือ `Workflow` (pipeline/parallel) · test=agent+haiku ·
ตรวจ/ซ่อม=`/code-review` + `/verify` + adversarial-verify ใน Workflow

---

## 2) LLOOP มีอะไรแล้ว vs ยังขาด

| | มีแล้ว | ยังขาด |
|---|---|---|
| **Schema** | `CLAUDE.md` (ดีอยู่แล้ว) | ยังไม่มี page-type/naming/routing rule ของ wiki |
| **Raw** | AUDIT/JOURNEY/FIXES/expansion/master-prompts | — (ครบ แต่ใหญ่เกินโหลดทั้งก้อน) |
| **Wiki** | ❌ | `index.md`, `log.md`, หน้า distilled ต่อโดเมน |
| **Capture/Ingest** | ❌ | skill `/ingest`, `/lint` |
| **Skill ทำซ้ำ** | banana, movie-vibe, ig-9grid, fact-check, scrape | skill ฝั่งงาน (audit/sql-review) |
| **Subagent** | ❌ (มีแต่ skill) | `.claude/agents/` เฉพาะ LLOOP |
| **Workflow** | ❌ | `.claude/workflows/` งาน audit/review ซ้ำ ๆ |
| **ฝั่งของขาย** | passport.html, trust.html | AI สไตลิสต์ "จำลูกค้าได้" (PII อยู่ Supabase) |

---

## 3) Roadmap — ทำอะไรเพิ่มบ้าง (เรียงตามคุ้ม/เริ่มก่อน)

### Phase 0 — โครง Index/Routing (ครึ่งวัน · คุ้มสุด · แก้ปัญหา token ทันที)
- [ ] สร้าง `docs/wiki/` + `docs/wiki/index.md` — catalog ทุกหน้า 1 บรรทัด/หน้า จัดตาม PARA
- [ ] `docs/wiki/log.md` — append-only บันทึก ingest/decision (`## [DATE] op | title`)
- [ ] เพิ่มหัวข้อ **Wiki schema** ใน `CLAUDE.md`: page types, naming, เมื่อไหร่สร้าง/แก้หน้า,
      กติกา "อ่าน `docs/wiki/index.md` ก่อนเสมอ แล้ว route — ห้าม scan ไฟล์ใหญ่ทั้งก้อน"

### Phase 1 — Distill คลังที่มี (1 วัน)
- [ ] กลั่นเป็นหน้า wiki สั้น ๆ ต่อโดเมน แต่ละหน้ามี Insight / Decision / Next-action + ลิงก์ raw:
      `stock.md`, `ops.md`, `customer-journey.md` (จาก JOURNEY-AUDIT), `moats.md`
      (จาก audit-moats + expansion), `backend.md` (จาก BACKEND-TODO/SPEC), `ux-copy.md`
- [ ] ไฟล์ดิบเดิม = Raw layer (ไม่ลบ ไม่แก้) — wiki ชี้กลับไปเป็น citation

### Phase 2 — Skill automation (1 วัน)
- [ ] `/ingest <ไฟล์/ลิงก์/โน้ต>` — อ่าน → เขียนหน้า wiki → อัปเดต index + log อัตโนมัติ
- [ ] `/lint` — หา contradiction / stale claim / orphan page / cross-ref ที่ขาด
- [ ] (ทีหลัง) Capture อัตโนมัติแบบ Nut: bot Telegram → คัดแยกด้วย hashtag เข้า vault/project

### Phase 3 — Multi-agent (แกน B) (1-2 วัน)
- [ ] `.claude/agents/`: `stock-auditor`, `sql-reviewer`, `ux-copy-checker` (เฉพาะ LLOOP)
- [ ] `.claude/workflows/`: "audit ทุกหน้า ops ว่า RPC อยู่ใน allowlist ครบ",
      "review หน้า HTML หลายหน้า parallel แล้ว verify"
- [ ] วาง gate ก่อน commit: `/verify` + `/code-review` เป็นนิสัยของรีโป

### Phase 4 — ฝั่งของขาย (ต่อยอด passport/trust) — งานใหญ่แยกรอบ
- [ ] AI สไตลิสต์ที่ "จำลูกค้าได้" (ประวัติเช่า+ไซซ์+สไตล์ → แนะนำครั้งหน้า) = moat จริง
- [ ] ⚠️ PII อยู่ Supabase + gateway เท่านั้น **ห้าม** commit ลงรีโป wiki

---

## 4) สิ่งที่จะ "ไม่ทำ" (กันเปลือง/กันพัง)
- ❌ ไม่ตั้ง Neo4j / graphiti / ARRA / vector DB — Claude มี memory+skill อยู่แล้ว (ThaiDeploy)
- ❌ ไม่โยนไฟล์ใหญ่ทั้งก้อนให้ LLM — ต้องผ่าน index/routing เสมอ (Karpathy/Tor)
- ❌ ไม่ commit PII (ไซซ์/เบอร์/ประวัติลูกค้า) ลงรีโป
- ❌ ไม่แตะ `ops/*`, `liff/*` ตรงในรีโปนี้ — ต้นทาง repo `lloop` + โดน `deploy-site.yml` ทับ
- ✅ Obsidian ใช้เป็น **front-end ดู visual** ได้เลย (รีโปเป็น markdown อยู่แล้ว = เปิดเป็น vault ได้)

## อ้างอิง
- Karpathy LLM wiki: `gist.github.com/karpathy/442a6bf555914893e9891c11519de94f`
- วิดีโอ: youtube "Fable 5 + Karpathy's LLM Wiki is Basically Cheating" (`watch?v=hQvwMj7lJe4`)
- second-brain repo ตัวอย่าง: `github.com/Sir-chawakorn/sanook-cli/tree/main/second-brain`
