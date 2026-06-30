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

  // base URL (ไม่มี query) — redirectUri ให้ตรง LIFF endpoint + กลับมาสะอาด
  function baseUrl() { return location.origin + location.pathname; }

  // เด้งเข้า LINE login เอง พร้อมกัน redirect loop: ลองได้ครั้งเดียวต่อ session
  // ถ้ากลับมาแล้วยัง unauthorized อีก (login ไม่ติด/ยกเลิก) → ไม่เด้งซ้ำ ปล่อยให้โชว์ error แทน
  function reauth() {
    if (sessionStorage.getItem('meReauthTried')) return false; // เคยลองแล้วรอบนี้ → กัน loop
    sessionStorage.setItem('meReauthTried', '1');
    try { if (liff.isLoggedIn()) liff.logout(); } catch (_e) {} // ล้างโทเคนเก่าที่หมดอายุก่อน
    try { liff.login({ redirectUri: baseUrl() }); } catch (_e) {}
    return true;
  }

  // drop-in แทน client.rpc(fn,args) → คืน { data, error }
  async function meRpc(fn, args) {
    try {
      await ensureInit();
      if (!liff.isLoggedIn()) {
        // ยังไม่ล็อกอิน → เด้งเข้า LINE เลย (ทั้งในแอปและบนเว็บ) กัน loop ด้วย reauth()
        reauth();
        return { data: null, error: { message: 'redirecting_to_login' } };
      }
      const idToken = liff.getIDToken();
      if (!idToken) { reauth(); return { data: null, error: { message: 'redirecting_to_login' } }; }
      const r = await fetch(FUNCTIONS + '/me-rpc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, fn, args: args || {} }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || out.error) {
        // โทเคนหมดอายุ → เด้งเข้า LINE login ให้เองอัตโนมัติ (แทน toast ที่กดยาก)
        if (out.error === 'unauthorized' && reauth()) {
          return { data: null, error: { message: 'redirecting_to_login' } };
        }
        const map = { unauthorized: 'เซสชันหมดอายุ เข้าสู่ระบบใหม่', no_customer: 'ยังไม่พบบัญชีลูกค้าของคุณ',
          fn_not_allowed: 'คำสั่งนี้ไม่อนุญาต' };
        return { data: null, error: { message: map[out.error] || out.message || ('me-rpc ' + r.status) } };
      }
      sessionStorage.removeItem('meReauthTried'); // สำเร็จ → เคลียร์ guard ให้รอบหน้าเด้งได้อีก
      return { data: out.data, error: null };
    } catch (e) {
      return { data: null, error: { message: (e && e.message) || 'me-rpc failed' } };
    }
  }

  window.meRpc = meRpc;
})();
