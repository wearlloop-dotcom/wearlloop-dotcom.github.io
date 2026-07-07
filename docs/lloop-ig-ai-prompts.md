# LLOOP — AI Image Prompt Pack สำหรับ 9 โพสต์แรกบน IG

> ใช้คู่กับ `lloop-ig-visual-template.md` (ผังกริด 9 รูป ข้อ 15) — ธีมตัวอย่าง **"The Graduation Club"**
> ใช้ได้กับ Midjourney / Flux / Nano Banana / Firefly — ทุก prompt ออกแบบเป็น 4:5 แนวตั้ง
> สีแบรนด์ LLOOP ที่ล็อกในชุดนี้: **ครีม #F2ECDD + ทอง #C9A86A + เขียวเข้ม #0F6E56** (ดึงจากเว็บ LLOOP จริง)

---

## ⚠️ ข้อควรรู้ก่อนใช้ (สำคัญมากสำหรับร้านเช่า)

1. **AI gen "ชุด" ไม่ตรงกับชุดจริงในสต็อก** — ลูกค้าเช่าแล้วได้ของไม่ตรงรูป = ดราม่า/รีฟันด์ ดังนั้น:
   - ✅ ใช้ AI ได้เต็มที่กับ: teaser, ภาพ mood/บรรยากาศ, ปกธีม, พื้นหลังการ์ด, ภาพ concept ช่วงยังไม่มีสต็อก
   - ❌ ห้ามใช้ AI แทนรูปสินค้าจริงที่ลูกค้าจะกดจอง — การ์ดราคา/lineup ต้องเป็นรูปถ่ายชุดจริงเสมอ
   - แผนที่แนะนำ: เปิดเพจช่วงแรกด้วย AI (สร้างธีม+ตัวตน) → ทยอยแทนด้วยรูปถ่ายจริงเมื่อสต็อกมาถึง
2. **ความสม่ำเสมอของนางแบบ**: gen ทั้ง 9 ภาพใน session เดียว ใช้คำบรรยายนางแบบก้อนเดียวกันทุก prompt (ก้อน [MODEL] ด้านล่าง) + Midjourney ใช้ `--cref` รูปแรกที่ชอบ / Flux ใช้ seed เดิม
3. gen ทีละ prompt 3-4 candidate แล้วคัดตัวที่**โทนอุ่นครีมตรงกัน** — ถ้าใบไหนออกฟ้า/เย็น ทิ้งทันที

---

## 🧩 ก้อนมาตรฐาน (copy ไปประกอบทุก prompt)

**[MODEL] — นางแบบประจำร้าน (ใช้ซ้ำทุกภาพ):**
```
a young Thai woman in her early 20s, long dark brown hair, soft natural
makeup with rosy blush, warm peach-gold skin tone, calm doll-like expression
```

**[LOCATION] — โลเคชันธีมรับปริญญา (ล็อกทั้งบล็อก):**
```
a Thai university campus garden with cream colonial architecture, lush green
trees, warm late-afternoon golden light
```

**[STYLE] — ท้ายทุก prompt:**
```
soft muted warm film photography, Kodak Portra pastel tones, lifted blacks,
creamy ivory highlights, low-medium saturation, subtle film grain, natural
skin texture, vertical 4:5 composition
```

**[NEG] — negative prompt ทุกภาพ:**
```
--no harsh HDR, neon colors, cool blue tone, plastic skin, heavy vignette,
teal-orange grade, oversaturated, text, watermark, logo, extra fingers,
deformed hands
```

---

## 📸 Prompt ทั้ง 9 โพสต์ (ตามผังกริด — โพสต์ 1 = โพสต์ก่อน)

### โพสต์ 1 — Teaser props (ไม่เห็นชุด สร้างความสงสัย)
```
top-down flat lay on soft green grass: a graduation bouquet of cream and
white roses wrapped in ivory paper with a long gold satin ribbon (#C9A86A),
a rolled diploma tied with deep green ribbon (#0F6E56), delicate pearl
earrings, dappled golden afternoon sunlight casting soft leaf shadows,
generous negative space in upper third for text, [STYLE] [NEG]
```

### โพสต์ 2 — ปกธีม (ชุด hero A: เดรสครีมลูกไม้)
```
full body fashion lookbook photo of [MODEL] wearing an elegant cream lace
midi dress with delicate ruffle details and nude heels, standing with hands
holding a graduation bouquet, in [LOCATION], golden hour side-backlight
with warm rim light on hair, eye-level 50mm f/3.5, model centered with
clean negative space above her head for title text, shoes fully visible,
looking at camera, [STYLE] [NEG]
```
→ เอาเข้า Canva เติมชื่อธีมฟอนต์ script ขาว + โลโก้ LLOOP

### โพสต์ 3 — Close-up ลุคปก (ชุด A เดิม)
```
intimate close-up beauty portrait of [MODEL] wearing the same cream lace
dress, holding a small white rose near her lips, loose hair strand across
her face, warm golden backlight creating a soft halo, 85mm f/2 shallow
depth of field with blurred green garden background, face on upper third,
dreamy soft diffusion glow, [STYLE] [NEG]
```

