---
name: lloop-ig-9grid
description: สร้างรูป IG 9 รูปแรกของ LLOOP สไตล์ lookbooklookbook ด้วย AI image generation (Nano Banana/Gemini หรือเครื่องมือ gen รูปที่มีในเซสชัน) ตามผังกริด 3×3 และ prompt pack ที่วิจัยไว้ — ใช้เมื่อผู้ใช้สั่ง gen รูป IG, ทำรูปโพสต์, หรือเริ่มธีมใหม่
---

# LLOOP IG 9-Grid Generator

สร้างภาพ 9 โพสต์แรกของธีม IG สำหรับแบรนด์เช่าชุด LLOOP ให้ได้ลุคแบบ @lookbooklookbook

## ขั้นตอนการทำงาน (ทำตามลำดับ ห้ามข้าม)

1. **หาเครื่องมือ gen รูป** ตามลำดับ:
   1. ใช้ ToolSearch ค้น "image generation" / "banana" / "gemini image" — ถ้ามี MCP tool ให้ใช้ตัวนั้น
   2. ถ้าไม่มี MCP: เช็ค `GEMINI_API_KEY` ใน env (`[ -n "$GEMINI_API_KEY" ]` — ห้าม echo ค่า key) — ถ้ามี ให้**เรียก Gemini API ตรงผ่าน Bash**:
      - Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent` header `x-goog-api-key: $GEMINI_API_KEY` + `Content-Type: application/json`
      - Body: `{"contents":[{"parts":[{"text":"<PROMPT>"}]}],"generationConfig":{"responseModalities":["IMAGE"],"imageConfig":{"aspectRatio":"4:5"}}}`
      - สำหรับ self-reference (รูป 3-9): เพิ่ม part `{"inline_data":{"mime_type":"image/png","data":"<base64 ของรูปปกที่เลือก>"}}` ก่อน part text
      - Response: ถอด base64 จาก `candidates[0].content.parts[].inlineData.data` บันทึกเป็น .png ใน scratchpad (เขียน script Python ช่วยถอดได้)
      - ถ้า model ชื่อนี้ 404 ให้ลอง `gemini-2.5-flash-image-preview` / ถ้า aspectRatio ไม่รองรับ ให้ gen แล้ว crop เป็น 4:5 ด้วย Python PIL
   3. ถ้าไม่มีทั้งสองทาง: แจ้งผู้ใช้ว่าต้องใส่ `GEMINI_API_KEY` ใน environment secrets แล้วเปิดเซสชันใหม่ จากนั้นหยุด — อย่า gen ด้วยวิธีอื่น (SVG/Canva ไม่ใช่ภาพถ่าย ห้ามใช้แทน)
2. **อ่านไฟล์อ้างอิง 2 ไฟล์** (อยู่ใน repo นี้):
   - `docs/lloop-ig-ai-prompts.md` — prompt ทั้ง 9 โพสต์ + ก้อน [MODEL]/[LOCATION]/[STYLE]/[NEG] + คลังคำศัพท์
   - `docs/lloop-ig-visual-template.md` — ผังกริด 9 รูป (ข้อ 15) + กฎ layout
3. **ถามผู้ใช้ 1 คำถามก่อนเริ่ม** (ถ้ายังไม่ได้ระบุ): ธีมของบล็อกนี้คืออะไร? (default: "The Graduation Club" รับปริญญา) และมีรูปชุดจริง/รูปนางแบบอ้างอิงไหม
4. **Gen ทีละโพสต์ตามลำดับ 1→9** ตาม prompt ในไฟล์ โดยใช้ **เทคนิค self-reference chain**:
   - รูปที่ 1-2 (teaser + ปกธีม): gen จาก text prompt ล้วน → ให้ผู้ใช้เลือกใบที่ชอบก่อนไปต่อ
   - รูปที่ 3-9: **แนบรูปปกที่ผู้ใช้เลือกเป็น image reference** ทุกครั้ง (ล็อกหน้านางแบบ/โทน/แสงทั้งชุด และทุกภาพเป็นของ LLOOP 100%)
   - ❌ ห้ามใช้รูปจาก IG ของ lookbook เป็น image reference ตรง ๆ (เสี่ยงได้ภาพเหมือนต้นฉบับเกินไป = ประเด็นลิขสิทธิ์/ภาพลักษณ์) — ref จาก lookbook ให้ใช้ผ่าน "คำ" ใน prompt pack เท่านั้น ถ้าผู้ใช้ยืนยันจะแนบรูป lookbook ให้กำกับว่า "ใช้ดูโทนสี/แสงเท่านั้น ห้ามเลียนใบหน้า ฉาก หรือองค์ประกอบเฉพาะ" และห้ามบันทึกรูปนั้นลง repo (repo เป็น public)
   และ:
   - ประกอบ prompt เต็มตามโครงสร้าง 10 ส่วน (ภาค 2 ของไฟล์ prompts)
   - ทุก prompt ใช้ก้อน [MODEL] เดิมคำต่อคำ เพื่อล็อกหน้านางแบบ
   - Nano Banana ไม่รองรับ --no: แปลง negative เป็นประโยคบวก เช่น "strictly warm color palette, natural realistic skin with visible texture"
   - สัดส่วน 4:5 แนวตั้งทุกภาพ
   - โพสต์ 4 และ 7 เป็นการ์ด: gen เฉพาะพื้นหลัง/ภาพ cutout แล้วแจ้งผู้ใช้ว่าต้องประกอบข้อความใน Canva ด้วยสีแบรนด์ #F2ECDD + #C9A86A + #0F6E56
5. **ตรวจคุณภาพแต่ละภาพก่อนไปภาพถัดไป** ด้วยเกณฑ์:
   - โทนอุ่นครีม (ห้ามออกฟ้า/เย็น) / ผิวมี texture ไม่พลาสติก / ภาพเต็มตัวเห็นรองเท้าครบ
   - ถ้าไม่ผ่าน: แก้ด้วยตาราง troubleshooting ในไฟล์ prompts (ภาค 2 ข้อ 4) แล้ว gen ใหม่ สูงสุด 3 ครั้ง/ภาพ
6. **ส่งมอบ**: บันทึกภาพลงโฟลเดอร์ scratchpad → ส่งให้ผู้ใช้ด้วย SendUserFile ครบ 9 ภาพ พร้อมบอกลำดับการโพสต์ (โพสต์ 1 ก่อน → 9 หลังสุด) และหน้าตากริดที่จะได้ (แถวบน = 9,8,7)

## กฎเหล็ก
- ห้ามใช้ภาพ AI แทนรูปสินค้าจริงบนการ์ดราคา/lineup ที่ลูกค้ากดจอง — เตือนผู้ใช้เสมอว่าเมื่อสต็อกจริงมาถึงต้องถ่ายจริงแทน
- แนะนำผู้ใช้ระบุในแคปชันว่าเป็นภาพ AI ช่วงที่ยังใช้ (โปร่งใสกับลูกค้า)
- ทุกภาพต้องมาจากสูตรแสงเดียวกันทั้งชุด (default: golden hour สำหรับธีมรับปริญญา)
