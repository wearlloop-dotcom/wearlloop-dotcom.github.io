// ===== me-api — เรียก RPC ลูกค้าผ่าน gateway me-rpc (กัน IDOR) =====
// "drop-in" ของ supabase rpc: คืน { data, error } เหมือนกัน · gateway override p_customer/p_line_uid
// ให้เองจาก idToken ที่ verify แล้ว (ส่ง p_customer มาด้วยก็ได้ — ถูก override ทิ้ง)
// วิธี convert: หลังสร้าง client ใส่  client.rpc = window.meRpc;  แล้วโค้ดเดิมวิ่งผ่าน gateway เอง
(function () {
  const CONF = window.CONFIG || {};
  const FUNCTIONS = (CONF.SUPABASE_URL || 'https://rprwilsbjptdnvsibjgi.supabase.co') + '/functions/v1';
  const LIFF_ID = CONF.LIFF_ID;
  let _inited = false;

  async function ensureInit() {
    if (_inited) return;
    if (!window.liff || !LIFF_ID) throw new Error('ยังไม่ได้ตั้งค่า LINE Login');
    await liff.init({ liffId: LIFF_ID });
    _inited = true;
  }

  // drop-in แทน client.rpc(fn,args) → คืน { data, error }
  async function meRpc(fn, args) {
    try {
      await ensureInit();
      if (!liff.isLoggedIn()) {
        if (liff.isInClient()) { liff.login(); return { data: null, error: { message: 'redirecting_to_login' } }; }
        return { data: null, error: { message: 'ต้องเข้าสู่ระบบด้วย LINE ก่อน' } };
      }
      const idToken = liff.getIDToken();
      if (!idToken) return { data: null, error: { message: 'ไม่พบ LINE idToken' } };
      const r = await fetch(FUNCTIONS + '/me-rpc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, fn, args: args || {} }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || out.error) {
        const map = { unauthorized: 'เซสชันหมดอายุ เข้าสู่ระบบใหม่', no_customer: 'ยังไม่พบบัญชีลูกค้าของคุณ',
          fn_not_allowed: 'คำสั่งนี้ไม่อนุญาต' };
        return { data: null, error: { message: map[out.error] || out.message || ('me-rpc ' + r.status) } };
      }
      return { data: out.data, error: null };
    } catch (e) {
      return { data: null, error: { message: (e && e.message) || 'me-rpc failed' } };
    }
  }

  window.meRpc = meRpc;
})();