### โพสต์ 4 — การ์ด "วิธีเช่า/ปฏิทินคิว" (ทำใน Canva — AI gen เฉพาะพื้นหลัง)
```
minimal elegant background texture: soft cream linen fabric (#F2ECDD)
gently draped with subtle folds, one thin gold satin ribbon (#C9A86A)
running diagonally across the lower corner, soft even window light, large
empty central area for text layout, top-down view, [STYLE] [NEG]
```
→ วางเนื้อหา "วิธีเช่า 4 ขั้นตอน" หรือปฏิทินคิวทับใน Canva ด้วยฟอนต์แบรนด์

### โพสต์ 5 — Full body ชุด B (เซ็ตชมพูนู้ด)
```
full body fashion photo of [MODEL] wearing a blush pink-nude two-piece set
with a fitted top and flowing midi skirt, standing with hands on hips in
front of a cream colonial wall with a horizontal stone ledge behind her,
[LOCATION], soft warm daylight, eye-level 50mm f/3.5, centered composition,
shoes fully visible, one hand touching her earring, [STYLE] [NEG]
```

### โพสต์ 6 — ภาพคู่ ชุด C + B (ฟีล "แก๊งเพื่อน")
```
two young Thai women best friends laughing together, one wearing a minimal
white midi dress standing, the other in a blush pink set sitting on cream
stone steps so their heads are at different heights, arms linked, one
looking at camera one looking at her friend, graduation bouquets beside
them, in [LOCATION], warm candid editorial mood, 35mm f/4 eye-level,
[STYLE] [NEG]
```

### โพสต์ 7 — Lineup card (ทำใน Canva — ถ้ายังไม่มีรูปชุดจริง ใช้ prompt studio cutout ชั่วคราว)
```
studio fashion photo of [MODEL] wearing [ใส่ชุดทีละตัว: cream lace midi
dress / blush pink two-piece set / minimal white midi dress], full body
standing straight facing camera, plain warm ivory studio background
(#F2ECDD), soft even lighting, catalog style, entire outfit and shoes
visible, [STYLE] [NEG]
```
→ gen ทีละชุด → ไดคัทใน Canva เรียงเป็น lineup + ใส่เลข + รหัสชุด + ราคาเช่า 1/3/5 วัน
→ ⚠️ **เมื่อสต็อกจริงมาถึง ต้องแทนด้วยรูปถ่ายชุดจริงทันที** (การ์ดนี้คือจุดที่ลูกค้าตัดสินใจจอง)

### โพสต์ 8 — Extreme close-up ผ้า (สื่อคุณภาพ + คอนเซ็ปต์เช่า)
```
extreme close-up detail shot of delicate ivory lace fabric with tiny
scalloped edges and fabric-covered buttons, hanging on a wooden clothesline
with natural wood clothespins, deep green garden hedge blurred in the
background, raking warm side light revealing the lace texture, macro 50mm
f/2.8, fabric fills 80% of frame, gentle breeze movement, [STYLE] [NEG]
```
(ราวตากผ้า = ภาพ signature สื่อ "ชุดหมุนเวียน" ตรงคอนเซ็ปต์ LLOOP)

### โพสต์ 9 — Hero กลับมา (ชุด A มุมใหม่ + ตราเปิดจอง)
```
full body fashion photo of [MODEL] wearing the same cream lace midi dress,
sitting gracefully on cream stone steps with her graduation bouquet on her
lap, tossing a gentle smile at camera, [LOCATION] at golden hour with long
soft shadows, slight low angle 50mm f/3.5, warm rim light, composition
leaving upper-right corner clear for a badge, [STYLE] [NEG]
```
→ เติมตรา "เปิดคิวจองแล้ว" สีเขียวเข้ม #0F6E56 ใน Canva มุมขวาบน

---

## เช็คลิสต์หลัง gen ครบ 9 ภาพ
- [ ] เปิดดูพร้อมกันทั้ง 9 ใบ — โทนอุ่นครีมเหมือนกันหมด ไม่มีใบไหนออกฟ้า
- [ ] นางแบบหน้าเดียวกันทุกใบ (ถ้าเพี้ยน gen ใหม่ด้วย --cref/seed เดิม)
- [ ] ทุกใบ 4:5 / ภาพเต็มตัวเห็นรองเท้าครบ
- [ ] ใส่ลายน้ำ "LLOOP" ตัวเล็กสีขาวก่อนโพสต์ทุกใบ
- [ ] การ์ดโพสต์ 4, 7 ประกอบใน Canva ด้วยสีแบรนด์ (#F2ECDD + #C9A86A + #0F6E56) + ฟอนต์ 3 ตระกูลที่ล็อกไว้
- [ ] Caption ทุกโพสต์: ราคา + รหัสชุด + CTA ไป LINE (บนรูปห้ามมีราคา ยกเว้น lineup card)
- [ ] แนะนำใส่ #AIgenerated หรือระบุในแคปชันช่วงที่ยังใช้ภาพ AI — โปร่งใสไว้ก่อน ลูกค้าไม่รู้สึกถูกหลอกตอนของจริงมาถึง
