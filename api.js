// ===== Data layer — Supabase จริง หรือ mock (ตาม CONFIG.USE_MOCK) =====
window.API = (function () {
  let sb = null; // supabase client
  let lineUid = null; // เก็บ UID ไว้ใช้ remarketing

  function client() {
    if (!sb) sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    return sb;
  }

  // ===== Behavioral event tracking (เก็บพฤติกรรมแบบ FB/IG/TikTok) =====
  // buffer ฝั่ง client → flush เป็นแบตช์ (ลด round-trip) ผ่าน log_events RPC
  const _sid = 's_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  let _evBuf = [];
  function track(event, target, meta) {
    if (CONFIG.USE_MOCK || !event) return;
    _evBuf.push({ s: _sid, u: lineUid || '', e: event, t: target || '', m: meta || null });
    if (_evBuf.length >= 12) flushEvents();
  }
  async function flushEvents() {
    if (CONFIG.USE_MOCK || !_evBuf.length) return;
    const batch = _evBuf.splice(0, 50);
    try { await client().rpc('log_events', { p_events: batch }); }
    catch (_e) { /* เงียบ — analytics ไม่ควรกระทบ UX */ }
  }
  // flush เป็นระยะ + ตอนซ่อนหน้า/ปิด (จับ dwell ครบ)
  if (!CONFIG.USE_MOCK) {
    setInterval(flushEvents, 5000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushEvents(); });
    window.addEventListener('pagehide', flushEvents);
  }
  window.track = track;
  window.flushEvents = flushEvents;

  // map garment row (DB) รูปการ์ดหน้าเว็บ
  function mapGarment(r) {
    return {
      id: r.id, code: r.code, name: r.name || r.code, brand: r.brand, tier: r.tier, price: r.rental_price, category: r.category,
      retail: r.replacement_value != null ? Number(r.replacement_value) : null,  // มูลค่าชุด (โชว์ความคุ้ม)
      grade: r.condition_grade || null, washCount: r.wash_count ?? null,         // ความสะอาด/ดูแล
      timesRented: r.times_rented ?? 0,
      photo: (Array.isArray(r.photos) && r.photos[0]) || r.photo || null,
      photos: Array.isArray(r.photos) ? r.photos : [],
      size: r.size || null,
      sourceMeta: r.source_meta || null,
      styling_tips: r.styling_tips || [],
      fabric: r.fabric_composition, stretch: r.stretch ||'none',
      lining: r.has_lining, sheer: r.is_sheer, weight: r.fabric_weight,
      bust: (r.bust_min_in!= null)? [r.bust_min_in, r.bust_max_in] : null,
      waist: (r.waist_min_in!= null)? [r.waist_min_in, r.waist_max_in] : null,
      hip: r.hip_in, length: r.length_cm,
      fitAvg: r.fit_avg!= null? Number(r.fit_avg) : null, fitN: r.fit_n || 0, fitLabel: r.fit_label || null,
      colors: r.color_hex? [[r.color_name ||'สี', r.color_hex]] : [['—','#E7E2DA']],
      season: r.color_season, occasion_tags: r.occasion_tags || [],
      bg: r.color_hex ||'#E7E2DA', isNew: false,
    };
  }

  async function init() {
    if (CONFIG.USE_MOCK) {
      return {...window.MOCK, lineUid: null };
    }
    // 1) LINE login + ดึง UID มาเก็บ (remarketing)
    const profile = await window.LiffAuth.login(); // {userId, displayName, pictureUrl} | null
    lineUid = profile && profile.userId;
    const c = client();

    // 2) upsert ลูกค้าจาก UID + log touchpoint (remarketing audience)
    let customer = window.MOCK.CUSTOMER;
    if (lineUid) {
      await c.from('customers').upsert(
        { line_uid: lineUid, display_name: profile.displayName, picture_url: profile.pictureUrl },
        { onConflict:'line_uid'});
      await c.from('customer_touchpoints').insert(
        { line_uid: lineUid, kind:'open_app', detail: { source:'liff'} });
      // อ่านโปรไฟล์ของตัวเองผ่าน me-rpc (verify LINE idToken) — กัน anon อ่าน PII ลูกค้าทุกแถว (R-1)
      const { data } = window.meRpc
        ? await window.meRpc('me_profile', {})
        : await c.from('customers').select('*').eq('line_uid', lineUid).single();
      if (data) customer = data;
      // สร้าง/ดึงรหัสนัดสไตลิสต์ (ให้พาร์ทเนอร์ค้นเจอ)
      if (customer.id &&!customer.link_code) {
        const { data: code } = await window.meRpc('ensure_link_code', { p_customer: customer.id });
        if (code) customer.link_code = code;
      }
    }

    // 3) แคตตาล็อก (เฉพาะที่ data_status='ready')
    const { data: rows } = await c.from('garments').select('*').eq('data_status','ready');
    const garments = (rows || []).map(mapGarment);

    // 4) event ใกล้สุดของลูกค้า
    let event = null;
    if (customer.id) {
      const { data: ev } = await c.from('customer_events')
.select('*').eq('customer_id', customer.id).eq('notified', false)
.order('event_date', { ascending: true }).limit(1).maybeSingle();
      if (ev) {
        const d = new Date(ev.event_date);
        event = { title: ev.title, day: String(d.getDate()),
          month: d.toLocaleDateString('th-TH', { month:'short'}),
          occasion: ev.occasion, dress_code: ev.dress_code };
      }
    }
    // 5) ส่วนลดพนักงาน (ถ้า line_uid ตรงกับพนักงาน → % > 0) — ใช้โชว์ราคาพนักงานตอนไถดู
    let staff_pct = 0;
    if (customer.id) {
      try { const { data: sp } = await window.meRpc('staff_discount_pct', { p_customer: customer.id });
            staff_pct = Number(sp) || 0; } catch (_e) {}
    }
    return { OCCASIONS: window.MOCK.OCCASIONS, CUSTOMER: customer, EVENT: event, GARMENTS: garments, lineUid, staff_pct };
  }

  async function reserve(garmentId, customer) {
    if (CONFIG.USE_MOCK) return { ok: true };
    const c = client();
    // log touchpoint สำหรับ remarketing (สนใจชุดนี้)
    if (lineUid) await c.from('customer_touchpoints').insert(
      { line_uid: lineUid, kind:'reserve', detail: { garment_id: garmentId } });
    // จองจริงควรทำใน Edge Function (transaction กันจองชน) — ที่นี่เรียกผ่าน RPC
    const { data, error } = await window.meRpc('reserve_garment', { p_garment: garmentId, p_customer: customer.id });
    return { ok:!error, data, error };
  }

  // ลูกค้าที่เพิ่งลงทะเบียน LINE กรอก "รหัสผลวิเคราะห์" (link_code จากสตูดิโอ) → ผูก/รวมผลเข้าบัญชีตัวเอง
  async function claimStyleCode(codeRaw) {
    const code = (codeRaw || '').trim().toUpperCase();
    if (!code) return { ok: false, error: 'ใส่รหัสก่อนค่ะ' };
    if (CONFIG.USE_MOCK) return { ok: true, result: 'ok' };
    if (!window.meRpc) return { ok: false, error: 'ต้องเข้าสู่ระบบด้วย LINE ก่อน' };
    const { data, error } = await window.meRpc('customer_claim_code', { p_code: code });
    if (error) return { ok: false, error: error.message };
    const map = { not_found: 'ไม่พบรหัสนี้ — เช็กกับสตูดิโออีกครั้งนะคะ', taken: 'รหัสนี้ถูกผูกกับบัญชีอื่นแล้ว',
      no_line: 'ต้องเข้าสู่ระบบด้วย LINE ก่อน', already: 'รหัสนี้อยู่ในบัญชีคุณอยู่แล้ว' };
    if (data === 'ok' || data === 'already') return { ok: true, result: data };
    return { ok: false, error: map[data] || ('ไม่สำเร็จ: ' + data) };
  }

  // เริ่มซื้อ Personal Color (จ่ายในแอป → เครดิตเต็มจำนวน) — สร้าง topup รอจ่าย คืน payment_id + ยอด
  async function startPersonalColor() {
    if (CONFIG.USE_MOCK) return { ok: true, payment_id: 'demo', amount: 4900 };
    if (!window.meRpc) return { ok: false, error: 'ต้องเข้าสู่ระบบด้วย LINE ก่อน' };
    const { data, error } = await window.meRpc('pc_purchase_start', {});
    if (error) return { ok: false, error: error.message };
    if (!data || data.error) return { ok: false, error: (data && data.error) || 'เริ่มรายการไม่สำเร็จ' };
    return { ok: true, payment_id: data.payment_id, amount: Number(data.amount) || 4900 };
  }

  // ===== จองนัด Personal Color กับสไตลิสต์ (partner_booking.sql) =====
  async function pcStatus() {
    if (!window.meRpc) return { paid: false, appointment: null };
    const { data } = await window.meRpc('my_pc_status', {});
    return data || { paid: false, appointment: null };
  }
  async function stylistDirectory() {
    if (!window.meRpc) return [];
    const { data } = await window.meRpc('partner_directory', {});
    return Array.isArray(data) ? data : [];
  }
  async function stylistPublic(id) {
    if (!window.meRpc) return null;
    const { data } = await window.meRpc('partner_public', { p_id: id });
    return (data && !data.error) ? data : null;
  }
  async function pcBookSlot(slotId, note, mode) {
    if (!window.meRpc) return { ok: false, error: 'ต้องเข้าสู่ระบบด้วย LINE ก่อน' };
    const { data, error } = await window.meRpc('pc_book_slot', { p_slot: slotId, p_note: note || '', p_mode: mode || 'studio' });
    if (error) return { ok: false, error: error.message };
    if (!data || data.error) {
      const map = { not_paid: 'ต้องจ่ายค่า Personal Color ก่อนจองเวลา', slot_taken: 'ช่องนี้เพิ่งถูกจอง ลองเลือกใหม่', slot_past: 'ช่องนี้ผ่านไปแล้ว', already_booked: 'คุณมีนัดอยู่แล้ว', slot_not_found: 'ไม่พบช่องเวลา' };
      return { ok: false, error: map[data && data.error] || 'จองไม่สำเร็จ', code: data && data.error, appointment_id: data && data.appointment_id };
    }
    return { ok: true, appointment_id: data.appointment_id, starts_at: data.starts_at };
  }
  async function myAppointments() {
    if (!window.meRpc) return [];
    const { data } = await window.meRpc('my_pc_appointments', {});
    return Array.isArray(data) ? data : [];
  }
  async function pcCancelAppointment(id) {
    if (!window.meRpc) return { ok: false };
    const { data } = await window.meRpc('pc_cancel_appointment', { p_id: id });
    return { ok: data === 'ok', code: data };
  }

  async function saveProfile(customer) {
    if (CONFIG.USE_MOCK ||!lineUid) return { ok: true };
    const c = client();
    const { error } = await c.from('customers').update({
      display_name: customer.name, height_cm: customer.height_cm, shoe_size: customer.shoe_size,
      bust_in: customer.bust_in, waist_in: customer.waist_in, hip_in: customer.hip_in,
      my_color_season: customer.my_color_season, notes: customer.notes,
      phone: customer.phone, address: customer.address,
      weight_kg: customer.weight_kg, size: customer.size, prefs: customer.prefs, birthday: customer.birthday || null,
    }).eq('line_uid', lineUid);
    return { ok:!error, error };
  }

  // โควต้า AI สไตลิสต์ที่เหลือ (อ่านผ่าน gateway me-rpc — กัน IDOR) · null = ยังไม่ล็อกอิน
  async function stylistQuota() {
    if (CONFIG.USE_MOCK) return 5;
    if (!window.meRpc) return null;
    const { data } = await window.meRpc('stylist_quota', {});
    return (typeof data === 'number') ? data : null;
  }

  // แปลงลิงค์ Google Maps (วางในเว็บ/แชร์เข้า LINE) → place object พร้อมรูป
  // arg: { url } หรือ { place_id }
  async function resolvePlace(arg) {
    if (CONFIG.USE_MOCK) {
      const url = (arg && arg.url) || '';
      return { ok: true, place: { name: url ? 'สถานที่จากลิงค์ (mock)' : 'สถานที่ (mock)', types: [], price_level: null, place_id: null, photo_url: null, lat: null, lng: null } };
    }
    try {
      let idToken = null;
      try { idToken = window.liff && liff.getIDToken && liff.getIDToken(); } catch (_e) {}
      const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/resolve-place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(arg || {}), id_token: idToken }),
      });
      return await r.json().catch(() => ({ ok: false, error: 'network' }));
    } catch (_e) { return { ok: false, error: 'network' }; }
  }

  // AI Stylist — วิเคราะห์สถานที่ (จาก Google Place) + personal ลูกค้า + คลังจริง → แนะนำชุดเป็นตัว ๆ
  // payload: { venue, place?:{name,types[],price_level,lat,lng}, occasion? }
  // AI สไตลิสต์จัดอันดับชุดสำรอง (on-demand, ไม่กินโควต้า) → คืน [{code, why}] เรียงดีสุดก่อน
  async function rankBackups(primary, candidates, lang) {
    if (CONFIG.USE_MOCK || !primary || !Array.isArray(candidates) || !candidates.length) return [];
    let idToken = null;
    try { idToken = window.liff && liff.getIDToken && liff.getIDToken(); } catch (_e) {}
    try {
      const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/backup-rank`, {
        method:'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id_token: idToken, primary, candidates, lang }),
      });
      const j = await r.json().catch(() => ({}));
      return (j && j.ok && Array.isArray(j.ranked)) ? j.ranked : [];
    } catch (_e) { return []; }
  }

  async function stylist(payload, lang) {
    const { venue, place, occasion, date } = payload || {};
    if (!CONFIG.USE_MOCK) {
      let idToken = null;
      try { idToken = window.liff && liff.getIDToken && liff.getIDToken(); } catch (_e) {}
      const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/stylist`, {
        method:'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id_token: idToken, venue, place, occasion, lang, date }),
      });
      return await r.json().catch(() => ({ ok:false, error:'network'}));
    }
    // mock — จับคู่ประเภทที่รู้จัก หรือคืนคำแนะนำกลาง ๆ (ของจริงจะเป็น AI วิเคราะห์เจาะจง + เลือกชุดจากคลัง)
    const q = (venue ||'').toLowerCase();
    const v = (window.MOCK.VENUES || []).find(x => x.match.some(m => q.includes(m.toLowerCase())));
    const picks = (window.MOCK.GARMENTS || []).slice(0, 2).map(g => ({
      code: g.code, name: g.name, why:'เข้ากับโทนงานและ personal color ของคุณ', fit_note:'ไซส์ใกล้เคียงกับโปรไฟล์ของคุณ'}));
    if (v) return {
      ok:true, remaining:5, venue_type: v.venue_type, has_dress_code:true, dress_code_th: v.dress_code, occasion: v.occasion,
      appropriateness:'เหมาะกับกาลเทศะของที่นี่', aesthetics:'เข้ากับ personal color ของคุณ ถ่ายรูปสวย', mobility:'เคลื่อนไหวสบาย',
      palette_source:'venue_name', recommended_colors: v.colors.map(h => ({ hex: h, name:''})), recommended_garments: picks,
      photo_tip: v.photo_tip, avoid: v.avoid, note: v.note,
    };
    return {
      ok:true, remaining:5, venue_type:'สถานที่ของคุณ', has_dress_code:false, dress_code_th:'สมาร์ทแคชชวล', occasion: null,
      appropriateness:'โทนสุภาพ เข้าได้หลายบรรยากาศ', aesthetics:'สีกลางที่เข้ากับ personal color ได้กว้าง', mobility:'ใส่สบาย เคลื่อนไหวคล่อง',
      palette_source:'venue_name',
      recommended_colors: [{ hex:'#15233F', name:'navy'}, { hex:'#9FB7AC', name:'sage'}, { hex:'#B8A179', name:'champagne'}],
      recommended_garments: picks,
      photo_tip:'โทนสุภาพ เข้าได้หลายบรรยากาศ ถ่ายรูปดูดี',
      avoid:'สีสะท้อนแสงจัด', note:'เปิด AI จริง (deploy) เพื่อวิเคราะห์สถานที่แบบเจาะจง',
    };
  }

  // เช็กชุดว่างในวันที่กำหนด · ส่ง customerId เพื่อให้ "วันที่กันสิทธิ์คิวไว้ให้เรา" แสดงเป็นว่าง (first-pick)
  async function availableOn(garmentId, dateStr, customerId) {
    if (CONFIG.USE_MOCK) return true;
    const args = customerId
      ? { p_garment: garmentId, p_date: dateStr, p_customer: customerId }
      : { p_garment: garmentId, p_date: dateStr };
    const { data } = await client().rpc('garment_available_on', args);
    return data!== false;
  }
  // ชุดที่ว่างทั้งหมดในวันเดียว (กรองหน้าแรก) → Set ของ id (null = ถือว่าว่างหมด/mock)
  // ส่ง customerId → ชุดที่กันสิทธิ์คิวไว้ให้เราเอง แสดงเป็น "ว่าง" บน grid ด้วย (first-pick)
  async function availableSetOn(dateStr, customerId) {
    if (CONFIG.USE_MOCK) return null;
    const args = customerId ? { p_date: dateStr, p_customer: customerId } : { p_date: dateStr };
    const { data } = await client().rpc('available_garments_on', args);
    return new Set((data || []).map(x => (x && x.id) ? x.id : x));
  }
  // เช็กว่าชุดว่าง "ตลอดช่วง" [from..to] ไหม (pre-filter ฝั่ง client; server ยัง re-check ตอนจองจริง)
  // หมายเหตุ: ใช้ช่วงจองดิบจาก garment_booked_ranges (ยังไม่รวม buffer ส่ง-ซัก) — เป็นการกรองเบื้องต้น
  async function availableRange(garmentId, fromStr, toStr) {
    if (CONFIG.USE_MOCK) return true;
    let ranges = [];
    try { ranges = await bookedRanges(garmentId); } catch (e) { return true; }  // เช็กไม่ได้ → ปล่อยให้ server ตัดสิน
    const a = fromStr, b = toStr;
    // overlap แบบรวมปลาย [] : (from <= r.to) && (to >= r.from)
    return !(ranges || []).some(r => a <= (r.to_date || r.to) && b >= (r.from_date || r.from));
  }
  // ช่วงวันที่ถูกจองของชุด (สำหรับปฏิทินในรายละเอียด)
  async function bookedRanges(garmentId, exclRentalId) {
    if (CONFIG.USE_MOCK) return [];
    const args = { p_garment: garmentId };
    if (exclRentalId) args.p_excl = exclRentalId;  // ปฏิทินเลื่อนวัน: ไม่นับคิวของตัวเอง
    const { data } = await client().rpc('garment_booked_ranges', args);
    return data || [];
  }
  // จองตามช่วงวัน (กันจองชนวันเดียวกัน)
  async function reserveDates(garmentId, customer, fromStr, toStr) {
    if (CONFIG.USE_MOCK) return { ok: true };
    const c = client();
    if (lineUid) await c.from('customer_touchpoints').insert({ line_uid: lineUid, kind:'reserve', detail: { garment_id: garmentId, from: fromStr } });
    const { data, error } = await window.meRpc('reserve_garment_dates', { p_garment: garmentId, p_customer: customer.id || null, p_from: fromStr, p_to: toStr });
    return { ok:!error, data, error };
  }

  // กฎ/สัญญาการใช้บริการ
  async function getTerms() {
    if (CONFIG.USE_MOCK) return { version:'demo', body:'ข้อตกลงตัวอย่าง (โหมดเดโม)'};
    const { data } = await client().rpc('current_terms');
    return data;
  }
  async function acceptTerms(customer, version) {
    if (CONFIG.USE_MOCK ||!customer.id) return;
    await window.meRpc('accept_terms', { p_customer: customer.id, p_version: version });
  }
  // จอง — ชุดสำรองเป็นทางเลือกของลูกค้า:
  //   wantBackup=false → p_backups:[] (ไม่เตรียมสำรอง)  ·  true → null (ระบบเลือกชุดสำรองที่เข้ากันให้)
  // backupCodes = อาเรย์โค้ดชุดสำรองที่ "ลูกค้าเลือกเอง" ([] = ไม่เอาสำรอง)
  async function bookWithBackups(customer, primaryCode, fromStr, toStr, backupCodes) {
    const p_backups = Array.isArray(backupCodes) ? backupCodes : [];
    if (CONFIG.USE_MOCK) return { data: { primary: { code: primaryCode }, backups: p_backups.map(c => ({ code: c, name: c })) } };
    const c = client();
    if (lineUid) await c.from('customer_touchpoints').insert({ line_uid: lineUid, kind:'reserve', detail: { garment: primaryCode } });
    const { data, error } = await window.meRpc('book_with_backups', { p_customer: customer.id || null, p_primary_code: primaryCode, p_from: fromStr, p_to: toStr, p_backups });
    return { data, error };
  }
  // จ่ายค่าเช่าด้วยเครดิตในกระเป๋า (หักจากบัญชี + ยืนยันจองทันที ไม่ต้องแนบสลิป)
  //   gateway inject p_customer ที่ verify แล้ว → ส่งแค่ p_rental พอ
  async function payWithCredit(rentalId) {
    if (CONFIG.USE_MOCK) return { ok: true, data: { ok: true } };
    if (!window.meRpc) return { ok: false, error: 'ต้องเข้าสู่ระบบด้วย LINE ก่อน' };
    const { data, error } = await window.meRpc('pay_rental_with_credit', { p_rental: rentalId });
    if (error) return { ok: false, error: error.message };
    if (data && data.error) return { ok: false, error: data.error };
    return { ok: true, data };
  }
  // อิมแพกต์รักษ์โลกของฉัน
  async function myImpact(customer) {
    if (CONFIG.USE_MOCK ||!customer.id) return null;
    const { data } = await window.meRpc('my_impact', { p_customer: customer.id });
    return data;
  }
  // กระเป๋า LLOOP + ชั้น The Loop (ยอดเงินใช้จ่าย + ความคืบหน้าชั้น)
  async function myWallet(customer) {
    if (CONFIG.USE_MOCK ||!customer.id) return null;
    const { data } = await window.meRpc('my_wallet', { p_customer: customer.id });
    return data;
  }
  // AI ครบลุค — ทรงผม/เครื่องประดับที่เข้ากับชุด (prod = Edge Function, ไม่งั้น mock)
  async function hairStyle(garmentCode, occasion) {
    if (!CONFIG.USE_MOCK) {
      try {
        const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/hair-style`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ garment_code: garmentCode, occasion, lang: 'th' }),
        });
        if (r.ok) { const d = await r.json(); if (d && d.hair) return d; }
      } catch (e) { /* ตกไป mock */ }
    }
    return null; // ให้ฝั่ง UI ใช้ mock เอง
  }
  // ภาพกิจกรรม charity (แชร์ให้ลูกค้า)
  async function recentCharity() {
    if (CONFIG.USE_MOCK) return [];
    const { data } = await client().rpc('recent_charity', { n: 8 });
    return data || [];
  }

  // ===== ออเดอร์ของฉัน / wishlist / รีวิว / referral =====
  // ออเดอร์ของฉัน → array ของ {rental_id, code, name, status, role, use_date, due_at, courier, tracking_no, eta, price}
  async function myRentals(customer) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return [];
    const { data } = await window.meRpc('my_rentals', { p_customer: customer.id });
    return data || [];
  }
  // กดหัวใจ — สลับสถานะ wishlist (true = เพิ่งเพิ่ม)
  async function toggleWishlist(customer, garmentId) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return null;
    const { data } = await window.meRpc('toggle_wishlist', { p_customer: customer.id, p_garment: garmentId });
    return data === true;
  }
  // รายการ wishlist ของฉัน → Set ของ garment id
  async function myWishlist(customer) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return new Set();
    const { data } = await window.meRpc('my_wishlist', { p_customer: customer.id });
    return new Set((data || []).map(x => (x && x.id) ? x.id : x));
  }

  // ===== ต่อคิวชุด (waitlist) + โหวตให้ซื้อ — ผ่าน me-rpc gateway (กัน IDOR) =====
  // ต่อคิวชุดสำหรับ "วันที่อยากได้" → { ok, position, total, already, want_date }
  async function joinWaitlist(garmentId, wantDate) {
    if (CONFIG.USE_MOCK || !window.meRpc) return { ok: false };
    const { data, error } = await window.meRpc('join_waitlist', { p_garment: garmentId, p_date: wantDate || null });
    return error ? { ok: false, error } : (data || { ok: false });
  }
  // ออกจากคิว (ระบุวันได้ · ไม่ระบุ = ออกทุกคิวของชุดนี้)
  async function leaveWaitlist(garmentId, wantDate) {
    if (CONFIG.USE_MOCK || !window.meRpc) return { ok: false };
    const { data } = await window.meRpc('leave_waitlist', { p_garment: garmentId, p_date: wantDate || null });
    return data || { ok: false };
  }
  // คิวทั้งหมดของฉัน → array {garment_id, code, name, photo, want_date, status, position, total, hold_until, available_now}
  async function myWaitlist() {
    if (CONFIG.USE_MOCK || !window.meRpc) return [];
    const { data } = await window.meRpc('my_waitlist', {});
    return Array.isArray(data) ? data : [];
  }
  // จำนวนคนต่อคิวของชุด (อ่านสาธารณะ) → int
  async function waitlistCount(garmentId) {
    if (CONFIG.USE_MOCK || !garmentId) return 0;
    try { const { data } = await client().rpc('garment_waitlist_count', { p_garment: garmentId }); return Number(data) || 0; }
    catch (_e) { return 0; }
  }
  // คำขอ "มาแรง" ให้โหวตตาม → array {id, brand, item_description, votes, voted, mine, reference_image_url}
  async function trendingRequests(limit) {
    if (CONFIG.USE_MOCK || !window.meRpc) return [];
    const { data } = await window.meRpc('trending_requests', { p_limit: limit || 30 });
    return Array.isArray(data) ? data : [];
  }
  // กด/ยกเลิกโหวตคำขอ → { voted, votes, own }
  async function voteRequest(requestId) {
    if (CONFIG.USE_MOCK || !window.meRpc) return null;
    const { data } = await window.meRpc('vote_request', { p_request: requestId });
    return data || null;
  }
  // เพิ่มรีวิวหลังคืนชุด
  async function addReview(rentalId, rating, fit, comment, photos) {
    if (CONFIG.USE_MOCK || !rentalId) return null;
    const a = { p_rental: rentalId, p_rating: rating, p_fit: fit, p_comment: comment || null, p_photos: photos || null };
    const { data, error } = window.meRpc ? await window.meRpc('add_review', a) : await client().rpc('add_review', a);
    return error ? null : data;
  }
  // เรตติ้งเฉลี่ยของชุด → {avg, count}
  async function garmentRating(garmentId) {
    if (CONFIG.USE_MOCK || !garmentId) return null;
    const { data } = await client().rpc('garment_rating', { p_garment: garmentId });
    return data || null;
  }
  // รูปจริงจากลูกค้าที่รีวิวชุดนี้ (UGC) → array {url, rating, comment}
  async function garmentReviewPhotos(garmentId) {
    if (CONFIG.USE_MOCK || !garmentId) return [];
    const { data } = await client().rpc('garment_review_photos', { p_garment: garmentId });
    return data || [];
  }
  // รูปจริงจาก creator (UGC ที่ผ่านออดิท → is_catalog) — โชว์คู่กับรูปรีวิว
  async function garmentUgcPhotos(garmentId) {
    if (CONFIG.USE_MOCK || !garmentId) return [];
    const { data } = await client().rpc('garment_ugc_photos', { p_garment: garmentId });
    return data || [];
  }
  // อัปโหลดรูป (รีวิว) ไป Storage 'uploads' → คืน url (fallback ว่างถ้า bucket ยังไม่เปิด)
  async function uploadPhotos(files) {
    if (CONFIG.USE_MOCK || !files || !files.length) return [];
    const c = client(); const urls = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i]; const path = `rev-${Date.now()}-${i}-${(f.name || 'p').replace(/\s+/g, '_')}`;
      try {
        const { error } = await c.storage.from('uploads').upload(path, f);
        if (error) throw error;
        const { data } = c.storage.from('uploads').getPublicUrl(path);
        if (data && data.publicUrl) urls.push(data.publicUrl);
      } catch (e) { /* bucket ยังไม่เปิด — ข้าม */ }
    }
    return urls;
  }
  // โค้ดชวนเพื่อนของฉัน (สร้างถ้ายังไม่มี)
  async function ensureReferralCode(customer) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return null;
    const { data } = await window.meRpc('ensure_referral_code', { p_customer: customer.id });
    return data || null;
  }
  // ใส่โค้ดเพื่อนที่ชวนเรา → 'ok' | 'self' | 'used' | 'not_found'
  async function applyReferral(customer, code) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return 'not_found';
    const { data } = await window.meRpc('apply_referral', { p_customer: customer.id, p_code: code });
    return data || 'not_found';
  }
  // คลิปรีวิว → บันทึก + ส่งให้ AI เช็ก (ได้เครดิตเมื่อรีวิวเป็นบวก)
  async function submitVideoReview(rentalId, rating, fit, comment, videoUrl, platform, reviewText) {
    if (CONFIG.USE_MOCK || !rentalId) return { ok: false };
    const c = client();
    const a = { p_rental: rentalId, p_rating: rating, p_fit: fit, p_comment: comment || null,
      p_video_url: videoUrl, p_platform: platform || null, p_review_text: reviewText || null };
    const { data: id, error } = window.meRpc ? await window.meRpc('submit_video_review', a) : await c.rpc('submit_video_review', a);
    if (error || !id) return { ok: false, error };
    // ให้ AI เช็ก (prod เท่านั้น — localhost/ยังไม่ deploy จะรอเจ้าของตรวจ)
    try {
      await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/review-check`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ review_id: id }),
      });
    } catch (e) { /* รอ AI/เจ้าของภายหลัง */ }
    return { ok: true, id };
  }

  // ===== สมาชิกรายเดือน (subscription) =====
  // รายการแพ็กเกจ → array {code,name,price_month,rentals_per_month,max_active,perks}
  async function subPlans() {
    if (CONFIG.USE_MOCK) return [
      { code:'LOOP_WEEK', name:'Loop Week', plan_kind:'base', period:'week', period_label:'รายสัปดาห์', price:390, price_month:390, price_per_month:1560, rentals_per_cycle:1, rentals_per_month:1, rentals_per_month_equiv:4, tiers:['Value','Standard'], tier_label:'ชุดทั่วไป (เดย์ทูเดย์)', save_pct:0, max_active:1, perks:['เช่าได้ 1 ชุดต่อสัปดาห์','เหมาะกับงานเดียว','ส่งฟรี'] },
      { code:'LOOP_LITE', name:'Loop Lite', plan_kind:'base', period:'month', period_label:'รายเดือน', price:690, price_month:690, price_per_month:690, rentals_per_cycle:2, rentals_per_month:2, rentals_per_month_equiv:2, tiers:['Value','Standard'], tier_label:'ชุดทั่วไป (เดย์ทูเดย์)', save_pct:0, max_active:1, perks:['เช่าได้ 2 ชุด/เดือน','ส่งฟรีทุกชุด'] },
      { code:'LOOP_PLUS', name:'Loop Plus', plan_kind:'base', period:'month', period_label:'รายเดือน', price:1390, price_month:1390, price_per_month:1390, rentals_per_cycle:4, rentals_per_month:4, rentals_per_month_equiv:4, tiers:['Value','Standard'], tier_label:'ชุดทั่วไป (เดย์ทูเดย์)', save_pct:0, max_active:1, perks:['เช่าได้ 4 ชุด/เดือน','คิวจองก่อนใคร','สไตลิสต์เลือกให้'] },
      { code:'LOOP_LUXE', name:'Loop Luxe', plan_kind:'base', period:'month', period_label:'รายเดือน', price:2690, price_month:2690, price_per_month:2690, rentals_per_cycle:8, rentals_per_month:8, rentals_per_month_equiv:8, tiers:['Value','Standard'], tier_label:'ชุดทั่วไป + แถม Premium Pass', save_pct:0, max_active:2, perks:['เช่าได้ 8 ชุด/เดือน','ถือพร้อมกัน 2 ชุด','แถม Premium Pass 1 ชิ้น/เดือน'] },
      { code:'LOOP_PLUS_Q', name:'Loop Plus · ราย 3 เดือน', plan_kind:'base', period:'quarter', period_label:'ราย 3 เดือน', price:3790, price_month:3790, price_per_month:1263, rentals_per_cycle:11, rentals_per_month:11, rentals_per_month_equiv:4, tiers:['Value','Standard'], tier_label:'ชุดทั่วไป (เดย์ทูเดย์)', save_pct:9, max_active:1, perks:['เช่าได้ 12 ชุด ใน 3 เดือน','ประหยัด ~10%','สไตลิสต์เลือกให้'] },
      { code:'LOOP_PLUS_Y', name:'Loop Plus · รายปี', plan_kind:'base', period:'year', period_label:'รายปี', price:15000, price_month:15000, price_per_month:1250, rentals_per_cycle:44, rentals_per_month:44, rentals_per_month_equiv:4, tiers:['Value','Standard'], tier_label:'ชุดทั่วไป (เดย์ทูเดย์)', save_pct:10, max_active:1, perks:['เช่าได้ 48 ชุดต่อปี','ประหยัด ~17%','สไตลิสต์ส่วนตัว'] },
      { code:'LOOP_PREMIUM_PASS', name:'Premium Pass', plan_kind:'addon', requires_base:true, rent_days_cap:3, period:'month', period_label:'รายเดือน', price:1990, price_month:1990, price_per_month:1990, rentals_per_cycle:1, rentals_per_month:1, rentals_per_month_equiv:1, tiers:['Premium'], tier_label:'ชุดพรีเมียม/ดีไซเนอร์', save_pct:0, max_active:1, perks:['ปลดล็อกชุด Premium/ดีไซเนอร์ 1 ชิ้น/เดือน','เช่าได้สูงสุด 3 วันต่อชิ้น','ราคาสมาชิก ต่อยอดบนแพ็กหลัก'] },
      { code:'LOOP_PREMIUM_PASS2', name:'Premium Pass ×2', plan_kind:'addon', requires_base:true, rent_days_cap:3, period:'month', period_label:'รายเดือน', price:3490, price_month:3490, price_per_month:3490, rentals_per_cycle:2, rentals_per_month:2, rentals_per_month_equiv:2, tiers:['Premium'], tier_label:'ชุดพรีเมียม/ดีไซเนอร์', save_pct:0, max_active:1, perks:['ปลดล็อกชุด Premium/ดีไซเนอร์ 2 ชิ้น/เดือน','เช่าได้สูงสุด 3 วันต่อชิ้น','คุ้มกว่าซื้อทีละชิ้น'] },
    ];
    const { data } = await client().rpc('sub_plans');
    return data || [];
  }
  // สถานะสมาชิกของฉัน → {active, plan_name, remaining, rentals_per_month, renews_at, ...}
  async function mySubscription(customer) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { active: false };
    const { data } = await window.meRpc('my_subscription', { p_customer: customer.id });
    return data || { active: false };
  }
  // สมัคร/เปลี่ยนแพ็กเกจ
  async function subscribe(customer, planCode) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { ok: true };
    const { data, error } = await window.meRpc('subscribe', { p_customer: customer.id, p_plan: planCode });
    return { ok: !error, data, error };
  }
  // พัก/กลับมา/ยกเลิก  (p_action = pause|resume|cancel)
  async function subSetStatus(customer, action) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { ok: true };
    const { data, error } = await window.meRpc('sub_set_status', { p_customer: customer.id, p_action: action });
    return { ok: !error, data, error };
  }

  // ===== สรุปยอด / มัดจำ / ยืนยันตัวตน / ตะกร้า / แก้ไซส์ =====
  // สรุปยอดเต็ม (ค่าเช่า+มัดจำ+ค่าส่ง+วันส่ง/คืน+total) ตามจำนวนวัน
  async function quote(code, customer, fromStr, toStr, courier, remote) {
    if (CONFIG.USE_MOCK) {
      const f = new Date(fromStr), t = new Date(toStr);
      const days = Math.max(1, Math.round((t - f) / 86400000) + 1);
      const rate = days <= 1 ? 262 : days <= 3 ? 320 : 416;
      const dep = (customer && customer.kyc_verified && (customer.rentals_count|0) > 0) ? 0
                : (customer && customer.kyc_verified) ? rate : 500;
      const ship = (String(courier||'flash')==='ems') ? 60 : (days >= 3 ? 0 : 55) + (remote ? 30 : 0);
      return { code, days, rate, deposit: dep, shipping: ship, total: rate+dep+ship,
        ship_date: fromStr, use_date: fromStr, return_date: toStr,
        kyc_required: !(customer && customer.kyc_verified), free_shipping: ship===0 };
    }
    const { data } = await window.meRpc('quote_rental', {
      p_code: code, p_customer: (customer && customer.id) || null,
      p_from: fromStr, p_to: toStr, p_courier: courier || 'flash', p_remote: !!remote });
    return data || null;
  }
  // สถานะยืนยันตัวตน → {verified, method, has_social}
  async function customerKyc(customer) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { verified: false };
    // gateway me-rpc (กัน IDOR) ถ้าโหลด me-api.js แล้ว · ไม่งั้น fallback ทางเดิม (transition-safe)
    const { data } = window.meRpc
      ? await window.meRpc('customer_kyc', {})
      : await client().rpc('customer_kyc', { p_customer: customer.id });
    return data || { verified: false };
  }
  // ส่งบัตร+โซเชียลยืนยันตัวตน → {ok, status:'verified'|'pending'}
  async function submitKyc(customer, idUrl, social) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { ok: true, status: 'verified' };
    const a = { p_id_url: idUrl || '', p_social: social || '' };
    const { data, error } = window.meRpc
      ? await window.meRpc('submit_kyc', a)
      : await client().rpc('submit_kyc', { p_customer: customer.id, ...a });
    // สำเร็จ = ไม่มี error และไม่ได้คืนโค้ดล้มเหลว ('no_customer'/ว่าง)
    // ทนทุก return contract: 'verified' | 'pending' | 'ok' (เวอร์ชันเก่า) ถือว่าสำเร็จหมด
    const ok = !error && !!data && data !== 'no_customer';
    return { ok, status: data === 'pending' ? 'pending' : 'verified', error };
  }
  // อัปโหลดบัตร ปชช ไป Storage (private-ish bucket 'uploads') → url
  async function uploadIdCard(file) {
    if (CONFIG.USE_MOCK || !file) return '';
    const urls = await uploadPhotos([file]);
    return urls[0] || '';
  }
  // จองหลายชุดในออเดอร์เดียว (ส่งกล่องเดียว)
  async function bookCart(customer, codes, fromStr, toStr, courier, remote) {
    if (CONFIG.USE_MOCK) return { data: { items: codes.map(c => ({ code: c })) } };
    const c = client();
    if (lineUid) await c.from('customer_touchpoints').insert({ line_uid: lineUid, kind:'reserve', detail: { cart: codes } });
    const { data, error } = await window.meRpc('book_cart', { p_customer: (customer && customer.id) || null, p_codes: codes, p_from: fromStr, p_to: toStr, p_courier: courier || 'flash', p_remote: !!remote });
    return { data, error };
  }
  // บันทึก "งานอะไร" ของออเดอร์ (occasion) — ส่งสตริงว่างเพื่อล้างค่า
  async function setRentalOccasion(rentalId, occasion) {
    if (CONFIG.USE_MOCK || !rentalId) return { ok: true, data: { occasion: occasion || null } };
    const { data, error } = await window.meRpc('set_rental_occasion', { p_rental: rentalId, p_occasion: occasion || '' });
    return { ok: !error && !(data && data.error), data, error };
  }
  // ขอแก้ไซส์
  async function addAlteration(rentalId, note) {
    if (CONFIG.USE_MOCK || !rentalId) return { ok: true };
    const a = { p_rental: rentalId, p_note: note };
    const { data, error } = window.meRpc ? await window.meRpc('add_alteration', a) : await client().rpc('add_alteration', a);
    return { ok: !error, data, error };
  }
  // สอบถามเช่ากลุ่มใหญ่
  async function groupInquiry(customer, count, budget, eventDate, note) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { ok: true };
    const { data, error } = await window.meRpc('group_inquiry', { p_customer: customer.id, p_count: count, p_budget: budget || null, p_event_date: eventDate || null, p_note: note || null });
    return { ok: !error, data, error };
  }

  // ===== ครอบครัว / แก๊งเพื่อน — ผูกกลุ่ม + เช่าเข้าตีมพร้อมกัน =====
  // สร้างกลุ่ม (kind: 'family' | 'friends') → { group_id }
  async function createGroup(customer, name, kind) {
    if (CONFIG.USE_MOCK || !customer?.id) return { ok: true };
    const { data, error } = await window.meRpc('create_group', { p_creator: customer.id, p_name: name || '', p_kind: kind || 'family' });
    return { ok: !error, data, error };
  }
  // กลุ่มทั้งหมดของฉัน + สมาชิก
  async function myGroups(customer) {
    if (CONFIG.USE_MOCK || !customer?.id) return { ok: true, data: [] };
    const { data, error } = await window.meRpc('my_groups', { p_customer: customer.id });
    return { ok: !error, data: data || [], error };
  }
  // สมาชิก + ไซส์/ซีซันสี (ไว้จัดสไตล์) — ต้องเป็นสมาชิกกลุ่มจริงถึงดูได้ (PDPA)
  async function groupMembers(groupId, requester) {
    if (CONFIG.USE_MOCK || !groupId || !requester?.id) return { ok: true, data: [] };
    const { data, error } = await window.meRpc('group_members_detail', { p_group: groupId, p_requester: requester.id });
    return { ok: !error, data: data || [], error };
  }
  // ผู้ปกครองสร้างโปรไฟล์เด็ก/ทุกวัย (profile = { name, relation, age_band, birth_year, bust_in, waist_in, hip_in, height_cm, color_season })
  async function addManagedProfile(guardian, groupId, profile) {
    if (CONFIG.USE_MOCK || !guardian?.id || !groupId) return { ok: true };
    const { data, error } = await window.meRpc('add_managed_profile', { p: { guardian: guardian.id, group_id: groupId, ...(profile || {}) } });
    return { ok: !error, data, error };
  }
  // เชิญสมาชิกที่มี LINE เองด้วย link_code (ขอความยินยอม → invited)
  async function groupInvite(groupId, inviter, linkCode, relation) {
    if (CONFIG.USE_MOCK || !groupId || !inviter?.id) return { ok: true };
    const { data, error } = await window.meRpc('group_invite', { p_group: groupId, p_inviter: inviter.id, p_link_code: linkCode, p_relation: relation || null });
    return { ok: !error, data, error };
  }
  // รับ/ปฏิเสธคำเชิญเข้ากลุ่ม
  async function groupRespond(groupId, customer, accept) {
    if (CONFIG.USE_MOCK || !groupId || !customer?.id) return { ok: true };
    const { data, error } = await window.meRpc('group_respond', { p_group: groupId, p_customer: customer.id, p_accept: !!accept });
    return { ok: !error, data, error };
  }
  // AI จัดชุดเข้าตีมทั้งกลุ่ม → { season, occasion, members:[{ name, picks:[...] }] }
  // opts: { season:'autumn'|'winter'|'spring'|'summer', palette:['#hex',...] } — เลือกตีมสีเอง/ตามสถานที่
  async function groupThemeSuggest(groupId, requester, occasion, fromStr, toStr, opts) {
    if (CONFIG.USE_MOCK || !groupId || !requester?.id) return { ok: true, data: null };
    const o = opts || {};
    const { data, error } = await window.meRpc('group_theme_suggest', { p_group: groupId, p_requester: requester.id, p_occasion: occasion || null, p_from: fromStr || null, p_to: toStr || null, p_season: o.season || null, p_palette: o.palette || null });
    return { ok: !error, data, error };
  }
  // จองทั้งกลุ่มในออเดอร์เดียว (assignments = [{ code, wearer }]) → { order_group, total, ... }
  async function bookGroupCart(groupId, assignments, fromStr, toStr, opts) {
    if (CONFIG.USE_MOCK || !groupId) return { ok: true };
    const o = opts || {};
    const { data, error } = await window.meRpc('book_group_cart', { p: {
      group_id: groupId, from: fromStr, to: toStr, assignments: assignments || [],
      courier: o.courier || 'flash', remote: !!o.remote, theme: o.theme || null,
      occasion: o.occasion || null, payer: o.payer || null,
      shipments: o.shipments || null   // ตั้งค่าส่งต่อกล่อง [{parcel,recipient,address,courier,remote}]
    } });
    return { ok: !error, data, error };
  }
  // จองแบบต่างคนต่างจ่าย — เพื่อนแต่ละคนเป็นผู้จ่ายของชุดตัวเอง ส่งไปที่อยู่ตัวเอง
  // assignments=[{code,wearer}] · recipients=[{wearer,recipient,address,courier,remote}]
  async function bookGroupSplit(groupId, assignments, fromStr, toStr, opts) {
    if (CONFIG.USE_MOCK || !groupId) return { ok: true };
    const o = opts || {};
    const { data, error } = await window.meRpc('book_group_split', { p: {
      group_id: groupId, from: fromStr, to: toStr, assignments: assignments || [],
      courier: o.courier || 'flash', remote: !!o.remote, theme: o.theme || null,
      occasion: o.occasion || null, recipients: o.recipients || null
    } });
    return { ok: !error, data, error };
  }
  // จัดการสมาชิกกลุ่ม (lifecycle)
  async function groupLeave(groupId, customer) {
    if (CONFIG.USE_MOCK || !groupId || !customer?.id) return { ok: true };
    const { data, error } = await window.meRpc('group_leave', { p_group: groupId, p_customer: customer.id });
    return { ok: !error, data, error };
  }
  async function groupRemoveMember(groupId, actor, targetId) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await window.meRpc('group_remove_member', { p_group: groupId, p_actor: actor.id, p_target: targetId });
    return { ok: !error, data, error };
  }
  async function groupTransferOwner(groupId, actor, newOwnerId) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await window.meRpc('group_transfer_owner', { p_group: groupId, p_actor: actor.id, p_new_owner: newOwnerId });
    return { ok: !error, data, error };
  }
  async function groupDelete(groupId, actor) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await window.meRpc('group_delete', { p_group: groupId, p_actor: actor.id });
    return { ok: !error, data, error };
  }
  async function groupUpdateMember(groupId, actor, targetId, relation) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await window.meRpc('group_update_member', { p_group: groupId, p_actor: actor.id, p_target: targetId, p_relation: relation || null });
    return { ok: !error, data, error };
  }
  async function groupRename(groupId, actor, name) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await window.meRpc('group_rename', { p_group: groupId, p_actor: actor.id, p_name: name || '' });
    return { ok: !error, data, error };
  }
  // ย้ายโปรไฟล์เด็ก → แอคเคานต์จริง / รวมแอคเคานต์
  async function claimManagedProfile(guardian, managedId, lineUid, displayName) {
    if (CONFIG.USE_MOCK || !guardian?.id || !managedId) return { ok: true };
    const { data, error } = await window.meRpc('claim_managed_profile', { p: { guardian: guardian.id, managed_id: managedId, line_uid: lineUid, display_name: displayName || null } });
    return { ok: !error, data, error };
  }
  async function mergeCustomers(keepId, dropId, actor) {
    if (CONFIG.USE_MOCK || !keepId || !dropId || !actor?.id) return { ok: true };
    const { data, error } = await window.meRpc('merge_customers', { p: { keep: keepId, drop: dropId, actor: actor.id } });
    return { ok: !error, data, error };
  }
  // ลิงก์ชวนเข้ากลุ่ม (แบบ LINE) — ขอ token แล้วประกอบเป็น URL
  async function groupJoinToken(groupId, actor) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true, data: { token: 'demo' } };
    const { data, error } = await window.meRpc('group_join_token', { p_group: groupId, p_actor: actor.id });
    return { ok: !error, data, error };
  }
  // เข้ากลุ่มผ่านลิงก์ (แตะเอง = ยินยอม → active ทันที)
  async function joinGroup(token, customer, relation) {
    if (CONFIG.USE_MOCK || !token || !customer?.id) return { ok: true };
    const { data, error } = await window.meRpc('join_group', { p_token: token, p_customer: customer.id, p_relation: relation || null });
    return { ok: !error, data, error };
  }
  // เพิกถอนลิงก์ชวน (ลิงก์เก่าใช้ไม่ได้อีก)
  async function groupRevokeLink(groupId, actor) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await window.meRpc('group_revoke_link', { p_group: groupId, p_actor: actor.id });
    return { ok: !error, data, error };
  }
  // % ส่วนลดแพคเกจครอบครัวตามจำนวนชุด (ไว้พรีวิวก่อนจอง)
  async function groupDiscountPct(count) {
    if (CONFIG.USE_MOCK) return { ok: true, data: 0 };
    const { data, error } = await client().rpc('group_discount_pct', { p_count: count || 0 });
    return { ok: !error, data: data || 0, error };
  }
  // บิลของออเดอร์ตัวเอง (หน้าจ่ายเงินเพื่อน) — requester ต้องเป็นเจ้าของออเดอร์
  async function groupOrderSummary(orderGroup, requester) {
    if (CONFIG.USE_MOCK || !orderGroup || !requester?.id) return { ok: true, data: null };
    const { data, error } = await window.meRpc('group_order_summary', { p_order: orderGroup, p_requester: requester.id });
    return { ok: !error, data, error };
  }
  // เจ้าของออเดอร์กด "โอนแล้ว" → ปลด hold เป็น reserved
  async function groupPayConfirm(orderGroup, requester) {
    if (CONFIG.USE_MOCK || !orderGroup || !requester?.id) return { ok: true };
    const { data, error } = await window.meRpc('group_pay_confirm', { p_order: orderGroup, p_requester: requester.id });
    return { ok: !error, data, error };
  }
  // สถานะการจ่ายของทั้งอีเวนต์ (dashboard หัวหน้า)
  async function groupEventStatus(eventGroup, requester) {
    if (CONFIG.USE_MOCK || !eventGroup || !requester?.id) return { ok: true, data: null };
    const { data, error } = await window.meRpc('group_event_status', { p_event: eventGroup, p_requester: requester.id });
    return { ok: !error, data, error };
  }
  // privacy: ซ่อน/แสดงรูปโปรไฟล์ของตัวเองในกลุ่ม
  async function setPictureHidden(customer, hidden) {
    if (CONFIG.USE_MOCK || !customer?.id) return { ok: true };
    const { data, error } = await window.meRpc('set_picture_hidden', { p_customer: customer.id, p_hide: !!hidden });
    return { ok: !error, data, error };
  }
  // หน้า landing คำเชิญ: ดูข้อมูลกลุ่มจาก token ก่อนเข้าร่วม (ยังไม่ต้องเป็นสมาชิก)
  async function groupInvitePreview(token) {
    if (CONFIG.USE_MOCK || !token) return { ok: true, data: null };
    const { data, error } = await client().rpc('group_invite_preview', { p_token: token });
    return { ok: !error, data, error };
  }

  // ===== ช่องทางชำระเงิน (โชว์ตอน checkout) — cache ไว้ =====
  let _payInfo;
  async function payInfo() {
    if (CONFIG.USE_MOCK) return null;
    if (_payInfo !== undefined) return _payInfo;
    try { const { data } = await client().rpc('pay_info'); _payInfo = data || null; }
    catch (_e) { _payInfo = null; }
    return _payInfo;
  }

  // ===== ของขวัญวันเกิด =====
  async function birthdayStatus(customer) {
    if (CONFIG.USE_MOCK || !customer?.id) return null;
    try { const { data } = await window.meRpc('birthday_status', { p_customer: customer.id }); return data || null; }
    catch (_e) { return null; }
  }
  async function birthdayReserve(garmentId, customer, fromStr, toStr) {
    if (CONFIG.USE_MOCK) return { ok: true, free: 0, pay: 0 };
    const { data, error } = await window.meRpc('birthday_reserve_dates', { p_customer: customer.id, p_garment: garmentId, p_from: fromStr, p_to: toStr });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: data.error };
    return { ok: true, ...data };
  }

  async function creditExpiry() {
    if (CONFIG.USE_MOCK || !window.meRpc) return null;
    try { const { data } = await window.meRpc('my_credit_expiry', {}); return data || null; }
    catch (_e) { return null; }
  }

  // ===== กล่องแจ้งเตือนในแอป (ผ่าน me-rpc gateway) =====
  async function notifInbox() {
    if (CONFIG.USE_MOCK || !window.meRpc) return [];
    try { const { data } = await window.meRpc('notif_inbox', {}); return Array.isArray(data) ? data : []; }
    catch (_e) { return []; }
  }
  async function notifUnread() {
    if (CONFIG.USE_MOCK || !window.meRpc) return 0;
    try { const { data } = await window.meRpc('notif_unread_count', {}); return Number(data) || 0; }
    catch (_e) { return 0; }
  }
  async function notifMarkRead(id) {
    if (CONFIG.USE_MOCK || !window.meRpc) return;
    try { await window.meRpc('notif_mark_read', id != null ? { p_id: id } : {}); } catch (_e) {}
  }
  async function notifSetPref(marketing) {
    if (CONFIG.USE_MOCK || !window.meRpc) return null;
    try { const { data } = await window.meRpc('notif_set_pref', { p_marketing: !!marketing }); return data || null; }
    catch (_e) { return null; }
  }
  // social proof ต่อชุด (anon อ่านได้ตรง — ไม่มี PII)
  async function socialProof(code) {
    if (CONFIG.USE_MOCK || !code) return null;
    try { const { data } = await client().rpc('garment_social_proof', { p_code: code }); return data || null; }
    catch (_e) { return null; }
  }
  // ===== Phase 3: recommendations / live viewers / streak / A-B =====
  async function recommendWith(code, limit) {
    if (CONFIG.USE_MOCK || !code) return [];
    try { const { data } = await client().rpc('recommend_with', { p_code: code, p_limit: limit || 4 }); return Array.isArray(data) ? data : []; }
    catch (_e) { return []; }
  }
  async function recommendPersonal(limit) {
    if (CONFIG.USE_MOCK || !window.meRpc) return [];
    try { const { data } = await window.meRpc('recommend_personal', { p_limit: limit || 6 }); return Array.isArray(data) ? data : []; }
    catch (_e) { return []; }
  }
  async function liveViewers(code) {
    if (CONFIG.USE_MOCK || !code) return 0;
    try { const { data } = await client().rpc('garment_live_viewers', { p_code: code }); return Number(data) || 0; }
    catch (_e) { return 0; }
  }
  async function myStreak() {
    if (CONFIG.USE_MOCK || !window.meRpc) return 0;
    try { const { data } = await window.meRpc('my_streak', {}); return Number(data) || 0; }
    catch (_e) { return 0; }
  }
  async function myTaste() {
    if (CONFIG.USE_MOCK || !window.meRpc) return null;
    try { const { data } = await window.meRpc('my_taste', {}); return data || null; }
    catch (_e) { return null; }
  }
  // "ดูล่าสุด" (Recently viewed) รายคน — คืน array ของ {code, last_ts}
  async function myRecentlyViewed(limit) {
    if (CONFIG.USE_MOCK || !window.meRpc) return [];
    try { const { data } = await window.meRpc('my_recently_viewed', { p_limit: limit || 12 }); return Array.isArray(data) ? data : []; }
    catch (_e) { return []; }
  }
  async function expVariant(key) {
    if (CONFIG.USE_MOCK || !key) return 'control';
    try { const { data } = await client().rpc('experiment_variant', { p_key: key, p_unit: lineUid || _sid }); return data || 'control'; }
    catch (_e) { return 'control'; }
  }

  // ===== ยกเลิก / เลื่อน / ต่อเวลา — ผ่าน me-rpc gateway เท่านั้น (ownership guard เช็คว่าเป็น rental ของเราจริง) =====
  async function quoteCancellation(rentalId, asCredit = true) {
    if (CONFIG.USE_MOCK || !rentalId || !window.meRpc) return null;
    const { data } = await window.meRpc('quote_cancellation', { p_rental: rentalId, p_as_credit: asCredit });
    return data || null;
  }
  async function cancelRental(rentalId, asCredit = true, reason) {
    if (CONFIG.USE_MOCK || !rentalId || !window.meRpc) return { ok: false };
    const { data, error } = await window.meRpc('cancel_rental', { p_rental: rentalId, p_as_credit: asCredit, p_reason: reason || null });
    if (error || (data && data.error)) return { ok: false, error: error || data.error, data };
    return { ok: true, ...data };
  }
  async function quoteExtension(rentalId, newTo) {
    if (CONFIG.USE_MOCK || !rentalId || !window.meRpc) return null;
    const { data } = await window.meRpc('quote_extension', { p_rental: rentalId, p_new_to: newTo });
    return data || null;
  }
  async function extendRental(rentalId, newTo) {
    if (CONFIG.USE_MOCK || !rentalId || !window.meRpc) return { ok: false };
    const { data, error } = await window.meRpc('extend_rental', { p_rental: rentalId, p_new_to: newTo });
    if (error || (data && data.error)) return { ok: false, error: error || data.error, data };
    return { ok: true, ...data };
  }
  async function rescheduleRental(rentalId, fromStr, toStr, newCode) {
    if (CONFIG.USE_MOCK || !rentalId || !window.meRpc) return { ok: false };
    const { data, error } = await window.meRpc('reschedule_rental', { p_rental: rentalId, p_from: fromStr, p_to: toStr, p_new_code: newCode || null });
    if (error || (data && data.error)) return { ok: false, error: error || data.error, data };
    return { ok: true, ...data };
  }

  // ===== ชุมชน The Loop Looks =====
  // ฟีดชุมชน (อ่านสาธารณะ) — รวมลุคที่แชร์ + รีวิวรูป + UGC · กรองตามโอกาสได้
  async function communityFeed(limit, before, occasion, tag) {
    if (CONFIG.USE_MOCK) return [];
    const { data } = await client().rpc('community_feed', { p_limit: limit || 24, p_before: before || null, p_occasion: occasion || null, p_tag: tag || null });
    return data || [];
  }
  // รายการโอกาส (chips กรองฟีด)
  async function lookOccasions() {
    if (CONFIG.USE_MOCK) return [];
    const { data } = await client().rpc('look_occasions', {});
    return data || [];
  }
  // แฮชแท็กยอดนิยม (chips)
  async function lookTags() {
    if (CONFIG.USE_MOCK) return [];
    const { data } = await client().rpc('look_tags', {});
    return data || [];
  }
  // occasion hubs (แกนค้นพบ — cover + count ต่อโอกาส)
  async function occasionHubs() {
    if (CONFIG.USE_MOCK) return [];
    const { data } = await client().rpc('occasion_hubs', {});
    return data || [];
  }
  // fit summary ของชุด (โชว์ในหน้าเช่า)
  async function garmentFit(code) {
    if (CONFIG.USE_MOCK || !code) return null;
    const { data } = await client().rpc('garment_fit_from_looks', { p_code: code });
    return data || null;
  }
  // โปรไฟล์ครีเอเตอร์สาธารณะ (ค้นด้วย handle/link_code)
  async function creatorProfile(handle) {
    if (CONFIG.USE_MOCK || !handle) return { found: false };
    const { data } = await client().rpc('creator_profile', { p_handle: handle });
    return data || { found: false };
  }
  // โปรไฟล์ครีเอเตอร์ของฉัน (ผ่าน gateway)
  async function myCreator() {
    if (CONFIG.USE_MOCK || !window.meRpc) return null;
    const { data } = await window.meRpc('my_creator', {});
    return data || null;
  }
  // dashboard รายได้ครีเอเตอร์
  async function myCreatorEarnings() {
    if (CONFIG.USE_MOCK || !window.meRpc) return null;
    const { data } = await window.meRpc('my_creator_earnings', {});
    return data || null;
  }
  // ตั้ง handle/bio/ความเป็นสาธารณะ
  async function setHandle(handle, bio, isPublic) {
    if (CONFIG.USE_MOCK || !window.meRpc) return { ok: false };
    const { data, error } = await window.meRpc('set_handle', { p_handle: handle || null, p_bio: bio ?? null, p_public: (typeof isPublic === 'boolean') ? isPublic : null });
    return error ? { ok: false, error } : (data || { ok: false });
  }
  // แชร์ลุค: อัปโหลดรูป → สร้าง look (pending) → ทริกเกอร์ AI moderation (look-audit)
  // files = อาเรย์รูป (รูปแรก = ปก, ที่เหลือ = extra สำหรับ before/after, 3 ways) · fit = {height,size,fit} · tpl = single|before_after|styles
  async function shareLook(garmentCode, files, caption, occasion, rentalId, crosspost, fit, tpl) {
    if (CONFIG.USE_MOCK || !window.meRpc) return { ok: false };
    const arr = Array.isArray(files) ? files : [files];
    let urls = [];
    try { urls = await uploadPhotos(arr.filter(Boolean)); } catch (e) { /**/ }
    if (!urls.length) return { ok: false, error: 'upload_failed' };
    const { data, error } = await window.meRpc('share_look', { p_garment_code: garmentCode, p_photo_url: urls[0], p_caption: caption || null, p_occasion: occasion || null, p_rental: rentalId || null, p_crosspost: !!crosspost, p_height: (fit && fit.height) || null, p_size: (fit && fit.size) || null, p_fit: (fit && fit.fit) || null, p_template: tpl || 'single', p_extra: urls.slice(1) });
    if (error || !data || !data.look_id) return { ok: false, error: error || 'share_failed' };
    // ตรวจด้วย AI (auto-publish ถ้าผ่าน) — best-effort, ไม่บล็อก UX
    let idToken = null; try { idToken = window.liff && liff.getIDToken && liff.getIDToken(); } catch (e) {}
    try {
      await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/look-audit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken, look_id: data.look_id }),
      });
    } catch (e) { /* ฝั่ง server จะตรวจเองตอน cron/owner */ }
    return { ok: true, look_id: data.look_id };
  }
  // log ว่ามาจากลุคไหน (attribution ส่วนแบ่งครีเอเตอร์)
  async function logLookView(lookId, garmentCode) {
    if (CONFIG.USE_MOCK || !lineUid || !lookId) return;
    try { await client().from('customer_touchpoints').insert({ line_uid: lineUid, kind: 'look_view', detail: { look: lookId, garment: garmentCode || null } }); } catch (e) { /**/ }
  }
  // log ว่ามาจากโค้ด/ลิงก์ชวนเช่าของครีเอเตอร์ (?ref=handle) — affiliate นอกแอป
  async function logRef(ref, garmentCode) {
    if (CONFIG.USE_MOCK || !lineUid || !ref) return;
    try { await client().from('customer_touchpoints').insert({ line_uid: lineUid, kind: 'creator_ref', detail: { ref: String(ref).toLowerCase(), garment: garmentCode || null } }); } catch (e) { /**/ }
  }
  // ===== Phase 2: like / comment / follow / leaderboard =====
  async function toggleLike(lookId) {
    if (CONFIG.USE_MOCK || !window.meRpc) return null;
    const { data } = await window.meRpc('toggle_like', { p_look: lookId });
    return data || null;
  }
  async function myLikes() {
    if (CONFIG.USE_MOCK || !window.meRpc) return [];
    const { data } = await window.meRpc('my_likes', {});
    return data || [];
  }
  async function addComment(lookId, body, parentId) {
    if (CONFIG.USE_MOCK || !window.meRpc) return { ok: false };
    const { data, error } = await window.meRpc('add_comment', { p_look: lookId, p_body: body, p_parent: parentId || null });
    const res = error ? { ok: false, error } : (data || { ok: false });
    // AI moderation ชั้นสอง (ถ้า keyword ไม่ได้ซ่อนไว้แล้ว) — best-effort, ไม่บล็อก UX
    if (res.ok && res.id && !res.hidden) {
      let idToken = null; try { idToken = window.liff && liff.getIDToken && liff.getIDToken(); } catch (e) {}
      try {
        await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/comment-audit`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken, comment_id: res.id }),
        });
      } catch (e) { /* เงียบ */ }
    }
    return res;
  }
  async function lookComments(lookId) {
    if (CONFIG.USE_MOCK) return [];
    const { data } = await client().rpc('look_comments', { p_look: lookId, p_limit: 50 });
    return data || [];
  }
  async function toggleFollow(handle) {
    if (CONFIG.USE_MOCK || !window.meRpc) return null;
    const { data } = await window.meRpc('toggle_follow', { p_handle: handle });
    return data || null;
  }
  async function myFollowing() {
    if (CONFIG.USE_MOCK || !window.meRpc) return [];
    const { data } = await window.meRpc('my_following', {});
    return data || [];
  }
  async function followingFeed(limit) {
    if (CONFIG.USE_MOCK || !window.meRpc) return [];
    const { data } = await window.meRpc('following_feed', { p_limit: limit || 24 });
    return data || [];
  }
  async function leaderboard(metric, limit) {
    if (CONFIG.USE_MOCK) return [];
    const { data } = await client().rpc('leaderboard', { p_metric: metric || 'rented', p_limit: limit || 20 });
    return data || [];
  }
  // bookmark ลุค
  async function toggleSave(lookId) {
    if (CONFIG.USE_MOCK || !window.meRpc) return null;
    const { data } = await window.meRpc('toggle_save', { p_look: lookId });
    return data || null;
  }
  async function mySaves() {
    if (CONFIG.USE_MOCK || !window.meRpc) return [];
    const { data } = await window.meRpc('my_saves', {});
    return data || [];
  }
  async function savedFeed(limit) {
    if (CONFIG.USE_MOCK || !window.meRpc) return [];
    const { data } = await window.meRpc('saved_feed', { p_limit: limit || 30 });
    return data || [];
  }
  async function reportLook(lookId, reason) {
    if (CONFIG.USE_MOCK || !window.meRpc) return { ok: false };
    const { data, error } = await window.meRpc('report_look', { p_look: lookId, p_reason: reason || null });
    return error ? { ok: false, error } : (data || { ok: false });
  }
  async function reactLook(lookId, reaction) {
    if (CONFIG.USE_MOCK || !window.meRpc) return null;
    const { data } = await window.meRpc('react_look', { p_look: lookId, p_reaction: reaction });
    return data || null;
  }
  async function lookReactions(lookId) {
    if (CONFIG.USE_MOCK) return {};
    const { data } = await client().rpc('look_reaction_counts', { p_look: lookId });
    return data || {};
  }

  return { init, reserve, saveProfile, claimStyleCode, startPersonalColor, pcStatus, stylistDirectory, stylistPublic, pcBookSlot, myAppointments, pcCancelAppointment, stylist, rankBackups, resolvePlace, stylistQuota, availableOn, availableSetOn, availableRange, bookedRanges, reserveDates, getTerms, acceptTerms, bookWithBackups, payWithCredit, myImpact, myWallet, recentCharity, hairStyle, myRentals, setRentalOccasion, toggleWishlist, myWishlist, joinWaitlist, leaveWaitlist, myWaitlist, waitlistCount, trendingRequests, voteRequest, addReview, garmentRating, garmentReviewPhotos, garmentUgcPhotos, uploadPhotos, ensureReferralCode, applyReferral, submitVideoReview, subPlans, mySubscription, subscribe, subSetStatus, quote, customerKyc, submitKyc, uploadIdCard, bookCart, addAlteration, groupInquiry, createGroup, myGroups, groupMembers, addManagedProfile, groupInvite, groupRespond, groupThemeSuggest, bookGroupCart, groupLeave, groupRemoveMember, groupTransferOwner, groupDelete, groupUpdateMember, groupRename, claimManagedProfile, mergeCustomers, groupJoinToken, joinGroup, groupRevokeLink, groupDiscountPct, bookGroupSplit, groupOrderSummary, groupPayConfirm, groupEventStatus, setPictureHidden, groupInvitePreview, payInfo, birthdayStatus, birthdayReserve, creditExpiry, notifInbox, notifUnread, notifMarkRead, notifSetPref, socialProof, recommendWith, recommendPersonal, liveViewers, myStreak, myTaste, myRecentlyViewed, expVariant, quoteCancellation, cancelRental, quoteExtension, extendRental, rescheduleRental, communityFeed, lookOccasions, lookTags, creatorProfile, myCreator, setHandle, shareLook, logLookView, logRef, toggleLike, myLikes, addComment, lookComments, toggleFollow, myFollowing, followingFeed, leaderboard, toggleSave, mySaves, savedFeed, reportLook, reactLook, lookReactions, occasionHubs, garmentFit, myCreatorEarnings };
})();
