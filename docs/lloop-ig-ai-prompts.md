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

**[STYLE] v2 — ท้ายทุก prompt (อัปเกรดด้วยคำศัพท์ realism):**
```
RAW editorial fashion photograph, shot on Kodak Portra 400, lifted blacks,
faded film curve, no pure black no pure white, creamy ivory highlights,
muted saturation, fine film grain, subtle halation, natural skin texture
with visible pores and rosy blush, no retouching, loose hair strands,
vertical 4:5 composition
```

**[NEG] v2 — negative prompt ทุกภาพ (แบนลุค AI/เรนเดอร์):**
```
--no CGI, 3D render, illustration, anime, airbrushed plastic skin,
oversharpened, studio seamless backdrop, harsh HDR glow, neon colors,
cool blue tone, teal-orange grade, heavy vignette, oversaturated,
perfect symmetric face, text, watermark, logo, extra fingers, deformed hands
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

## 📖 คลังคำศัพท์เทคนิค — ถอดจากลุคจริงของ lookbook (คำ → ทำหน้าที่)

> ใช้เสริม/สลับใน prompt ตามสถานการณ์ — แบ่ง 4 กลุ่ม

### กลุ่ม 1: ประกาศความเป็น "ภาพถ่ายฟิล์ม" (ใช้ทุกภาพ — รวมอยู่ใน [STYLE] v2 แล้ว)
| คำ | ทำหน้าที่ |
|---|---|
| `RAW editorial fashion photograph, shot on Kodak Portra 400` | ประกาศเป็นภาพถ่ายนิตยสาร + ฟิล์มที่ตรงโทน lookbook สุด |
| `lifted blacks, faded film curve, no pure black no pure white` | สูตร grade หลัก — ดำไม่สนิท ขาวไม่จ้า แบนนุ่มแบบฟิล์ม |
| `fine film grain, subtle halation` | เกรน + แสงฟุ้งรอบไฮไลต์ = ลายเซ็นภาพในร่ม |
| `natural skin texture with visible pores, rosy blush, no retouching` | ผิวจริงไม่พลาสติก + บลัชชมพูชัด (เมคอัพประจำแบรนด์) |

### กลุ่ม 2: กล้อง/เลนส์ (เลือกตามระยะภาพ)
| คำ | ทำหน้าที่ |
|---|---|
| `35mm lens at f/4, subject 3 meters away` | ภาพเต็มตัว — perspective ธรรมชาติ หลังเบลอนุ่มแต่ยังอ่านออก (lookbook ไม่ใช้ f/1.2 ละลายหมด) |
| `85mm f/2, ISO 400, 1/160s` | close-up beauty — หน้าไม่บิด + ค่ากล้องสมจริงบังคับ noise แบบภาพถ่าย |
| `shot on iPhone, 26mm wide, casual HDR daylight, slightly off-center framing` | ภาพ candid คั่นบล็อก — จงใจ "หลุดกล้อง" |
| `slight motion blur from slow shutter, dreamy diffusion filter (Black Pro-Mist)` | ภาพในร่มไฟส้ม — ฟุ้งมีแฮโล |

### กลุ่ม 3: สูตรแสง (เลือก 1 สูตรต่อธีม — ห้ามผสมในบล็อกเดียว)
| คำ | ใช้กับธีม |
|---|---|
| `golden hour low sun, warm rim light through hair, long soft shadows` | สวน/เดท/รับปริญญาช่วงเย็น |
| `soft overcast open shade, wraparound diffused light, low contrast` | สวนเขียวหม่น/ชุดขาว/สายหวาน |
| `harsh midday sun, crisp defined shadows as design element, model squinting slightly` | ทะเล/summer — เงาแข็งคือดีไซน์ |
| `large window softbox from 45 degrees, gentle wrapping shadow` | สตูดิโอครีม/ชุดออกงาน |
| `direct on-camera flash, hard shadow on wall behind subject, paparazzi snapshot energy` | ปาร์ตี้/ปีใหม่/สีจัด |
| `warm tungsten lamp visible in frame, amber glow, halation around bulbs` | โรงแรมวินเทจ/ราตรี — โคมไฟต้องอยู่ในเฟรม |

### กลุ่ม 4: องค์ประกอบ/ความสมจริง (ลายเซ็น lookbook)
| คำ | ทำหน้าที่ |
|---|---|
| `centered symmetrical composition, Wes Anderson style` | จัดกลางเฟรมสมมาตร (~70% ของฟีดต้นแบบ) |
| `shot through blurred foreground flowers, layered depth` | ยิงผ่านของหน้าเลนส์ — สร้างมิติ ใช้ได้ทุกบล็อก |
| `cropped at mid-thigh, face cropped above the lips` | ครอปตัดหัวจงใจ บังคับสายตาไปที่ชุด (ภาพ medium) |
| `loose hair strands, fabric caught mid-breeze, one hand adjusting hat brim` | ความไม่เพอร์เฟกต์ + ท่า "มือไม่ว่าง" |
| `outfit tone-on-tone with background palette, single red accent detail` | กฎสี: ชุดกลืนฉาก + สีเด้งจุดเดียว |
| `real props: fresh flowers, wicker basket, vintage radio` | props ของจริงตามธีม — กัน AI แถมของประหลาด |

---
---

# ภาค 2: คู่มือเขียน Prompt ฉบับละเอียด (สำหรับทีมที่อยากปรับเอง)

## 1. โครงสร้างประโยค Prompt 10 ส่วน — สูตรประกอบมาตรฐาน LLOOP

เขียนเรียงตามลำดับนี้เสมอ (ส่วนไหนไม่ใช้ข้ามได้ แต่ห้ามสลับลำดับ):

```
[1 ประกาศชนิดภาพ] [2 ตัวแบบ] [3 ชุด+ผ้า] [4 ท่าโพส+มือ] [5 ฉาก+props]
[6 แสง] [7 กล้อง/เลนส์/ระยะ] [8 องค์ประกอบ] [9 โทนสี/grade+ความไม่เพอร์เฟกต์]
[10 negative]
```

| ส่วน | ทำหน้าที่ | ถ้าขาดจะเกิดอะไร |
|---|---|---|
| 1. ประกาศชนิดภาพ | `RAW editorial fashion photograph, shot on Kodak Portra 400` | ได้ภาพลุคเรนเดอร์/การ์ตูน |
| 2. ตัวแบบ | ก้อน [MODEL] เดิมทุกภาพ | หน้านางแบบเปลี่ยนไปทุกใบ |
| 3. ชุด+ผ้า | บรรยายผ้า+ดีเทลให้เจาะจง (ดูคลังหมวดผ้า) | ได้ "เดรสทั่วไป" ไม่มีคาแรกเตอร์ |
| 4. ท่าโพส+มือ | ท่า + **มือทำอะไร** เสมอ | มือห้อยเฉย ๆ ดูแข็ง + มือเพี้ยนง่าย |
| 5. ฉาก+props | ฉากเจาะจง + props ของจริง | ฉากหลัง generic ไม่เข้าธีม |
| 6. แสง | 1 สูตรจาก 6 สูตร (ห้ามผสม) | แสงเรือง ๆ ทั้งภาพแบบ AI |
| 7. กล้อง | เลนส์+รูรับแสง+ระยะห่าง | perspective มั่ว ขาบิด |
| 8. องค์ประกอบ | center/thirds + negative space | ครอปมั่ว วางข้อความไม่ได้ |
| 9. Grade+imperfection | โทนฟิล์ม + ผมปลิว/ผ้าพลิ้ว | ภาพนิ่งแข็งเป็นหุ่น |
| 10. Negative | ก้อน [NEG] v2 | ลุค CGI หลุดมา |

## 2. คลังคำศัพท์ละเอียดรายหมวด

### หมวดผ้าและดีเทลชุด (สำคัญสุดสำหรับร้านเช่า — ยิ่งเจาะจง ชุดยิ่งดูแพง)
| คำ | ความหมาย/ใช้เมื่อ |
|---|---|
| `delicate ivory lace with scalloped edges` | ลูกไม้ขอบหยัก — ชุดสายหวาน |
| `sheer organza overlay, crisp and airy` | ผ้าแก้วบางโปร่งซ้อนชั้น — ชุดออกงานดูแพง |
| `liquid satin with soft sheen, bias-cut` | ซาตินเงานุ่มตัดเฉียง — ราตรี/ดินเนอร์ |
| `layered soft tulle skirt` | กระโปรงทูลฟูหลายชั้น — บัลเลต์คอร์/รับปริญญา |
| `smocked bodice, stretchy fit` | ตัวเสื้อสม็อคยืด — ชุด freesize |
| `puff sleeves with elastic cuffs` | แขนพอง — สายหวาน coquette |
| `structured corset bodice with visible boning` | คอร์เซ็ตมีโครง — ปาร์ตี้/gala |
| `ruffled tiered hem` | ชายกระโปรงระบายเป็นชั้น |
| `tiny fabric-covered buttons down the back` | กระดุมหุ้มผ้าเรียงหลัง — ดีเทล close-up |
| `crochet knit texture` | นิตโครเชต์ — ธีมทะเล/summer |
| `satin bow detail at the waist` | โบว์ซาตินที่เอว — จุดขายยุคนี้ |
| `soft chiffon that catches the breeze` | ชีฟองพลิ้วลม — ภาพ outdoor |

### หมวดท่าโพส (7 ท่าลายเซ็น → ภาษา prompt)
| ท่า | คำ prompt |
|---|---|
| ยืนขายชุดหลัก | `standing straight with hands on hips, weight on one leg, calm doll-like expression looking at camera` |
| นั่งพื้น/หญ้า | `sitting on the grass with legs folded to one side, hands resting on her lap, blank serene expression` |
| มือไม่ว่าง | `one hand adjusting her hat brim / holding a bouquet close to her chest / tugging the end of her braid / holding fresh cherries` |
| ยกแขนเปิดเอว | `one arm raised above her head shielding her eyes from the sun, elongating her silhouette` |
| ท่าคู่ | `two friends with heads at different heights, one standing one sitting, arms linked, one looking at camera one laughing at her friend` |
| ท่านอน top-down | `lying on the grass with hair fanned out, photographed directly from above, arms relaxed beside her head` |
| candid เดิน | `mid-stride crossing the street, looking away from camera, holding an iced coffee, natural walking motion` |

### หมวดระยะภาพ + มุมกล้อง
| คำ | ได้ภาพแบบ |
|---|---|
| `extreme close-up of fabric texture, object fills 80% of frame` | ดีเทลผ้า (Recipe E) |
| `close-up head and shoulders portrait` | beauty (Recipe D) |
| `waist-up medium shot` / `cropped at mid-thigh` | ครึ่งตัว (Recipe C) |
| `full body head to toe, shoes fully visible` | เต็มตัว (Recipe B) — **ต้องมี shoes fully visible เสมอ** |
| `environmental wide shot, subject small in frame` | ฉากใหญ่คนเล็ก (Recipe A) |
| `photographed directly from above, top-down 90 degrees` | flat lay / ท่านอน |
| `eye-level camera at chest height` | มุมมาตรฐาน 60% ของฟีด |
| `slight low angle, camera tilted up 15 degrees` | เงยนิด — ท่ามั่นใจ/แดดจัด |
| `slight high angle looking down at seated subject` | กดลงนิด — ท่านั่ง doll-like |
| `dutch tilt 15 degrees, playful energy` | เอียงกล้อง — ธีมสนุกเท่านั้น |

### หมวดแสงละเอียด (ขยายจาก 6 สูตร — คำหลัก + คำเสริม + เวลาถ่ายจริง)
| สูตร | คำหลัก | คำเสริมให้สมจริงขึ้น | เทียบเวลาจริง |
|---|---|---|---|
| Golden hour | `golden hour low sun, warm rim light through hair` | `long soft shadows stretching across the grass, lens catching slight warm flare` | 16:30-17:45 |
| Overcast | `soft overcast open shade, wraparound diffused light` | `matte porcelain skin, muted colors, no visible shadows, European film mood` | วันครึ้มทั้งวัน |
| แดดจัด | `harsh midday sun, crisp defined shadows` | `model squinting slightly, wearing small vintage sunglasses, shadow shapes as graphic design element` | 11:00-14:00 |
| Softbox ครีม | `large window softbox from 45 degrees` | `gentle wrapping shadow on the far cheek, cream wall evenly lit, still-air studio calm` | สตูดิโอ |
| Flash ปาร์ตี้ | `direct on-camera flash, paparazzi snapshot energy` | `hard shadow outline cast on the wall directly behind subject, slightly overexposed skin, saturated colors` | ในร่ม/กลางคืน |
| Tungsten วินเทจ | `warm tungsten lamp visible in frame, amber glow` | `halation blooming around the bulbs, slight motion blur from slow shutter, Black Pro-Mist diffusion softness` | ในร่มโคมส้ม |

### หมวดฉากไทยที่เข้าธีม LLOOP (พร้อมใช้)
| ธีม | คำ prompt ฉาก |
|---|---|
| รับปริญญา | `Thai university campus garden with cream colonial architecture and lush green trees` |
| เพื่อนเจ้าสาว | `tropical garden wedding venue with white draped fabric arch and pastel flower arrangements` |
| ราตรี/gala | `vintage grand hotel corridor with warm lamp light, patterned carpet and brass details` |
| คาเฟ่/เดท | `minimal cream-toned cafe with arched windows, warm wood furniture and dried flowers` |
| ทะเล/summer | `white sand beach with turquoise water, striped beach umbrella and wicker basket` |
| สงกรานต์/ผ้าไทย | `old Thai teak wooden house veranda with golden afternoon light and tropical plants` |

## 3. Syntax เฉพาะแพลตฟอร์ม

### Midjourney (v6/v7)
```
[prompt] --ar 4:5 --style raw --v 6.1
```
- `--style raw` สำคัญมาก — ปิดการ "แต่งสวย" อัตโนมัติที่ทำให้ภาพดู AI
- **ล็อกหน้านางแบบ:** gen ภาพแรกให้ได้หน้าที่ชอบ → copy URL รูป → ทุก prompt ถัดไปเติม `--cref [URL] --cw 100`
- **ล็อกโทนภาพทั้งชุด:** `--sref [URL รูปแรก] --sw 300`
- negative ใช้ `--no` ตามก้อน [NEG]

### Flux / Nano Banana / Firefly (ไม่รองรับ --no)
- แปลง negative เป็นประโยคบวก: แทน `--no plastic skin` ด้วย `natural realistic skin with visible texture`
- แทน `--no cool blue tone` ด้วย `strictly warm color palette throughout`
- ล็อกความสม่ำเสมอ: ใช้ seed เดิม + prompt ก้อน [MODEL] เดิมคำต่อคำ
- Nano Banana เก่งเรื่องแก้ภาพ: gen ภาพหลักก่อน แล้วสั่งแก้เป็นภาษาธรรมชาติ ("เปลี่ยนชุดเป็นเดรสชมพู แสงเดิม ท่าเดิม")

## 4. ตารางแก้ปัญหา — gen แล้วไม่ได้ลุค lookbook

| อาการ | สาเหตุ | คำที่ใช้แก้ |
|---|---|---|
| ภาพดูเป็นการ์ตูน/เรนเดอร์ | ไม่ได้ประกาศชนิดภาพ | เติม `RAW editorial fashion photograph` ไว้หน้าสุด + `--style raw` (MJ) |
| ผิวเนียนพลาสติก | AI default beauty | `natural skin texture with visible pores, no retouching` + ตัด `beautiful/perfect` ออกจาก prompt |
| ภาพสด/คมเกินไป ดูดิจิทัล | ขาด grade ฟิล์ม | เติม 3 คำเทพ: `lifted blacks, no pure black no pure white, subtle halation` |
| โทนออกฟ้า/เย็น | model ไม่รู้ทิศสี | `strictly warm ivory-cream color palette, Kodak Portra 400` + negative `cool blue tone` |
| แสงเรือง ๆ ไม่มีทิศ | ไม่ระบุสูตรแสง | เลือก 1 สูตรจากหมวดแสง + ระบุทิศ (`from 45 degrees`, `backlight`) |
| หน้านางแบบเปลี่ยนทุกใบ | ไม่ล็อกตัวละคร | `--cref` (MJ) / seed เดิม + [MODEL] คำต่อคำ |
| ขายาวผิดปกติ/ตัวบิด | AI ใช้เลนส์กว้างเอง | `50mm lens, subject 3 meters away, natural proportions` |
| ตัดรองเท้า/ครอปมั่ว | ไม่คุมเฟรม | `full body head to toe, shoes fully visible, feet well inside frame` |
| มือเพี้ยน | มือว่างไม่มีงานทำ | ให้มือถือของเสมอ (`holding a bouquet`) + negative `deformed hands, extra fingers` |
| ฉากหลังรก/ของแปลกโผล่ | ฉากไม่เจาะจง | บรรยายฉากละเอียด + `clean uncluttered background` + props ระบุชิ้น |
| ภาพสวยแต่ "ไม่ใช่แบรนด์เรา" | สีหลุด palette | เติม `outfit tone-on-tone with background, single accent color detail` + `--sref` รูปที่ผ่านแล้ว |

## 5. ตัวอย่างประกอบสูตรเต็ม (before → after)

**Before (สั้นเกิน — ได้ภาพ generic):**
```
a woman in a cream dress in a garden, film look, 4:5
```

**After (ประกอบครบ 10 ส่วน — ได้ลุค lookbook):**
```
RAW editorial fashion photograph, shot on Kodak Portra 400, | a young Thai
woman in her early 20s, long dark brown hair, calm doll-like expression, |
wearing a cream delicate lace midi dress with scalloped edges, puff sleeves
and tiny fabric-covered buttons, nude block heels, | standing with one hand
adjusting her white headscarf, the other holding a graduation bouquet, |
in a Thai university campus garden with cream colonial architecture, |
golden hour low sun with warm rim light through her hair, long soft
shadows, | eye-level 50mm lens at f/3.5, subject 3 meters away, full body
head to toe with shoes fully visible, | centered composition with clean
negative space above her head, | lifted blacks, no pure black no pure
white, creamy ivory highlights, muted saturation, subtle halation, loose
hair strands catching the breeze, | --ar 4:5 --style raw
--no CGI, 3D render, illustration, airbrushed plastic skin, cool blue tone,
text, watermark, deformed hands
```
(เครื่องหมาย | ใส่ให้เห็นรอยต่อ 10 ส่วน — ตอนใช้จริงลบออก)

## เช็คลิสต์หลัง gen ครบ 9 ภาพ
- [ ] เปิดดูพร้อมกันทั้ง 9 ใบ — โทนอุ่นครีมเหมือนกันหมด ไม่มีใบไหนออกฟ้า
- [ ] นางแบบหน้าเดียวกันทุกใบ (ถ้าเพี้ยน gen ใหม่ด้วย --cref/seed เดิม)
- [ ] ทุกใบ 4:5 / ภาพเต็มตัวเห็นรองเท้าครบ
- [ ] ใส่ลายน้ำ "LLOOP" ตัวเล็กสีขาวก่อนโพสต์ทุกใบ
- [ ] การ์ดโพสต์ 4, 7 ประกอบใน Canva ด้วยสีแบรนด์ (#F2ECDD + #C9A86A + #0F6E56) + ฟอนต์ 3 ตระกูลที่ล็อกไว้
- [ ] Caption ทุกโพสต์: ราคา + รหัสชุด + CTA ไป LINE (บนรูปห้ามมีราคา ยกเว้น lineup card)
- [ ] แนะนำใส่ #AIgenerated หรือระบุในแคปชันช่วงที่ยังใช้ภาพ AI — โปร่งใสไว้ก่อน ลูกค้าไม่รู้สึกถูกหลอกตอนของจริงมาถึง
