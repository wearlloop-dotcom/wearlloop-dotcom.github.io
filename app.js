// ===== state =====
let OCCASIONS = {}, CUSTOMER = {}, EVENT = null, GARMENTS = [], VENUES = [];
// ส่วนลดพนักงาน: STAFF_PCT>0 เฉพาะพนักงาน → โชว์ราคาลด + ป้าย (ลูกค้าทั่วไป=0 ไม่เปลี่ยนอะไร)
let STAFF_PCT = 0;
const staffPrice = (p) => STAFF_PCT > 0 ? Math.round(Number(p || 0) * (1 - STAFF_PCT / 100)) : Number(p || 0);
const staffTag = () => STAFF_PCT > 0 ? `<span style="display:inline-block;font-size:11px;font-weight:600;color:#0F6E56;background:#E4F0EC;border:1px solid #cfe6da;border-radius:20px;padding:1px 8px;margin-left:6px">${lang==='th'?'พนักงาน':'Staff'} −${STAFF_PCT}%</span>` : '';
let fOccasion = null, fColor = null, fBrand ='', fToneOnly = false, fForYou = false, fWishOnly = false;
let gUseDate = null, gAvailSet = null, gOnlyAvail = false;  // เลือกวันใช้ตั้งแต่หน้าแรก
let gStylistPending = false;  // กดแนะนำแต่ยังไม่เลือกวัน → พอเลือกแล้วยิงต่อให้เอง
let gWish = new Set();  // garment id ที่หมายตา (wishlist)
let gDur = 3;           // ระยะเวลาเช่า (วัน) ในหน้ารายละเอียด
let gCart = [];         // ตะกร้าจองหลายชุด → [{id,code,name,price}]

// บวกวันแบบ local (กัน toISOString เลื่อนโซน +7) → คืน 'YYYY-MM-DD'
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function durEnd(fromStr) { return addDays(fromStr, gDur - 1); }
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
  $('#langTH')?.classList.toggle('on', l ==='th');
  $('#langEN')?.classList.toggle('on', l ==='en');
  closeDetail(); closeProfile();
  applyStatic();
  renderEvent(); renderCatnav(); renderChips(); renderFilters(); renderGrid();
  $('#vresult').classList.remove('show');
}

