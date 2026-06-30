// ===== LINE LIFF — login + ดึง UID (สำหรับ remarketing) =====
window.LiffAuth = (function () {
  async function login() {
    try {
      if (!window.liff || !CONFIG.LIFF_ID) return null;
      await liff.init({ liffId: CONFIG.LIFF_ID });
      if (liff.isLoggedIn()) {
        const p = await liff.getProfile(); // { userId, displayName, pictureUrl, statusMessage }
        return { userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl };
      }
      // ยังไม่ล็อกอิน: บังคับ login เฉพาะเมื่อเปิดในแอป LINE จริง (isInClient)
      // เบราว์เซอร์ปกติ (เดสก์ท็อป/มือถือเว็บ) = เข้าดูแบบ guest ไม่ redirect
      // → กัน redirect loop (liff.state ซ้อนกันจน HTTP 400)
      if (liff.isInClient() && !sessionStorage.getItem('liffLoginTried')) {
        sessionStorage.setItem('liffLoginTried', '1');
        liff.login(); // redirect ไป LINE login แล้วกลับมา (ครั้งเดียว)
      }
      return null;
    } catch (e) {
      console.warn('LIFF init/login skipped:', e);
      return null;
    }
  }
  // ผู้ใช้กดปุ่ม "เข้าสู่ระบบด้วย LINE" เอง → redirect ไป LINE login (ตั้งใจ ไม่ใช่ auto-loop)
  async function signIn() {
    try {
      if (!window.liff || !CONFIG.LIFF_ID) { alert('ยังไม่ได้ตั้งค่า LINE Login'); return; }
      await liff.init({ liffId: CONFIG.LIFF_ID });
      sessionStorage.removeItem('liffLoginTried');
      if (!liff.isLoggedIn()) liff.login();
      else location.reload();
    } catch (e) {
      console.warn('signIn failed:', e);
      alert('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  }
  return { login, signIn };
})();
