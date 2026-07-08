# Master Prompts — คลัง prompt ภาพการตลาด LLOOP

prompt แบบตัวอักษรล้วน ประกอบจากบล็อก 3 ส่วน: **[DRESS SPEC]** (ถอดครั้งเดียวต่อชุด เก็บถาวร) + **[SCENE]** (เปลี่ยนตามธีม/หนัง) + **โครงกล้อง-แสงคงที่** — อยากได้ภาพใหม่แค่สลับบล็อก ไม่ต้องเขียนใหม่ทั้งก้อน

## โครง Master Prompt (ก็อบแล้วแทนที่ [...])

```
RAW editorial fashion photograph, shot on Sony A7R V, 85mm f/1.4 lens at f/2, ISO 400, 1/160s, an elegant Thai woman [DRESS SPEC], [SCENE], natural skin texture with visible pores, a few loose hair strands, slight motion blur where natural, shallow depth of field with creamy bokeh, subtle 35mm film grain, photorealistic --no CGI, render, illustration, sparkle particles, glowing effects
```

## วิธีถอด [DRESS SPEC] จากรูปชุดจริง (ทำครั้งเดียวต่อชุด)

แนบรูปชุดเข้า Gemini แล้ววาง prompt นี้ ผลลัพธ์ที่ได้คือ DRESS SPEC เอามาบันทึกต่อท้ายไฟล์นี้:

```
Describe this dress as a hyper-detailed text-to-image prompt fragment in English, one paragraph: exact silhouette and cut, neckline, sleeve or strap style, waistline, skirt shape and length, fabric type and its sheen, precise color name, every construction detail (bow, pleats, seams, buttons, lining), and how the fabric moves. Describe ONLY the dress — no model, no background, no mood words. Output a single comma-separated fragment starting with "wearing".
```

## วิธีเขียน [SCENE] (ตามธีมหนัง — ขอจากสกิล /movie-vibe ได้)

ภาษาถ่ายภาพเท่านั้น ห้ามคำแฟนตาซี: สถานที่ + เวลา + แหล่งแสงจริง (key/rim) + โทนสีแบบ muted
ตัวอย่าง: `mid-twirl in a candlelit European palace ballroom at night, warm chandelier glow as rim light, soft window light from camera left, muted powder blue and champagne color grade`

---

## เร่งความสมจริง (ใช้เมื่อภาพยังดูเป็น AI)

ลุค "editorial" คือต้นเหตุความกลอสซี่ — สลับไปลุค "ภาพหลุดกองถ่าย" แทน:

- เปิดด้วย `candid behind-the-scenes photo taken on an iPhone at a real fashion shoot` แทน `RAW editorial fashion photograph`
- แสงต้องเละแบบสถานที่จริง: `mixed lighting with warm tungsten and cool daylight, uneven color temperature`
- ความบังเอิญ: `laughing between takes`, `slightly imperfect framing with extra headroom`, `crew members blurred in background`
- ผ้าจริงมีรอย: `visible creases in the satin where her hand holds the skirt`
- ผิวจริง: `unretouched natural skin with uneven tone and faint under-eye shadows`
- ปิดท้าย: `looks like a photo from someone's camera roll, not edited, no CGI, no render`
- **หน้าคนหลุดง่ายสุด** → `looking away over her shoulder` หรือ `photographed from behind` ช่วยมากและยังขายชุดได้เต็มตัว
- **ฉากใกล้ตัวลูกค้าเชื่อง่ายกว่า**: `Bangkok luxury hotel ballroom` / `Thai wedding venue` ดีกว่าวังยุโรป
- ห้ามให้ AI จัดฉากเกินจริง (เทียนเรียงวงบนพื้น กลีบกุหลาบโปรย) — ของพวกนี้ฟ้องว่าปลอม
- ถ้ายังไม่พอ: Midjourney `--style raw` เก่งภาพถ่ายคนกว่า Gemini หรือใช้ image-to-image จากรูปชุดจริง

## คลัง DRESS SPEC (เพิ่มเรื่อย ๆ)

### PS-06 — Blossom Dress (Sky Blue, ซาติน, โบว์) — เช่า 600.-

รูปต้นทาง: https://rprwilsbjptdnvsibjgi.supabase.co/storage/v1/object/public/garments/PS-06/1.jpg

```
(ยังไม่ได้ถอด — แนบรูปข้างบนเข้า Gemini + prompt ถอดชุด แล้วเอาผลมาแทนที่บรรทัดนี้)
```

## คลัง SCENE (เพิ่มเรื่อย ๆ)

### Cinderella (2015) — เจ้าหญิงบอลรูม

```
mid-twirl in a candlelit European palace ballroom at night, warm chandelier glow as rim light on hair and shoulder, soft window light from camera left as key light, muted powder blue and champagne color grade
```

### The Great Gatsby — ปาร์ตี้ยุค 1920s

```
standing in an opulent 1920s art deco ballroom, warm amber tungsten practical lights and out-of-focus party guests in background, champagne gold and jet black color grade
```
