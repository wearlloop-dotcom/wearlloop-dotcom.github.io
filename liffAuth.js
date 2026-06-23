// ===== LINE LIFF — login + ดึง UID (สำหรับ remarketing) =====
window.LiffAuth = (function () {
  async function login() {
    try {
      if (!window.liff) return null;
      await liff.init({ liffId: CONFIG.LIFF_ID });
      if (!liff.isLoggedIn()) {
        liff.login(); // redirect ไป LINE login แล้วกลับมา
        return null;
      }
      const p = await liff.getProfile(); // { userId, displayName, pictureUrl, statusMessage }
      return { userId: p.userId, displayName: p.displayName, pictureUrl: p.pictureUrl };
    } catch (e) {
      console.warn('LIFF init failed (standalone preview):', e);
      return null;
    }
  }
  return { login };
})();
