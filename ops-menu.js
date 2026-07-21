// ===== ops-menu — side menu + nav config ที่กรองตามตำแหน่งพนักงาน =====
// ใช้: ใส่ <script src="ops-api.js"></script><script src="ops-menu.js"></script>
//      แล้วเรียก  await window.opsMenu.mount();   (หลัง opsLogin ผ่าน opsRpc ครั้งแรกเอง)
// เปิดเผย: window.OPS_NAV (config), window.opsVisibleNav(role,isOwner), window.opsMenu.mount()
(function () {
  // ── nav config กลาง (แก้ที่เดียว ใช้ทั้ง home + side menu) ──
  // roles: '*' = ทุกคน · ['owner'|'manager'|'care'|'stock'|'marketing'] · เจ้าของเห็นหมดเสมอ
  const OPS_NAV = [
    { section: 'งานประจำวัน', items: [
      { href: 'today.html', label: 'งานวันนี้', icon: '◷', roles: '*' },
    ] },
    { section: 'ดูแลของ', items: [
      { href: 'laundry.html',  label: 'ซัก / QC',     icon: '⬡', roles: ['care','manager'] },
      { href: 'shipout.html',  label: 'เตรียมส่ง',     icon: '➜', roles: ['care','manager'] },
      { href: 'intake.html',   label: 'รับเข้า',       icon: '＋', roles: ['care','stock','manager'] },
      { href: 'putaway.html',  label: 'เก็บเข้าช่อง',   icon: '▤', roles: ['care','stock','manager'] },
      { href: 'repair.html',   label: 'งานซ่อม',       icon: '✚', roles: ['care','manager'] },
      { href: 'nfc.html',      label: 'แตะ NFC',       icon: '◎', roles: ['care','stock','manager'] },
    ] },
    { section: 'สต๊อก', items: [
      { href: 'stock.html',    label: 'สต๊อก',         icon: '▦', roles: ['care','stock','manager'] },
      { href: 'garment.html',  label: 'ชุด',           icon: '❖', roles: ['care','stock','manager'] },
      { href: 'garment-colors.html', label: 'แก้สีชุด', icon: '◐', roles: ['stock','manager'] },
      { href: 'seller.html',   label: 'รับซื้อมือสอง',  icon: '⇄', roles: ['care','manager'] },
      { href: 'acquisitions.html', label: 'จัดการรับซื้อ', icon: '⇩', roles: ['stock','manager'] },
    ] },
    { section: 'การตลาด', items: [
      { href: 'marketing.html',  label: 'การตลาด',       icon: '◆', roles: ['marketing','manager'] },
      { href: 'storyboard.html', label: 'Storyboard Studio', icon: '✦', roles: ['marketing','manager'] },
      { href: 'video.html',      label: 'Video Studio',      icon: '▶', roles: ['marketing','manager'] },
      { href: 'live.html',       label: 'ไลฟ์',          icon: '▷', roles: ['marketing','manager'] },
      { href: 'influencers.html',label: 'อินฟลูเอนเซอร์', icon: '☆', roles: ['marketing','manager'] },
      { href: 'ugc.html',        label: 'งานถ่าย UGC',   icon: '◰', roles: ['marketing','manager'] },
      { href: 'ops-looks.html',  label: 'ชุมชน Loop Looks', icon: '❤', roles: ['marketing','manager'] },
      { href: 'market.html',     label: 'เฝ้าตลาด',      icon: '◴', roles: ['marketing','manager'] },
      { href: 'requests.html',   label: 'คำขอชุดลูกค้า',  icon: '⌕', roles: ['marketing','manager'] },
    ] },
    { section: 'ธุรกิจ', items: [
      { href: 'cockpit.html',    label: 'คอกพิตเจ้าของ', icon: '◉', roles: ['owner','manager'] },
      { href: 'analytics.html',  label: 'วิเคราะห์',     icon: '▲', roles: ['manager','owner'] },
      { href: 'forecast.html',   label: 'ประมาณการ',    icon: '∿', roles: ['owner','manager'] },
      { href: 'accounting.html', label: 'บัญชี',         icon: '฿', roles: ['owner','manager'] },
      { href: 'slips.html',      label: 'สลิปโอน',       icon: '⊞', roles: ['owner','manager'] },
      { href: 'purchasing.html', label: 'จัดซื้อ',       icon: '⛬', roles: ['owner','manager'] },
      { href: 'contracts.html',  label: 'สัญญา',         icon: '§', roles: ['owner','manager'] },
      { href: 'branches.html',   label: 'สาขา / จุดรับ',  icon: '⌂', roles: ['owner','manager'] },
    ] },
    { section: 'เจ้าของ', items: [
      { href: 'hr.html',        label: 'บุคคล (HR)',    icon: '☗', roles: ['owner','hr_admin'] },
      { href: 'ops-partner.html', label: 'พาร์ทเนอร์',    icon: '⚭', roles: ['owner'] },
      { href: 'stylist-bookings.html', label: 'คิวสไตลิสต์', icon: '◷', roles: ['owner','manager'] },
      { href: 'disputes.html',  label: 'ทะเบียนคดี',     icon: '⚖', roles: ['owner','manager'] },
      { href: 'case-file.html', label: 'แฟ้มหลักฐาน',    icon: '☰', roles: ['owner','manager'] },
      { href: 'feedback.html',  label: 'Feedback ทีม',   icon: '✎', roles: ['owner'] },
      { href: 'settings.html',  label: 'ตั้งค่าฮับ',     icon: '⚙', roles: ['owner'] },
    ] },
  ];
  const ROLE_TH = { owner: 'เจ้าของ', manager: 'ผู้จัดการ', care: 'ดูแลของ', stock: 'สต๊อก', marketing: 'การตลาด', hr_admin: 'ฝ่ายบุคคล' };

  function canSee(item, role, isOwner) {
    if (isOwner) return true;                 // เจ้าของเห็นหมด
    if (item.roles === '*') return true;
    return Array.isArray(item.roles) && item.roles.includes(role);
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
  .opsm-btn{position:fixed;top:12px;left:12px;z-index:60;width:40px;height:40px;border:1px solid var(--line,#E0DED9);background:#fff;border-radius:10px;cursor:pointer;font-size:18px;line-height:1;color:var(--ink,#1A1A1A)}
  .opsm-ov{position:fixed;inset:0;background:rgba(0,0,0,.32);z-index:70;opacity:0;visibility:hidden;transition:.18s}
  .opsm-ov.open{opacity:1;visibility:visible}
  .opsm-drawer{position:fixed;top:0;left:0;bottom:0;width:232px;max-width:84vw;background:#fff;z-index:71;transform:translateX(-100%);transition:.2s;overflow-y:auto;box-shadow:2px 0 14px rgba(0,0,0,.12);font-family:'Prompt',var(--sans,sans-serif)}
  .opsm-drawer.open{transform:none}
  .opsm-head{padding:15px 16px 12px;border-bottom:1px solid var(--line,#E0DED9)}
  .opsm-head .nm{font-weight:700;font-size:14.5px;color:var(--ink,#1A1A1A)}
  .opsm-head .rl{margin-top:4px;font-size:11.5px;color:#fff;background:var(--ink,#1A1A1A);display:inline-block;padding:2px 10px;border-radius:20px}
  .opsm-sec{padding:9px 0 3px}
  .opsm-sec .t{font-size:10.5px;color:var(--muted,#86857F);padding:3px 16px;letter-spacing:.06em;text-transform:uppercase}
  .opsm-link{display:flex;align-items:center;gap:10px;padding:8px 16px;text-decoration:none;color:var(--ink,#1A1A1A);font-size:13px}
  .opsm-link:hover{background:var(--soft,#F5F4F2)}
  .opsm-link.active{background:var(--soft,#F5F4F2);font-weight:600;box-shadow:inset 3px 0 0 var(--ok,#0F6E56)}
  .opsm-link .ic{width:18px;text-align:center;color:var(--muted,#86857F);font-size:13px}
  /* ── จอใหญ่: เมนูตรึงซ้ายถาวรแบบ desktop app (ไม่ต้องกด ☰) ── */
  @media(min-width:1100px){
    .opsm-btn,.opsm-ov{display:none}
    .opsm-drawer{transform:none;box-shadow:none;border-right:1px solid var(--line,#E7E5E1)}
    body.opsm-docked{padding-left:232px}
  }
  @media print{.opsm-btn,.opsm-ov,.opsm-drawer{display:none!important}body.opsm-docked{padding-left:0}}
  body.opsm-pad{}`;

  function injectCSS() {
    if (document.getElementById('opsm-css')) return;
    const s = document.createElement('style'); s.id = 'opsm-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function curFile() { const p = location.pathname.split('/').pop(); return p || 'home.html'; }

  // หน้า ops เป็นไฟล์ static (ใครเปิด URL ก็เห็น HTML) — การกระทำถูกกันที่ gateway อยู่แล้ว
  // แต่ถ้าเช็คสิทธิ์แล้ว "ไม่ใช่พนักงาน" → บังหน้าเต็มจอ กันเห็นฟอร์มหลังบ้าน + ชี้ทางไปสมัครงาน
  // (ขึ้นเฉพาะตอน denied จริง — ถ้า getMe สำเร็จจะไม่มีอะไรบัง พนักงานจริงไม่มีทางโดนล็อก)
  function showGate(msg) {
    if (document.getElementById('opsGate')) return;
    msg = msg || '';
    var denied = /ไม่มีสิทธิ์|no_access|owner_only|role_denied|ไม่อนุญาต|not_allowed/i.test(msg);
    var soft   = /redirect|เข้าสู่ระบบใหม่|กำลังพา|idToken|เซสชันหมดอายุ/i.test(msg);
    var title = denied ? 'หน้านี้สำหรับพนักงาน LLOOP เท่านั้น'
              : soft   ? 'กำลังเข้าสู่ระบบ…'
              :          'ตรวจสอบสิทธิ์ไม่สำเร็จ';
    var body  = denied ? 'บัญชี LINE นี้ยังไม่ได้เป็นพนักงาน หรือยังไม่ได้รับอนุมัติให้ใช้งานหลังบ้าน'
              : soft   ? 'กำลังพาไปเข้าสู่ระบบด้วย LINE…'
              :          'ลองเข้าสู่ระบบใหม่อีกครั้ง หรือรีเฟรชหน้า';
    var g = document.createElement('div');
    g.id = 'opsGate';
    g.setAttribute('style', 'position:fixed;inset:0;z-index:9999;background:#F2F1EE;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Prompt,system-ui,sans-serif');
    g.innerHTML =
      '<div style="max-width:360px;width:100%;background:#fff;border:1px solid #E0DED9;border-radius:14px;padding:28px 24px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08)">' +
        '<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:20px;letter-spacing:.02em;color:#1A1A1A">LLOOP</div>' +
        '<div style="font-weight:600;margin-top:14px;font-size:15.5px;color:#1A1A1A">' + title + '</div>' +
        '<div style="color:#86857F;font-size:13px;margin-top:8px;line-height:1.6">' + body + '</div>' +
        '<div style="margin-top:20px;display:flex;flex-direction:column;gap:9px">' +
          '<button id="opsGateLogin" style="background:#1A1A1A;color:#fff;border:0;padding:12px;border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer">เข้าสู่ระบบด้วย LINE</button>' +
          (denied ? '<a href="apply.html" style="color:#0F6E56;font-size:13px;text-decoration:none;padding:8px">ยังไม่ได้เป็นพนักงาน? สมัครงาน</a>' : '') +
        '</div>' +
      '</div>';
    document.body.appendChild(g);
    var lb = document.getElementById('opsGateLogin');
    if (lb) lb.onclick = function () {
      try { sessionStorage.removeItem('opsLoginTried'); sessionStorage.removeItem('opsReauth'); } catch (_) {}
      try { if (window.liff && liff.logout) liff.logout(); } catch (_) {}
      try {
        if (window.liff && liff.login) liff.login({ redirectUri: location.href });
        else location.reload();
      } catch (_) { location.reload(); }
    };
  }

  async function mount() {
    injectCSS();
    let me;
    try { me = await getMe(); } catch (e) { showGate(e && e.message); return; }
    const role = me.role || (me.is_owner ? 'owner' : '');
    const nav = visibleNav(role, me.is_owner === true);
    const cur = curFile();

    const btn = document.createElement('button'); btn.className = 'opsm-btn'; btn.innerHTML = '☰'; btn.setAttribute('aria-label', 'เมนู');
    const ov = document.createElement('div'); ov.className = 'opsm-ov';
    const dr = document.createElement('nav'); dr.className = 'opsm-drawer';

    const roleLabel = me.is_owner ? 'เจ้าของ' : (ROLE_TH[role] || 'พนักงาน');
    let html = `<div class="opsm-head"><div class="nm">${me.nickname || me.name || 'พนักงาน'}</div><span class="rl">${roleLabel}</span></div>`;
    html += `<div class="opsm-sec"><a class="opsm-link${cur === 'home.html' ? ' active' : ''}" href="home.html"><span class="ic">⌗</span>หน้าหลัก</a></div>`;
    for (const sec of nav) {
      html += `<div class="opsm-sec"><div class="t">${sec.section}</div>`;
      for (const it of sec.items) {
        html += `<a class="opsm-link${it.href === cur ? ' active' : ''}" href="${it.href}"><span class="ic">${it.icon || '•'}</span>${it.label}</a>`;
      }
      html += `</div>`;
    }
    dr.innerHTML = html;

    document.body.append(btn, ov, dr);
    // จอใหญ่ = ตรึงเมนูถาวร (คลาสนี้ดัน padding-left ของ body) · จอเล็ก = เว้นแถบหัวให้พ้นปุ่ม ☰
    const bar = document.querySelector('.bar');
    const basePad = bar ? getComputedStyle(bar).paddingLeft : '';
    const mq = window.matchMedia('(min-width:1100px)');
    const applyMode = () => {
      document.body.classList.toggle('opsm-docked', mq.matches);
      if (bar) bar.style.paddingLeft = mq.matches ? basePad : ((parseInt(basePad) || 0) < 60 ? '64px' : basePad);
    };
    applyMode();
    if (mq.addEventListener) mq.addEventListener('change', applyMode);
    const open = () => { ov.classList.add('open'); dr.classList.add('open'); };
    const close = () => { ov.classList.remove('open'); dr.classList.remove('open'); };
    btn.addEventListener('click', open); ov.addEventListener('click', close);

    // ── ปุ่มลอย "ส่ง feedback ระบบ" — โผล่ทุกหน้า ops (โหลด ops-feedback.js ครั้งเดียว) ──
    mountFeedback();
  }

  function mountFeedback() {
    if (window.__opsFeedbackLoaded) { if (window.opsFeedback) window.opsFeedback.mount(); return; }
    window.__opsFeedbackLoaded = true;
    if (window.opsFeedback) { window.opsFeedback.mount(); return; }
    const s = document.createElement('script');
    s.src = 'ops-feedback.js';
    s.onload = () => { if (window.opsFeedback) window.opsFeedback.mount(); };
    document.head.appendChild(s);
  }

  window.OPS_NAV = OPS_NAV;
  window.opsVisibleNav = visibleNav;
  window.opsRoleTH = ROLE_TH;
  window.opsMe = getMe;
  window.opsMenu = { mount };
})();
