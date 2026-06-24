// ===== scan.js — สแกน QR ด้วยกล้อง / แตะ NFC → เติมรหัสลงช่อง input (กรอกง่าย ไม่ต้องพิมพ์) =====
// ใช้: <script src="https://cdn.jsdelivr.net/npm/html5-qrcode"></script><script src="scan.js"></script>
//   ปุ่ม: <button onclick="scanInto('wsCode', doSend)">สแกน</button>  (arg2 = callback หลังเติม ไม่บังคับ)
// QR ป้ายชุดเข้ารหัสเป็น lloop.app/g/<code> หรือรหัสตรง ๆ → ดึง <code> ออกมา
(function () {
  function parseCode(txt) {
    if (!txt) return '';
    txt = String(txt).trim();
    if (txt.includes('/g/')) return txt.split('/g/').pop().split(/[/?#]/)[0];   // .../g/g1
    if (txt.includes('garment=')) return decodeURIComponent(txt.split('garment=').pop().split('&')[0]);
    if (/^https?:/i.test(txt)) return txt.split('/').filter(Boolean).pop();      // เผื่อ url อื่น
    return txt;                                                                   // รหัสตรง ๆ
  }
  function ensureOverlay() {
    let o = document.getElementById('scanOverlay');
    if (o) return o;
    o = document.createElement('div');
    o.id = 'scanOverlay';
    o.style.cssText = 'position:fixed;inset:0;background:rgba(20,18,14,.92);z-index:200;display:none;flex-direction:column;align-items:center;justify-content:center;padding:20px';
    o.innerHTML = '<div style="color:#F2ECDD;font-family:Prompt,sans-serif;font-size:15px;margin-bottom:12px">เล็งกล้องไปที่ QR ป้ายชุด</div>'
      + '<div id="scanBox" style="width:min(86vw,340px);aspect-ratio:1;border-radius:14px;overflow:hidden;background:#000"></div>'
      + '<button id="scanCancel" style="margin-top:16px;background:#F2ECDD;color:#14130F;border:none;border-radius:10px;padding:11px 22px;font-family:Prompt,sans-serif;font-size:15px;font-weight:600">ปิด</button>';
    document.body.appendChild(o);
    o.querySelector('#scanCancel').onclick = () => stop();
    return o;
  }
  let _qr = null;
  function stop() {
    const o = document.getElementById('scanOverlay');
    if (_qr) { _qr.stop().catch(() => {}); _qr.clear?.(); _qr = null; }
    if (o) o.style.display = 'none';
  }
  async function scanInto(inputId, cb) {
    if (!window.Html5Qrcode) { alert('ตัวสแกนยังโหลดไม่เสร็จ ลองใหม่อีกครั้ง'); return; }
    const o = ensureOverlay(); o.style.display = 'flex';
    _qr = new Html5Qrcode('scanBox');
    try {
      await _qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: 240 },
        (decoded) => {
          const code = parseCode(decoded);
          const el = document.getElementById(inputId);
          if (el) { el.value = code; el.dispatchEvent(new Event('input')); }
          stop();
          if (typeof cb === 'function') cb();
        }, () => {});
    } catch (e) { stop(); alert('เปิดกล้องไม่ได้ — อนุญาตสิทธิ์กล้อง หรือพิมพ์รหัสเองได้ค่ะ'); }
  }
  // แตะ NFC (Android Chrome รองรับ Web NFC) → เติมรหัสจาก tag (ถ้าเขียนรหัสไว้ใน tag)
  async function nfcInto(inputId, cb) {
    if (!('NDEFReader' in window)) { alert('มือถือนี้ไม่รองรับแตะ NFC — ใช้สแกน QR หรือพิมพ์แทนได้ค่ะ'); return; }
    try {
      const r = new NDEFReader(); await r.scan();
      r.onreading = (e) => {
        let txt = '';
        for (const rec of e.message.records) { try { txt = new TextDecoder().decode(rec.data); } catch (_) {} if (txt) break; }
        const code = parseCode(txt || e.serialNumber || '');
        const el = document.getElementById(inputId);
        if (el) { el.value = code; el.dispatchEvent(new Event('input')); }
        if (typeof cb === 'function') cb();
      };
    } catch (e) { alert('อ่าน NFC ไม่ได้ค่ะ'); }
  }
  window.scanInto = scanInto;
  window.nfcInto = nfcInto;
})();
