// ===== ops-feedback — ปุ่มลอย "ส่ง feedback ระบบ" บนทุกหน้า ops =====
// พนักงาน active คนไหนก็ส่งได้ · แนบได้หลายรูป + ไฟล์ + ลิงก์ · แคปหน้าจอสดได้ (getDisplayMedia)
// เก็บเข้า edge function ops-feedback (private) — เจ้าของอ่านย้อนหลังที่ feedback.html
// ใช้: โหลดหลัง ops-api.js แล้วเรียก window.opsFeedback.mount() (ops-menu.js เรียกให้อัตโนมัติ)
(function () {
  if (window.__opsFeedbackMounted) return;
  const CONF = window.CONFIG || {};
  const FN = (CONF.SUPABASE_URL || 'https://rprwilsbjptdnvsibjgi.supabase.co') + '/functions/v1/ops-feedback';
  const MAX_ATTACH = 8, MAX_BYTES = 6 * 1024 * 1024;

  const CSS = `
  .fbk-fab{position:fixed;right:16px;bottom:16px;z-index:80;display:flex;align-items:center;gap:7px;
    padding:9px 14px;border:1px solid var(--line,#E0DED9);background:#fff;border-radius:24px;cursor:pointer;
    font-family:'Prompt',var(--sans,sans-serif);font-size:13px;font-weight:600;color:var(--ink,#1A1A1A);
    box-shadow:0 3px 12px rgba(0,0,0,.14)}
  .fbk-fab:hover{background:var(--soft,#F5F4F2)}
  .fbk-fab .dot{width:8px;height:8px;border-radius:50%;background:var(--ok,#0F6E56)}
  .fbk-ov{position:fixed;inset:0;background:rgba(0,0,0,.34);z-index:90;opacity:0;visibility:hidden;transition:.16s}
  .fbk-ov.open{opacity:1;visibility:visible}
  .fbk-panel{position:fixed;right:16px;bottom:16px;z-index:91;width:380px;max-width:calc(100vw - 24px);
    max-height:calc(100vh - 32px);overflow-y:auto;background:#fff;border-radius:14px;
    box-shadow:0 10px 34px rgba(0,0,0,.24);transform:translateY(14px);opacity:0;visibility:hidden;transition:.18s;
    font-family:'Prompt',var(--sans,sans-serif);color:var(--ink,#1A1A1A)}
  .fbk-panel.open{transform:none;opacity:1;visibility:visible}
  .fbk-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 10px;border-bottom:1px solid var(--line,#EEECE8)}
  .fbk-hd .t{font-weight:700;font-size:15px}
  .fbk-x{border:0;background:none;font-size:20px;line-height:1;cursor:pointer;color:var(--muted,#86857F);padding:0 2px}
  .fbk-bd{padding:12px 16px 16px}
  .fbk-lbl{font-size:11.5px;color:var(--muted,#86857F);margin:10px 0 5px;letter-spacing:.02em}
  .fbk-kinds{display:flex;gap:6px}
  .fbk-kind{flex:1;padding:7px 6px;border:1px solid var(--line,#E0DED9);background:#fff;border-radius:9px;cursor:pointer;font-size:12.5px;color:var(--ink,#1A1A1A);text-align:center}
  .fbk-kind.on{background:var(--ink,#1A1A1A);color:#fff;border-color:var(--ink,#1A1A1A)}
  .fbk-ta{width:100%;box-sizing:border-box;min-height:78px;resize:vertical;padding:9px 10px;border:1px solid var(--line,#E0DED9);border-radius:9px;font-family:inherit;font-size:13.5px;color:var(--ink,#1A1A1A)}
  .fbk-ta:focus{outline:none;border-color:var(--ok,#0F6E56)}
  .fbk-btns{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
  .fbk-b{display:inline-flex;align-items:center;gap:5px;padding:7px 11px;border:1px solid var(--line,#E0DED9);background:#fff;border-radius:9px;cursor:pointer;font-size:12.5px;font-family:inherit;color:var(--ink,#1A1A1A)}
  .fbk-b:hover{background:var(--soft,#F5F4F2)}
  .fbk-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
  .fbk-th{position:relative;width:62px;height:62px;border:1px solid var(--line,#E0DED9);border-radius:8px;overflow:hidden;background:var(--soft,#F5F4F2);display:flex;align-items:center;justify-content:center}
  .fbk-th img{width:100%;height:100%;object-fit:cover}
  .fbk-th .fn{font-size:9px;color:var(--muted,#86857F);padding:3px;text-align:center;word-break:break-all;line-height:1.15}
  .fbk-th .rm{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#1A1A1A;color:#fff;border:0;font-size:12px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .fbk-link{width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--line,#E0DED9);border-radius:9px;font-family:inherit;font-size:12.5px;margin-top:6px;color:var(--ink,#1A1A1A)}
  .fbk-link:focus{outline:none;border-color:var(--ok,#0F6E56)}
  .fbk-addlink{font-size:12px;color:var(--ok,#0F6E56);background:none;border:0;cursor:pointer;padding:6px 0 0;font-family:inherit}
  .fbk-send{width:100%;margin-top:14px;padding:11px;border:0;border-radius:10px;background:var(--ink,#1A1A1A);color:#fff;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer}
  .fbk-send:disabled{opacity:.55;cursor:default}
  .fbk-msg{margin-top:10px;font-size:12.5px;padding:8px 10px;border-radius:8px;display:none}
  .fbk-msg.ok{display:block;background:#E7F3EF;color:#0F6E56}
  .fbk-msg.err{display:block;background:#FBECEC;color:#B23A38}
  .fbk-hint{font-size:11px;color:var(--muted,#86857F);margin-top:7px}
  @media print{.fbk-fab,.fbk-ov,.fbk-panel{display:none!important}}`;

  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };
  const readFile = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });

  let attachments = []; // { name, media_type, dataUrl, isImage }
  let kind = 'bug';
  let panel, ov, thumbsBox, taEl, msgEl, sendEl, linksBox;

  function toast(text, ok) {
    msgEl.className = 'fbk-msg ' + (ok ? 'ok' : 'err');
    msgEl.textContent = text;
  }
  function renderThumbs() {
    thumbsBox.innerHTML = '';
    attachments.forEach((a, i) => {
      const t = el('div', 'fbk-th');
      t.innerHTML = a.isImage ? `<img src="${a.dataUrl}">` : `<div class="fn">${a.name}</div>`;
      const rm = el('button', 'rm', '&times;'); rm.title = 'ลบ';
      rm.onclick = () => { attachments.splice(i, 1); renderThumbs(); };
      t.appendChild(rm); thumbsBox.appendChild(t);
    });
  }
  function addAttachment(a) {
    if (attachments.length >= MAX_ATTACH) { toast('แนบได้ไม่เกิน ' + MAX_ATTACH + ' ไฟล์', false); return; }
    attachments.push(a); renderThumbs();
  }
  async function addFiles(fileList) {
    for (const file of Array.from(fileList || [])) {
      if (file.size > MAX_BYTES) { toast('ไฟล์ "' + file.name + '" ใหญ่เกิน 6MB', false); continue; }
      const dataUrl = await readFile(file);
      addAttachment({ name: file.name || 'file', media_type: file.type || 'application/octet-stream', dataUrl, isImage: /^image\//.test(file.type) });
    }
  }
  async function captureScreen() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      toast('เบราว์เซอร์นี้แคปหน้าจอไม่ได้ — ใช้ปุ่มแนบรูป หรือวางรูป (Ctrl+V) แทนได้', false); return;
    }
    let stream;
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }); }
    catch (e) { return; } // ผู้ใช้ยกเลิก
    try {
      const video = document.createElement('video'); video.srcObject = stream; video.muted = true;
      await video.play();
      await new Promise((r) => (video.readyState >= 2 ? r() : (video.onloadeddata = r)));
      const w = video.videoWidth || 1280, h = video.videoHeight || 720;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(video, 0, 0, w, h);
      const dataUrl = cv.toDataURL('image/jpeg', 0.85);
      addAttachment({ name: 'screenshot.jpg', media_type: 'image/jpeg', dataUrl, isImage: true });
      toast('', true); msgEl.className = 'fbk-msg';
    } finally { stream.getTracks().forEach((t) => t.stop()); }
  }
  function addLinkInput(val) {
    const inp = el('input', 'fbk-link'); inp.type = 'url'; inp.placeholder = 'https://…'; if (val) inp.value = val;
    linksBox.appendChild(inp); return inp;
  }

  function open() { ov.classList.add('open'); panel.classList.add('open'); taEl.focus(); }
  function close() { ov.classList.remove('open'); panel.classList.remove('open'); }
  function reset() {
    attachments = []; kind = 'bug'; taEl.value = ''; renderThumbs();
    msgEl.className = 'fbk-msg'; msgEl.textContent = '';
    linksBox.innerHTML = ''; addLinkInput('');
    panel.querySelectorAll('.fbk-kind').forEach((k) => k.classList.toggle('on', k.dataset.k === 'bug'));
  }

  async function send() {
    const message = taEl.value.trim();
    const links = Array.from(linksBox.querySelectorAll('.fbk-link')).map((i) => i.value.trim()).filter(Boolean);
    if (!message && !attachments.length && !links.length) { toast('พิมพ์ข้อความ หรือแนบรูป/ไฟล์/ลิงก์อย่างน้อย 1 อย่าง', false); return; }
    sendEl.disabled = true; sendEl.textContent = 'กำลังส่ง…'; toast('', true); msgEl.className = 'fbk-msg';
    try {
      if (!(await window.opsLogin())) { toast('กำลังพาเข้าสู่ระบบ…', false); sendEl.disabled = false; sendEl.textContent = 'ส่ง feedback'; return; }
      const idToken = liff.getIDToken();
      const images = [], files = [];
      for (const a of attachments) {
        const data = a.dataUrl.replace(/^data:[^,]+,/, '');
        if (a.isImage) images.push({ data, media_type: a.media_type });
        else files.push({ data, media_type: a.media_type, name: a.name });
      }
      const r = await fetch(FN, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, task: 'submit', kind, message, links,
          page: location.pathname.split('/').pop() || location.pathname, user_agent: navigator.userAgent, images, files }),
      });
      const out = await r.json().catch(() => ({}));
      if (!r.ok || out.error) { toast(out.message || out.error || ('ส่งไม่สำเร็จ (http ' + r.status + ')'), false); return; }
      toast('ขอบคุณค่ะ ส่ง feedback เรียบร้อย', true);
      reset();
      setTimeout(() => { if (panel.classList.contains('open')) close(); }, 1400);
    } catch (e) {
      toast('เชื่อมต่อไม่สำเร็จ ลองใหม่อีกครั้ง', false);
    } finally {
      sendEl.disabled = false; sendEl.textContent = 'ส่ง feedback';
    }
  }

  function build() {
    const s = el('style'); s.id = 'fbk-css'; s.textContent = CSS; document.head.appendChild(s);

    const fab = el('button', 'fbk-fab', '<span class="dot"></span>Feedback'); fab.setAttribute('aria-label', 'ส่ง feedback');
    ov = el('div', 'fbk-ov');
    panel = el('div', 'fbk-panel');
    panel.innerHTML = `
      <div class="fbk-hd"><div class="t">ส่ง feedback ระบบ</div><button class="fbk-x" aria-label="ปิด">&times;</button></div>
      <div class="fbk-bd">
        <div class="fbk-lbl">ประเภท</div>
        <div class="fbk-kinds">
          <div class="fbk-kind on" data-k="bug">พบปัญหา/บั๊ก</div>
          <div class="fbk-kind" data-k="idea">ไอเดีย/อยากได้เพิ่ม</div>
          <div class="fbk-kind" data-k="other">อื่นๆ</div>
        </div>
        <div class="fbk-lbl">รายละเอียด</div>
        <textarea class="fbk-ta" placeholder="เล่าให้ฟังหน่อยว่าเจออะไร หรืออยากให้พัฒนาตรงไหน… (วางรูปด้วย Ctrl+V ได้)"></textarea>
        <div class="fbk-btns">
          <button class="fbk-b" data-a="cap">แคปหน้าจอ</button>
          <button class="fbk-b" data-a="file">แนบรูป/ไฟล์</button>
        </div>
        <div class="fbk-thumbs"></div>
        <div class="fbk-lbl">ลิงก์ที่เกี่ยวข้อง (ถ้ามี)</div>
        <div class="fbk-links"></div>
        <button class="fbk-addlink">+ เพิ่มลิงก์</button>
        <div class="fbk-hint">แนบได้หลายรูป/ไฟล์ (สูงสุด ${MAX_ATTACH} ไฟล์ · ไฟล์ละไม่เกิน 6MB) — ข้อมูลนี้เก็บเป็นความลับภายใน ไม่ขึ้นเว็บลูกค้า</div>
        <button class="fbk-send">ส่ง feedback</button>
        <div class="fbk-msg"></div>
      </div>`;

    document.body.append(fab, ov, panel);
    thumbsBox = panel.querySelector('.fbk-thumbs');
    taEl = panel.querySelector('.fbk-ta');
    msgEl = panel.querySelector('.fbk-msg');
    sendEl = panel.querySelector('.fbk-send');
    linksBox = panel.querySelector('.fbk-links');
    addLinkInput('');

    const fileInput = el('input'); fileInput.type = 'file'; fileInput.multiple = true; fileInput.style.display = 'none';
    fileInput.onchange = () => { addFiles(fileInput.files); fileInput.value = ''; };
    document.body.appendChild(fileInput);

    fab.onclick = open;
    ov.onclick = close;
    panel.querySelector('.fbk-x').onclick = close;
    panel.querySelectorAll('.fbk-kind').forEach((k) => k.onclick = () => {
      kind = k.dataset.k; panel.querySelectorAll('.fbk-kind').forEach((x) => x.classList.toggle('on', x === k));
    });
    panel.querySelector('[data-a="cap"]').onclick = captureScreen;
    panel.querySelector('[data-a="file"]').onclick = () => fileInput.click();
    panel.querySelector('.fbk-addlink').onclick = () => addLinkInput('').focus();
    sendEl.onclick = send;
    // วางรูปจาก clipboard (Ctrl+V) ในกล่อง feedback
    panel.addEventListener('paste', (e) => {
      const items = (e.clipboardData || {}).items || [];
      for (const it of items) {
        if (it.kind === 'file' && /^image\//.test(it.type)) {
          const f = it.getAsFile(); if (f) { addFiles([f]); e.preventDefault(); }
        }
      }
    });
  }

  function mount() {
    if (window.__opsFeedbackMounted) return;
    if (typeof window.opsLogin !== 'function') return; // เฉพาะหน้า ops ที่มี auth
    window.__opsFeedbackMounted = true;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
  }

  window.opsFeedback = { mount };
})();
