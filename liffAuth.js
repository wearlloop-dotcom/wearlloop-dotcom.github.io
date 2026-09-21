// ===== LINE LIFF — login + ดึง UID (สำหรับ remarketing) =====
window.LiffAuth = (function () {
  async function login({ allowRedirect = true } = {}) {
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
      if (allowRedirect && liff.isInClient() && !sessionStorage.getItem('liffLoginTried')) {
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
      try { sessionStorage.removeItem('liffLoginTried'); } catch (_e) {}
      // ล้าง session เก่าก่อนเสมอ — เคสหลักคือ idToken หมดอายุแต่ liff ยังนับว่า login อยู่
      // (reload เฉย ๆ ได้ token เก่าเดิม → ติดประตูซ้ำ) logout+login ใหม่ได้ token สด
      try { if (liff.isLoggedIn()) liff.logout(); } catch (_e) {}
      const returnUrl = new URL(location.href);
      // Preserve catalog/deep-link context, never reuse OAuth callback parameters.
      const nested = new URLSearchParams((returnUrl.searchParams.get('liff.state') || '').replace(/^\?/, ''));
      for (const key of ['go', 'garment', 'date', 'express', 'look', 'ref', 'occasion', 'mood', 'pid', 'v']) {
        if (!returnUrl.searchParams.has(key) && nested.has(key)) returnUrl.searchParams.set(key, nested.get(key));
      }
      for (const key of ['code', 'state', 'liff.state', 'liffClientId', 'liffRedirectUri']) returnUrl.searchParams.delete(key);
      try {
        const intent = JSON.parse(sessionStorage.getItem('lloop_login_return') || 'null');
        if (intent && Date.now() - intent.at >= 0 && Date.now() - intent.at < 1800000) {
          if (intent.code) {
            returnUrl.searchParams.delete('go');
            returnUrl.searchParams.set('garment', intent.code);
            if (/^\d{4}-\d{2}-\d{2}$/.test(intent.date || '')) returnUrl.searchParams.set('date', intent.date);
          } else if (['cart', 'profile', 'orders', 'wallet', 'impact', 'kyc'].includes(intent.go)) {
            returnUrl.searchParams.delete('garment');
            returnUrl.searchParams.set('go', intent.go);
          }
        }
      } catch (_e) {}
      liff.login({ redirectUri: returnUrl.href });
    } catch (e) {
      console.warn('signIn failed:', e);
      alert('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง');
    }
  }
  return { login, signIn };
})();