// Fit confidence — mirror SQL fit_confidence() (+ fit feedback loop)
function fitConfidence(c, g) {
  if (c.bust_in == null ||!g.bust) return null;
  let score = 100;
  let slack = g.stretch ==='stretchy'? 2 : g.stretch ==='slight'? 1 : 0;
  // ★ ปรับด้วยฟีดแบ็กจริงจากลูกค้า (loop) — เลื่อน slack ตาม fitAvg ถ่วงด้วยจำนวนรีวิว
  if ((g.fitN||0) >= 3 && g.fitAvg != null) {
    const adj = g.fitAvg * 0.5 * (Math.min(g.fitN,8)/8);   // ~ -1..+1
    slack = Math.max(-1, Math.min(2.5, slack + adj));
  }
  if (c.bust_in < g.bust[0] - slack) score -= (g.bust[0] - slack - c.bust_in) * 12;
  else if (c.bust_in > g.bust[1] + slack) score -= (c.bust_in - g.bust[1] - slack) * 18;
  if (c.waist_in!= null && g.waist) {
    if (c.waist_in > g.waist[1] + slack) score -= (c.waist_in - g.waist[1] - slack) * 15;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
// โน้ตฟิตจากลูกค้าจริง (โชว์เมื่อมีรีวิวพอ) — คืน {text,cls} หรือ null
function fitNote(g) {
  if (!g || (g.fitN||0) < 3 || !g.fitLabel) return null;
  if (g.fitLabel === 'small') return { text:'ลูกค้าบอกตัวนี้ใส่ค่อนข้างเล็ก — เผื่อไซซ์', cls:'small' };
  if (g.fitLabel === 'large') return { text:'ลูกค้าบอกตัวนี้ใส่ค่อนข้างหลวม', cls:'large' };
  return { text:'ลูกค้าส่วนใหญ่บอกว่าใส่พอดี', cls:'true' };
}

// ความคุ้ม — ประหยัดกี่ % เทียบมูลค่าชุด (replacement_value)
function savingsPct(g) {
  if (!g || !g.retail || !g.price || g.retail <= g.price) return null;
  return Math.round((1 - g.price / g.retail) * 100);
}
// แถบความคุ้ม + ความสะอาด (โชว์ในหน้า detail) — โชว์เฉพาะเมื่อมีข้อมูล
function valueStrip(g) {
  const th = lang === 'th';
  const sv = savingsPct(g);
  const parts = [];
  if (sv) parts.push(`<span style="background:#EAF3DE;color:#27500A;padding:4px 10px;border-radius:6px;font-size:12px">${th?'มูลค่าชุด':'Worth'} ฿${Number(g.retail).toLocaleString()} · ${th?'เช่าประหยัด':'save'} ${sv}%</span>`);
  if (g.grade) parts.push(`<span style="background:#E1F5EE;color:#085041;padding:4px 10px;border-radius:6px;font-size:12px">${th?'ผ่าน QC เกรด':'QC grade'} ${g.grade} · ${th?'ดูแลอย่างดี':'well kept'}</span>`);
  if (!parts.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">${parts.join('')}</div>`;
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
];
  // หมายเหตุ: รายการบัญชี/นำทาง (ครอบครัว/ออเดอร์/สมาชิก/impact/โปรไฟล์) ย้ายไปอยู่ใน
  // เมนูรวม (☰ openMenu) แล้ว — catnav เหลือเฉพาะ "ฟิลเตอร์สินค้า" เพื่อไม่ให้ปนหน้าที่กัน
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
    const fn = fitNote(g);
    const match = g.season === CUSTOMER.my_color_season;
    const av = availOf(g);
    const sv = savingsPct(g);
    const dots = g.colors.map(c =>`<i style="background:${c[1]}"></i>`).join('');
    return`<div class="pcard ${gUseDate && !av ? 'busy' : ''}" onclick="openDetail('${g.id}')">
      <div class="pphoto" style="background:${g.bg}">
        <span class="ph">${g.name}</span>
        <button class="wish ${gWish.has(g.id)?'on':''}" onclick="toggleWish('${g.id}',event)" aria-label="wishlist">♥</button>
        <div class="badges">
          ${gUseDate ? `<span class="bdg ${av ? 'avail' : 'busy'}">${av ? (lang === 'th' ? 'ว่าง ' + fmtDate(gUseDate) : 'free ' + fmtDate(gUseDate)) : (lang === 'th' ? 'ไม่ว่าง' : 'booked')}</span>` : ''}
          ${g.isNew?`<span class="bdg new">NEW</span>`:''}
          ${match?`<span class="bdg tone">${t('toneMatch')}</span>`:''}
          ${sv?`<span class="bdg" style="background:#27500A;color:#fff">${lang==='th'?'ประหยัด ':'save '}${sv}%</span>`:''}
        </div>
        <div class="hoverbar">
          <div class="try">${lang ==='th'?'ลองดูเลย':'View'} ›</div>
          <div class="sizes">
            ${fit!= null?`<span>${t('fitGood')} ${fit}%</span>`:''}
            <span>${occName(g.occasion_tags[0])}</span>
            <span>฿${staffPrice(g.price)}</span>
          </div>
        </div>
      </div>
      <div class="pmeta">
        <div class="pbrand">${g.brand ||''}</div>
        <div class="pname">${g.name}</div>
        <div class="pprice">฿${staffPrice(g.price)}${staffTag()} <span style="color:var(--muted);font-weight:400">/ ${t('perTime')}</span></div>
        <div class="pcolors">${dots}</div>
        ${fn?`<div class="fitnote ${fn.cls}">${fn.text}</div>`:''}
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
  // sync ช่องวันที่ทั้งสองจุด (แถบ stylist + datebar ใต้กริด)
  const vd = $('#venueDate'); if (vd) { vd.value = gUseDate || ''; vd.classList.remove('need'); }
  renderDatebar(); renderGrid();
  // ถ้าค้างรอเลือกวันอยู่ (กดแนะนำไปแล้วแต่ยังไม่มีวัน) → ยิงต่อให้เอง
  if (gUseDate && gStylistPending) { gStylistPending = false; askVenue(); }
}
function clearHomeDate() { gUseDate = null; gAvailSet = null; gOnlyAvail = false; renderDatebar(); renderGrid(); }
function toggleOnlyAvail() { gOnlyAvail = !gOnlyAvail; renderDatebar(); renderGrid(); }

// ===== AI Stylist ประจำสถานที่: ประเมินความเหมาะสม/สวยงาม/คล่องตัว + แนะนำชุดจากคลัง =====
function esc(s){ return String(s==null?'':s).replace(/[<>&"]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c];}); }

// แสดงโควต้าที่เหลือบนแถบสไตลิสต์ (null = ยังไม่ล็อกอิน)
async function refreshStylistQuota() {
  const chip = $('#stylistQuota'); if (!chip) return;
  let n = null;
  try { n = await window.API.stylistQuota?.(); } catch (_e) {}
  if (n == null) { chip.hidden = false; chip.innerHTML = `<b>${t('vLoginNeed')}</b>`; return; }
  chip.hidden = false;
  chip.innerHTML = `${t('vQuotaLeft')} <b>${n}</b> ${t('vQuotaTimes')}`;
  chip._n = n;
}

async function askVenue() {
  const q = ($('#venueInput').value ||'').trim();
  const place = window.SELECTED_PLACE && (window.SELECTED_PLACE.name === q || !q) ? window.SELECTED_PLACE : null;
  const el = $('#vresult');
  if (!q && !place) { el.classList.remove('show'); return; }
  // ต้องล็อกอินก่อน (โควต้าผูกกับบัญชี)
  if (!CUSTOMER.id) {
    el.className = 'vresult show';
    el.innerHTML = `<div class="note"><b style="color:var(--ink)">${t('vLoginNeed')}</b></div>`;
    return;
  }
  // บังคับเลือกวันที่ก่อน — เพื่อแนะนำเฉพาะชุดที่ว่างวันนั้น
  if (!gUseDate) {
    gStylistPending = true;
    el.className = 'vresult show';
    el.innerHTML = `<div class="note"><b style="color:var(--ink)">${t('vPickDate')}</b></div>`;
    const di = $('#venueDate'); if (di) { di.classList.add('need'); try { di.focus(); di.showPicker && di.showPicker(); } catch (_e) {} }
    return;
  }
  const name = place ? place.name : q;
  el.className ='vresult show';
  el.innerHTML =`<span class="note">${t('vAnalyzingPre')} “${esc(name)}”…</span>`;

  const v = await window.API.stylist({ venue: name, place, occasion: EVENT && EVENT.occasion, date: gUseDate }, lang);

  if (!v || v.ok === false) {
    const msg = v && v.error === 'no_quota' ? t('vNoQuota')
      : v && v.error === 'unauthorized' ? t('vLoginNeed')
      : (lang === 'th' ? 'ขออภัย ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง' : 'Sorry, something went wrong — please try again');
    el.innerHTML = `<div class="note"><b style="color:var(--ink)">${msg}</b></div>`;
    if (v && typeof v.remaining === 'number') { const c = $('#stylistQuota'); if (c) { c.hidden=false; c.innerHTML = `${t('vQuotaLeft')} <b>${v.remaining}</b> ${t('vQuotaTimes')}`; } }
    return;
  }

  const sw = (v.recommended_colors || []).map(c =>
`<span class="sw" style="background:${esc(c.hex)}" title="${esc(c.name||'')}" onclick="setColorFromVenue('${esc(c.hex)}')"></span>`).join('');

  // จับชุดแนะนำเข้ากับ GARMENTS ที่โหลดไว้ (เพื่อรูป + เปิดรายละเอียด)
  const picks = (v.recommended_garments || []).map(rg => {
    const g = GARMENTS.find(x => x.code === rg.code);
    if (!g) return '';
    const photo = g.photo || (Array.isArray(g.photos) && g.photos[0]);
    const thumb = photo ? `background-image:url('${esc(photo)}')` : `background:${esc(g.bg||'#E7E2DA')}`;
    const free = gUseDate ? `<span class="pfree">${lang==='th'?'ว่าง '+fmtDate(gUseDate):'free '+fmtDate(gUseDate)}</span>` : '';
    return `<div class="vpick" onclick="openDetail('${esc(g.id)}')">
      <div class="pthumb" style="${thumb}"></div>
      <div class="pbody">
        <div class="pname">${esc(g.name)}${free}</div>
        <div class="pwhy">${esc(rg.why||'')}</div>
        ${rg.fit_note?`<div class="pfit">${esc(rg.fit_note)}</div>`:''}
      </div>
      <span class="popen">${t('vOpenGarment')}</span>
    </div>`;
  }).filter(Boolean).join('');

  const dc = v.has_dress_code ? `<span class="dc">${esc(dressName(v.dress_code_th) || v.dress_code_th || '—')}</span>`
                             : `<span class="dc" style="background:var(--stone)">${t('vDressCodeOff')}</span>`;
  const mapEmbed = mapEmbedHtml(place);
  // รูปจริงของสถานที่ (จาก Google Place) — โชว์เป็นแบนเนอร์บนสุดของผลลัพธ์
  const placePhoto = (place && place.photo_url)
    ? `<div class="vphoto"><img src="${esc(place.photo_url)}" alt="${esc(name)}" loading="lazy" onerror="this.parentNode.remove()"><span class="cap">${esc(name)}</span></div>`
    : '';
  const link = v.occasion?` · <a href="#" onclick="setOccasion('${esc(v.occasion)}');return false">${t('vViewPre')} ${esc(occName(v.occasion))}</a>`:'';

  const dimRow = (k, val) => val ? `<div class="vrow"><span class="vk">${k}</span><span class="vv">${esc(val)}</span></div>` : '';
  const dims = dimRow(t('vAppropriate'), v.appropriateness) + dimRow(t('vAesthetics'), v.aesthetics) + dimRow(t('vMobility'), v.mobility);
  const tips = (v.photo_tip?`<div class="tip"><span class="tk">${t('vPhoto')}</span> ${esc(v.photo_tip)}</div>`:'')
             + (v.avoid?`<div class="tip"><span class="tk">${t('vAvoid')}</span> ${esc(v.avoid)}</div>`:'');
  // โชว์ชุดเป็นพระเอก — รูป+dress code+สี+ชุด มาก่อน · เหตุผล (3 มิติ/tip) ย่อใต้ปุ่ม
  el.innerHTML =`
    ${placePhoto}
    <div class="vhead">${dc}${v.venue_type?`<span class="vtype">${esc(v.venue_type)}</span>`:''}</div>
    <div class="vcolors">${t('vColors')} ${sw}${v.palette_source==='photo'?`<span class="vphtag">${t('vFromPhoto')}</span>`:''}</div>
    ${picks?`<div class="vpicks"><div class="ph">${t('vPicksLead')}</div>${picks}</div>`:''}
    <details class="vwhy">
      <summary>${t('vWhy')}</summary>
      <div class="vwhybody">
        <div class="vbasis">${t('vBasis')}</div>
        <div class="vdims">${dims}</div>
        ${tips?`<div class="vtips">${tips}</div>`:''}
      </div>
    </details>
    ${mapEmbed}
    <div class="vfoot">${t('vTapColor')}${link} · ${t('vBonusHint')}</div>`;

  if (v.occasion) setOccasion(v.occasion);
  if (typeof v.remaining === 'number') { const c = $('#stylistQuota'); if (c) { c.hidden=false; c.innerHTML = `${t('vQuotaLeft')} <b>${v.remaining}</b> ${t('vQuotaTimes')}`; } }
}

// แผนที่ฝัง (Maps Embed API) — ต้องมี key + พิกัด/place_id ไม่งั้นไม่โชว์
function mapEmbedHtml(place) {
  const key = (window.CONFIG && window.CONFIG.GOOGLE_MAPS_KEY) || '';
  if (!key || !place) return '';
  let q = '';
  if (place.place_id) q = 'place_id:' + place.place_id;
  else if (place.lat != null && place.lng != null) q = place.lat + ',' + place.lng;
  else if (place.name) q = encodeURIComponent(place.name);
  if (!q) return '';
  const src = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${q}`;
  return `<div class="vmap"><iframe loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="${src}"></iframe><div class="cap">${t('vMapNote')}: ${esc(place.name||'')}</div></div>`;
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
    ${valueStrip(g)}
    ${subCovers(g) ? '' : `<div class="durpick">
      <span class="durlbl">${lang==='th'?'ระยะเวลาเช่า':'Duration'}</span>
      <div class="durchips" id="durchips">
        <button data-d="1" class="${gDur===1?'on':''}" onclick="setDur('${g.id}',1)">${lang==='th'?'1 วัน':'1 day'}</button>
        <button data-d="3" class="${gDur===3?'on':''}" onclick="setDur('${g.id}',3)">${lang==='th'?'3 วัน':'3 days'}</button>
        <button data-d="5" class="${gDur===5?'on':''}" onclick="setDur('${g.id}',5)">${lang==='th'?'5 วัน':'5 days'}</button>
      </div>
    </div>
    <div id="quotebox" class="quotebox"></div>`}
    <div class="cta">
      <span class="price">${subCovers(g) ? `<span style="color:var(--sage)">${lang==='th'?'รวมในแพ็กเกจ':'Included in plan'}</span>` : '฿'+staffPrice(g.price)+staffTag()}</span>
      ${subCovers(g) ? '' : `<button class="cartbtn" onclick="addToCart('${g.id}')" title="${lang==='th'?'เพิ่มลงตะกร้า':'Add to cart'}">+ ${lang==='th'?'ตะกร้า':'Cart'}</button>`}
      <button id="bookBtn" onclick="reserve('${g.id}')">${t('reserveBtn')}</button>
    </div>
    ${(window.BDAY && window.BDAY.voucher && window.BDAY.voucher.active && !subCovers(g))
      ? `<button class="bdaybtn" onclick="bdayBook('${g.id}')">${lang==='th'
          ? (g.price<=window.BDAY.voucher.value_cap?'ใช้สิทธิ์วันเกิด · เช่าฟรี':`ใช้สิทธิ์วันเกิด · จ่ายเพิ่ม ฿${g.price-window.BDAY.voucher.value_cap}`)
          : (g.price<=window.BDAY.voucher.value_cap?'Use birthday gift · free':`Use birthday gift · pay ฿${g.price-window.BDAY.voucher.value_cap}`)}</button>`
      : ''}
    ${subCovers(g)
      ? `<div class="creditline">${lang==='th'?`ใช้สิทธิ์สมาชิก ${CUSTOMER._sub.plan_name} · เหลือ ${CUSTOMER._sub.remaining} ชุดรอบนี้ · ส่งฟรีขาไป (ค่าส่งคืนผู้เช่าออกเอง)`:`Using ${CUSTOMER._sub.plan_name} · ${CUSTOMER._sub.remaining} left · free outbound (return shipping on you)`}</div>`
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
  html += `<div class="calnote">${lang === 'th' ? 'วันไม่ว่างรวมเวลาส่ง+ซัก+รีดของชุดด้วย เพื่อให้คุณได้ชุดสะอาดตรงวัน' : 'Booked days include shipping + cleaning time so your piece arrives fresh on time'}</div>`;
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
  renderQuote(id, date);
  return free;
}

// เลือกระยะเวลาเช่า → คำนวณยอดใหม่
function setDur(id, d) {
  gDur = d;
  document.querySelectorAll('#durchips button').forEach(b => b.classList.toggle('on', +b.dataset.d === d));
  const date = $('#useDate') && $('#useDate').value;
  if (date) renderQuote(id, date);
}

// สรุปยอดเต็ม: ค่าเช่า + มัดจำ + ค่าส่ง + วันส่ง/คืน (เรียก quote_rental)
async function renderQuote(id, date) {
  const box = $('#quotebox'); if (!box) return;
  const g = GARMENTS.find(x => x.id === id); if (!g) return;
  if (subCovers(g)) { box.innerHTML = ''; return; }
  if (!date) { box.innerHTML = ''; return; }
  const to = durEnd(date);
  let q = null;
  try { q = await window.API.quote(g.code || g.id, CUSTOMER, date, to); } catch (e) { /**/ }
  if (!q || q.error) { box.innerHTML = ''; return; }
  const TH = lang === 'th';
  const row = (k, v, hl) => `<div class="qrow${hl ? ' hl' : ''}"><span>${k}</span><b>${v}</b></div>`;
  const baht = n => '฿' + n;
  // ช่องทางชำระ (บัญชี/พร้อมเพย์ QR) — โชว์ใต้ยอดรวม
  let pay = null; try { pay = await window.API.payInfo(); } catch (e) { /**/ }
  const hasPay = pay && (pay.pay_account_no || pay.pay_promptpay_qr || pay.pay_promptpay_id);
  const payBlock = !hasPay ? '' : `
    <div class="paybox" style="margin-top:12px;border-top:1px solid var(--line,#E7E5E1);padding-top:12px">
      <div class="qhd">${TH ? 'ช่องทางชำระ' : 'Pay to'}</div>
      ${pay.pay_account_no ? `<div class="qrow"><span>${pay.pay_bank_name || (TH ? 'โอนเข้าบัญชี' : 'Bank')}</span><b>${pay.pay_account_no}</b></div>
        ${pay.pay_account_name ? `<div style="font-size:12px;color:var(--muted,#8C8B86);text-align:right">${pay.pay_account_name}</div>` : ''}` : ''}
      ${pay.pay_promptpay_id ? `<div style="text-align:center;margin:10px 0">
        <div id="ppqr"></div>
        <div style="font-size:13px;margin-top:6px">${TH ? 'สแกนแล้วโอน' : 'Scan & pay'} <b>${baht(q.total)}</b></div></div>`
      : pay.pay_promptpay_qr ? `<div style="text-align:center;margin:10px 0">
        <img src="${pay.pay_promptpay_qr}" alt="PromptPay QR" style="width:200px;max-width:70%;border:1px solid var(--line,#E7E5E1);border-radius:6px">
        <div style="font-size:13px;margin-top:6px">${TH ? 'สแกนแล้วโอน' : 'Scan & pay'} <b>${baht(q.total)}</b></div></div>` : ''}
      <div style="font-size:12px;color:var(--muted,#8C8B86);margin-top:6px">${pay.pay_note || (TH ? 'โอนแล้วแนบสลิปในแชตนี้' : 'Transfer then send slip in chat')}</div>
    </div>`;
  const kyc = q.kyc_required ? `<div class="kycnote">
      <div class="kt">${TH ? 'ยืนยันตัวตน ลดมัดจำได้' : 'Verify to lower your deposit'}</div>
      <div class="ks">${TH ? 'แนบบัตรประชาชน + IG/FB สาธารณะ ครั้งเดียว' : 'Attach ID + public IG/FB, just once'}</div>
      <button class="kbtn" onclick="openKyc('${id}')">${TH ? 'ยืนยันตัวตน' : 'Verify identity'}</button>
    </div>` : '';
  // ป้ายราคาพนักงาน — โชว์เฉพาะพนักงาน (is_staff) ลูกค้าทั่วไปไม่เห็น
  const staffBadge = q.is_staff ? `<div style="display:inline-block;margin:2px 0 8px;font-size:12px;font-weight:600;color:#0F6E56;background:#E4F0EC;border:1px solid #cfe6da;border-radius:20px;padding:3px 11px">${TH ? 'ราคาพนักงาน' : 'Staff price'} −${q.staff_discount}%${q.rate_full ? ` · ${TH ? 'ปกติ' : 'was'} ${baht(q.rate_full)}` : ''}</div>` : '';
  box.innerHTML = `
    <div class="qhd">${TH ? 'สรุปยอด' : 'Summary'} · ${q.days} ${TH ? 'วัน' : 'days'}</div>
    ${staffBadge}
    ${row(TH ? 'ค่าเช่า' : 'Rental', baht(q.rate))}
    ${q.deposit > 0 ? row(TH ? 'มัดจำ (คืนหลังตรวจชุด)' : 'Deposit (refundable)', baht(q.deposit)) : ''}
    ${row(TH ? 'ค่าส่ง' : 'Shipping', q.shipping > 0 ? baht(q.shipping) : (TH ? 'ส่งฟรี' : 'Free'))}
    ${row(TH ? 'รวมโอน' : 'Total', baht(q.total), true)}
    <div class="qdates qspan">${TH ? 'วันแรก (วันรับ/ใช้งาน)' : 'Day 1 (pickup/use)'}: <b>${fmtDate(q.use_date)}</b> · ${TH ? `เช่า ${q.days} วัน` : `${q.days} days`}</div>
    <div class="qdates">${TH ? 'จัดส่งราว' : 'Ships ~'} ${fmtDate(q.ship_date)} · ${TH ? 'กำหนดคืน' : 'Return by'} <b>${fmtDate(q.return_date)}${q.return_by ? (TH ? ` ก่อน ${q.return_by} น.` : ` by ${q.return_by}`) : ''}</b></div>
    <div class="qdates">${TH ? 'คืนตรงเวลาช่วยให้ชุดพร้อมส่งคิวถัดไปทัน · ค่าส่งคืนผู้เช่าออกเอง' : 'On-time return keeps the next booking on track · return shipping paid by renter'}</div>
    ${kyc}
    ${payBlock}`;
  // วาด QR แบรนด์ LLOOP ฝังยอด (หลัง element อยู่ใน DOM แล้ว)
  if (pay && pay.pay_promptpay_id && window.promptpayBrandedQR) {
    const ppEl = document.getElementById('ppqr');
    if (ppEl) window.promptpayBrandedQR(ppEl, pay.pay_promptpay_id, q.total, pay.pay_promptpay_type);
  }
}

async function reserve(id) {
  const g = GARMENTS.find(x => x.id === id);
  const date = $('#useDate') && $('#useDate').value;
  if (!date) {
    const msg = $('#availMsg');
    if (msg) { msg.className ='availmsg busy'; msg.textContent = lang ==='th'?'เลือกวันที่ต้องใช้ก่อนนะคะ':'Pick a date first'; }
    return;
  }
  // ด่าน KYC — ลูกค้าใหม่ต้องยืนยันตัวตนก่อนเช่า
  if (!(await kycGate())) return;
  // กันจองชน — เช็กว่างก่อน
  const free = await checkAvail(id);
  if (free === false) return;
  const toDate = durEnd(date);
  const credit = Math.min(CUSTOMER.credit_balance || 0, Math.round(g.price * 0.5));
  let ok = true, backups = [];
  try {
    const res = await window.API.bookWithBackups(CUSTOMER, g.code || g.id, date, toDate);
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

// จองด้วยสิทธิ์วันเกิด (ฟรีถึงเพดาน · เกินจ่ายส่วนต่าง · มัดจำตามปกติ)
async function bdayBook(id) {
  const g = GARMENTS.find(x => x.id === id);
  const date = $('#useDate') && $('#useDate').value;
  if (!date) {
    const msg = $('#availMsg');
    if (msg) { msg.className = 'availmsg busy'; msg.textContent = lang === 'th' ? 'เลือกวันที่ต้องใช้ก่อนนะคะ' : 'Pick a date first'; }
    return;
  }
  // ด่าน KYC — ลูกค้าใหม่ต้องยืนยันตัวตนก่อนเช่า
  if (!(await kycGate())) return;
  const res = await window.API.birthdayReserve(id, CUSTOMER, date, durEnd(date));
  if (!res.ok) {
    toast(res.error === 'unavailable' ? (lang === 'th' ? 'ชุดนี้ไม่ว่างวันนั้นค่ะ ลองวันอื่นนะคะ' : 'Unavailable that date')
        : res.error === 'no_voucher' ? (lang === 'th' ? 'สิทธิ์วันเกิดหมดอายุ/ใช้ไปแล้วค่ะ' : 'No active birthday voucher')
        : (lang === 'th' ? 'ใช้สิทธิ์ไม่สำเร็จ ลองใหม่นะคะ' : 'Failed, try again'));
    return;
  }
  window.BDAY = null;  // ใช้สิทธิ์ไปแล้ว
  closeDetail();
  toast(lang === 'th'
    ? (Number(res.pay) > 0 ? `จองวันเกิดสำเร็จ จ่ายเพิ่ม ฿${res.pay} · สุขสันต์วันเกิดค่ะ` : 'จองวันเกิดสำเร็จ เช่าฟรี! สุขสันต์วันเกิดค่ะ')
    : (Number(res.pay) > 0 ? `Birthday booking done · pay ฿${res.pay}` : 'Birthday booking done · free! Happy birthday'));
}

// ===== ยืนยันตัวตน (KYC) =====
function openKyc(id) {
  const TH = lang === 'th';
  $('#kycSheet').innerHTML = `
    <div class="ksheet">
      <button class="close" onclick="closeKyc()">×</button>
      <div class="khd">${TH ? 'ยืนยันตัวตน' : 'Verify identity'}</div>
      <div class="ksub">${TH ? 'เพื่อความปลอดภัยของทั้งสองฝ่าย ลูกค้าใหม่ยืนยันตัวตนครั้งเดียว รอบหน้าไม่ต้องทำอีก' : 'One-time verification for new customers'}</div>
      <label class="klabel">${TH ? 'บัตรประชาชน (ถ่ายชัดเจน)' : 'ID card photo'}</label>
      <input type="file" id="kycId" accept="image/*">
      <label class="klabel">${TH ? 'ลิงก์ IG หรือ Facebook (สาธารณะ)' : 'IG / Facebook link (public)'}</label>
      <input type="url" id="kycSocial" placeholder="https://instagram.com/..." class="kinput">
      <button class="ksubmit" onclick="submitKycForm('${id || ''}')">${TH ? 'ส่งยืนยันตัวตน' : 'Submit'}</button>
      <div class="knote">${TH ? 'หรือไม่ต้องยืนยันก็ได้ — เพียงวางมัดจำเพิ่มตามที่แจ้งในสรุปยอด' : 'Or skip and keep the higher deposit shown in the summary'}</div>
    </div>`;
  $('#kycOverlay').classList.add('open'); document.body.style.overflow = 'hidden';
}
function closeKyc() { $('#kycOverlay').classList.remove('open'); document.body.style.overflow = 'hidden'; }
async function submitKycForm(id) {
  const TH = lang === 'th';
  const fileEl = $('#kycId'), social = ($('#kycSocial') && $('#kycSocial').value || '').trim();
  if (!social && !(fileEl && fileEl.files && fileEl.files.length)) {
    toast(TH ? 'แนบบัตรหรือใส่ลิงก์โซเชียลก่อนนะคะ' : 'Attach ID or add a social link'); return;
  }
  const btn = $('.ksubmit'); if (btn) { btn.disabled = true; btn.textContent = TH ? 'กำลังส่ง…' : 'Sending…'; }
  let idUrl = '';
  try { if (fileEl && fileEl.files && fileEl.files.length) idUrl = await window.API.uploadIdCard(fileEl.files[0]); } catch (e) { /**/ }
  const res = await window.API.submitKyc(CUSTOMER, idUrl, social);
  if (res.ok) {
    closeKyc();
    if (res.status === 'pending') {
      toast(TH ? 'ส่งยืนยันตัวตนแล้ว รอร้านอนุมัติสักครู่นะคะ' : 'Submitted — pending approval');
    } else {
      CUSTOMER.kyc_verified = true;
      toast(TH ? 'ยืนยันตัวตนเรียบร้อย ขอบคุณค่ะ' : 'Verified — thank you');
      const date = id && $('#useDate') && $('#useDate').value;
      if (date) renderQuote(id, date);   // มัดจำลดลงทันที
    }
  } else {
    if (btn) { btn.disabled = false; btn.textContent = TH ? 'ส่งยืนยันตัวตน' : 'Submit'; }
    toast(TH ? 'ส่งไม่สำเร็จ ลองใหม่อีกครั้งนะคะ' : 'Failed — try again');
  }
}

// ===== KYC บังคับก่อนเช่า (บัตรประชาชน + เซลฟี่ถือบัตร) =====
// แยกจาก openKyc() เดิม (ที่ใช้ลดมัดจำ) — ตัวนี้เป็น "ด่าน" บังคับยืนยันก่อนจองจริง
let _kycSb = null;
function kycSb() {
  if (!_kycSb && window.supabase && window.CONFIG) {
    _kycSb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  }
  return _kycSb;
}
// อ่านสถานะว่าเช่าได้ไหม → true=ผ่าน, false=ต้อง KYC
async function customerCanRent() {
  if (!CUSTOMER || !CUSTOMER.id) return true;  // ยังไม่ล็อกอิน — ปล่อยให้ flow เดิมจัดการ
  try {
    const sb = kycSb(); if (!sb) return true;  // เรียก client ไม่ได้ — อย่าบล็อก (non-breaking)
    const { data, error } = await sb.rpc('customer_can_rent', { p_customer: CUSTOMER.id });
    if (error) { console.warn('customer_can_rent', error); return true; }
    const g = data || {};
    return g.ok !== false;  // ok:true หรือไม่มีข้อมูล = ผ่าน
  } catch (e) { console.warn(e); return true; }
}
// ด่านก่อนจอง: ผ่าน→true · ไม่ผ่าน→เปิดหน้า KYC + แจ้งเตือน แล้วคืน false
async function kycGate() {
  const ok = await customerCanRent();
  if (!ok) {
    toast(lang === 'th'
      ? 'ลูกค้าใหม่ต้องยืนยันตัวตนด้วยบัตรประชาชนก่อนเช่าค่ะ'
      : 'Please verify your identity with your ID card before renting');
    openKycRequired();
  }
  return ok;
}

// เปิดหน้าจับภาพ KYC (บัตร + เซลฟี่ถือบัตร) — ใช้ overlay เดียวกับ KYC เดิม
async function openKycRequired() {
  const TH = lang === 'th';
  let consent = { body: '', version: '1' };
  try {
    const sb = kycSb();
    if (sb) {
      const { data } = await sb.rpc('consent_text', { p_purpose: 'customer_kyc' });
      if (data) consent = data;
    }
  } catch (e) { console.warn('consent_text', e); }
  const ver = String(consent.version || '1');
  const body = (consent.body || (TH
    ? 'เราเก็บรูปบัตรประชาชนและเซลฟี่เพื่อยืนยันตัวตนผู้เช่าเท่านั้น เก็บอย่างปลอดภัยและไม่เปิดเผยต่อบุคคลภายนอก'
    : 'We collect your ID card and selfie solely to verify renter identity. Stored securely and not shared.'));
  $('#kycSheet').innerHTML = `
    <div class="ksheet">
      <button class="close" onclick="closeKyc()">×</button>
      <div class="khd">${TH ? 'ยืนยันตัวตนก่อนเช่า' : 'Verify identity to rent'}</div>
      <div class="ksub">${TH ? 'ลูกค้าใหม่ยืนยันตัวตนครั้งเดียว รอบหน้าไม่ต้องทำอีกค่ะ' : 'One-time verification for new renters'}</div>
      <div class="kconsent" style="max-height:140px;overflow:auto;border:1px solid var(--line,#E7E5E1);border-radius:8px;padding:10px;font-size:12px;line-height:1.6;color:var(--muted,#6b6a66);white-space:pre-wrap;margin:8px 0">${body}</div>
      <label class="klabel" style="display:flex;align-items:flex-start;gap:8px;font-size:13px;margin:8px 0">
        <input type="checkbox" id="kycConsent" data-ver="${ver}" style="margin-top:2px">
        <span>${TH ? 'ฉันยินยอมให้เก็บรูปบัตรและเซลฟี่เพื่อยืนยันตัวตน' : 'I consent to storing my ID & selfie for verification'}</span>
      </label>
      <label class="klabel">${TH ? 'เลขบัตรประชาชน 13 หลัก' : 'ID card number'}</label>
      <input type="text" id="kycIdNo" inputmode="numeric" maxlength="20" placeholder="${TH ? 'กรอกเลขบัตร' : 'ID number'}" class="kinput">
      <label class="klabel">${TH ? 'รูปบัตรประชาชน (ถ่ายชัดเจน)' : 'ID card photo'}</label>
      <input type="file" id="kycIdImg" accept="image/*" capture="environment" onchange="kycOcr(this)">
      <label class="klabel">${TH ? 'เซลฟี่ถือบัตรประชาชน' : 'Selfie holding your ID'}</label>
      <input type="file" id="kycSelfie" accept="image/*" capture="environment">
      <button class="ksubmit" onclick="submitKycRequired()">${TH ? 'ส่งยืนยันตัวตน' : 'Submit verification'}</button>
    </div>`;
  $('#kycOverlay').classList.add('open'); document.body.style.overflow = 'hidden';
}

// อ่านไฟล์เป็น dataURL
function _fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
// POST ไป edge function /kyc 1 รูป
async function _kycUpload(idToken, kind, dataUrl, mediaType, extra) {
  const body = Object.assign({
    action: 'upload', id_token: idToken, role: 'customer',
    kind, image: dataUrl, media_type: mediaType,
  }, extra || {});
  const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/kyc`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  let out = {}; try { out = await res.json(); } catch (e) { /**/ }
  return { status: res.status, ok: res.ok && out && out.ok === true, data: out };
}

// อ่านเลขบัตรจากรูปอัตโนมัติ (OCR) → เติมช่องเลขบัตรให้ ลูกค้าไม่ต้องพิมพ์ · ตรวจแก้ได้
async function kycOcr(input) {
  const TH = lang === 'th';
  const f = input && input.files && input.files[0]; if (!f) return;
  const idEl = $('#kycIdNo'); if (idEl && idEl.value.trim()) return;  // มีเลขแล้วไม่ทับ
  let idToken = null; try { idToken = window.liff && liff.getIDToken && liff.getIDToken(); } catch (e) { idToken = null; }
  if (!idToken) return;
  if (idEl) idEl.placeholder = TH ? 'กำลังอ่านเลขบัตรจากรูป…' : 'Reading ID from photo…';
  try {
    const dataUrl = await _fileToDataUrl(f);
    const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/kyc`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ocr', id_token: idToken, role: 'customer', image: dataUrl, media_type: f.type }),
    });
    const out = await res.json().catch(() => ({}));
    if (out && out.id_number && idEl && !idEl.value.trim()) {
      idEl.value = out.id_number;
      toast(TH ? 'อ่านเลขบัตรให้แล้ว ช่วยตรวจอีกครั้งนะคะ' : 'ID number filled — please double-check');
    }
  } catch (e) { /* เงียบ — ลูกค้าพิมพ์เองได้ */ }
  if (idEl) idEl.placeholder = TH ? 'กรอกเลขบัตร' : 'ID number';
}

async function submitKycRequired() {
  const TH = lang === 'th';
  const consentEl = $('#kycConsent');
  const idNo = ($('#kycIdNo') && $('#kycIdNo').value || '').trim();
  const idFile = $('#kycIdImg') && $('#kycIdImg').files && $('#kycIdImg').files[0];
  const selfieFile = $('#kycSelfie') && $('#kycSelfie').files && $('#kycSelfie').files[0];
  if (!consentEl || !consentEl.checked) { toast(TH ? 'กรุณายอมรับความยินยอมก่อนนะคะ' : 'Please accept the consent first'); return; }
  if (!idNo) { toast(TH ? 'กรอกเลขบัตรประชาชนก่อนนะคะ' : 'Enter your ID number'); return; }
  if (!idFile || !selfieFile) { toast(TH ? 'แนบทั้งรูปบัตรและเซลฟี่ถือบัตรนะคะ' : 'Attach both the ID and the selfie'); return; }
  const ver = (consentEl.dataset && consentEl.dataset.ver) || '1';
  const btn = $('#kycSheet .ksubmit'); if (btn) { btn.disabled = true; btn.textContent = TH ? 'กำลังส่ง…' : 'Sending…'; }
  const reEnable = () => { if (btn) { btn.disabled = false; btn.textContent = TH ? 'ส่งยืนยันตัวตน' : 'Submit verification'; } };

  let idToken = null;
  try { idToken = window.liff && liff.getIDToken && liff.getIDToken(); } catch (e) { idToken = null; }
  if (!idToken) {
    reEnable();
    toast(TH ? 'กรุณาเปิดผ่าน LINE เพื่อยืนยันตัวตน' : 'Please open via LINE to verify identity');
    return;
  }
  try {
    const idData = await _fileToDataUrl(idFile);
    const selfieData = await _fileToDataUrl(selfieFile);
    const r1 = await _kycUpload(idToken, 'id_card', idData, idFile.type || 'image/jpeg', { id_card: idNo, consent_version: ver });
    if (!r1.ok) {
      reEnable();
      toast(r1.status === 401 ? (TH ? 'เซสชัน LINE หมดอายุ ลองเปิดใหม่นะคะ' : 'LINE session expired — reopen the app')
        : r1.status === 404 ? (TH ? 'ยังไม่พบบัญชีลูกค้า ลองเข้าผ่าน LINE อีกครั้ง' : 'Customer not found — reopen via LINE')
        : (TH ? 'ส่งรูปบัตรไม่สำเร็จ ลองใหม่นะคะ' : 'ID upload failed — try again'));
      return;
    }
    const r2 = await _kycUpload(idToken, 'selfie_id', selfieData, selfieFile.type || 'image/jpeg', { id_card: idNo, consent_version: ver });
    if (!r2.ok) {
      reEnable();
      toast(TH ? 'ส่งเซลฟี่ไม่สำเร็จ ลองใหม่นะคะ' : 'Selfie upload failed — try again');
      return;
    }
    closeKyc();
    toast(TH ? 'ส่งยืนยันตัวตนแล้ว — รอทีมงานอนุมัติ (ปกติไม่เกิน 1 วัน) จากนั้นเช่าได้เลยค่ะ'
            : 'Submitted — pending approval (usually within 1 day). You can rent once approved.');
    customerCanRent();  // re-check เพื่ออัปเดต UI
  } catch (e) {
    console.warn(e);
    reEnable();
    toast(TH ? 'เกิดข้อผิดพลาด ลองใหม่นะคะ' : 'Something went wrong — try again');
  }
}

// ===== ตะกร้า (จองหลายชุด ส่งกล่องเดียว) =====
function addToCart(id) {
  const g = GARMENTS.find(x => x.id === id); if (!g) return;
  if (gCart.find(x => x.id === id)) { toast(lang === 'th' ? 'ชุดนี้อยู่ในตะกร้าแล้ว' : 'Already in cart'); return; }
  gCart.push({ id, code: g.code || g.id, name: g.name, price: g.price });
  renderCartBtn();
  toast(lang === 'th' ? `เพิ่ม "${g.name}" ลงตะกร้าแล้ว` : `Added "${g.name}"`);
}
function removeFromCart(id) { gCart = gCart.filter(x => x.id !== id); renderCartBtn(); openCart(); }
function renderCartBtn() {
  const b = $('#cartFab'); if (!b) return;
  b.style.display = gCart.length ? 'flex' : 'none';
  const c = $('#cartCount'); if (c) c.textContent = gCart.length;
}
function openCart() {
  const TH = lang === 'th';
  if (!gCart.length) { toast(TH ? 'ยังไม่มีชุดในตะกร้า' : 'Cart is empty'); return; }
  const date = (($('#useDate') && $('#useDate').value) || gUseDate || '');
  const items = gCart.map(it => `<div class="crow"><span>${it.name}</span><b>฿${it.price}</b><button class="cx" onclick="removeFromCart('${it.id}')">×</button></div>`).join('');
  $('#cartSheet').innerHTML = `
    <div class="csheet">
      <button class="close" onclick="closeCart()">×</button>
      <div class="khd">${TH ? 'ตะกร้าของฉัน' : 'My cart'} · ${gCart.length} ${TH ? 'ชุด' : 'items'}</div>
      <div class="cdesc">${TH ? 'เช่าหลายชุด ส่งกล่องเดียว ค่าส่งครั้งเดียว' : 'Multiple dresses, one shipment, one shipping fee'}</div>
      <div class="clist">${items}</div>
      <div class="cdate">
        <label>${TH ? 'วันที่ต้องใช้' : 'Date'}</label>
        <input type="date" id="cartDate" min="${todayStr()}" value="${date}">
        <div class="durchips" id="cartDur">
          <button data-d="1" class="${gDur === 1 ? 'on' : ''}" onclick="setCartDur(1)">${TH ? '1 วัน' : '1d'}</button>
          <button data-d="3" class="${gDur === 3 ? 'on' : ''}" onclick="setCartDur(3)">${TH ? '3 วัน' : '3d'}</button>
          <button data-d="5" class="${gDur === 5 ? 'on' : ''}" onclick="setCartDur(5)">${TH ? '5 วัน' : '5d'}</button>
        </div>
      </div>
      <button class="ksubmit" onclick="bookCartNow()">${TH ? 'จองทั้งหมด' : 'Book all'}</button>
    </div>`;
  $('#cartOverlay').classList.add('open'); document.body.style.overflow = 'hidden';
}
function setCartDur(d) { gDur = d; document.querySelectorAll('#cartDur button').forEach(b => b.classList.toggle('on', +b.dataset.d === d)); }
function closeCart() { $('#cartOverlay').classList.remove('open'); document.body.style.overflow = ''; }
async function bookCartNow() {
  const TH = lang === 'th';
  const date = $('#cartDate') && $('#cartDate').value;
  if (!date) { toast(TH ? 'เลือกวันที่ก่อนนะคะ' : 'Pick a date'); return; }
  // ด่าน KYC — ลูกค้าใหม่ต้องยืนยันตัวตนก่อนเช่า
  if (!(await kycGate())) return;
  const btn = $('#cartSheet .ksubmit'); if (btn) { btn.disabled = true; btn.textContent = TH ? 'กำลังจอง…' : 'Booking…'; }
  const codes = gCart.map(x => x.code);
  const res = await window.API.bookCart(CUSTOMER, codes, date, durEnd(date));
  const data = res && res.data;
  if (res && !res.error && data && !data.error) {
    const unavail = (data.unavailable || []);
    gCart = [];
    renderCartBtn(); closeCart();
    toast(unavail.length
      ? (TH ? `จองสำเร็จ · ${unavail.length} ชุดไม่ว่างวันนั้น` : `Booked · ${unavail.length} unavailable`)
      : (TH ? 'จองทั้งออเดอร์สำเร็จ ส่งกล่องเดียว' : 'Order booked — one shipment'));
  } else {
    if (btn) { btn.disabled = false; btn.textContent = TH ? 'จองทั้งหมด' : 'Book all'; }
    toast(TH ? 'จองไม่สำเร็จ ลองใหม่นะคะ' : 'Booking failed');
  }
}

// ===== profile =====
const SEASONS = [
  ['spring', ['#FF7E5F','#FFD45E','#C5E17A']],
  ['summer', ['#A8C8E8','#C9B6E4','#F3C6D3']],
  ['autumn', ['#D6A02E','#B5531F','#7E7A33']],
  ['winter', ['#D5142B','#1E47A6','#111317']],
];
let pSeason ='winter';
let pStyles = new Set(), pOccasions = new Set();
function togglePref(kind, val, el) {
  const set = kind === 'style' ? pStyles : pOccasions;
  if (set.has(val)) set.delete(val); else set.add(val);
  el.classList.toggle('on');
}
// ===== เมนูรวมของลูกค้า (side drawer) — รวมทุกฟังก์ชันไว้ที่เดียว =====
function openMenu() {
  const en = lang === 'en';
  const c = CUSTOMER || {};
  const dispName = c.name || c.display_name || '';
  const signedIn = !!(c.line_uid || c.display_name || c.picture_url);
  const avatar = c.picture_url
    ? `<img class="mavimg" src="${c.picture_url}" alt="" referrerpolicy="no-referrer">`
    : `<div class="mavimg mavx">${(dispName[0] || 'L').toUpperCase()}</div>`;
  const cartN = gCart.length;
  // ไอคอนเส้น (craft, ไม่มี emoji)
  const I = {
    orders: '<svg viewBox="0 0 24 24"><path d="M6 2h9l3 3v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>',
    cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 12.4a1 1 0 0 0 1 .8h8.2a1 1 0 0 0 1-.8L20 8H6"/><circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/></svg>',
    member: '<svg viewBox="0 0 24 24"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 21l-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/></svg>',
    review: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg>',
    foryou: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    stylist: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-5-7-11a7 7 0 0 1 14 0c0 6-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    wish: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.4-9 9-9 9z"/></svg>',
    family: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><path d="M16 5.3a3 3 0 0 1 0 5.9M21.5 19a6 6 0 0 0-4-5.6"/></svg>',
    verify: '<svg viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9.5 12l1.8 1.8L15 10"/></svg>',
    gift: '<svg viewBox="0 0 24 24"><path d="M4 11h16v9H4z"/><path d="M2 7h20v4H2zM12 7v13M12 7S10 3 7.5 4 9 7 12 7zM12 7s2-4 4.5-3S15 7 12 7z"/></svg>',
    impact: '<svg viewBox="0 0 24 24"><path d="M12 21c0-7 0-11 7-15-1 7-2 12-7 15z"/><path d="M12 21c0-6-1-9-6-12 1 6 2 10 6 12z"/></svg>',
    about: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>',
    terms: '<svg viewBox="0 0 24 24"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 13h5M10 17h5"/></svg>',
    privacy: '<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  };
  const item = (icon, label, act, sub) =>
    `<button class="mitem" onclick="closeMenu();${act}">${icon}<span>${label}</span>${sub ? `<span class="msublab">${sub}</span>` : ''}</button>`;

  $('#menuDrawer').innerHTML = `
    <div class="mhead">
      <button class="mclose" onclick="closeMenu()" aria-label="ปิด">×</button>
      <div class="mav">
        ${avatar}
        <div>
          <div class="mname">${signedIn ? (dispName || (en ? 'Welcome' : 'ยินดีต้อนรับ')) : 'LLOOP'}</div>
          <div class="msub">${signedIn ? (en ? 'Signed in with LINE' : 'เข้าสู่ระบบด้วย LINE') : (en ? 'share the look, save the planet' : 'แชร์ลุคสวย ช่วยรักษ์โลก')}</div>
        </div>
      </div>
      <span class="medit" onclick="closeMenu();openProfile()">${en ? 'Edit profile & size' : 'แก้ไขโปรไฟล์ & ไซซ์'}</span>
    </div>

    <div class="msec">
      <div class="ml">${en ? 'My rentals' : 'การเช่าของฉัน'}</div>
      ${item(I.orders, en ? 'My orders' : 'ออเดอร์ของฉัน', 'openOrders()')}
      ${item(I.cart, en ? 'Cart' : 'ตะกร้า', 'openCart()', cartN ? String(cartN) : '')}
      ${item(I.member, en ? 'Membership & perks' : 'สมาชิก & สิทธิ์', 'openMembership()')}
    </div>

    <div class="msec">
      <div class="ml">${en ? 'Discover' : 'ค้นพบ'}</div>
      ${item(I.foryou, en ? 'For you' : 'แนะนำเฉพาะคุณ', 'if(!fForYou)toggleForYou()')}
      ${item(I.stylist, en ? 'AI stylist by venue' : 'AI สไตลิสต์ประจำสถานที่', "var el=document.getElementById('venueInput');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.focus();}")}
      ${item(I.wish, en ? 'Saved looks' : 'ชุดที่หมายตา', 'if(!fWishOnly)toggleWishOnly()')}
      ${item(I.family, en ? 'Family & groups' : 'ครอบครัว & กลุ่ม', 'openFamily()')}
      ${item(I.gift, en ? 'Shoot & earn credit' : 'ถ่ายชุด · ได้เครดิต', "location.href='creator.html'")}
    </div>

    <div class="msec">
      <div class="ml">${en ? 'My account' : 'บัญชีของฉัน'}</div>
      ${item(I.verify, en ? 'Verify identity (KYC)' : 'ยืนยันตัวตน (KYC)', "openKyc('')")}
      ${item(I.gift, en ? 'Invite friends · get credit' : 'ชวนเพื่อน · รับเครดิต', 'openProfile()')}
    </div>

    <div class="msec">
      <div class="ml">${en ? 'The LLOOP world' : 'โลกของ LLOOP'}</div>
      ${item(I.impact, en ? 'Your impact' : 'ผลกระทบรักษ์โลกของคุณ', 'openImpact()')}
      ${item(I.about, en ? 'About us' : 'เกี่ยวกับเรา', "location.href='about.html'")}
    </div>

    <div class="msec">
      <div class="ml">${en ? 'Help & info' : 'ช่วยเหลือ & ข้อมูล'}</div>
      ${item(I.terms, en ? 'Rental terms' : 'ข้อตกลงการเช่า', "location.href='rental-terms.html'")}
      ${item(I.privacy, en ? 'Privacy policy' : 'นโยบายความเป็นส่วนตัว', "location.href='privacy.html'")}
    </div>

    <div class="mfoot">
      <div class="mlang">
        <span>${en ? 'Language' : 'ภาษา'}</span>
        <button id="langTH" class="${lang === 'th' ? 'on' : ''}" onclick="setLang('th')">TH</button>
        <button id="langEN" class="${lang === 'en' ? 'on' : ''}" onclick="setLang('en')">EN</button>
      </div>
      <div class="mtag">love + loop</div>
      <div class="mver">${en ? 'share the look, save the planet' : 'แชร์ลุคสวย ช่วยรักษ์โลก'}</div>
    </div>`;
  $('#menuOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeMenu() { $('#menuOverlay').classList.remove('open'); document.body.style.overflow = ''; }

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
  // ความชอบส่วนตัว — ลูกค้ากรอกเอง (ไม่ต้องพึ่ง personal color จากพาร์ทเนอร์)
  const pf = c.prefs || {};
  pStyles = new Set(pf.styles || []); pOccasions = new Set(pf.occasions || []);
  const STYLE_OPTS = lang==='th'
    ? [['minimal','มินิมอล'],['sweet','หวาน/วินเทจ'],['elegant','เรียบหรู'],['street','เท่/สตรีท'],['boho','โบฮีเมียน'],['glam','หรูหรา/ราตรี']]
    : [['minimal','Minimal'],['sweet','Sweet/Vintage'],['elegant','Elegant'],['street','Street'],['boho','Boho'],['glam','Glam']];
  const OCC_OPTS = lang==='th'
    ? [['work','ทำงาน'],['date','เดต'],['wedding','งานแต่ง'],['party','ปาร์ตี้'],['cafe','คาเฟ่/เที่ยว'],['formal','ทางการ']]
    : [['work','Work'],['date','Date'],['wedding','Wedding'],['party','Party'],['cafe','Cafe/Trip'],['formal','Formal']];
  const chip = (kind,k,l,set)=>`<button type="button" class="prefchip ${set.has(k)?'on':''}" onclick="togglePref('${kind}','${k}',this)">${l}</button>`;
  const styleChips = STYLE_OPTS.map(([k,l])=>chip('style',k,l,pStyles)).join('');
  const occChips = OCC_OPTS.map(([k,l])=>chip('occ',k,l,pOccasions)).join('');
  const sizeOpts = ['','XS','S','M','L','XL','Freesize'].map(s=>`<option ${c.size===s?'selected':''}>${s}</option>`).join('');
  $('#pSheet').innerHTML =`
    <div class="pform">
      <button class="close" style="position:static;float:right" onclick="closeProfile()">×</button>
      ${head}
      <h3>${onboard?(lang==='th'?'ข้อมูลเบื้องต้น':'Quick details'):t('pTitle')}</h3>
      <p class="hint">${t('pHint')}</p>
      ${renderLoopersClub(c)}
      ${renderStyleCard(c)}
      ${renderImpactCard()}
      ${renderReferralCard()}
      <div class="field"><label>${t('pName')}</label><input id="pName" autocomplete="name" value="${c.name || c.display_name ||''}"></div>
      <div class="frow">
        <div class="field"><label>${t('pHeight')}</label><input id="pHeight" type="number" value="${c.height_cm ||''}"></div>
        <div class="field"><label>${t('pShoe')}</label><input id="pShoe" value="${c.shoe_size ||''}"></div>
      </div>
      <div class="frow">
        <div class="field"><label>${lang==='th'?'น้ำหนัก (กก.)':'Weight (kg)'}</label><input id="pWeight" type="number" value="${c.weight_kg ||''}"></div>
        <div class="field"><label>${lang==='th'?'ไซซ์ที่ใส่ประจำ':'Usual size'}</label><select id="pSize">${sizeOpts}</select></div>
      </div>
      <div class="frow">
        <div class="field"><label>${t('pBustL')}</label><input id="pBust" type="number" value="${c.bust_in ||''}"></div>
        <div class="field"><label>${t('pWaistL')}</label><input id="pWaist" type="number" value="${c.waist_in ||''}"></div>
        <div class="field"><label>${t('pHipL')}</label><input id="pHip" type="number" value="${c.hip_in ||''}"></div>
      </div>
      <div class="prefsec">
        <div class="preflabel">${lang==='th'?'สไตล์ที่ชอบ':'Styles you like'}</div>
        <div class="prefchips">${styleChips}</div>
      </div>
      <div class="prefsec">
        <div class="preflabel">${lang==='th'?'โอกาสที่มักไปงาน':'Occasions you dress for'}</div>
        <div class="prefchips">${occChips}</div>
      </div>
      <div class="frow">
        <div class="field"><label>${lang==='th'?'สีที่ชอบ':'Favourite colours'}</label><input id="pFav" value="${pf.fav_colors ||''}" placeholder="${lang==='th'?'เช่น ครีม เอิร์ธโทน':'e.g. cream, earth'}"></div>
        <div class="field"><label>${lang==='th'?'สีที่เลี่ยง':'Colours to avoid'}</label><input id="pAvoid" value="${pf.avoid_colors ||''}" placeholder="${lang==='th'?'เช่น ส้มสด':'e.g. neon'}"></div>
      </div>
      <div class="field"><label>${t('pColor')} <span class="optnote">${lang==='th'?'(ถ้ารู้โทนสีตัวเอง — ไม่รู้ข้ามได้)':'(if you know your season — optional)'}</span></label><div class="seasons">${seasons}</div></div>
      <div class="frow">
        <div class="field"><label>${lang === 'th' ? 'เบอร์โทร (ไว้พิมพ์ใบส่ง)' : 'Phone (for shipping)'}</label><input id="pPhone" inputmode="tel" autocomplete="tel" value="${c.phone || ''}"></div>
        <div class="field"><label>${lang === 'th' ? 'วันเกิด (รับของขวัญเช่าฟรี)' : 'Birthday (free birthday rental)'}</label><input id="pBirthday" type="date" value="${c.birthday || ''}"></div>
      </div>
      <div class="field"><label>${lang === 'th' ? 'ที่อยู่จัดส่ง (กรอกครั้งเดียว ใช้พิมพ์ใบส่ง-รับคืนอัตโนมัติ)' : 'Delivery address (once — auto-fills labels)'}</label>
        <textarea id="pAddrDetail" rows="2" autocomplete="shipping street-address" inputmode="text" placeholder="${lang === 'th' ? 'บ้านเลขที่ / หมู่บ้าน-คอนโด / ซอย / ถนน' : 'House no. / building / soi / road'}">${c.address || ''}</textarea>
        <div class="subhint">${lang === 'th' ? 'พิมพ์รหัสไปรษณีย์ 5 หลัก แล้วเลือกตำบล — อำเภอ/จังหวัดเติมให้อัตโนมัติ' : 'Type the 5-digit postal code, pick a subdistrict — district & province auto-fill'}</div>
      </div>
      <div class="frow">
        <div class="field"><label>${lang === 'th' ? 'รหัสไปรษณีย์' : 'Postal code'}</label><input id="pZip" inputmode="numeric" maxlength="5" autocomplete="postal-code" placeholder="${lang === 'th' ? 'เช่น 10310' : 'e.g. 10310'}" oninput="onZipInput()"></div>
        <div class="field"><label>${lang === 'th' ? 'ตำบล/แขวง' : 'Subdistrict'}</label><select id="pTambon" onchange="onTambonPick()"><option value="">${lang === 'th' ? '— ใส่รหัสก่อน —' : '— enter code first —'}</option></select></div>
      </div>
      <div class="frow">
        <div class="field"><label>${lang === 'th' ? 'อำเภอ/เขต' : 'District'}</label><input id="pAmphoe" readonly placeholder="${lang === 'th' ? 'เติมอัตโนมัติ' : 'auto'}"></div>
        <div class="field"><label>${lang === 'th' ? 'จังหวัด' : 'Province'}</label><input id="pProvince" readonly placeholder="${lang === 'th' ? 'เติมอัตโนมัติ' : 'auto'}"></div>
      </div>
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
// Loopers Club — กระเป๋า LLOOP (เงินใช้จ่ายเดียว) + ความคืบหน้าชั้น (ภาษาไทย ลดศัพท์)
function renderLoopersClub(c) {
  const th = lang === 'th';
  const bal = Math.round(c.credit_balance || 0);
  const r = c.rentals_count || 0;
  const steps = [['silver', 3, th?'ชั้นเงิน':'Silver'], ['gold', 8, th?'ชั้นทอง':'Gold'], ['platinum', 20, th?'ชั้นแพลทินัม':'Platinum']];
  const nx = steps.find(s => s[1] > r);
  const prog = nx ? Math.min(100, Math.round(r / nx[1] * 100)) : 100;
  const tierTH = { new:(th?'ชั้นเริ่มต้น':'Starter'), silver:(th?'ชั้นเงิน':'Silver'), gold:(th?'ชั้นทอง':'Gold'), platinum:(th?'ชั้นแพลทินัม':'Platinum') }[c.crm_tier || 'new'] || (th?'ชั้นเริ่มต้น':'Starter');
  const progLine = nx
    ? (th ? `เช่าอีก ${nx[1]-r} ครั้ง ขึ้น${nx[2]}` : `${nx[1]-r} more rentals to ${nx[2]}`)
    : (th ? 'คุณอยู่ชั้นสูงสุดแล้ว' : 'Top tier reached');
  const reward = nx ? ({
    silver: th?'ชั้นเงิน: ส่งฟรีทุกครั้ง':'Silver: free shipping',
    gold:   th?'ชั้นทอง: ประกันชุดฟรี + จองก่อนใคร':'Gold: free protection + priority booking',
    platinum: th?'ชั้นแพลทินัม: สไตลิสต์ส่วนตัว + เปลี่ยนชุดกลางคันฟรี':'Platinum: personal stylist + free swaps'
  }[nx[0]] || '') : '';
  return `<div class="club">
    <div class="clubrow"><span class="clubkick">LOOPERS CLUB</span><span class="clubtier">${tierTH}</span></div>
    <div class="wallet">
      <div class="wlabel">${th?'กระเป๋า LLOOP':'LLOOP wallet'}</div>
      <div class="wbal">฿${bal.toLocaleString()}</div>
      <div class="whint">${th?'พร้อมใช้ลดค่าเช่า':'Ready to use on rentals'}</div>
    </div>
    <div class="clubprog">
      <div class="cptop"><span>${progLine}</span><span class="cpsm">${r}/${nx?nx[1]:r}</span></div>
      <div class="cpbar"><i style="width:${prog}%"></i></div>
      ${reward?`<div class="creward">${reward}</div>`:''}
    </div>
  </div>`;
}
function renderStyleCard(c) {
  const sp = c.style_profile || {};
  const tier = c.crm_tier ||'new';
  const tierLabel = lang==='th'
    ? ({ new:'ชั้นเริ่มต้น', silver:'ชั้นเงิน', gold:'ชั้นทอง', platinum:'ชั้นแพลทินัม' }[tier] || 'ชั้นเริ่มต้น')
    : ({ new:'Starter', silver:'Silver', gold:'Gold', platinum:'Platinum' }[tier] || tier);
  let inner;
  if (sp.headline || (sp.palette && sp.palette.length)) {
    const pal = (sp.palette || []).map(h =>`<i style="background:${h}"></i>`).join('');
    const rec = (sp.recommend || []).map(catName).join(' · ');
    const stype = sp.season_type ? `<div class="styletype">${lang ==='th'?'โทนสีของคุณ':'Your season'}: <b style="color:#A75F3A">${sp.season_type}</b></div>` : '';
    const g = sp.guide || {};
    const th = lang === 'th';
    const arr = a => Array.isArray(a) && a.length ? a.join(' · ') : '';
    const ln = (label, val) => val ? `<div class="stylerec"><b>${label}:</b> ${val}</div>` : '';
    const avoidPal = (g.avoid_colors || []).map(h => `<i style="background:${h}"></i>`).join('');
    const guideHtml = [
      ln(th?'นิวทรัลที่ใช่':'Neutrals', g.neutrals),
      ln(th?'โลหะ/เครื่องประดับ':'Metals', arr(g.metals)),
      g.soul_color ? ln(th?'Soul color':'Soul color', g.soul_color) : '',
      avoidPal ? `<div class="stylerec"><b>${th?'สีที่ควรเลี่ยง':'Avoid'}:</b></div><div class="stylepal">${avoidPal}</div>` : '',
      ln(th?'ทรงที่ใช่':'Silhouettes', arr(g.silhouettes)),
      ln(th?'คอเสื้อ':'Necklines', arr(g.necklines)),
      ln(th?'ทรงแขน':'Sleeves', g.sleeves),
      ln(th?'ความยาวที่เหมาะ':'Hemline', g.hemline),
      ln(th?'รองเท้า':'Footwear', g.footwear),
      ln(th?'เนื้อผ้า/ลาย':'Fabrics', g.fabrics),
      ln(th?'ทรงผมที่แนะนำ':'Hair', arr(g.hairstyles)),
      ln(th?'แว่นที่เข้า':'Eyewear', g.eyewear),
      ln(th?'ควรเลี่ยง':'Avoid wearing', g.avoid_clothing),
      ln(th?'ไอเท็มควรมี':'Must-have', arr(g.must_have)),
      ln(th?'โอกาสใช้งาน':'Occasions', g.occasions),
      g.dos_donts ? `<div class="stylerec" style="white-space:pre-line"><b>${th?'ข้อแนะนำ':'Tips'}:</b> ${g.dos_donts}</div>` : ''
    ].filter(Boolean).join('');
    inner =`<div class="stylehead">${sp.headline || (lang ==='th'?'สรุปสไตล์ของคุณ':'Your style')}</div>
      ${stype}
      ${pal?`<div class="stylepal">${pal}</div>`:''}
      ${rec?`<div class="stylerec">${lang ==='th'?'ชุดที่แนะนำ':'For you'}: ${rec}</div>`:''}
      ${guideHtml?`<div class="styleguide" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.08)">${guideHtml}</div>`:''}`;
  } else {
    inner =`<div class="stylehead">${lang ==='th'?'ยังไม่มีผลวิเคราะห์สไตล์':'No style analysis yet'}</div>
      <div class="stylerec">${lang ==='th'?'แสดงรหัสนี้กับสไตลิสต์พาร์ทเนอร์ตอนไปทำ Personal Color':'Show this code to our partner stylist'}</div>`;
  }
  return`<div class="stylecard">
    <div class="tierbadge"> ${tierLabel}</div>
    ${inner}
    ${c.link_code?`<div class="linkcode">${lang ==='th'?'รหัสนัดสไตลิสต์':'Stylist code'} <b>${c.link_code}</b></div>`:''}
  </div>`;
}
// ===== ครอบครัว & กลุ่ม — ไปหน้าจัดการกลุ่ม + เช่าเข้าตีม =====
function openFamily() { location.href = 'family.html'; }
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
      <div class="ik">${en ? 'the good you keep in the loop' : 'ความดีที่คุณวนต่อ'}</div>
      <div class="ihead">${en ? 'wear one look, care for the planet once more' : 'เช่าหนึ่งชุด ดูแลโลกอีกหนึ่งครั้ง'}</div>
      <div class="iline">${en ? 'every time you choose to rotate instead of buy new, you truly give back to the earth' : 'ทุกครั้งที่คุณเลือกวนใช้ซ้ำแทนซื้อใหม่ คือการคืนบางอย่างให้โลกใบนี้จริง ๆ'}</div>
      <div class="ibig">
        <div>~<b data-to="${im.water_l || 0}">0</b><span>${en ? 'litres water saved (est.)' : 'ลิตรน้ำที่ช่วยประหยัด (ประมาณ)'}</span></div>
        <div class="div"></div>
        <div>~<b data-to="${im.co2_kg || 0}">0</b><span>${en ? 'kg carbon reduced (est.)' : 'กก. คาร์บอนที่ลด (ประมาณ)'}</span></div>
        <div class="div"></div>
        <div><b data-to="${im.rentals || 0}">0</b><span>${en ? 'looks rotated' : 'ครั้งที่วนใส่'}</span></div>
      </div>
      <div style="font-size:11px;color:#A39472;margin-top:14px">${en ? '* water & carbon are estimates based on industry averages' : '* ตัวเลขน้ำและคาร์บอนเป็นค่าประมาณจากค่าเฉลี่ยอุตสาหกรรม'}</div>
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
function subCovers(g) {
  const s = CUSTOMER && CUSTOMER._sub;
  if (!s || !s.active || (s.remaining || 0) <= 0) return false;
  // เช็คประเภทชุดว่าอยู่ในสิทธิ์แพ็กไหม (ถ้าไม่ส่งชุดมา = เช็คแค่โควต้า)
  if (g && g.tier && Array.isArray(s.tiers) && s.tiers.length && !s.tiers.includes(g.tier)) return false;
  return true;
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
      <div style="font-size:13px;color:var(--muted);margin-top:4px">${en ? 'rotate new looks every month' : 'วนลุคใหม่ได้ทุกเดือน คุ้มกว่าเช่ารายชุด'}</div>
    </div>
    <div id="memberBody" style="padding:6px 2px 24px">${en ? 'Loading…' : 'กำลังโหลด…'}</div>`;
  let sub = CUSTOMER._sub || { active: false };
  let plans = [];
  try { plans = await window.API.subPlans?.() || []; } catch (e) { /**/ }
  if (sub && sub.period) gMemPeriod = sub.period;   // เปิดมาที่รอบของสมาชิกเดิม
  renderMembership(sub, plans);
}
function closeMembership() { $('#memberOverlay').classList.remove('open'); document.body.style.overflow = ''; }
function perWord(period) {
  const en = lang === 'en';
  return ({ week: en ? 'wk' : 'สัปดาห์', month: en ? 'mo' : 'เดือน', quarter: en ? '3mo' : '3 เดือน', year: en ? 'yr' : 'ปี' })[period] || (en ? 'mo' : 'เดือน');
}
let gMemPeriod = 'month';
function memSetPeriod(pr) { gMemPeriod = pr; renderMembership(window._memSub, window._memPlans); }
function renderMembership(sub, plans) {
  const en = lang === 'en';
  const body = $('#memberBody'); if (!body) return;
  window._memSub = sub; window._memPlans = plans;
  let html = '';
  // การ์ดสถานะปัจจุบัน (ถ้ามีสมาชิก)
  if (sub && sub.plan_code) {
    const paused = sub.status === 'paused';
    const remaining = sub.remaining != null ? sub.remaining : 0;
    html += `<div style="background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:18px">
      <div style="font-size:11px;letter-spacing:2px;color:#0c3a33;background:var(--sage-bg);display:inline-block;padding:3px 10px;border-radius:30px">${paused ? (en ? 'PAUSED' : 'พักชั่วคราว') : (en ? 'ACTIVE' : 'กำลังใช้งาน')}</div>
      <div style="font-size:18px;font-weight:600;color:var(--ink);margin-top:8px">${sub.plan_name || ''}${sub.period_label ? ` <span style="font-size:11px;font-weight:400;color:var(--muted)">· ${sub.period_label}</span>` : ''}</div>
      ${sub.tier_label ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">${en ? 'covers' : 'ครอบคลุม'}: ${sub.tier_label}</div>` : ''}
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
  // ฟิลเตอร์รอบบิล — โชว์ทีละรอบ ดูง่าย
  const ORDER = ['week', 'month', 'quarter', 'year'];
  const PL = { week: en ? 'Weekly' : 'รายสัปดาห์', month: en ? 'Monthly' : 'รายเดือน', quarter: en ? '3-month' : 'ราย 3 เดือน', year: en ? 'Yearly' : 'รายปี' };
  const periods = [...new Set(plans.map(p => p.period || 'month'))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  if (!periods.includes(gMemPeriod)) gMemPeriod = periods.includes('month') ? 'month' : periods[0];
  html += `<div style="display:flex;gap:8px;overflow-x:auto;margin-bottom:14px;scrollbar-width:none">` + periods.map(pr =>
    `<button onclick="memSetPeriod('${pr}')" style="white-space:nowrap;padding:8px 15px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid ${pr === gMemPeriod ? 'var(--ink)' : 'var(--line)'};background:${pr === gMemPeriod ? 'var(--ink)' : '#fff'};color:${pr === gMemPeriod ? '#fff' : 'var(--muted)'}">${PL[pr] || pr}</button>`
  ).join('') + `</div>`;
  // การ์ดแพ็กเกจ (เฉพาะรอบที่เลือก) — ราคา/เดือน + ชุด/เดือน + ครอบคลุม + เก็บเงินยังไง
  const filtered = plans.filter(p => (p.period || 'month') === gMemPeriod);
  html += filtered.map(p => {
    const current = sub && sub.plan_code === p.code && sub.status !== 'cancelled';
    const pm = Number(p.price_per_month || p.price || p.price_month) || 0;
    const cyclePrice = Number(p.price || p.price_month) || 0;
    const qpm = p.rentals_per_month_equiv || p.rentals_per_cycle || 0;
    const longTerm = (p.period || 'month') !== 'month';
    const popular = p.code === 'LOOPER_PLUS';
    const perks = (p.perks || []).slice(0, 3).map(x => `<div style="font-size:12.5px;color:var(--ink);padding:2px 0">· ${x}</div>`).join('');
    const billNote = longTerm
      ? `${en ? 'billed' : 'เก็บ'} ฿${cyclePrice.toLocaleString()} ${en ? 'every' : 'ทุก'} ${perWord(p.period)}${p.save_pct ? ` · ${en ? 'save' : 'ประหยัด'} ${p.save_pct}%` : ''}`
      : (en ? 'billed monthly' : 'เก็บรายเดือน');
    const instLine = (p.installment_per_month && p.installment_months)
      ? `<div style="font-size:12px;color:var(--sage);font-weight:600;margin-top:6px">${en ? 'or pay' : 'หรือผ่อน'} ฿${Number(p.installment_per_month).toLocaleString()}/${en ? 'mo' : 'เดือน'} × ${p.installment_months} ${en ? '' : 'งวด'}</div>`
      : '';
    return `<div style="position:relative;background:#fff;border:${current ? '2px solid var(--sage)' : (popular ? '2px solid var(--ink)' : '1px solid var(--line)')};border-radius:10px;padding:16px;margin-bottom:12px">
      ${popular ? `<div style="position:absolute;top:-9px;left:16px;background:var(--ink);color:#fff;font-size:10px;letter-spacing:1px;padding:2px 10px;border-radius:20px">${en ? 'POPULAR' : 'แนะนำ'}</div>` : ''}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div>
          <div style="font-size:16px;font-weight:600;color:var(--ink)">${p.name}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${en ? 'covers' : 'ครอบคลุม'}: ${p.tier_label || (en ? 'everyday' : 'ชุดทั่วไป')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:700;color:var(--ink);line-height:1.1">฿${pm.toLocaleString()}<span style="font-size:11px;font-weight:400;color:var(--muted)">/${en ? 'mo' : 'เดือน'}</span></div>
          <div style="font-size:12px;color:var(--sage);font-weight:600;margin-top:1px">${qpm} ${en ? 'looks/mo' : 'ชุด/เดือน'}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:10px;padding:7px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)">${billNote}</div>
      ${instLine}
      <div style="margin-top:8px">${perks}</div>
      ${current
        ? `<div style="text-align:center;font-size:12px;letter-spacing:1px;color:var(--sage);margin-top:12px;text-transform:uppercase">${en ? 'Current plan' : 'แพ็กเกจปัจจุบัน'}</div>`
        : `<button onclick="subscribeClick('${p.code}','${(p.name || '').replace(/'/g, '')}')" style="width:100%;background:var(--ink);color:#fff;border:none;padding:11px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin-top:12px;border-radius:6px;cursor:pointer">${en ? 'Choose this plan' : 'เลือกแพ็กเกจนี้'}</button>`}
    </div>`;
  }).join('');
  html += `<div style="font-size:11px;color:var(--muted);text-align:center;margin-top:6px;line-height:1.5">${en ? 'Premium/designer dresses are included only in higher plans — others still rent at the normal price.' : 'ชุดพรีเมียม/ดีไซเนอร์รวมเฉพาะแพ็กสูง — ชุดนอกสิทธิ์ยังเช่าได้ในราคาปกติ'}</div>`;
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
      <div class="ohead">${lang ==='th'?'ลุคโปรดที่หยิบกลับมาใส่ได้เสมอ':'the looks you keep in the loop'}</div>
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
    // ยืดหยุ่นกว่าคู่แข่ง: ลูกค้ายกเลิก/เลื่อน/ต่อเวลาเองได้ (ผ่าน me-rpc gateway)
    const canCancelResched = (r.status ==='reserved'|| r.status ==='hold');
    const canExtend = (r.status ==='reserved'|| r.status ==='out');
    const reschedB = canCancelResched ?`<button class="obtn ghost" onclick="orderReschedule('${r.rental_id}')">${lang ==='th'?'เลื่อนวัน':'Reschedule'}</button>`:'';
    const extendB = canExtend ?`<button class="obtn ghost" onclick="orderExtend('${r.rental_id}')">${lang ==='th'?'ต่อเวลา':'Extend'}</button>`:'';
    const cancelB = canCancelResched ?`<button class="obtn ghost" onclick="orderCancel('${r.rental_id}')">${lang ==='th'?'ยกเลิก':'Cancel'}</button>`:'';
    return`<div class="ocard">
      <div class="otop">
        <div class="oname">${r.name ||'—'}</div>
        <span class="ost ${stClass}">${status}</span>
      </div>
      <div class="orow"><span>${lang ==='th'?'วันที่ใช้':'Use date'}</span>${r.use_date? fmtDate(r.use_date):'—'}</div>
      <div class="orow"><span>${lang ==='th'?'กำหนดคืน':'Due back'}</span>${r.due_at? fmtDate(r.due_at):'—'}</div>
      ${ship}
      <div class="oactions">${reRent}${reschedB}${extendB}${cancelB}${review}</div>
    </div>`;
  }).join('');
}
// ===== ยกเลิก / เลื่อน / ต่อเวลา (ลูกค้าทำเอง — ผ่าน gateway ที่เช็ค ownership) =====
function _isYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
async function orderCancel(rentalId) {
  if (!rentalId) return;
  let msg = lang ==='th'?'ยืนยันยกเลิกการเช่านี้ใช่ไหมคะ':'Cancel this rental?';
  try {
    const q = await window.API.quoteCancellation(rentalId, true);
    if (q && !q.error) {
      const rf = q.rental_refund||0, df = q.deposit_refund||0;
      const mth = q.method==='credit'?(lang==='th'?'เครดิต':'credit'):q.method==='cash'?(lang==='th'?'เงินสด':'cash'):'-';
      msg = lang ==='th'
        ? `ยกเลิกการเช่านี้?\n• คืนค่าเช่า ฿${rf}${rf>0?` (${mth})`:''}\n• คืนมัดจำ ฿${df}`
        : `Cancel this rental?\n• Rental refund ฿${rf}${rf>0?` (${mth})`:''}\n• Deposit ฿${df}`;
    }
  } catch (e) { console.warn(e); }
  if (!confirm(msg)) return;
  const res = await window.API.cancelRental(rentalId, true);
  if (!res || !res.ok) { toast(lang ==='th'?'ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้งนะคะ':'Cancel failed'); return; }
  toast(lang ==='th'?'ยกเลิกเรียบร้อย คืนเงินให้ตามนโยบายแล้วค่ะ':'Cancelled — refund on its way');
  openOrders();
}
async function orderExtend(rentalId) {
  if (!rentalId) return;
  const to = (prompt(lang ==='th'?'ต่อเวลาคืนถึงวันไหน? (รูปแบบ 2026-08-25)':'Extend until? (YYYY-MM-DD)')||'').trim();
  if (!to) return;
  if (!_isYmd(to)) { toast(lang ==='th'?'รูปแบบวันที่ไม่ถูกต้องค่ะ':'Invalid date'); return; }
  let msg = lang ==='th'?`ต่อเวลาคืนถึง ${to}?`:`Extend to ${to}?`;
  try {
    const q = await window.API.quoteExtension(rentalId, to);
    if (q && q.error ==='unavailable') { toast(lang ==='th'?'ชุดไม่ว่างช่วงที่ต่อค่ะ':'Not available for those dates'); return; }
    if (q && q.error ==='must_be_later') { toast(lang ==='th'?'วันคืนใหม่ต้องหลังวันคืนเดิมค่ะ':'Must be later than current return'); return; }
    if (q && !q.error) { const c = q.extra_charge||0; msg = lang ==='th'?`ต่อเวลาถึง ${to}\nค่าเช่าเพิ่ม ฿${c}`:`Extend to ${to}\nExtra ฿${c}`; }
  } catch (e) { console.warn(e); }
  if (!confirm(msg)) return;
  const res = await window.API.extendRental(rentalId, to);
  if (!res || !res.ok) { toast(lang ==='th'?'ต่อเวลาไม่สำเร็จค่ะ':'Extend failed'); return; }
  toast(lang ==='th'?'ต่อเวลาเรียบร้อยค่ะ':'Extended'); openOrders();
}
async function orderReschedule(rentalId) {
  if (!rentalId) return;
  const from = (prompt(lang ==='th'?'วันรับชุดใหม่? (รูปแบบ 2026-08-15)':'New use date? (YYYY-MM-DD)')||'').trim();
  if (!from) return;
  const to = (prompt(lang ==='th'?'วันคืนชุดใหม่? (รูปแบบ 2026-08-20)':'New return date? (YYYY-MM-DD)')||'').trim();
  if (!to) return;
  if (!_isYmd(from) || !_isYmd(to)) { toast(lang ==='th'?'รูปแบบวันที่ไม่ถูกต้องค่ะ':'Invalid date'); return; }
  const res = await window.API.rescheduleRental(rentalId, from, to);
  if (!res || !res.ok) {
    const er = res && res.error;
    const m = er ==='limit_reached'?(lang ==='th'?'เลื่อนครบจำนวนครั้งที่กำหนดแล้วค่ะ':'Reschedule limit reached')
      : (er ==='date_unavailable'|| er ==='new_garment_unavailable')?(lang ==='th'?'ชุดไม่ว่างในวันที่เลือกค่ะ':'Not available')
      : (lang ==='th'?'เลื่อนไม่สำเร็จค่ะ':'Reschedule failed');
    toast(m); return;
  }
  const xtra = (res.fee||0) + (res.extra_charge||0);
  toast(lang ==='th'?(xtra>0?`เลื่อนแล้ว · เก็บเพิ่ม ฿${xtra} (รอชำระ)`:'เลื่อนวันให้แล้ว ฟรีค่ะ'):(xtra>0?`Rescheduled · +฿${xtra}`:'Rescheduled')); openOrders();
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
      <textarea id="rvVideoText" class="rvtext" rows="2" placeholder="${lang ==='th'?'เล่าสั้น ๆ ว่าในคลิปพูดถึงอะไร':'Summarize what you said in the clip'}"></textarea>
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
      ? (lang ==='th'?'ขอบคุณที่แชร์รูปจริงนะคะ! +฿15 — ทุกครั้งที่ชุดได้ใส่ซ้ำ คือช่วยกันรักษ์โลกค่ะ':'Thank you for sharing! +฿15 — you keep our loop strong')
      : (lang ==='th'?'ขอบคุณสำหรับรีวิวนะคะ ทุกความเห็นช่วยให้เพื่อน ๆ เลือกชุดที่ใช่ได้ง่ายขึ้นค่ะ':'Thank you — you make our community stronger'));
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
// ── ที่อยู่จัดส่ง: เติม ตำบล/อำเภอ/จังหวัด อัตโนมัติจากรหัสไปรษณีย์ ─────────────
let _thPostal = null, _thPostalLoading = null, _zipEntries = [];
function loadThPostal() {
  if (_thPostal) return Promise.resolve(_thPostal);
  if (_thPostalLoading) return _thPostalLoading;
  _thPostalLoading = fetch('th-postal.json')
    .then(r => r.ok ? r.json() : {})
    .then(d => { _thPostal = d || {}; return _thPostal; })
    .catch(() => { _thPostal = {}; return _thPostal; });
  return _thPostalLoading;
}
async function onZipInput() {
  const zi = $('#pZip'); if (!zi) return;
  let z = (zi.value || '').replace(/\D/g, '').slice(0, 5);
  if (zi.value !== z) zi.value = z;
  const sel = $('#pTambon'), am = $('#pAmphoe'), pv = $('#pProvince');
  if (z.length < 5) { _zipEntries = []; if (sel) sel.innerHTML = `<option value="">${lang==='th'?'— ใส่รหัสก่อน —':'— enter code first —'}</option>`; if (am) am.value=''; if (pv) pv.value=''; return; }
  const db = await loadThPostal();
  _zipEntries = db[z] || [];   // [[province, amphoe, district], ...]
  if (!_zipEntries.length) {
    if (sel) sel.innerHTML = `<option value="">${lang==='th'?'ไม่พบรหัสนี้ — พิมพ์ที่อยู่เองได้':'not found — type address above'}</option>`;
    if (am) am.value=''; if (pv) pv.value=''; return;
  }
  const multiAmphoe = new Set(_zipEntries.map(e => e[1])).size > 1;
  if (sel) {
    sel.innerHTML = `<option value="">${lang==='th'?'เลือกตำบล/แขวง':'select subdistrict'}</option>` +
      _zipEntries.map((e, i) => `<option value="${i}">${e[2]}${multiAmphoe ? ' · '+e[1] : ''}</option>`).join('');
  }
  if (_zipEntries.length === 1) { sel.value = '0'; onTambonPick(); }
  else if (!multiAmphoe) { if (am) am.value = _zipEntries[0][1]; if (pv) pv.value = _zipEntries[0][0]; }
}
function onTambonPick() {
  const sel = $('#pTambon'); if (!sel || sel.value === '') return;
  const e = _zipEntries[+sel.value]; if (!e) return;
  if ($('#pAmphoe')) $('#pAmphoe').value = e[1];
  if ($('#pProvince')) $('#pProvince').value = e[0];
}
function composeAddress() {
  const detail = ($('#pAddrDetail') ? $('#pAddrDetail').value : '').trim();
  const sel = $('#pTambon');
  const z = $('#pZip') ? ($('#pZip').value || '').trim() : '';
  let tambon = '';
  if (sel && sel.value !== '' && _zipEntries[+sel.value]) tambon = _zipEntries[+sel.value][2];
  const amphoe = $('#pAmphoe') ? $('#pAmphoe').value.trim() : '';
  const province = $('#pProvince') ? $('#pProvince').value.trim() : '';
  const loc = [tambon && ('ต.'+tambon), amphoe && ('อ.'+amphoe), province && ('จ.'+province), z]
    .filter(Boolean).join(' ');
  return loc ? [detail, loc].filter(Boolean).join('\n') : detail;
}
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
  CUSTOMER.address = composeAddress();
  CUSTOMER.weight_kg = $('#pWeight') ? (+$('#pWeight').value || null) : CUSTOMER.weight_kg;
  CUSTOMER.size = $('#pSize') ? ($('#pSize').value || null) : CUSTOMER.size;
  CUSTOMER.birthday = $('#pBirthday') ? ($('#pBirthday').value || null) : CUSTOMER.birthday;
  CUSTOMER.prefs = {
    styles: [...pStyles], occasions: [...pOccasions],
    fav_colors: $('#pFav') ? $('#pFav').value : '',
    avoid_colors: $('#pAvoid') ? $('#pAvoid').value : '',
  };
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
      <div><b data-to="${im.rentals}">0</b><span>${lang === 'th' ? 'ครั้งที่วนใส่' : 'rotations'}</span></div>
      <div>~<b data-to="${im.water_l || 0}">0</b><span>${lang === 'th' ? 'ลิตรน้ำ (ประมาณ)' : 'litres water (est.)'}</span></div>
      <div>~<b data-to="${im.co2_kg || 0}">0</b><span>${lang === 'th' ? 'กก. คาร์บอน (ประมาณ)' : 'kg carbon (est.)'}</span></div>
    </div>
    <div class="ecotag">${lang === 'th' ? 'เช่าแทนซื้อ คือความสวยที่ไม่ทิ้งภาระไว้ให้โลก' : 'rent over buy — beauty that leaves no burden'}</div>
    <div style="font-size:10px;color:#8FA697;text-align:center;margin-top:8px">${lang === 'th' ? 'ตัวเลขสิ่งแวดล้อมเป็นค่าประมาณจากค่าเฉลี่ยอุตสาหกรรม' : 'environmental figures are estimates (industry averages)'}</div>
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
  $('#langTH')?.classList.toggle('on', lang ==='th');
  $('#langEN')?.classList.toggle('on', lang ==='en');
  applyStatic();
  let s;
  try { s = await window.API.init(); }
  catch (e) { console.warn('init failed, fallback to mock', e); s = window.MOCK; }
  OCCASIONS = s.OCCASIONS; CUSTOMER = s.CUSTOMER; EVENT = s.EVENT; GARMENTS = s.GARMENTS;
  STAFF_PCT = Number(s.staff_pct) || 0;   // พนักงาน → โชว์ราคาลด + ป้าย
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
  // ของขวัญวันเกิด: มีสิทธิ์เช่าฟรีไหม → โชว์ปุ่ม "ใช้สิทธิ์วันเกิด" ในหน้าชุด + แจ้งเตือนครั้งเดียว
  try {
    window.BDAY = await window.API.birthdayStatus?.(CUSTOMER);
    if (window.BDAY && window.BDAY.voucher && window.BDAY.voucher.active)
      setTimeout(() => toast(lang === 'th' ? `ของขวัญวันเกิด: เช่าฟรี 1 ชุด (ถึง ฿${window.BDAY.voucher.value_cap}) เลือกชุดได้เลย` : `Birthday gift: 1 free rental — pick a dress`), 1200);
  } catch (e) { window.BDAY = null; }
  // เดโม: ยังไม่ได้ล็อกอินผ่าน LINE (เปิดบน localhost) ใส่ตัวอย่างให้หน้าผลกระทบดูมีชีวิต
  if (!CUSTOMER._impact) CUSTOMER._impact = { rentals: 6, water_l: 16200, co2_kg: 36, charity_thb: 126, charity_name: 'โครงการเสื้อผ้าเพื่อน้อง' };
  renderEvent(); renderCatnav(); renderChips(); renderFilters(); renderDatebar(); renderGrid();
  if (window.renderSpotlight) window.renderSpotlight(GARMENTS);
  const vd = $('#venueDate'); if (vd) { vd.min = todayStr(); vd.value = gUseDate || ''; }
  refreshStylistQuota();
  await maybeShowTerms();
  maybeOnboard();
  routeDeepLink();
}
// rich menu deep-link: เปิด LIFF ?go=menu|foryou|orders|impact|profile|stylist แล้วเด้งไปหน้านั้น
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
      if (go === 'menu') openMenu();
      else if (go === 'foryou') { if (!fForYou) toggleForYou(); }
      else if (go === 'orders') openOrders();
      else if (go === 'membership') openMembership();
      else if (go === 'impact') openImpact();
      else if (go === 'profile') openProfile();
      else if (go === 'cart') openCart();
      else if (go === 'verify' || go === 'kyc') openKyc('');
      else if (go === 'stylist') { const el = $('#venueInput'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); } }
    }, 80);
  } catch (_e) { /**/ }
}
boot();
