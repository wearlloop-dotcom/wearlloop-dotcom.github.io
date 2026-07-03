// ===== ops-menu — side menu + nav config ที่กรองตามตำแหน่งพนักงาน =====
// ใช้: ใส่ <script src="ops-api.js"></script><script src="ops-menu.js"></script>
//      แล้วเรียก  await window.opsMenu.mount();   (หลัง opsLogin ผ่าน opsRpc ครั้งแรกเอง)
// เปิดเผย: window.OPS_NAV (config), window.opsVisibleNav(role,isOwner), window.opsMenu.mount()
(function () {
  // ── ไอคอนกลางของระบบ: line art SVG (stroke 1.6, currentColor) เท่านั้น — ห้ามใช้อิโมจิ ──
  const I = (paths) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const OPS_ICONS = {
    dot:      I('<circle cx="12" cy="12" r="2"/>'),
    menu:     I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
    home:     I('<path d="M4 11l8-7 8 7"/><path d="M6.5 9.5V20h11V9.5"/>'),
    clock:    I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    wash:     I('<path d="M12 3.5c3.5 4.2 6 7.3 6 10.1a6 6 0 1 1-12 0c0-2.8 2.5-5.9 6-10.1z"/>'),
    send:     I('<path d="M21 3 3 10.5l7 3.5 3.5 7L21 3z"/><path d="M10 14 21 3"/>'),
    plus:     I('<path d="M12 5v14M5 12h14"/>'),
    putaway:  I('<rect x="3.5" y="7.5" width="17" height="12.5" rx="1.5"/><path d="M3.5 7.5 6 4h12l2.5 3.5M9.5 11.5h5"/>'),
    repair:   I('<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/>'),
    nfc:      I('<circle cx="12" cy="12" r="2.2"/><path d="M6.6 6.6a7.6 7.6 0 0 0 0 10.8M17.4 6.6a7.6 7.6 0 0 1 0 10.8"/>'),
    grid:     I('<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17"/>'),
    hanger:   I('<path d="M12 9V8.2c0-1 .9-1.5 1.6-2A2 2 0 1 0 10 4.6"/><path d="M12 9 3.6 15.4a1.3 1.3 0 0 0 .8 2.3h15.2a1.3 1.3 0 0 0 .8-2.3L12 9z"/>'),
    swap:     I('<path d="M7 8h13l-3.5-3.5M17 16H4l3.5 3.5"/>'),
    updown:   I('<path d="M8 19.5V5M8 5 4.8 8.2M8 5l3.2 3.2M16 4.5V19M16 19l-3.2-3.2M16 19l3.2-3.2"/>'),
    inbox:    I('<path d="M12 3.5V12M12 12 8.5 8.5M12 12l3.5-3.5"/><path d="M4 14.5h4.5l1.5 2h4l1.5-2H20"/><path d="M4 14.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4.5"/>'),
    trend:    I('<path d="M4 9.5c2-2.6 4-2.6 6 0s4 2.6 6 0M4 15c2-2.6 4-2.6 6 0s4 2.6 6 0"/>'),
    speaker:  I('<path d="M3 10v4h3l5 5V5L6 10H3z"/><path d="M16 9a5 5 0 0 1 0 6"/>'),
    play:     I('<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6l5.5-3L10 9z"/>'),
    star:     I('<path d="M12 4l2.35 4.9 5.4.7-4 3.75 1 5.35L12 16.1 7.25 18.7l1-5.35-4-3.75 5.4-.7L12 4z"/>'),
    camera:   I('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7 10 4.5h4L15.5 7"/><circle cx="12" cy="13.2" r="3.4"/>'),
    heart:    I('<path d="M12 20s-7.2-4.7-9.4-9.2A5.4 5.4 0 0 1 12 6.4a5.4 5.4 0 0 1 9.4 4.4C19.2 15.3 12 20 12 20z"/>'),
    eye:      I('<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
    search:   I('<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8 21 21"/>'),
    gauge:    I('<path d="M4.6 18.5a9 9 0 1 1 14.8 0"/><path d="M12 13.5 16 9"/><circle cx="12" cy="13.5" r="1"/>'),
    chart:    I('<path d="M4 19h16"/><path d="M5 15l4.5-4.5 3 3L19 7"/><path d="M19 11V7h-4"/>'),
    banknote: I('<rect x="3" y="6.5" width="18" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 10v4M17.5 10v4"/>'),
    receipt:  I('<path d="M6 3.5h12V20l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 20V3.5z"/><path d="M9 8.5h6M9 12h6"/>'),
    cart:     I('<path d="M4 5h2l2.4 10h9.8L21 8H7"/><circle cx="9.6" cy="19" r="1.4"/><circle cx="16.6" cy="19" r="1.4"/>'),
    contract: I('<path d="M7 3.5h7l5 5V19.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M14 3.5v5h5M9.5 13h5M9.5 16h5"/>'),
    pin:      I('<path d="M12 21s-6.5-5.3-6.5-10a6.5 6.5 0 1 1 13 0C18.5 15.7 12 21 12 21z"/><circle cx="12" cy="11" r="2.5"/>'),
    person:   I('<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>'),
    partner:  I('<circle cx="9" cy="12" r="4.5"/><circle cx="15" cy="12" r="4.5"/>'),
    calendar: I('<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3.5v4M16 3.5v4"/>'),
    scale:    I('<path d="M12 4.5v15M8 19.5h8M12 6.5 6 8m6-1.5L18 8"/><path d="M6 8l-2.5 5a3 3 0 0 0 5 0L6 8zM18 8l-2.5 5a3 3 0 0 0 5 0L18 8z"/>'),
    folder:   I('<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V7z"/>'),
    gear:     I('<circle cx="12" cy="12" r="3"/><path d="M12 3.8v2.4M12 17.8v2.4M3.8 12h2.4M17.8 12h2.4M6.2 6.2l1.7 1.7M16.1 16.1l1.7 1.7M17.8 6.2l-1.7 1.7M7.9 16.1l-1.7 1.7"/>'),
  };

  // ── nav config กลาง (แก้ที่เดียว ใช้ทั้ง home + side menu) ──
  // roles: '*' = ทุกคน · ['owner'|'manager'|'care'|'stock'|'marketing'] · เจ้าของเห็นหมดเสมอ
  // icon: ชื่อคีย์ใน OPS_ICONS (line art SVG) เท่านั้น
  const OPS_NAV = [
    { section: 'งานประจำวัน', items: [
      { href: 'today.html', label: 'งานวันนี้', icon: 'clock', roles: '*' },
    ] },
    { section: 'ดูแลของ', items: [
      { href: 'laundry.html',  label: 'ซัก / QC',     icon: 'wash', roles: ['care','manager'] },
      { href: 'shipout.html',  label: 'เตรียมส่ง',     icon: 'send', roles: ['care','manager'] },
      { href: 'intake.html',   label: 'รับเข้า',       icon: 'plus', roles: ['care','stock','manager'] },
      { href: 'putaway.html',  label: 'เก็บเข้าช่อง',   icon: 'putaway', roles: ['care','stock','manager'] },
      { href: 'repair.html',   label: 'งานซ่อม',       icon: 'repair', roles: ['care','manager'] },
      { href: 'nfc.html',      label: 'แตะ NFC',       icon: 'nfc', roles: ['care','stock','manager'] },
    ] },
    { section: 'สต๊อก', items: [
      { href: 'stock.html',    label: 'สต๊อก',         icon: 'grid', roles: ['care','stock','manager'] },
      { href: 'garment.html',  label: 'ชุด',           icon: 'hanger', roles: ['care','stock','manager'] },
      { href: 'seller.html',   label: 'รับซื้อมือสอง',  icon: 'swap', roles: ['care','manager'] },
      { href: 'acquisitions.html', label: 'จัดการรับซื้อ', icon: 'inbox', roles: ['care','manager'] },
      { href: 'csv.html',      label: 'CSV ชุด (นำเข้า/ส่งออก)', icon: 'updown', roles: ['stock','manager'] },
    ] },
    { section: 'การตลาด', items: [
      { href: 'marketing.html',  label: 'การตลาด',       icon: 'speaker', roles: ['marketing','manager'] },
      { href: 'live.html',       label: 'ไลฟ์',          icon: 'play', roles: ['marketing','manager'] },
      { href: 'influencers.html',label: 'อินฟลูเอนเซอร์', icon: 'star', roles: ['marketing','manager'] },
      { href: 'ugc.html',        label: 'งานถ่าย UGC',   icon: 'camera', roles: ['marketing','manager'] },
      { href: 'ops-looks.html',  label: 'ชุมชน Loop Looks', icon: 'heart', roles: ['marketing','manager'] },
      { href: 'market.html',     label: 'เฝ้าตลาด',      icon: 'eye', roles: ['marketing','manager'] },
      { href: 'requests.html',   label: 'คำขอชุดลูกค้า',  icon: 'search', roles: ['marketing','manager'] },
    ] },
    { section: 'ธุรกิจ', items: [
      { href: 'cockpit.html',    label: 'คอกพิตเจ้าของ', icon: 'gauge', roles: ['owner'] },
      { href: 'analytics.html',  label: 'วิเคราะห์',     icon: 'chart', roles: ['manager','owner'] },
      { href: 'forecast.html',   label: 'ประมาณการ',     icon: 'trend', roles: ['owner'] },
      { href: 'accounting.html', label: 'บัญชี',         icon: 'banknote', roles: ['owner','manager'] },
      { href: 'slips.html',      label: 'สลิปโอน',       icon: 'receipt', roles: ['owner','manager'] },
      { href: 'purchasing.html', label: 'จัดซื้อ',       icon: 'cart', roles: ['owner','manager'] },
      { href: 'contracts.html',  label: 'สัญญา',         icon: 'contract', roles: ['owner','manager'] },
      { href: 'branches.html',   label: 'สาขา / จุดรับ',  icon: 'pin', roles: ['owner','manager'] },
    ] },
    { section: 'เจ้าของ', items: [
      { href: 'hr.html',        label: 'บุคคล (HR)',    icon: 'person', roles: ['owner'] },
      { href: 'ops-partner.html', label: 'พาร์ทเนอร์',    icon: 'partner', roles: ['owner'] },
      { href: 'charity.html',   label: 'กองบุญ / charity', icon: 'heart', roles: ['owner'] },
      { href: 'stylist-bookings.html', label: 'คิวสไตลิสต์', icon: 'calendar', roles: ['owner','manager'] },
      { href: 'disputes.html',  label: 'ทะเบียนคดี',     icon: 'scale', roles: ['owner','manager'] },
      { href: 'case-file.html', label: 'แฟ้มหลักฐาน',    icon: 'folder', roles: ['owner','manager'] },
      { href: 'settings.html',  label: 'ตั้งค่าฮับ',     icon: 'gear', roles: ['owner'] },
    ] },
  ];
  const ROLE_TH = { owner: 'เจ้าของ', manager: 'ผู้จัดการ', care: 'ดูแลของ', stock: 'สต๊อก', marketing: 'การตลาด',
    hr_admin: 'หัวหน้าฝ่ายบุคคล', accounting: 'บัญชี', stylist: 'สไตลิสต์', sales: 'ขาย', admin: 'แอดมิน',
    laundry: 'ซัก / ดูแลชุด', repair: 'ช่างซ่อม', shipping: 'จัดส่ง' };

  // ── default: ตำแหน่งที่ไม่ได้ใส่ใน roles ของแต่ละเมนู เห็นหน้าอะไรบ้าง (owner ปรับได้ที่นี่จุดเดียว) ──
  // นอกจากเมนูที่ตรงกับ role ตรง ๆ แล้ว role เหล่านี้จะเห็นหน้าตาม list ด้านล่างเพิ่มเติม
  const ROLE_PAGES = {
    laundry:    ['laundry.html','shipout.html','intake.html','putaway.html','repair.html','nfc.html','stock.html','garment.html'],
    repair:     ['repair.html','laundry.html','nfc.html','garment.html','stock.html'],
    shipping:   ['shipout.html','nfc.html'],
    accounting: ['accounting.html','slips.html','analytics.html','purchasing.html'],
    hr_admin:   ['hr.html'],
    stylist:    ['stylist-bookings.html'],
    sales:      ['marketing.html','requests.html','market.html','influencers.html','live.html','ugc.html','ops-looks.html','stylist-bookings.html'],
    admin:      ['*'], // แอดมิน = เห็นทุกเมนู (เทียบเท่าผู้จัดการ)
  };

  function canSee(item, role, isOwner) {
    if (isOwner) return true;                 // เจ้าของเห็นหมด
    if (item.roles === '*') return true;
    if (Array.isArray(item.roles) && item.roles.includes(role)) return true;
    const pages = ROLE_PAGES[role];           // default ตามตำแหน่งใหม่
    return !!(pages && (pages.indexOf('*') >= 0 || pages.indexOf(item.href) >= 0));
  }
  function visibleNav(role, isOwner) {
    return OPS_NAV.map((sec) => ({ section: sec.section, items: sec.items.filter((it) => canSee(it, role, isOwner)) }))
                  .filter((sec) => sec.items.length);
  }

  let _me = null;
  async function getMe() {
    if (_me) return _me;
    const { data, error } = await window.opsRpc('ops_me', {});
    if (error || !data) throw new Error((error && error.message) || 'โหลดสิทธิ์ไม่สำเร็จ');
    _me = data;
    return _me;
  }

  const CSS = `
  .opsm-btn{position:fixed;top:12px;left:12px;z-index:60;width:42px;height:42px;border:1px solid var(--line,#E0DED9);background:#fff;border-radius:10px;cursor:pointer;line-height:1;color:var(--ink,#1A1A1A);display:flex;align-items:center;justify-content:center}
  .opsm-btn svg{width:20px;height:20px}
  .opsm-ov{position:fixed;inset:0;background:rgba(0,0,0,.32);z-index:70;opacity:0;visibility:hidden;transition:.18s}
  .opsm-ov.open{opacity:1;visibility:visible}
  .opsm-drawer{position:fixed;top:0;left:0;bottom:0;width:268px;max-width:84vw;background:#fff;z-index:71;transform:translateX(-100%);transition:.2s;overflow-y:auto;box-shadow:2px 0 14px rgba(0,0,0,.12);font-family:var(--sans,'Prompt',sans-serif)}
  .opsm-drawer.open{transform:none}
  .opsm-head{padding:18px 18px 14px;border-bottom:1px solid var(--line,#E0DED9)}
  .opsm-head .nm{font-weight:700;font-size:17px;color:var(--ink,#1A1A1A)}
  .opsm-head .rl{margin-top:4px;font-size:13px;color:#fff;background:var(--ink,#1A1A1A);display:inline-block;padding:2px 10px;border-radius:20px}
  .opsm-sec{padding:12px 0 4px}
  .opsm-sec .t{font-size:12px;color:var(--muted,#86857F);padding:4px 18px;letter-spacing:.04em}
  .opsm-link{display:flex;align-items:center;gap:11px;padding:11px 18px;text-decoration:none;color:var(--ink,#1A1A1A);font-size:15px}
  .opsm-link:hover{background:var(--soft,#F5F4F2)}
  .opsm-link.active{background:var(--soft,#F5F4F2);font-weight:600;box-shadow:inset 3px 0 0 var(--ok,#0F6E56)}
  .opsm-link .ic{width:20px;color:var(--muted,#86857F);display:inline-flex;align-items:center;justify-content:center}
  body.opsm-pad{}`;

  function injectCSS() {
    if (document.getElementById('opsm-css')) return;
    const s = document.createElement('style'); s.id = 'opsm-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function curFile() { const p = location.pathname.split('/').pop(); return p || 'home.html'; }

  async function mount() {
    injectCSS();
    let me;
    try { me = await getMe(); } catch (e) { console.warn('ops-menu:', e.message); return; }
    const role = me.role || (me.is_owner ? 'owner' : '');
    const nav = visibleNav(role, me.is_owner === true);
    const cur = curFile();

    const btn = document.createElement('button'); btn.className = 'opsm-btn'; btn.innerHTML = OPS_ICONS.menu; btn.setAttribute('aria-label', 'เมนู');
    const ov = document.createElement('div'); ov.className = 'opsm-ov';
    const dr = document.createElement('nav'); dr.className = 'opsm-drawer';

    const roleLabel = me.is_owner ? 'เจ้าของ' : (ROLE_TH[role] || 'พนักงาน');
    let html = `<div class="opsm-head"><div class="nm">${me.nickname || me.name || 'พนักงาน'}</div><span class="rl">${roleLabel}</span></div>`;
    html += `<div class="opsm-sec"><a class="opsm-link${cur === 'home.html' ? ' active' : ''}" href="home.html"><span class="ic">${OPS_ICONS.home}</span>หน้าหลัก</a></div>`;
    for (const sec of nav) {
      html += `<div class="opsm-sec"><div class="t">${sec.section}</div>`;
      for (const it of sec.items) {
        html += `<a class="opsm-link${it.href === cur ? ' active' : ''}" href="${it.href}"><span class="ic">${OPS_ICONS[it.icon] || OPS_ICONS.dot}</span>${it.label}</a>`;
      }
      html += `</div>`;
    }
    dr.innerHTML = html;

    document.body.append(btn, ov, dr);
    // เว้นระยะแถบหัวของหน้าให้พ้นปุ่มเมนู (ไม่ทับชื่อหน้า)
    const bar = document.querySelector('.bar');
    if (bar) { const pl = parseInt(getComputedStyle(bar).paddingLeft) || 0; if (pl < 60) bar.style.paddingLeft = '64px'; }
    const open = () => { ov.classList.add('open'); dr.classList.add('open'); };
    const close = () => { ov.classList.remove('open'); dr.classList.remove('open'); };
    btn.addEventListener('click', open); ov.addEventListener('click', close);
  }

  window.OPS_NAV = OPS_NAV;
  window.OPS_ICONS = OPS_ICONS;
  window.opsVisibleNav = visibleNav;
  window.opsRoleTH = ROLE_TH;
  window.opsMe = getMe;
  window.opsMenu = { mount };
})();
