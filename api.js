// ===== Data layer — Supabase จริง หรือ mock (ตาม CONFIG.USE_MOCK) =====
window.API = (function () {
  let sb = null; // supabase client
  let lineUid = null; // เก็บ UID ไว้ใช้ remarketing

  function client() {
    if (!sb) sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    return sb;
  }

  // map garment row (DB) รูปการ์ดหน้าเว็บ
  function mapGarment(r) {
    return {
      id: r.id, code: r.code, name: r.name || r.code, brand: r.brand, tier: r.tier, price: r.rental_price, category: r.category,
      timesRented: r.times_rented ?? 0,
      styling_tips: r.styling_tips || [],
      fabric: r.fabric_composition, stretch: r.stretch ||'none',
      lining: r.has_lining, sheer: r.is_sheer, weight: r.fabric_weight,
      bust: (r.bust_min_in!= null)? [r.bust_min_in, r.bust_max_in] : null,
      waist: (r.waist_min_in!= null)? [r.waist_min_in, r.waist_max_in] : null,
      hip: r.hip_in, length: r.length_cm,
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
      const { data } = await c.from('customers').select('*').eq('line_uid', lineUid).single();
      if (data) customer = data;
      // สร้าง/ดึงรหัสนัดสไตลิสต์ (ให้พาร์ทเนอร์ค้นเจอ)
      if (customer.id &&!customer.link_code) {
        const { data: code } = await c.rpc('ensure_link_code', { p_customer: customer.id });
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
    return { OCCASIONS: window.MOCK.OCCASIONS, CUSTOMER: customer, EVENT: event, GARMENTS: garments, lineUid };
  }

  async function reserve(garmentId, customer) {
    if (CONFIG.USE_MOCK) return { ok: true };
    const c = client();
    // log touchpoint สำหรับ remarketing (สนใจชุดนี้)
    if (lineUid) await c.from('customer_touchpoints').insert(
      { line_uid: lineUid, kind:'reserve', detail: { garment_id: garmentId } });
    // จองจริงควรทำใน Edge Function (transaction กันจองชน) — ที่นี่เรียกผ่าน RPC
    const { data, error } = await c.rpc('reserve_garment', { p_garment: garmentId, p_customer: customer.id });
    return { ok:!error, data, error };
  }

  async function saveProfile(customer) {
    if (CONFIG.USE_MOCK ||!lineUid) return { ok: true };
    const c = client();
    const { error } = await c.from('customers').update({
      display_name: customer.name, height_cm: customer.height_cm, shoe_size: customer.shoe_size,
      bust_in: customer.bust_in, waist_in: customer.waist_in, hip_in: customer.hip_in,
      my_color_season: customer.my_color_season, notes: customer.notes,
      phone: customer.phone, address: customer.address,
      weight_kg: customer.weight_kg, size: customer.size, prefs: customer.prefs,
    }).eq('line_uid', lineUid);
    return { ok:!error, error };
  }

  // AI Stylist — รับชื่อสถานที่ใดก็ได้ dress code + สีที่ถ่ายรูปสวย
  async function stylist(venue, season, occasion, lang) {
    if (!CONFIG.USE_MOCK) {
      const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/stylist`, {
        method:'POST',
        headers: {'Content-Type':'application/json', Authorization:`Bearer ${CONFIG.SUPABASE_ANON_KEY}`},
        body: JSON.stringify({ venue, season, occasion, lang }),
      });
      if (r.ok) return await r.json();
    }
    // mock — จับคู่ประเภทที่รู้จัก หรือคืนคำแนะนำกลาง ๆ (ของจริงจะเป็น AI วิเคราะห์ชื่อเจาะจง)
    const q = (venue ||'').toLowerCase();
    const v = (window.MOCK.VENUES || []).find(x => x.match.some(m => q.includes(m.toLowerCase())));
    if (v) return {
      venue_type: v.venue_type, dress_code_th: v.dress_code, occasion: v.occasion,
      recommended_colors: v.colors.map(h => ({ hex: h, name:''})),
      photo_tip: v.photo_tip, avoid: v.avoid, note: v.note,
    };
    return {
      venue_type:'สถานที่ของคุณ', dress_code_th:'สมาร์ทแคชชวล', occasion: null,
      recommended_colors: [{ hex:'#15233F', name:'navy'}, { hex:'#9FB7AC', name:'sage'}, { hex:'#B8A179', name:'champagne'}],
      photo_tip:'โทนสุภาพ เข้าได้หลายบรรยากาศ ถ่ายรูปดูดี',
      avoid:'สีสะท้อนแสงจัด', note:'เปิด AI จริง (deploy) เพื่อวิเคราะห์ชื่อสถานที่แบบเจาะจง',
    };
  }

  // เช็กชุดว่างในวันที่กำหนด
  async function availableOn(garmentId, dateStr) {
    if (CONFIG.USE_MOCK) return true;
    const { data } = await client().rpc('garment_available_on', { p_garment: garmentId, p_date: dateStr });
    return data!== false;
  }
  // ชุดที่ว่างทั้งหมดในวันเดียว (กรองหน้าแรก) → Set ของ id (null = ถือว่าว่างหมด/mock)
  async function availableSetOn(dateStr) {
    if (CONFIG.USE_MOCK) return null;
    const { data } = await client().rpc('available_garments_on', { p_date: dateStr });
    return new Set((data || []).map(x => (x && x.id) ? x.id : x));
  }
  // ช่วงวันที่ถูกจองของชุด (สำหรับปฏิทินในรายละเอียด)
  async function bookedRanges(garmentId) {
    if (CONFIG.USE_MOCK) return [];
    const { data } = await client().rpc('garment_booked_ranges', { p_garment: garmentId });
    return data || [];
  }
  // จองตามช่วงวัน (กันจองชนวันเดียวกัน)
  async function reserveDates(garmentId, customer, fromStr, toStr) {
    if (CONFIG.USE_MOCK) return { ok: true };
    const c = client();
    if (lineUid) await c.from('customer_touchpoints').insert({ line_uid: lineUid, kind:'reserve', detail: { garment_id: garmentId, from: fromStr } });
    const { data, error } = await c.rpc('reserve_garment_dates', { p_garment: garmentId, p_customer: customer.id || null, p_from: fromStr, p_to: toStr });
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
    await client().rpc('accept_terms', { p_customer: customer.id, p_version: version });
  }
  // จองพร้อมชุดสำรอง 2 ตัว
  async function bookWithBackups(customer, primaryCode, fromStr, toStr) {
    if (CONFIG.USE_MOCK) return { data: { primary: { code: primaryCode }, backups: [] } };
    const c = client();
    if (lineUid) await c.from('customer_touchpoints').insert({ line_uid: lineUid, kind:'reserve', detail: { garment: primaryCode } });
    const { data, error } = await c.rpc('book_with_backups', { p_customer: customer.id || null, p_primary_code: primaryCode, p_from: fromStr, p_to: toStr, p_backups: null });
    return { data, error };
  }
  // อิมแพกต์รักษ์โลกของฉัน
  async function myImpact(customer) {
    if (CONFIG.USE_MOCK ||!customer.id) return null;
    const { data } = await client().rpc('my_impact', { p_customer: customer.id });
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
    const { data } = await client().rpc('my_rentals', { p_customer: customer.id });
    return data || [];
  }
  // กดหัวใจ — สลับสถานะ wishlist (true = เพิ่งเพิ่ม)
  async function toggleWishlist(customer, garmentId) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return null;
    const { data } = await client().rpc('toggle_wishlist', { p_customer: customer.id, p_garment: garmentId });
    return data === true;
  }
  // รายการ wishlist ของฉัน → Set ของ garment id
  async function myWishlist(customer) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return new Set();
    const { data } = await client().rpc('my_wishlist', { p_customer: customer.id });
    return new Set((data || []).map(x => (x && x.id) ? x.id : x));
  }
  // เพิ่มรีวิวหลังคืนชุด
  async function addReview(rentalId, rating, fit, comment, photos) {
    if (CONFIG.USE_MOCK || !rentalId) return null;
    const { data, error } = await client().rpc('add_review', {
      p_rental: rentalId, p_rating: rating, p_fit: fit, p_comment: comment || null, p_photos: photos || null,
    });
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
    const { data } = await client().rpc('ensure_referral_code', { p_customer: customer.id });
    return data || null;
  }
  // ใส่โค้ดเพื่อนที่ชวนเรา → 'ok' | 'self' | 'used' | 'not_found'
  async function applyReferral(customer, code) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return 'not_found';
    const { data } = await client().rpc('apply_referral', { p_customer: customer.id, p_code: code });
    return data || 'not_found';
  }
  // คลิปรีวิว → บันทึก + ส่งให้ AI เช็ก (ได้เครดิตเมื่อรีวิวเป็นบวก)
  async function submitVideoReview(rentalId, rating, fit, comment, videoUrl, platform, reviewText) {
    if (CONFIG.USE_MOCK || !rentalId) return { ok: false };
    const c = client();
    const { data: id, error } = await c.rpc('submit_video_review', {
      p_rental: rentalId, p_rating: rating, p_fit: fit, p_comment: comment || null,
      p_video_url: videoUrl, p_platform: platform || null, p_review_text: reviewText || null,
    });
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
      { code:'LOOPER_WEEK', name:'Looper Week', period:'week', period_label:'รายสัปดาห์', price:390, price_month:390, price_per_month:1560, rentals_per_cycle:1, rentals_per_month:1, save_pct:0, max_active:1, perks:['เช่าได้ 1 ชุดต่อสัปดาห์','เหมาะกับงานเดียว','ส่งฟรี'] },
      { code:'LOOPER_LITE', name:'Looper Lite', period:'month', period_label:'รายเดือน', price:690, price_month:690, price_per_month:690, rentals_per_cycle:2, rentals_per_month:2, save_pct:0, max_active:1, perks:['เช่าได้ 2 ชุด/เดือน','ส่งฟรีทุกชุด'] },
      { code:'LOOPER_PLUS', name:'Looper Plus', period:'month', period_label:'รายเดือน', price:1290, price_month:1290, price_per_month:1290, rentals_per_cycle:4, rentals_per_month:4, save_pct:0, max_active:1, perks:['เช่าได้ 4 ชุด/เดือน','คิวจองก่อนใคร','สไตลิสต์เลือกให้'] },
      { code:'LOOPER_LUXE', name:'Looper Luxe', period:'month', period_label:'รายเดือน', price:2390, price_month:2390, price_per_month:2390, rentals_per_cycle:8, rentals_per_month:8, save_pct:0, max_active:2, perks:['เช่าได้ 8 ชุด/เดือน','ถือพร้อมกัน 2 ชุด','ชุดดีไซเนอร์'] },
      { code:'LOOPER_PLUS_Q', name:'Looper Plus · ราย 3 เดือน', period:'quarter', period_label:'ราย 3 เดือน', price:3490, price_month:3490, price_per_month:1163, rentals_per_cycle:12, rentals_per_month:12, save_pct:10, max_active:1, perks:['เช่าได้ 12 ชุด ใน 3 เดือน','ประหยัด ~10%','สไตลิสต์เลือกให้'] },
      { code:'LOOPER_PLUS_Y', name:'Looper Plus · รายปี', period:'year', period_label:'รายปี', price:12900, price_month:12900, price_per_month:1075, rentals_per_cycle:48, rentals_per_month:48, save_pct:17, max_active:1, perks:['เช่าได้ 48 ชุดต่อปี','ประหยัด ~17%','สไตลิสต์ส่วนตัว'] },
    ];
    const { data } = await client().rpc('sub_plans');
    return data || [];
  }
  // สถานะสมาชิกของฉัน → {active, plan_name, remaining, rentals_per_month, renews_at, ...}
  async function mySubscription(customer) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { active: false };
    const { data } = await client().rpc('my_subscription', { p_customer: customer.id });
    return data || { active: false };
  }
  // สมัคร/เปลี่ยนแพ็กเกจ
  async function subscribe(customer, planCode) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { ok: true };
    const { data, error } = await client().rpc('subscribe', { p_customer: customer.id, p_plan: planCode });
    return { ok: !error, data, error };
  }
  // พัก/กลับมา/ยกเลิก  (p_action = pause|resume|cancel)
  async function subSetStatus(customer, action) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { ok: true };
    const { data, error } = await client().rpc('sub_set_status', { p_customer: customer.id, p_action: action });
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
    const { data } = await client().rpc('quote_rental', {
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
    return { ok: !error && (data === 'verified' || data === 'pending'), status: data, error };
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
    const { data, error } = await c.rpc('book_cart', { p_customer: (customer && customer.id) || null, p_codes: codes, p_from: fromStr, p_to: toStr, p_courier: courier || 'flash', p_remote: !!remote });
    return { data, error };
  }
  // ขอแก้ไซส์
  async function addAlteration(rentalId, note) {
    if (CONFIG.USE_MOCK || !rentalId) return { ok: true };
    const { data, error } = await client().rpc('add_alteration', { p_rental: rentalId, p_note: note });
    return { ok: !error, data, error };
  }
  // สอบถามเช่ากลุ่มใหญ่
  async function groupInquiry(customer, count, budget, eventDate, note) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { ok: true };
    const { data, error } = await client().rpc('group_inquiry', { p_customer: customer.id, p_count: count, p_budget: budget || null, p_event_date: eventDate || null, p_note: note || null });
    return { ok: !error, data, error };
  }

  return { init, reserve, saveProfile, stylist, availableOn, availableSetOn, bookedRanges, reserveDates, getTerms, acceptTerms, bookWithBackups, myImpact, recentCharity, hairStyle, myRentals, toggleWishlist, myWishlist, addReview, garmentRating, garmentReviewPhotos, uploadPhotos, ensureReferralCode, applyReferral, submitVideoReview, subPlans, mySubscription, subscribe, subSetStatus, quote, customerKyc, submitKyc, uploadIdCard, bookCart, addAlteration, groupInquiry };
})();
