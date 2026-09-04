// ===== ops-help.js — ปุ่ม "?" ในทุกหน้าหลังบ้าน =====
// ใส่ <script src="ops-help.js?v=1"></script> ก่อน </body> (ต้องมี ops-api.js โหลดก่อน)
//
// ทำไมต้องมี: คู่มือ (sop_articles) เขียนไว้ 36 บทแล้ว แต่ปุ่มเรียกดูอยู่แค่หน้า home
// พนักงานที่กำลังยืนทำงานอยู่หน้าใดหน้าหนึ่ง จึงเปิดคู่มือไม่ได้ ต้องถอยกลับหน้าแรกก่อน
//
// แผงนี้แบ่ง 2 ส่วนตามหลักที่เจ้าของวางไว้ (ระบบทำเอง คนแค่ตรวจ):
//   1) "ระบบทำให้เองแล้ว"  — งานอัตโนมัติที่วิ่งอยู่จริงของหน้านี้ (อ่านจาก AUTO ด้านล่าง)
//   2) "สิ่งที่คุณต้องทำ"   — ขั้นตอนจากคู่มือใน sop_articles (หัวหน้าแก้เองได้ที่ sop-admin)
(function () {
  'use strict';
  var PAGE = (location.pathname.split('/').pop() || '').toLowerCase();
  if (!PAGE || PAGE === 'home.html') return;          // home มีปุ่ม ? บนไอคอนอยู่แล้ว

  // ── งานอัตโนมัติที่วิ่งจริงบน Supabase (pg_cron) แยกตามหน้า ──
  // ตรวจกับ cron.job จริงเมื่อ 4 ก.ย. 2026 · แก้ที่นี่เมื่อเพิ่ม/ลด cron
  var AUTO = {
    'today.html': [['ปล่อยชุดที่จองค้างคืนสู่คลัง', 'ทุก 10 นาที'], ['เตือนลูกค้าใกล้ครบกำหนดคืน', 'ทุกวัน 09:00']],
    'laundry.html': [['เตือนงานซัก/QC ที่ค้างเกินกำหนด', 'ทุกวัน 11:00']],
    'repair.html': [['เตือนงานซ่อมที่ค้างเกินกำหนด', 'ทุกวัน 11:00']],
    'shipout.html': [['ดึงสถานะพัสดุจากขนส่งมาอัปเดตให้', 'ทุก 30 นาที'], ['เตือนลูกค้าใกล้ครบกำหนดคืน', 'ทุกวัน 09:00']],
    'intake.html': [['ดันชุดที่พร้อมขายขึ้นหน้าเว็บ', 'ทุก 3 นาที'], ['แจ้งลูกค้าว่ามีชุดใหม่เข้า', 'ทุกชั่วโมง 10:00-20:00']],
    'putaway.html': [['ตรวจชุดที่ยังไม่ถูกเก็บเข้าช่อง', 'ทุกวัน 08:00']],
    'stock.html': [['ตรวจสต๊อกและแจ้งของขาด', 'ทุกวัน 08:00'], ['สรุปชุดที่ควรซื้อเพิ่ม', 'ทุกวันจันทร์ 08:00']],
    'nfc.html': [['บันทึกทุกการแตะแท็กเข้าประวัติชุดอัตโนมัติ', 'ทันทีที่แตะ']],
    'acquisitions.html': [['เตือนข้อเสนอรับซื้อที่ใกล้หมดอายุ', 'ทุกวัน 11:10'], ['ส่งการ์ดแจ้งผู้ขายทาง LINE', 'ทุก 5 นาที']],
    'seller.html': [['ตอบผู้ขายใน LINE OA อัตโนมัติ', 'ทันทีที่ทัก']],
    'marketing.html': [['ส่งข้อมูลการซื้อเข้า Meta CAPI', 'ทุก 2 นาที'], ['อัปเดตกลุ่มเป้าหมาย Meta', 'ทุกวัน 10:00'], ['โพสต์ข้าม IG', 'ทุก 10 นาที'], ['เลือกเวลาส่งที่ลูกค้าเปิดอ่านมากสุด', 'ทุก 10 นาที']],
    'market.html': [['สแกนราคาและของใหม่ในตลาด', 'ทุกวันจันทร์ 09:00']],
    'ops-looks.html': [['คัดลุคแห่งสัปดาห์', 'ทุกวันจันทร์ 09:00'], ['จ่ายเครดิตให้ลุคที่ผ่านเกณฑ์', 'ทุก 15 นาที']],
    'video.html': [['เช็คงานเรนเดอร์วิดีโอที่ส่งไป', 'ทุกนาที']],
    'requests.html': [['ปล่อยคิวชุดที่ว่างให้คนรอ', 'ทุก 15 นาที']],
    'stylist-bookings.html': [['เตือนลูกค้าก่อนถึงนัด Personal Color', 'ทุกวัน 18:00']],
    'contracts.html': [['เตือนสัญญาที่ใกล้ครบกำหนด', 'ทุกวัน 10:00']],
    'disputes.html': [['เปิดเคสข้อพิพาทจากชุดที่คืนช้า/เสียหาย', 'ทุกวัน 10:15']],
    'accounting.html': [['ตัดค่าเสื่อมชุด', 'ทุกวันที่ 1'], ['สรุปปิดเดือน', 'ทุกวันที่ 1'], ['รับรู้รายได้แพ็กเกจ', 'ทุกวันที่ 1'], ['เตือนยื่นภาษี', 'ทุกวันที่ 5'], ['เตือนเมื่อรายได้ใกล้เกณฑ์จด VAT', 'ทุกวันที่ 2']],
    'forecast.html': [['บันทึกภาพรวมกำไรขาดทุนรายวัน', 'ทุกวัน 12:00']],
    'cockpit.html': [['บันทึกภาพรวมกำไรขาดทุนรายวัน', 'ทุกวัน 12:00'], ['คำนวณระดับลูกค้าใหม่', 'ทุกวัน 13:00']],
    'analytics.html': [['เก็บพฤติกรรมลูกค้าทุกคลิกบนหน้าเว็บ', 'ตลอดเวลา']],
    'flow.html': [['เก็บพฤติกรรมลูกค้าทุกคลิกบนหน้าเว็บ', 'ตลอดเวลา']],
    'hr.html': [['สรุปงาน HR ประจำวัน', 'ทุกวัน 08:30'], ['ตรวจความถูกต้องข้อมูลพนักงาน', 'ทุกวัน 08:30'], ['ปิดรอบเงินเดือน', 'ทุกวันที่ 1'], ['รีเซ็ตวันลาประจำปี', 'ทุก 1 ม.ค.'], ['จัดตารางกะสัปดาห์ถัดไป', 'ทุกวันอาทิตย์ 17:00']],
    'purchasing.html': [['สรุปชุดที่ควรซื้อเพิ่ม', 'ทุกวันจันทร์ 08:00']],
    'ugc.html': [['ตรวจรูปงานถ่ายด้วย AI ก่อนถึงมือคุณ', 'ทันทีที่ส่งรูป']],
    'settings.html': [['สวิตช์ทุกตัวมีผลทันทีทั้งระบบ ไม่ต้อง deploy', 'ทันที']]
  };
  // งานที่วิ่งให้ทุกหน้า (ไม่ต้องทำอะไร) — โชว์ท้ายรายการ
  var GLOBAL = [
    ['ส่งข้อความ LINE ที่รอในคิว', 'ทุก 5 นาที'],
    ['เก็บค่าปรับคืนช้า', 'ทุกวัน 10:00'],
    ['ต่ออายุแพ็กเกจสมาชิก', 'ทุกวัน 08:30'],
    ['ตามลูกค้าที่ทิ้งตะกร้า', 'ทุก 30 นาที'],
    ['ดึงลูกค้าเก่ากลับมา', 'ทุกวัน 15:00']
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function injectCss() {
    if (document.getElementById('ops-help-css')) return;
    var st = document.createElement('style'); st.id = 'ops-help-css';
    st.textContent = [
      '.ohbtn{position:fixed;right:16px;bottom:16px;z-index:70;width:46px;height:46px;border-radius:50%;',
      '  background:#2B2825;color:#fff;border:none;font-size:19px;font-weight:700;cursor:pointer;',
      '  box-shadow:0 4px 16px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;font-family:inherit}',
      '.ohbtn:hover{transform:translateY(-1px)}',
      '.ohsc{position:fixed;inset:0;background:rgba(20,19,15,.44);z-index:71;opacity:0;pointer-events:none;transition:.22s}',
      '.ohsc.on{opacity:1;pointer-events:auto}',
      '.ohsh{position:fixed;left:50%;bottom:0;transform:translate(-50%,102%);width:min(560px,100%);max-height:86vh;',
      '  background:#fff;border-radius:18px 18px 0 0;z-index:72;transition:transform .26s cubic-bezier(.4,0,.2,1);',
      '  display:flex;flex-direction:column;font-family:inherit}',
      '.ohsh.on{transform:translate(-50%,0)}',
      '.ohhd{display:flex;align-items:center;gap:11px;padding:16px 18px;border-bottom:1px solid #E7E5E1;flex:0 0 auto}',
      '.ohhd .t{flex:1;font-size:16px;font-weight:700;color:#2B2825;line-height:1.3}',
      '.ohhd .t small{display:block;font-size:11.5px;font-weight:500;color:#86857F;margin-top:2px}',
      '.ohhd .x{background:none;border:none;font-size:24px;line-height:1;color:#86857F;cursor:pointer;padding:2px 6px}',
      '.ohbd{overflow-y:auto;padding:16px 18px 26px}',
      '.ohsec{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;margin:6px 0 10px}',
      '.ohsec.auto{color:#0F6E56}.ohsec.you{color:#A75F3A;margin-top:22px}',
      '.ohauto{background:#E9F3EE;border:1px solid #CFE6DA;border-radius:12px;padding:12px 14px}',
      '.ohauto .r{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.6;color:#14503F;padding:5px 0}',
      '.ohauto .r+.r{border-top:1px dashed #CFE6DA}',
      '.ohauto .r svg{width:15px;height:15px;flex:0 0 15px;margin-top:3px;stroke:#0F6E56;fill:none;stroke-width:2.2}',
      '.ohauto .r b{font-weight:600}',
      '.ohauto .r .w{margin-left:auto;flex:0 0 auto;font-size:11px;color:#4C7F6D;white-space:nowrap;padding-left:8px}',
      '.ohnote{font-size:12px;color:#86857F;line-height:1.65;margin-top:9px}',
      '.ohstep{display:flex;gap:11px;align-items:flex-start;padding:9px 0;font-size:13.5px;line-height:1.65;color:#3B362C}',
      '.ohstep+.ohstep{border-top:1px solid #F0EEE9}',
      '.ohstep .n{flex:0 0 22px;height:22px;border-radius:50%;background:#F5F2EC;color:#A75F3A;font-size:11.5px;',
      '  font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px}',
      '.ohshot{margin:8px 0 2px 33px;border:1px solid #E7E5E1;border-radius:9px;overflow:hidden}',
      '.ohshot img{width:100%;display:block}',
      '.ohempty{color:#86857F;font-size:13px;line-height:1.7;padding:8px 0}',
      '.ohmore{display:inline-block;margin-top:16px;font-size:12.5px;color:#86857F;text-decoration:none;border-bottom:1px solid #E7E5E1}',
      '@media(prefers-reduced-motion:reduce){.ohsh,.ohsc{transition:none}}'
    ].join('');
    document.head.appendChild(st);
  }

  var CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  var sheet, scrim, loaded = false;

  function build() {
    injectCss();
    scrim = document.createElement('div'); scrim.className = 'ohsc';
    sheet = document.createElement('div'); sheet.className = 'ohsh';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'วิธีใช้หน้านี้');
    sheet.innerHTML = '<div class="ohhd"><div class="t" id="ohT">วิธีใช้หน้านี้<small>ระบบทำอะไรเอง และคุณต้องตรวจอะไร</small></div>'
      + '<button class="x" type="button" aria-label="ปิด">&times;</button></div>'
      + '<div class="ohbd" id="ohB"><div class="ohempty">กำลังโหลด…</div></div>';
    document.body.appendChild(scrim); document.body.appendChild(sheet);
    scrim.addEventListener('click', close);
    sheet.querySelector('.x').addEventListener('click', close);
  }
  function open() {
    if (!sheet) build();
    scrim.classList.add('on'); sheet.classList.add('on');
    document.body.style.overflow = 'hidden';
    if (!loaded) { loaded = true; load(); }
  }
  function close() {
    if (!sheet) return;
    scrim.classList.remove('on'); sheet.classList.remove('on');
    document.body.style.overflow = '';
  }

  function autoHtml() {
    var rows = (AUTO[PAGE] || []).concat(GLOBAL.map(function (g) { return g; }));
    var mine = AUTO[PAGE] || [];
    var h = '<div class="ohsec auto">ระบบทำให้เองแล้ว</div><div class="ohauto">';
    if (!mine.length) {
      h += '<div class="r">' + CHECK + '<span>หน้านี้ไม่มีงานอัตโนมัติเฉพาะของตัวเอง แต่ได้งานส่วนกลางด้านล่างเหมือนทุกหน้า</span></div>';
    }
    mine.forEach(function (r) {
      h += '<div class="r">' + CHECK + '<span><b>' + esc(r[0]) + '</b></span><span class="w">' + esc(r[1]) + '</span></div>';
    });
    GLOBAL.forEach(function (r) {
      h += '<div class="r">' + CHECK + '<span>' + esc(r[0]) + '</span><span class="w">' + esc(r[1]) + '</span></div>';
    });
    h += '</div><div class="ohnote">รายการข้างบนวิ่งเองบนเซิร์ฟเวอร์ ไม่ต้องเปิดหน้านี้ค้างไว้ '
      + 'และไม่ต้องกดอะไรเพื่อให้มันทำงาน</div>';
    return h;
  }

  async function load() {
    var body = document.getElementById('ohB');
    var art = null;
    try {
      if (window.opsRpc) { var r = await window.opsRpc('sop_get', { tool: PAGE }); art = r && r.data; }
    } catch (e) { /* อ่านคู่มือไม่ได้ ก็ยังโชว์ส่วนอัตโนมัติได้ */ }

    var h = autoHtml();
    h += '<div class="ohsec you">สิ่งที่คุณต้องทำ</div>';
    var steps = (art && Array.isArray(art.steps)) ? art.steps : [];
    if (art && art.summary) h += '<div class="ohempty" style="padding-bottom:4px">' + esc(art.summary) + '</div>';
    if (steps.length) {
      steps.forEach(function (st, i) {
        h += '<div class="ohstep"><span class="n">' + esc(st.n || (i + 1)) + '</span><span>' + esc(st.text || '') + '</span></div>';
        if (st.image_url) h += '<div class="ohshot"><img src="' + esc(st.image_url) + '" alt="" loading="lazy"></div>';
      });
    } else {
      h += '<div class="ohempty">ยังไม่มีคู่มือของหน้านี้<br>หัวหน้าเพิ่มได้ที่หน้า “คลังสอนงาน” (sop-admin)</div>';
    }
    h += '<a class="ohmore" href="sop-admin.html">ดูคู่มือทั้งหมด / แก้ไข</a>';
    if (art && art.title) {
      document.getElementById('ohT').innerHTML = esc(art.title) + '<small>ระบบทำอะไรเอง และคุณต้องตรวจอะไร</small>';
    }
    body.innerHTML = h;
  }

  function mount() {
    if (document.querySelector('.ohbtn')) return;
    injectCss();
    var b = document.createElement('button');
    b.className = 'ohbtn'; b.type = 'button'; b.textContent = '?';
    b.setAttribute('aria-label', 'วิธีใช้หน้านี้');
    b.addEventListener('click', open);
    document.body.appendChild(b);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
