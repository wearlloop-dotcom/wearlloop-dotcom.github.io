// ===== PromptPay QR — payload EMVCo + QR แบรนด์ LLOOP ฝังยอดต่อออเดอร์ =====
// type: 'phone' (เบอร์) | 'natid' (เลขบัตร 13 หลัก) | 'ewallet' (e-wallet/พร้อมเพย์ 15 หลัก)
//   window.promptpayPayload('004999025090944', 490, 'ewallet') → payload
//   window.promptpayBrandedQR(el, ppId, amount, type)          → วาด QR + โลโก้ LLOOP
//   ต้องโหลด: <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>
(function () {
  const f = (id, val) => id + String(val.length).padStart(2, '0') + val;
  function crc16(s) {
    let crc = 0xFFFF;
    for (let i = 0; i < s.length; i++) {
      crc ^= s.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function promptpayPayload(target, amount, type) {
    const num = String(target || '').replace(/[^0-9]/g, '');
    let tag, acct;
    if (type === 'ewallet') { tag = '03'; acct = num; }                       // e-wallet/พร้อมเพย์ 15 หลัก
    else if (type === 'natid' || num.length >= 13) { tag = '02'; acct = num; } // เลขบัตร ปชช
    else { tag = '01'; acct = ('0066' + num.replace(/^0/, '')).padStart(13, '0'); } // เบอร์
    const merchant = f('00', 'A000000677010111') + f(tag, acct);
    let p = f('00', '01') + f('01', amount ? '12' : '11') + f('29', merchant) + f('58', 'TH') + f('53', '764');
    if (amount) p += f('54', Number(amount).toFixed(2));
    p += '6304';
    return p + crc16(p);
  }

  // มุมโค้ง
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  // QR + โลโก้ LLOOP ตรงกลาง (EC level H ทนโลโก้บัง ~22%)
  function promptpayBrandedQR(el, ppId, amount, type) {
    if (!el) return;
    if (!ppId) { el.innerHTML = '<div style="color:#8C8B86;font-size:12px">ยังไม่ได้ตั้งค่าพร้อมเพย์</div>'; return; }
    if (!window.qrcode) { el.innerHTML = '<div style="color:#8C8B86;font-size:12px">กำลังโหลด QR…</div>'; return; }
    const q = window.qrcode(0, 'H');
    q.addData(promptpayPayload(ppId, amount, type));
    q.make();
    const n = q.getModuleCount(), cell = 9, pad = 4 * cell, size = n * cell + pad * 2;
    const c = document.createElement('canvas');
    const dpr = Math.min(2, (window.devicePixelRatio || 1));
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#1A1A1A';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (q.isDark(r, col)) ctx.fillRect(pad + col * cell, pad + r * cell, cell, cell);
    // โลโก้กลาง: กล่องขาวมุมโค้ง + wordmark LLOOP สีหมึก
    const bw = size * 0.26, bx = (size - bw) / 2;
    ctx.fillStyle = '#FFFFFF'; rr(ctx, bx, (size - bw * 0.62) / 2, bw, bw * 0.62, 7); ctx.fill();
    ctx.fillStyle = '#B8A179'; rr(ctx, bx, (size - bw * 0.62) / 2, bw, bw * 0.62, 7); ctx.lineWidth = 1.5; ctx.strokeStyle = '#B8A179'; ctx.stroke();
    ctx.fillStyle = '#1A1A1A';
    ctx.font = `700 ${Math.round(bw * 0.2)}px Poppins, 'Prompt', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('LLOOP', size / 2, size / 2 + 1);
    const img = new Image(); img.alt = 'PromptPay LLOOP';
    img.style.cssText = 'width:210px;max-width:72%;border-radius:8px';
    img.src = c.toDataURL('image/png');
    el.innerHTML = ''; el.appendChild(img);
  }

  window.promptpayPayload = promptpayPayload;
  window.promptpayBrandedQR = promptpayBrandedQR;
})();
