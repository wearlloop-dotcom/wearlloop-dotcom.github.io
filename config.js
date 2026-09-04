// ===== ตั้งค่าเชื่อมต่อ — ใส่ค่าจริงแล้วเปลี่ยน USE_MOCK = false =====
window.CONFIG = {
  USE_MOCK: false, // true = ใช้ mock data (พรีวิวได้เลย) · false = ต่อ Supabase + LINE จริง
  SUPABASE_URL:'https://rprwilsbjptdnvsibjgi.supabase.co',
  SUPABASE_ANON_KEY:'sb_publishable_rhIE-GxNxBI-diEwLEJfZg_oAMGxhfa',
  LIFF_ID:'2010486714-1g6lDuHo', // จาก LINE Developers > LIFF
  META_PIXEL_ID:'1303659898642811', // LLOOP Pixel — เก็บ PageView / ViewContent / InitiateCheckout
  GA4_ID:'G-XXXXXXXXXX',           // TODO: แทนด้วย Measurement ID จาก GA4 > Admin > Data Streams
  N8N_BASE_URL:'',                 // TODO: ใส่ URL เมื่อ deploy n8n เช่น https://n8n.lloop.app
  GOOGLE_MAPS_KEY:'AIzaSyDOz7Ruts01gnasSpgqhDJcHosO-fXhm9w', // Maps key (wearlloop-maps-web) — ล็อก 3 Maps API + โดเมน github.io/lloop.app

  // ===== วิดีโอ hero แบบ Dior (เปิดด้วย pain point ผู้หญิง → ทางออก LLOOP) =====
  // ใส่ลิงก์ไฟล์วิดีโอที่เรนเดอร์แล้ว (ดูพรอมป์ที่ brand/video-prompts.md — ชุด P1–P6 + คลิป #1 แชร์ตู้)
  // ใส่ได้หลายคลิป จะเล่นต่อเนื่องวนลูป (montage). เว้นว่าง = ใช้พื้นหลังไล่สีเดิม
  HERO_VIDEO:[
    // คลิป Higgsfield (seedance 2.0) โฮสต์บน CloudFront — โหลดตรง ไม่ต้องเก็บไฟล์ในรีโป
    // ชุดนี้เรนเดอร์ที่ 4K 16:9 ทั้งหมด (ของเดิม 7 ส.ค. ความละเอียดต่ำกว่า จึงเปลี่ยนออก)
    // ร้อยเป็นเรื่องเดียวกัน: เดินในสวนเขาวงกต → เจอตู้เสื้อผ้า → วิ่งเข้าไปหา
    'https://d8j0ntlcm91z4.cloudfront.net/user_36sWU61mPuAHtBBHgSIgEItPECx/hf_20260822_083025_a923fae6-8d06-40a6-a113-b7a5e680e06c.mp4',  // 4K · 7s · เจอตู้กลางเขาวงกต
    'https://d8j0ntlcm91z4.cloudfront.net/user_36sWU61mPuAHtBBHgSIgEItPECx/hf_20260901_035853_86042dbd-6ff9-4e17-a790-94f38cf72337.mp4',  // 4K · 7s · วิ่งเข้าหาตู้
    'https://d8j0ntlcm91z4.cloudfront.net/user_36sWU61mPuAHtBBHgSIgEItPECx/hf_20260824_105058_b83b4bd4-4896-47b5-a44d-9cbd38019a8b.mp4',  // 4K · 7s · ช็อตค้นพบ
  ],
  HERO_POSTER:'', // รูป poster ระหว่างวิดีโอโหลด (เว้นว่าง = พื้นหลังไล่สี)
  HERO_RATE:0.7,  // ความเร็ววิดีโอ hero: 1 = ปกติ, 0.7 = ช้าลงเล็กน้อย (ปรับเลขนี้เพื่อเร่ง/หน่วง)

  // ===== วิดีโอหน้า About (story) — เว้นว่างไว้ = โชว์ poster placeholder สวย ๆ พร้อมเสียบลิงก์ทีหลัง =====
  // hero = วิดีโอพื้นหลังหัวเรื่อง (ambient, เล่นเงียบวนลูป) · story = คลิปสั้นแทรกในบท "the loop"
  // เลือกคลิปคนละตัวกับ hero หน้าแรก จะได้ไม่ซ้ำกันเวลาเปิดสองหน้าต่อกัน
  ABOUT_HERO_VIDEO:'https://d8j0ntlcm91z4.cloudfront.net/user_36sWU61mPuAHtBBHgSIgEItPECx/hf_20260901_033011_31c565db-e18b-4619-b42e-ff677a5a555a.mp4',  // 4K · 8s · วิ่งเข้าหาตู้กลางสวน (เล่นเป็น ambient หลังตัวหนังสือ)
  ABOUT_HERO_POSTER:'',  // รูปนิ่งคั่นระหว่างโหลด hero (เว้นว่าง = ใช้พื้นหลังไล่สีเดิมของหน้า)
  // บท 03 "the loop" — เดินในตรอกเมือง ไปเจอตู้ที่ปลายทาง เปิดประตู แล้วก้าวเข้าไป
  ABOUT_STORY_VIDEO:'https://d8j0ntlcm91z4.cloudfront.net/user_36sWU61mPuAHtBBHgSIgEItPECx/hf_20260902_102442_5eb8d920-ba03-40a8-98b7-b26c4cc23e4e.mp4',  // 10s · เล่าครบวงจรในคลิปเดียว
  ABOUT_STORY_POSTER:'', // รูปนิ่งของคลิป the loop (โชว์เป็น poster ก่อนกดเล่น)
};
