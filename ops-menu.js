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
      { href: 'seller.html',   label: 'รับซื้อมือสอง',  icon: '⇄', roles: ['care','manager'] },
    ] },
    { section: 'การตลาด', items: [
      { href: 'marketing.html',  label: 'การตลาด',       icon: '◆', roles: ['marketing','manager'] },
      { href: 'live.html',       label: 'ไลฟ์',          icon: '▷', roles: ['marketing','manager'] },
      { href: 'influencers.html',label: 'อินฟลูเอนเซอร์', icon: '☆', roles: ['marketing','manager'] },
      { href: 'ugc.html',        label: 'งานถ่าย UGC',   icon: '◰', roles: ['marketing','manager'] },
      { href: 'looks.html',      label: 'ชุมชน Loop Looks', icon: '❤', roles: ['marketing','manager'] },
      { href: 'market.html',     label: 'เฝ้าตลาด',      icon: '◴', roles: ['marketing','manager'] },
    ] },
    { section: 'ธุรกิจ', items: [
      { href: 'analytics.html',  label: 'วิเคราะห์',     icon: '▲', roles: ['manager','owner'] },
      { href: 'accounting.html', label: 'บัญชี',         icon: '฿', roles: ['owner','manager'] },
      { href: 'slips.html',      label: 'สลิปโอน',       icon: '⊞', roles: ['owner','manager'] },
      { href: 'purchasing.html', label: 'จัดซื้อ',       icon: '⛬', roles: ['owner','manager'] },
      { href: 'contracts.html',  label: 'สัญญา',         icon: '§', roles: ['owner','manager'] },
      { href: 'branches.html',   label: 'สาขา / จุดรับ',  icon: '⌂', roles: ['owner','manager'] },
    ] },
    { section: 'เจ้าของ', items: [
      { href: 'hr.html',        label: 'บุคคล (HR)',    icon: '☗', roles: ['owner'] },
      { href: 'partner.html',   label: 'พาร์ทเนอร์',     icon: '⚭', roles: ['owner'] },
      { href: 'disputes.html',  label: 'ทะเบียนคดี',     icon: '⚖', roles: ['owner','manager'] },
      { href: 'case-file.html', label: 'แฟ้มหลักฐาน',    icon: '☰', roles: ['owner','manager'] },
      { href: 'settings.html',  label: 'ตั้งค่าฮับ',     icon: '⚙', roles: ['owner'] },
    ] },
  ];
  const ROLE_TH = { owner: 'เจ้าของ', manager: 'ผู้จัดการ', care: 'ดูแลของ', stock: 'สต๊อก', marketing: 'การตลาด' };

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
  .opsm-btn{position:fixed;top:12px;left:12px;z-index:60;width:42px;height:42px;border:1px solid var(--line,#E0DED9);background:#fff;border-radius:10px;cursor:pointer;font-size:20px;line-height:1;color:var(--ink,#1A1A1A)}
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
  .opsm-link .ic{width:20px;text-align:center;color:var(--muted,#86857F);font-size:15px}
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
    // เว้นระยะแถบหัวของหน้าให้พ้นปุ่ม ☰ (ไม่ทับชื่อหน้า)
    const bar = document.querySelector('.bar');
    if (bar) { const pl = parseInt(getComputedStyle(bar).paddingLeft) || 0; if (pl < 60) bar.style.paddingLeft = '64px'; }
    const open = () => { ov.classList.add('open'); dr.classList.add('open'); };
    const close = () => { ov.classList.remove('open'); dr.classList.remove('open'); };
    btn.addEventListener('click', open); ov.addEventListener('click', close);
  }

  window.OPS_NAV = OPS_NAV;
  window.opsVisibleNav = visibleNav;
  window.opsRoleTH = ROLE_TH;
  window.opsMe = getMe;
  window.opsMenu = { mount };
})();
