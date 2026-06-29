// LLOOP · ตัวช่วยถ่าย+บีบอัด+อัปโหลดรูป QC สภาพชุด ก่อน/หลังเช่า
//   ใช้: window.qcPhotoCapture({ phase:'before'|'after', garment_code, rental_id?, note? })
//   ต้องโหลด ops-api.js (window.opsRpc) มาก่อน · อัปโหลดผ่าน gateway ops-rpc (LINE login + role)
(function () {
  // ย่อรูปให้กว้างไม่เกิน maxW แล้วคืน dataURL jpeg (ลดขนาดส่งขึ้นเซิร์ฟเวอร์)
  function shrink(file, maxW) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // เปิดกล้อง/เลือกรูป → อัปโหลด 1 รูป · คืน Promise<{ok, error?}>
  function capture(opts) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.onchange = async () => {
        const file = inp.files && inp.files[0];
        inp.remove();
        if (!file) return resolve({ ok: false, error: 'ยกเลิก' });
        try {
          const dataUrl = await shrink(file, 1280);
          const { data, error } = await window.opsRpc('qc_photo_upload', {
            phase: opts.phase,
            garment_code: opts.garment_code || null,
            rental_id: opts.rental_id || null,
            note: opts.note || null,
            image: dataUrl,
            media_type: 'image/jpeg',
          });
          if (error) return resolve({ ok: false, error: error.message });
          resolve({ ok: true, data });
        } catch (e) {
          resolve({ ok: false, error: (e && e.message) || 'อัปโหลดไม่สำเร็จ' });
        }
      };
      inp.click();
    });
  }

  window.qcPhotoCapture = capture;
})();
