// ===== nav.js — topbar ร่วมทุกหน้า liff + เอนจิน i18n (TH/EN) =====
// วิธีใช้:
//   1) ใส่ใน <head> หรือก่อน </body>:  <script src="nav.js?v=1"></script>
//   2) วาง placeholder ที่ต้น <body>:
//        <header class="lloop-topbar" data-back="index.html"
//                data-back-th="หน้าหลัก" data-back-en="Home"></header>
//      - data-back        : ลิงก์ปุ่มกลับ (เว้นว่าง = ใช้ history.back)
//      - data-back-th/-en : ป้ายปุ่มกลับ (ไม่ใส่ = "หน้าหลัก"/"Home")
//      - data-logo="off"  : ซ่อนโลโก้ตรงกลาง (ค่าเริ่ม = แสดง)
//   3) แปลข้อความ static: ใส่ data-i18n="EN string" บน element ที่เป็นไทย
//        <h1 data-i18n="Family & groups">ครอบครัว &amp; กลุ่ม</h1>
//      หรือแปลทั้ง map ผ่าน window.NAV_I18N = { 'ข้อความไทย':'English', ... }
//   4) JS ของหน้า: อ่านภาษาจาก NAV.lang / ฟังก์ชัน NAV.t(th,en) และฟัง event 'lloop:lang'
(function () {
  'use strict';
  var KEY = 'lloop_lang';
  function getLang() { try { return localStorage.getItem(KEY) || 'th'; } catch (e) { return 'th'; } }
  function setLangStore(l) { try { localStorage.setItem(KEY, l); } catch (e) {} }

  // ---------- style (ใช้ CSS vars ของแต่ละหน้า มี fallback ครบ) ----------
  function injectStyle() {
    if (document.getElementById('lloop-topbar-css')) return;
    var s = document.createElement('style');
    s.id = 'lloop-topbar-css';
    s.textContent = [
      '.lloop-topbar{position:sticky;top:0;z-index:50;display:flex;align-items:center;',
      '  height:54px;padding:0 14px;gap:8px;background:var(--bg,#FBFAF7);',
      '  border-bottom:1px solid var(--line,#E7E5E1)}',
      '.lloop-topbar .tb-back{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;',
      '  background:none;border:0;padding:6px 4px;margin-left:-4px;cursor:pointer;',
      '  font-family:var(--sans,inherit);font-size:13px;color:var(--muted,#8C8B86);text-decoration:none}',
      '.lloop-topbar .tb-back svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.9}',
      '.lloop-topbar .tb-back:hover{color:var(--ink,#1A1A1A)}',
      '.lloop-topbar .tb-logo{flex:1 1 auto;text-align:center;font-family:var(--display,var(--disp,var(--font-display,inherit)));',
      '  font-size:20px;font-weight:700;letter-spacing:1px;color:var(--ink,#1A1A1A);text-decoration:none}',
      '.lloop-topbar .tb-lang{flex:0 0 auto;display:inline-flex;border:1px solid var(--line,#E7E5E1);',
      '  border-radius:20px;overflow:hidden;background:#fff}',
      '.lloop-topbar .tb-lang button{border:0;background:none;padding:4px 10px;cursor:pointer;',
      '  font-family:var(--sans,inherit);font-size:11px;font-weight:600;letter-spacing:.5px;color:var(--muted,#8C8B86)}',
      '.lloop-topbar .tb-lang button.on{background:var(--ink,#1A1A1A);color:#fff}',
      // ── โหมดมืด: ใส่ data-theme="dark" บน .lloop-topbar (สำหรับหน้าพื้นเข้ม เช่น about) ──
      '.lloop-topbar[data-theme="dark"]{background:rgba(12,11,8,.72);backdrop-filter:blur(8px);border-bottom-color:rgba(242,236,221,.14)}',
      '.lloop-topbar[data-theme="dark"] .tb-back{color:rgba(242,236,221,.7)}',
      '.lloop-topbar[data-theme="dark"] .tb-back:hover{color:#F2ECDD}',
      '.lloop-topbar[data-theme="dark"] .tb-logo{color:#F2ECDD}',
      '.lloop-topbar[data-theme="dark"] .tb-lang{border-color:rgba(242,236,221,.22);background:transparent}',
      '.lloop-topbar[data-theme="dark"] .tb-lang button{color:rgba(242,236,221,.7)}',
      '.lloop-topbar[data-theme="dark"] .tb-lang button.on{background:#F2ECDD;color:#14130F}'
    ].join('');
    document.head.appendChild(s);
  }

  var BACK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';

  // ---------- render topbar ----------
  function renderBar(el) {
    var lang = getLang();
    var back = el.getAttribute('data-back');
    var bth = el.getAttribute('data-back-th') || 'หน้าหลัก';
    var ben = el.getAttribute('data-back-en') || 'Home';
    var blabel = lang === 'en' ? ben : bth;
    var showLogo = el.getAttribute('data-logo') !== 'off';

    var backHtml = back != null
      ? '<a class="tb-back" href="' + back + '">' + BACK_SVG + '<span class="tb-back-l">' + blabel + '</span></a>'
      : '<button class="tb-back" type="button" onclick="history.back()">' + BACK_SVG + '<span class="tb-back-l">' + blabel + '</span></button>';
    var logoHtml = showLogo ? '<a class="tb-logo" href="index.html">LLOOP</a>' : '<span class="tb-logo" style="visibility:hidden">·</span>';
    var langHtml = '<div class="tb-lang" role="group" aria-label="language">'
      + '<button type="button" data-l="th" class="' + (lang === 'th' ? 'on' : '') + '">TH</button>'
      + '<button type="button" data-l="en" class="' + (lang === 'en' ? 'on' : '') + '">EN</button>'
      + '</div>';
    el.innerHTML = backHtml + logoHtml + langHtml;
    el.querySelectorAll('.tb-lang button').forEach(function (b) {
      b.addEventListener('click', function () { NAV.setLang(b.getAttribute('data-l')); });
    });
  }

  // ---------- i18n: แปล element ที่มี data-i18n ----------
  // เก็บข้อความไทยต้นฉบับไว้ครั้งแรก (data-i18n-th) เพื่อสลับกลับได้
  function applyI18n(root) {
    var lang = getLang();
    var map = window.NAV_I18N || null; // map ไทย->อังกฤษ (ทางเลือก)
    (root || document).querySelectorAll('[data-i18n]').forEach(function (n) {
      if (n.getAttribute('data-i18n-th') == null) n.setAttribute('data-i18n-th', n.innerHTML);
      var th = n.getAttribute('data-i18n-th');
      var en = n.getAttribute('data-i18n'); // ใส่ EN ตรงนี้
      if (en === '' && map) en = map[th.trim()] || th;
      n.innerHTML = lang === 'en' ? (en || th) : th;
    });
    // placeholder
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(function (n) {
      if (n.getAttribute('data-i18n-ph-th') == null) n.setAttribute('data-i18n-ph-th', n.getAttribute('placeholder') || '');
      var th = n.getAttribute('data-i18n-ph-th');
      var en = n.getAttribute('data-i18n-ph');
      n.setAttribute('placeholder', lang === 'en' ? (en || th) : th);
    });
    document.documentElement.lang = lang;
  }

  // ---------- public API ----------
  var NAV = window.NAV = {
    get lang() { return getLang(); },
    t: function (th, en) { return getLang() === 'en' ? (en != null ? en : th) : th; },
    setLang: function (l) {
      if (l !== 'th' && l !== 'en') return;
      setLangStore(l);
      document.querySelectorAll('.lloop-topbar').forEach(renderBar);
      applyI18n(document);
      // ให้ JS ของหน้า re-render เนื้อหา dynamic เอง
      try { window.dispatchEvent(new CustomEvent('lloop:lang', { detail: { lang: l } })); } catch (e) {}
    },
    refresh: function () { applyI18n(document); }
  };

  function boot() {
    injectStyle();
    var bars = document.querySelectorAll('.lloop-topbar');
    bars.forEach(renderBar);
    applyI18n(document);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
