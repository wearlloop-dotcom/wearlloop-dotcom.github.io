// ===== Meta Pixel scaffold =====
// เว้น CONFIG.META_PIXEL_ID ว่าง = ปิดสนิท (ไม่โหลดอะไร) · ใส่ Pixel ID เมื่อไหร่ = เริ่มเก็บ event อัตโนมัติ
// ใช้ติดตาม: เปิดดูชุด (ViewContent) · กดจอง (InitiateCheckout) → ทำ remarketing + ให้แอด optimize
(function () {
  var PID = (window.CONFIG && window.CONFIG.META_PIXEL_ID) || '';
  // ค่าเริ่มต้น: ตัวยิง event เป็น no-op (กัน app.js เรียกแล้ว error เมื่อยังไม่ใส่ pixel)
  window.fbTrack = function () {};
  if (!PID) return;

  // Meta Pixel base code (มาตรฐาน) — โหลด fbevents แล้ว init
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', PID);
  window.fbq('track', 'PageView');

  // ตัวยิง event จริง (แทน no-op)
  window.fbTrack = function (event, params) {
    try { window.fbq('track', event, params || {}); } catch (e) {}
  };
})();
