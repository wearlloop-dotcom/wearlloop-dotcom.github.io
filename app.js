// ===== state =====
let OCCASIONS = {}, CUSTOMER = {}, EVENT = null, GARMENTS = [], VENUES = [];
let fOccasion = null, fColor = null, fBrand ='', fToneOnly = false, fForYou = false, fWishOnly = false;
let gUseDate = null, gAvailSet = null, gOnlyAvail = false;  // เลือกวันใช้ตั้งแต่หน้าแรก
let gWish = new Set();  // garment id ที่หมายตา (wishlist)
let lang = (localStorage.getItem('lloop_lang') ||'th');
const $ = s => document.querySelector(s);

// ----- i18n helpers -----
const t = k => (window.I18N[lang][k]?? k);
const occName = c => (window.I18N[lang].occ[c] || c);
const dressName = th => (lang ==='th'? th : (window.I18N.en.dress[th] || th));
const weightName = w => (lang ==='th'? w : (window.I18N.en.weight[w] || w));
const stretchLabel = s => s ==='none'? t('noStretch') : s ==='slight'? t('slight') : t('stretchy');

function enterApp() {
  const el = $('#intro');
  el.classList.add('hide');
  setTimeout(() => { el.style.display ='none'; }, 900);
}
function scrollToGrid() {
  const g = document.querySelector('.collabel') || $('#grid');
  if (g) g.scrollIntoView({ behavior:'smooth'});
}

// ----- apply static (non-dynamic) text for current language -----
function applyStatic() {
  document.documentElement.lang = lang;
  const set = (id, k, html) => { const e = document.getElementById(id); if (e) e[html?'innerHTML':'textContent'] = t(k); };
  set('promo','promo'); set('creditLabel','creditLabel');
  set('heroKicker','heroKicker'); set('heroTitle','heroTitle', true); set('heroSub','heroSub'); set('heroCta','heroCta');
  set('loginLabel','login');
  set('stylistLabel','stylistLabel'); set('stylistBtn','stylistBtn');
  set('collTitle','collTitle'); set('collSub','collSub');
  set('introHouse','introHouse'); set('introTag','introTag'); set('introSub','introSub'); set('introEnter','introEnter');
  const vi = $('#venueInput'); if (vi) vi.placeholder = t('stylistPlaceholder');
  const cyc = t('cyc'); for (let i = 0; i < 4; i++) { const e = document.getElementById('cyc'+ i); if (e) e.textContent = cyc[i]; }
}

function setLang(l) {
  lang = l; localStorage.setItem('lloop_lang', l);
  $('#langTH').classList.toggle('on', l ==='th');
  $('#langEN').classList.toggle('on', l ==='en');
  closeDetail(); closeProfile();
  applyStatic();
  renderEvent(); renderCatnav(); renderChips(); renderFilters(); renderGrid();
  $('#vresult').classList.remove('show');
}

