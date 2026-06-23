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
  return { login };
})();
