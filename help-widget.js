// ===== help-widget.js — ปุ่ม "?" ช่วยเหลือลูกค้า (2nd Brain หน้าบ้าน) =====
// ใส่ <script src="help-widget.js"></script> ก่อน </body> ของหน้า liff ที่ต้องการ
// - อ่านคู่มือของ "หน้านี้" จาก RPC help_public (anon, สาธารณะ — ใช้ได้แม้ไม่ login)
// - ถ้าหน้านี้มีคู่มือที่เผยแพร่แล้ว → โชว์ปุ่ม "?" ลอยมุมล่างขวา กดแล้วเด้ง bottom-sheet
// - ถ้าไม่มี → เงียบ ไม่โผล่อะไร (dark launch: หัวหน้ายังไม่เขียน = ลูกค้าไม่เห็น)
// เนื้อหา/รูปหัวหน้าแก้เองได้จากหน้า ops/sop-admin.html (โหมด "ลูกค้า")
(function () {
  var CONF = window.CONFIG || {};
  var BASE = CONF.SUPABASE_URL, ANON = CONF.SUPABASE_ANON_KEY;
  if (!BASE || !ANON) return;                       // ยังไม่ตั้ง config — เงียบ
  var PAGE = (location.pathname.split('/').pop() || 'index.html').toLowerCase() || 'index.html';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var imgUrl = function (p) {
    return /^(https?:|data:)/.test(p) ? p : BASE + '/storage/v1/object/public/help-media/' + p;
  };

  function rpc(fn, body) {
    return fetch(BASE + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON, 'Authorization': 'Bearer ' + ANON },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  var CSS = ''
    + '.lhw-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0));z-index:2147483000;'
    + 'width:46px;height:46px;border-radius:50%;background:#1C1B19;color:#fff;border:none;cursor:pointer;'
    + 'font-family:"Prompt",system-ui,sans-serif;font-size:20px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.28);'
    + 'display:flex;align-items:center;justify-content:center}'
    + '.lhw-fab span{margin-left:1px}'
    + '.lhw-scrim{position:fixed;inset:0;background:rgba(20,18,15,.5);opacity:0;pointer-events:none;transition:.2s;z-index:2147483001}'
    + '.lhw-scrim.on{opacity:1;pointer-events:auto}'
    + '.lhw-sheet{position:fixed;left:50%;bottom:0;transform:translateX(-50%) translateY(100%);width:100%;max-width:460px;'
    + 'background:#fff;color:#1C1B19;border-radius:24px 24px 0 0;max-height:88vh;overflow:auto;z-index:2147483002;'
    + 'font-family:"Prompt",system-ui,sans-serif;transition:transform .24s cubic-bezier(.2,.8,.2,1);box-shadow:0 -10px 40px rgba(0,0,0,.25)}'
    + '.lhw-sheet.on{transform:translateX(-50%) translateY(0)}'
    + '.lhw-grip{width:40px;height:4px;border-radius:4px;background:#E0DAD0;margin:10px auto 4px}'
    + '.lhw-head{display:flex;align-items:center;gap:12px;padding:6px 20px 12px;position:sticky;top:0;background:#fff;border-bottom:1px solid #EEE9E1}'
    + '.lhw-head .t{font-weight:600;font-size:16px;line-height:1.25}.lhw-head .t small{display:block;font-size:11.5px;color:#8a8175;font-weight:400}'
    + '.lhw-x{margin-left:auto;width:30px;height:30px;border-radius:50%;background:#F3F0EA;color:#6E6A63;border:none;font-size:16px;cursor:pointer;flex:0 0 auto}'
    + '.lhw-body{padding:16px 20px 30px}'
    + '.lhw-what{font-size:13.5px;color:#6E6A63;line-height:1.65;margin-bottom:18px}'
    + '.lhw-step{margin-bottom:20px}'
    + '.lhw-cap{display:flex;gap:10px;align-items:center;margin-bottom:10px}'
    + '.lhw-n{width:22px;height:22px;border-radius:50%;background:#B05C38;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex:0 0 auto}'
    + '.lhw-tx{font-size:14px;font-weight:500}'
    + '.lhw-shot{border-radius:14px;overflow:hidden;border:1px solid #EAE4DA}.lhw-shot img{display:block;width:100%;height:auto}'
    + '.lhw-empty{color:#8a8175;text-align:center;padding:26px 10px;font-size:13.5px;line-height:1.7}';

  var scrim, sheet, article = null, built = false;

  function build() {
    if (built) return; built = true;
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    scrim = document.createElement('div'); scrim.className = 'lhw-scrim';
    sheet = document.createElement('div'); sheet.className = 'lhw-sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML = '<div class="lhw-grip"></div>'
      + '<div class="lhw-head"><div class="t" id="lhw-title">วิธีใช้<small>LLOOP · ช่วยเหลือ</small></div>'
      + '<button class="lhw-x" aria-label="ปิด">&times;</button></div><div class="lhw-body" id="lhw-body"></div>';
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    scrim.addEventListener('click', close);
    sheet.querySelector('.lhw-x').addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }
  function open() {
    build();
    var a = article || {};
    sheet.querySelector('#lhw-title').innerHTML = esc(a.title || 'วิธีใช้') + '<small>LLOOP · ช่วยเหลือ</small>';
    var steps = Array.isArray(a.steps) ? a.steps : [];
    var html = '';
    if (a.summary) html += '<div class="lhw-what">' + esc(a.summary) + '</div>';
    if (!steps.length && !a.summary) html += '<div class="lhw-empty">ยังไม่มีรายละเอียด</div>';
    steps.forEach(function (s, i) {
      html += '<div class="lhw-step"><div class="lhw-cap"><span class="lhw-n">' + (s.n || i + 1) + '</span>'
        + '<span class="lhw-tx">' + esc(s.text || '') + '</span></div>';
      if (s.image_path) html += '<div class="lhw-shot"><img loading="lazy" alt="" src="' + esc(imgUrl(s.image_path)) + '"></div>';
      html += '</div>';
    });
    sheet.querySelector('#lhw-body').innerHTML = html;
    scrim.classList.add('on'); sheet.classList.add('on'); document.body.style.overflow = 'hidden';
  }
  function close() { if (!built) return; scrim.classList.remove('on'); sheet.classList.remove('on'); document.body.style.overflow = ''; }

  function showFab() {
    var b = document.createElement('button'); b.className = 'lhw-fab'; b.type = 'button';
    b.setAttribute('aria-label', 'วิธีใช้หน้านี้'); b.innerHTML = '<span>?</span>';
    b.addEventListener('click', open); document.body.appendChild(b);
  }

  function init() {
    rpc('help_public', { p_page: PAGE }).then(function (a) {
      if (a && typeof a === 'object' && !Array.isArray(a)) { article = a; showFab(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