// Fit confidence — mirror SQL fit_confidence()
function fitConfidence(c, g) {
  if (c.bust_in == null ||!g.bust) return null;
  let score = 100;
  const slack = g.stretch ==='stretchy'? 2 : g.stretch ==='slight'? 1 : 0;
  if (c.bust_in < g.bust[0] - slack) score -= (g.bust[0] - slack - c.bust_in) * 12;
  else if (c.bust_in > g.bust[1] + slack) score -= (c.bust_in - g.bust[1] - slack) * 18;
  if (c.waist_in!= null && g.waist) {
    if (c.waist_in > g.waist[1] + slack) score -= (c.waist_in - g.waist[1] - slack) * 15;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

// คะแนน"แนะนำสำหรับคุณ"— รวม fit + โทนสี + สไตล์จากโปรไฟล์/พาร์ทเนอร์ (style_profile)
function personalScore(g) {
  const c = CUSTOMER;
  const fit = fitConfidence(c, g);
  let s = (fit!= null? fit : 55); // ฐานจากความพอดี
  if (g.season === c.my_color_season) s += 25; // เข้าโทนสีส่วนตัว
  const sp = c.style_profile || {};
  if (sp.brands && sp.brands.includes(g.brand)) s += 18; // แบรนด์ที่ชอบ (พาร์ทเนอร์วิเคราะห์)
  if (sp.categories && g.category && sp.categories.includes(g.category)) s += 18;
  if (sp.avoid_colors && g.colors.some(col => sp.avoid_colors.includes(col[1]))) s -= 20;
  if (EVENT && g.occasion_tags.includes(EVENT.occasion)) s += 12; // ตรงกับงานในปฏิทิน
  return s;
}

function renderEvent() {
  const el = $('#eventBanner');
  if (!EVENT) { el.style.display ='none'; return; }
  el.style.display ='flex';
  el.innerHTML =`
    <div class="cal"><span class="d">${EVENT.day}</span><span class="m">${EVENT.month}</span></div>
    <div class="txt">
      <div class="lbl">${t('eventLbl')}</div>
      <div class="ttl">${EVENT.title} · ${dressName(EVENT.dress_code)}</div>
      <div class="sub">${t('eventChosenPre')} ${occName(EVENT.occasion)} ${t('eventChosenPost')}</div>
    </div>
    <button onclick="setOccasion('${EVENT.occasion}')">${t('eventView')}</button>`;
}

function renderChips() {
  const tags = [...new Set(GARMENTS.flatMap(g => g.occasion_tags))];
  let html =`<div class="chip ${!fOccasion?'active':''}" onclick="setOccasion(null)">${t('all')}</div>`;
  html += tags.map(tg =>`<div class="chip ${fOccasion === tg?'active':''}" onclick="setOccasion('${tg}')">${occName(tg)}</div>`).join('');
  $('#chips').innerHTML = html;
}

function renderFilters() {
  const hexes = [...new Set(GARMENTS.flatMap(g => g.colors.map(c => c[1])))];
  const brands = [...new Set(GARMENTS.map(g => g.brand).filter(Boolean))];
  const sw = hexes.map(h =>`<button class="swatchbtn ${fColor === h?'active':''}" style="background:${h}" onclick="setColor('${h}')" aria-label="filter colour"></button>`).join('');
  const opts = [`<option value="">${t('allBrands')}</option>`].concat(brands.map(b =>`<option value="${b}"${fBrand === b?'selected':''}>${b}</option>`)).join('');
  $('#filters').innerHTML =`
    <button class="tone ${fToneOnly?'':'off'}" onclick="toggleTone()">● ${t('myTone')}</button>
    <div class="swrow">${sw}</div>
    <select class="brandsel" onchange="setBrand(this.value)">${opts}</select>`;
}

function setOccasion(t2) { fOccasion = t2; renderCatnav(); renderChips(); renderGrid(); }
function setColor(h) { fColor = (fColor === h? null : h); renderFilters(); renderGrid(); }
function setBrand(b) { fBrand = b; renderGrid(); }
function toggleTone() { fToneOnly =!fToneOnly; renderCatnav(); renderFilters(); renderGrid(); }

// top text category nav (Pomelo-style)
function renderCatnav() {
  const el = document.getElementById('catnav'); if (!el) return;
  const items = [
    { label: (lang ==='th'?'แนะนำสำหรับคุณ':'For You'), on: fForYou, act:`toggleForYou()`},
    { label: t('all'), on:!fForYou &&!fOccasion &&!fToneOnly &&!fWishOnly, act:`setForYouOff();setOccasion(null);setToneOff();setWishOff();renderCatnav();renderGrid()`},
    { label: t('myTone'), on: fToneOnly, act:`toggleTone()`},
    { label: (lang ==='th'?'ที่หมายตา':'Saved'), on: fWishOnly, act:`toggleWishOnly()`},
    { label: occName('wedding_guest'), on: fOccasion ==='wedding_guest', act:`setOccasion('wedding_guest')`},
    { label: occName('work'), on: fOccasion ==='work', act:`setOccasion('work')`},
    { label: occName('cafe'), on: fOccasion ==='cafe', act:`setOccasion('cafe')`},
    { label: (lang ==='th'?'ออเดอร์ของฉัน':'My Rentals'), on: false, act:`openOrders()`},
    { label: (lang ==='th'?'สมาชิกรายเดือน':'Membership'), on: false, act:`openMembership()`},
    { label: (lang ==='th'?'ความดีที่หมุนเวียน':'Impact'), on: false, act:`openImpact()`},
    { label: (lang ==='th'?'โปรไฟล์':'Profile'), on: false, act:`openProfile()`},
];
  el.innerHTML = items.map(i =>`<a onclick="${i.act}" style="${i.on?'border-bottom:2px solid var(--ink);padding-bottom:2px':''}">${i.label}</a>`).join('');
}
function setToneOff() { fToneOnly = false; }
function toggleForYou() { fForYou =!fForYou; renderCatnav(); renderGrid(); if (fForYou) window.scrollTo({ top: 0, behavior:'smooth'}); }
function setForYouOff() { fForYou = false; }
function setWishOff() { fWishOnly = false; }
function toggleWishOnly() {
  if (!CUSTOMER.id) { toast(lang ==='th'?'เข้าผ่าน LINE เพื่อดูข้อมูลส่วนตัว':'Sign in via LINE to see your saved looks'); return; }
  fWishOnly =!fWishOnly; renderCatnav(); renderGrid();
}
// กดหัวใจที่การ์ดสินค้า — บันทึก/ยกเลิก wishlist
async function toggleWish(garmentId, event) {
  event.stopPropagation();
  if (!CUSTOMER.id) { toast(lang ==='th'?'เข้าผ่าน LINE เพื่อบันทึกที่หมายตา':'Sign in via LINE to save looks'); return; }
  const btn = event.currentTarget;
  const wasOn = gWish.has(garmentId);
  // optimistic toggle
  if (wasOn) gWish.delete(garmentId); else gWish.add(garmentId);
  if (btn) btn.classList.toggle('on', !wasOn);
  try {
    const added = await window.API.toggleWishlist(CUSTOMER, garmentId);
    if (added === true) gWish.add(garmentId); else if (added === false) gWish.delete(garmentId);
    if (btn) btn.classList.toggle('on', gWish.has(garmentId));
  } catch (e) { console.warn(e); }
  if (fWishOnly) renderGrid();
}

function renderGrid() {
  let list = GARMENTS.filter(g =>
    (!fOccasion || g.occasion_tags.includes(fOccasion)) &&
    (!fColor || g.colors.some(c => c[1] === fColor)) &&
    (!fBrand || g.brand === fBrand) &&
    (!fToneOnly || g.season === CUSTOMER.my_color_season) &&
    (!fWishOnly || gWish.has(g.id)));
  if (fWishOnly && !list.length) { $('#grid').innerHTML =`<div class="empty">${lang ==='th'?'ยังไม่มีชุดที่หมายตา — แตะรูปหัวใจที่ชุดที่ชอบเพื่อเก็บไว้':'No saved looks yet — tap the heart on a piece you love'}</div>`; return; }
  if (fForYou) list = [...list].sort((a, b) => personalScore(b) - personalScore(a)); // จัดอันดับเฉพาะคุณ
  const availOf = g => !gUseDate || !gAvailSet || gAvailSet.has(g.id);  // null set = ว่างหมด (mock)
  if (gUseDate && gOnlyAvail) list = list.filter(availOf);
  if (!list.length) { $('#grid').innerHTML =`<div class="empty">${t('empty')}</div>`; return; }
  $('#grid').innerHTML = list.map(g => {
    const fit = fitConfidence(CUSTOMER, g);
    const match = g.season === CUSTOMER.my_color_season;
    const av = availOf(g);
    const dots = g.colors.map(c =>`<i style="background:${c[1]}"></i>`).join('');
    return`<div class="pcard ${gUseDate && !av ? 'busy' : ''}" onclick="openDetail('${g.id}')">
      <div class="pphoto" style="background:${g.bg}">
        <span class="ph">${g.name}</span>
        <button class="wish ${gWish.has(g.id)?'on':''}" onclick="toggleWish('${g.id}',event)" aria-label="wishlist">♥</button>
        <div class="badges">
          ${gUseDate ? `<span class="bdg ${av ? 'avail' : 'busy'}">${av ? (lang === 'th' ? 'ว่าง ' + fmtDate(gUseDate) : 'free ' + fmtDate(gUseDate)) : (lang === 'th' ? 'ไม่ว่าง' : 'booked')}</span>` : ''}
          ${g.isNew?`<span class="bdg new">NEW</span>`:''}
          ${match?`<span class="bdg tone">${t('toneMatch')}</span>`:''}
        </div>
        <div class="hoverbar">
          <div class="try">${lang ==='th'?'ลองดูเลย':'View'} ›</div>
          <div class="sizes">
            ${fit!= null?`<span>${t('fitGood')} ${fit}%</span>`:''}
            <span>${occName(g.occasion_tags[0])}</span>
            <span>฿${g.price}</span>
          </div>
        </div>
      </div>
      <div class="pmeta">
        <div class="pbrand">${g.brand ||''}</div>
        <div class="pname">${g.name}</div>
        <div class="pprice">฿${g.price} <span style="color:var(--muted);font-weight:400">/ ${t('perTime')}</span></div>
        <div class="pcolors">${dots}</div>
      </div>
    </div>`;
  }).join('');
}

// ===== เลือกวันใช้ตั้งแต่หน้าแรก =====
function renderDatebar() {
  const el = $('#datebar'); if (!el) return;
  const en = lang === 'en';
  const n = gUseDate && gAvailSet ? gAvailSet.size : null;
  el.innerHTML = `
    <span class="dblabel">${en ? 'When will you wear it?' : 'จะใส่ชุดวันไหน?'}</span>
    <input type="date" id="homeDate" min="${todayStr()}" value="${gUseDate || ''}" onchange="setHomeDate(this.value)">
    ${gUseDate ? `<button class="dbonly ${gOnlyAvail ? 'on' : ''}" onclick="toggleOnlyAvail()">${en ? 'available only' : 'เฉพาะที่ว่าง'}${n != null ? ` (${n})` : ''}</button>
      <button class="dbclear" onclick="clearHomeDate()">${en ? 'clear' : 'ล้างวันที่'}</button>` : ''}`;
}
async function setHomeDate(d) {
  gUseDate = d || null;
  if (gUseDate) { try { gAvailSet = await window.API.availableSetOn?.(gUseDate); } catch (e) { gAvailSet = null; } }
  else { gAvailSet = null; gOnlyAvail = false; }
  renderDatebar(); renderGrid();
}
function clearHomeDate() { gUseDate = null; gAvailSet = null; gOnlyAvail = false; renderDatebar(); renderGrid(); }
function toggleOnlyAvail() { gOnlyAvail = !gOnlyAvail; renderDatebar(); renderGrid(); }

// ===== AI Stylist: venue name dress code + photo-friendly colours =====
async function askVenue() {
  const q = ($('#venueInput').value ||'').trim();
  const el = $('#vresult');
  if (!q) { el.classList.remove('show'); return; }
  el.className ='vresult show';
  el.innerHTML =`<span class="note">${t('vAnalyzingPre')} “${q}”…</span>`;
  const v = await window.API.stylist(q, CUSTOMER.my_color_season, EVENT && EVENT.occasion, lang);
  const sw = (v.recommended_colors || []).map(c =>
`<span class="sw" style="background:${c.hex}" title="${c.name ||''}" onclick="setColorFromVenue('${c.hex}')"></span>`).join('');
  const link = v.occasion?` · <a href="#" onclick="setOccasion('${v.occasion}');return false">${t('vViewPre')} ${occName(v.occasion)}</a>`:'';
  el.innerHTML =`
    <span class="dc">${dressName(v.dress_code_th) ||'—'}</span><span style="font-size:12px;color:var(--stone)">${v.venue_type ||''}</span>
    <div style="margin-top:6px">${t('vColors')} ${sw}</div>
    <div class="note"><b style="color:var(--ink)">${t('vPhoto')}</b> ${v.photo_tip ||''}</div>
    ${v.avoid?`<div class="note">${t('vAvoid')} ${v.avoid}</div>`:''}
    <div class="note">${t('vTapColor')}${link}</div>`;
  if (v.occasion) setOccasion(v.occasion);
}
function setColorFromVenue(h) { fColor = h; renderFilters(); renderGrid(); window.scrollTo({ top: 380, behavior:'smooth'}); }

// ===== detail =====
function openDetail(id) {
  const g = GARMENTS.find(x => x.id === id);
  fbTrack('ViewContent', { content_ids:[g.code || g.id], content_name: g.name, content_type:'product', value: g.price, currency:'THB' });
  const fit = fitConfidence(CUSTOMER, g);
  const match = g.season === CUSTOMER.my_color_season;
  const credit = Math.min(CUSTOMER.credit_balance || 0, Math.round(g.price * 0.5));
  const fabric = lang ==='th'? g.fabric : (g.fabric_en || g.fabric);
  const tipList = lang ==='th'? (g.styling_tips || []) : (g.tips_en || g.styling_tips || []);
  const fabricTags = [
`<span class="ftag main">${fabric ||'—'}</span>`,
`<span class="ftag">${stretchLabel(g.stretch)}</span>`,
    g.lining?`<span class="ftag">${t('lining')}</span>`:'',
    g.weight?`<span class="ftag">${weightName(g.weight)}</span>`:'',
    g.sheer?`<span class="ftag">${t('sheer')}</span>`:`<span class="ftag">${t('notSheer')}</span>`,
].join('');
  const measures = [
    [t('bust'), g.bust?`${g.bust[0]}–${g.bust[1]}"`: t('free')],
    [t('waist'), g.waist?`${g.waist[0]}–${g.waist[1]}"`: t('free')],
    [t('hip'), g.hip?`${g.hip}"`: t('free')],
    [t('length'), g.length?`${g.length} ${t('cm')}`:'—'],
].map(m =>`<div class="mcell"><span>${m[0]}</span>${m[1]}</div>`).join('');
  const swatches = g.colors.map(c =>`<div class="swatch"><i style="background:${c[1]}"></i><span>${c[0]}</span></div>`).join('');
  const tips = tipList.map(x =>`<div class="trow"><i></i>${x}</div>`).join('');

  $('#sheet').innerHTML =`
    <div class="dphoto" style="background:${g.bg}">
      <span class="ph" style="font-family:var(--serif);font-style:italic;color:rgba(0,0,0,.28)">${g.name}</span>
      <button class="close" onclick="closeDetail()">×</button>
      ${match?`<span class="season" style="position:absolute;top:14px;left:14px">${t('toneMatch')}</span>`:''}
    </div>
    <div class="dbody">
      <div class="cbrand">${g.brand ||''}</div>
      <div class="dname">${g.name}</div>
      <div class="dmeta">${g.tier} · ${t('rotating')}</div>
      <div id="ratingline" class="ratingline"></div>
      ${fit!= null?`<div class="fitbox"><div class="pct">${fit}%</div>
        <div><div style="font-size:13px;font-weight:500;color:#04342C">${t('fitTitle')}</div>
        <div style="font-size:11px;color:var(--ok)">${t('fitFromPre')} ${g.stretch!=='none'? t('stretchHelp') : t('noStretchHelp')}</div></div></div>`:''}
      ${tips?`<div class="sec">${t('secWear')}</div><div class="tips">${tips}</div>`:''}
      <div class="sec">${lang ==='th'?'ครบลุค — ทรงผม & เครื่องประดับ':'Complete the look'}</div>
      <div id="lookbox" class="lookbox"><button class="lookbtn" onclick="loadLook('${g.code || g.id}','${(g.occasion_tags||[])[0]||''}')">${lang ==='th'?'ดูทรงผม & เครื่องประดับที่เข้ากับชุดนี้':'See hair & accessories for this look'}</button></div>
      <div id="ugcWrap" style="display:none"><div class="sec">${lang ==='th'?'รูปจริงจากลูกค้า':'Real customer photos'}</div><div id="ugcbox" class="ugcbox"></div></div>
      <div class="sec">${t('secSize')}</div>
      <div class="measure">${measures}</div>
      <div class="sec">${t('secFabric')}</div>
      <div class="fabric">${fabricTags}</div>
      <div class="sec">${t('secColor')}</div>
      <div class="colors">${swatches}</div>
      <div class="sec">${lang ==='th'?'ปฏิทินว่าง':'Availability'}</div>
      <div id="availcal" class="availcal"></div>
    </div>
    <div class="datepick">
      <label>${lang ==='th'?'วันที่ต้องใช้':'Date you need it'}</label>
      <input type="date" id="useDate" min="${todayStr()}" value="${gUseDate || ''}" onchange="checkAvail('${g.id}')">
      <span id="availMsg" class="availmsg"></span>
    </div>
    <div class="cta">
      <span class="price">${subCovers() ? `<span style="color:var(--sage)">${lang==='th'?'รวมในแพ็กเกจ':'Included in plan'}</span>` : '฿'+g.price}</span>
      <button id="bookBtn" onclick="reserve('${g.id}')">${t('reserveBtn')}</button>
    </div>
    ${subCovers()
      ? `<div class="creditline">${lang==='th'?`ใช้สิทธิ์สมาชิก ${CUSTOMER._sub.plan_name} · เหลือ ${CUSTOMER._sub.remaining} ชุดรอบนี้`:`Using ${CUSTOMER._sub.plan_name} · ${CUSTOMER._sub.remaining} left this cycle`}</div>`
      : `<div class="creditline">${t('creditPre')}${credit}${t('creditMid')}${g.price - credit}</div>`}`;
  $('#overlay').classList.add('open');
  document.body.style.overflow ='hidden';
  renderAvailCalendar(g.id);
  renderUGC(g.id);
  loadRating(g.id);  // เรตติ้ง/รีวิวของชุด (async inject)
  if (gUseDate) checkAvail(g.id);  // โชว์สถานะวันที่เลือกจากหน้าแรกทันที
  $('#overlay').scrollTop = 0; const sh = $('#sheet'); if (sh) sh.scrollTop = 0;
}
function closeDetail() { $('#overlay').classList.remove('open'); document.body.style.overflow =''; }

// เรตติ้งเฉลี่ยของชุด — ดึงแยกแล้วฉีดเข้าหน้ารายละเอียด (ไม่เรียกต่อการ์ดเพื่อ performance)
async function loadRating(garmentId) {
  let r = null;
  try { r = await window.API.garmentRating(garmentId); } catch (e) { /**/ }
  const el = $('#ratingline'); if (!el) return;
  if (!r || !r.count) { el.innerHTML =''; return; }
  const avg = (Math.round(r.avg * 10) / 10).toFixed(1);
  const reviewWord = lang ==='th'?'รีวิว':(r.count > 1?'reviews':'review');
  el.innerHTML =`<span class="star">★</span> ${avg} <span class="rcount">(${r.count} ${reviewWord})</span>`;
}

// ปฏิทินว่าง/ไม่ว่างของชุด (2 เดือน) — แตะวันว่างเพื่อเลือก
async function renderAvailCalendar(garmentId) {
  const box = $('#availcal'); if (!box) return;
  let ranges = []; try { ranges = await window.API.bookedRanges?.(garmentId) || []; } catch (e) { /**/ }
  const ymd = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const booked = new Set();
  ranges.forEach(r => { let d = new Date(r.from_date + 'T00:00:00'); const end = new Date(r.to_date + 'T00:00:00');
    for (; d <= end; d.setDate(d.getDate() + 1)) booked.add(ymd(d)); });  // local — กัน toISOString เลื่อนวันในโซน +7
  const today = new Date(todayStr() + 'T00:00:00');
  const dow = lang === 'th' ? ['อา','จ','อ','พ','พฤ','ศ','ส'] : ['S','M','T','W','T','F','S'];
  let html = '';
  for (let mo = 0; mo < 2; mo++) {
    const base = new Date(today.getFullYear(), today.getMonth() + mo, 1);
    const monthName = base.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'long', year: '2-digit' });
    const first = base.getDay(), days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    let cells = dow.map(d => `<span class="cdow">${d}</span>`).join('');
    for (let i = 0; i < first; i++) cells += `<span></span>`;
    for (let dn = 1; dn <= days; dn++) {
      const ds = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(dn).padStart(2, '0')}`;
      const past = new Date(ds + 'T00:00:00') < today;
      const isBooked = booked.has(ds);
      const sel = ds === gUseDate;
      const cls = past ? 'past' : isBooked ? 'bk' : 'free';
      const onclick = (!past && !isBooked) ? ` onclick="pickCalDate('${garmentId}','${ds}')"` : '';
      cells += `<span class="cday ${cls} ${sel ? 'sel' : ''}"${onclick}>${dn}</span>`;
    }
    html += `<div class="calmonth"><div class="calhd">${monthName}</div><div class="calgrid">${cells}</div></div>`;
  }
  html += `<div class="callegend"><span><i class="lfree"></i>${lang === 'th' ? 'ว่าง' : 'free'}</span><span><i class="lbk"></i>${lang === 'th' ? 'ไม่ว่าง' : 'booked'}</span></div>`;
  box.innerHTML = html;
}
function pickCalDate(garmentId, ds) {
  const inp = $('#useDate'); if (inp) inp.value = ds;
  document.querySelectorAll('#availcal .cday.sel').forEach(e => e.classList.remove('sel'));
  event.currentTarget.classList.add('sel');
  checkAvail(garmentId);
}
// รูปจริงจากลูกค้า (UGC) ในหน้าชุด — แตะขยายได้
async function renderUGC(garmentId) {
  const wrap = $('#ugcWrap'), box = $('#ugcbox'); if (!box) return;
  let photos = []; try { photos = await window.API.garmentReviewPhotos?.(garmentId) || []; } catch (e) { /**/ }
  if (!photos.length) { if (wrap) wrap.style.display = 'none'; return; }
  box.innerHTML = photos.map(p => `<img src="${p.url}" loading="lazy" onclick="this.classList.toggle('zoom')" title="${(p.comment || '').replace(/"/g, '')}">`).join('');
  if (wrap) wrap.style.display = '';
}

