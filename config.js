// ===== ตั้งค่าเชื่อมต่อ — ใส่ค่าจริงแล้วเปลี่ยน USE_MOCK = false =====
window.CONFIG = {
  USE_MOCK: false, // true = ใช้ mock data (พรีวิวได้เลย) · false = ต่อ Supabase + LINE จริง
  SUPABASE_URL:'https://rprwilsbjptdnvsibjgi.supabase.co',
  SUPABASE_ANON_KEY:'sb_publishable_rhIE-GxNxBI-diEwLEJfZg_oAMGxhfa',
  LIFF_ID:'2010486714-1g6lDuHo', // จาก LINE Developers > LIFF
  META_PIXEL_ID:'', // ใส่ Pixel ID จาก Meta Events Manager แล้วระบบจะเริ่มเก็บ view/จอง อัตโนมัติ (เว้นว่าง = ปิด)
};
