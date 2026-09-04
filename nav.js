// ===== nav.js — topbar ร่วมทุกหน้า liff + เอนจิน i18n (TH/EN) =====
// วิธีใช้:
//   1) ใส่ใน <head> หรือก่อน </body>:  <script src="nav.js?v=1"></script>
//   2) วาง placeholder ที่ต้น <body>:
//        <header class="lloop-topbar" data-back="index.html"
//                data-back-th="หน้าหลัก" data-back-en="Home"></header>
//      - data-back        : ลิงก์ปุ่มกลับ (เว้นว่าง = ใช้ history.back)
//      - data-back-th/-en : ป้ายปุ่มกลับ (ไม่ใส่ = "หน้าหลัก"/"Home")
//      - data-logo="off"  : ซ่อนโลโก้ตรงกลาง (ค่าเริ่ม = แสดง)
//      - data-menu="off"  : ซ่อนปุ่มเมนู "ของฉัน" (ค่าเริ่ม = แสดง)
//   2b) เมนู "ของฉัน" ใช้ชุดเดียวกับหน้าแรก — รายการที่ต้องเปิดกล่องในหน้าแรก
//       (ออเดอร์/กระเป๋า/ตะกร้า/สมาชิก/โปรไฟล์/KYC) ลิงก์กลับ index.html?go=... ให้เอง
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
      '.lloop-topbar[data-theme="dark"] .tb-lang button.on{background:#F2ECDD;color:#14130F}',

      // ── ปุ่มเมนู "ของฉัน" + drawer (ชุดเดียวกับหน้าแรก) ──
      '.lloop-topbar .tb-menu{flex:0 0 auto;background:none;border:0;padding:6px 6px 6px 0;cursor:pointer;',
      '  display:inline-flex;align-items:center;color:var(--ink,#1A1A1A)}',
      '.lloop-topbar .tb-menu svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.6}',
      '.lloop-topbar[data-theme="dark"] .tb-menu{color:#F2ECDD}',
      '.nvscrim{position:fixed;inset:0;background:rgba(20,19,15,.42);z-index:80;opacity:0;transition:.22s;pointer-events:none}',
      '.nvscrim.on{opacity:1;pointer-events:auto}',
      '.nvdraw{position:fixed;top:0;left:0;bottom:0;width:min(330px,86vw);background:var(--bg,#FBFAF7);z-index:81;',
      '  transform:translateX(-102%);transition:transform .26s cubic-bezier(.4,0,.2,1);overflow-y:auto;',
      '  border-right:1px solid var(--line,#E7E5E1);font-family:var(--sans,inherit)}',
      '.nvdraw.on{transform:none}',
      '.nvdraw .nvhead{padding:20px 20px 16px;border-bottom:1px solid var(--line,#E7E5E1);position:relative}',
      '.nvdraw .nvx{position:absolute;top:12px;right:12px;background:none;border:0;font-size:24px;line-height:1;',
      '  color:var(--muted,#8C8B86);cursor:pointer;padding:2px 6px}',
      '.nvdraw .nvname{font-family:var(--display,inherit);font-size:18px;font-weight:700;letter-spacing:.5px;color:var(--ink,#1A1A1A)}',
      '.nvdraw .nvsub{font-size:12px;color:var(--muted,#8C8B86);margin-top:3px}',
      '.nvdraw .nvsec{padding:14px 12px 4px}',
      '.nvdraw .nvl{font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted,#8C8B86);',
      '  font-weight:600;padding:0 8px 7px}',
      '.nvdraw a.nvi{display:flex;align-items:center;gap:11px;padding:10px 8px;border-radius:10px;',
      '  color:var(--ink,#1A1A1A);text-decoration:none;font-size:14px}',
      '.nvdraw a.nvi:hover{background:var(--cream2,#F5F4F2)}',
      '.nvdraw a.nvi.on{background:var(--cream2,#F5F4F2);font-weight:600}',
      '.nvdraw a.nvi svg{width:19px;height:19px;flex:0 0 19px;stroke:currentColor;fill:none;stroke-width:1.5;color:var(--muted,#8C8B86)}',
      '.nvdraw .nvfoot{padding:16px 20px 30px;font-size:11.5px;color:var(--muted,#8C8B86);line-height:1.7}',
      '@media(prefers-reduced-motion:reduce){.nvdraw,.nvscrim{transition:none}}'
    ].join('');
    document.head.appendChild(s);
  }

  var BACK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
  var MENU_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';

  // ---------- เมนู "ของฉัน" (ชุดเดียวกับหน้าแรก) ----------
  // ไอคอนเส้นชุดเดียวกับ drawer หน้าแรก (โปรเจคนี้ไม่ใช้ emoji)
  var MI = {
    orders:'<svg viewBox="0 0 24 24"><path d="M6 2h9l3 3v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    cart:'<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 12.4a1 1 0 0 0 1 .8h8.2a1 1 0 0 0 1-.8L20 8H6"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>',
    wallet:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/></svg>',
    member:'<svg viewBox="0 0 24 24"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 21l-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/></svg>',
    foryou:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    stylist:'<svg viewBox="0 0 24 24"><path d="M12 21s-7-5-7-11a7 7 0 0 1 14 0c0 6-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    wish:'<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.4-9 9-9 9z"/></svg>',
    findwish:'<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5M11 8.5v5M8.5 11h5"/></svg>',
    family:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><path d="M16 5.3a3 3 0 0 1 0 5.9M21.5 19a6 6 0 0 0-4-5.6"/></svg>',
    gift:'<svg viewBox="0 0 24 24"><path d="M4 11h16v9H4z"/><path d="M2 7h20v4H2zM12 7v13M12 7S10 3 7.5 4 9 7 12 7zM12 7s2-4 4.5-3S15 7 12 7z"/></svg>',
    events:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    verify:'<svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9.5 12l1.8 1.8L15 10"/></svg>',
    impact:'<svg viewBox="0 0 24 24"><path d="M12 21c0-7 0-11 7-15-1 7-2 12-7 15z"/><path d="M12 21c0-6-1-9-6-12 1 6 2 10 6 12z"/></svg>',
    about:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>'
  };
  // รายการที่ต้องเปิดกล่องในหน้าแรก ส่งผ่าน index.html?go=... (หน้าแรกมี routeDeepLink รออยู่แล้ว)
  function menuSections() {
    var en = getLang() === 'en';
    return [
      { label: en ? 'My rentals' : 'การเช่าของฉัน', items: [
        [MI.orders, en?'My orders':'ออเดอร์ของฉัน', 'index.html?go=orders'],
        [MI.wallet, en?'LLOOP wallet':'กระเป๋า LLOOP', 'index.html?go=wallet'],
        [MI.cart,   en?'Cart':'ตะกร้า', 'index.html?go=cart'],
        [MI.member, en?'Membership & perks':'สมาชิก & สิทธิ์', 'index.html?go=membership']
      ]},
      { label: en ? 'Discover' : 'ค้นพบ', items: [
        [MI.foryou,  en?'For you':'แนะนำเฉพาะคุณ', 'index.html?go=foryou'],
        [MI.stylist, en?'What to wear? card game':'งานนี้ใส่อะไรดี เพื่อนสาวช่วยเลือก', 'quiz.html'],
        [MI.stylist, en?'LLOOP Atelier by venue':'LLOOP Atelier ประจำสถานที่', 'index.html?go=stylist'],
        [MI.wish,    en?'Saved looks':'ชุดที่หมายตา', 'index.html?go=saved'],
        [MI.findwish,en?'Wish for a piece':'อยากได้ชุดไหน บอกเราได้', 'wish.html'],
        [MI.foryou,  en?'Community · The Loop Looks':'ชุมชน · ลุคจากคนใน loop', 'looks.html'],
        [MI.family,  en?'Family & groups':'ครอบครัว & กลุ่ม', 'family.html'],
        [MI.events,  en?'My event dates':'วันงานของฉัน', 'my-events.html'],
        [MI.gift,    en?'Shoot & earn credit':'ถ่ายชุด · ได้เครดิต', 'creator.html']
      ]},
      { label: en ? 'My account' : 'บัญชีของฉัน', items: [
        [MI.verify, en?'Verify identity (KYC)':'ยืนยันตัวตน (KYC)', 'index.html?go=verify'],
        [MI.gift,   en?'Invite friends · get credit':'ชวนเพื่อน · รับเครดิต', 'index.html?go=invite'],
        [MI.impact, en?'Your impact':'ผลกระทบรักษ์โลกของคุณ', 'index.html?go=impact'],
        [MI.about,  en?'About us':'เกี่ยวกับเรา', 'about.html']
      ]}
    ];
  }
  function here() { return (location.pathname.split('/').pop() || 'index.html'); }
  function buildDrawer() {
    if (document.getElementById('nvdraw')) return;
    var en = getLang() === 'en';
    var sc = document.createElement('div'); sc.className = 'nvscrim'; sc.id = 'nvscrim';
    sc.addEventListener('click', NAV.closeMenu);
    var d = document.createElement('nav'); d.className = 'nvdraw'; d.id = 'nvdraw';
    d.setAttribute('aria-label', en ? 'My menu' : 'เมนูของฉัน');
    var html = '<div class="nvhead"><button class="nvx" type="button" aria-label="'
      + (en ? 'Close' : 'ปิด') + '">×</button>'
      + '<div class="nvname">LLOOP</div><div class="nvsub">'
      + (en ? 'share the look, save the planet' : 'แชร์ลุคสวย ช่วยรักษ์โลก') + '</div></div>';
    menuSections().forEach(function (sec) {
      html += '<div class="nvsec"><div class="nvl">' + sec.label + '</div>';
      sec.items.forEach(function (it) {
        var cur = it[2].split('?')[0] === here() ? ' on' : '';
        html += '<a class="nvi' + cur + '" href="' + it[2] + '">' + it[0] + '<span>' + it[1] + '</span></a>';
      });
      html += '</div>';
    });
    html += '<div class="nvfoot">' + (en ? 'Rent · wear · return' : 'เช่า · ใส่ · คืน') + '</div>';
    d.innerHTML = html;
    d.querySelector('.nvx').addEventListener('click', NAV.closeMenu);
    document.body.appendChild(sc); document.body.appendChild(d);
  }

  // ---------- render topbar ----------
  function renderBar(el) {
    var lang = getLang();
    var back = el.getAttribute('data-back');
    var bth = el.getAttribute('data-back-th') || 'หน้าหลัก';
    var ben = el.getAttribute('data-back-en') || 'Home';
    var blabel = lang === 'en' ? ben : bth;
    var showLogo = el.getAttribute('data-logo') !== 'off';

    var showMenu = el.getAttribute('data-menu') !== 'off';
    var menuHtml = showMenu
      ? '<button class="tb-menu" type="button" aria-label="' + (lang === 'en' ? 'Menu' : 'เมนู') + '">' + MENU_SVG + '</button>'
      : '';
    var backHtml = back != null
      ? '<a class="tb-back" href="' + back + '">' + BACK_SVG + '<span class="tb-back-l">' + blabel + '</span></a>'
      : '<button class="tb-back" type="button" onclick="history.back()">' + BACK_SVG + '<span class="tb-back-l">' + blabel + '</span></button>';
    var logoHtml = showLogo ? '<a class="tb-logo" href="index.html">LLOOP</a>' : '<span class="tb-logo" style="visibility:hidden">·</span>';
    var langHtml = '<div class="tb-lang" role="group" aria-label="language">'
      + '<button type="button" data-l="th" class="' + (lang === 'th' ? 'on' : '') + '">TH</button>'
      + '<button type="button" data-l="en" class="' + (lang === 'en' ? 'on' : '') + '">EN</button>'
      + '</div>';
    el.innerHTML = menuHtml + backHtml + logoHtml + langHtml;
    el.querySelectorAll('.tb-lang button').forEach(function (b) {
      b.addEventListener('click', function () { NAV.setLang(b.getAttribute('data-l')); });
    });
    var mb = el.querySelector('.tb-menu');
    if (mb) mb.addEventListener('click', NAV.openMenu);
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
      var od = document.getElementById('nvdraw'), os = document.getElementById('nvscrim');
      var wasOpen = !!(od && od.classList.contains('on'));
      if (od) od.remove(); if (os) os.remove();
      document.querySelectorAll('.lloop-topbar').forEach(renderBar);
      if (wasOpen) NAV.openMenu(); else document.body.style.overflow = '';
      applyI18n(document);
      // ให้ JS ของหน้า re-render เนื้อหา dynamic เอง
      try { window.dispatchEvent(new CustomEvent('lloop:lang', { detail: { lang: l } })); } catch (e) {}
    },
    refresh: function () { applyI18n(document); },
    openMenu: function () {
      buildDrawer();
      document.getElementById('nvdraw').classList.add('on');
      document.getElementById('nvscrim').classList.add('on');
      document.body.style.overflow = 'hidden';
    },
    closeMenu: function () {
      var d = document.getElementById('nvdraw'), s2 = document.getElementById('nvscrim');
      if (d) d.classList.remove('on'); if (s2) s2.classList.remove('on');
      document.body.style.overflow = '';
    }
  };

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') NAV.closeMenu(); });

  function boot() {
    injectStyle();
    var bars = document.querySelectorAll('.lloop-topbar');
    bars.forEach(renderBar);
    applyI18n(document);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
