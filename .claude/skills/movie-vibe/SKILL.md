---
name: movie-vibe
description: ถอดสูตรวิชวลของหนัง (สี แสง เลนส์ อารมณ์) เป็น style recipe แล้วประกอบเป็น prompt สำเร็จรูปสำหรับ Gemini/Nano Banana/Midjourney — ใช้ทำภาพการตลาด LLOOP ตามธีมหนัง เช่น "/movie-vibe Crazy Rich Asians ชุดราตรีสีเขียวมรกต"
argument-hint: "<ชื่อหนัง> [สิ่งที่อยากให้อยู่ในภาพ]"
---

# /movie-vibe — ก็อบวิบหนังมาทำภาพของเรา

รับชื่อหนัง + (ถ้ามี) สิ่งที่ user อยากให้อยู่ในภาพ แล้วผลิต prompt พร้อมใช้เป็น 2 จังหวะ

## จังหวะ 0 — เชื่อมกับชุดจริงในระบบ (ทำเมื่อเข้าเงื่อนไข)

ถ้าเซสชันมี Supabase MCP (project `rprwilsbjptdnvsibjgi`) ให้ใช้ข้อมูลชุดจริงจากตาราง `garments` แทนการแต่งชุดขึ้นเอง — **query แบบ SELECT อย่างเดียวเท่านั้น ห้ามแก้ข้อมูล**

- **user ระบุชุด** (รหัสเช่น `LBK-11-S` หรือชื่อเช่น "Seraphim") → ดึง `name, brand, color_name, color_hex, fabric_composition, category, tags, occasion_tags, rental_price, status` ของชุดนั้น แล้วประกอบ subject จากข้อมูลจริง เช่น tags `lace, sheer, floral` + สีขาว → `a white sheer floral lace dress` — **ห้ามใส่รายละเอียดชุดที่ไม่มีในข้อมูล** (เช่น อย่าเติม "ปักเลื่อม" ถ้าแท็กไม่มี)
- **user ให้แต่ธีมหนัง** → แนะนำชุดจากสต็อกที่เข้าธีม 2-3 ตัว: query ชุด `status = 'available'` กรองด้วย `color_name/color_family/tags/occasion_tags` ที่เข้ากับสูตรสไตล์ แสดงชื่อ + รหัส + ราคาเช่า แล้วทำ prompt ให้ตัวที่เข้าที่สุด (หรือทุกตัวถ้า user ขอ)
- ถ้าไม่มี Supabase MCP ในเซสชัน หรือหาชุดไม่เจอ → ทำแบบปกติ (จังหวะ 1-2) แล้วบอก user ว่าไม่ได้อิงสต็อกจริง

### โหมดรูปจริง (image-to-image) — สมจริงที่สุด ใช้เป็นอันดับแรกเสมอถ้าชุดมีรูป

ถ้าชุดมีรูปใน `photos[]` (URL ใน Supabase storage หรือ CDN) อย่าให้ AI วาดชุดจากคำบรรยาย — ให้ user เอา**รูปจริงเป็นตัวตั้ง**แล้วเปลี่ยนแค่นางแบบ/ฉากแทน เพราะพิกเซลของชุดมาจากภาพถ่ายจริง ผลลัพธ์จะสมจริงกว่า text-to-image เสมอ และชุดในภาพตรงกับชุดที่ลูกค้าได้จริง:

1. ส่ง URL รูปจริงของชุดให้ user (จาก `photos[]`) บอกให้เปิดรูปแล้วแนบเข้า Gemini/Nano Banana
2. แนบ prompt คู่กันโครงนี้ (สั่งให้ "คงชุดเดิมทุกประการ" คือหัวใจ):

```
Using the dress in the attached photo — keep its exact color, fabric, cut, and every detail unchanged — generate a photorealistic editorial fashion photo of a Thai woman wearing this dress, <ฉาก+แสงจาก style recipe แปลงเป็นภาษาถ่ายภาพแล้ว>, shot on 85mm f/2, natural skin texture, subtle film grain, photorealistic, no CGI, no render, do not alter the dress design
```

3. ถ้าอยากคุมฉากด้วย → แนบรูปสถานที่จริงเป็นภาพที่ 2 แล้วเติม "place the scene in the second attached photo"
4. text-to-image (จังหวะ 2 ปกติ) ใช้เป็น fallback เฉพาะชุดที่ยังไม่มีรูปในระบบ

## จังหวะ 1 — ถอดสูตร (style recipe)

วิเคราะห์สไตล์ภาพของหนังเรื่องนั้นจากความรู้ของคุณ (ถ้าไม่แน่ใจให้ WebSearch ก่อน) ออกมาเป็นสูตร 1 บรรทัด ภาษาอังกฤษ ครอบคลุม:

