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

  // ออดิท: id_token ของ staff สำหรับ gate edge functions ที่เรียก AI (marketing-ai/intake-tagger/repair-advise)
  window.opsIdToken = function () { try { return (window.liff && liff.getIDToken && liff.getIDToken()) || ''; } catch (e) { return ''; } };
  window.opsLogin = opsLogin;
  window.opsRpc = opsRpc;

  // ประตูหน้า ops: ลูกค้า/คนไม่ล็อกอินหลงเข้ามา → โชว์ "หน้านี้สำหรับทีมงาน" + ปุ่มกลับร้าน (แทนหน้าค้างครึ่ง ๆ)
  function showStaffGate() {
    if (document.getElementById('opsStaffGate')) return;
    const d = document.createElement('div');
    d.id = 'opsStaffGate';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#FBFAF7;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center';
    d.innerHTML = '<div style="max-width:340px;font-family:system-ui,sans-serif">'
      + '<div style="font-size:22px;font-weight:700;letter-spacing:1px;margin-bottom:10px">LLOOP</div>'
      + '<div style="font-size:15px;font-weight:600;margin-bottom:6px">หน้านี้สำหรับทีมงาน LLOOP ค่ะ</div>'
      + '<div style="font-size:13px;color:#8C8B86;margin-bottom:18px">ถ้าคุณเป็นลูกค้า กดปุ่มด้านล่างเพื่อไปเลือกชุดได้เลยนะคะ</div>'
      + '<a href="index.html" style="display:block;background:#1A1A1A;color:#fff;border-radius:12px;padding:12px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:10px">ไปหน้าเลือกชุด</a>'
      + '<button type="button" onclick="sessionStorage.removeItem(\'opsLoginTried\');location.reload()" style="background:none;border:none;color:#8C8B86;font-size:12.5px;text-decoration:underline;cursor:pointer">เป็นทีมงาน — เข้าสู่ระบบอีกครั้ง</button>'
      + '</div>';
    document.body.appendChild(d);
  }
  // เรียกตอนเปิดหน้า ops แทน opsLogin().catch(()=>{}) — login ไม่ผ่าน (กลับมาแล้วยังไม่ติด) → โชว์ประตู
  window.opsGuard = async function () {
    const triedBefore = !!sessionStorage.getItem('opsLoginTried');
    try {
      const ok = await opsLogin();
      // ok=false รอบแรก = กำลัง redirect ไป LINE (ไม่ต้องโชว์) · เคย redirect แล้วยังไม่ติด = ไม่ใช่ staff/ยกเลิก
      if (!ok && triedBefore) showStaffGate();
      return ok;
    } catch (_e) { showStaffGate(); return false; }
  };
})();
