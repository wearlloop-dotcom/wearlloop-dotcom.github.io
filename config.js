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
    // 'https://<storage>/lloop-hero-painpoints.mp4',  // ปัญหา P1–P6 ตัดรวม
    // 'https://<storage>/lloop-hero-share.mp4',        // คลิป #1 แชร์ตู้เสื้อผ้ากัน
  ],
  HERO_POSTER:'', // รูป poster ระหว่างวิดีโอโหลด (เว้นว่าง = พื้นหลังไล่สี)

  // ===== วิดีโอหน้า About (story) — เว้นว่างไว้ = โชว์ poster placeholder สวย ๆ พร้อมเสียบลิงก์ทีหลัง =====
  // hero = วิดีโอพื้นหลังหัวเรื่อง (ambient, เล่นเงียบวนลูป) · story = คลิปสั้นแทรกในบท "the loop"
  ABOUT_HERO_VIDEO:'',   // เช่น 'https://<storage>/lloop-story-hero.mp4'  (เว้นว่าง = ใช้พื้นหลังไล่สีเดิม)
  ABOUT_HERO_POSTER:'',  // รูปนิ่งคั่นระหว่างโหลด hero
  ABOUT_STORY_VIDEO:'',  // เช่น 'https://<storage>/lloop-the-loop.mp4'   (เว้นว่าง = โชว์การ์ด poster + ปุ่มเล่น)
  ABOUT_STORY_POSTER:'', // รูปนิ่งของคลิป the loop (โชว์เป็น poster ก่อนกดเล่น)
};