// ครบลุค — AI ทรงผม/เครื่องประดับต่อชุด (มี mock ไว้ demo ก่อน deploy)
function mockLook(g) {
  const cat = g && g.category, dc = g && g.dress_code;
  const formal = dc === 'formal' || dc === 'cocktail';
  const hair = formal ? ['ผมรวบสูงเก็บคอ ดูสง่า', 'ลอนใหญ่ปัดข้าง'] : ['ปล่อยลอนสลวยธรรมชาติ', 'รวบครึ่งหัวเก็บหน้า'];
  const jewelry = formal ? ['ต่างหูระย้า', 'สร้อยเส้นเล็กแนบคอ'] : ['ต่างหูห่วงเล็ก', 'สร้อยข้อมือบาง'];
  const accessories = (cat === 'dress' || cat === 'set') ? ['กระเป๋าคลัตช์', 'เข็มขัดเส้นเล็กเน้นเอว'] : ['กระเป๋าสะพายทรงสวย'];
  const shoes = formal ? 'รองเท้าส้นสูงสีนู้ด ช่วยยืดขา' : 'รองเท้าส้นเตี้ย/รัดส้นโทนเดียวกับชุด';
  return { hair, jewelry, accessories, shoes, note: 'แนะนำเบื้องต้น — เปิด AI จริง (deploy) จะวิเคราะห์ละเอียดตามรูปหน้า/หุ่นของคุณ' };
}
async function loadLook(code, occasion) {
  const box = $('#lookbox'); if (!box) return;
  box.innerHTML = `<div class="lookloading">${lang ==='th'?'กำลังจัดลุคให้คุณ…':'styling your look…'}</div>`;
  const g = GARMENTS.find(x => (x.code || x.id) === code) || {};
  let look = null;
  try { look = await window.API.hairStyle?.(code, occasion); } catch (e) { /**/ }
  if (!look || !look.hair) look = mockLook(g);
  const row = (label, items) => (items && items.length)
    ? `<div class="lookrow"><span class="lk">${label}</span><div class="lv">${(Array.isArray(items) ? items : [items]).map(x => `<i>${x}</i>`).join('')}</div></div>` : '';
  box.innerHTML = `
    <div class="lookcard">
      ${row(lang ==='th'?'ทรงผม':'Hair', look.hair)}
      ${row(lang ==='th'?'ต่างหู/สร้อย':'Jewelry', look.jewelry)}
      ${row(lang ==='th'?'เครื่องประดับ':'Accessories', look.accessories)}
      ${row(lang ==='th'?'รองเท้า':'Shoes', look.shoes)}
      ${look.note ? `<div class="looknote">${look.note}</div>` : ''}
    </div>`;
}

