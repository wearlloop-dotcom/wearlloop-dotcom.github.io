// ===== ตั้งค่าเชื่อมต่อ — ใส่ค่าจริงแล้วเปลี่ยน USE_MOCK = false =====
window.CONFIG = {
  USE_MOCK: false, // true = ใช้ mock data (พรีวิวได้เลย) · false = ต่อ Supabase + LINE จริง
  SUPABASE_URL:'https://rprwilsbjptdnvsibjgi.supabase.co',
  SUPABASE_ANON_KEY:'sb_publishable_rhIE-GxNxBI-diEwLEJfZg_oAMGxhfa',
  LIFF_ID:'2010486714-1g6lDuHo', // จาก LINE Developers > LIFF
  META_PIXEL_ID:'1303659898642811', // LLOOP Pixel — เก็บ PageView / ViewContent / InitiateCheckout
  GA4_ID:'G-XXXXXXXXXX',           // TODO: แทนด้วย Measurement ID จาก GA4 > Admin > Data Streams
  N8N_BASE_URL:'',                 // TODO: ใส่ URL เมื่อ deploy n8n เช่น https://n8n.lloop.app
};
