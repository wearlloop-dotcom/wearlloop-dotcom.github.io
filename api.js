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
      photo: (Array.isArray(r.photos) && r.photos[0]) || r.photo || null,
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
      // อ่านโปรไฟล์ของตัวเองผ่าน me-rpc (verify LINE idToken) — กัน anon อ่าน PII ลูกค้าทุกแถว (R-1)
      const { data } = window.meRpc
        ? await window.meRpc('me_profile', {})
        : await c.from('customers').select('*').eq('line_uid', lineUid).single();
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
    // 5) ส่วนลดพนักงาน (ถ้า line_uid ตรงกับพนักงาน → % > 0) — ใช้โชว์ราคาพนักงานตอนไถดู
    let staff_pct = 0;
    if (customer.id) {
      try { const { data: sp } = await c.rpc('staff_discount_pct', { p_customer: customer.id });
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
      weight_kg: customer.weight_kg, size: customer.size, prefs: customer.prefs, birthday: customer.birthday || null,
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
      { code:'LOOPER_WEEK', name:'Looper Week', period:'week', period_label:'รายสัปดาห์', price:390, price_month:390, price_per_month:1560, rentals_per_cycle:1, rentals_per_month:1, rentals_per_month_equiv:4, tiers:['Value','Standard'], tier_label:'ชุดทั่วไป (เดย์ทูเดย์)', save_pct:0, max_active:1, perks:['เช่าได้ 1 ชุดต่อสัปดาห์','เหมาะกับงานเดียว','ส่งฟรี'] },
      { code:'LOOPER_LITE', name:'Looper Lite', period:'month', period_label:'รายเดือน', price:690, price_month:690, price_per_month:690, rentals_per_cycle:2, rentals_per_month:2, rentals_per_month_equiv:2, tiers:['Value','Standard'], tier_label:'ชุดทั่วไป (เดย์ทูเดย์)', save_pct:0, max_active:1, perks:['เช่าได้ 2 ชุด/เดือน','ส่งฟรีทุกชุด'] },
      { code:'LOOPER_PLUS', name:'Looper Plus', period:'month', period_label:'รายเดือน', price:1390, price_month:1390, price_per_month:1390, rentals_per_cycle:4, rentals_per_month:4, rentals_per_month_equiv:4, tiers:['Value','Standard','Premium'], tier_label:'ทุกประเภท รวมพรีเมียม', save_pct:0, max_active:1, perks:['เช่าได้ 4 ชุด/เดือน','คิวจองก่อนใคร','สไตลิสต์เลือกให้'] },
      { code:'LOOPER_LUXE', name:'Looper Luxe', period:'month', period_label:'รายเดือน', price:2690, price_month:2690, price_per_month:2690, rentals_per_cycle:8, rentals_per_month:8, rentals_per_month_equiv:8, tiers:['Value','Standard','Premium'], tier_label:'ทุกประเภท รวมดีไซเนอร์', save_pct:0, max_active:2, perks:['เช่าได้ 8 ชุด/เดือน','ถือพร้อมกัน 2 ชุด','ชุดดีไซเนอร์'] },
      { code:'LOOPER_PLUS_Q', name:'Looper Plus · ราย 3 เดือน', period:'quarter', period_label:'ราย 3 เดือน', price:3790, price_month:3790, price_per_month:1263, rentals_per_cycle:11, rentals_per_month:11, rentals_per_month_equiv:4, tiers:['Value','Standard','Premium'], tier_label:'ทุกประเภท รวมพรีเมียม', save_pct:9, max_active:1, perks:['เช่าได้ 12 ชุด ใน 3 เดือน','ประหยัด ~10%','สไตลิสต์เลือกให้'] },
      { code:'LOOPER_PLUS_Y', name:'Looper Plus · รายปี', period:'year', period_label:'รายปี', price:15000, price_month:15000, price_per_month:1250, rentals_per_cycle:44, rentals_per_month:44, rentals_per_month_equiv:4, tiers:['Value','Standard','Premium'], tier_label:'ทุกประเภท รวมพรีเมียม', save_pct:10, max_active:1, perks:['เช่าได้ 48 ชุดต่อปี','ประหยัด ~17%','สไตลิสต์ส่วนตัว'] },
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
    const a = { p_rental: rentalId, p_note: note };
    const { data, error } = window.meRpc ? await window.meRpc('add_alteration', a) : await client().rpc('add_alteration', a);
    return { ok: !error, data, error };
  }
  // สอบถามเช่ากลุ่มใหญ่
  async function groupInquiry(customer, count, budget, eventDate, note) {
    if (CONFIG.USE_MOCK || !customer || !customer.id) return { ok: true };
    const { data, error } = await client().rpc('group_inquiry', { p_customer: customer.id, p_count: count, p_budget: budget || null, p_event_date: eventDate || null, p_note: note || null });
    return { ok: !error, data, error };
  }

  // ===== ครอบครัว / แก๊งเพื่อน — ผูกกลุ่ม + เช่าเข้าตีมพร้อมกัน =====
  // สร้างกลุ่ม (kind: 'family' | 'friends') → { group_id }
  async function createGroup(customer, name, kind) {
    if (CONFIG.USE_MOCK || !customer?.id) return { ok: true };
    const { data, error } = await client().rpc('create_group', { p_creator: customer.id, p_name: name || '', p_kind: kind || 'family' });
    return { ok: !error, data, error };
  }
  // กลุ่มทั้งหมดของฉัน + สมาชิก
  async function myGroups(customer) {
    if (CONFIG.USE_MOCK || !customer?.id) return { ok: true, data: [] };
    const { data, error } = await client().rpc('my_groups', { p_customer: customer.id });
    return { ok: !error, data: data || [], error };
  }
  // สมาชิก + ไซซ์/ซีซันสี (ไว้จัดสไตล์) — ต้องเป็นสมาชิกกลุ่มจริงถึงดูได้ (PDPA)
  async function groupMembers(groupId, requester) {
    if (CONFIG.USE_MOCK || !groupId || !requester?.id) return { ok: true, data: [] };
    const { data, error } = await client().rpc('group_members_detail', { p_group: groupId, p_requester: requester.id });
    return { ok: !error, data: data || [], error };
  }
  // ผู้ปกครองสร้างโปรไฟล์เด็ก/ทุกวัย (profile = { name, relation, age_band, birth_year, bust_in, waist_in, hip_in, height_cm, color_season })
  async function addManagedProfile(guardian, groupId, profile) {
    if (CONFIG.USE_MOCK || !guardian?.id || !groupId) return { ok: true };
    const { data, error } = await client().rpc('add_managed_profile', { p: { guardian: guardian.id, group_id: groupId, ...(profile || {}) } });
    return { ok: !error, data, error };
  }
  // เชิญสมาชิกที่มี LINE เองด้วย link_code (ขอความยินยอม → invited)
  async function groupInvite(groupId, inviter, linkCode, relation) {
    if (CONFIG.USE_MOCK || !groupId || !inviter?.id) return { ok: true };
    const { data, error } = await client().rpc('group_invite', { p_group: groupId, p_inviter: inviter.id, p_link_code: linkCode, p_relation: relation || null });
    return { ok: !error, data, error };
  }
  // รับ/ปฏิเสธคำเชิญเข้ากลุ่ม
  async function groupRespond(groupId, customer, accept) {
    if (CONFIG.USE_MOCK || !groupId || !customer?.id) return { ok: true };
    const { data, error } = await client().rpc('group_respond', { p_group: groupId, p_customer: customer.id, p_accept: !!accept });
    return { ok: !error, data, error };
  }
  // AI จัดชุดเข้าตีมทั้งกลุ่ม → { season, occasion, members:[{ name, picks:[...] }] }
  async function groupThemeSuggest(groupId, requester, occasion, fromStr, toStr) {
    if (CONFIG.USE_MOCK || !groupId || !requester?.id) return { ok: true, data: null };
    const { data, error } = await client().rpc('group_theme_suggest', { p_group: groupId, p_requester: requester.id, p_occasion: occasion || null, p_from: fromStr || null, p_to: toStr || null });
    return { ok: !error, data, error };
  }
  // จองทั้งกลุ่มในออเดอร์เดียว (assignments = [{ code, wearer }]) → { order_group, total, ... }
  async function bookGroupCart(groupId, assignments, fromStr, toStr, opts) {
    if (CONFIG.USE_MOCK || !groupId) return { ok: true };
    const o = opts || {};
    const { data, error } = await client().rpc('book_group_cart', { p: {
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
    const { data, error } = await client().rpc('book_group_split', { p: {
      group_id: groupId, from: fromStr, to: toStr, assignments: assignments || [],
      courier: o.courier || 'flash', remote: !!o.remote, theme: o.theme || null,
      occasion: o.occasion || null, recipients: o.recipients || null
    } });
    return { ok: !error, data, error };
  }
  // จัดการสมาชิกกลุ่ม (lifecycle)
  async function groupLeave(groupId, customer) {
    if (CONFIG.USE_MOCK || !groupId || !customer?.id) return { ok: true };
    const { data, error } = await client().rpc('group_leave', { p_group: groupId, p_customer: customer.id });
    return { ok: !error, data, error };
  }
  async function groupRemoveMember(groupId, actor, targetId) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await client().rpc('group_remove_member', { p_group: groupId, p_actor: actor.id, p_target: targetId });
    return { ok: !error, data, error };
  }
  async function groupTransferOwner(groupId, actor, newOwnerId) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await client().rpc('group_transfer_owner', { p_group: groupId, p_actor: actor.id, p_new_owner: newOwnerId });
    return { ok: !error, data, error };
  }
  async function groupDelete(groupId, actor) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await client().rpc('group_delete', { p_group: groupId, p_actor: actor.id });
    return { ok: !error, data, error };
  }
  async function groupUpdateMember(groupId, actor, targetId, relation) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await client().rpc('group_update_member', { p_group: groupId, p_actor: actor.id, p_target: targetId, p_relation: relation || null });
    return { ok: !error, data, error };
  }
  async function groupRename(groupId, actor, name) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await client().rpc('group_rename', { p_group: groupId, p_actor: actor.id, p_name: name || '' });
    return { ok: !error, data, error };
  }
  // ย้ายโปรไฟล์เด็ก → แอคเคานต์จริง / รวมแอคเคานต์
  async function claimManagedProfile(guardian, managedId, lineUid, displayName) {
    if (CONFIG.USE_MOCK || !guardian?.id || !managedId) return { ok: true };
    const { data, error } = await client().rpc('claim_managed_profile', { p: { guardian: guardian.id, managed_id: managedId, line_uid: lineUid, display_name: displayName || null } });
    return { ok: !error, data, error };
  }
  async function mergeCustomers(keepId, dropId, actor) {
    if (CONFIG.USE_MOCK || !keepId || !dropId || !actor?.id) return { ok: true };
    const { data, error } = await client().rpc('merge_customers', { p: { keep: keepId, drop: dropId, actor: actor.id } });
    return { ok: !error, data, error };
  }
  // ลิงก์ชวนเข้ากลุ่ม (แบบ LINE) — ขอ token แล้วประกอบเป็น URL
  async function groupJoinToken(groupId, actor) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true, data: { token: 'demo' } };
    const { data, error } = await client().rpc('group_join_token', { p_group: groupId, p_actor: actor.id });
    return { ok: !error, data, error };
  }
  // เข้ากลุ่มผ่านลิงก์ (แตะเอง = ยินยอม → active ทันที)
  async function joinGroup(token, customer, relation) {
    if (CONFIG.USE_MOCK || !token || !customer?.id) return { ok: true };
    const { data, error } = await client().rpc('join_group', { p_token: token, p_customer: customer.id, p_relation: relation || null });
    return { ok: !error, data, error };
  }
  // เพิกถอนลิงก์ชวน (ลิงก์เก่าใช้ไม่ได้อีก)
  async function groupRevokeLink(groupId, actor) {
    if (CONFIG.USE_MOCK || !groupId || !actor?.id) return { ok: true };
    const { data, error } = await client().rpc('group_revoke_link', { p_group: groupId, p_actor: actor.id });
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
    const { data, error } = await client().rpc('group_order_summary', { p_order: orderGroup, p_requester: requester.id });
    return { ok: !error, data, error };
  }
  // เจ้าของออเดอร์กด "โอนแล้ว" → ปลด hold เป็น reserved
  async function groupPayConfirm(orderGroup, requester) {
    if (CONFIG.USE_MOCK || !orderGroup || !requester?.id) return { ok: true };
    const { data, error } = await client().rpc('group_pay_confirm', { p_order: orderGroup, p_requester: requester.id });
    return { ok: !error, data, error };
  }
  // สถานะการจ่ายของทั้งอีเวนต์ (dashboard หัวหน้า)
  async function groupEventStatus(eventGroup, requester) {
    if (CONFIG.USE_MOCK || !eventGroup || !requester?.id) return { ok: true, data: null };
    const { data, error } = await client().rpc('group_event_status', { p_event: eventGroup, p_requester: requester.id });
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
    try { const { data } = await client().rpc('birthday_status', { p_customer: customer.id }); return data || null; }
    catch (_e) { return null; }
  }
  async function birthdayReserve(garmentId, customer, fromStr, toStr) {
    if (CONFIG.USE_MOCK) return { ok: true, free: 0, pay: 0 };
    const { data, error } = await client().rpc('birthday_reserve_dates', { p_customer: customer.id, p_garment: garmentId, p_from: fromStr, p_to: toStr });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: data.error };
    return { ok: true, ...data };
  }

  return { init, reserve, saveProfile, stylist, availableOn, availableSetOn, bookedRanges, reserveDates, getTerms, acceptTerms, bookWithBackups, myImpact, recentCharity, hairStyle, myRentals, toggleWishlist, myWishlist, addReview, garmentRating, garmentReviewPhotos, uploadPhotos, ensureReferralCode, applyReferral, submitVideoReview, subPlans, mySubscription, subscribe, subSetStatus, quote, customerKyc, submitKyc, uploadIdCard, bookCart, addAlteration, groupInquiry, createGroup, myGroups, groupMembers, addManagedProfile, groupInvite, groupRespond, groupThemeSuggest, bookGroupCart, groupLeave, groupRemoveMember, groupTransferOwner, groupDelete, groupUpdateMember, groupRename, claimManagedProfile, mergeCustomers, groupJoinToken, joinGroup, groupRevokeLink, groupDiscountPct, bookGroupSplit, groupOrderSummary, groupPayConfirm, groupEventStatus, payInfo, birthdayStatus, birthdayReserve };
})();