function todayStr() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function fmtDate(s) {
  const d = new Date(s +'T00:00:00');
  return d.toLocaleDateString(lang ==='th'?'th-TH':'en-GB', { day:'numeric', month:'short'});
}

// เช็กว่าชุดว่างในวันที่เลือกไหม โชว์ ✓ ว่าง / ✕ ไม่ว่าง
async function checkAvail(id) {
  const date = $('#useDate').value;
  const msg = $('#availMsg');
  if (!date) { msg.textContent =''; return; }
  msg.className ='availmsg checking';
  msg.textContent = lang ==='th'?'กำลังเช็ก…':'checking…';
  let free = true;
  try { free = await window.API.availableOn(id, date); } catch (e) { console.warn(e); }
  if (free) {
    msg.className ='availmsg ok';
    msg.textContent = lang ==='th'?`✓ ว่าง ${fmtDate(date)} จองได้เลย`:`✓ Free on ${fmtDate(date)}`;
  } else {
    msg.className ='availmsg busy';
    msg.textContent = lang ==='th'?`✕ ไม่ว่าง ${fmtDate(date)} ลองวันอื่น`:`✕ Booked on ${fmtDate(date)}`;
  }
  return free;
}

async function reserve(id) {
  const g = GARMENTS.find(x => x.id === id);
  const date = $('#useDate') && $('#useDate').value;
  if (!date) {
    const msg = $('#availMsg');
    if (msg) { msg.className ='availmsg busy'; msg.textContent = lang ==='th'?'เลือกวันที่ต้องใช้ก่อนนะคะ':'Pick a date first'; }
    return;
  }
  // กันจองชน — เช็กว่างก่อน
  const free = await checkAvail(id);
  if (free === false) return;
  const credit = Math.min(CUSTOMER.credit_balance || 0, Math.round(g.price * 0.5));
  let ok = true, backups = [];
  try {
    const res = await window.API.bookWithBackups(CUSTOMER, g.code || g.id, date, date);
    ok =!res.error && res.data &&!res.data.error;
    backups = (res.data && res.data.backups) || [];
    if (!ok) toast(lang ==='th'?'ชุดนี้เพิ่งถูกจองวันนั้นพอดี ลองวันอื่นนะคะ':'Just got booked for that date — try another');
  } catch (e) { console.warn(e); }
  if (!ok) { checkAvail(id); return; }
  CUSTOMER.credit_balance = (CUSTOMER.credit_balance || 0) - credit;
  $('#credit').textContent ='฿'+ (CUSTOMER.credit_balance || 0);
  fbTrack('InitiateCheckout', { content_ids:[g.code || g.id], content_name: g.name, value: g.price, currency:'THB' });
  closeDetail();
  const bk = backups.length
? (lang ==='th'?` · เตรียมชุดสำรองให้ ${backups.length} ตัวแล้ว`:` · ${backups.length} backups reserved`)
    :'';
  toast(`${t('reservedPre')} ${g.name} ${t('reservedPost')} ${fmtDate(date)}${bk}`);
}

