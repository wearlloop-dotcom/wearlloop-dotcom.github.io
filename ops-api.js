// ===== ops-api — เรียก RPC แอดมินผ่าน gateway ops-rpc (แทน publishable ตรง) =====
// ออกแบบเป็น "drop-in" ของ supabase rpc: คืน { data, error } เหมือนกัน
// วิธี convert หน้า ops (เกือบ find-replace):
//   1) โหลด: <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
//            <script src="../liff/config.js"></script><script src="ops-api.js"></script>
//   2) หลังสร้าง sb ใส่:  sb.rpc = window.opsRpc;   // คำสั่ง sb.rpc(...) เดิมจะวิ่งผ่าน gateway เอง
//   3) เรียก await window.opsLogin() ตอนเปิดหน้า (ให้ staff login ก่อน)
(function () {
  const CONF = window.CONFIG || {};
  const FUNCTIONS = (CONF.SUPABASE_URL || 'https://rprwilsbjptdnvsibjgi.supabase.co') + '/functions/v1';
  // LIFF เฉพาะ ops (endpoint = root → login กลับมาหน้า ops ไม่เด้งไปหน้าลูกค้า)
  const LIFF_ID = CONF.OPS_LIFF_ID || '2010486714-lDr0nzy0';
  let _ready = false, _initP = null;

  async function opsLogin() {
    if (_ready) return true;
    if (!window.liff || !LIFF_ID) throw new Error('ยังไม่ได้ตั้งค่า LINE Login (LIFF_ID)');
    // withLoginOnExternalBrowser: ให้ login ทำงานบนเบราว์เซอร์นอกแอป LINE (ไม่งั้น isLoggedIn=false หลัง redirect → วน)
    if (!_initP) _initP = liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: true });
    await _initP;
    if (liff.isLoggedIn()) { _ready = true; sessionStorage.removeItem('opsLoginTried'); return true; }
    // ยังไม่ login → redirect "ครั้งเดียว" (กัน loop: ถ้ากลับมาแล้วยังไม่ login = หยุด)
    if (sessionStorage.getItem('opsLoginTried')) return false;
    sessionStorage.setItem('opsLoginTried', '1');
    liff.login({ redirectUri: window.location.href });
    return false;
  }

  // drop-in แทน sb.rpc(fn,args) → คืน { data, error }
  async function opsRpc(fn, args) {
    try {
      if (!(await opsLogin())) return { data: null, error: { message: 'redirecting_to_login' } };
      const idToken = liff.getIDToken();
      if (!idToken) return { data: null, error: { message: 'ไม่พบ LINE idToken' } };
      const r = await fetch(FUNCTIONS + '/ops-rpc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, fn, args: args || {} }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || out.error) {
        const map = { unauthorized: 'เซสชันหมดอายุ เข้าสู่ระบบใหม่', no_access: 'ไม่มีสิทธิ์ใช้งานหลังบ้าน',
          owner_only: 'คำสั่งนี้สำหรับเจ้าของเท่านั้น', fn_not_allowed: 'คำสั่งนี้ไม่อนุญาต' };
        return { data: null, error: { message: map[out.error] || out.message || ('ops-rpc ' + r.status) } };
      }
      return { data: out.data, error: null };
    } catch (e) {
      return { data: null, error: { message: (e && e.message) || 'ops-rpc failed' } };
    }
  }

  window.opsLogin = opsLogin;
  window.opsRpc = opsRpc;
})();
