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
