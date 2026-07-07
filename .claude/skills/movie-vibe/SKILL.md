---
name: movie-vibe
description: ถอดสูตรวิชวลของหนัง (สี แสง เลนส์ อารมณ์) เป็น style recipe แล้วประกอบเป็น prompt สำเร็จรูปสำหรับ Gemini/Nano Banana/Midjourney — ใช้ทำภาพการตลาด LLOOP ตามธีมหนัง เช่น "/movie-vibe Crazy Rich Asians ชุดราตรีสีเขียวมรกต"
argument-hint: "<ชื่อหนัง> [สิ่งที่อยากให้อยู่ในภาพ]"
---

# /movie-vibe — ก็อบวิบหนังมาทำภาพของเรา

รับชื่อหนัง + (ถ้ามี) สิ่งที่ user อยากให้อยู่ในภาพ แล้วผลิต prompt พร้อมใช้เป็น 2 จังหวะ

## จังหวะ 1 — ถอดสูตร (style recipe)

วิเคราะห์สไตล์ภาพของหนังเรื่องนั้นจากความรู้ของคุณ (ถ้าไม่แน่ใจให้ WebSearch ก่อน) ออกมาเป็นสูตร 1 บรรทัด ภาษาอังกฤษ ครอบคลุม:

- **Color grading** — โทนสีหลัก/รอง เช่น teal-and-orange, muted pastels, golden warmth
- **Lighting** — เช่น soft window light, hard neon, candle-lit, high-key
- **Lens/framing** — เช่น anamorphic wide, shallow depth 85mm, symmetrical composition
- **Texture/medium** — เช่น 35mm film grain, glossy editorial, hazy bloom
- **Mood keywords** — 3-5 คำ เช่น opulent, nostalgic, tense

ตัวอย่างผลลัพธ์: `emerald and gold color grading, opulent warm tungsten lighting, glossy editorial 85mm shallow depth, soft film grain, luxurious romantic celebratory mood`

## จังหวะ 2 — ประกอบ prompt สุดท้าย

ถ้า user บอก subject มาแล้ว ให้ประกอบเลย ถ้าไม่ได้บอก ให้ default เป็นภาพแนวการตลาดเช่าชุดของ LLOOP (นางแบบใส่ชุดเด่น ฉากหรู เห็นรายละเอียดผ้า):

```
Photo of <subject>, in this exact style: <style recipe จากจังหวะ 1>
```

ส่งให้ user ทั้งสูตร (เผื่อเอาไปใช้ซ้ำกับ subject อื่น) และ prompt สุดท้าย พร้อมเวอร์ชันภาษาไทยสั้น ๆ อธิบายว่าสูตรนี้ให้ลุคแบบไหน

## หมายเหตุ

- ใช้กับเครื่องมือสร้างภาพภายนอก (Gemini/Nano Banana, Midjourney, ฯลฯ) — สกิลนี้ผลิต prompt ไม่ได้สร้างภาพเอง
- เลี่ยงการใส่ชื่อหนัง/ชื่อดาราลงใน prompt สุดท้ายตรง ๆ (บางเครื่องมือบล็อก) — สูตรที่ถอดแล้วใช้แทนได้เลย
- ถ้า user ทำคอนเทนต์ชุดเช่า แนะนำธีมที่เข้ากับชุดในสต็อกได้ เช่น ชุดราตรี → Crazy Rich Asians / The Great Gatsby, ชุดไทย → บุพเพสันนิวาส
