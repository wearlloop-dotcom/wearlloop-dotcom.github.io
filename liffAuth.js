// ===== LINE LIFF — login + ดึง UID (สำหรับ remarketing) =====
window.LiffAuth = (function () {
  // init ครั้งเดียว (shared promise) — กัน liff.init() ซ้ำ (boot + signIn) ที่ทำ SDK throw → ปุ่มเงียบ
  let _initP = null;
  function ensureInit() {
    if (!window.liff || !CONFIG.LIFF_ID) return Promise.reject(new Error('LIFF SDK/ID missing'));
    if (!_initP) _initP = liff.init({ liffId: CONFIG.LIFF_ID });
    return _initP;
  }
  // base URL (ไม่มี query) — ใช้เป็น redirectUri ให้ตรง LIFF endpoint + กลับมาสะอาด
  function baseUrl() { return location.origin + location.pathname; }

  async function login() {
    try {
      await ensureInit();
      if (liff.isLoggedIn()) {
        const p = await liff.getProfile(); // { userId, displayName, pictureUrl }
        return { userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl };
      }
      // ยังไม่ล็อกอิน: auto-redirect เฉพาะในแอป LINE (กัน redirect loop บนเว็บ) — เว็บกดปุ่มเอง
      if (liff.isInClient() && !sessionStorage.getItem('liffLoginTried')) {
        sessionStorage.setItem('liffLoginTried', '1');
        liff.login({ redirectUri: baseUrl() });
      }
      return null;
    } catch (e) {
      console.warn('LIFF init/login skipped:', e);
      return null;
    }
  }

  // ผู้ใช้กดปุ่ม "เข้าสู่ระบบด้วย LINE" เอง → redirect ไป LINE login
  async function signIn() {
    if (!window.liff || !CONFIG.LIFF_ID) { alert('ยังไม่ได้ตั้งค่า LINE Login'); return; }
    try { await ensureInit(); }
    catch (e) { console.warn('liff.init:', e); /* init ซ้ำ/แล้วเสร็จ — ไปต่อ login ได้ */ }
    try {
      sessionStorage.removeItem('liffLoginTried');
      // ผู้ใช้กดปุ่ม login = ต้องการเข้าสู่ระบบ → เด้งไป LINE login "เสมอ"
      // ถ้ามี session ค้างอยู่แล้วแต่โปรไฟล์ไม่ขึ้น (scope/โทเคนมีปัญหา) → logout ให้สดก่อน
      if (liff.isLoggedIn()) { try { liff.logout(); } catch (_e) {} }
      liff.login({ redirectUri: baseUrl() }); // redirect ไป LINE login แล้วกลับมาหน้าเดิม
    } catch (e) {
      console.error('signIn failed:', e);
      alert('เข้าสู่ระบบไม่สำเร็จ: ' + (e && e.message ? e.message : e)); // โชว์เหตุจริงเพื่อ debug
    }
  }
  return { login, signIn, ensureInit };
})();