// ===== profile =====
const SEASONS = [
  ['spring', ['#FF7E5F','#FFD45E','#C5E17A']],
  ['summer', ['#A8C8E8','#C9B6E4','#F3C6D3']],
  ['autumn', ['#D6A02E','#B5531F','#7E7A33']],
  ['winter', ['#D5142B','#1E47A6','#111317']],
];
let pSeason ='winter';
function openProfile(onboard) {
  const c = CUSTOMER;
  pSeason = c.my_color_season ||'winter';
  const dispName = c.name || c.display_name ||'';
  const avatar = c.picture_url ?`<img class="pavatar" src="${c.picture_url}" alt="" referrerpolicy="no-referrer">`
    :`<div class="pavatar pavatar-x">${(dispName[0]||'L').toUpperCase()}</div>`;
  const head = onboard
    ?`<div class="onbhead">${avatar}<div><div class="onbhi">${lang==='th'?'ยินดีต้อนรับ':'Welcome'}${dispName?' '+dispName:''}</div><div class="onbsub">${lang==='th'?'กรอกข้อมูลสั้น ๆ ครั้งเดียว เพื่อให้เราแนะนำลุคที่ใช่ และจัดส่งถึงคุณได้':'A few details, once — so we can recommend your looks and ship to you'}</div></div></div>`
    : (c.line_uid || c.display_name || c.picture_url
      ?`<div class="onbhead">${avatar}<div><div class="onbhi">${lang==='th'?'สวัสดีคุณ':'Hi'} ${dispName||''}</div><div class="onbsub">${lang==='th'?'เข้าสู่ระบบด้วย LINE แล้ว':'Signed in with LINE'}</div></div></div>`
      :'');
  const labels = window.I18N[lang].seasons;
  const seasons = SEASONS.map((s, i) =>`
    <div class="seasonbtn ${pSeason === s[0]?'active':''}" data-s="${s[0]}" onclick="pickSeason('${s[0]}')">
      <div class="sw">${s[1].map(h =>`<i style="background:${h}"></i>`).join('')}</div>
      <span>${labels[i]}</span>
    </div>`).join('');
  $('#pSheet').innerHTML =`
    <div class="pform">
      <button class="close" style="position:static;float:right" onclick="closeProfile()">×</button>
      ${head}
      <h3>${onboard?(lang==='th'?'ข้อมูลเบื้องต้น':'Quick details'):t('pTitle')}</h3>
      <p class="hint">${t('pHint')}</p>
      ${renderStyleCard(c)}
      ${renderImpactCard()}
      ${renderReferralCard()}
      <div class="field"><label>${t('pName')}</label><input id="pName" value="${c.name || c.display_name ||''}"></div>
      <div class="frow">
        <div class="field"><label>${t('pHeight')}</label><input id="pHeight" type="number" value="${c.height_cm ||''}"></div>
        <div class="field"><label>${t('pShoe')}</label><input id="pShoe" value="${c.shoe_size ||''}"></div>
      </div>
      <div class="frow">
        <div class="field"><label>${t('pBustL')}</label><input id="pBust" type="number" value="${c.bust_in ||''}"></div>
        <div class="field"><label>${t('pWaistL')}</label><input id="pWaist" type="number" value="${c.waist_in ||''}"></div>
        <div class="field"><label>${t('pHipL')}</label><input id="pHip" type="number" value="${c.hip_in ||''}"></div>
      </div>
      <div class="field"><label>${t('pColor')}</label><div class="seasons">${seasons}</div></div>
      <div class="frow">
        <div class="field"><label>${lang === 'th' ? 'เบอร์โทร (ไว้พิมพ์ใบส่ง)' : 'Phone (for shipping)'}</label><input id="pPhone" inputmode="tel" value="${c.phone || ''}"></div>
      </div>
      <div class="field"><label>${lang === 'th' ? 'ที่อยู่จัดส่ง (กรอกครั้งเดียว ใช้พิมพ์ใบส่ง-รับคืนอัตโนมัติ)' : 'Delivery address (once — auto-fills labels)'}</label><input id="pAddress" value="${c.address || ''}"></div>
      <div class="field"><label>${t('pNotes')}</label><input id="pNotes" value="${c.notes ||''}"></div>
      <button class="savebtn" onclick="saveProfile()">${t('pSave')}</button>
    </div>`;
  $('#pOverlay').classList.add('open');
  document.body.style.overflow ='hidden';
  setTimeout(() => animateCounts($('#pSheet')), 80);  // ตัวเลขนับขึ้นในการ์ดอิมแพกต์
  loadReferralCode();  // ดึงโค้ดชวนเพื่อน (async inject)
}
// การ์ดชวนเพื่อน — รับเครดิตทั้งคู่
function renderReferralCard() {
  return`<div class="refcard">
    <div class="refkick">${lang ==='th'?'ชวนเพื่อน รับเครดิตทั้งคู่':'invite a friend — credit for you both'}</div>
    <div class="refcode-wrap">
      <div class="reflbl">${lang ==='th'?'โค้ดชวนเพื่อนของคุณ':'your invite code'}</div>
      <div class="refcode" id="refCode">${CUSTOMER.id?'…':(lang ==='th'?'เข้าผ่าน LINE เพื่อรับโค้ด':'sign in via LINE')}</div>
    </div>
    <div class="reffield">
      <div class="reflbl">${lang ==='th'?'ใส่โค้ดเพื่อนที่ชวนคุณ':'enter a friend code'}</div>
      <div class="refrow">
        <input id="refInput" placeholder="${lang ==='th'?'เช่น LOOP-AB12':'e.g. LOOP-AB12'}" autocomplete="off">
        <button onclick="applyReferralCode()">${lang ==='th'?'ใช้โค้ด':'apply'}</button>
      </div>
    </div>
  </div>`;
}
async function loadReferralCode() {
  const el = $('#refCode'); if (!el) return;
  if (!CUSTOMER.id) { el.textContent = lang ==='th'?'เข้าผ่าน LINE เพื่อรับโค้ด':'sign in via LINE'; return; }
  let code = null;
  try { code = await window.API.ensureReferralCode(CUSTOMER); } catch (e) { /**/ }
  if (code) { CUSTOMER.referral_code = code; el.textContent = code; }
  else el.textContent = lang ==='th'?'—':'—';
}
async function applyReferralCode() {
  if (!CUSTOMER.id) { toast(lang ==='th'?'เข้าผ่าน LINE เพื่อใช้โค้ด':'Sign in via LINE to apply a code'); return; }
  const inp = $('#refInput'); const code = (inp && inp.value || '').trim();
  if (!code) { toast(lang ==='th'?'ใส่โค้ดเพื่อนก่อนนะคะ':'Enter a code first'); return; }
  let res = 'not_found';
  try { res = await window.API.applyReferral(CUSTOMER, code); } catch (e) { console.warn(e); }
  const msg = {
    ok: lang ==='th'?'ใช้โค้ดสำเร็จ ได้รับเครดิตทั้งคู่แล้ว':'Code applied — credit added for you both',
    self: lang ==='th'?'ใช้โค้ดตัวเองไม่ได้นะคะ':'You cannot use your own code',
    used: lang ==='th'?'คุณใช้โค้ดชวนเพื่อนไปแล้ว':'You have already used a referral code',
    not_found: lang ==='th'?'ไม่พบโค้ดนี้ ลองตรวจอีกครั้ง':'Code not found — please check again',
  };
  toast(msg[res] || msg.not_found);
  if (res === 'ok' && inp) inp.value = '';
}
// สรุปสไตล์ (จากพาร์ทเนอร์) + รหัสนัดสไตลิสต์ + ชั้น CRM — โชว์ลูกค้าแบบ curated
function catName(k) {
  const th = { dress:'เดรส', set:'เซ็ต', top:'เสื้อ', skirt:'กระโปรง', pants:'กางเกง', jumpsuit:'จัมป์สูท', outerwear:'เสื้อคลุม'};
  const en = { dress:'Dress', set:'Set', top:'Top', skirt:'Skirt', pants:'Pants', jumpsuit:'Jumpsuit', outerwear:'Outerwear'};
  return (lang ==='th'? th : en)[k] || k;
}
function renderStyleCard(c) {
  const sp = c.style_profile || {};
  const tier = c.crm_tier ||'new';
  const tierLabel = { new: (lang ==='th'?'สมาชิกใหม่':'New'), silver:'Silver', gold:'Gold', platinum:'Platinum'}[tier] || tier;
  const pts = c.points?` · ${c.points} pts`:'';
  let inner;
  if (sp.headline || (sp.palette && sp.palette.length)) {
    const pal = (sp.palette || []).map(h =>`<i style="background:${h}"></i>`).join('');
    const rec = (sp.recommend || []).map(catName).join(' · ');
    const stype = sp.season_type ? `<div class="styletype">${lang ==='th'?'โทนสีของคุณ':'Your season'}: <b style="color:#A75F3A">${sp.season_type}</b></div>` : '';
    inner =`<div class="stylehead">${sp.headline || (lang ==='th'?'สรุปสไตล์ของคุณ':'Your style')}</div>
      ${stype}
      ${pal?`<div class="stylepal">${pal}</div>`:''}
      ${rec?`<div class="stylerec">${lang ==='th'?'ชุดที่แนะนำ':'For you'}: ${rec}</div>`:''}`;
  } else {
    inner =`<div class="stylehead">${lang ==='th'?'ยังไม่มีผลวิเคราะห์สไตล์':'No style analysis yet'}</div>
      <div class="stylerec">${lang ==='th'?'แสดงรหัสนี้กับสไตลิสต์พาร์ทเนอร์ตอนไปทำ Personal Color':'Show this code to our partner stylist'}</div>`;
  }
  return`<div class="stylecard">
    <div class="tierbadge"> ${tierLabel}${pts}</div>
    ${inner}
    ${c.link_code?`<div class="linkcode">${lang ==='th'?'รหัสนัดสไตลิสต์':'Stylist code'} <b>${c.link_code}</b></div>`:''}
  </div>`;
}
// ===== ผลกระทบ + แกลเลอรี charity (wow, interactive) =====
async function openImpact() {
  const im = CUSTOMER._impact || { rentals: 0, water_l: 0, co2_kg: 0, charity_thb: 0, charity_name: 'โครงการเสื้อผ้าเพื่อน้อง' };
  let posts = []; try { posts = await window.API.recentCharity?.() || []; } catch (e) { /**/ }
  const en = lang === 'en';
  const gallery = posts.length ? posts.map(p => {
    const d = new Date(p.posted_at).toLocaleDateString(en ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    const imgs = (p.photos || []).map(u => `<img src="${u}" loading="lazy" onclick="this.classList.toggle('zoom')">`).join('');
    return `<div class="gpost"><div class="gphotos">${imgs}</div><div class="gcap">${p.caption || ''}</div><div class="gdate">${d}</div></div>`;
  }).join('') : `<div class="gempty">${en ? 'Charity activities will appear here' : 'ภาพกิจกรรมแบ่งปันจะมาแสดงที่นี่เร็ว ๆ นี้'}</div>`;

  const leaf = `<svg class="leaf" width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M16 27c0-8 0-14 9-19-1 9-3 15-9 19z"/><path d="M16 27c0-7-1-12-8-16 1 8 2 13 8 16z"/><path d="M16 27v-15"/></svg>`;
  $('#impactSheet').innerHTML = `
    <button class="close" onclick="closeImpact()">×</button>
    <div class="impact-hero">
      ${leaf}
      <div class="ik">${en ? 'the good you keep in the loop' : 'ความดีที่คุณหมุนเวียน'}</div>
      <div class="ihead">${en ? 'wear one look, care for the planet once more' : 'เช่าหนึ่งชุด ดูแลโลกอีกหนึ่งครั้ง'}</div>
      <div class="iline">${en ? 'every time you choose to rotate instead of buy new, you truly give back to the earth' : 'ทุกครั้งที่คุณเลือกหมุนเวียนแทนซื้อใหม่ คือการคืนบางอย่างให้โลกใบนี้จริง ๆ'}</div>
      <div class="ibig">
        <div><b data-to="${im.water_l || 0}">0</b><span>${en ? 'litres of water saved' : 'ลิตรน้ำที่ช่วยประหยัด'}</span></div>
        <div class="div"></div>
        <div><b data-to="${im.co2_kg || 0}">0</b><span>${en ? 'kg carbon reduced' : 'กก. คาร์บอนที่ลด'}</span></div>
        <div class="div"></div>
        <div><b data-to="${im.rentals || 0}">0</b><span>${en ? 'looks rotated' : 'ครั้งที่หมุนเวียน'}</span></div>
      </div>
      <div class="icharity">${en ? 'and you have passed on' : 'และคุณได้ส่งต่อ'} <b data-to="${im.charity_thb || 0}" data-prefix="฿">฿0</b> ${en ? 'to ' + (im.charity_name || 'children in need') : 'ให้' + (im.charity_name || 'เด็กยากไร้')}</div>
    </div>
    <div class="igallery">
      <div class="igtitle">${en ? 'moments you are part of' : 'ภาพกิจกรรมที่คุณเป็นส่วนหนึ่ง'}</div>
      ${gallery}
    </div>`;
  $('#impactOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => animateCounts($('#impactSheet')), 60);
}
function closeImpact() { $('#impactOverlay').classList.remove('open'); document.body.style.overflow = ''; }

// ===== สมาชิกรายเดือน (Membership / subscription) =====
// ลูกค้ามีสิทธิ์สมาชิกเหลือไหม → ชุดนี้ "รวมในแพ็กเกจ"
function subCovers() {
  const s = CUSTOMER && CUSTOMER._sub;
  return !!(s && s.active && (s.remaining || 0) > 0);
}
function fmtThaiDate(s) {
  if (!s) return '—';
  try { return new Date(s + 'T00:00:00').toLocaleDateString(lang === 'en' ? 'en-GB' : 'th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch (_e) { return s; }
}
async function openMembership() {
  const en = lang === 'en';
  $('#memberOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  const sh = $('#memberSheet');
  sh.innerHTML = `<button class="close" onclick="closeMembership()">×</button>
    <div style="text-align:center;padding:18px 0 6px">
      <div style="font-size:11px;letter-spacing:3px;color:var(--muted)">${en ? 'MEMBERSHIP' : 'สมาชิกรายเดือน'}</div>
      <div style="font-family:var(--display);font-size:24px;font-weight:700;color:var(--ink);margin-top:4px">Looper Membership</div>
      <div style="font-size:13px;color:var(--muted);margin-top:4px">${en ? 'rotate new looks every month' : 'หมุนเวียนลุคใหม่ได้ทุกเดือน คุ้มกว่าเช่ารายชุด'}</div>
    </div>
    <div id="memberBody" style="padding:6px 2px 24px">${en ? 'Loading…' : 'กำลังโหลด…'}</div>`;
  let sub = CUSTOMER._sub || { active: false };
  let plans = [];
  try { plans = await window.API.subPlans?.() || []; } catch (e) { /**/ }
  renderMembership(sub, plans);
}
function closeMembership() { $('#memberOverlay').classList.remove('open'); document.body.style.overflow = ''; }
function renderMembership(sub, plans) {
  const en = lang === 'en';
  const body = $('#memberBody'); if (!body) return;
  let html = '';
  // การ์ดสถานะปัจจุบัน (ถ้ามีสมาชิก)
  if (sub && sub.plan_code) {
    const paused = sub.status === 'paused';
    const remaining = sub.remaining != null ? sub.remaining : 0;
    html += `<div style="background:var(--soft);border:1px solid var(--line);border-radius:4px;padding:16px;margin-bottom:18px">
      <div style="font-size:11px;letter-spacing:2px;color:#0c3a33;background:var(--sage-bg);display:inline-block;padding:3px 10px;border-radius:30px">${paused ? (en ? 'PAUSED' : 'พักชั่วคราว') : (en ? 'ACTIVE' : 'กำลังใช้งาน')}</div>
      <div style="font-size:18px;font-weight:600;color:var(--ink);margin-top:8px">${sub.plan_name || ''}</div>
      <div style="display:flex;gap:16px;margin-top:10px">
        <div><div style="font-size:22px;font-weight:700;color:var(--ink)">${remaining}<span style="font-size:13px;font-weight:400;color:var(--muted)">/${sub.rentals_per_month || 0}</span></div><div style="font-size:11px;color:var(--muted)">${en ? 'looks left this cycle' : 'สิทธิ์เหลือรอบนี้'}</div></div>
        <div><div style="font-size:14px;color:var(--ink);margin-top:6px">${fmtThaiDate(sub.renews_at)}</div><div style="font-size:11px;color:var(--muted)">${sub.cancel_at_period_end ? (en ? 'ends on' : 'สิ้นสุด') : (en ? 'renews on' : 'รอบต่อไป')}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        ${paused
          ? `<button onclick="subActionClick('resume')" style="flex:1;background:var(--ink);color:#fff;border:none;padding:10px;font-size:12px;letter-spacing:1px;text-transform:uppercase">${en ? 'Resume' : 'กลับมาใช้'}</button>`
          : `<button onclick="subActionClick('pause')" style="flex:1;background:#fff;color:var(--ink);border:1px solid var(--ink);padding:10px;font-size:12px;letter-spacing:1px;text-transform:uppercase">${en ? 'Pause' : 'พักชั่วคราว'}</button>`}
        ${sub.cancel_at_period_end ? '' : `<button onclick="subActionClick('cancel')" style="flex:1;background:#fff;color:#A75F3A;border:1px solid #A75F3A;padding:10px;font-size:12px;letter-spacing:1px;text-transform:uppercase">${en ? 'Cancel' : 'ยกเลิก'}</button>`}
      </div>
    </div>
    <div style="font-size:12px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:10px">${en ? 'Change plan' : 'เปลี่ยนแพ็กเกจ'}</div>`;
  }
  // รายการแพ็กเกจ
  html += plans.map(p => {
    const current = sub && sub.plan_code === p.code && sub.status !== 'cancelled';
    const perks = (p.perks || []).map(x => `<div style="font-size:13px;color:var(--ink);padding:3px 0">· ${x}</div>`).join('');
    return `<div style="background:#fff;border:${current ? '2px solid var(--sage)' : '1px solid var(--line)'};border-radius:4px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div style="font-size:17px;font-weight:600;color:var(--ink)">${p.name}</div>
        <div style="font-size:16px;font-weight:600;color:var(--ink)">฿${Number(p.price_month).toLocaleString()}<span style="font-size:11px;font-weight:400;color:var(--muted)">/${en ? 'mo' : 'เดือน'}</span></div>
      </div>
      <div style="margin-top:8px">${perks}</div>
      ${current
        ? `<div style="text-align:center;font-size:12px;letter-spacing:1px;color:var(--sage);margin-top:12px;text-transform:uppercase">${en ? 'Current plan' : 'แพ็กเกจปัจจุบัน'}</div>`
        : `<button onclick="subscribeClick('${p.code}','${(p.name || '').replace(/'/g, '')}')" style="width:100%;background:var(--ink);color:#fff;border:none;padding:11px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin-top:12px">${en ? 'Choose this plan' : 'เลือกแพ็กเกจนี้'}</button>`}
    </div>`;
  }).join('');
  body.innerHTML = html;
}
async function subscribeClick(code, name) {
  const en = lang === 'en';
  if (!confirm(en ? `Subscribe to ${name}?` : `ยืนยันสมัครแพ็กเกจ ${name}?`)) return;
  try {
    await window.API.subscribe?.(CUSTOMER, code);
    CUSTOMER._sub = await window.API.mySubscription?.(CUSTOMER) || { active: false };
    let plans = []; try { plans = await window.API.subPlans?.() || []; } catch (e) { /**/ }
    renderMembership(CUSTOMER._sub, plans);
    toast(en ? 'Welcome to ' + name : 'ยินดีต้อนรับสู่ ' + name);
  } catch (e) { toast(en ? 'Something went wrong' : 'เกิดข้อผิดพลาด ลองใหม่นะคะ'); }
}
async function subActionClick(action) {
  const en = lang === 'en';
  const msg = action === 'cancel' ? (en ? 'Cancel at end of cycle?' : 'ยกเลิกเมื่อสิ้นรอบ?')
    : action === 'pause' ? (en ? 'Pause membership?' : 'พักสมาชิกชั่วคราว?')
    : (en ? 'Resume membership?' : 'กลับมาใช้สมาชิก?');
  if (!confirm(msg)) return;
  try {
    await window.API.subSetStatus?.(CUSTOMER, action);
    CUSTOMER._sub = await window.API.mySubscription?.(CUSTOMER) || { active: false };
    let plans = []; try { plans = await window.API.subPlans?.() || []; } catch (e) { /**/ }
    renderMembership(CUSTOMER._sub, plans);
  } catch (e) { toast(en ? 'Something went wrong' : 'เกิดข้อผิดพลาด ลองใหม่นะคะ'); }
}

// ===== ออเดอร์ของฉัน (My Rentals) =====
const COURIER_TRACK = {
  flash:'https://www.flashexpress.com/fle/tracking?se=',
  kerry:'https://th.kerryexpress.com/th/track/?track=',
  kex:'https://th.kerryexpress.com/th/track/?track=',
  jt:'https://www.jtexpress.co.th/index/query/gzquery.html?bills=',
  thaipost:'https://track.thailandpost.co.th/?trackNumber=',
  ninja:'https://www.ninjavan.co/th-th/tracking?id=',
};
function trackUrl(courier, no) {
  const base = COURIER_TRACK[(courier ||'').toLowerCase()];
  return base ? base + encodeURIComponent(no) : null;
}
function rentalStatusLabel(s) {
  const th = { reserved:'จองแล้ว', out:'จัดส่ง/กำลังใช้', returned:'คืนแล้ว', cancelled:'ยกเลิก'};
  const en = { reserved:'Reserved', out:'Shipped / In use', returned:'Returned', cancelled:'Cancelled'};
  return (lang ==='th'? th : en)[s] || s;
}
async function openOrders() {
  $('#ordersOverlay').classList.add('open');
  document.body.style.overflow ='hidden';
  const sh = $('#ordersSheet');
  sh.innerHTML =`
    <button class="close" onclick="closeOrders()">×</button>
    <div class="ordershead">
      <div class="ok">${lang ==='th'?'ออเดอร์ของฉัน':'My Rentals'}</div>
      <div class="ohead">${lang ==='th'?'ลุคที่คุณเช่าหมุนเวียน':'the looks you keep in the loop'}</div>
    </div>
    <div id="ordersBody" class="ordersbody"><div class="oloading">${lang ==='th'?'กำลังดึงออเดอร์…':'loading your rentals…'}</div></div>`;
  sh.scrollTop = 0;
  if (!CUSTOMER.id) {
    $('#ordersBody').innerHTML =`<div class="oempty">${lang ==='th'?'เข้าผ่าน LINE เพื่อดูข้อมูลส่วนตัว':'Sign in via LINE to see your rentals'}</div>`;
    return;
  }
  let rentals = [];
  try { rentals = await window.API.myRentals(CUSTOMER) || []; } catch (e) { console.warn(e); }
  renderOrders(rentals);
}
function closeOrders() { $('#ordersOverlay').classList.remove('open'); document.body.style.overflow =''; }
function renderOrders(rentals) {
  const body = $('#ordersBody'); if (!body) return;
  if (!rentals.length) {
    body.innerHTML =`<div class="oempty">${lang ==='th'?'ยังไม่มีออเดอร์ — เลือกชุดที่ถูกใจแล้วเริ่มลุคแรกของคุณได้เลย':'No rentals yet — pick a look you love to begin'}</div>`;
    return;
  }
  body.innerHTML = rentals.map(r => {
    const status = rentalStatusLabel(r.status);
    const stClass = r.status ==='returned'?'done' : r.status ==='cancelled'?'cancel' : r.status ==='out'?'out' :'res';
    const url = (r.courier && r.tracking_no) ? trackUrl(r.courier, r.tracking_no) : null;
    const ship = (r.courier && r.tracking_no) ?`
      <div class="orow"><span>${lang ==='th'?'ขนส่ง':'Courier'}</span>${
        url?`<a href="${url}" target="_blank" rel="noopener">${r.courier} · ${r.tracking_no}</a>`:`${r.courier} · ${r.tracking_no}`
      }${r.eta?` <i class="oeta">${lang ==='th'?'ถึงราว':'eta'} ${fmtDate(r.eta)}</i>`:''}</div>`:'';
    const reRent =`<button class="obtn" onclick="reRentByCode('${(r.code||'').replace(/'/g,"")}')">${lang ==='th'?'เช่าอีก':'Rent again'}</button>`;
    const review = r.status ==='returned'
      ?`<button class="obtn ghost" onclick="openReview('${r.rental_id}','${(r.name||'').replace(/'/g,"")}')">${lang ==='th'?'รีวิว':'Review'}</button>`:'';
    return`<div class="ocard">
      <div class="otop">
        <div class="oname">${r.name ||'—'}</div>
        <span class="ost ${stClass}">${status}</span>
      </div>
      <div class="orow"><span>${lang ==='th'?'วันที่ใช้':'Use date'}</span>${r.use_date? fmtDate(r.use_date):'—'}</div>
      <div class="orow"><span>${lang ==='th'?'กำหนดคืน':'Due back'}</span>${r.due_at? fmtDate(r.due_at):'—'}</div>
      ${ship}
      <div class="oactions">${reRent}${review}</div>
    </div>`;
  }).join('');
}
function reRentByCode(code) {
  const g = GARMENTS.find(x => (x.code || x.id) === code || x.code === code);
  if (!g) { toast(lang ==='th'?'ชุดนี้ยังไม่เปิดให้เช่าในตอนนี้':'This piece is not available right now'); return; }
  closeOrders();
  openDetail(g.id);
}

// ===== ฟอร์มรีวิว (หลังคืนชุด) =====
let _reviewRental = null, _reviewRating = 0, _reviewFit = null, _reviewPhotos = [];
function openReview(rentalId, name) {
  _reviewRental = rentalId; _reviewRating = 0; _reviewFit = null; _reviewPhotos = [];
  $('#reviewSheet').innerHTML =`
    <button class="close" onclick="closeReview()">×</button>
    <div class="rvhead">${lang ==='th'?'รีวิวลุคนี้':'Review this look'}</div>
    <div class="rvname">${name ||''}</div>
    <div class="rvlabel">${lang ==='th'?'ให้กี่ดาว':'Your rating'}</div>
    <div class="rvstars" id="rvStars">${[1,2,3,4,5].map(n =>`<span class="rvstar" data-n="${n}" onclick="setReviewRating(${n})">★</span>`).join('')}</div>
    <div class="rvlabel">${lang ==='th'?'ความพอดี':'How did it fit'}</div>
    <div class="rvfit" id="rvFit">
      <button data-f="tight" onclick="setReviewFit('tight')">${lang ==='th'?'คับไป':'A bit tight'}</button>
      <button data-f="perfect" onclick="setReviewFit('perfect')">${lang ==='th'?'พอดี':'Perfect'}</button>
      <button data-f="loose" onclick="setReviewFit('loose')">${lang ==='th'?'หลวมไป':'A bit loose'}</button>
    </div>
    <div class="rvlabel">${lang ==='th'?'อยากเล่าเพิ่ม (ถ้ามี)':'Anything to add (optional)'}</div>
    <textarea id="rvComment" class="rvtext" rows="3" placeholder="${lang ==='th'?'ชอบตรงไหน ใส่ไปงานอะไร…':'What you loved, where you wore it…'}"></textarea>
    <div class="rvphotos">
      <div class="rvvtitle">${lang ==='th'?'แนบรูปที่ใส่จริง รับเครดิต +฿15':'Add a photo wearing it — earn ฿15'}</div>
      <div class="rvvhint">${lang ==='th'?'รูปจริงของคุณจะไปโชว์ในหน้าชุด ช่วยให้เพื่อน ๆ ตัดสินใจง่ายขึ้น':'Your real photo appears on the dress page to help others'}</div>
      <input type="file" accept="image/*" multiple onchange="reviewPhotoUpload(this)">
      <div class="rvthumbs" id="rvThumbs"></div>
    </div>
    <div class="rvvideo">
      <div class="rvvtitle">${lang ==='th'?'ทำคลิปรีวิว รับเครดิตเพิ่ม ฿120':'Post a video review — earn ฿120 credit'}</div>
      <div class="rvvhint">${lang ==='th'?'โพสต์คลิปรีวิวบริการเราในโซเชียล แล้วแปะลิงก์ + พิมพ์สั้น ๆ ว่ารีวิวว่าอะไร — ระบบตรวจให้ ได้เครดิตเมื่อเป็นรีวิวเชิงบวก' : 'Post a clip reviewing us, paste the link + a short summary'}</div>
      <select id="rvPlatform" class="rvtext"><option value="">${lang ==='th'?'เลือกแพลตฟอร์ม':'Platform'}</option><option>TikTok</option><option>Instagram</option><option>YouTube</option><option>Facebook</option><option>${lang ==='th'?'อื่น ๆ':'Other'}</option></select>
      <input id="rvVideo" class="rvtext" placeholder="${lang ==='th'?'ลิงก์คลิปรีวิว https://...':'Video link https://...'}">
      <textarea id="rvVideoText" class="rvtext" rows="2" placeholder="${lang ==='th'?'พิมพ์สั้น ๆ ว่าในคลิปรีวิวว่าอะไร':'Summarize what you said in the clip'}"></textarea>
    </div>
    <button class="rvsubmit" onclick="submitReview()">${lang ==='th'?'ส่งรีวิว':'Send review'}</button>`;
  $('#reviewOverlay').classList.add('open');
  document.body.style.overflow ='hidden';
  $('#reviewSheet').scrollTop = 0;
}
function closeReview() { $('#reviewOverlay').classList.remove('open'); document.body.style.overflow =''; }
function setReviewRating(n) {
  _reviewRating = n;
  document.querySelectorAll('#rvStars .rvstar').forEach(s => s.classList.toggle('on', +s.dataset.n <= n));
}
function setReviewFit(f) {
  _reviewFit = f;
  document.querySelectorAll('#rvFit button').forEach(b => b.classList.toggle('on', b.dataset.f === f));
}
// อัปรูปในรีวิว → เก็บ url + โชว์ thumb
async function reviewPhotoUpload(input) {
  const files = [...input.files]; if (!files.length) return;
  files.forEach(f => { const im = document.createElement('img'); im.src = URL.createObjectURL(f); im.className = 'rvthumb'; $('#rvThumbs').appendChild(im); });
  try { const urls = await window.API.uploadPhotos(files); _reviewPhotos.push(...urls); } catch (e) { /**/ }
  input.value = '';
}
async function submitReview() {
  if (!_reviewRating) { toast(lang ==='th'?'ให้ดาวก่อนนะคะ':'Pick a star rating first'); return; }
  const comment = ($('#rvComment') && $('#rvComment').value || '').trim();
  const video = ($('#rvVideo') && $('#rvVideo').value || '').trim();
  closeReview();
  if (video) {
    const platform = $('#rvPlatform') ? $('#rvPlatform').value : '';
    const vtext = ($('#rvVideoText') && $('#rvVideoText').value || '').trim();
    try { await window.API.submitVideoReview(_reviewRental, _reviewRating, _reviewFit, comment, video, platform, vtext); } catch (e) { console.warn(e); }
    toast(lang ==='th'?'รับคลิปรีวิวแล้ว! ตรวจสอบเสร็จจะเพิ่มเครดิตให้นะคะ':'Got your video review! Credit added once verified');
  } else {
    const photos = _reviewPhotos.length ? _reviewPhotos : null;
    try { await window.API.addReview(_reviewRental, _reviewRating, _reviewFit, comment, photos); } catch (e) { console.warn(e); }
    toast(photos
      ? (lang ==='th'?'ขอบคุณที่แชร์รูปจริง! +฿15 — คุณช่วยให้วงจรหมุนเวียนแข็งแรง รักษ์โลกไปด้วยกันนะคะ':'Thank you for sharing! +฿15 — you keep our loop strong')
      : (lang ==='th'?'ขอบคุณสำหรับรีวิวค่ะ ช่วยให้ชุมชนหมุนเวียนแข็งแรงขึ้น':'Thank you — you make our community stronger'));
  }
}
function animateCounts(root) {
  root.querySelectorAll('b[data-to]').forEach(el => {
    const to = +el.dataset.to, pre = el.dataset.prefix || '', dur = 1100;
    let start = null, raf = 0;
    const set = k => { const e = 1 - Math.pow(1 - k, 3); el.textContent = pre + Math.round(to * e).toLocaleString(); };
    function step(t) { if (start === null) start = t; const k = Math.min(1, (t - start) / dur); set(k); if (k < 1) raf = requestAnimationFrame(step); }
    raf = requestAnimationFrame(step);
    // กันกรณี rAF ถูก throttle (เช่นแท็บไม่ active) — การันตีเลขสุดท้ายเสมอ
    setTimeout(() => { cancelAnimationFrame(raf); set(1); }, dur + 250);
  });
}
function pickSeason(s) { pSeason = s; document.querySelectorAll('.seasonbtn').forEach(b => b.classList.toggle('active', b.dataset.s === s)); }
function closeProfile() { $('#pOverlay').classList.remove('open'); document.body.style.overflow =''; }
async function saveProfile() {
  CUSTOMER.name = $('#pName').value;
  CUSTOMER.height_cm = +$('#pHeight').value || null;
  CUSTOMER.shoe_size = $('#pShoe').value;
  CUSTOMER.bust_in = +$('#pBust').value || null;
  CUSTOMER.waist_in = +$('#pWaist').value || null;
  CUSTOMER.hip_in = +$('#pHip').value || null;
  CUSTOMER.my_color_season = pSeason;
  CUSTOMER.notes = $('#pNotes').value;
  CUSTOMER.phone = $('#pPhone') ? $('#pPhone').value : CUSTOMER.phone;
  CUSTOMER.address = $('#pAddress') ? $('#pAddress').value : CUSTOMER.address;
  closeProfile();
  renderFilters(); renderGrid();
  toast(t('saved'));
  try { await window.API.saveProfile?.(CUSTOMER); } catch (e) { console.warn(e); }
}

function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

// ===== กฎ/สัญญาการใช้บริการ (ยอมรับก่อนใช้งานครั้งแรก) =====
let _termsVersion = null;
async function maybeShowTerms() {
  let terms; try { terms = await window.API.getTerms?.(); } catch (e) { return; }
  if (!terms ||!terms.version) return;
  if (CUSTOMER.terms_accepted_version === terms.version) return; // ยอมรับเวอร์ชันล่าสุดแล้ว
  _termsVersion = terms.version;
  $('#termsBody').textContent = terms.body;
  $('#termsOverlay').classList.add('open');
  document.body.style.overflow ='hidden';
}
async function acceptTermsClick() {
  $('#termsOverlay').classList.remove('open');
  document.body.style.overflow ='';
  CUSTOMER.terms_accepted_version = _termsVersion;
  try { await window.API.acceptTerms(CUSTOMER, _termsVersion); } catch (e) { console.warn(e); }
  maybeOnboard();
}
// ต้อนรับครั้งแรก: login ผ่าน LINE แล้ว แต่ยังไม่มีข้อมูลสำคัญ → เด้งฟอร์มกรอกครั้งเดียว
function maybeOnboard() {
  const c = CUSTOMER;
  const loggedIn =!!(c.line_uid || c.display_name || c.picture_url);
  if (!loggedIn) return;
  if (sessionStorage.getItem('lloop_onboarded')) return;
  if ($('#termsOverlay').classList.contains('open')) return; // รอยอมรับ terms ก่อน
  const incomplete =!c.phone && c.height_cm == null &&!c.address; // ยังไม่เคยกรอก
  if (!incomplete) return;
  sessionStorage.setItem('lloop_onboarded','1');
  setTimeout(() => openProfile(true), 450);
}
// การ์ดอิมแพกต์รักษ์โลก (โชว์ในโปรไฟล์)
function renderImpactCard() {
  const im = CUSTOMER._impact;
  if (!im || !im.rentals) {
    return `<div class="ecocard new">${lang === 'th' ? 'ทุกครั้งที่คุณเลือกเช่าแทนซื้อ คือการเซฟทรัพยากรของโลก — เริ่มลุคแรกของคุณกับเราได้เลย' : 'Every time you rent instead of buy, you save the planet — start your first look with us'}</div>`;
  }
  const charity = im.charity_thb ? `<div class="ecocharity">${lang === 'th' ? 'และคุณได้สมทบทุน' : 'and you have given'} <b data-to="${im.charity_thb}" data-prefix="฿">฿0</b> ${lang === 'th' ? `ให้${im.charity_name || 'เด็กยากไร้'} ผ่านทุกการเช่าของคุณ` : `to ${im.charity_name || 'children in need'}`}</div>` : '';
  return `<div class="ecocard tappable" onclick="openImpact()">
    <div class="ecokick">${lang === 'th' ? 'ทุกการเลือกของคุณ สร้างความเปลี่ยนแปลง' : 'every choice you make matters'}</div>
    <div class="ecohead">${lang === 'th' ? 'สิ่งที่คุณช่วยเซฟไปแล้ว' : 'what you have saved so far'}</div>
    <div class="ecostats">
      <div><b data-to="${im.rentals}">0</b><span>${lang === 'th' ? 'ครั้งที่หมุนเวียน' : 'rotations'}</span></div>
      <div><b data-to="${im.water_l || 0}">0</b><span>${lang === 'th' ? 'ลิตรน้ำ' : 'litres water'}</span></div>
      <div><b data-to="${im.co2_kg || 0}">0</b><span>${lang === 'th' ? 'กก. คาร์บอน' : 'kg carbon'}</span></div>
    </div>
    <div class="ecotag">${lang === 'th' ? 'เช่าแทนซื้อ คือความสวยที่ไม่ทิ้งภาระไว้ให้โลก' : 'rent over buy — beauty that leaves no burden'}</div>
    ${charity}
    <div class="ecomore">${lang === 'th' ? 'แตะเพื่อดูภาพกิจกรรมที่คุณเป็นส่วนหนึ่ง' : 'tap to see the moments you are part of'} <span>&rarr;</span></div>
  </div>`;
}

[$('#overlay'), $('#pOverlay')].forEach(o => o.addEventListener('click', e => {
  if (e.target === o) { closeDetail(); closeProfile(); }
}));
// ปิด overlay ใหม่เมื่อแตะพื้นหลัง
[['#ordersOverlay', closeOrders], ['#reviewOverlay', closeReview]].forEach(([sel, fn]) => {
  const o = $(sel); if (o) o.addEventListener('click', e => { if (e.target === o) fn(); });
});

async function boot() {
  $('#langTH').classList.toggle('on', lang ==='th');
  $('#langEN').classList.toggle('on', lang ==='en');
  applyStatic();
  let s;
  try { s = await window.API.init(); }
  catch (e) { console.warn('init failed, fallback to mock', e); s = window.MOCK; }
  OCCASIONS = s.OCCASIONS; CUSTOMER = s.CUSTOMER; EVENT = s.EVENT; GARMENTS = s.GARMENTS;
  VENUES = window.MOCK.VENUES;
  // มีโปรไฟล์ (ไซซ์/โทนสี/สไตล์จากพาร์ทเนอร์) เปิด"แนะนำสำหรับคุณ"เป็นค่าเริ่มต้น
  fForYou =!!(CUSTOMER.bust_in!= null || CUSTOMER.my_color_season || (CUSTOMER.style_profile && Object.keys(CUSTOMER.style_profile).length));
  // สถานะล็อกอิน: มี lineUid = ล็อกอินผ่าน LINE แล้ว → โชว์เครดิตจริง; ไม่มี = guest → โชว์ปุ่มเข้าสู่ระบบ
  const loggedIn =!!s.lineUid;
  const loginBtn = $('#loginBtn'); const creditEl = document.querySelector('.credit');
  if (loginBtn) loginBtn.hidden = loggedIn;
  if (creditEl) creditEl.hidden =!loggedIn;
  $('#credit').textContent ='฿'+ (CUSTOMER.credit_balance || 0);
  try { CUSTOMER._impact = await window.API.myImpact?.(CUSTOMER); } catch (e) { /**/ }
  // โหลดรายการที่หมายตา (wishlist) — guard กรณีไม่ได้ล็อกอิน
  try { gWish = await window.API.myWishlist?.(CUSTOMER) || new Set(); } catch (e) { gWish = new Set(); }
  // โหลดสถานะสมาชิกรายเดือน (subscription)
  try { CUSTOMER._sub = await window.API.mySubscription?.(CUSTOMER) || { active: false }; } catch (e) { CUSTOMER._sub = { active: false }; }
  // เดโม: ยังไม่ได้ล็อกอินผ่าน LINE (เปิดบน localhost) ใส่ตัวอย่างให้หน้าผลกระทบดูมีชีวิต
  if (!CUSTOMER._impact) CUSTOMER._impact = { rentals: 6, water_l: 16200, co2_kg: 36, charity_thb: 126, charity_name: 'โครงการเสื้อผ้าเพื่อน้อง' };
  renderEvent(); renderCatnav(); renderChips(); renderFilters(); renderDatebar(); renderGrid();
  await maybeShowTerms();
  maybeOnboard();
  routeDeepLink();
}
// rich menu deep-link: เปิด LIFF ?go=foryou|orders|impact|profile|stylist แล้วเด้งไปหน้านั้น
function routeDeepLink() {
  try {
    const qs = new URLSearchParams(location.search);
    const ls = (window.liff && liff.state) ? new URLSearchParams((liff.state || '').replace(/^\?/, '')) : null;
    // deep-link จากการ์ด LINE: ?garment=CODE → เปิด detail ของชุดนั้นทันที
    const gcode = qs.get('garment') || (ls && ls.get('garment'));
    if (gcode) {
      const g = GARMENTS.find(x => (x.code || '').toLowerCase() === gcode.toLowerCase());
      if (g) { setTimeout(() => openDetail(g.id), 80); return; }
    }
    let go = qs.get('go') || (ls && ls.get('go'));
    if (!go) return;
    setTimeout(() => {
      if (go === 'foryou') { if (!fForYou) toggleForYou(); }
      else if (go === 'orders') openOrders();
      else if (go === 'membership') openMembership();
      else if (go === 'impact') openImpact();
      else if (go === 'profile') openProfile();
      else if (go === 'stylist') { const el = $('#venueInput'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } }
    }, 80);
  } catch (_e) { /**/ }
}
boot();
