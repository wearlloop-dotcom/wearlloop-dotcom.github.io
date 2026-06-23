// ===== PromptPay QR — สร้าง payload EMVCo + render QR ฝังยอดต่อออเดอร์ =====
// ใช้: window.promptpayPayload('0812345678', 490)  → สตริง payload
//      window.promptpayQR(el, ppId, amount, type)  → วาด QR ลง element (ต้องโหลด qrcode-generator)
//   <script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>
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

  // target = เบอร์ (08xxxxxxxx) หรือเลขบัตร ปชช 13 หลัก · amount เว้นว่าง = QR ไม่ฝังยอด
  function promptpayPayload(target, amount, type) {
    const num = String(target || '').replace(/[^0-9]/g, '');
    const isNatId = (type === 'natid') || num.length >= 13;
    const tag = isNatId ? '02' : '01';
    const acct = isNatId ? num : ('0066' + num.replace(/^0/, '')).padStart(13, '0');
    const merchant = f('00', 'A000000677010111') + f(tag, acct);
    let payload = f('00', '01') + f('01', amount ? '12' : '11') + f('29', merchant) + f('58', 'TH') + f('53', '764');
    if (amount) payload += f('54', Number(amount).toFixed(2));
    payload += '6304';
    return payload + crc16(payload);
  }

  // วาด QR ลง element (ต้องมี global qrcode จาก qrcode-generator)
  function promptpayQR(el, ppId, amount, type) {
    if (!el) return;
    if (!ppId) { el.innerHTML = '<div style="color:#8C8B86;font-size:12px">ยังไม่ได้ตั้งค่าพร้อมเพย์</div>'; return; }
    if (!window.qrcode) { el.innerHTML = '<div style="color:#8C8B86;font-size:12px">กำลังโหลด QR…</div>'; return; }
    const q = window.qrcode(0, 'M');
    q.addData(promptpayPayload(ppId, amount, type));
    q.make();
    el.innerHTML = q.createImgTag(5, 8);
  }

  window.promptpayPayload = promptpayPayload;
  window.promptpayQR = promptpayQR;
})();