- **Color grading** — โทนสีหลัก/รอง เช่น teal-and-orange, muted pastels, golden warmth
- **Lighting** — เช่น soft window light, hard neon, candle-lit, high-key
- **Lens/framing** — เช่น anamorphic wide, shallow depth 85mm, symmetrical composition
- **Texture/medium** — เช่น 35mm film grain, glossy editorial, hazy bloom
- **Mood keywords** — 3-5 คำ เช่น opulent, nostalgic, tense

ตัวอย่างผลลัพธ์: `emerald and gold color grading, opulent warm tungsten lighting, glossy editorial 85mm shallow depth, soft film grain, luxurious romantic celebratory mood`

## จังหวะ 2 — ประกอบ prompt สุดท้าย (โหมดภาพถ่ายสมจริงเป็นค่าเริ่มต้น)

ถ้า user บอก subject มาแล้ว ให้ประกอบเลย ถ้าไม่ได้บอก ให้ default เป็นภาพแนวการตลาดเช่าชุดของ LLOOP (นางแบบใส่ชุดเด่น ฉากหรู เห็นรายละเอียดผ้า) โครง prompt ต้องเขียนเหมือนบรีฟช่างภาพจริง:

```
RAW editorial fashion photograph, shot on <กล้อง เช่น Sony A7R V>, <เลนส์+รูรับแสง เช่น 85mm f/1.4 at f/2>, ISO <400>, <1/160s>, <subject>, <ฉาก>, <ทิศแสง: key light จากไหน + rim light จากไหน>, visible fabric sheen and weave, natural skin texture with visible pores, a few loose hair strands, slight motion blur where natural, shallow depth of field with creamy bokeh, subtle 35mm film grain, <โทนสีจาก style recipe แบบ muted>, photorealistic --no CGI, render, illustration, sparkle particles, glowing effects
```

กติกาความสมจริง (สำคัญมาก ภาพจะหลุดเป็น CGI ถ้าพลาด):

- **ห้ามใช้คำแฟนตาซี** ใน prompt สุดท้าย — `magical`, `sparkle particles`, `fairy-tale haze`, `enchanted`, `glowing` ดันภาพไปทางภาพวาด/เรนเดอร์ทันที ให้แปลงอารมณ์จาก style recipe เป็นภาษาแสง/สีแทน (เช่น "magical candlelight" → "warm candlelit chandeliers, candle glow as rim light")
- **ต้องมีสมอถ่ายภาพครบ 3 ชุด**: (1) กล้อง+เลนส์+ค่าแสง (2) ทิศแสง key/rim จากแหล่งจริงในฉาก (3) ความไม่เพอร์เฟกต์ (ผิวเห็นรูขุมขน ผมหลุดร่าย motion blur) — ความไม่เพอร์เฟกต์คือสิ่งที่ทำให้ดูถ่ายจริง
- **ปิดท้ายด้วย negative เสมอ**: `--no CGI, render, illustration, sparkle particles, glowing effects` (Midjourney ใช้ `--no` / Gemini เขียนเป็นประโยค "no CGI, no render, ...")
- เลนส์แนะนำตามงาน: พอร์เทรตชุด → `85mm f/1.4`, เห็นฉากกว้าง → `35mm f/2`, รายละเอียดผ้าโคลสอัพ → `100mm macro`
- ถ้า user อยากได้ลุคแฟนตาซี/ภาพวาดจริง ๆ ค่อยถอดกติกานี้ออก

ส่งให้ user ทั้งสูตร (เผื่อเอาไปใช้ซ้ำกับ subject อื่น) และ prompt สุดท้าย พร้อมเวอร์ชันภาษาไทยสั้น ๆ อธิบายว่าสูตรนี้ให้ลุคแบบไหน

## หมายเหตุ

- ใช้กับเครื่องมือสร้างภาพภายนอก (Gemini/Nano Banana, Midjourney, ฯลฯ) — สกิลนี้ผลิต prompt ไม่ได้สร้างภาพเอง
- เลี่ยงการใส่ชื่อหนัง/ชื่อดาราลงใน prompt สุดท้ายตรง ๆ (บางเครื่องมือบล็อก) — สูตรที่ถอดแล้วใช้แทนได้เลย
- ถ้า user ทำคอนเทนต์ชุดเช่า แนะนำธีมที่เข้ากับชุดในสต็อกได้ เช่น ชุดราตรี → Crazy Rich Asians / The Great Gatsby, ชุดไทย → บุพเพสันนิวาส
