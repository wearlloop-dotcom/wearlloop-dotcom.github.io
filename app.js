// ===== state =====
let OCCASIONS = {}, CUSTOMER = {}, EVENT = null, GARMENTS = [], VENUES = [];
// ส่วนลดพนักงาน: STAFF_PCT>0 เฉพาะพนักงาน → โชว์ราคาลด + ป้าย (ลูกค้าทั่วไป=0 ไม่เปลี่ยนอะไร)
let STAFF_PCT = 0;
const staffPrice = (p) => STAFF_PCT > 0 ? Math.round(Number(p || 0) * (1 - STAFF_PCT / 100)) : Number(p || 0);
const staffTag = () => STAFF_PCT > 0 ? `<span style="display:inline-block;font-size:11px;font-weight:600;color:#0F6E56;background:#E4F0EC;border:1px solid #cfe6da;border-radius:20px;padding:1px 8px;margin-left:6px">${lang==='th'?'พนักงาน':'Staff'} −${STAFF_PCT}%</span>` : '';
let fOccasion = null, fColors = [], fBrand ='', fMood = null, fToneOnly = false, fForYou = false, fWishOnly = false;
let gPersonalRecs = [];  // โค้ดชุดแนะนำเฉพาะบุคคล (collaborative) — เรียงตามความเกี่ยวข้อง
let gQuery = '';  // คำค้นหา catalog (ชื่อ/แบรนด์/โอกาส/สี)
let _searchTimer = null;
function onSearch(v) {
  gQuery = (v || '').trim().toLowerCase();
  renderGrid();
  // เก็บคำค้นเพื่อปิด demand gap (ops เห็นว่าคนหาอะไรไม่เจอ → ออก v_search_terms_30d)
  clearTimeout(_searchTimer);
  if (gQuery.length >= 2) _searchTimer = setTimeout(() => window.track?.('search', gQuery), 800);
}
function matchQuery(g) {
  if (!gQuery) return true;
  // brand alias/positioning → ค้นหา "มิตร", "celeb", "ราตรี", สะกดต่าง ก็เจอ
  const bm = window.LLOOP_BRANDS && window.LLOOP_BRANDS.lookup(g.brand);
  const bx = bm ? (bm.aliases.join(' ') + ' ' + bm.note + ' ' + (bm.types || []).join(' ')) : '';
  const hay = [g.name, g.brand, bx, g.category, (g.occasion_tags || []).map(occName).join(' '),
    g.colors.map(c => c[0]).join(' ')].join(' ').toLowerCase();
  return hay.includes(gQuery);
}
let gUseDate = null, gAvailSet = null, gOnlyAvail = false;  // เลือกวันใช้ตั้งแต่หน้าแรก
let gUseTime = '';  // ช่วงเวลาที่ไป (morning/day/evening/night) — ให้ AI วิเคราะห์ความเป็นทางการ/โทนให้ตรงเวลา
let fNewOnly = false, fPrice = null, gInStockOnly = false, gGroupByCountry = false;  // quick filters + directory: มาใหม่/ราคา/เฉพาะมีของ/จัดตามประเทศ
let gStylistPending = false;  // กดแนะนำแต่ยังไม่เลือกวัน → พอเลือกแล้วยิงต่อให้เอง
let gWish = new Set();  // garment id ที่หมายตา (wishlist)
let gDur = 3;           // ระยะเวลาเช่า (วัน) ในหน้ารายละเอียด
let gShowTypes = false; // toggle แสดงประเภทของ (types) ในหน้ารวมแบรนด์
let gCart = [];         // ตะกร้าจองหลายชุด → [{id,code,name,price,brand,photo,bg,date,dur}]
const CART_KEY = 'lloop_cart_v1';
// ตะกร้าค้างไว้ข้ามรอบ (กัน refresh แล้วของหาย)
function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(gCart)); } catch (e) {} }
function loadCart() {
  try { const v = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); if (Array.isArray(v)) gCart = v; } catch (e) { gCart = []; }
}

// รูปชุด — ใช้ photo หลัก ไม่งั้น photos[0] (ให้ตรงกับที่ stylist pick ใช้)
function gPhoto(g) { return (g && (g.photo || (Array.isArray(g.photos) && g.photos[0]))) || ''; }

// บวกวันแบบ local (กัน toISOString เลื่อนโซน +7) → คืน 'YYYY-MM-DD'
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function durEnd(fromStr) { return addDays(fromStr, gDur - 1); }
let lang = (localStorage.getItem('lloop_lang') ||'th');
const $ = s => document.querySelector(s);

// ===== สกุลเงิน (แสดงผลเท่านั้น — ชำระจริงเป็นเงินบาทผ่าน PromptPay) =====
// rate = จำนวนเงินต่างประเทศต่อ 1 บาท · ค่าเริ่ม = fallback (ใช้เมื่อดึงเรตสดไม่ได้)
const CUR = {
  THB: { sym:'฿',   rate:1,     round:1,  approx:false },
  USD: { sym:'$',   rate:0.028, round:1,  approx:true  },
  JPY: { sym:'¥',   rate:4.4,   round:10, approx:true  },
  CNY: { sym:'元',  rate:0.20,  round:1,  approx:true, suf:true },
};
let cur = (localStorage.getItem('lloop_cur') || 'THB');
if (!CUR[cur]) cur = 'THB';
let fxInfo = { live: false, date: '' };   // เรตสด/วันที่ สำหรับข้อความกำกับ
// แปลงบาท → สกุลที่เลือก + จัดรูปแบบ (มี "≈" นำหน้าถ้าเป็นค่าประมาณ)
function money(thb) {
  const n = Number(thb || 0);
  const c = CUR[cur] || CUR.THB;
  const v = Math.round(n * c.rate / c.round) * c.round;
  const num = v.toLocaleString('en-US');
  const body = c.suf ? `${num}${c.sym}` : `${c.sym}${num}`;
  return (c.approx ? '≈' : '') + body;
}
// ดึงเรตสด (ฐาน THB) จาก FX API ฟรี — แคช 24 ชม. · ล้มเหลว = ใช้ fallback ใน CUR
async function refreshFx() {
  try {
    const cached = JSON.parse(localStorage.getItem('lloop_fx') || 'null');
    if (cached && cached.ts && (Date.now() - cached.ts) < 864e5 && cached.rates) {
      applyFx(cached.rates, cached.date); return;
    }
    const r = await fetch('https://open.er-api.com/v6/latest/THB');
    const j = await r.json();
    if (j && j.result === 'success' && j.rates) {
      const rates = { USD: j.rates.USD, JPY: j.rates.JPY, CNY: j.rates.CNY };
      const date = (j.time_last_update_utc || '').replace(/ \d{2}:\d{2}:\d{2}.*$/, '');
      localStorage.setItem('lloop_fx', JSON.stringify({ ts: Date.now(), rates, date }));
      applyFx(rates, date);
    }
  } catch (e) { /* เงียบ — ใช้ fallback */ }
}
function applyFx(rates, date) {
  ['USD', 'JPY', 'CNY'].forEach(k => { if (rates[k] && CUR[k]) CUR[k].rate = rates[k]; });
  fxInfo = { live: true, date: date || '' };
  if (cur !== 'THB') { renderGrid(); renderQuickFilters && renderQuickFilters(); }
  updateCurNote();
}
// ข้อความกำกับใต้แถบสกุลเงิน — โชว์เฉพาะตอนเลือกสกุลต่างชาติ
function updateCurNote() {
  const el = $('#curNote'); if (!el) return;
  if (cur === 'THB') { el.hidden = true; return; }
  const th = lang === 'th';
  const src = fxInfo.live
    ? (th ? `เรตอ้างอิง ${fxInfo.date || 'ล่าสุด'}` : `rates as of ${fxInfo.date || 'today'}`)
    : (th ? 'เรตโดยประมาณ' : 'approx rates');
  el.textContent = th
    ? `บริการเช่าและจัดส่งเฉพาะในประเทศไทย · ราคาต่างสกุลเป็นค่าประมาณ (${src}) · ชำระจริงเป็นเงินบาท`
    : `Rental & delivery within Thailand only · foreign prices are approximate (${src}) · charged in Thai Baht`;
  el.hidden = false;
}
function setCur(c) {
  if (!CUR[c]) return;
  cur = c; localStorage.setItem('lloop_cur', c);
  document.querySelectorAll('.curbtn').forEach(b => b.classList.toggle('on', b.dataset.cur === c));
  // re-render ทุกจุดที่โชว์ราคา browse
  renderGrid(); renderQuickFilters && renderQuickFilters();
  if ($('#overlay')?.classList.contains('open') && window._detailId) openDetail(window._detailId);
  updateCurNote();
  if (c !== 'THB' && typeof toast === 'function')
    toast(lang === 'th' ? 'ราคาโดยประมาณ · ชำระจริงเป็นเงินบาท (THB)' : 'Approx prices · you pay in Thai Baht (THB)');
}

// ----- i18n helpers -----
const t = k => (window.I18N[lang][k]?? k);
const occName = c => (window.I18N[lang].occ[c] || c);
const dressName = th => (lang ==='th'? th : (window.I18N.en.dress[th] || th));
const weightName = w => (lang ==='th'? w : (window.I18N.en.weight[w] || w));
const stretchLabel = s => s ==='none'? t('noStretch') : s ==='slight'? t('slight') : t('stretchy');

function enterApp() {
  try { sessionStorage.setItem('lloop_entered', '1'); } catch (e) {}  // จำว่าเข้าแล้ว → กลับหน้าหลักไม่ต้องคั่น intro ซ้ำ
  const el = $('#intro');
  el.classList.add('hide');
  setTimeout(() => { el.style.display ='none'; }, 900);
}
function scrollToGrid() {
  const g = document.querySelector('.collabel') || $('#grid');
  if (g) g.scrollIntoView({ behavior:'smooth'});
}

// ----- hero video (แบบ Dior): autoplay/muted/loop + เล่นหลายคลิปต่อเนื่อง -----
let _heroClips = [], _heroIdx = 0;
function setupHeroVideo() {
  const v = $('#heroVideo'), hero = $('#hero'), ctrl = $('#heroCtrl');
  if (!v || !hero) return;
  const cfg = (window.CONFIG || {});
  _heroClips = [].concat(cfg.HERO_VIDEO || []).filter(Boolean);
  if (cfg.HERO_POSTER) v.poster = cfg.HERO_POSTER;
  if (!_heroClips.length) return; // ไม่มีวิดีโอ → คงพื้นหลังไล่สีเดิม
  const playAt = (i) => { _heroIdx = i % _heroClips.length; v.src = _heroClips[_heroIdx]; v.load(); v.play().catch(() => {}); };
  // คลิปเดียว = ลูปในตัว; หลายคลิป = ต่อคลิปถัดไปเมื่อจบ (montage)
  if (_heroClips.length === 1) v.loop = true;
  else v.addEventListener('ended', () => playAt(_heroIdx + 1));
  v.addEventListener('loadeddata', () => hero.classList.add('has-video'), { once: true });
  if (ctrl) ctrl.hidden = false;
  playAt(0);
}
function toggleHeroMute() {
  const v = $('#heroVideo'), b = $('#heroMute'); if (!v || !b) return;
  v.muted = !v.muted;
  b.querySelector('.ic-mute').hidden = !v.muted;
  b.querySelector('.ic-vol').hidden = v.muted;
}
function toggleHeroPlay() {
  const v = $('#heroVideo'), b = $('#heroPlay'); if (!v || !b) return;
  if (v.paused) { v.play().catch(() => {}); } else { v.pause(); }
  b.querySelector('.ic-pause').hidden = v.paused;
  b.querySelector('.ic-play').hidden = !v.paused;
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
  const vt = t('vTime'); if (vt && typeof vt === 'object') { ['','morning','day','evening','night'].forEach(k => { const o = document.getElementById('vtOpt_'+k); if (o) o.textContent = vt[k] || ''; }); }
  const cyc = t('cyc'); for (let i = 0; i < 4; i++) { const e = document.getElementById('cyc'+ i); if (e) e.textContent = cyc[i]; }
}

function setLang(l) {
  lang = l; localStorage.setItem('lloop_lang', l);
  $('#langTH')?.classList.toggle('on', l ==='th');
  $('#langEN')?.classList.toggle('on', l ==='en');
  document.querySelectorAll('.langbtn').forEach(b => b.classList.toggle('on', b.dataset.l === l));
  closeDetail(); closeProfile();
  applyStatic();
  renderEvent(); renderCatnav(); renderChips(); renderDiscover(); renderFilters(); renderGrid();
  // เมนู drawer เปิดค้างอยู่ → rebuild ให้ label เปลี่ยนภาษาทันที (ปุ่ม TH/EN อยู่ในเมนูนี้)
  if ($('#menuOverlay')?.classList.contains('open')) openMenu();
  updateCurNote();
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
  if (g.fitLabel === 'small') return { text:'ลูกค้าบอกตัวนี้ใส่ค่อนข้างเล็ก — เผื่อไซส์', cls:'small' };
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
  if (sv) parts.push(`<span style="background:#EAF3DE;color:#27500A;padding:4px 10px;border-radius:6px;font-size:12px">${th?'มูลค่าชุด':'Worth'} ${money(g.retail)} · ${th?'เช่าประหยัด':'save'} ${sv}%</span>`);
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
  // ML-lite: รสนิยมที่เรียนจากพฤติกรรมจริง (category/brand/season ที่ลูกค้าสนใจเอง)
  const tt = c._taste;
  if (tt && tt.n >= 5) {
    s += Math.round((tt.categories && tt.categories[g.category] || 0) * 40);
    s += Math.round((tt.brands && tt.brands[g.brand] || 0) * 30);
    s += Math.round((tt.seasons && tt.seasons[g.season] || 0) * 20);
  }
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

// ===== Discover — เลือกตามโอกาส + มู้ด (มู้ด = กลุ่มสไตล์จาก taxonomy แบรนด์) =====
const MOOD_LABEL = {
  th:{ minimal:'มินิมอล', feminine:'หวานเฟมินีน', statement:'ออกงาน-เปรี้ยว', party:'สดใสปาร์ตี้', korean:'เกาหลี', outer:'โค้ทเลเยอร์', swim:'ทะเล-บีช' },
  en:{ minimal:'Minimal', feminine:'Feminine', statement:'Statement', party:'Playful', korean:'Korean', outer:'Outerwear', swim:'Beachwear' }
};
const MOOD_ORDER = ['minimal','feminine','statement','party','korean','outer','swim'];
function garmentGroup(g){ const m = window.LLOOP_BRANDS && window.LLOOP_BRANDS.lookup(g.brand); return m ? m.group : null; }
// ชื่อแบรนด์มาตรฐานของชุด (กันสะกด/ตัวพิมพ์เพี้ยนตอน intake → ชิป/ฟิลเตอร์ไม่แตกเป็นหลายแบรนด์)
function gbrand(g){ return window.LLOOP_BRANDS ? window.LLOOP_BRANDS.canon(g.brand) : (g.brand || ''); }
// เมื่อมีหลายแบบสะกด (lookbook/Lookbook) เลือกตัวที่ดูดีกว่า (มีพิมพ์ใหญ่)
function nicerBrand(cur, cand){ return (!cur || (/[A-Z]/.test(cand) && !/[A-Z]/.test(cur))) ? cand : cur; }
const OCC_SUB = {
  th:{ wedding_guest:'ค็อกเทล · สุภาพ', dinner:'หรู · โรแมนติก', party:'เด่น · สนุก', cafe:'ลำลองมีสไตล์', work:'สมาร์ทแคชชวล', trip:'เบา พลิ้ว สดใส', graduation:'ทางการ · ถ่ายรูป', festival:'สดใส · สนุก', merit:'สุภาพเรียบร้อย', date:'หวาน · มั่นใจ' },
  en:{ wedding_guest:'Cocktail · polished', dinner:'Refined · romantic', party:'Bold · fun', cafe:'Casual, with style', work:'Smart casual', trip:'Light & breezy', graduation:'Formal · photo-ready', festival:'Bright · fun', merit:'Modest · neat', date:'Sweet · confident' }
};

function renderDiscover(){
  const el = $('#discover'); if(!el) return;
  const TH = lang === 'th';
  const tags = [...new Set(GARMENTS.flatMap(g => g.occasion_tags || []))];
  const groups = new Set(GARMENTS.map(garmentGroup).filter(Boolean));
  const moods = MOOD_ORDER.filter(k => groups.has(k));
  if(!tags.length && !moods.length){ el.innerHTML = ''; return; }
  let html = '';
  if(tags.length){
    html += `<div class="disc-q">${TH?'วันนี้ไปไหนคะ':'Where to today?'}</div>`;
    html += `<div class="disc-s">${TH?'เลือกโอกาส แล้วเราคัดลุคให้':'Pick an occasion — we curate the looks'}</div>`;
    html += `<div class="occgrid">` + tags.map((tg,i)=>`<button class="oc b${i%3} ${fOccasion===tg?'on':''}" onclick="pickOccasion('${tg}')"><span class="t">${occName(tg)}</span><span class="s">${(OCC_SUB[lang]||OCC_SUB.th)[tg]||''}</span></button>`).join('') + `</div>`;
  }
  if(moods.length){
    html += `<div class="disc-h">${TH?'เลือกตามมู้ด':'By mood'}</div>`;
    html += `<div class="moodrow"><button class="moodc ${!fMood?'on':''}" onclick="setMood('')">${TH?'ทั้งหมด':'All'}</button>` +
      moods.map(k=>`<button class="moodc ${fMood===k?'on':''}" onclick="setMood('${k}')">${(MOOD_LABEL[lang]||MOOD_LABEL.th)[k]||k}</button>`).join('') + `</div>`;
  }
  el.innerHTML = html;
}
function pickOccasion(tg){ setOccasion(fOccasion===tg?null:tg); const a=document.querySelector('.ed-eyebrow'); window.scrollTo({ top: a? a.offsetTop-16 : 380, behavior:'smooth' }); }
function setMood(k){ fMood = k || null; renderDiscover(); renderGrid(); }

// เฉดสีสำรองตาม personal-color season — ใช้เมื่อชุดยังไม่ได้แท็กสีจริง (color_hex ว่าง)
// เพื่อให้แถบกรองสีมีเฉดให้เลือกเสมอ ไม่ใช่วงเทา placeholder วงเดียว
const SEASON_SHADE = {
  spring:  ['พีชอุ่น', '#E7A977'],
  summer:  ['ฟ้าหม่น', '#A9B8C9'],
  autumn:  ['เทอราคอตต้า', '#C77B4E'],
  winter:  ['น้ำเงินหมึก', '#15233F'],
  neutral: ['เบจครีม', '#D8C8AE'],
};
const PLACEHOLDER_HEX = '#E7E2DA';
// เติมสีให้ชุดที่ยังไม่มี color_hex จริง (เหลือเป็นเทา default) ด้วยเฉดตามโทนสี
function normalizeGarmentColors() {
  GARMENTS.forEach(g => {
    const real = (g.colors || []).filter(c => c && c[1] && c[1] !== PLACEHOLDER_HEX && c[0] !== '—');
    if (real.length) { g.colors = real; return; }
    const sh = SEASON_SHADE[g.season];
    if (sh) g.colors = [sh.slice()];        // fallback ตามโทนสีส่วนตัวของชุด
  });
}

// ===== กลุ่มสี (rainbow) — ยุบเฉดใกล้กันเป็นกลุ่มเดียว, กดได้เฉดใกล้เคียงด้วย =====
const COLOR_FAMILIES = [
  {key:'pink',   th:'ชมพู',        en:'Pink',   hex:'#E6A6B6'},
  {key:'red',    th:'แดง',         en:'Red',    hex:'#C25B5B'},
  {key:'peach',  th:'พีช/ส้ม',     en:'Peach',  hex:'#E6B295'},
  {key:'yellow', th:'เหลือง',      en:'Yellow', hex:'#E6CE8E'},
  {key:'green',  th:'เขียว',       en:'Green',  hex:'#9CB089'},
  {key:'blue',   th:'ฟ้า/น้ำเงิน',  en:'Blue',   hex:'#9DB6CC'},
  {key:'purple', th:'ม่วง',        en:'Purple', hex:'#B3A8C9'},
  {key:'brown',  th:'น้ำตาล',      en:'Brown',  hex:'#A6845C'},
  {key:'cream',  th:'ครีม/ขาว',    en:'Cream',  hex:'#F1EADC'},
  {key:'grey',   th:'เทา',         en:'Grey',   hex:'#B6B2AA'},
  {key:'black',  th:'ดำ',          en:'Black',  hex:'#2E2E2E'},
];
function _hexHSL(hex){ let h=String(hex||'').replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join(''); if(h.length<6) return null;
  const r=parseInt(h.slice(0,2),16)/255,g=parseInt(h.slice(2,4),16)/255,b=parseInt(h.slice(4,6),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2; let s=0,hue=0;
  if(mx!==mn){const d=mx-mn; s=l>0.5?d/(2-mx-mn):d/(mx+mn); hue=mx===r?((g-b)/d+(g<b?6:0)):mx===g?(b-r)/d+2:(r-g)/d+4; hue*=60;}
  return {h:hue,s,l}; }
function classifyHex(hex){ const c=_hexHSL(hex); if(!c) return 'cream'; const {h,s,l}=c;
  if(l>=0.85) return 'cream'; if(l<=0.22) return 'black'; if(s<=0.12) return 'grey';
  if(h>=15&&h<=50&&s<=0.5&&l<=0.6) return 'brown';
  if(h<15||h>=330) return (s<0.5||l>0.62)?'pink':'red';
  if(h<45) return 'peach'; if(h<68) return 'yellow'; if(h<165) return 'green';
  if(h<255) return 'blue'; if(h<300) return 'purple'; return 'pink'; }
function classifyName(name){ const n=String(name||'').toLowerCase();
  if(/black|noir|onyx/.test(n)) return 'black';
  if(/grey|gray|charcoal|graphite/.test(n)) return 'grey';
  if(/cocoa|latte|coffee|brown|\btan\b|caramel|mocha|matin|mustard|chestnut|toffee|khaki/.test(n)) return 'brown';
  if(/olive|sage|matcha|mint|green|moss|pistachio/.test(n)) return 'green';
  if(/\bblue\b|bleu|periwinkle|sky|denim|navy|cornflower/.test(n)) return 'blue';
  if(/lavender|lilac|violet|purple|mauve|wisteria/.test(n)) return 'purple';
  if(/yellow|lemon|butter|\bcorn\b|gold|honey|banana|custard/.test(n)) return 'yellow';
  if(/peach|coral|apricot|terracotta|orange|salmon/.test(n)) return 'peach';
  if(/pink|blush|rosy|\brose\b|flamingo|cherry|sugar|fleur|bouquet|sakura|magenta|fuchsia|dandelion/.test(n)) return 'pink';
  if(/\bred\b|ruby|scarlet|crimson|wine|burgundy/.test(n)) return 'red';
  return 'cream'; }
function familiesOf(g){ const fams=new Set();
  const cv=(g.sourceMeta&&g.sourceMeta.color_variants)||null;
  if(cv&&cv.length){ cv.forEach(c=>fams.add(classifyName(c.name))); }
  else { (g.colors||[]).forEach(c=>{ const hex=c[1]; if(hex&&hex!==PLACEHOLDER_HEX) fams.add(classifyHex(hex)); else if(c[0]&&c[0]!=='—') fams.add(classifyName(c[0])); }); }
  if(!fams.size) fams.add('cream'); return fams; }

function renderFilters() {
  // ปุ่มสีเดียว (rainbow) → เปิด modal เลือกสี/ดูดสีจากรูป
  const brands = [...new Set(GARMENTS.map(g => g.brand).filter(Boolean))];
  const selFams = fColors.map(k => COLOR_FAMILIES.find(f => f.key === k)).filter(Boolean);
  const colorBtn = `<button class="colorpick ${fColors.length?'on':''}" onclick="openColorModal()">${selFams.length ? `<span class="cpdots">${selFams.slice(0,6).map(f=>`<i style="background:${f.hex}"></i>`).join('')}</span>${lang==='th'?`${selFams.length} สี`:`${selFams.length}`}` : `<i class="rainbow"></i>${lang==='th'?'เลือกสี':'Colour'}`}</button>`;
  const opts = [`<option value="">${t('allBrands')}</option>`].concat(brands.map(b =>`<option value="${b}"${fBrand === b?'selected':''}>${b}</option>`)).join('');
  $('#filters').innerHTML =`
    <button class="tone ${fToneOnly?'':'off'}" onclick="toggleTone()">● ${t('myTone')}</button>
    ${colorBtn}
    <select class="brandsel" onchange="setBrand(this.value)">${opts}</select>`;
  renderBrandChips();
  renderQuickFilters();
}

// ===== Quick filters: มาใหม่ / ช่วงราคา / ว่างวันฉัน (รวมแถบเดียว) =====
function priceOk(g){ if(!fPrice) return true; const p=Number(g.price||0); return fPrice==='lo'? p<=300 : fPrice==='mid'? (p>300&&p<=500) : fPrice==='hi'? p>500 : true; }
function renderQuickFilters(){
  const el=$('#quickRow'); if(!el) return;
  const TH=lang==='th';
  const PL={lo:'≤'+money(300),mid:money(300)+'–'+money(500).replace(/^≈/,''),hi:money(500)+'+'};
  const priceLabel=fPrice?PL[fPrice]:(TH?'ทุกราคา':'Any');
  const availOn=!!(gUseDate&&gOnlyAvail);
  el.innerHTML =
    `<button class="qf ${fNewOnly?'on':''}" onclick="setNewOnly()">${TH?'มาใหม่':'New'}</button>`+
    `<button class="qf ${fPrice?'on':''}" onclick="cyclePrice()">${TH?'งบ':'Budget'} · ${priceLabel}</button>`+
    `<button class="qf ${availOn?'on':''}" onclick="quickAvail()">${TH?'ว่างวันฉัน':'Free on date'}${gUseDate?' · '+fmtDate(gUseDate):''}</button>`;
}
function setNewOnly(){ fNewOnly=!fNewOnly; renderQuickFilters(); renderGrid(); }
function cyclePrice(){ const o=[null,'lo','mid','hi']; fPrice=o[(o.indexOf(fPrice)+1)%o.length]; renderQuickFilters(); renderGrid(); }
function quickAvail(){
  if(!gUseDate){ const d=$('#homeDate')||$('#venueDate'); if(d){ d.focus(); try{ d.showPicker&&d.showPicker(); }catch(e){} } toast(lang==='th'?'เลือกวันที่จะใส่ก่อนนะคะ':'Pick your date first'); return; }
  toggleOnlyAvail();
}

// Shop by Brand — ชิปแบรนด์ในสต็อก (hot ก่อน) + ปุ่มเปิดหน้ารวมแบรนด์
function renderBrandChips() {
  const el = $('#brandRow'); if (!el) return;
  const meta = window.LLOOP_BRANDS;
  const disp = new Map();  // dedup ไม่สนตัวพิมพ์: lowerKey → ชื่อแสดงที่ดูดีสุด
  GARMENTS.forEach(g => { const c = gbrand(g); if (!c) return; const k = c.toLowerCase(); disp.set(k, nicerBrand(disp.get(k), c)); });
  const inStock = [...disp.values()];
  if (!inStock.length) { el.innerHTML = ''; return; }
  const hotRank = b => { const m = meta && meta.lookup(b); return m && m.hot ? 0 : 1; };
  const top = inStock.slice().sort((a, b) => hotRank(a) - hotRank(b) || a.localeCompare(b)).slice(0, 8);
  const TH = lang === 'th';
  let html = `<div class="brandrow-h">${TH ? 'แบรนด์ยอดนิยม' : 'Shop by brand'}</div><div class="bchips">`;
  html += `<button class="bchip ${!fBrand ? 'on' : ''}" onclick="setBrand('')">${t('allBrands')}</button>`;
  html += top.map(b => `<button class="bchip ${String(fBrand).toLowerCase() === b.toLowerCase() ? 'on' : ''}" data-b="${esc(b)}" onclick="setBrand(this.dataset.b)">${esc(b)}</button>`).join('');
  html += `<button class="bchip more" onclick="openBrandDir()">${TH ? 'ดูทั้งหมด ›' : 'All ›'}</button></div>`;
  el.innerHTML = html;
}

// หน้ารวมแบรนด์ — จัดกลุ่มตามสไตล์ · มีของ = กดเช่า · ยังไม่มี = บอก "อยากให้มี"
function openBrandDir() {
  const meta = window.LLOOP_BRANDS; if (!meta) { setBrand(''); return; }
  const TH = lang === 'th';
  const cnt = {}, extras = new Map();  // extras dedup ไม่สนตัวพิมพ์: lowerKey → {d:ชื่อแสดง, n:จำนวน}
  GARMENTS.forEach(g => {
    const bn = g.brand; if (!bn) return;
    const m = meta.lookup(bn);
    if (m) { cnt[m.key] = (cnt[m.key] || 0) + 1; }
    else { const c = meta.canon(bn), k = c.toLowerCase(), e = extras.get(k); if (e) { e.n++; e.d = nicerBrand(e.d, c); } else extras.set(k, { d: c, n: 1 }); }
  });
  let html = `<div class="bdir${gShowTypes ? ' show-types' : ''}"><button class="bd-x" onclick="closeBrandDir()" aria-label="close">×</button><div class="bd-h">${TH ? 'รวมแบรนด์' : 'All brands'}</div><div class="bd-toolbar"><button class="bd-toggle ${gShowTypes ? 'on' : ''}" onclick="toggleBrandTypes(this)">${TH ? 'แสดงประเภทของ' : 'Show types'}</button><button class="bd-toggle ${gInStockOnly ? 'on' : ''}" onclick="toggleInStock()">${TH ? 'เฉพาะมีของ' : 'In stock'}</button><button class="bd-toggle ${gGroupByCountry ? 'on' : ''}" onclick="toggleCountry()">${TH ? 'จัดตามประเทศ' : 'By country'}</button></div>`;
  const sections = gGroupByCountry ? meta.ORIGINS : meta.GROUPS;
  const keyOf = gGroupByCountry ? (b => meta.originOf(b)) : (b => b.group);
  sections.forEach(gr => {
    const items = meta.BRANDS.filter(b => keyOf(b) === gr.key);
    if (!items.length) return;
    const rows = items.map(b => {
      const n = cnt[b.key] || 0;
      const ty = (b.types || []).join(' · ');
      if (n > 0) return `<button class="bd-b have" data-b="${esc(b.name)}" onclick="pickBrand(this.dataset.b)"><span class="bd-n">${esc(b.name)}<span class="bd-c">${n}</span></span><span class="bd-t">${esc(ty)}</span></button>`;
      if (gInStockOnly) return '';
      return `<button class="bd-b soon" data-k="${esc(b.key)}" data-n="${esc(b.name)}" onclick="notifyBrand(this.dataset.k,this.dataset.n)"><span class="bd-n">${esc(b.name)}</span><span class="bd-t">${esc(ty)}</span></button>`;
    }).join('');
    if (!rows) return;
    html += `<div class="bd-g"><div class="bd-gt">${gr.label}</div><div class="bd-row">${rows}</div></div>`;
  });
  if (extras.size) {
    html += `<div class="bd-g"><div class="bd-gt">${TH ? 'อื่น ๆ' : 'More'}</div><div class="bd-row">`;
    html += [...extras.values()].map(e => `<button class="bd-b have" data-b="${esc(e.d)}" onclick="pickBrand(this.dataset.b)"><span class="bd-n">${esc(e.d)}<span class="bd-c">${e.n}</span></span></button>`).join('');
    html += `</div></div>`;
  }
  html += `<div class="bd-note">${TH ? 'มีตัวเลข = เช่าได้เลย · กดแบรนด์อื่นเพื่อบอก “อยากให้มี” เราจะหาเข้ามาให้' : 'Number = available now · tap others to request them'}</div></div>`;
  $('#brandDirSheet').innerHTML = html;
  $('#brandDirOverlay').classList.add('open'); document.body.style.overflow = 'hidden';
}
function closeBrandDir() { $('#brandDirOverlay').classList.remove('open'); document.body.style.overflow = ''; }
function toggleBrandTypes(btn){ gShowTypes = !gShowTypes; const d = document.querySelector('.bdir'); if (d) d.classList.toggle('show-types', gShowTypes); if (btn) btn.classList.toggle('on', gShowTypes); }
function toggleInStock(){ gInStockOnly = !gInStockOnly; openBrandDir(); }
function toggleCountry(){ gGroupByCountry = !gGroupByCountry; openBrandDir(); }
function pickBrand(b) { closeBrandDir(); setBrand(b); window.scrollTo({ top: 380, behavior: 'smooth' }); }
function notifyBrand(key, name) {
  window.track?.('brand_demand', key);
  toast(lang === 'th' ? `บันทึกแล้ว — จะแจ้งเมื่อ ${name} เข้าคลัง` : `Saved — we'll tell you when ${name} arrives`);
}

function setOccasion(t2) { fOccasion = t2; renderCatnav(); renderChips(); renderDiscover(); renderGrid(); }
function setColor(h){ const i=fColors.indexOf(h); if(i<0) fColors.push(h); else fColors.splice(i,1); renderFilters(); renderGrid(); }
// ===== Modal เลือกสี + ดูดสีจากรูป (การ์ดงานแต่ง) =====
let _cardCtx=null,_cardCanvas=null;
function pickColor(key){ const i=fColors.indexOf(key); if(i<0) fColors.push(key); else fColors.splice(i,1); document.querySelectorAll('#cmodal .cfam').forEach(b=>b.classList.toggle('on', fColors.includes(b.dataset.fk))); renderFilters(); renderGrid(); }
function clearColors(){ fColors=[]; document.querySelectorAll('#cmodal .cfam').forEach(b=>b.classList.remove('on')); renderFilters(); renderGrid(); }
function famChip(f,extra){ return `<button class="cfam ${fColors.includes(f.key)?'on':''} ${extra||''}" data-fk="${f.key}" onclick="pickColor('${f.key}')" title="${lang==='th'?f.th:f.en}"><i style="background:${f.hex}"></i><span>${lang==='th'?f.th:f.en}</span></button>`; }
function openColorModal(){
  const present=new Set(); GARMENTS.forEach(g=>familiesOf(g).forEach(f=>present.add(f)));
  const pal=COLOR_FAMILIES.map(f=>famChip(f, present.has(f.key)?'':'dim')).join('');
  const m=document.createElement('div'); m.id='cmodal'; m.className='cmodal'; m.onclick=e=>{ if(e.target===m) closeColorModal(); };
  m.innerHTML=`<div class="cmsheet">
    <div class="cmhead"><b>${lang==='th'?'เลือกสีที่ชอบ':'Pick a colour'}</b><button class="cmx" onclick="closeColorModal()">×</button></div>
    <div class="cmpal">${pal}</div>
    <div class="cmor">${lang==='th'?'หรือดูดสีจากรูป — เช่น การ์ดงานแต่ง / ธีมงาน':'or pick from a photo — e.g. a wedding card'}</div>
    <label class="cmupload">${lang==='th'?'＋ อัปโหลดรูป':'＋ Upload image'}<input type="file" accept="image/*" onchange="onCardImage(this)" hidden></label>
    <div id="cmcanvaswrap" style="display:none"><div class="cmhint">${lang==='th'?'แตะหลายจุดบนรูปเพื่อเก็บหลายสี 🖌️':'Tap several spots to add colours 🖌️'}</div><canvas id="cmcanvas" onclick="onCanvasClick(event)"></canvas><div id="cmpicked" class="cmpicked"></div><div id="cmsugg" class="cmsugg"></div></div>
    <div class="cmfoot"><button class="cmclear" onclick="clearColors()">${lang==='th'?'ล้างสี':'Clear'}</button><button class="cmdone" onclick="closeColorModal()">${lang==='th'?'ดูชุด':'Show dresses'}</button></div>
  </div>`;
  document.body.appendChild(m);
}
function closeColorModal(){ const m=document.getElementById('cmodal'); if(m) m.remove(); _cardCtx=null; _cardCanvas=null; }
function _rgbHex(r,g,b){ return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function onCardImage(input){ const f=input.files&&input.files[0]; if(!f) return; const img=new Image(); img.onload=()=>{ const cv=document.getElementById('cmcanvas'); if(!cv) return; const W=Math.min(340,img.width||340); const sc=W/(img.width||W); cv.width=W; cv.height=Math.round((img.height||W)*sc); const ctx=cv.getContext('2d',{willReadFrequently:true}); ctx.drawImage(img,0,0,cv.width,cv.height); _cardCtx=ctx; _cardCanvas=cv; const wrap=document.getElementById('cmcanvaswrap'); if(wrap) wrap.style.display='block'; try{ showDominant(ctx,cv); }catch(e){} }; img.src=URL.createObjectURL(f); }
function onCanvasClick(e){ if(!_cardCtx||!_cardCanvas) return; const cv=_cardCanvas, r=cv.getBoundingClientRect(); if(!r.width||!r.height) return;
  const x=Math.floor((e.clientX-r.left)*cv.width/r.width), y=Math.floor((e.clientY-r.top)*cv.height/r.height);
  const sx=Math.max(0,Math.min(cv.width-3,x-2)), sy=Math.max(0,Math.min(cv.height-3,y-2));
  const d=_cardCtx.getImageData(sx,sy,Math.min(5,cv.width),Math.min(5,cv.height)).data; let R=0,G=0,B=0,n=0;
  for(let i=0;i<d.length;i+=4){ if(d[i+3]<128) continue; R+=d[i];G+=d[i+1];B+=d[i+2];n++; }
  if(!n) return; const hex=_rgbHex(Math.round(R/n),Math.round(G/n),Math.round(B/n)), fam=classifyHex(hex);
  pickColor(fam);
  const fb=document.getElementById('cmpicked'); if(fb){ const F=COLOR_FAMILIES.find(x=>x.key===fam); const on=fColors.includes(fam);
    fb.innerHTML=`<span class="pk" style="background:${hex}"></span>${on?(lang==='th'?'เพิ่มสี ':'Added '):(lang==='th'?'เอาออก ':'Removed ')}<b>${F?(lang==='th'?F.th:F.en):fam}</b>`; }
}
function showDominant(ctx,cv){ const d=ctx.getImageData(0,0,cv.width,cv.height).data; const sc={};
  for(let i=0;i<d.length;i+=4*5){ if(d[i+3]<128) continue; const hex=_rgbHex(d[i],d[i+1],d[i+2]); const c=_hexHSL(hex); const f=classifyHex(hex);
    const w=1+(c?c.s*c.s*12:0);  // เน้นสีสด (ดอกไม้/ธีม) มากกว่าพื้นหลังจาง
    sc[f]=(sc[f]||0)+w; }
  const top=Object.entries(sc).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k])=>COLOR_FAMILIES.find(x=>x.key===k)).filter(Boolean);
  const sg=document.getElementById('cmsugg'); if(sg) sg.innerHTML=`<div class="cmsugglbl">${lang==='th'?'สีในรูปนี้ — แตะเลือก (เลือกได้หลายสี)':'Colours here — tap to add'}</div>`+top.map(f=>famChip(f,'sm')).join(''); }
function setBrand(b) { fBrand = b; renderBrandChips(); renderGrid(); }
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
    if (added === true) { gWish.add(garmentId); const gg = GARMENTS.find(x => x.id === garmentId); window.track?.('wishlist_add', gg?.code || garmentId); }
    else if (added === false) gWish.delete(garmentId);
    if (btn) btn.classList.toggle('on', gWish.has(garmentId));
  } catch (e) { console.warn(e); }
  if (fWishOnly) renderGrid();
}

// ===== จัดกลุ่ม "สไตล์เดียวกันต่างไซส์" ให้เป็นการ์ดเดียว =====
const SIZE_ORDER = ['XS','S','M','L','XL','XXL','FREE'];
function sizeRank(s){ const i = SIZE_ORDER.indexOf(String(s||'').toUpperCase().trim()); return i < 0 ? 98 : i; }
// key รวม = แบรนด์+ชื่อ+สี (สีต่าง = คนละการ์ด กันรวมผิด); ไม่มี size → ไม่รวม
function styleKey(g){ return [String(g.brand||'').toLowerCase().trim(), String(g.name||'').toLowerCase().trim(), String((g.colors&&g.colors[0]&&g.colors[0][0])||'').toLowerCase().trim()].join('|'); }
// ชุดทุกไซส์ของ style เดียวกัน (เรียงไซส์) — ใช้ทำปุ่มเลือกไซส์ในรายละเอียด
function styleVariants(g){ const k = styleKey(g); return GARMENTS.filter(x => styleKey(x) === k).sort((a,b)=> sizeRank(a.size)-sizeRank(b.size)); }
// ยุบลิสต์ให้เหลือ 1 ตัวแทนต่อ style (ตัวแทน = ไซส์ S ถ้ามี) + แนบ _variants ที่อยู่ในลิสต์
function groupByStyle(list){
  const byKey = new Map();
  list.forEach(g => { const k = styleKey(g); (byKey.get(k) || byKey.set(k, []).get(k)).push(g); });
  const seen = new Set(), out = [];
  list.forEach(g => { const k = styleKey(g); if (seen.has(k)) return; seen.add(k);
    const vs = byKey.get(k).slice().sort((a,b)=> sizeRank(a.size)-sizeRank(b.size));
    const rep = vs.find(x => String(x.size||'').toUpperCase() === 'S') || vs[0];
    out.push(Object.assign({}, rep, { _variants: vs }));
  });
  return out;
}
// รูปตารางไซส์ = ภาพที่ OCR ระบุไว้จริง (source_meta.size_chart_url) — ไม่เดาจาก "รูปสุดท้าย"
function sizeChartPhoto(g){ return (g.sourceMeta && g.sourceMeta.size_chart_url) || null; }
// แกลเลอรี = รูปทั้งหมด ยกภาพตารางไซส์ออก (โชว์แยกในบล็อกตารางไซส์)
function galleryPhotos(g){ const p = Array.isArray(g.photos)? g.photos : []; const c = sizeChartPhoto(g); return c ? p.filter(u => u !== c) : p; }

function renderGrid() {
  let list = GARMENTS.filter(g =>
    (!fOccasion || g.occasion_tags.includes(fOccasion)) &&
    (!fColors.length || [...familiesOf(g)].some(fam => fColors.includes(fam))) &&
    (!fBrand || gbrand(g).toLowerCase() === String(fBrand).toLowerCase()) &&
    (!fMood || garmentGroup(g) === fMood) &&
    (!fToneOnly || g.season === CUSTOMER.my_color_season) &&
    (!fWishOnly || gWish.has(g.id)) &&
    (!fNewOnly || g.isNew) &&
    priceOk(g) &&
    matchQuery(g));
  if (fWishOnly && !list.length) { $('#grid').innerHTML =`<div class="empty">${lang ==='th'?'ยังไม่มีชุดที่หมายตา — แตะรูปหัวใจที่ชุดที่ชอบเพื่อเก็บไว้':'No saved looks yet — tap the heart on a piece you love'}</div>`; return; }
  if (fForYou) {
    // ดันชุดที่ "คนเหมือนคุณเช่า" (collaborative จาก behavior data) ขึ้นบนสุด แล้วตามด้วย personalScore
    const recIdx = g => { const i = gPersonalRecs.indexOf(g.code); return i < 0 ? 999 : i; };
    list = [...list].sort((a, b) => (recIdx(a) - recIdx(b)) || (personalScore(b) - personalScore(a)));
  }
  const availOf = g => !gUseDate || !gAvailSet || gAvailSet.has(g.id);  // null set = ว่างหมด (mock)
  if (gUseDate && gOnlyAvail) list = list.filter(availOf);
  if (!list.length) {
    $('#gridEnd') && ($('#gridEnd').textContent = '');
    if (gQuery) {
      $('#grid').innerHTML = `<div class="empty">${lang==='th'?`ยังไม่มี "${gQuery}" ในคลังตอนนี้`:`No "${gQuery}" in the collection yet`}<br><span style="font-size:12px;color:var(--muted)">${lang==='th'?'ลองใช้ LLOOP Atelier ช่วยหา หรือบอกโอกาสที่จะไป':'Try LLOOP Atelier, or tell us the occasion'}</span></div>`;
    } else { $('#grid').innerHTML = `<div class="empty">${t('empty')}</div>`; }
    return;
  }
  // continuous feed: เก็บลิสต์เต็ม แล้วโหลดทีละหน้า (มีจุดหยุดพอดี — ไม่ใช่ infinite loop เสพติด)
  gGridList = groupByStyle(list);   // รวมไซส์ของสไตล์เดียวกันเป็นการ์ดเดียว
  gGridShown = 0;
  $('#grid').innerHTML = '';
  renderGridPage();
}
const GRID_PAGE = 12;
let gGridList = [], gGridShown = 0;
function gridCardHtml(g) {
  const fit = fitConfidence(CUSTOMER, g);
  const fn = fitNote(g);
  const match = g.season === CUSTOMER.my_color_season;
  const vs = g._variants || [g];
  const av = !gUseDate || !gAvailSet || vs.some(v => gAvailSet.has(v.id));
  const sizeList = [...new Set(vs.map(v => String(v.size||'').toUpperCase()).filter(Boolean))].sort((a,b)=> sizeRank(a)-sizeRank(b));
  const sizeLbl = sizeList.length ? `<div class="psizes">${lang==='th'?'ไซส์':'Size'} ${sizeList.map(s=> s==='FREE'?(lang==='th'?'ฟรีไซส์':'Free'):s).join(' · ')}</div>` : '';
  const sv = savingsPct(g);
  const dots = g.colors.map(c =>`<i style="background:${c[1]}"></i>`).join('');
  const ph = gPhoto(g);
  return`<div class="pcard ${gUseDate && !av ? 'busy' : ''}" onclick="openDetail('${g.id}')">
      <div class="pphoto" style="${ph?`background-image:url('${ph}');background-size:cover;background-position:center`:`background:${g.bg}`}">
        ${ph?'':`<span class="ph">${g.name}</span>`}
        <button class="wish ${gWish.has(g.id)?'on':''}" onclick="toggleWish('${g.id}',event)" aria-label="wishlist">♥</button>
        <div class="badges">
          ${gUseDate ? `<span class="bdg ${av ? 'avail' : 'busy'}">${av ? (lang === 'th' ? 'ว่าง ' + fmtDate(gUseDate) : 'free ' + fmtDate(gUseDate)) : (lang === 'th' ? 'ไม่ว่าง' : 'booked')}</span>` : ''}
          ${g.isNew?`<span class="bdg new">NEW</span>`:''}
          ${(fForYou && gPersonalRecs.includes(g.code))?`<span class="bdg pick">${lang==='th'?'แนะนำสำหรับคุณ':'For you'}</span>`:''}
          ${match?`<span class="bdg tone">${t('toneMatch')}</span>`:''}
          ${sv?`<span class="bdg" style="background:#27500A;color:#fff">${lang==='th'?'ประหยัด ':'save '}${sv}%</span>`:''}
        </div>
        <div class="hoverbar">
          <div class="try">${lang ==='th'?'ลองดูเลย':'View'} ›</div>
          <div class="sizes">
            ${fit!= null?`<span>${t('fitGood')} ${fit}%</span>`:''}
            <span>${occName(g.occasion_tags[0])}</span>
            <span>${money(staffPrice(g.price))}</span>
          </div>
        </div>
      </div>
      <div class="pmeta">
        <div class="pbrand">${g.brand ||''}</div>
        <div class="pname">${g.name}</div>
        <div class="pprice">${money(staffPrice(g.price))}${staffTag()} <span style="color:var(--muted);font-weight:400">/ ${t('perTime')}</span></div>
        ${sizeLbl}
        <div class="pcolors">${dots}</div>
        ${fn?`<div class="fitnote ${fn.cls}">${fn.text}</div>`:''}
      </div>
    </div>`;
}
function renderGridPage() {
  const next = gGridList.slice(gGridShown, gGridShown + GRID_PAGE);
  $('#grid').insertAdjacentHTML('beforeend', next.map(gridCardHtml).join(''));
  gGridShown += next.length;
  const end = $('#gridEnd');
  if (end) {
    if (gGridShown >= gGridList.length) {
      // จุดหยุดพอดี: บอกชัดว่าดูครบแล้ว (ไม่หลอกให้เลื่อนต่อไม่จบ)
      end.textContent = gGridList.length > GRID_PAGE
        ? (lang === 'th' ? `ดูครบทั้ง ${gGridList.length} ชุดแล้ว` : `That's all ${gGridList.length} pieces`)
        : '';
    } else {
      end.textContent = '';
    }
  }
}
// โหลดหน้าถัดไปเมื่อเลื่อนใกล้ท้าย grid (lazy — แต่จบเมื่อหมดจริง)
function setupGridLazyLoad() {
  window.addEventListener('scroll', () => {
    if (gGridShown >= gGridList.length) return;
    const grid = $('#grid'); if (!grid) return;
    const rect = grid.getBoundingClientRect();
    if (rect.bottom < window.innerHeight + 600) renderGridPage();
  }, { passive: true });
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
  renderQuickFilters();
}
async function setHomeDate(d) {
  gUseDate = d || null;
  if (gUseDate) { try { gAvailSet = await window.API.availableSetOn?.(gUseDate, CUSTOMER && CUSTOMER.id); } catch (e) { gAvailSet = null; } }
  else { gAvailSet = null; gOnlyAvail = false; }
  // sync ช่องวันที่ทั้งสองจุด (แถบ stylist + datebar ใต้กริด)
  const vd = $('#venueDate'); if (vd) { vd.value = gUseDate || ''; vd.classList.remove('need'); }
  renderDatebar(); renderGrid();
  // ถ้าค้างรอเลือกวันอยู่ (กดแนะนำไปแล้วแต่ยังไม่มีวัน) → ยิงต่อให้เอง
  if (gUseDate && gStylistPending) { gStylistPending = false; askVenue(); }
}
function setHomeTime(v) {
  gUseTime = v || '';
  const vt = $('#venueTime'); if (vt) vt.value = gUseTime;
}
function clearHomeDate() { gUseDate = null; gAvailSet = null; gOnlyAvail = false; renderDatebar(); renderGrid(); }
function toggleOnlyAvail() { gOnlyAvail = !gOnlyAvail; renderDatebar(); renderGrid(); }

// ===== LLOOP Atelier ประจำสถานที่: ประเมินความเหมาะสม/สวยงาม/คล่องตัว + แนะนำชุดจากคลัง =====
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

// ลิงค์ Google Maps (วาง/แชร์มา) — รองรับลิงค์สั้นและลิงค์เต็ม
const MAPS_URL_RE = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+\/maps)/i;

async function askVenue() {
  let q = ($('#venueInput').value ||'').trim();
  const el = $('#vresult');
  const hasPlace = !!(window.SELECTED_PLACE && window.SELECTED_PLACE.name);
  if (!q && !hasPlace) { el.classList.remove('show'); return; }
  if (q) window.track?.('stylist_ask', q, { occasion: window.gQuizOccasion || (EVENT && EVENT.occasion) || null, date: gUseDate || null, time: gUseTime || null });
  // บังคับล็อกอิน + ยอมรับข้อตกลงก่อน (โควต้าผูกกับบัญชี + กันยิง resolve-place เปลือง Google API)
  if (!_isLoggedIn()) {
    el.className = 'vresult show';
    el.innerHTML = `<div class="note"><b style="color:var(--ink)">${t('vLoginNeed')}</b></div>`;
    try { window.LiffAuth && LiffAuth.signIn(); } catch (_e) {}
    return;
  }
  if (!(await ensureTermsAccepted())) { el.classList.remove('show'); return; }
  // วางลิงค์ Google Maps → แปลงเป็นสถานที่จริงก่อน (มิฉะนั้น AI จะได้สตริงลิงค์ดิบ ๆ)
  if (MAPS_URL_RE.test(q) && !hasPlace) {
    el.className = 'vresult show';
    el.innerHTML = `<span class="note">${lang==='th'?'กำลังอ่านสถานที่จากลิงค์…':'Reading the place from your link…'}</span>`;
    const rp = await window.API.resolvePlace({ url: q });
    if (rp && rp.ok && rp.place && rp.place.name) {
      window.SELECTED_PLACE = rp.place;
      const vi = $('#venueInput'); if (vi) vi.value = rp.place.name;
      q = rp.place.name;
    } else {
      el.innerHTML = `<div class="note"><b style="color:var(--ink)">${lang==='th'?'อ่านสถานที่จากลิงค์นี้ไม่ได้ ลองพิมพ์ชื่อสถานที่แทนนะคะ':'Could not read that link — try typing the place name instead'}</b></div>`;
      return;
    }
  }
  const place = window.SELECTED_PLACE && (window.SELECTED_PLACE.name === q || !q) ? window.SELECTED_PLACE : null;
  if (!q && !place) { el.classList.remove('show'); return; }
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

  const v = await window.API.stylist({ venue: name, place, occasion: window.gQuizOccasion || (EVENT && EVENT.occasion), date: gUseDate, time: gUseTime || null }, lang);

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

function setColorFromVenue(h) { fColors = [classifyHex(h)]; renderFilters(); renderGrid(); window.scrollTo({ top: 380, behavior:'smooth'}); }

// ===== detail =====
function openDetail(id) {
  const g = GARMENTS.find(x => x.id === id);
  window._detailId = id;   // เก็บไว้ให้ setCur re-render ราคาเมื่อสลับสกุลเงิน
  _backupPicks = [];   // ล้างชุดสำรองที่เลือกไว้จากชุดก่อนหน้า
  fbTrack('ViewContent', { content_ids:[g.code || g.id], content_name: g.name, content_type:'product', value: g.price, currency:'THB' });
  window.track?.('view_item', g.code || g.id, { name: g.name, price: g.price, occasion: (g.occasion_tags||[])[0] || null });
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
  window._curDetailId = g.id;  // ให้ปุ่มสลับหน่วยเรียก measureCells ใหม่ได้
  const swatches = g.colors.map(c =>`<div class="swatch"><i style="background:${c[1]}"></i><span>${c[0]}</span></div>`).join('');
  const cvars = (g.sourceMeta && g.sourceMeta.color_variants) || [];
  window._cvars = cvars;
  const colorSel = cvars.length
    ? `<div class="sec">${lang==='th'?'สีที่มี':'Colors'} (${cvars.length})</div><div class="dcolors" id="dcolors">${cvars.map((c,i)=>`<button class="dcolor${i===0?' on':''}" onclick="setGColor(${i})" title="${(c.name||'').replace(/"/g,'')}">${c.image?`<i style="background-image:url('${c.image}')"></i>`:`<i class="noimg"></i>`}<span>${c.name||''}</span></button>`).join('')}</div>`
    : `<div class="sec">${t('secColor')}</div><div class="colors">${swatches}</div>`;
  const tips = tipList.map(x =>`<div class="trow"><i></i>${x}</div>`).join('');

  const galImgs = galleryPhotos(g);
  const chart = sizeChartPhoto(g);
  const variants = styleVariants(g);
  const hasSizes = variants.some(v => v.size);
  // ไซส์ที่ "เรามีจริง" — ยึดจากแถวชุดในระบบ (data หลังบ้าน) ไม่ใช่จากแบรนด์
  const ourSizesLabel = [...new Set(variants.map(v => String(v.size||'').toUpperCase()).filter(Boolean))]
    .sort((a,b)=> sizeRank(a)-sizeRank(b))
    .map(s => s==='FREE' ? (lang==='th'?'ฟรีไซส์':'Free') : s).join(' · ');
  // dedupe ตามไซส์ (เผื่อมีหลายยูนิตไซส์เดียวกัน เช่น one size 2 ตัว) — 1 ปุ่มต่อไซส์
  const _seenSz = new Set();
  const uniqVariants = variants.filter(v => { const s = String(v.size||'').toUpperCase(); if (_seenSz.has(s)) return false; _seenSz.add(s); return true; });
  const sizeChips = hasSizes ? `<div class="dsizes">${uniqVariants.map(v => {
    const on = String(v.size||'').toUpperCase() === String(g.size||'').toUpperCase();
    const avAble = !(gUseDate && gAvailSet) || gAvailSet.has(v.id);
    const lbl = String(v.size||'').toUpperCase() === 'FREE' ? (lang==='th'?'ฟรีไซส์':'Free') : (v.size || '–');
    return `<button class="${on?'on':''}" ${(!on && !avAble)?'disabled':''} ${on?'':`onclick="openDetail('${v.id}')"`}>${lbl}</button>`;
  }).join('')}</div>` : '';

  $('#sheet').innerHTML =`
    <div class="dphoto" style="${galImgs.length?'':`background:${g.bg}`}">
      ${galImgs.length
        ? `<div class="dgal" id="dgal" onscroll="galTick()">${galImgs.map(u=>`<div style="background-image:url('${u}')"></div>`).join('')}</div>
           ${galImgs.length>1?`<button class="dgarrow prev" onclick="galNav(-1)" aria-label="prev">\u2039</button>
             <button class="dgarrow next" onclick="galNav(1)" aria-label="next">\u203a</button>
             <span class="dgcount" id="dgcount">1 / ${galImgs.length}</span>`:''}`
        : `<span class="ph" style="font-family:var(--serif);font-style:italic;color:rgba(0,0,0,.28)">${g.name}</span>`}
      <button class="close" onclick="closeDetail()">×</button>
      ${match?`<span class="season" style="position:absolute;top:14px;left:14px">${t('toneMatch')}</span>`:''}
    </div>
    <div class="dbody">
      <div class="cbrand">${g.brand ||''}</div>
      <div class="dname">${g.name}</div>
      <div class="dmeta">${g.tier} · ${t('rotating')}</div>
      ${sizeChips ? `<div class="sec">${lang==='th'?'เลือกไซส์':'Select size'}</div>${sizeChips}` : ''}
      <div id="ratingline" class="ratingline"></div>
      <div id="socialproof" class="socialproof"></div>
      ${fit!= null?`<div class="fitbox"><div class="pct">${fit}%</div>
        <div><div style="font-size:13px;font-weight:500;color:#04342C">${t('fitTitle')}</div>
        <div style="font-size:11px;color:var(--ok)">${t('fitFromPre')} ${g.stretch!=='none'? t('stretchHelp') : t('noStretchHelp')}</div></div></div>`:''}
      ${tips?`<div class="sec">${t('secWear')}</div><div class="tips">${tips}</div>`:''}
      <div class="sec">${lang ==='th'?'ครบลุค — ทรงผม & เครื่องประดับ':'Complete the look'}</div>
      <div id="lookbox" class="lookbox"><button class="lookbtn" onclick="loadLook('${g.code || g.id}','${(g.occasion_tags||[])[0]||''}')">${lang ==='th'?'ดูทรงผม & เครื่องประดับที่เข้ากับชุดนี้':'See hair & accessories for this look'}</button></div>
      <div id="ugcWrap" style="display:none"><div class="sec">${lang ==='th'?'รูปจริงจากลูกค้า':'Real customer photos'}</div><div id="ugcbox" class="ugcbox"></div></div>
      <div class="sec secrow">${t('secSize')}<span class="munit">${['in','cm'].map(u=>`<button data-u="${u}" class="${gMUnit===u?'on':''}" onclick="setMUnit('${u}')">${u==='in'?(lang==='th'?'นิ้ว':'inch'):(lang==='th'?'ซม.':'cm')}</button>`).join('')}</span></div>
      <div class="measure" id="measureBox">${measureCells(g)}</div>
      ${chart ? `<div class="sec">${lang==='th'?'ตารางไซส์':'Size chart'}</div><div class="dsizechart"><img src="${chart}" alt="size chart" loading="lazy">${ourSizesLabel ? `<div class="dscnote">${lang==='th'?`ตารางอ้างอิงจากแบรนด์ — <b>ไซส์ที่เรามีให้เช่า: ${ourSizesLabel}</b>`:`Brand reference — <b>we rent: ${ourSizesLabel}</b>`}</div>` : ''}</div>` : ''}
      <div id="fitsummary"></div>
      <div class="sec">${t('secFabric')}</div>
      <div class="fabric">${fabricTags}</div>
      ${colorSel}
      <div id="recoWith" class="recowith"></div>
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
    <label class="backupopt" for="wantBackup">
      <input type="checkbox" id="wantBackup" onchange="toggleBackupPick('${g.id}')">
      <span class="bo-txt">
        <span class="bo-title">${lang==='th'?'เลือกชุดสำรองเผื่อไว้เอง':'Choose your own spare'}</span>
        <span class="bo-why">${lang==='th'
          ? 'เผื่อชุดหลักมีเหตุไม่พร้อมจริง ๆ เช่น ผู้เช่าก่อนหน้าทำชุดเสียหาย เลือกชุดที่อยากให้สลับให้เองได้เลย — ไม่มีค่าใช้จ่ายเพิ่ม'
          : 'If your main piece truly can’t make it (e.g. a prior renter damaged it), pick the spares you’d want us to swap in — no extra charge.'}</span>
      </span>
    </label>
    <div id="backupPicker" class="backuppick" hidden></div>
    <div class="cta">
      <span class="price">${subCovers(g) ? `<span style="color:var(--sage)">${lang==='th'?'รวมในแพ็กเกจ':'Included in plan'}${subCapLabel(g)}</span>` : money(staffPrice(g.price))+staffTag()}</span>
      ${subCovers(g) ? '' : `<button class="cartbtn" onclick="addToCart('${g.id}')" title="${lang==='th'?'เพิ่มลงตะกร้า':'Add to cart'}">+ ${lang==='th'?'ตะกร้า':'Cart'}</button>`}
      <button id="bookBtn" onclick="reserve('${g.id}')">${t('reserveBtn')}</button>
    </div>
    ${(window.BDAY && window.BDAY.voucher && window.BDAY.voucher.active && !subCovers(g))
      ? `<button class="bdaybtn" onclick="bdayBook('${g.id}')">${lang==='th'
          ? (g.price<=window.BDAY.voucher.value_cap?'ใช้สิทธิ์วันเกิด · เช่าฟรี':`ใช้สิทธิ์วันเกิด · จ่ายเพิ่ม ฿${g.price-window.BDAY.voucher.value_cap}`)
          : (g.price<=window.BDAY.voucher.value_cap?'Use birthday gift · free':`Use birthday gift · pay ฿${g.price-window.BDAY.voucher.value_cap}`)}</button>`
      : ''}
    ${subCovers(g)
      ? `<div class="creditline">${lang==='th'?`ใช้สิทธิ์สมาชิก ${CUSTOMER._sub.plan_name} · เหลือ ${CUSTOMER._sub.remaining} ชุดรอบนี้ · ส่งฟรีขาไป`:`Using ${CUSTOMER._sub.plan_name} · ${CUSTOMER._sub.remaining} left · free outbound`}</div>`
      : `<div class="creditline">${t('creditPre')}${credit}${t('creditMid')}${g.price - credit}</div>`}`;
  $('#overlay').classList.add('open');
  document.body.style.overflow ='hidden';
  renderAvailCalendar(g.id);
  renderUGC(g.id);
  loadRating(g.id);  // เรตติ้ง/รีวิวของชุด (async inject)
  loadFit(g.code || g.id);  // สรุปฟิตจากลุคจริงในชุมชน (Lemon8: trust)
  loadSocialProof(g.code || g.id);  // มีคนเช่า/ดู/หมายตา (social proof)
  loadRecommendWith(g.code || g.id);  // ใส่คู่กับชุดนี้บ่อย (collaborative)
  if (gUseDate) checkAvail(g.id);  // โชว์สถานะวันที่เลือกจากหน้าแรกทันที
  $('#overlay').scrollTop = 0; const sh = $('#sheet'); if (sh) sh.scrollTop = 0;
}
let gMUnit = 'in';  // หน่วยตารางวัดตัว: นิ้ว / ซม.
function measureCells(g){
  const u = gMUnit;
  const rng = a => a ? (u==='cm' ? `${Math.round(a[0]*2.54)}–${Math.round(a[1]*2.54)} ${t('cm')}` : `${a[0]}–${a[1]}"`) : t('free');
  const one = v => v ? (u==='cm' ? `${Math.round(v*2.54)} ${t('cm')}` : `${v}"`) : t('free');
  const len = g.length ? (u==='cm' ? `${Math.round(g.length)} ${t('cm')}` : `${Math.round(g.length/2.54*2)/2}"`) : '—';
  return [[t('bust'),rng(g.bust)],[t('waist'),rng(g.waist)],[t('hip'),one(g.hip)],[t('length'),len]]
    .map(m=>`<div class="mcell"><span>${m[0]}</span>${m[1]}</div>`).join('');
}
function setMUnit(u){ gMUnit=u; const box=document.getElementById('measureBox'); const g=GARMENTS.find(x=>x.id===window._curDetailId); if(box&&g) box.innerHTML=measureCells(g); document.querySelectorAll('.munit button').forEach(b=>b.classList.toggle('on', b.dataset.u===u)); }
function closeDetail() { $('#overlay').classList.remove('open'); document.body.style.overflow =''; }
// เลือกสี → ไฮไลต์ + เปลี่ยนรูปหลักเป็นสีนั้น
function setGColor(i){ const c=(window._cvars||[])[i]; if(!c) return;
  document.querySelectorAll('#dcolors .dcolor').forEach((b,j)=>b.classList.toggle('on',j===i));
  if(c.image){ const g=document.getElementById('dgal'); if(g&&g.firstElementChild){ g.firstElementChild.style.backgroundImage=`url('${c.image}')`; g.scrollTo({left:0,behavior:'smooth'}); if(typeof galTick==='function') galTick(); } }
}
// เลื่อนแกลเลอรีด้วยปุ่มลูกศร + อัปเดตตัวนับรูป
function galNav(dir){ const g=document.getElementById('dgal'); if(!g) return; g.scrollBy({left: dir*g.clientWidth, behavior:'smooth'}); }
function galTick(){ const g=document.getElementById('dgal'), c=document.getElementById('dgcount'); if(!g||!c) return; const n=g.children.length; const i=Math.min(n, Math.round(g.scrollLeft/Math.max(1,g.clientWidth))+1); c.textContent=i+' / '+n; }

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

// สรุปฟิต/ไซส์ จาก "ลุคจริง" ในชุมชน (คนเคยใส่บอกสูง/ไซส์/ความพอดี) — ลดลังเล ลดคืนผิดไซส์
async function loadFit(code) {
  const el = $('#fitsummary'); if (!el) return;
  let f = null; try { f = await window.API.garmentFit?.(code); } catch (e) { /**/ }
  if (!f || !f.n) { el.innerHTML = ''; return; }
  const th = lang === 'th';
  const fit = f.fit || {};
  const tot = (fit.true||0)+(fit.large||0)+(fit.small||0);
  const cs = 'display:inline-flex;align-items:center;gap:5px;background:#fff;border:1px solid #cfe6da;border-radius:8px;padding:5px 10px;font-size:12px;color:#0F6E56;font-weight:500';
  const chips = [];
  if (f.avg_height) chips.push(`<span style="${cs}">${th?'สูงเฉลี่ย':'avg height'} <b>${f.avg_height}</b> ${th?'ซม.':'cm'}</span>`);
  if (f.common_size) chips.push(`<span style="${cs}">${th?'ไซส์ที่เช่าบ่อย':'common size'} <b>${esc(f.common_size)}</b></span>`);
  let verdict = '';
  if (tot >= 2) {
    const top = (fit.true>=fit.large && fit.true>=fit.small) ? 'true' : (fit.large>=fit.small ? 'large' : 'small');
    verdict = top==='true' ? (th?'ส่วนใหญ่บอกใส่พอดีตัว':'most say true to size')
            : top==='large' ? (th?'หลายคนบอกเผื่อ/ใหญ่นิด — แนะนำลดไซส์':'runs large — size down')
            : (th?'หลายคนบอกฟิต/เล็กนิด — แนะนำเผื่อไซส์':'runs small — size up');
  }
  el.innerHTML = `<div style="background:#E4F0EC;border:1px solid #cfe6df;border-radius:12px;padding:12px 13px;margin-top:10px">
    <div style="font-size:13px;font-weight:600;color:#04342C;margin-bottom:8px">${th?'ฟิตจริงจากคนใน loop':'Fit from real renters'} <span style="color:#0F6E56;font-weight:500">· ${f.n} ${th?'ลุค':'looks'}</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:7px">${chips.join('')}</div>
    ${verdict?`<div style="font-size:12.5px;color:#04342C;margin-top:9px;font-weight:500">${verdict}</div>`:''}</div>`;
}

// Social proof: "มีคนเช่าไปแล้ว X ครั้ง · กำลังมาแรง · กำลังดูอยู่ N คน" — urgency + ความน่าเชื่อ
async function loadSocialProof(code) {
  const el = $('#socialproof'); if (!el) return;
  const th = lang === 'th';
  let s = null, live = 0;
  try { [s, live] = await Promise.all([window.API.socialProof?.(code), window.API.liveViewers?.(code)]); } catch (e) { /**/ }
  const chips = [];
  if (live >= 2) chips.push(`<span class="sp-chip live"><i class="lvdot"></i>${th ? `มีคนกำลังดู ${live} คน` : `${live} viewing now`}</span>`);
  if (s) {
    if (s.rented_30d > 0) chips.push(`<span class="sp-chip"><b>${s.rented_30d}</b> ${th ? 'คนเช่าใน 30 วัน' : 'rented · 30d'}</span>`);
    if (s.views_7d >= 8) chips.push(`<span class="sp-chip hot">${th ? 'กำลังมาแรง' : 'trending'}</span>`);
    if (s.wishlisted > 0) chips.push(`<span class="sp-chip"><b>${s.wishlisted}</b> ${th ? 'คนหมายตา' : 'saved'}</span>`);
  }
  el.innerHTML = chips.join('');
}
// "ใส่คู่กับชุดนี้บ่อย" — collaborative recommendations (เช่า/ดูด้วยกันบ่อย)
async function loadRecommendWith(code) {
  const el = $('#recoWith'); if (!el) return;
  let recs = []; try { recs = await window.API.recommendWith?.(code, 4) || []; } catch (e) { /**/ }
  const items = recs.map(r => GARMENTS.find(g => (g.code || '') === r.code)).filter(Boolean);
  if (!items.length) { el.innerHTML = ''; return; }
  const th = lang === 'th';
  el.innerHTML = `<div class="sec">${th ? 'ใส่คู่กับชุดนี้บ่อย' : 'Often rented together'}</div>`
    + `<div class="recorow">${items.map(gThumb).join('')}</div>`;
}

// ===== Personal rails บนหน้าแรก (Shopee/Lazada-style) =====
//   1) "ดูล่าสุด" (Recently viewed) — จาก behavior_events รายคน
//   2) "เพราะคุณดู X" — collaborative (recommendWith) ของชุดที่เพิ่งดูล่าสุด
let gRecentViewed = [];   // [{code,last_ts}] โหลดตอน init (login แล้วเท่านั้น)
async function renderPersonalRail() {
  const el = $('#personalRail'); if (!el) return;
  const th = lang === 'th';
  const codes = gRecentViewed.map(r => r.code);
  const recent = codes.map(c => GARMENTS.find(g => (g.code || '') === c)).filter(Boolean);
  let html = '';
  if (recent.length >= 2) {   // โชว์เมื่อมีของจริงพอเป็นแถว
    html += `<div class="sec">${th ? 'ดูล่าสุด' : 'Recently viewed'}</div>`
          + `<div class="recorow">${recent.map(gThumb).join('')}</div>`;
  }
  // "เพราะคุณดู X" — อิงชุดที่เพิ่งดูล่าสุดสุด
  const seed = recent[0];
  if (seed) {
    let recs = []; try { recs = await window.API.recommendWith?.(seed.code, 8) || []; } catch (e) { /**/ }
    const items = recs.map(r => GARMENTS.find(g => (g.code || '') === r.code))
                      .filter(g => g && g.code !== seed.code);
    if (items.length >= 2) {
      html += `<div class="sec">${th ? `เพราะคุณดู ${esc(seed.name || '')}` : `Because you viewed ${esc(seed.name || '')}`}</div>`
            + `<div class="recorow">${items.slice(0, 10).map(gThumb).join('')}</div>`;
    }
  }
  el.innerHTML = html;
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
  // รูปจริงจากลูกค้า = รูป creator (UGC ผ่านออดิท) + รูปรีวิว
  let ugc = [], rev = [];
  try { [ugc, rev] = await Promise.all([
    window.API.garmentUgcPhotos?.(garmentId) || [], window.API.garmentReviewPhotos?.(garmentId) || []]); } catch (e) { /**/ }
  const photos = [...ugc, ...rev];
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
  return { hair, jewelry, accessories, shoes, note: 'แนะนำเบื้องต้น — LLOOP Atelier ตัวเต็มจะวิเคราะห์ละเอียดตามรูปหน้า/หุ่นของคุณ' };
}
async function loadLook(code, occasion) {
  const box = $('#lookbox'); if (!box) return;
  if (!(await ensureAtelierAccess())) return;   // บังคับล็อกอิน + ยอมรับข้อตกลงก่อน
  box.innerHTML = `<div class="lookloading">${lang ==='th'?'กำลังจัดลุคให้คุณ…':'styling your look…'}</div>`;
  const g = GARMENTS.find(x => (x.code || x.id) === code) || {};
  let look = null;
  try { look = await window.API.hairStyle?.(code, occasion); } catch (e) { /**/ }
  const noQuota = look && look.error === 'no_quota';
  if (!look || !look.hair) look = mockLook(g);
  // โควต้า LLOOP Atelier หมด → ยังโชว์คำแนะนำเบื้องต้นให้ แต่บอกเหตุผล
  if (noQuota) look = { ...look, note: lang ==='th'?'โควต้า LLOOP Atelier หมดแล้ว — นี่คือคำแนะนำเบื้องต้น · เช่าชุดรับเพิ่ม 3 ครั้ง':'LLOOP Atelier quota used up — these are basic suggestions · rent for +3 more' };
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
  try { free = await window.API.availableOn(id, date, CUSTOMER && CUSTOMER.id); } catch (e) { console.warn(e); }
  if (free) {
    msg.className ='availmsg ok';
    msg.textContent = lang ==='th'?`✓ ว่าง ${fmtDate(date)} จองได้เลย`:`✓ Free on ${fmtDate(date)}`;
  } else {
    msg.className ='availmsg busy';
    const lbl = lang ==='th'?`✕ ไม่ว่าง ${fmtDate(date)} ลองวันอื่น`:`✕ Booked on ${fmtDate(date)}`;
    // ต่อคิว "วันนี้": พอวันนี้เปิดจริง จะแจ้งให้เลือกก่อนใคร (date-aware)
    msg.innerHTML = `${lbl} <button class="queuebtn" onclick="joinQueue('${id}','${date}')">${lang==='th'?`ต่อคิววันนี้ · แจ้งเมื่อว่าง`:'Notify me for this date'}</button>`;
  }
  renderQuote(id, date);
  // เปลี่ยนวัน → ชุดที่ว่างเปลี่ยนตาม รีเฟรช picker ชุดสำรองถ้าเปิดอยู่
  if ($('#wantBackup') && $('#wantBackup').checked) toggleBackupPick(id);
  return free;
}

// ต่อคิวชุดสำหรับ "วันที่เลือก" — พอวันนั้นเปิดจริง ได้สิทธิ์เลือกก่อนใคร
async function joinQueue(id, date) {
  if (!CUSTOMER || !CUSTOMER.id) { toast(lang==='th'?'เข้าสู่ระบบก่อนนะคะ':'Please sign in first'); return; }
  const r = await window.API.joinWaitlist?.(id, date || null);
  if (!r || r.ok !== true) { toast(lang==='th'?'ต่อคิวไม่สำเร็จ ลองใหม่นะคะ':'Could not join — try again'); return; }
  window.track?.('waitlist_join', (GARMENTS.find(x=>x.id===id)||{}).code || id, { date });
  const dlabel = date ? fmtDate(date) : '';
  const msg = $('#availMsg'); if (msg) {
    msg.className = 'availmsg ok';
    msg.textContent = r.already
      ? (lang==='th'?`อยู่ในคิว ${dlabel} แล้ว · คุณคิวที่ ${r.position}/${r.total}`:`Already queued for ${dlabel} · #${r.position}/${r.total}`)
      : (lang==='th'?`ต่อคิว ${dlabel} แล้ว · คิวที่ ${r.position} — พอวันนี้ว่างเราแจ้งให้เลือกก่อนใครค่ะ`:`Queued for ${dlabel} · #${r.position} — we'll notify you first when this date opens`);
  }
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
  if (!q || q.error) {
    // โหลดสรุปยอดไม่สำเร็จ (เช่น เซสชัน LINE หมดอายุ) — อย่าให้หน้าจอว่างเงียบ ๆ
    box.innerHTML = `<div class="qdates" style="color:var(--muted,#8C8B86);text-align:center;padding:6px 0">${lang === 'th' ? 'โหลดสรุปยอดไม่สำเร็จ — แตะวันที่อีกครั้ง หรือเข้าสู่ระบบใหม่' : "Couldn't load the summary — tap the date again or sign in"}</div>`;
    return;
  }
  const TH = lang === 'th';
  const row = (k, v, hl) => `<div class="qrow${hl ? ' hl' : ''}"><span>${k}</span><b>${v}</b></div>`;
  const baht = n => '฿' + n;
  // เครดิตในกระเป๋าหักอัตโนมัติ (เฉพาะค่าเช่า+ค่าส่ง ไม่แตะมัดจำ) → ยอดโอนสุทธิ
  const walletBal = Math.round(CUSTOMER.credit_balance || 0);
  const creditApplied = Math.max(0, Math.min(walletBal, Math.round((q.rate || 0) + (q.shipping || 0))));
  const netTotal = Math.max(0, Math.round((q.total || 0) - creditApplied));
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
        <div style="font-size:13px;margin-top:6px">${TH ? 'สแกนแล้วโอน' : 'Scan & pay'} <b>${baht(netTotal)}</b></div></div>`
      : pay.pay_promptpay_qr ? `<div style="text-align:center;margin:10px 0">
        <img src="${pay.pay_promptpay_qr}" alt="PromptPay QR" style="display:block;margin:0 auto;width:200px;max-width:70%;border:1px solid var(--line,#E7E5E1);border-radius:6px">
        <div style="font-size:13px;margin-top:6px">${TH ? 'สแกนแล้วโอน' : 'Scan & pay'} <b>${baht(netTotal)}</b></div></div>` : ''}
      <div style="font-size:12px;color:var(--muted,#8C8B86);margin-top:6px">${pay.pay_note || (TH ? 'โอนแล้วแนบสลิปในแชตนี้ ระบบตรวจให้อัตโนมัติค่ะ' : 'Transfer then send slip in chat — we verify it automatically')}</div>
    </div>`;
  const kyc = q.kyc_required ? `<div class="kycnote">
      <div class="kt">${TH ? 'ยืนยันตัวตน ลดมัดจำได้' : 'Verify to lower your deposit'}</div>
      <div class="ks">${TH ? 'แนบบัตรประชาชน + IG/FB สาธารณะ ครั้งเดียว' : 'Attach ID + public IG/FB, just once'}</div>
      <button class="kbtn" onclick="openKyc('${id}')">${TH ? 'ยืนยันตัวตน' : 'Verify identity'}</button>
    </div>` : '';
  // ป้ายราคาพนักงาน — โชว์เฉพาะพนักงาน (is_staff) ลูกค้าทั่วไปไม่เห็น
  const staffBadge = q.is_staff ? `<div style="display:inline-block;margin:2px 0 8px;font-size:12px;font-weight:600;color:#0F6E56;background:#E4F0EC;border:1px solid #cfe6da;border-radius:20px;padding:3px 11px">${TH ? 'ราคาพนักงาน' : 'Staff price'} −${q.staff_discount}%${q.rate_full ? ` · ${TH ? 'ปกติ' : 'was'} ${baht(q.rate_full)}` : ''}</div>` : '';
  // จ่ายด้วยเครดิตในกระเป๋า — ครอบค่าเช่า+ค่าส่ง (ไม่รวมมัดจำ) เมื่อยอดในกระเป๋าพอ
  const creditBal = Math.round(CUSTOMER.credit_balance || 0);
  const creditCover = Math.round((q.total || 0) - (q.deposit || 0));
  const canCredit = creditCover > 0 && creditBal >= creditCover;
  const creditBtn = !canCredit ? '' : `
    <button onclick="reserve('${id}', true)" style="width:100%;margin-top:12px;border:1px solid #C9A227;background:#FBF6E9;color:#7A5C00;border-radius:12px;padding:11px 14px;font-weight:600;cursor:pointer;text-align:left">
      ${TH ? 'จ่ายด้วยเครดิตในกระเป๋า' : 'Pay with wallet credit'} <b>${baht(creditCover)}</b>
      <div style="font-size:12px;font-weight:400;color:#9A7B1E;margin-top:3px">${TH ? `ตัดจากกระเป๋า ฿${creditCover} (เหลือ ฿${creditBal - creditCover})` : `From wallet ฿${creditCover} (฿${creditBal - creditCover} left)`}${q.deposit > 0 ? (TH ? ` · มัดจำ ฿${q.deposit} วางตอนรับชุด คืนเต็มหลังตรวจ` : ` · ฿${q.deposit} deposit at pickup, fully refunded`) : ''}</div>
    </button>`;
  box.innerHTML = `
    <div class="qhd">${TH ? 'สรุปยอด' : 'Summary'} · ${q.days} ${TH ? 'วัน' : 'days'}</div>
    ${staffBadge}
    ${row(TH ? 'ค่าเช่า' : 'Rental', baht(q.rate))}
    ${q.deposit > 0 ? row(TH ? 'มัดจำ (คืนเข้ากระเป๋าหลังตรวจชุด)' : 'Deposit (back to wallet)', baht(q.deposit)) : ''}
    ${row(TH ? 'ค่าส่ง' : 'Shipping', q.shipping > 0 ? baht(q.shipping) : (TH ? 'ส่งฟรี' : 'Free'))}
    ${creditApplied > 0 ? row(TH ? 'ใช้เครดิตในกระเป๋า' : 'Wallet credit', '−' + baht(creditApplied)) : ''}
    ${row(TH ? 'รวมโอน' : 'Total', netTotal > 0 ? baht(netTotal) : (TH ? 'ใช้เครดิตครบ' : 'Fully covered'), true)}
    ${q.deposit > 0 ? `<div class="qdates" style="color:var(--muted,#8C8B86)">${TH ? `ยอดนี้รวมมัดจำ ฿${q.deposit} แล้ว · มัดจำคืนเข้ากระเป๋า LLOOP หลังเราตรวจชุด` : `Total includes a ฿${q.deposit} deposit · returned to your LLOOP wallet after we inspect the dress`}</div>` : ''}
    <div class="qdates qspan">${TH ? 'วันรับชุด (นับเป็นวันแรก)' : 'Day 1 (you receive it)'}: <b>${fmtDate(q.use_date)}</b> · ${TH ? `เช่า ${q.days} วัน` : `${q.days} days`}</div>
    <div class="qdates">${TH ? 'กำหนดคืน' : 'Return by'} <b>${fmtDate(q.return_date)}${q.return_by ? (TH ? ` ก่อน ${q.return_by} น.` : ` by ${q.return_by}`) : ''}</b> ${TH ? `(วันที่ ${q.days} ของการเช่า)` : `(day ${q.days})`}</div>
    <div class="qdates">${TH ? 'เราจัดส่งให้ของถึงมือคุณตรงวันรับ · คืนตรงเวลาช่วยให้ชุดพร้อมคิวถัดไปทัน' : 'We ship so it arrives on your Day 1 · on-time return keeps the next booking on track'}</div>
    ${kyc}
    ${creditBtn}
    ${payBlock}`;
  // วาด QR แบรนด์ LLOOP ฝังยอด (หลัง element อยู่ใน DOM แล้ว)
  if (pay && pay.pay_promptpay_id && window.promptpayBrandedQR) {
    const ppEl = document.getElementById('ppqr');
    if (ppEl) window.promptpayBrandedQR(ppEl, pay.pay_promptpay_id, netTotal, pay.pay_promptpay_type);
  }
}

// แผงยืนยันหลังจอง — คง QR + ยอด + คำสั่ง "แนบสลิปในแชต" + ลิงก์ดูออเดอร์ ไว้ให้ลูกค้าไม่ค้างกลางทาง
function closePayConfirm() { const o = document.getElementById('payConfirmOverlay'); if (o) o.remove(); document.body.style.overflow = ''; }
function showPayConfirm({ g, date, total, pay, backups }) {
  const TH = lang === 'th';
  closePayConfirm();
  const bk = (backups && backups.length) ? (TH ? `เตรียมชุดสำรองให้ ${backups.length} ตัว` : `${backups.length} spare(s) on standby`) : '';
  // QR แบบฝังยอดต้องมี total เสมอ — ถ้าดึงยอดไม่ได้ อย่าโชว์กล่อง QR เปล่า ให้ตกไป fallback แทน
  const canQR = !!(pay && pay.pay_promptpay_id) && total != null;
  const hasPay = pay && (pay.pay_account_no || pay.pay_promptpay_qr || canQR);
  const ov = document.createElement('div');
  ov.id = 'payConfirmOverlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(26,26,26,.55);display:flex;align-items:flex-end;justify-content:center';
  ov.onclick = (e) => { if (e.target === ov) closePayConfirm(); };
  ov.innerHTML = `
    <div style="background:#fff;width:100%;max-width:440px;border-radius:18px 18px 0 0;padding:22px 20px 26px;max-height:92vh;overflow:auto">
      <div style="text-align:center">
        <div style="font-size:15px;font-weight:600;color:#0F6E56">${TH ? 'จองสำเร็จ — อีกขั้นเดียว' : 'Reserved — one step left'}</div>
        <div style="font-size:13px;color:var(--muted,#8C8B86);margin-top:3px">${g.name} · ${TH ? 'วันรับ' : 'pickup'} ${fmtDate(date)}${bk ? ` · ${bk}` : ''}</div>
      </div>
      ${hasPay ? `
      <div style="text-align:center;margin-top:14px">
        ${canQR ? `<div id="pcfqr"></div>` : pay.pay_promptpay_qr ? `<img src="${pay.pay_promptpay_qr}" alt="PromptPay QR" style="display:block;margin:0 auto;width:200px;max-width:70%;border:1px solid var(--line,#E7E5E1);border-radius:6px">` : ''}
        ${pay.pay_account_no ? `<div style="font-size:13px;margin-top:8px">${pay.pay_bank_name || ''} <b>${pay.pay_account_no}</b>${pay.pay_account_name ? ` · ${pay.pay_account_name}` : ''}</div>` : ''}
        ${total != null ? `<div style="font-size:15px;font-weight:600;margin-top:10px">${TH ? 'โอน' : 'Transfer'} ฿${total}</div>` : ''}
      </div>
      <div style="background:#FBF6E9;border:1px solid #EBDFC0;border-radius:12px;padding:12px 14px;margin-top:14px;font-size:13px;color:#7A5C00;text-align:center;font-weight:600">
        ${TH ? 'โอนแล้ว แนบสลิปในแชต LINE นี้' : 'After paying, send the slip in this LINE chat'}
        <div style="font-weight:400;font-size:12px;margin-top:3px">${TH ? 'ระบบตรวจสลิปและยืนยันออเดอร์ให้อัตโนมัติ' : 'We verify the slip and confirm your order automatically'}</div>
      </div>` : `
      <div style="background:#FBF6E9;border:1px solid #EBDFC0;border-radius:12px;padding:12px 14px;margin-top:14px;font-size:13px;color:#7A5C00;text-align:center">${TH ? 'จองไว้ให้แล้ว · ทีมงานจะส่งวิธีชำระเงินให้ในแชต LINE นี้ค่ะ' : 'Reserved — we’ll send payment details in this LINE chat'}</div>`}
      <button onclick="closePayConfirm();openOrders()" style="width:100%;margin-top:16px;border:1px solid var(--ink,#1A1A1A);background:#fff;border-radius:12px;padding:11px;font-weight:600;cursor:pointer">${TH ? 'ดูออเดอร์ของฉัน' : 'View my order'}</button>
      <button onclick="closePayConfirm()" style="width:100%;margin-top:8px;border:none;background:none;color:var(--muted,#8C8B86);padding:8px;cursor:pointer">${TH ? 'ปิด' : 'Close'}</button>
    </div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  if (pay && pay.pay_promptpay_id && window.promptpayBrandedQR && total != null) {
    const el = ov.querySelector('#pcfqr');
    if (el) try { window.promptpayBrandedQR(el, pay.pay_promptpay_id, total, pay.pay_promptpay_type); } catch (e) { /**/ }
  }
}

// ===== ชุดสำรอง — ลูกค้าเลือกเอง =====
let _backupPicks = [];          // โค้ดชุดที่ลูกค้าเลือกเป็นสำรอง
let _bpPool = [];               // ชุดที่ว่างวันนั้น เรียงตามความใกล้ชุดหลักแล้ว
let _bpPrimary = null;          // ชุดหลักที่กำลังจอง (ใช้คิดคะแนนความใกล้)
let _bpQuery = '';              // คำค้นในตัวเลือกชุดสำรอง
let _bpWhy = {};                // code → เหตุผลที่ LLOOP Atelier ให้ (ทำไมสลับแทนได้เนียน)
let _bpRanked = false;          // AI จัดอันดับให้แล้วหรือยัง
let _bpRanking = false;         // กันกดซ้ำระหว่างรอ AI
const BACKUP_MAX = 2;           // เลือกได้สูงสุดกี่ตัว

// คะแนนความ "ใกล้ชุดหลัก" — ยิ่งสูงยิ่งสลับแทนได้เนียน (ไซส์ใส่ได้ต้องมาก่อน)
function backupScore(primary, c) {
  if (!primary) return 0;
  let s = 0;
  // ไซส์ตรงกัน = สำคัญสุด ชุดสำรองต้องใส่ได้จริง
  if (primary.size && c.size && String(primary.size).toUpperCase() === String(c.size).toUpperCase()) s += 40;
  // หมวดเดียวกัน (เดรส↔เดรส) สลับแทนตรงประเภท
  if (primary.category && c.category && primary.category === c.category) s += 22;
  // โอกาสใช้งานทับกัน
  const po = primary.occasion_tags || [], co = c.occasion_tags || [];
  s += Math.min(24, po.filter(tg => co.includes(tg)).length * 12);
  // โทนสีทับกัน (เทียบ hex)
  const ph = (primary.colors || []).map(x => x[1]), ch = (c.colors || []).map(x => x[1]);
  s += Math.min(20, ph.filter(h => ch.includes(h)).length * 10);
  // ช่วงราคาใกล้กัน (ห่าง ฿0 = +10 แล้วลดหลั่นตามส่วนต่าง)
  if (primary.price && c.price) s += Math.max(0, 10 - Math.abs(primary.price - c.price) / 40);
  return s;
}
// เปิด/ปิด picker เมื่อกดเช็กบ็อกซ์ + โหลดเฉพาะชุดที่ "ว่างจริง" ในวันที่เลือก แล้วเรียงตามความเข้ากัน
async function toggleBackupPick(primaryId) {
  const cb = $('#wantBackup'), box = $('#backupPicker');
  if (!cb || !box) return;
  if (!cb.checked) { box.hidden = true; box.innerHTML = ''; _backupPicks = []; _bpPool = []; _bpQuery = ''; _bpWhy = {}; _bpRanked = false; return; }
  const date = $('#useDate') && $('#useDate').value;
  if (!date) {
    toast(lang ==='th'?'เลือกวันที่ต้องใช้ก่อน แล้วค่อยเลือกชุดสำรองนะคะ':'Pick your date first, then choose spares');
    cb.checked = false; return;
  }
  box.hidden = false;
  box.innerHTML = `<div class="bp-load">${lang ==='th'?'กำลังเช็กชุดที่ว่างวันนั้น…':'checking what’s free that day…'}</div>`;
  // เฉพาะชุดที่ว่างในวันนั้น (Set ของ id) — ไม่ให้เลือกชุดที่ติดคิว
  let availSet = null;
  try { availSet = await window.API.availableSetOn(date, CUSTOMER.id); } catch (e) { /**/ }
  _bpPrimary = GARMENTS.find(x => x.id === primaryId) || null;
  // ว่างวันนั้น → ให้คะแนนความใกล้ชุดหลัก → ใกล้สุดมาก่อน
  _bpPool = GARMENTS
    .filter(x => x.id !== primaryId && (x.code || x.id) !== primaryId && (!availSet || availSet.has(x.id)))
    .map(x => ({ g: x, sc: backupScore(_bpPrimary, x) }))
    .sort((a, b) => b.sc - a.sc)
    .map(o => o.g);
  // ถ้าลูกค้าปิดแล้วเปิดใหม่/เปลี่ยนวัน → ตัดที่เลือกค้างซึ่งไม่อยู่ใน pool ออก
  _backupPicks = _backupPicks.filter(c => _bpPool.some(p => (p.code || p.id) === c));
  _bpQuery = ''; _bpWhy = {}; _bpRanked = false;
  renderBackupPicker();
}
// โครงคงที่ (หัวข้อ + ช่องค้นหา) — ไม่ re-render ทั้งก้อนตอนพิมพ์ กันคีย์บอร์ดเด้งปิด
function renderBackupPicker() {
  const box = $('#backupPicker');
  if (!box) return;
  if (!_bpPool.length) {
    box.innerHTML = `<div class="bp-empty">${lang ==='th'?'วันนั้นยังไม่มีชุดอื่นว่างให้เลือกเป็นสำรองค่ะ':'No other pieces are free that day to set as a spare'}</div>`;
    return;
  }
  const canAI = !(window.CONFIG && CONFIG.USE_MOCK) && _bpPool.length >= 3;
  box.innerHTML = `
    <div class="bp-head">${_bpRanked
      ? (lang ==='th'?`LLOOP Atelier เรียงให้แล้ว · เลือกได้สูงสุด ${BACKUP_MAX} ตัว`:`Ranked by LLOOP Atelier · up to ${BACKUP_MAX}`)
      : (lang ==='th'?`แนะนำชุดที่เข้ากับชุดหลัก · เลือกได้สูงสุด ${BACKUP_MAX} ตัว`:`Closest matches to your pick · up to ${BACKUP_MAX}`)}</div>
    <div class="bp-search"><input type="text" id="bpSearch" inputmode="search" placeholder="${lang ==='th'?'ค้นหาชุดอื่นที่ว่างวันนั้น…':'search other free pieces…'}" value="${esc(_bpQuery)}" oninput="onBackupSearch(this.value)"></div>
    ${canAI ? `<button type="button" class="bp-ai${_bpRanked?' done':''}" id="bpAiBtn"${_bpRanked?' disabled':''} onclick="aiRankBackups()">${_bpRanked
        ? (lang ==='th'?'✦ LLOOP Atelier จัดอันดับให้แล้ว':'✦ Ranked by LLOOP Atelier')
        : (lang ==='th'?'✦ ให้ LLOOP Atelier ช่วยเรียงให้':'✦ Let LLOOP Atelier rank these')}</button>` : ''}
    <div id="bpGridWrap"></div>`;
  renderBackupGrid();
}
// เฉพาะกริด — รีเฟรชตอนค้นหาโดยไม่แตะช่อง input
function renderBackupGrid() {
  const wrap = $('#bpGridWrap');
  if (!wrap) return;
  const q = _bpQuery.trim().toLowerCase();
  const list = q
    ? _bpPool.filter(p => [p.name, p.brand, p.category, (p.occasion_tags || []).map(occName).join(' '), (p.colors || []).map(c => c[0]).join(' ')].join(' ').toLowerCase().includes(q))
    : _bpPool;
  if (!list.length) {
    wrap.innerHTML = `<div class="bp-empty">${lang ==='th'?`ไม่พบ "${esc(_bpQuery)}" ในชุดที่ว่างวันนั้น`:`No "${esc(_bpQuery)}" among free pieces`}</div>`;
    return;
  }
  wrap.innerHTML = `<div class="bp-grid">${list.map(p => {
    const code = p.code || p.id;
    const photo = p.photo || (Array.isArray(p.photos) && p.photos[0]);
    const on = _backupPicks.includes(code);
    const why = _bpWhy[code];
    return `<button type="button" class="bp-chip${on?' on':''}" data-code="${esc(code)}" onclick="pickBackup(this.dataset.code)"${why?` title="${esc(why)}"`:''}>
      <span class="bp-thumb" style="${photo?`background-image:url('${esc(photo)}')`:`background:${esc(p.bg||'#E7E2DA')}`}"></span>
      <span class="bp-nm">${esc(p.name||'—')}</span>
      ${why?`<span class="bp-why">${esc(why)}</span>`:''}
      <span class="bp-tick">✓</span>
    </button>`;
  }).join('')}</div>`;
}
function onBackupSearch(v) { _bpQuery = v; renderBackupGrid(); }
// ลูกค้ากด → ส่งชุดหลัก + ชุดที่เลือกได้ ไปให้ LLOOP Atelier เรียง "สลับแทนได้เนียนสุด" ก่อน
async function aiRankBackups() {
  if (_bpRanking || !_bpPrimary || !_bpPool.length) return;
  if (!(await ensureAtelierAccess())) return;   // บังคับล็อกอิน + ยอมรับข้อตกลงก่อน
  const btn = $('#bpAiBtn');
  const reset = () => { if (btn) { btn.disabled = false; btn.textContent = lang ==='th'?'✦ ให้ LLOOP Atelier ช่วยเรียงให้':'✦ Let LLOOP Atelier rank these'; } };
  _bpRanking = true;
  if (btn) { btn.disabled = true; btn.textContent = lang ==='th'?'✦ LLOOP Atelier กำลังเรียงให้…':'✦ LLOOP Atelier is ranking…'; }
  const slim = g => ({
    code: g.code || g.id, name: g.name, brand: g.brand, category: g.category,
    size: g.size, price: g.price,
    colors: (g.colors || []).map(c => c[0]),
    occasion: (g.occasion_tags || []).map(occName),
  });
  try {
    const resp = await window.API.rankBackups(slim(_bpPrimary), _bpPool.slice(0, 24).map(slim), lang) || {};
    const ranked = Array.isArray(resp.ranked) ? resp.ranked : [];
    if (resp.error === 'no_quota') {
      // โควต้า LLOOP Atelier หมด → ใช้การเรียงอัตโนมัติเดิมต่อได้ ไม่เสียอะไร
      toast(lang ==='th'?'โควต้า LLOOP Atelier หมดแล้ว — เช่าชุดเพื่อรับเพิ่ม 3 ครั้ง (ตอนนี้ใช้การเรียงอัตโนมัติให้แล้ว)':'LLOOP Atelier quota used up — rent an outfit for +3 (showing the auto-sorted order)');
      if (btn) { btn.disabled = true; btn.textContent = lang ==='th'?'โควต้า LLOOP Atelier หมดแล้ว':'LLOOP Atelier quota used up'; }
    } else if (ranked.length) {
      _bpWhy = {};
      const order = [];
      ranked.forEach(r => { if (r && r.code) { _bpWhy[r.code] = r.why || ''; order.push(String(r.code)); } });
      const byCode = new Map(_bpPool.map(p => [String(p.code || p.id), p]));
      const head = order.map(c => byCode.get(c)).filter(Boolean);
      const headSet = new Set(order);
      const tail = _bpPool.filter(p => !headSet.has(String(p.code || p.id)));
      _bpPool = [...head, ...tail];
      _bpRanked = true; _bpQuery = '';
      renderBackupPicker();
    } else {
      toast(lang ==='th'?'LLOOP Atelier ยังเรียงให้ไม่ได้ ลองใหม่อีกครั้งนะคะ':'Could not rank right now — please try again');
      reset();
    }
  } catch (e) {
    toast(lang ==='th'?'เชื่อมต่อ LLOOP Atelier ไม่ได้ ลองใหม่นะคะ':'LLOOP Atelier unavailable — please try again');
    reset();
  }
  _bpRanking = false;
}
function pickBackup(code) {
  const i = _backupPicks.indexOf(code);
  if (i >= 0) _backupPicks.splice(i, 1);
  else {
    if (_backupPicks.length >= BACKUP_MAX) { toast(lang ==='th'?`เลือกชุดสำรองได้สูงสุด ${BACKUP_MAX} ตัวค่ะ`:`Up to ${BACKUP_MAX} spares`); return; }
    _backupPicks.push(code);
  }
  document.querySelectorAll('#backupPicker .bp-chip').forEach(b => b.classList.toggle('on', _backupPicks.includes(b.dataset.code)));
}
async function reserve(id, useCredit) {
  const g = GARMENTS.find(x => x.id === id);
  const date = $('#useDate') && $('#useDate').value;
  if (!date) {
    const msg = $('#availMsg');
    if (msg) { msg.className ='availmsg busy'; msg.textContent = lang ==='th'?'เลือกวันที่ต้องใช้ก่อนนะคะ':'Pick a date first'; }
    const di = $('#useDate');
    if (di) { di.classList.add('need'); di.addEventListener('input', () => di.classList.remove('need'), { once:true }); }
    // เลื่อน container ของชีตเอง (scrollIntoView ไม่เสถียรใน overlay fixed/LIFF webview)
    const dp = document.querySelector('.datepick'), cont = dp && (dp.closest('.sheet') || dp.parentElement);
    if (dp && cont) { const top = dp.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop - 12; cont.scrollTo({ top, behavior:'smooth' }); }
    if (di) try { di.focus(); } catch (e) { /**/ }
    return;
  }
  // ต้องมีที่อยู่จัดส่งก่อนจอง — กันจ่ายเงินแล้วไม่มีที่ส่งของ
  if (!requireAddress()) return;
  // ด่าน KYC — เต็มเฉพาะชุดพรีเมียม/ดีไซเนอร์
  if (!(await kycGate(g.tier))) return;
  window.track?.('begin_checkout', g.code || g.id, { price: g.price, date });
  const toDate = durEnd(date);
  // กันจองชน — เช็กว่างตลอดช่วงเช่า (ไม่ใช่แค่วันแรก) ให้ตรงกับที่ server จองจริง
  let freeRange = true;
  try { freeRange = await window.API.availableRange(id, date, toDate); } catch (e) { console.warn(e); }
  if (freeRange === false) { checkAvail(id); return; }
  const wantBackup = !!($('#wantBackup') && $('#wantBackup').checked);
  // ชุดสำรอง = ลูกค้าเลือกเอง (ส่งเฉพาะโค้ดที่เลือก) · ไม่เลือก = ไม่มีสำรอง
  if (wantBackup && !_backupPicks.length) {
    toast(lang ==='th'?'เลือกชุดสำรองอย่างน้อย 1 ตัว หรือเอาเครื่องหมายออกค่ะ':'Pick at least one spare, or uncheck the box');
    const bp = $('#backupPicker'); if (bp) bp.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  const backupCodes = wantBackup ? _backupPicks.slice() : [];
  let ok = true, backups = [], rentalId = null;
  try {
    const res = await window.API.bookWithBackups(CUSTOMER, g.code || g.id, date, toDate, backupCodes);
    ok =!res.error && res.data &&!res.data.error;
    backups = (res.data && res.data.backups) || [];
    rentalId = res.data && res.data.rental;
    if (!ok) toast(lang ==='th'?'ชุดนี้เพิ่งถูกจองวันนั้นพอดี ลองวันอื่นนะคะ':'Just got booked for that date — try another');
  } catch (e) { console.warn(e); }
  if (!ok) { checkAvail(id); return; }
  // จ่ายด้วยเครดิตในกระเป๋า — หักจริงฝั่ง backend (Dr2050/Cr4010) + ยืนยันจองทันที ไม่ต้องแนบสลิป
  if (useCredit && rentalId) {
    const pr = await window.API.payWithCredit(rentalId);
    if (pr.ok) {
      const d = pr.data || {};
      if (d.balance != null) CUSTOMER.credit_balance = d.balance;
      if ($('#credit')) $('#credit').textContent = '฿' + Math.round(CUSTOMER.credit_balance || 0);
      fbTrack('Purchase', { content_ids:[g.code || g.id], content_name: g.name, value: d.paid || g.price, currency:'THB' });
      closeDetail();
      const depNote = (d.deposit_due > 0) ? (lang ==='th'?` · มัดจำ ฿${Math.round(d.deposit_due)} เก็บตอนรับชุด`:` · deposit ฿${Math.round(d.deposit_due)} at pickup`) : '';
      toast((lang ==='th'?`จ่ายด้วยเครดิตสำเร็จ · ${g.name}`:`Paid with credit · ${g.name}`) + depNote);
      return;
    }
    // เครดิตไม่พอ/ผิดพลาด → จองยังค้างเป็น hold ให้ไปจ่าย QR แทน
    toast(pr.error === 'insufficient'
      ? (lang ==='th'?'เครดิตไม่พอ จ่ายผ่าน QR แทนได้เลยค่ะ':'Not enough credit — pay via QR instead')
      : (lang ==='th'?'จ่ายด้วยเครดิตไม่สำเร็จ ลองจ่าย QR นะคะ':'Credit payment failed — try QR'));
  }
  fbTrack('InitiateCheckout', { content_ids:[g.code || g.id], content_name: g.name, value: g.price, currency:'THB' });
  // ดึงยอด + ช่องทางจ่าย เพื่อโชว์แผงยืนยัน (คง QR + คำสั่งแนบสลิปไว้ ไม่ปล่อยให้ค้างกลางทาง)
  let total = null, pay = null;
  try { const tq = await window.API.quote(g.code || g.id, CUSTOMER, date, toDate); if (tq && !tq.error) { const applied = Math.max(0, Math.min(Math.round(CUSTOMER.credit_balance || 0), Math.round((tq.rate || 0) + (tq.shipping || 0)))); total = Math.max(0, Math.round(tq.total - applied)); } } catch (e) { /**/ }
  try { pay = await window.API.payInfo(); } catch (e) { /**/ }
  closeDetail();
  showPayConfirm({ g, date, total, pay, backups });
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
  // ต้องมีที่อยู่จัดส่งก่อนจอง
  if (!requireAddress()) return;
  // ด่าน KYC — เต็มเฉพาะชุดพรีเมียม/ดีไซเนอร์
  if (!(await kycGate(g.tier))) return;
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
function closeKyc() { $('#kycOverlay').classList.remove('open'); document.body.style.overflow = ''; }
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
// ต้องมีที่อยู่จัดส่งก่อนจอง — ถ้ายังไม่มี เปิดฟอร์มสั้นให้กรอก แล้วค่อยกดจองอีกครั้ง
function requireAddress() {
  if (!CUSTOMER || !CUSTOMER.id) return true;        // ยังไม่ล็อกอิน — flow เดิมจัดการ
  if (CUSTOMER.address && CUSTOMER.address.trim()) return true;
  toast(lang === 'th' ? 'ใส่ที่อยู่จัดส่งก่อนนะคะ แล้วกดจองอีกครั้ง' : 'Add your delivery address first, then book again');
  openProfile(true);
  return false;
}

// ชุดพรีเมียม/ดีไซเนอร์ = มูลค่าสูง ต้องยืนยันตัวตนเต็มก่อนเช่า
function isPremiumTier(tier) { return /premium|designer|luxe|couture|ดีไซเนอร์|พรีเมียม/i.test(String(tier || '')); }
// ด่าน KYC — บังคับยืนยันเต็มเฉพาะชุดพรีเมียม/ดีไซเนอร์; ชุดทั่วไปเช่าได้เลย (วางมัดจำสูงขึ้นแทน ตาม deposit_for ฝั่ง backend)
async function kycGate(tier) {
  if (!isPremiumTier(tier)) return true;
  const ok = await customerCanRent();
  if (!ok) {
    toast(lang === 'th'
      ? 'ชุดพรีเมียม/ดีไซเนอร์ ต้องยืนยันตัวตนด้วยบัตรประชาชนก่อนเช่าค่ะ'
      : 'Premium / designer pieces need ID verification before renting');
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
async function addToCart(id) {
  const g = GARMENTS.find(x => x.id === id); if (!g) return;
  const TH = lang === 'th';
  if (gCart.find(x => x.id === id)) { toast(TH ? 'ชุดนี้อยู่ในตะกร้าแล้ว' : 'Already in cart'); return; }
  // ต้องเลือกวันที่ก่อน — เช่ากล่องเดียว ทุกชุดใช้ "วันเดียวกัน + ระยะเวลาเดียวกัน"
  const cartDate = gCart.length ? gCart[0].date : null;
  const cartDur = gCart.length ? (gCart[0].dur || gDur) : gDur;
  const picked = ($('#useDate') && $('#useDate').value) || '';
  const date = cartDate || picked;
  const dur = cartDate ? cartDur : gDur;   // ถ้ามีของในตะกร้าแล้ว ล็อกระยะเวลาตามตะกร้า
  if (!date) {
    toast(TH ? 'เลือกวันที่ต้องใช้ก่อนเพิ่มลงตะกร้านะคะ' : 'Pick your date first');
    const d = $('#useDate'); if (d) { d.classList.add('need'); d.focus(); try { d.showPicker && d.showPicker(); } catch (e) {} }
    return;
  }
  // เช็กว่าว่างตลอดช่วง [date .. date+dur-1] ก่อนค่อยใส่ตะกร้า (ไม่ใช่แค่วันเดียว)
  const to = addDays(date, dur - 1);
  const btn = $('#sheet .cartbtn'); const orig = btn && btn.textContent;
  if (btn) { btn.disabled = true; btn.textContent = TH ? 'กำลังเช็ก…' : 'Checking…'; }
  let free = true;
  try { free = await window.API.availableRange(id, date, to); } catch (e) { console.warn(e); }
  if (btn) { btn.disabled = false; btn.textContent = orig; }
  if (!free) {
    toast(cartDate
      ? (TH ? `ชุดนี้ไม่ว่างช่วง ${fmtDate(date)} (วันเดียวกับตะกร้า) — เลือกชุดอื่นนะคะ` : `Not available for ${fmtDate(date)}`)
      : (TH ? `ชุดนี้ไม่ว่างช่วง ${fmtDate(date)} ลองวันอื่นนะคะ` : `Not available for ${fmtDate(date)} — try another date`));
    return;
  }
  const photo = g.photo || (Array.isArray(g.photos) && g.photos[0]) || '';
  gCart.push({ id, code: g.code || g.id, name: g.name, price: g.price, brand: g.brand || '', photo, bg: g.bg || '#E7E2DA', date, dur });
  saveCart();
  renderCartBtn();
  toast(TH ? `เพิ่ม "${g.name}" · ว่าง ${fmtDate(date)} ลงตะกร้าแล้ว` : `Added "${g.name}" · ${fmtDate(date)}`);
}
function removeFromCart(id) { gCart = gCart.filter(x => x.id !== id); saveCart(); renderCartBtn(); if (gCart.length) openCart(); else closeCart(); }
function renderCartBtn() {
  const b = $('#cartFab');
  if (b) { b.style.display = gCart.length ? 'flex' : 'none'; const c = $('#cartCount'); if (c) c.textContent = gCart.length; }
  // ไอคอนตะกร้าถาวรบนหัวจอ — เห็นได้เสมอเพื่อให้รู้ว่ามีตะกร้า (badge ซ่อนเมื่อว่าง)
  const hb = $('#cartHdrBadge'); if (hb) { hb.textContent = gCart.length; hb.hidden = !gCart.length; }
}
function openCart() {
  const TH = lang === 'th';
  if (!gCart.length) { toast(TH ? 'ยังไม่มีชุดในตะกร้า' : 'Cart is empty'); return; }
  const date = ((gCart[0] && gCart[0].date) || ($('#useDate') && $('#useDate').value) || gUseDate || '');
  gDur = (gCart[0] && gCart[0].dur) || gDur;   // ระยะเวลาของตะกร้า (กล่องเดียว = ระยะเวลาเดียว) ไม่หลุดจากหน้า detail
  const items = gCart.map(it => {
    const thumb = it.photo ? `background-image:url('${it.photo}')` : `background:${it.bg || '#E7E2DA'}`;
    return `<div class="crow" data-id="${it.id}">
      <button class="cthumb" style="${thumb}" onclick="cartOpenDetail('${it.id}')" aria-label="${TH ? 'ดูรายละเอียด' : 'View details'}"></button>
      <span class="cinfo" onclick="cartOpenDetail('${it.id}')">
        ${it.brand ? `<small>${it.brand}</small>` : ''}<span class="cnm">${it.name}</span>
        <em class="cstat"></em><em class="clink">${TH ? 'ดูรายละเอียด ›' : 'View details ›'}</em>
      </span>
      <b>฿${it.price}</b>
      <button class="cx" onclick="removeFromCart('${it.id}')" aria-label="${TH ? 'นำออก' : 'Remove'}">×</button>
    </div>`;
  }).join('');
  $('#cartSheet').innerHTML = `
    <div class="csheet">
      <button class="close" onclick="closeCart()">×</button>
      <div class="khd">${TH ? 'ตะกร้าของฉัน' : 'My cart'} · ${gCart.length} ${TH ? 'ชุด' : 'items'}</div>
      <div class="cdesc">${TH ? 'เช่าหลายชุด ส่งกล่องเดียว ค่าส่งครั้งเดียว' : 'Multiple dresses, one shipment, one shipping fee'}</div>
      <div class="clist">${items}</div>
      <div class="cdate">
        <label>${TH ? 'วันที่ต้องใช้ (ทุกชุดในตะกร้าใช้วันเดียวกัน)' : 'Date (all items share one date)'}</label>
        <input type="date" id="cartDate" min="${todayStr()}" value="${date}" onchange="revalidateCart()">
        <div class="durchips" id="cartDur">
          <button data-d="1" class="${gDur === 1 ? 'on' : ''}" onclick="setCartDur(1)">${TH ? '1 วัน' : '1d'}</button>
          <button data-d="3" class="${gDur === 3 ? 'on' : ''}" onclick="setCartDur(3)">${TH ? '3 วัน' : '3d'}</button>
          <button data-d="5" class="${gDur === 5 ? 'on' : ''}" onclick="setCartDur(5)">${TH ? '5 วัน' : '5d'}</button>
        </div>
      </div>
      <button class="ksubmit" id="cartBook" onclick="bookCartNow()">${TH ? 'จองทั้งหมด' : 'Book all'}</button>
    </div>`;
  $('#cartOverlay').classList.add('open'); document.body.style.overflow = 'hidden';
  revalidateCart();   // เช็กว่างตามวัน/ระยะเวลาปัจจุบันทันทีที่เปิด
}
function setCartDur(d) {
  gDur = d;
  gCart.forEach(it => { it.dur = d; });   // กล่องเดียว = ระยะเวลาเดียวกันทุกชุด
  saveCart();
  document.querySelectorAll('#cartDur button').forEach(b => b.classList.toggle('on', +b.dataset.d === d));
  revalidateCart();
}
// เช็กว่างทุกชุดตามวัน+ระยะเวลาในตะกร้าปัจจุบัน → โชว์สถานะรายชุด + ปิดปุ่มจองถ้ามีชุดไม่ว่าง
async function revalidateCart() {
  const TH = lang === 'th';
  const di = $('#cartDate'); const date = di && di.value;
  const book = $('#cartBook');
  if (!date) { if (book) book.disabled = false; return; }
  const to = addDays(date, gDur - 1);
  gCart.forEach(it => { it.date = date; });   // sync วันที่ที่เลือกล่าสุดเข้าทุกชุด
  saveCart();
  let anyBusy = false;
  await Promise.all(gCart.map(async it => {
    const row = document.querySelector(`#cartSheet .crow[data-id="${it.id}"] .cstat`);
    if (row) { row.className = 'cstat checking'; row.textContent = TH ? 'กำลังเช็ก…' : 'checking…'; }
    let free = true;
    try { free = await window.API.availableRange(it.id, date, to); } catch (e) { free = true; }
    if (row) {
      row.className = free ? 'cstat cfree' : 'cstat cbusy';
      row.textContent = free ? (TH ? `ว่าง ${fmtDate(date)}` : `free ${fmtDate(date)}`) : (TH ? `ไม่ว่าง ${fmtDate(date)}` : `unavailable ${fmtDate(date)}`);
    }
    if (!free) anyBusy = true;
  }));
  if (book) {
    book.disabled = anyBusy;
    book.textContent = anyBusy ? (TH ? 'มีชุดไม่ว่าง — นำออกก่อนนะคะ' : 'Remove unavailable items') : (TH ? 'จองทั้งหมด' : 'Book all');
  }
}
function closeCart() { $('#cartOverlay').classList.remove('open'); document.body.style.overflow = ''; }
// กดชุดในตะกร้า → กลับไปดูรายละเอียดชุดเต็ม (ปิดตะกร้าก่อน แล้วเปิด detail)
function cartOpenDetail(id) { closeCart(); openDetail(id); }
async function bookCartNow() {
  const TH = lang === 'th';
  const date = $('#cartDate') && $('#cartDate').value;
  if (!date) { toast(TH ? 'เลือกวันที่ก่อนนะคะ' : 'Pick a date'); return; }
  // ต้องมีที่อยู่จัดส่งก่อนจอง
  if (!requireAddress()) { closeCart(); return; }
  // ด่าน KYC — เต็มเฉพาะถ้ามีชุดพรีเมียม/ดีไซเนอร์ในตะกร้า
  const cartPremium = gCart.some(it => isPremiumTier(it.tier || (GARMENTS.find(g => g.code === it.code) || {}).tier));
  if (!(await kycGate(cartPremium ? 'Premium' : ''))) return;
  const btn = $('#cartSheet .ksubmit'); if (btn) { btn.disabled = true; btn.textContent = TH ? 'กำลังจอง…' : 'Booking…'; }
  const codes = gCart.map(x => x.code);
  const res = await window.API.bookCart(CUSTOMER, codes, date, durEnd(date));
  const data = res && res.data;
  if (res && !res.error && data && !data.error) {
    const unavail = (data.unavailable || []);
    gCart = []; saveCart();
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
    wallet: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/></svg>',
    member: '<svg viewBox="0 0 24 24"><path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 21l-4.9 2.6.9-5.5-4-3.9 5.5-.8z"/></svg>',
    review: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/></svg>',
    foryou: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    stylist: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-5-7-11a7 7 0 0 1 14 0c0 6-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    wish: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.6-9-9a4.5 4.5 0 0 1 9-2 4.5 4.5 0 0 1 9 2c-2 4.4-9 9-9 9z"/></svg>',
    findwish: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5M11 8.5v5M8.5 11h5"/></svg>',
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
      <span class="medit" onclick="closeMenu();openProfile()">${en ? 'Edit profile & size' : 'แก้ไขโปรไฟล์ & ไซส์'}</span>
    </div>

    <div class="msec">
      <div class="ml">${en ? 'My rentals' : 'การเช่าของฉัน'}</div>
      ${item(I.orders, en ? 'My orders' : 'ออเดอร์ของฉัน', 'openOrders()')}
      ${item(I.wallet, en ? 'LLOOP wallet' : 'กระเป๋า LLOOP', 'openWallet()', signedIn && c.credit_balance ? '฿' + Math.round(c.credit_balance) : '')}
      ${item(I.cart, en ? 'Cart' : 'ตะกร้า', 'openCart()', cartN ? String(cartN) : '')}
      ${item(I.member, en ? 'Membership & perks' : 'สมาชิก & สิทธิ์', 'openMembership()')}
    </div>

    <div class="msec">
      <div class="ml">${en ? 'Discover' : 'ค้นพบ'}</div>
      ${item(I.foryou, en ? 'For you' : 'แนะนำเฉพาะคุณ', 'if(!fForYou)toggleForYou()')}
      ${signedIn ? item(I.foryou, en ? 'What you love' : 'สิ่งที่คุณชอบ', 'openTaste()') : ''}
      ${item(I.stylist, en ? 'What to wear? — card game' : 'งานนี้ใส่อะไรดี — เพื่อนสาวช่วยเลือก', "location.href='quiz.html'")}
      ${item(I.stylist, en ? 'LLOOP Atelier by venue' : 'LLOOP Atelier ประจำสถานที่', "var el=document.getElementById('venueInput');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.focus();}")}
      ${item(I.wish, en ? 'Saved looks' : 'ชุดที่หมายตา', 'if(!fWishOnly)toggleWishOnly()')}
      ${item(I.findwish, en ? 'Wish for a piece — tell us' : 'อยากได้ชุดไหน บอกเราได้', "location.href='wishlist.html'")}
      ${item(I.foryou, en ? 'Community · The Loop Looks' : 'ชุมชน · ลุคจากคนใน loop', "location.href='looks.html'")}
      ${item(I.family, en ? 'Family & groups' : 'ครอบครัว & กลุ่ม', 'openFamily()')}
      ${item(I.gift, en ? 'Shoot & earn credit' : 'ถ่ายชุด · ได้เครดิต', "location.href='creator.html'")}
    </div>

    <div class="msec">
      <div class="ml">${en ? 'My account' : 'บัญชีของฉัน'}</div>
      ${item(I.verify, en ? 'Verify identity (KYC)' : 'ยืนยันตัวตน (KYC)', "openKyc('')")}
      ${item(I.gift, en ? 'Invite friends · get credit' : 'ชวนเพื่อน · รับเครดิต', 'openWallet(true)')}
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
    ?`<div class="onbhead">${avatar}<div><div class="onbhi">${lang==='th'?'ยินดีต้อนรับ':'Welcome'}${dispName?' '+dispName:''}</div><div class="onbsub">${lang==='th'?'ใส่ชื่อ เบอร์ และที่อยู่จัดส่ง — แค่นี้ก็เริ่มเช่าได้เลย (ไซส์/สไตล์ค่อยเพิ่มทีหลังได้)':'Name, phone, and address — that’s all you need to start (sizes & style later)'}</div></div></div>`
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
      <button type="button" class="walletlink" onclick="closeProfile();openWallet()" style="width:100%;text-align:left;border:1px solid var(--line,#E7E5E1);background:#FBF8F2;border-radius:12px;padding:11px 14px;margin-bottom:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
        <span>${lang==='th'?'กระเป๋า LLOOP · เครดิต ชวนเพื่อน ระดับสมาชิก':'LLOOP wallet · credit, invites, tier'}</span><span style="color:var(--muted,#8C8B86)">${c.credit_balance ? '฿'+Math.round(c.credit_balance)+' ›' : '›'}</span>
      </button>
      ${onboard ? '' : `${renderStyleCard(c)}
      ${renderImpactCard()}`}
      <div class="field"><label>${t('pName')}</label><input id="pName" autocomplete="name" value="${c.name || c.display_name ||''}"></div>
      ${onboard ? '' : `${renderMeasuredRef(c)}<div class="frow">
        <div class="field"><label>${t('pHeight')}</label><input id="pHeight" type="number" value="${c.height_cm ||''}"></div>
        <div class="field"><label>${t('pShoe')}</label><input id="pShoe" value="${c.shoe_size ||''}"></div>
      </div>
      <div class="frow">
        <div class="field"><label>${lang==='th'?'น้ำหนัก (กก.)':'Weight (kg)'}</label><input id="pWeight" type="number" value="${c.weight_kg ||''}"></div>
        <div class="field"><label>${lang==='th'?'ไซส์ที่ใส่ประจำ':'Usual size'}</label><select id="pSize">${sizeOpts}</select></div>
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
      <div class="field"><label>${t('pColor')} <span class="optnote">${lang==='th'?'(ถ้ารู้โทนสีตัวเอง — ไม่รู้ข้ามได้)':'(if you know your season — optional)'}</span></label><div class="seasons">${seasons}</div></div>`}
      <div class="frow">
        <div class="field"><label>${lang === 'th' ? 'เบอร์โทร (ไว้พิมพ์ใบส่ง)' : 'Phone (for shipping)'}</label><input id="pPhone" inputmode="tel" autocomplete="tel" value="${c.phone || ''}"></div>
        ${onboard ? '' : `<div class="field"><label>${lang === 'th' ? 'วันเกิด (รับของขวัญเช่าฟรี)' : 'Birthday (free birthday rental)'}</label><input id="pBirthday" type="date" value="${c.birthday || ''}"></div>`}
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
      ${onboard ? '' : `<div class="field"><label>${t('pNotes')}</label><input id="pNotes" value="${c.notes ||''}"></div>`}
      <button class="savebtn" onclick="saveProfile()">${onboard ? (lang==='th'?'บันทึก & ไปต่อ':'Save & continue') : t('pSave')}</button>
    </div>`;
  $('#pOverlay').classList.add('open');
  document.body.style.overflow ='hidden';
  setTimeout(() => animateCounts($('#pSheet')), 80);  // ตัวเลขนับขึ้นในการ์ดอิมแพกต์
  loadPcBookZone();    // จ่ายแล้ว → ให้เลือกสไตลิสต์/จองเวลา หรือโชว์นัด (async inject)
}
// การ์ดชวนเพื่อน — รับเครดิตทั้งคู่
function renderReferralCard() {
  return`<div class="refcard">
    <div class="refkick">${lang ==='th'?'ชวนเพื่อน รับเครดิตทั้งคู่':'invite a friend — credit for you both'}</div>
    <div class="refcode-wrap">
      <div class="reflbl">${lang ==='th'?'โค้ดชวนเพื่อนของคุณ':'your invite code'}</div>
      <div class="refcode" id="refCode">${CUSTOMER.id?'…':(lang ==='th'?'เข้าผ่าน LINE เพื่อรับโค้ด':'sign in via LINE')}</div>
      ${CUSTOMER.id?`<button class="refshare" onclick="shareQuizInvite()">${lang ==='th'?'ส่งการ์ดเกม “งานนี้ใส่อะไรดี” ให้เพื่อน':'Send the “what to wear” card game'}</button>`:''}
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
// แชร์การ์ดเกมพร้อมโค้ดของเรา → เพื่อนเล่นแล้วเช่า เครดิต ฿200 เข้ากระเป๋า LLOOP ทั้งคู่
async function shareQuizInvite() {
  let code = CUSTOMER.referral_code;
  if (!code) { try { code = await window.API.ensureReferralCode(CUSTOMER); CUSTOMER.referral_code = code; } catch (e) { /**/ } }
  const base = location.origin + location.pathname.replace(/[^/]*$/, '') + 'quiz.html';
  const url = base + (code ? '?ref=' + encodeURIComponent(code) : '');
  const text = lang === 'th'
    ? 'งานนี้ใส่อะไรดี? ลองเล่นการ์ดสไตลิสต์ของ LLOOP — เช่าผ่านลิงก์นี้ได้เครดิตทั้งคู่'
    : 'What to wear? Try LLOOP’s stylist card game — rent via this link and we both get credit';
  try {
    if (navigator.share) { await navigator.share({ title: lang==='th'?'งานนี้ใส่อะไรดี':'What to wear', text, url }); return; }
  } catch (e) { return; }
  try { await navigator.clipboard.writeText(text + ' ' + url); toast(lang==='th'?'คัดลอกลิงก์ชวนเพื่อนแล้ว':'Invite link copied'); }
  catch (e) { toast(url); }
}
async function loadReferralCode() {
  const el = $('#refCode'); if (!el) return;
  if (!CUSTOMER.id) { el.textContent = lang ==='th'?'เข้าผ่าน LINE เพื่อรับโค้ด':'sign in via LINE'; return; }
  let code = null;
  try { code = await window.API.ensureReferralCode(CUSTOMER); } catch (e) { /**/ }
  if (code) { CUSTOMER.referral_code = code; el.textContent = code; }
  else el.textContent = lang ==='th'?'—':'—';
}
// ใช้โค้ดที่ติดมากับลิงก์ (?ref=) อัตโนมัติเมื่อ login แล้ว — เงียบ ๆ ถ้าใช้ไปแล้ว/เป็นโค้ดตัวเอง
async function applyPendingReferral() {
  let code = null;
  try { code = localStorage.getItem('lloop_ref'); } catch (_e) {}
  if (!code || !CUSTOMER.id) return;
  let res = 'not_found';
  try { res = await window.API.applyReferral(CUSTOMER, code); } catch (e) { return; }
  if (res === 'ok') toast(lang === 'th' ? 'รับเครดิตเพื่อนชวนแล้ว ฿200 เข้ากระเป๋า LLOOP' : 'Friend credit added — ฿200 in your LLOOP wallet');
  if (res !== 'not_found') { try { localStorage.removeItem('lloop_ref'); } catch (_e) {} }
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
// The Loop — กระเป๋า LLOOP (เงินใช้จ่ายเดียว) + ความคืบหน้าชั้น (ภาษาไทย ลดศัพท์)
function renderTheLoop(c) {
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
    <div class="clubrow"><span class="clubkick">THE LOOP</span><span class="clubtier">${tierTH}</span></div>
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
    ${(c._streak >= 2) ? `<div class="streakrow"><span class="streakdot">●</span>${th?`กลับมาต่อเนื่อง ${c._streak} สัปดาห์`:`${c._streak}-week loop streak`}</div>` : ''}
  </div>`;
}
// ชุดจริงจากคลังที่แมตช์โปรไฟล์มากสุด (เรียงด้วย personalScore — สูตร ไม่ใช่ AI)
function topMatches(n) {
  if (!Array.isArray(GARMENTS) || !GARMENTS.length) return [];
  return [...GARMENTS].sort((a, b) => personalScore(b) - personalScore(a)).slice(0, n);
}
function gThumb(g) {
  const img = g.photo ? `<img src="${g.photo}" loading="lazy" alt="">`
    : `<span style="display:block;width:100%;height:100%;background:${g.bg || '#E7D9C3'}"></span>`;
  const pr = g.price != null ? `฿${Number(g.price).toLocaleString()}` : '';
  return `<div class="gthumb" onclick="openDetail('${esc(g.id)}')"><div class="gth-img">${img}</div>`
    + `<div class="gth-nm">${esc(g.name || '')}</div><div class="gth-pr">${pr}</div></div>`;
}
// จองคิว Personal Color — จ่ายในแอป (สร้าง topup 4,900 → เปิดหน้าจ่าย PromptPay + แนบสลิป)
//   ยืนยันแล้ว confirm_payment ออกเครดิตเต็มจำนวน อายุ 90 วัน เข้ากระเป๋า LLOOP อัตโนมัติ
async function bookPersonalColor() {
  const th = lang === 'th';
  toast(th ? 'กำลังเปิดรายการ…' : 'Opening…');
  const r = await window.API.startPersonalColor();
  if (!r || !r.ok) { toast((r && r.error) || (th ? 'เริ่มรายการไม่สำเร็จ' : 'Could not start')); return; }
  let pay = null; try { pay = await window.API.payInfo(); } catch (e) {}
  openPcPaySheet(r.amount || 4900, r.payment_id, pay);
}
function openPcPaySheet(amount, paymentId, pay) {
  const th = lang === 'th';
  const amt = Number(amount).toLocaleString();
  const ref = String(paymentId || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  const ppId = pay && pay.pay_promptpay_id;
  const acct = pay && pay.pay_account_no;
  const bank = pay && (pay.pay_bank || pay.pay_account_name || '');
  const oa = (window.CONFIG && window.CONFIG.LINE_OA_URL) || 'https://line.me/R/ti/p/@lloop';
  const channel = ppId ? `<div class="pcqr" id="pcqr"></div><div class="pcline">PromptPay <b>${esc(ppId)}</b></div>`
    : acct ? `<div class="pcline">${th?'โอนเข้าบัญชี':'Transfer to'} <b>${esc(acct)}</b>${bank?` · ${esc(bank)}`:''}</div>`
    : `<div class="pcline">${th?'ทักแชต LLOOP เพื่อรับเลขพร้อมเพย์/บัญชี':'Message LLOOP for transfer details'}</div>`;
  const wrap = document.createElement('div'); wrap.id = 'pcpay'; wrap.className = 'pcpay';
  wrap.innerHTML = `<div class="pcsheet">
    <button class="pcx" onclick="closePcPay()" aria-label="close">×</button>
    <div class="pchead">${th?'จองคิว Personal Color':'Book Personal Color'}</div>
    <div class="pcamt">฿${amt}</div>
    <div class="pcback">${th?`จ่ายแล้วได้เครดิต ฿${amt} เต็มจำนวนไว้เลือกชุด · อายุ 90 วัน`:`You get ฿${amt} rental credit · valid 90 days`}</div>
    ${channel}
    <div class="pcstep">${th?'1) โอนตามยอด  2) แนบสลิปในแชต LLOOP  3) เครดิตเข้าให้หลังยืนยัน  4) ทีมทักนัดวันทำ Personal Color':'1) Transfer  2) Send slip in LLOOP chat  3) Credit added after we confirm  4) Team messages you to schedule the session'}</div>
    <div class="pcref">${th?'อ้างอิง':'Ref'} #${ref}</div>
    <a class="pcoa" href="${oa}" target="_blank" rel="noopener">${th?'เปิดแชต LLOOP เพื่อแนบสลิป':'Open LLOOP chat to send slip'}</a>
  </div>`;
  document.body.appendChild(wrap);
  if (ppId && window.promptpayBrandedQR) {
    try { window.promptpayBrandedQR(document.getElementById('pcqr'), ppId, amount, pay.pay_promptpay_type); } catch (e) {}
  }
}
function closePcPay() { const el = document.getElementById('pcpay'); if (el) el.remove(); }
// ค่าวัดตัวที่สไตลิสต์วัดมาให้ — โชว์เป็น "อ้างอิง" ถาวร (ลูกค้าแก้ค่าจริงด้านล่างได้ แต่ ref นี้ค้างไว้ + วันที่วัด)
function renderMeasuredRef(c) {
  const mr = (c.style_profile || {}).measured_ref;
  if (!mr) return '';
  const th = lang === 'th';
  const rows = [
    [th ? 'รอบอก' : 'Bust', mr.bust_in, '"'],
    [th ? 'รอบเอว' : 'Waist', mr.waist_in, '"'],
    [th ? 'สะโพก' : 'Hip', mr.hip_in, '"'],
    [th ? 'ส่วนสูง' : 'Height', mr.height_cm, ' cm'],
    [th ? 'ไซส์เดรส' : 'Dress size', mr.dress_size, ''],
    [th ? 'เบอร์รองเท้า' : 'Shoe', mr.shoe_size, ''],
  ].filter(r => r[1] != null && r[1] !== '');
  if (!rows.length) return '';
  const cells = rows.map(([l, v, u]) =>
    `<div class="mrcell"><span class="mrlbl">${l}</span><b>${v}${u}</b></div>`).join('');
  const when = mr.at ? `${th ? 'วัดล่าสุด' : 'Measured'} ${mr.at}${mr.by ? ' · ' + mr.by : ''}` : '';
  return `<div class="measref">
    <div class="mrhead">
      <span>${th ? 'ค่าที่สไตลิสต์วัดให้ (อ้างอิง)' : 'Measured by your stylist (reference)'}</span>
      ${when ? `<span class="mrwhen">${when}</span>` : ''}
    </div>
    <div class="mrgrid">${cells}</div>
    <div class="mrnote">${th ? 'แก้ค่าของคุณเองได้ด้านล่าง — ค่าที่สไตลิสต์วัดจะเก็บไว้ให้อ้างอิงเสมอ' : 'Edit your own values below — the stylist’s measurements stay here for reference'}</div>
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
    // แถบชุดจริงจากคลังที่แมตช์ (กดเช่าได้) — รูปหลัก
    const picks = topMatches(6);
    const matchHtml = picks.length ? `<div class="styleshop">
        <div class="ssh">${th?'ชุดที่ใช่กับคุณ — เช่าได้เลย':'Made for you — rent now'}</div>
        <div class="gstrip">${picks.map(gThumb).join('')}</div>
        <div class="stylerec" style="margin-top:7px"><a onclick="toggleForYou()" style="color:#A75F3A;font-weight:600;cursor:pointer">${th?'ดูชุดที่แมตช์ทั้งหมด →':'See all matches →'}</a></div>
      </div>` : '';
    // แถบ "ลุคของคุณ" จากรูปที่พาร์ทเนอร์อัป (ถ้ามี) — รูปเสริม
    const looks = Array.isArray(sp.looks) ? sp.looks.filter(Boolean) : [];
    const looksHtml = looks.length ? `<div class="styleshop">
        <div class="ssh">${th?'ลุคของคุณ':'Your looks'} <span style="font-weight:400;color:#9a917d;font-size:11px">${th?'จากสตูดิโอ':'from the studio'}</span></div>
        <div class="lookstrip">${looks.map(u=>`<img src="${u}" loading="lazy" onclick="this.classList.toggle('zoom')" alt="">`).join('')}</div>
      </div>` : '';
    inner =`<div class="stylehead">${sp.headline || (lang ==='th'?'สรุปสไตล์ของคุณ':'Your style')}</div>
      ${stype}
      ${pal?`<div class="stylepal">${pal}</div>`:''}
      ${rec?`<div class="stylerec">${lang ==='th'?'ชุดที่แนะนำ':'For you'}: ${rec}</div>`:''}
      ${matchHtml}
      ${looksHtml}
      ${guideHtml?`<div class="styleguide" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.08)">${guideHtml}</div>`:''}`;
  } else {
    const th = lang === 'th';
    const perks = th
      ? ['โทนสีที่ใช่ของคุณ', 'พาเลตเสื้อผ้า 5 สี', 'ทรง/คอเสื้อ/ความยาวที่เหมาะ', 'ชุดเช่าที่แมตช์คุณโดยเฉพาะ']
      : ['Your season tone', '5-colour wardrobe palette', 'Best silhouettes & necklines', 'Rental picks made for you'];
    const lockGrid = perks.map(p=>`<span class="lockpill">${p}</span>`).join('');
    const detail = th ? [
      ['วันนัด','สไตลิสต์อ่านสีผิว โครงหน้า รูปร่าง'],
      ['สิ่งที่ได้','โทนสี + พาเลต 5 สี + ทรงที่ใช่ เก็บในแอป'],
      ['ชุดที่แมตช์','คัดชุดในคลังที่เข้ากับคุณ เช่าได้เลย'],
      ['เครดิตคืนเต็ม','฿4,900 กลับมาเป็นเครดิต (90 วัน)'],
    ] : [
      ['On the day','Stylist reads your colour, face & body'],
      ['You get','Tone + 5-colour palette + best shapes, saved'],
      ['Matched picks','Closet pieces that fit you, ready to rent'],
      ['Credit back','฿4,900 returns as credit (90 days)'],
    ];
    const detailRows = detail.map(([k,v])=>`<div class="pcd-row"><b>${k}</b><span>${v}</span></div>`).join('');
    inner =`<div class="stylehead">${th?'ปลดล็อกสไตล์ที่ใช่ของคุณ':'Unlock your signature style'}</div>
      <div class="stylerec">${th?'วิเคราะห์ Personal Color + รูปหน้า + หุ่น โดยสไตลิสต์ แล้วรับสรุป + ชุดเช่าที่แมตช์คุณ':'A stylist Personal Color + face + body analysis, then a summary and rental picks made for you'}</div>
      <div class="lockgrid">${lockGrid}</div>
      <details class="pcdetail"><summary>${th?'ดูว่าได้อะไรบ้าง':'See exactly what you get'}</summary><div class="pcd-body">${detailRows}</div></details>
      <div id="pcPayFlow">
        <div class="creditback">${th?'ค่าวิเคราะห์ ฿4,900 กลายเป็นเครดิตเต็มจำนวนไว้เลือกชุด — เหมือนได้วิเคราะห์ฟรี':'Your ฿4,900 becomes ฿4,900 rental credit — the analysis pays for itself'}</div>
        <button class="bookbtn" onclick="bookPersonalColor()">${th?'จองคิว Personal Color · ฿4,900':'Book Personal Color · ฿4,900'}<span class="bsub">${th?'ได้เครดิต ฿4,900 คืนเต็มไว้เช่าชุด':'฿4,900 back as rental credit'}</span></button>
      </div>
      <div id="pcBookZone"></div>
      <div class="claimbox" style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(0,0,0,.08)">
        <div class="stylerec" style="margin-bottom:6px">${th?'ทำกับสตูดิโอมาแล้ว? กรอกรหัสที่ได้รับ เพื่อดึงผลเข้าบัญชีนี้':'Already did it at a studio? Enter your code to pull the results in'}</div>
        <div style="display:flex;gap:8px">
          <input id="claimCodeInput" placeholder="${th?'รหัสจากสตูดิโอ':'Studio code'}" autocomplete="off" style="flex:1;text-transform:uppercase;padding:9px 11px;border:1.5px solid rgba(0,0,0,.15);border-radius:8px;font-size:15px;letter-spacing:1px">
          <button onclick="claimCode()" style="border:none;border-radius:8px;padding:9px 16px;font-weight:600;background:#1A1A1A;color:#fff;cursor:pointer">${th?'ดึงผล':'Claim'}</button>
        </div>
      </div>`;
  }
  return`<div class="stylecard">
    <div class="tierbadge"> ${tierLabel}</div>
    ${inner}
    ${c.link_code?`<div class="linkcode">${lang ==='th'?'รหัสนัดสไตลิสต์':'Stylist code'} <b>${c.link_code}</b></div>`:''}
  </div>`;
}
// ลูกค้ากรอกรหัสผลวิเคราะห์ (จากสตูดิโอ/พาร์ทเนอร์) → ผูก/รวมผลเข้าบัญชี LINE ตัวเอง แล้วรีเฟรช
async function claimCode() {
  const el = document.getElementById('claimCodeInput');
  const code = el ? el.value : '';
  if (!code.trim()) { toast(lang === 'th' ? 'ใส่รหัสก่อนค่ะ' : 'Enter a code'); return; }
  toast(lang === 'th' ? 'กำลังดึงผล…' : 'Claiming…');
  const r = await window.API.claimStyleCode(code);
  if (!r || !r.ok) { toast((r && r.error) || (lang === 'th' ? 'ไม่สำเร็จ' : 'Failed')); return; }
  toast(lang === 'th' ? 'ดึงผลสำเร็จ — กำลังรีเฟรช' : 'Done — refreshing');
  setTimeout(() => location.reload(), 900);
}

// ===== จองเวลากับสไตลิสต์ (หลังจ่าย ฿4,900) =====
// เติมโซนในการ์ดโปรไฟล์: จ่ายแล้ว+ยังไม่จอง → ปุ่มเลือกสไตลิสต์ · มีนัด → การ์ดนัด
let _stPicked = null, _stSlot = null;
async function loadPcBookZone() {
  const zone = document.getElementById('pcBookZone');
  if (!zone) return;
  let st; try { st = await window.API.pcStatus(); } catch (e) { return; }
  if (!st || (!st.paid && !st.appointment)) return;  // ยังไม่จ่าย → คงปุ่มจ่ายเดิมไว้
  const flow = document.getElementById('pcPayFlow'); if (flow) flow.style.display = 'none';
  const th = lang === 'th';
  if (st.appointment) {
    const a = st.appointment;
    const when = new Date(a.starts_at).toLocaleString(th ? 'th-TH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    zone.innerHTML = `<div class="apptcard">
      <div class="ah">${th ? 'นัด Personal Color ของคุณ' : 'Your Personal Color session'}</div>
      <div class="aw">${esc(a.partner || 'สไตลิสต์')}${a.studio ? ` · ${esc(a.studio)}` : ''}</div>
      <div class="ap">${when}${a.area ? ` · ${esc(a.area)}` : ''}</div>
      <button class="acancel" onclick="cancelMyAppointment('${a.id}')">${th ? 'ยกเลิก/เปลี่ยนเวลา' : 'Cancel / reschedule'}</button>
    </div>`;
  } else {
    zone.innerHTML = `<button class="pcbookcta" onclick="openStylistPicker()">${th ? 'เลือกสไตลิสต์ & จองเวลา' : 'Choose a stylist & book'}<span class="bsub">${th ? 'จ่ายแล้ว — เลือกวันเวลาที่สะดวกได้เลย' : "You've paid — pick a time that suits you"}</span></button>`;
  }
}
async function openStylistPicker() {
  const th = lang === 'th';
  _stPicked = null; _stSlot = null;
  const wrap = document.createElement('div'); wrap.id = 'stpick'; wrap.className = 'pcpay';
  wrap.innerHTML = `<div class="pcsheet lft"><button class="pcx" onclick="closeStylistPicker()" aria-label="close">×</button>
    <div class="pchead">${th ? 'เลือกสไตลิสต์' : 'Choose a stylist'}</div>
    <div id="stbody"><div class="oloading">${th ? 'กำลังโหลด…' : 'Loading…'}</div></div></div>`;
  document.body.appendChild(wrap);
  let list; try { list = await window.API.stylistDirectory(); } catch (e) { list = []; }
  const body = document.getElementById('stbody'); if (!body) return;
  if (!list.length) {
    body.innerHTML = `<div class="oloading">${th ? 'ยังไม่มีสไตลิสต์เปิดรับช่วงนี้ — ทักแชต LLOOP เพื่อนัดได้ค่ะ' : 'No stylist open right now — message LLOOP to book.'}</div>`;
    return;
  }
  body.innerHTML = `<div class="stlist">${list.map(stylistCardHtml).join('')}</div>`;
}
function stylistCardHtml(s) {
  const th = lang === 'th';
  const av = s.photo_url ? `style="background-image:url('${s.photo_url}')"` : '';
  const chips = (s.specialties || []).slice(0, 3).map(x => `<span>${esc(x)}</span>`).join('');
  const slots = Number(s.open_slots || 0);
  const mt = slots > 0 ? (th ? `${slots} ช่องว่าง` : `${slots} open slots`) : (th ? 'ยังไม่มีเวลาว่าง' : 'No open times');
  return `<div class="stcard" onclick="selectStylist('${s.id}')">
    <div class="av" ${av}></div>
    <div style="flex:1">
      <div class="nm">${esc(s.display_name || 'สไตลิสต์')}${s.studio_name ? ` · ${esc(s.studio_name)}` : ''}</div>
      ${s.headline ? `<div class="hl">${esc(s.headline)}</div>` : ''}
      ${s.area ? `<div class="hl">${esc(s.area)}</div>` : ''}
      ${chips ? `<div class="stchips">${chips}</div>` : ''}
      <div class="mt">${mt}</div>
    </div></div>`;
}
async function selectStylist(id) {
  const th = lang === 'th';
  const body = document.getElementById('stbody'); if (!body) return;
  body.innerHTML = `<div class="oloading">${th ? 'กำลังโหลดเวลาว่าง…' : 'Loading times…'}</div>`;
  let p; try { p = await window.API.stylistPublic(id); } catch (e) { p = null; }
  if (!p) { body.innerHTML = `<div class="oloading">${th ? 'โหลดไม่สำเร็จ' : 'Could not load'}</div>`; return; }
  _stPicked = p; _stSlot = null;
  const slots = Array.isArray(p.slots) ? p.slots : [];
  let slotsHtml;
  if (!slots.length) {
    slotsHtml = `<div class="oloading">${th ? 'สไตลิสต์ยังไม่เปิดเวลาว่าง — ลองเลือกท่านอื่น' : 'No open times yet — try another stylist'}</div>`;
  } else {
    const groups = {};
    slots.forEach(s => { const k = new Date(s.starts_at).toDateString(); (groups[k] = groups[k] || []).push(s); });
    slotsHtml = Object.keys(groups).map(k => {
      const dl = new Date(groups[k][0].starts_at).toLocaleDateString(th ? 'th-TH' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const btns = groups[k].map(s => {
        const tm = new Date(s.starts_at).toLocaleTimeString(th ? 'th-TH' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
        return `<button class="stslot" data-id="${s.id}" onclick="pickSlot(this,'${s.id}')">${tm}</button>`;
      }).join('');
      return `<div class="stdaylabel">${dl}</div><div class="stslots">${btns}</div>`;
    }).join('');
  }
  body.innerHTML = `<button class="stback" onclick="openStylistPicker()">‹ ${th ? 'เลือกสไตลิสต์อื่น' : 'Other stylists'}</button>
    <div class="stcard" style="cursor:default">
      <div class="av" ${p.photo_url ? `style="background-image:url('${p.photo_url}')"` : ''}></div>
      <div style="flex:1"><div class="nm">${esc(p.display_name || 'สไตลิสต์')}${p.studio_name ? ` · ${esc(p.studio_name)}` : ''}</div>${p.headline ? `<div class="hl">${esc(p.headline)}</div>` : ''}</div>
    </div>
    ${p.bio ? `<div class="stbio">${esc(p.bio)}</div>` : ''}
    ${p.session_note ? `<div class="stbio" style="color:#86857F">${esc(p.session_note)}</div>` : ''}
    ${slotsHtml}
    <textarea class="stnote" id="stNote" rows="2" placeholder="${th ? 'อยากบอกอะไรสไตลิสต์ไหม? (ไม่บังคับ)' : 'Anything for the stylist? (optional)'}"></textarea>
    <button class="stconfirm" id="stConfirm" onclick="confirmStylistBooking()" disabled>${th ? 'ยืนยันการจอง' : 'Confirm booking'}</button>`;
}
function pickSlot(btn, id) {
  _stSlot = id;
  document.querySelectorAll('#stbody .stslot').forEach(b => b.classList.toggle('sel', b === btn));
  const c = document.getElementById('stConfirm'); if (c) c.disabled = false;
}
async function confirmStylistBooking() {
  const th = lang === 'th';
  if (!_stSlot) { toast(th ? 'เลือกเวลาก่อนค่ะ' : 'Pick a time'); return; }
  const btn = document.getElementById('stConfirm'); if (btn) { btn.disabled = true; btn.textContent = th ? 'กำลังจอง…' : 'Booking…'; }
  const note = (document.getElementById('stNote') || {}).value || '';
  const r = await window.API.pcBookSlot(_stSlot, note, 'studio');
  if (!r.ok) {
    toast(r.error || (th ? 'จองไม่สำเร็จ' : 'Failed'));
    if (r.code === 'slot_taken') { selectStylist(_stPicked.id); }      // ช่องถูกจอง → รีโหลดเวลาว่าง
    else if (btn) { btn.disabled = false; btn.textContent = th ? 'ยืนยันการจอง' : 'Confirm booking'; }
    return;
  }
  closeStylistPicker();
  toast(th ? 'จองสำเร็จ — ส่งรายละเอียดให้สไตลิสต์แล้ว' : 'Booked — details sent to your stylist');
  loadPcBookZone();
}
function closeStylistPicker() { const el = document.getElementById('stpick'); if (el) el.remove(); }
async function cancelMyAppointment(id) {
  const th = lang === 'th';
  if (!confirm(th ? 'ยกเลิกนัดนี้? คุณจองเวลาใหม่กับสไตลิสต์คนไหนก็ได้' : 'Cancel this booking? You can rebook with any stylist.')) return;
  const r = await window.API.pcCancelAppointment(id);
  if (!r.ok) { toast(th ? 'ยกเลิกไม่สำเร็จ' : 'Could not cancel'); return; }
  toast(th ? 'ยกเลิกแล้ว — เลือกเวลาใหม่ได้เลย' : 'Cancelled — pick a new time');
  loadPcBookZone();
}

// ===== ครอบครัว & กลุ่ม — ไปหน้าจัดการกลุ่ม + เช่าเข้าตีม =====
function openFamily() { location.href = 'family.html'; }
// ===== ผลกระทบ + แกลเลอรี charity (wow, interactive) =====
// กระเป๋า LLOOP — เครดิต + ระดับสมาชิก + ชวนเพื่อน รวมไว้ที่เดียว (ไม่ต้องมุดเข้าฟอร์มแก้โปรไฟล์)
function closeWallet() { $('#walletOverlay').classList.remove('open'); document.body.style.overflow = ''; }
function openWallet(focusRef) {
  const c = CUSTOMER;
  const en = lang === 'en';
  $('#walletSheet').innerHTML = `
    <div class="pform">
      <button class="close" style="position:static;float:right" onclick="closeWallet()">×</button>
      <h3>${en ? 'LLOOP wallet' : 'กระเป๋า LLOOP'}</h3>
      <p class="hint">${en ? 'your credit, tier and invites — all in one place' : 'เครดิต ระดับสมาชิก และชวนเพื่อน รวมไว้ที่เดียว'}</p>
      ${renderTheLoop(c)}
      ${renderReferralCard()}
    </div>`;
  $('#walletOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => animateCounts($('#walletSheet')), 80);
  loadReferralCode();
  // เปิดจาก "ชวนเพื่อน" → เลื่อนไปการ์ดโค้ดชวนเพื่อนเลย
  if (focusRef) setTimeout(() => {
    const sheet = $('#walletSheet'), ref = sheet && sheet.querySelector('.refcard');
    if (sheet && ref) sheet.scrollTo({ top: ref.offsetTop - 12, behavior: 'smooth' });
  }, 120);
}

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
      <div class="ik">${en ? 'the good you keep in the loop' : 'ความดีที่คุณส่งต่อใน loop'}</div>
      <div class="ihead">${en ? 'wear one look, care for the planet once more' : 'เช่าหนึ่งชุด ดูแลโลกอีกหนึ่งครั้ง'}</div>
      <div class="iline">${en ? 'every time you choose to rotate instead of buy new, you truly give back to the earth' : 'ทุกครั้งที่คุณเลือกเช่าแทนซื้อใหม่ คือการคืนบางอย่างให้โลกใบนี้จริง ๆ'}</div>
      <div class="ibig">
        <div>~<b data-to="${im.water_l || 0}">0</b><span>${en ? 'litres water saved (est.)' : 'ลิตรน้ำที่ช่วยประหยัด (ประมาณ)'}</span></div>
        <div class="div"></div>
        <div>~<b data-to="${im.co2_kg || 0}">0</b><span>${en ? 'kg carbon reduced (est.)' : 'กก. คาร์บอนที่ลด (ประมาณ)'}</span></div>
        <div class="div"></div>
        <div><b data-to="${im.rentals || 0}">0</b><span>${en ? 'looks rotated' : 'รอบใน loop'}</span></div>
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

// ===== "สิ่งที่คุณชอบ" — โปรไฟล์รสนิยมที่เรียนจากพฤติกรรมจริง (Shopee/IG-style, โปร่งใส) =====
const PRICE_BAND_LBL = { th:{entry:'คุ้มราคา',mid:'ระดับกลาง',premium:'พรีเมียม'}, en:{entry:'Value',mid:'Mid',premium:'Premium'} };
function prettyKey(k){ return String(k||'').replace(/_/g,' ').replace(/\b\w/g, c=>c.toUpperCase()); }
// แถวบาร์: เรียงมาก→น้อย เอา top N — dict {key:score(0..1)}
function tasteBars(dict, labelFn, topN){
  const rows = Object.entries(dict||{}).sort((a,b)=>b[1]-a[1]).slice(0, topN||5);
  if(!rows.length) return '';
  const max = rows[0][1] || 1;
  return rows.map(([k,v])=>{
    const pct = Math.max(6, Math.round((v/max)*100));
    return `<div class="tb-row"><div class="tb-k">${esc(labelFn(k))}</div><div class="tb-bar"><i style="width:${pct}%"></i></div></div>`;
  }).join('');
}
async function openTaste(){
  const en = lang==='en';
  const tt = CUSTOMER._taste || {};
  const n = tt.n || 0;
  const block = (title, dict, labelFn) => {
    const bars = tasteBars(dict, labelFn);
    return bars ? `<div class="tg"><div class="tg-h">${title}</div>${bars}</div>` : '';
  };
  let body = '';
  if (n < 5) {
    body = `<div class="taste-empty">${en
      ? 'We\'re still learning your taste. Browse a few more looks and we\'ll show what you love here.'
      : 'เรากำลังเรียนรู้สไตล์ของคุณอยู่ — ลองดูชุดเพิ่มอีกสักนิด แล้วเราจะสรุป “สิ่งที่คุณชอบ” ให้ตรงใจ'}</div>`;
  } else {
    body = block(en?'Occasions':'โอกาสที่ชอบ', tt.occasions, occName)
         + block(en?'Brands':'แบรนด์ที่ชอบ', tt.brands, k=>k)
         + block(en?'Categories':'ประเภทที่ชอบ', tt.categories, prettyKey)
         + block(en?'Colours':'โทนสีที่ชอบ', tt.colors, prettyKey)
         + block(en?'Price':'ระดับราคา', tt.price_bands, k=>(PRICE_BAND_LBL[lang]||PRICE_BAND_LBL.th)[k]||k);
  }
  // ดูล่าสุด (recently viewed) — reuse thumbnails
  const recent = (gRecentViewed||[]).map(r=>GARMENTS.find(g=>(g.code||'')===r.code)).filter(Boolean);
  const recentHtml = recent.length ? `<div class="tg"><div class="tg-h">${en?'Recently viewed':'ดูล่าสุด'}</div><div class="recorow">${recent.map(gThumb).join('')}</div></div>` : '';
  $('#tasteSheet').innerHTML = `
    <button class="close" onclick="closeTaste()">×</button>
    <div class="taste-hero">
      <div class="ik">${en?'learned from what you browse & rent':'เรียนจากชุดที่คุณดูและเช่า'}</div>
      <div class="ihead">${en?'What you love':'สิ่งที่คุณชอบ'}</div>
    </div>
    <div class="taste-body">${body}${recentHtml}</div>
    <div class="taste-foot">${en
      ? 'Private to you — used only to sort looks you\'ll love first.'
      : 'เป็นข้อมูลส่วนตัวของคุณ — ใช้เพื่อจัดชุดที่น่าจะถูกใจขึ้นก่อนเท่านั้น'}</div>`;
  $('#tasteOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeTaste(){ $('#tasteOverlay').classList.remove('open'); document.body.style.overflow = ''; }

// ===== สมาชิกรายเดือน (Membership / subscription) =====
// ลูกค้ามีสิทธิ์สมาชิกเหลือไหม → ชุดนี้ "รวมในแพ็กเกจ" (เช็คทั้งแพ็กหลัก + แพ็กเสริมที่ถืออยู่)
// คืน {covered, plan_kind, rent_days_cap, name} — เลือกแพ็กเสริม (tier แคบ) ก่อนแพ็กหลัก
function subCoverInfo(g) {
  const s = CUSTOMER && CUSTOMER._sub;
  if (!s) return { covered: false };
  const tier = g && g.tier;
  const cands = [];
  if (s.active && (s.remaining || 0) > 0)
    cands.push({ tiers: s.tiers, remaining: s.remaining, plan_kind: 'base', rent_days_cap: null, name: s.plan_name });
  (s.addons || []).forEach(a => {
    if ((a.remaining || 0) > 0 && a.status === 'active')
      cands.push({ tiers: a.tiers, remaining: a.remaining, plan_kind: 'addon', rent_days_cap: a.rent_days_cap, name: a.plan_name });
  });
  const ok = cands.filter(c => !tier || !Array.isArray(c.tiers) || !c.tiers.length || c.tiers.includes(tier));
  if (!ok.length) return { covered: false };
  // แพ็กเสริมก่อน (tier แคบกว่า) แล้วค่อยแพ็กหลัก
  ok.sort((a, b) => (b.plan_kind === 'addon') - (a.plan_kind === 'addon') || ((a.tiers ? a.tiers.length : 99) - (b.tiers ? b.tiers.length : 99)));
  return Object.assign({ covered: true }, ok[0]);
}
function subCovers(g) { return subCoverInfo(g).covered; }
// ป้ายเพดานวันเช่าของชุดที่คุ้มด้วยแพ็กเสริม (เช่น " · สูงสุด 4 วัน")
function subCapLabel(g) {
  const ci = subCoverInfo(g);
  if (ci.covered && ci.rent_days_cap) return ` · ${lang === 'th' ? 'สูงสุด' : 'up to'} ${ci.rent_days_cap} ${lang === 'th' ? 'วัน' : 'days'}`;
  return '';
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
      <div style="font-family:var(--display);font-size:24px;font-weight:700;color:var(--ink);margin-top:4px">Loop Membership</div>
      <div style="font-size:13px;color:var(--muted);margin-top:4px">${en ? 'rotate new looks every month' : 'ได้ลุคใหม่ทุกเดือน คุ้มกว่าเช่ารายชุด'}</div>
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
  const baseplans = plans.filter(p => (p.plan_kind || 'base') !== 'addon');
  const addonplans = plans.filter(p => p.plan_kind === 'addon');
  const heldAddons = (sub && sub.addons) || [];
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
  // แพ็กเสริมที่ถืออยู่ (Premium Pass ฯลฯ)
  if (heldAddons.length) {
    html += `<div style="font-size:12px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin-bottom:10px">${en ? 'Your add-ons' : 'แพ็กเสริมของคุณ'}</div>`
      + heldAddons.map(a => `<div style="background:var(--sage-bg);border-radius:10px;padding:12px 14px;margin-bottom:10px">
          <div style="font-size:14px;font-weight:600;color:var(--ink)">${a.plan_name || ''}</div>
          <div style="font-size:12px;color:#0c3a33;margin-top:2px">${en ? 'left' : 'เหลือ'} ${a.remaining || 0}/${a.rentals_per_cycle || 0} ${en ? 'pcs' : 'ชิ้น'}${a.rent_days_cap ? ` · ${en ? 'up to' : 'สูงสุด'} ${a.rent_days_cap} ${en ? 'days/pc' : 'วัน/ชิ้น'}` : ''} · ${en ? 'renews' : 'รอบต่อไป'} ${fmtThaiDate(a.renews_at)}</div>
        </div>`).join('');
  }
  // ฟิลเตอร์รอบบิล — โชว์ทีละรอบ ดูง่าย
  const ORDER = ['week', 'month', 'quarter', 'year'];
  const PL = { week: en ? 'Weekly' : 'รายสัปดาห์', month: en ? 'Monthly' : 'รายเดือน', quarter: en ? '3-month' : 'ราย 3 เดือน', year: en ? 'Yearly' : 'รายปี' };
  const periods = [...new Set(baseplans.map(p => p.period || 'month'))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  if (!periods.includes(gMemPeriod)) gMemPeriod = periods.includes('month') ? 'month' : periods[0];
  html += `<div style="display:flex;gap:8px;overflow-x:auto;margin-bottom:14px;scrollbar-width:none">` + periods.map(pr =>
    `<button onclick="memSetPeriod('${pr}')" style="white-space:nowrap;padding:8px 15px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid ${pr === gMemPeriod ? 'var(--ink)' : 'var(--line)'};background:${pr === gMemPeriod ? 'var(--ink)' : '#fff'};color:${pr === gMemPeriod ? '#fff' : 'var(--muted)'}">${PL[pr] || pr}</button>`
  ).join('') + `</div>`;
  // การ์ดแพ็กเกจ (เฉพาะรอบที่เลือก) — ราคา/เดือน + ชุด/เดือน + ครอบคลุม + เก็บเงินยังไง
  // กันการ์ดแพ็กที่ config หาย (ราคา 0 หรือ 0 ชุด) ไม่ให้โชว์เป็น "฿0/เดือน · 0 ชุด" ที่ดูน่าเชื่อถือผิด ๆ
  const filtered = baseplans.filter(p => (p.period || 'month') === gMemPeriod
    && (Number(p.price_per_month || p.price || p.price_month) || 0) > 0
    && (p.rentals_per_month_equiv || p.rentals_per_cycle || 0) > 0);
  html += filtered.map(p => {
    const current = sub && sub.plan_code === p.code && sub.status !== 'cancelled';
    const pm = Number(p.price_per_month || p.price || p.price_month) || 0;
    const cyclePrice = Number(p.price || p.price_month) || 0;
    const qpm = p.rentals_per_month_equiv || p.rentals_per_cycle || 0;
    const longTerm = (p.period || 'month') !== 'month';
    const popular = (p.code || '').indexOf('PLUS') > -1 && (p.period || 'month') === 'month';
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
  // ===== แพ็กเสริม (add-on) — ปลดล็อกชุดพรีเมียม/ดีไซเนอร์ วางซ้อนบนแพ็กหลัก =====
  if (addonplans.length) {
    const hasBase = !!(sub && sub.active && sub.plan_code);
    html += `<div style="font-size:12px;letter-spacing:2px;color:var(--muted);text-transform:uppercase;margin:20px 0 4px">${en ? 'Add-on passes' : 'แพ็กเสริม'}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">${en ? 'Unlock premium / designer pieces on top of your plan' : 'ปลดล็อกชุดพรีเมียม/ดีไซเนอร์ เพิ่มบนแพ็กหลัก'}</div>`;
    html += addonplans.map(p => {
      const owned = heldAddons.some(a => a.plan_code === p.code);
      const price = Number(p.price || p.price_month) || 0;
      const pcs = p.rentals_per_cycle || 1;
      const needBase = p.requires_base && !hasBase;
      const perks = (p.perks || []).slice(0, 3).map(x => `<div style="font-size:12.5px;color:var(--ink);padding:2px 0">· ${x}</div>`).join('');
      return `<div style="background:#fff;border:${owned ? '2px solid var(--sage)' : '1px solid var(--line)'};border-radius:10px;padding:16px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div><div style="font-size:16px;font-weight:600;color:var(--ink)">${p.name}</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">${pcs} ${en ? 'pcs/mo' : 'ชิ้น/เดือน'}${p.rent_days_cap ? ` · ${en ? 'up to' : 'สูงสุด'} ${p.rent_days_cap} ${en ? 'days/pc' : 'วัน/ชิ้น'}` : ''}</div></div>
          <div style="text-align:right"><div style="font-size:20px;font-weight:700;color:var(--ink);line-height:1.1">฿${price.toLocaleString()}<span style="font-size:11px;font-weight:400;color:var(--muted)">/${en ? 'mo' : 'เดือน'}</span></div></div>
        </div>
        <div style="margin-top:8px">${perks}</div>
        ${owned
          ? `<div style="text-align:center;font-size:12px;letter-spacing:1px;color:var(--sage);margin-top:12px;text-transform:uppercase">${en ? 'Active add-on' : 'แพ็กเสริมปัจจุบัน'}</div>`
          : needBase
            ? `<div style="text-align:center;font-size:12px;color:var(--muted);margin-top:12px">${en ? 'Subscribe to a plan first' : 'สมัครแพ็กหลักก่อนนะคะ'}</div>`
            : `<button onclick="subscribeClick('${p.code}','${(p.name || '').replace(/'/g, '')}')" style="width:100%;background:var(--ink);color:#fff;border:none;padding:11px;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin-top:12px;border-radius:6px;cursor:pointer">${en ? 'Add this pass' : 'เพิ่มแพ็กเสริมนี้'}</button>`}
      </div>`;
    }).join('');
  }
  html += `<div style="font-size:11px;color:var(--muted);text-align:center;margin-top:6px;line-height:1.5">${en ? 'Premium / designer pieces use an add-on pass — everyday pieces are included in your base plan; anything else still rents at the normal price.' : 'ชุดพรีเมียม/ดีไซเนอร์ใช้แพ็กเสริม · ชุดทั่วไปรวมในแพ็กหลัก · ชุดนอกสิทธิ์เช่าได้ราคาปกติ'}</div>`;
  body.innerHTML = html;
}
async function subscribeClick(code, name) {
  const en = lang === 'en';
  try {
    // เริ่มสมัคร → ระบบจดแพ็กที่เลือก + คืน QR ให้จ่าย (เปิดสิทธิ์จริงเมื่อสลิปผ่าน)
    const res = await window.API.subscribe?.(CUSTOMER, code);
    const d = res && res.data;
    if (res && res.data === 'need_base') { toast(en ? 'Subscribe to a plan first' : 'สมัครแพ็กหลักก่อนนะคะ'); return; }
    if (!res || !res.ok || !d || d.ok === false) {
      const er = d && d.error;
      toast(er === 'no_plan' ? (en ? 'Plan not found' : 'ไม่พบแพ็กเกจนี้') : (en ? 'Something went wrong' : 'เกิดข้อผิดพลาด ลองใหม่นะคะ'));
      return;
    }
    showSubPayModal(d);   // จ่ายเงินก่อนถึงเปิดสิทธิ์
  } catch (e) { toast(en ? 'Something went wrong' : 'เกิดข้อผิดพลาด ลองใหม่นะคะ'); }
}
// แผงจ่ายเงินสมาชิก — PromptPay QR + แนบสลิปในแชต → ระบบเปิดสิทธิ์อัตโนมัติ
function showSubPayModal(d) {
  const en = lang === 'en';
  const pay = d.pay || {}; const price = Number(d.price) || 0;
  closeSubPay();
  const ov = document.createElement('div');
  ov.id = 'subPayOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(20,18,16,.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:18px';
  const acct = pay.pay_account_no ? `${en ? 'or transfer to' : 'หรือโอนเข้าบัญชี'} ${esc(pay.pay_bank_name || '')} ${esc(pay.pay_account_no)} (${esc(pay.pay_account_name || '')})` : '';
  ov.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:340px;width:100%;padding:22px;text-align:center;font-family:var(--sans,sans-serif)">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#86857F">${en ? 'membership' : 'สมัครสมาชิก'}</div>
    <div style="font-size:18px;font-weight:700;margin:4px 0 2px">${esc(d.name || '')}</div>
    <div style="font-size:24px;font-weight:700">฿${price.toLocaleString('th-TH')}</div>
    <div style="font-size:12px;color:#86857F;margin-bottom:14px">${en ? 'per' : 'ต่อ'} ${esc(d.period_label || d.period || '')}${d.rentals ? ` · ${en ? 'rentals' : 'เช่าได้'} ${d.rentals}` : ''}</div>
    <div id="subqr" style="display:flex;justify-content:center;margin-bottom:12px"></div>
    <div style="font-size:13px;color:#1A1A1A;line-height:1.55">${en ? 'Scan PromptPay to pay, then' : 'สแกนพร้อมเพย์เพื่อจ่าย แล้ว'}<br><b>${en ? 'attach the slip in LINE chat' : 'แนบสลิปในแชต LINE'}</b> ${en ? '— membership opens automatically' : '— ระบบเปิดสิทธิ์ให้อัตโนมัติ'}</div>
    ${acct ? `<div style="font-size:11px;color:#86857F;margin-top:8px">${acct}</div>` : ''}
    <button onclick="closeSubPay(true)" style="width:100%;background:#1A1A1A;color:#fff;border:none;padding:12px;border-radius:8px;margin-top:16px;font-size:14px;cursor:pointer">${en ? 'I have transferred / Close' : 'ฉันโอนแล้ว / ปิด'}</button>
  </div>`;
  document.body.appendChild(ov);
  if (pay.pay_promptpay_id && window.promptpayBrandedQR) {
    try { window.promptpayBrandedQR(document.getElementById('subqr'), pay.pay_promptpay_id, price, pay.pay_promptpay_type); } catch (e) { /**/ }
  }
}
async function closeSubPay(refresh) {
  const ov = document.getElementById('subPayOv'); if (ov) ov.remove();
  if (refresh !== true) return;
  try {
    CUSTOMER._sub = await window.API.mySubscription?.(CUSTOMER) || { active: false };
    let plans = []; try { plans = await window.API.subPlans?.() || []; } catch (e) { /**/ }
    renderMembership(CUSTOMER._sub, plans);
    toast(lang === 'en' ? 'We will open your membership once the slip is verified' : 'เมื่อสลิปผ่าน ระบบจะเปิดสิทธิ์ให้อัตโนมัติค่ะ');
  } catch (e) { /**/ }
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
  const th = { reserved:'จองแล้ว', hold:'รอชำระเงิน', out:'จัดส่ง/กำลังใช้', returned:'คืนแล้ว', cancelled:'ยกเลิก', backup:'ชุดสำรอง'};
  const en = { reserved:'Reserved', hold:'Awaiting payment', out:'Shipped / In use', returned:'Returned', cancelled:'Cancelled', backup:'Spare'};
  return (lang ==='th'? th : en)[s] || s;
}
// thumbnail ของออเดอร์ — ใช้รูปจริงถ้ามี ไม่งั้น fallback สีพื้น (เทียบกับ GARMENTS ที่โหลดไว้)
function orderThumb(r) {
  const g = GARMENTS.find(x => x.code === r.code);
  const photo = r.photo || (g && (g.photo || (Array.isArray(g.photos) && g.photos[0])));
  return photo ? `background-image:url('${photo}')` : `background:${(g && g.bg) || '#E7E2DA'}`;
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
let _myRentals = [];
// state ของ rail วันที่ + agenda (ให้แตะวันแล้วเรนเดอร์ซ้ำ/เลื่อนได้)
let _ordersData = null;
function renderOrders(rentals) {
  _myRentals = rentals || [];
  const body = $('#ordersBody'); if (!body) return;
  if (!rentals.length) {
    body.innerHTML =`<div class="oempty">${lang ==='th'?'ยังไม่มีออเดอร์ — เลือกชุดที่ถูกใจแล้วเริ่มลุคแรกของคุณได้เลย':'No rentals yet — pick a look you love to begin'}</div>`;
    return;
  }
  // จับกลุ่ม: ชุดสำรองไปซ้อนใต้ชุดหลักของมัน (ไม่โผล่เป็นออเดอร์แยกให้งง)
  const primaries = rentals.filter(r => (r.role || 'primary') !== 'backup');
  const spares = rentals.filter(r => (r.role || 'primary') === 'backup');
  const sparesByPrimary = {};
  spares.forEach(s => { (sparesByPrimary[s.primary_rental_id] = sparesByPrimary[s.primary_rental_id] || []).push(s); });
  // ชุดสำรองที่หาชุดหลักไม่เจอ (เช่นชุดหลักถูกลบ) → แสดงเดี่ยว ๆ ตามวันของมันเอง
  const orphanSpares = spares.filter(s => !primaries.some(p => p.rental_id === s.primary_rental_id));
  // จับกลุ่มชุดหลัก (+ สำรองกำพร้า) ตามวันที่ใช้ → ปฏิทิน + agenda รายวัน
  const byDate = {};
  const push = r => { const k = r.use_date || 'nodate'; (byDate[k] = byDate[k] || []).push(r); };
  primaries.forEach(push); orphanSpares.forEach(push);
  const nodate = byDate['nodate'] || []; delete byDate['nodate'];
  const allDates = Object.keys(byDate).sort();
  // เรียง agenda: วันที่กำลังจะถึง (ใกล้→ไกล) ก่อน แล้วตามด้วยวันที่ผ่านมา (ใหม่→เก่า)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isPast = d => new Date(d + 'T00:00:00') < today;
  const upcoming = allDates.filter(d => !isPast(d));   // ใกล้→ไกล (วันนี้เป็นต้นไป)
  const past = allDates.filter(isPast).reverse();      // ที่ผ่านมา: ใหม่→เก่า
  const ordered = upcoming.concat(past);
  _ordersData = { sparesByPrimary, byDate, ordered, upcoming, past, nodate };
  drawOrders();
}
function drawOrders() {
  const body = $('#ordersBody'); if (!body || !_ordersData) return;
  const { byDate, upcoming, past, nodate, sparesByPrimary } = _ordersData;
  // เรียงตามวัน: วันนี้เป็นต้นไปก่อน แล้วคั่นด้วยหัวข้อ "ที่ผ่านมา" ให้อ่านลำดับวันได้ชัด
  const upBlocks = upcoming.map(d => orderDayBlock(d, byDate[d])).join('');
  const pastBlocks = past.length
    ? `<div class="oday-sep">${lang ==='th'?'ที่ผ่านมา':'Past'}</div>` + past.map(d => orderDayBlock(d, byDate[d])).join('')
    : '';
  const agenda = upBlocks + pastBlocks;
  const nod = nodate.length ? `<div class="oday" id="day-nodate">
      <div class="oday-h"><div class="oday-date">${lang ==='th'?'ยังไม่ระบุวัน':'No date yet'}</div></div>
      ${nodate.map(r => orderCard(r, sparesByPrimary[r.rental_id] || [])).join('')}
    </div>` : '';
  body.innerHTML = ordersRail() + `<div class="oagenda">${agenda}${nod}</div>`;
}
// ปฏิทินแบบโชว์เฉพาะ "วันที่มีออเดอร์" เป็นชิปเรียงให้เห็นครบทุกวันในทีเดียว
function ordersRail() {
  const { byDate, ordered, upcoming, past } = _ordersData;
  const th = lang === 'th';
  const months = th ? ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dows = th ? ['อา','จ','อ','พ','พฤ','ศ','ส'] : ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const chip = (key, on) => {
    const d = new Date(key + 'T00:00:00');
    const rows = byDate[key];
    const main = rows.find(r => (r.role || 'primary') !== 'backup') || rows[0];
    const extra = rows.length > 1 ? ` +${rows.length - 1}` : '';
    return `<button type="button" class="orail-chip${on ? ' on' : ''}" data-key="${key}" onclick="ordersJump('${key}')">
      <span class="orail-dow">${dows[d.getDay()]}</span>
      <span class="orail-day">${d.getDate()}</span>
      <span class="orail-mon">${months[d.getMonth()]}</span>
      <span class="orail-name">${(main.name || '—')}${extra}</span>
    </button>`;
  };
  // ชิปเรียงตามวัน: วันนี้เป็นต้นไปก่อน → คั่น "ที่ผ่านมา" → วันที่ผ่านมา (ไม่ให้ดูเหมือนเรียงมั่ว)
  const chips = upcoming.map((k, i) => chip(k, i === 0)).join('')
    + (past.length ? `<span class="orail-sep">${th ? 'ที่ผ่านมา' : 'Past'}</span>` : '')
    + past.map((k, i) => chip(k, upcoming.length === 0 && i === 0)).join('');
  return `<div class="orail-wrap">
    <div class="orail-head">${th ? `วันที่มีออเดอร์ · ${ordered.length} วัน` : `${ordered.length} rental days`}</div>
    <div class="orail">${chips}</div>
  </div>`;
}
function ordersJump(key) {
  document.querySelectorAll('.orail-chip').forEach(c => c.classList.toggle('on', c.dataset.key === key));
  const el = document.getElementById('day-' + key); if (!el) return;
  // เลื่อน container ของชีตเอง (scrollIntoView ไม่เสถียรใน overlay fixed/LIFF webview)
  const cont = el.closest('.sheet') || el.parentElement;
  if (cont) {
    const top = el.getBoundingClientRect().top - cont.getBoundingClientRect().top + cont.scrollTop - 8;
    cont.scrollTo({ top, behavior:'smooth' });
  }
  el.classList.add('oday-flash'); setTimeout(() => el.classList.remove('oday-flash'), 1500);
}
// บล็อกรายวัน: หัววันที่ + ลุคของวันนั้น (ชุดหลัก พร้อมชุดสำรองแบบเปิด/ปิด)
function orderDayBlock(dateKey, rows) {
  const th = lang === 'th';
  const d = new Date(dateKey + 'T00:00:00');
  const wd = d.toLocaleDateString(th ? 'th-TH' : 'en-GB', { weekday:'long' });
  const dnum = d.toLocaleDateString(th ? 'th-TH' : 'en-GB', { day:'numeric', month:'long' });
  const cards = rows.map(r => orderCard(r, _ordersData.sparesByPrimary[r.rental_id] || [])).join('');
  return `<div class="oday" id="day-${dateKey}">
    <div class="oday-h">
      <div class="oday-date">${dnum}</div>
      <div class="oday-meta">${wd} · ${rows.length} ${th ? 'ลุค' : 'looks'}</div>
    </div>
    ${cards}
  </div>`;
}
function orderCard(r, spareList) {
  const isSpare = (r.role || 'primary') === 'backup';
  const status = rentalStatusLabel(isSpare ? 'backup' : r.status);
  const stClass = isSpare ? 'spare'
    : r.status ==='returned'?'done' : r.status ==='cancelled'?'cancel' : r.status ==='out'?'out'
    : r.status ==='hold'?'hold' :'res';
  const url = (r.courier && r.tracking_no) ? trackUrl(r.courier, r.tracking_no) : null;
  const ship = (r.courier && r.tracking_no) ?`
    <div class="orow"><span>${lang ==='th'?'ขนส่ง':'Courier'}</span>${
      url?`<a href="${url}" target="_blank" rel="noopener">${r.courier} · ${r.tracking_no}</a>`:`${r.courier} · ${r.tracking_no}`
    }${r.eta?` <i class="oeta">${lang ==='th'?'ถึงราว':'eta'} ${fmtDate(r.eta)}</i>`:''}</div>`:'';
  // ราคา/มัดจำ — ให้รายละเอียดครบ ไม่ใช่การ์ดเปล่า
  const priceLine = r.covered_by_sub
    ? `<div class="orow"><span>${lang==='th'?'ค่าเช่า':'Rental'}</span>${lang==='th'?'รวมในแพ็กเกจ':'Included in plan'}</div>`
    : (r.price != null ? `<div class="orow"><span>${lang==='th'?'ค่าเช่า':'Rental'}</span>฿${Math.round(r.price)}${r.deposit>0?` <i class="oeta">+${lang==='th'?'มัดจำ':'deposit'} ฿${Math.round(r.deposit)}</i>`:''}</div>` : '');
  const durLine = r.rent_days ? `<div class="orow"><span>${lang==='th'?'ระยะเวลา':'Duration'}</span>${r.rent_days} ${lang==='th'?'วัน':'days'}</div>` : '';
  const reRent =`<button class="obtn" onclick="reRentByCode('${(r.code||'').replace(/'/g,"")}')">${lang ==='th'?'เช่าอีก':'Rent again'}</button>`;
  // ออเดอร์ที่ยังรอชำระ — ปุ่มหลักคือกลับไปจ่าย/ส่งสลิป (กันลูกค้าค้างสถานะ hold)
  const payB = (!isSpare && r.status ==='hold')
    ?`<button class="obtn" onclick="orderPay('${(r.code||'').replace(/'/g,"")}','${r.use_date}',${r.rent_days||1},'${(r.name||'').replace(/'/g,"")}')">${lang ==='th'?'ชำระเงิน / ส่งสลิป':'Pay / send slip'}</button>`:'';
  const review = (!isSpare && r.status ==='returned')
    ?`<button class="obtn ghost" onclick="openReview('${r.rental_id}','${(r.name||'').replace(/'/g,"")}')">${lang ==='th'?'รีวิว':'Review'}</button>`:'';
  // ยืดหยุ่นกว่าคู่แข่ง: ลูกค้ายกเลิก/เลื่อน/ต่อเวลาเองได้ (ผ่าน me-rpc gateway) — เฉพาะชุดหลัก
  const canCancelResched = !isSpare && (r.status ==='reserved'|| r.status ==='hold');
  const canExtend = !isSpare && (r.status ==='reserved'|| r.status ==='out');
  const reschedB = canCancelResched ?`<button class="obtn ghost" onclick="orderReschedule('${r.rental_id}')">${lang ==='th'?'เลื่อนวัน':'Reschedule'}</button>`:'';
  const extendB = canExtend ?`<button class="obtn ghost" onclick="orderExtend('${r.rental_id}')">${lang ==='th'?'ต่อเวลา':'Extend'}</button>`:'';
  const cancelB = canCancelResched ?`<button class="obtn ghost" onclick="orderCancel('${r.rental_id}')">${lang ==='th'?'ยกเลิก':'Cancel'}</button>`:'';
  const actions = isSpare ? '' : `<div class="oactions">${payB}${r.status==='hold'?'':reRent}${reschedB}${extendB}${cancelB}${review}</div>`;
  // ชุดสำรองของวันนี้ — เปิด/ปิดเรียกดูได้ (ไม่รก แต่กดดูได้ว่าเตรียมตัวไหนไว้)
  const spId = 'sp-' + r.rental_id;
  const sparesBox = (spareList && spareList.length) ? `
    <div class="ospares">
      <button type="button" class="ospares-toggle" onclick="toggleSpares('${spId}')">
        <span>${lang==='th'?`ชุดสำรองวันนี้ · ${spareList.length} ตัว`:`Spare looks today · ${spareList.length}`}</span>
        <span class="ospares-caret" id="${spId}-caret">▾</span>
      </button>
      <div class="ospares-body" id="${spId}" hidden>
        ${spareList.map(s => `<div class="ospare"><span class="othumb sm" style="${orderThumb(s)}"></span><span class="osp-name">${s.name||'—'}</span></div>`).join('')}
        <div class="ospares-why">${lang==='th'
          ? 'ถ้าชุดหลักมีเหตุไม่พร้อมจริง ๆ (เช่น ผู้เช่าก่อนหน้าทำเสียหาย) เราสลับตัวสำรองให้ทันที ไม่มีค่าใช้จ่ายเพิ่ม'
          : 'If your main piece can’t make it (e.g. damaged by a prior renter), we swap in a spare right away at no extra cost.'}</div>
      </div>
    </div>` : '';
  // ลิงก์ครอบครัว/แก๊ง — ถ้าออเดอร์นี้จองมาผ่านกลุ่ม โชว์ชื่อกลุ่ม + คนใส่จริง
  const th = lang === 'th';
  const kindLabel = r.group_kind === 'friends' ? (th ? 'แก๊งเพื่อน' : 'Friends') : (th ? 'ครอบครัว' : 'Family');
  const famBadge = r.group_name ? `<div class="ofam">
      <span class="ofam-tag">${kindLabel}</span>
      <span class="ofam-name">${esc(r.group_name)}</span>
      ${r.wearer_name ? `<span class="ofam-wear">${th ? 'ผู้ใส่' : 'wears'} · ${esc(r.wearer_name)}</span>` : ''}
    </div>` : '';
  // บันทึก "งานอะไร" — ลูกค้าจดเองได้ (ออเดอร์กลุ่ม default เป็นตีมงานของกลุ่ม แต่แก้ทับเองได้)
  const occInner = r.occasion
    ? `<span class="oocc-val">${esc(r.occasion)}</span><button class="oocc-edit" onclick="editOrderOccasion('${r.rental_id}')">${th ? 'แก้ไข' : 'Edit'}</button>`
    : `<button class="oocc-add" onclick="editOrderOccasion('${r.rental_id}')">${th ? '+ บันทึกว่าใส่ไปงานอะไร' : '+ Add the occasion'}</button>`;
  const occLine = isSpare ? '' : `<div class="orow oocc"><span>${th ? 'งาน' : 'Occasion'}</span><span class="oocc-wrap">${occInner}</span></div>`;
  return`<div class="ocard${isSpare?' ocard-spare':''}">
    <div class="otop">
      <span class="othumb" style="${orderThumb(r)}"></span>
      <div class="oname-wrap">
        <div class="oname">${r.name ||'—'}</div>
        <span class="ost ${stClass}">${status}</span>
        ${famBadge}
      </div>
    </div>
    ${durLine}
    <div class="orow"><span>${lang ==='th'?'วันที่ใช้':'Use date'}</span>${r.use_date? fmtDate(r.use_date):'—'}</div>
    <div class="orow"><span>${lang ==='th'?'กำหนดคืน':'Due back'}</span>${r.due_at? fmtDate(r.due_at):'—'}</div>
    ${occLine}
    ${priceLine}
    ${ship}
    ${sparesBox}
    ${actions}
  </div>`;
}
function toggleSpares(id) {
  const el = document.getElementById(id); if (!el) return;
  const caret = document.getElementById(id + '-caret');
  const opening = el.hasAttribute('hidden');
  if (opening) { el.removeAttribute('hidden'); if (caret) caret.style.transform = 'rotate(180deg)'; }
  else { el.setAttribute('hidden', ''); if (caret) caret.style.transform = ''; }
}
// บันทึก "งานอะไร" ของออเดอร์ (occasion) — แตะเพื่อพิมพ์/แก้ แล้วเซฟผ่าน gateway
async function editOrderOccasion(rentalId) {
  const r = _myRentals.find(x => x.rental_id === rentalId); if (!r) return;
  const th = lang === 'th';
  const v = prompt(th ? 'ใส่ชุดนี้ไปงานอะไรคะ? (เช่น งานแต่งเพื่อน, รับปริญญา)' : 'What event is this look for?', r.occasion || '');
  if (v === null) return;                         // กดยกเลิก
  const occ = v.trim().slice(0, 80);
  const res = await window.API.setRentalOccasion(rentalId, occ);
  if (!res || !res.ok) { toast(th ? 'บันทึกไม่สำเร็จ ลองใหม่นะคะ' : 'Save failed'); return; }
  r.occasion = occ || null; r.occasion_own = occ || null;   // อัปเดต state ในมือ แล้ววาดใหม่
  drawOrders();
  toast(occ ? (th ? 'บันทึกงานแล้วค่ะ' : 'Saved') : (th ? 'ลบบันทึกแล้วค่ะ' : 'Cleared'));
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
// ===== ต่อเวลา — เลือกวันคืนใหม่จากปฏิทินว่าง (แทนการพิมพ์วันเอง) =====
let _extend = null;  // { rentalId, name, dueAt, booked:Set, pick, charge }
async function orderExtend(rentalId) {
  if (!rentalId) return;
  const r = _myRentals.find(x => x.rental_id === rentalId);
  if (!r || !r.garment_id || !r.due_at) { toast(lang ==='th'?'เปิดข้อมูลชุดไม่ได้ ลองรีเฟรชนะคะ':'Cannot load this piece'); return; }
  let ranges = [];
  try { ranges = await window.API.bookedRanges(r.garment_id, rentalId) || []; } catch (e) { /**/ }
  const booked = new Set();
  ranges.forEach(x => { let d = new Date(x.from_date+'T00:00:00'); const end = new Date(x.to_date+'T00:00:00');
    for (; d <= end; d.setDate(d.getDate()+1)) booked.add(_ymdLocal(d)); });
  _extend = { rentalId, name: r.name, dueAt: r.due_at, booked, pick: null, charge: null };
  _renderExtend();
  $('#reschedOverlay').classList.add('open'); document.body.style.overflow ='hidden';
  $('#reschedSheet').scrollTop = 0;
}
// ต่อจากวันคืนเดิม+1 ถึง to ต้องว่างต่อเนื่อง (ชุดอยู่กับเราต่อได้จริง)
function _extFree(to) {
  let d = _addDays(_extend.dueAt, 1);
  while (d <= to) { if (_extend.booked.has(d)) return false; d = _addDays(d, 1); }
  return true;
}
function _renderExtend() {
  const th = lang ==='th', S = _extend;
  const today = new Date(todayStr()+'T00:00:00');
  const minDate = _addDays(S.dueAt, 1);
  const dow = th ? ['อา','จ','อ','พ','พฤ','ศ','ส'] : ['S','M','T','W','T','F','S'];
  let cal = '';
  for (let mo = 0; mo < 3; mo++) {
    const base = new Date(today.getFullYear(), today.getMonth()+mo, 1);
    const monthName = base.toLocaleDateString(th?'th-TH':'en-US', { month:'long', year:'2-digit' });
    const first = base.getDay(), days = new Date(base.getFullYear(), base.getMonth()+1, 0).getDate();
    let cells = dow.map(d => `<span class="cdow">${d}</span>`).join('');
    for (let i = 0; i < first; i++) cells += `<span></span>`;
    for (let dn = 1; dn <= days; dn++) {
      const ds = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(dn).padStart(2,'0')}`;
      const ok = ds >= minDate && _extFree(ds);            // วันคืนใหม่ที่ต่อได้จริง
      const inSel = S.pick && ds > S.dueAt && ds <= S.pick;
      const cls = ds < minDate ? 'past' : ok ? 'free' : 'bk';
      const onclick = ok ? ` onclick="pickExtendDate('${ds}')"` : '';
      cells += `<span class="cday ${cls} ${inSel?'sel':''}"${onclick}>${dn}</span>`;
    }
    cal += `<div class="calmonth"><div class="calhd">${monthName}</div><div class="calgrid">${cells}</div></div>`;
  }
  let summary = '';
  if (S.pick) {
    const extraDays = Math.round((new Date(S.pick+'T00:00:00') - new Date(S.dueAt+'T00:00:00'))/86400000);
    const charge = S.charge == null ? (th?'กำลังคำนวณ…':'calculating…') : (S.charge > 0 ? `฿${S.charge}` : (th?'ฟรี':'free'));
    summary = `<div class="rsd-sum">${th?'คืนใหม่':'New return'} <b>${fmtDate(S.pick)}</b> <i>(+${extraDays} ${th?'วัน':'days'})</i> · ${th?'ค่าเช่าเพิ่ม':'extra'} <b>${charge}</b></div>`;
  }
  $('#reschedSheet').innerHTML = `
    <button class="close" onclick="closeExtend()">×</button>
    <div class="rsd-head">${th?'ต่อเวลาเช่า':'Extend rental'}</div>
    <div class="rsd-name">${S.name||''}</div>
    <div class="rsd-hint">${th?`คืนเดิม ${fmtDate(S.dueAt)} · เลือกวันคืนใหม่จากวันที่ว่าง`:`Currently due ${fmtDate(S.dueAt)} · pick a new return date`}</div>
    <div class="rsd-cal">${cal}</div>
    <div class="callegend"><span><i class="lfree"></i>${th?'ว่าง':'free'}</span><span><i class="lbk"></i>${th?'ไม่ว่าง':'booked'}</span></div>
    <div class="calnote">${th?'ต่อได้ถึงก่อนวันที่ชุดมีคิวจองถัดไปเท่านั้น':'You can extend up to the next booking'}</div>
    ${summary}
    <button class="rvsubmit" id="extGo" ${S.pick && S.charge!=null?'':'disabled'} onclick="confirmExtend()">${th?'ยืนยันต่อเวลา':'Confirm extension'}</button>`;
}
async function pickExtendDate(ds) {
  _extend.pick = ds; _extend.charge = null; _renderExtend();
  try {
    const q = await window.API.quoteExtension(_extend.rentalId, ds);
    if (q && q.error) {
      toast(q.error ==='unavailable'
        ? (lang ==='th'?'ชุดมีคิวจองต่อ ต่อถึงวันนี้ไม่ได้ค่ะ':'Not available — booked after this')
        : q.error ==='must_be_later' ? (lang ==='th'?'ต้องเป็นวันหลังวันคืนเดิมค่ะ':'Must be after current return')
        : (lang ==='th'?'ต่อเวลาวันนี้ไม่ได้ค่ะ':'Cannot extend to this date'));
      _extend.pick = null; _renderExtend(); return;
    }
    if (q && !q.error) { _extend.charge = q.extra_charge || 0; _renderExtend(); }
  } catch (e) { _extend.charge = 0; _renderExtend(); }
}
function closeExtend() { $('#reschedOverlay').classList.remove('open'); document.body.style.overflow =''; _extend = null; const s = $('#reschedSheet'); if (s) s.innerHTML = ''; }
async function confirmExtend() {
  if (!_extend || !_extend.pick) return;
  const { rentalId, pick } = _extend;
  const btn = $('#extGo'); if (btn) { btn.disabled = true; btn.textContent = lang ==='th'?'กำลังต่อเวลา…':'Extending…'; }
  const res = await window.API.extendRental(rentalId, pick);
  if (!res || !res.ok) { toast(lang ==='th'?'ต่อเวลาไม่สำเร็จค่ะ':'Extend failed'); closeExtend(); return; }
  closeExtend();
  toast(lang ==='th'?'ต่อเวลาเรียบร้อยค่ะ':'Extended'); openOrders();
}
// ===== เลื่อนวัน — เลือกจากปฏิทินว่าง/ไม่ว่าง (แทนการพิมพ์วันเอง) =====
let _resched = null;  // { rentalId, garmentId, span, booked:Set, pick }
function _ymdLocal(dt) { return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`; }
function _addDays(ds, n) { const d = new Date(ds +'T00:00:00'); d.setDate(d.getDate()+n); return _ymdLocal(d); }
async function orderReschedule(rentalId) {
  if (!rentalId) return;
  const r = _myRentals.find(x => x.rental_id === rentalId);
  if (!r || !r.garment_id) { toast(lang ==='th'?'เปิดข้อมูลชุดไม่ได้ ลองรีเฟรชนะคะ':'Cannot load this piece'); return; }
  // ระยะเวลาเดิม (วันคืน − วันรับ) คงไว้ → เลือกแค่วันรับใหม่ ระบบเลื่อนวันคืนให้เอง
  const span = (r.use_date && r.due_at)
    ? Math.max(0, Math.round((new Date(r.due_at+'T00:00:00') - new Date(r.use_date+'T00:00:00'))/86400000))
    : Math.max(0, (r.rent_days||1) - 1);
  let ranges = [];
  try { ranges = await window.API.bookedRanges(r.garment_id, rentalId) || []; } catch (e) { /**/ }
  const booked = new Set();
  ranges.forEach(x => { let d = new Date(x.from_date+'T00:00:00'); const end = new Date(x.to_date+'T00:00:00');
    for (; d <= end; d.setDate(d.getDate()+1)) booked.add(_ymdLocal(d)); });
  _resched = { rentalId, garmentId: r.garment_id, name: r.name, span, booked, pick: null };
  _renderResched();
  $('#reschedOverlay').classList.add('open'); document.body.style.overflow ='hidden';
  $('#reschedSheet').scrollTop = 0;
}
// ช่วง [from, from+span] ว่างทั้งช่วงไหม (ไม่ชนวันไม่ว่าง)
function _spanFree(from) {
  for (let i = 0; i <= _resched.span; i++) if (_resched.booked.has(_addDays(from, i))) return false;
  return true;
}
function _renderResched() {
  const th = lang ==='th', S = _resched;
  const today = new Date(todayStr()+'T00:00:00');
  const dow = th ? ['อา','จ','อ','พ','พฤ','ศ','ส'] : ['S','M','T','W','T','F','S'];
  let cal = '';
  for (let mo = 0; mo < 3; mo++) {
    const base = new Date(today.getFullYear(), today.getMonth()+mo, 1);
    const monthName = base.toLocaleDateString(th?'th-TH':'en-US', { month:'long', year:'2-digit' });
    const first = base.getDay(), days = new Date(base.getFullYear(), base.getMonth()+1, 0).getDate();
    let cells = dow.map(d => `<span class="cdow">${d}</span>`).join('');
    for (let i = 0; i < first; i++) cells += `<span></span>`;
    for (let dn = 1; dn <= days; dn++) {
      const ds = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}-${String(dn).padStart(2,'0')}`;
      const past = new Date(ds+'T00:00:00') < today;
      const ok = !past && _spanFree(ds);                  // วันเริ่มที่จองทั้งช่วงได้
      const inSel = S.pick && ds >= S.pick && ds <= _addDays(S.pick, S.span);
      const cls = past ? 'past' : ok ? 'free' : 'bk';
      const onclick = ok ? ` onclick="pickReschedDate('${ds}')"` : '';
      cells += `<span class="cday ${cls} ${inSel?'sel':''}"${onclick}>${dn}</span>`;
    }
    cal += `<div class="calmonth"><div class="calhd">${monthName}</div><div class="calgrid">${cells}</div></div>`;
  }
  let summary = '';
  if (S.pick) {
    const to = _addDays(S.pick, S.span);
    summary = `<div class="rsd-sum">${th?'รับ':'Use'} <b>${fmtDate(S.pick)}</b> · ${th?'คืน':'Return'} <b>${fmtDate(to)}</b> <i>(${S.span+1} ${th?'วัน':'days'})</i></div>`;
  }
  $('#reschedSheet').innerHTML = `
    <button class="close" onclick="closeResched()">×</button>
    <div class="rsd-head">${th?'เลื่อนวันเช่า':'Reschedule'}</div>
    <div class="rsd-name">${S.name||''}</div>
    <div class="rsd-hint">${th?'เลือกวันรับใหม่จากวันที่ว่าง — ระบบเลื่อนวันคืนให้อัตโนมัติ':'Pick a new start date from the free days — return date moves automatically'}</div>
    <div class="rsd-cal">${cal}</div>
    <div class="callegend"><span><i class="lfree"></i>${th?'ว่าง':'free'}</span><span><i class="lbk"></i>${th?'ไม่ว่าง':'booked'}</span></div>
    <div class="calnote">${th?'วันไม่ว่างรวมเวลาส่ง+ซัก+รีดของชุดด้วย เพื่อให้คุณได้ชุดสะอาดตรงวัน':'Booked days include shipping + cleaning time'}</div>
    ${summary}
    <button class="rvsubmit" id="rsdGo" ${S.pick?'':'disabled'} onclick="confirmResched()">${th?'ยืนยันเลื่อนวัน':'Confirm reschedule'}</button>`;
}
function pickReschedDate(ds) { _resched.pick = ds; _renderResched(); }
function closeResched() { $('#reschedOverlay').classList.remove('open'); document.body.style.overflow =''; _resched = null; const s = $('#reschedSheet'); if (s) s.innerHTML = ''; }
async function confirmResched() {
  if (!_resched || !_resched.pick) return;
  const { rentalId, pick, span } = _resched;
  const to = _addDays(pick, span);
  const btn = $('#rsdGo'); if (btn) { btn.disabled = true; btn.textContent = lang ==='th'?'กำลังเลื่อน…':'Rescheduling…'; }
  const res = await window.API.rescheduleRental(rentalId, pick, to);
  if (!res || !res.ok) {
    const er = res && res.error;
    const m = er ==='limit_reached'?(lang ==='th'?'เลื่อนครบจำนวนครั้งที่กำหนดแล้วค่ะ':'Reschedule limit reached')
      : (er ==='date_unavailable'|| er ==='new_garment_unavailable')?(lang ==='th'?'ชุดเพิ่งถูกจองวันนั้นพอดี ลองวันอื่นนะคะ':'Just got booked — try another date')
      : (lang ==='th'?'เลื่อนไม่สำเร็จค่ะ':'Reschedule failed');
    toast(m);
    if (er ==='date_unavailable'|| er ==='new_garment_unavailable') { return orderReschedule(rentalId); }  // โหลดปฏิทินใหม่
    closeResched(); return;
  }
  closeResched();
  const xtra = (res.fee||0) + (res.extra_charge||0);
  toast(lang ==='th'?(xtra>0?`เลื่อนแล้ว · เก็บเพิ่ม ฿${xtra} (รอชำระ)`:'เลื่อนวันให้แล้ว ฟรีค่ะ'):(xtra>0?`Rescheduled · +฿${xtra}`:'Rescheduled')); openOrders();
}
function reRentByCode(code) {
  const g = GARMENTS.find(x => (x.code || x.id) === code || x.code === code);
  if (!g) { toast(lang ==='th'?'ชุดนี้ยังไม่เปิดให้เช่าในตอนนี้':'This piece is not available right now'); return; }
  closeOrders();
  openDetail(g.id);
}

// กลับไปจ่าย/ส่งสลิปสำหรับออเดอร์ที่ยังค้าง (hold) — เปิดแผงยืนยันเดิมพร้อม QR + ยอดที่ถูกต้อง
async function orderPay(code, useDate, days, name) {
  const g = GARMENTS.find(x => x.code === code) || { name: name || code, code, photo: null };
  const to = addDays(useDate, Math.max(0, (days || 1) - 1));
  let total = null, pay = null;
  try { const tq = await window.API.quote(code, CUSTOMER, useDate, to); if (tq && !tq.error) { const applied = Math.max(0, Math.min(Math.round(CUSTOMER.credit_balance || 0), Math.round((tq.rate || 0) + (tq.shipping || 0)))); total = Math.max(0, Math.round(tq.total - applied)); } } catch (e) { /**/ }
  try { pay = await window.API.payInfo(); } catch (e) { /**/ }
  closeOrders();
  showPayConfirm({ g, date: useDate, total, pay, backups: [] });
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
  // null-safe ทุกช่อง — ฟอร์มสั้น (onboard) ไม่ได้ render ทุกฟิลด์
  if ($('#pName')) CUSTOMER.name = $('#pName').value;
  if ($('#pHeight')) CUSTOMER.height_cm = +$('#pHeight').value || null;
  if ($('#pShoe')) CUSTOMER.shoe_size = $('#pShoe').value;
  if ($('#pBust')) CUSTOMER.bust_in = +$('#pBust').value || null;
  if ($('#pWaist')) CUSTOMER.waist_in = +$('#pWaist').value || null;
  if ($('#pHip')) CUSTOMER.hip_in = +$('#pHip').value || null;
  CUSTOMER.my_color_season = pSeason;
  if ($('#pNotes')) CUSTOMER.notes = $('#pNotes').value;
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
  if (CUSTOMER.terms_accepted_version === terms.version) return; // ยอมรับเวอร์ชันล่าสุดแล้ว (จาก server)
  // guest: ยังไม่ login → save server ไม่ได้ → จำใน localStorage กันเด้งซ้ำ + กันบังปุ่ม login
  let _lsTerms = null; try { _lsTerms = localStorage.getItem('lloop_terms_v'); } catch (e) {}
  if (_lsTerms === terms.version) return;
  _termsVersion = terms.version;
  $('#termsBody').textContent = terms.body;
  $('#termsOverlay').classList.add('open');
  document.body.style.overflow ='hidden';
}
async function acceptTermsClick() {
  $('#termsOverlay').classList.remove('open');
  document.body.style.overflow ='';
  CUSTOMER.terms_accepted_version = _termsVersion;
  try { localStorage.setItem('lloop_terms_v', _termsVersion); } catch (e) {}  // จำฝั่ง client กันเด้งซ้ำ (โดยเฉพาะ guest)
  try { await window.API.acceptTerms(CUSTOMER, _termsVersion); } catch (e) { console.warn(e); }
  maybeOnboard();
}
// ประตูล็อกอินเต็มหน้า — บังคับเข้าสู่ระบบก่อนใช้งานทั้งเว็บ (เรียกตอน boot ถ้าเป็น guest)
function showLoginGate() {
  const gate = $('#loginGate'); if (!gate) return;
  if (lang === 'en') {
    const set = (id, tx) => { const e = $('#' + id); if (e) e.textContent = tx; };
    set('lgTitle', 'Welcome');
    set('lgSub', 'Sign in with LINE to browse pieces and use LLOOP Atelier');
    set('lgBtnLabel', 'Sign in with LINE');
    set('lgNote', 'Signing in means you accept the Terms of Service and Privacy Policy');
  }
  gate.classList.add('open');
  document.body.style.overflow = 'hidden';
}
// ===== ประตู LLOOP Atelier — บังคับล็อกอิน LINE + ยอมรับข้อตกลง ก่อนใช้ฟีเจอร์ AI =====
function _isLoggedIn() {
  if (CUSTOMER && CUSTOMER.id) return true;
  // ใช้ isLoggedIn() แทน getIDToken() เพราะ token อาจหมดอายุแต่ getIDToken ยังคืนค่า
  try { if (window.liff && liff.isLoggedIn && liff.isLoggedIn()) return true; } catch (_e) {}
  return false;
}
// ต้องยอมรับข้อตกลงเวอร์ชันล่าสุดก่อน → ถ้ายังไม่ยอมรับ เปิดให้กดยอมรับแล้วคืน false
async function ensureTermsAccepted() {
  let terms; try { terms = await window.API.getTerms?.(); } catch (_e) { return true; } // ดึงไม่ได้ → ไม่บล็อกการใช้งาน
  if (!terms || !terms.version) return true;
  let ls = null; try { ls = localStorage.getItem('lloop_terms_v'); } catch (_e) {}
  if (CUSTOMER.terms_accepted_version === terms.version || ls === terms.version) return true;
  _termsVersion = terms.version;
  const tb = $('#termsBody'); if (tb) tb.textContent = terms.body;
  $('#termsOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  toast(lang ==='th'?'ยอมรับข้อตกลงก่อนเริ่มใช้ LLOOP Atelier นะคะ':'Please accept the terms to use LLOOP Atelier');
  return false;
}
// ล็อกอิน + ยอมรับข้อตกลง — เรียกหน้าฟีเจอร์ AI ทุกตัว (คืน true เมื่อผ่านทั้งคู่)
async function ensureAtelierAccess() {
  if (!_isLoggedIn()) {
    toast(lang ==='th'?'เข้าสู่ระบบด้วย LINE ก่อนใช้ LLOOP Atelier นะคะ':'Sign in with LINE to use LLOOP Atelier');
    try { window.LiffAuth && LiffAuth.signIn(); } catch (_e) {}
    return false;
  }
  return await ensureTermsAccepted();
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
      <div><b data-to="${im.rentals}">0</b><span>${lang === 'th' ? 'รอบใน loop' : 'rotations'}</span></div>
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

// ===== กล่องแจ้งเตือนในแอป (habit loop — ดึงคนกลับมาเปิดแอป) =====
// map kind + payload → หัวข้อ/รายละเอียดอ่านง่าย (ไทย/อังกฤษ)
function notifText(n) {
  const th = lang === 'th';
  const p = n.payload || {};
  const M = {
    due_soon:        [th?'ใกล้ถึงกำหนดคืน':'Return coming up', th?`"${p.garment||p.name||''}" คืนพรุ่งนี้`:`"${p.garment||p.name||''}" due tomorrow`],
    late:            [th?'เลยกำหนดคืนแล้ว':'Overdue', th?'รบกวนส่งคืนโดยเร็วนะคะ':'Please return soon'],
    credit_expiring: [th?'เครดิตใกล้หมดอายุ':'Credit expiring', th?`เครดิต ฿${p.credit||''} ใช้เช่าได้เลย`:`฿${p.credit||''} credit — use it soon`],
    abandon_checkout:[th?'ชุดรอคุณอยู่':'Your pick is waiting', th?`"${p.name||p.garment||''}" ยังล็อกไว้ให้ — ชำระเพื่อยืนยัน`:`"${p.name||p.garment||''}" still held — pay to confirm`],
    reengagement:    [th?'มีของขวัญรอ ฿30':'฿30 gift inside', th?'นานไม่เจอกัน — เพิ่มเครดิตให้แล้ว':'We missed you — credit added'],
    winback:         [th?'คิดถึงคุณนะคะ':'We miss you', th?'กลับเข้า loop กับ LLOOP':'Come back to the loop'],
    event_suggest:   [th?'แนะนำชุดก่อนงาน':'Outfit ideas for your event', th?'เลือกชุดให้คุณแล้ว เปิดดูได้เลย':'We picked looks for you'],
    review_request:  [th?'ชุดเป็นยังไงบ้างคะ':'How was it?', th?`รีวิว "${p.name||''}" รับเครดิต`:`Review "${p.name||''}" for credit`],
    referral_credit: [th?'ได้เครดิตจากการชวนเพื่อน':'Referral credit', th?`฿${p.amount||''} เข้ากระเป๋าแล้ว`:`฿${p.amount||''} added`],
    birthday:        [th?'ของขวัญวันเกิด':'Birthday gift', th?`เช่าฟรี 1 ชุด มูลค่าถึง ฿${p.value_cap||''}`:`1 free rental up to ฿${p.value_cap||''}`],
    wishlist_available:[th?'ชุดที่หมายตาว่างแล้ว':'Wishlist item available', th?`"${p.name||''}" รีบจองก่อนใคร`:`"${p.name||''}" — book now`, p.code],
    new_arrival:     [th?'ของใหม่ที่น่าจะถูกใจ':'New arrival for you',
                      th?`"${p.name||''}" เพิ่งเข้า${p.season_match?' · เข้ากับโทนสีคุณ':''}`:`"${p.name||''}" just arrived${p.season_match?' · matches your colors':''}`, p.code],
    style_ready:     [th?'สไตลิสต์พร้อมแล้ว':'Your stylist is ready', th?'เลือกชุดที่ใช่ให้คุณแล้ว':'We styled looks for you'],
    charity_update:  [th?'ความสวยที่มีความหมาย':'Beauty that gives back', p.caption||(th?'ขอบคุณที่เป็นส่วนหนึ่งของการให้':'Thank you for giving back')],
  };
  // fallback: อย่างน้อยดึงชื่อชุดจาก payload มาโชว์ แทนการ์ดเปล่า (กัน kind ใหม่ที่ยังไม่ map)
  const name = p.name || p.garment || '';
  return M[n.kind] || [th?'การแจ้งเตือน':'Notification', name?`"${name}"`:'', p.code];
}
function relTime(ts) {
  const th = lang === 'th';
  const diff = (Date.now() - new Date(ts)) / 1000;
  if (diff < 3600) return th ? `${Math.max(1,Math.round(diff/60))} นาทีที่แล้ว` : `${Math.max(1,Math.round(diff/60))}m ago`;
  if (diff < 86400) return th ? `${Math.round(diff/3600)} ชม.ที่แล้ว` : `${Math.round(diff/3600)}h ago`;
  return th ? `${Math.round(diff/86400)} วันที่แล้ว` : `${Math.round(diff/86400)}d ago`;
}
async function refreshUnread() {
  if (!CUSTOMER.id) return;
  const n = await window.API.notifUnread?.() || 0;
  const badge = $('#bellBadge');
  if (badge) { badge.hidden = n <= 0; badge.textContent = n > 9 ? '9+' : String(n); }
}
async function openInbox() {
  const mask = $('#inboxMask'); if (!mask) return;
  mask.classList.add('open');
  const list = $('#inboxList');
  if (list) list.innerHTML = `<div class="ix-empty">${lang==='th'?'กำลังโหลด…':'Loading…'}</div>`;
  // โหลด prefs toggle ให้ตรงสถานะจริง
  const pref = $('#prefMarketing'); if (pref) pref.checked = CUSTOMER.marketing_opt_in !== false;
  const items = await window.API.notifInbox?.() || [];
  if (!items.length) {
    if (list) list.innerHTML = `<div class="ix-empty">${lang==='th'?'ยังไม่มีการแจ้งเตือน':'No notifications yet'}</div>`;
  } else if (list) {
    list.innerHTML = items.map(n => {
      const [title, sub, code] = notifText(n);
      const unread = !n.read_at;
      const tap = code ? ` ix-tap" onclick="openNotifGarment('${esc(code)}')"` : '"';
      return `<div class="ix-item ${unread?'unread':''}${tap}><i class="ix-dot ${unread?'':'read'}"></i>`
        + `<div class="ix-body"><div class="ix-title">${title}</div>`
        + `${sub?`<div class="ix-sub">${sub}</div>`:''}<div class="ix-time">${relTime(n.created_at)}</div></div></div>`;
    }).join('');
  }
  // เปิดกล่อง = ถือว่าอ่านแล้วทั้งหมด
  await window.API.notifMarkRead?.(null);
  refreshUnread();
}
function closeInbox() { $('#inboxMask')?.classList.remove('open'); }
// แตะการ์ดแจ้งเตือนที่อ้างถึงชุด → ปิดกล่อง แล้วเปิดดู/เช่าชุดนั้น
function openNotifGarment(code) { if (!code) return; closeInbox(); reRentByCode(code); }
async function markAllRead() { await window.API.notifMarkRead?.(null); refreshUnread(); $('#inboxList')?.querySelectorAll('.ix-item.unread').forEach(el => { el.classList.remove('unread'); el.querySelector('.ix-dot')?.classList.add('read'); }); }
async function setNotifPref(on) {
  await window.API.notifSetPref?.(on);
  CUSTOMER.marketing_opt_in = on;
  toast(lang==='th' ? (on?'เปิดรับข่าวสารแล้วค่ะ':'ปิดรับข่าวสารแล้ว — ยังได้รับแจ้งเตือนสำคัญอยู่') : (on?'Marketing on':'Marketing off — you still get important alerts'));
}

// scroll depth (25/50/75/100%) + dwell time — สัญญาณ engagement แบบ FB/IG
function setupScrollTracking() {
  const t0 = Date.now();
  let maxDepth = 0;
  const marks = { 25: false, 50: false, 75: false, 100: false };
  window.addEventListener('scroll', () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    if (h <= 0) return;
    const pct = Math.min(100, Math.round(window.scrollY / h * 100));
    if (pct > maxDepth) maxDepth = pct;
    [25, 50, 75, 100].forEach(m => { if (pct >= m && !marks[m]) { marks[m] = true; window.track?.('scroll_depth', null, { depth: m }); } });
  }, { passive: true });
  const sendDwell = () => { window.track?.('dwell', null, { ms: Date.now() - t0, max_depth: maxDepth }); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) sendDwell(); });
  window.addEventListener('pagehide', sendDwell);
}

async function boot() {
  $('#langTH')?.classList.toggle('on', lang ==='th');
  $('#langEN')?.classList.toggle('on', lang ==='en');
  document.querySelectorAll('.langbtn').forEach(b => b.classList.toggle('on', b.dataset.l === lang));
  document.querySelectorAll('.curbtn').forEach(b => b.classList.toggle('on', b.dataset.cur === cur));
  updateCurNote(); refreshFx();
  applyStatic();
  setupHeroVideo();
  let s;
  try { s = await window.API.init(); }
  catch (e) { console.warn('init failed, fallback to mock', e); s = window.MOCK; }
  OCCASIONS = s.OCCASIONS; CUSTOMER = s.CUSTOMER; EVENT = s.EVENT; GARMENTS = s.GARMENTS;
  normalizeGarmentColors();   // เติมเฉดสีให้ชุดที่ยังไม่ได้แท็กสี → แถบกรองสีเลือกได้จริง
  STAFF_PCT = Number(s.staff_pct) || 0;   // พนักงาน → โชว์ราคาลด + ป้าย
  VENUES = window.MOCK.VENUES;
  // มีโปรไฟล์ (ไซส์/โทนสี/สไตล์จากพาร์ทเนอร์) เปิด"แนะนำสำหรับคุณ"เป็นค่าเริ่มต้น
  fForYou =!!(CUSTOMER.bust_in!= null || CUSTOMER.my_color_season || (CUSTOMER.style_profile && Object.keys(CUSTOMER.style_profile).length));
  // สถานะล็อกอิน: มี lineUid = ล็อกอินผ่าน LINE แล้ว → โชว์เครดิตจริง; ไม่มี = guest → โชว์ปุ่มเข้าสู่ระบบ
  const loggedIn =!!s.lineUid;
  // บังคับล็อกอินทั้งเว็บก่อนใช้งาน (เว้นโหมดเดโม/localhost) — guest เห็นแค่ประตูล็อกอิน ไม่โหลด/ไม่ track ต่อ
  const _isLocalDev = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);
  if (!loggedIn && !(window.CONFIG && CONFIG.USE_MOCK) && !_isLocalDev) { showLoginGate(); return; }
  const loginBtn = $('#loginBtn'); const creditEl = document.querySelector('.credit');
  if (loginBtn) loginBtn.hidden = loggedIn;
  if (creditEl) creditEl.hidden =!loggedIn;
  const bellBtn = $('#bellBtn'); if (bellBtn) bellBtn.hidden = !loggedIn;
  if (loggedIn) refreshUnread();
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
  // เครดิตใกล้หมดอายุ: โชว์ banner กระตุ้นให้กลับมาใช้
  // กันเหนียว: รีเซ็ตซ่อน+ล้างข้อความก่อนเสมอ แล้วโชว์เฉพาะเมื่อมีเครดิตจริง + ข้อความไม่ว่าง
  const _eb = $('#expiryBanner'), _em = $('#expiryMsg');
  if (_eb) _eb.hidden = true;
  if (_em) _em.innerHTML = '';
  if (loggedIn) {
    try {
      const expiry = await window.API.creditExpiry?.();
      const amt = expiry ? Math.round(Number(expiry.amount) || 0) : 0;  // jsonb numeric อาจมาเป็น string
      if (amt > 0 && expiry.expires_at && _eb && _em) {
        const daysLeft = Math.max(1, Math.ceil((new Date(expiry.expires_at) - Date.now()) / 86400000));
        const dayStr = lang === 'th' ? (daysLeft <= 1 ? 'พรุ่งนี้' : `${daysLeft} วัน`) : (daysLeft <= 1 ? 'tomorrow' : `${daysLeft} days`);
        _em.innerHTML = lang === 'th'
          ? `เครดิต <b>฿${amt}</b> หมดอายุใน <b>${dayStr}</b> — ใช้เช่าชุดก่อนนะคะ`
          : `<b>฿${amt}</b> credit expires in <b>${dayStr}</b>`;
        if (_em.textContent.trim()) _eb.hidden = false;  // โชว์เฉพาะเมื่อมีข้อความจริง
      }
    } catch (e) { if (_eb) _eb.hidden = true; }
  }
  window.track?.('session_start', null, { logged_in: loggedIn, tier: CUSTOMER.crm_tier || 'guest' });
  setupScrollTracking();
  setupGridLazyLoad();
  const si = $('#searchInput'); if (si) si.placeholder = lang === 'th' ? 'ค้นหาชุด แบรนด์ หรือโอกาส…' : 'Search dresses, brands, occasions…';
  if (loggedIn) { try {
    await window.flushEvents?.();
    CUSTOMER._streak = await window.API.myStreak?.() || 0;
    // แนะนำเฉพาะบุคคล (collaborative — "คนเหมือนคุณเช่า") → ดันขึ้นบนสุดในแท็บ "แนะนำสำหรับคุณ"
    gPersonalRecs = (await window.API.recommendPersonal?.(8) || []).map(r => r.code).filter(Boolean);
    CUSTOMER._taste = await window.API.myTaste?.();  // รสนิยมที่เรียนจากพฤติกรรม → ใช้ใน personalScore
    gRecentViewed = await window.API.myRecentlyViewed?.(12) || [];  // "ดูล่าสุด" (Shopee-style)
  } catch (e) { /**/ } }
  loadCart(); renderCartBtn();   // กู้ตะกร้าที่ค้างไว้ (กัน refresh แล้วของหาย)
  renderEvent(); renderCatnav(); renderChips(); renderDiscover(); renderFilters(); renderDatebar(); renderGrid();
  renderPersonalRail();   // "ดูล่าสุด" + "เพราะคุณดู X" (เงียบถ้ายังไม่มีข้อมูล)
  if (window.renderSpotlight) window.renderSpotlight(GARMENTS);
  const vd = $('#venueDate'); if (vd) { vd.min = todayStr(); vd.value = gUseDate || ''; }
  refreshStylistQuota();
  await maybeShowTerms();
  maybeOnboard();
  routeDeepLink();
  applyPendingReferral();
}
// มาจาก flex ที่แชร์ลิงค์สถานที่เข้า LINE → เติมสถานที่ให้ + เปิดสไตลิสต์ทันที
async function startVenueFromLink(pid, name) {
  const el = $('#venueInput');
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (name) el.value = name; }
  const r = $('#vresult'); if (r) { r.className = 'vresult show'; r.innerHTML = `<span class="note">${lang==='th'?'กำลังเตรียมสถานที่ที่คุณแชร์มา…':'Setting up the place you shared…'}</span>`; }
  try {
    // pid → ดึงรายละเอียดเต็ม (รูป+โทน) ; ถ้าไม่มี pid ก็ใช้ชื่อค้นต่อ
    const rp = pid ? await window.API.resolvePlace({ place_id: pid }) : null;
    if (rp && rp.ok && rp.place && rp.place.name) {
      window.SELECTED_PLACE = rp.place;
      if (el) el.value = rp.place.name;
    } else if (name) {
      window.SELECTED_PLACE = null;   // ปล่อยให้ askVenue ค้นจากชื่อ
    }
  } catch (_e) { /* ปล่อยให้ askVenue จัดการต่อ */ }
  if (typeof askVenue === 'function') askVenue();
}

// rich menu deep-link: เปิด LIFF ?go=menu|foryou|orders|impact|profile|stylist แล้วเด้งไปหน้านั้น
function routeDeepLink() {
  try {
    const qs = new URLSearchParams(location.search);
    const ls = (window.liff && liff.state) ? new URLSearchParams((liff.state || '').replace(/^\?/, '')) : null;
    // deep-link จากการ์ด LINE: ?garment=CODE → เปิด detail ของชุดนั้นทันที
    const gcode = qs.get('garment') || (ls && ls.get('garment'));
    // มาจากฟีดชุมชน (?look=ID) → log attribution ให้ครีเอเตอร์ได้ส่วนแบ่งเมื่อเช่าตาม
    const lookId = qs.get('look') || (ls && ls.get('look'));
    if (lookId && window.API && window.API.logLookView) { try { window.API.logLookView(lookId, gcode); } catch (e) {} }
    // มาจากลิงก์ชวนเช่าของครีเอเตอร์ (?ref=handle) → log affiliate (แชร์นอกแอปก็ได้เครดิต)
    const ref = qs.get('ref') || (ls && ls.get('ref'));
    if (ref && window.API && window.API.logRef) { try { window.API.logRef(ref, gcode); } catch (e) {} }
    if (gcode) {
      const g = GARMENTS.find(x => (x.code || '').toLowerCase() === gcode.toLowerCase());
      // ?date=YYYY-MM-DD (จากการ์ด waitlist "ถึงคิวคุณ") → เปิด detail พร้อมเติมวันที่ให้เลย
      const wd = qs.get('date') || (ls && ls.get('date'));
      if (wd && /^\d{4}-\d{2}-\d{2}$/.test(wd)) gUseDate = wd;
      if (g) { setTimeout(() => openDetail(g.id), 80); return; }
    }
    // โค้ดชวนเพื่อนจากลิงก์ (?ref=CODE) เช่น แชร์ผ่านการ์ดเกม → ใช้อัตโนมัติเมื่อ login (เครดิต ฿200 ทั้งคู่ เข้ากระเป๋า LLOOP)
    if (ref) { try { localStorage.setItem('lloop_ref', ref.trim()); } catch (_e) {} applyPendingReferral(); }
    // มาจากการ์ดเกม quiz.html (?occasion=KEY&mood=...) → จำโอกาสไว้ให้ LLOOP Atelier ใช้ + กรองคลังให้ตรงงาน
    const occ = qs.get('occasion') || (ls && ls.get('occasion'));
    if (occ && OCCASIONS && Object.prototype.hasOwnProperty.call(window.I18N[lang].occ || {}, occ)) {
      window.gQuizOccasion = occ;
      window.gQuizMood = qs.get('mood') || (ls && ls.get('mood')) || '';
      try { setOccasion(occ); } catch (_e) {}
    }
    let go = qs.get('go') || (ls && ls.get('go'));
    if (!go) return;
    // แชร์ลิงค์สถานที่เข้า LINE → flex → ปุ่มพากลับเข้า LIFF พร้อม place id (pid) + ชื่อ (v)
    const pid = qs.get('pid') || (ls && ls.get('pid'));
    const pv = qs.get('v') || (ls && ls.get('v'));
    setTimeout(() => {
      if (go === 'stylist' && (pid || pv)) { startVenueFromLink(pid, pv); return; }
      if (go === 'menu') openMenu();
      else if (go === 'foryou') { if (!fForYou) toggleForYou(); }
      else if (go === 'orders') openOrders();
      else if (go === 'membership') openMembership();
      else if (go === 'impact') openImpact();
      else if (go === 'profile') openProfile();
      else if (go === 'cart') openCart();
      else if (go === 'verify' || go === 'kyc') openKyc('');
      else if (go === 'stylist') {
        const el = $('#venueInput'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        // มาจากการ์ดเกมพร้อมโอกาสแล้ว → ชวนเลือกวันที่ต่อ + เช็ก/โชว์โควต้า LLOOP Atelier ที่เหลือ
        if (window.gQuizOccasion) {
          const di = $('#venueDate'); if (di) di.classList.add('need');
          (async () => {
            const r = $('#vresult'); if (!r) return;
            let n = null; try { n = await window.API.stylistQuota?.(); } catch (_e) {}
            const th = lang === 'th';
            const head = th ? 'เลือกจาก “'+occName(window.gQuizOccasion)+'” แล้ว' : 'Picked “'+occName(window.gQuizOccasion)+'”';
            const body = th ? 'พิมพ์สถานที่ที่จะไป แล้วเลือกวันที่ — สไตลิสต์จะเลือกชุดที่ว่างวันนั้นให้' : 'Type where you’re headed and pick a date — we’ll style you with what’s free that day';
            let quota;
            if (n == null) quota = th ? 'เข้าผ่าน LINE เพื่อใช้สิทธิ์สไตลิสต์' : 'Sign in via LINE to use the stylist';
            else if (n <= 0) quota = th ? 'สิทธิ์สไตลิสต์รอบนี้หมดแล้ว — ดูชุดในคลังเองได้เลย หรือรอรอบสิทธิ์ถัดไป' : 'No stylist credits left this round — browse freely or wait for the next cycle';
            else quota = th ? `ขั้นนี้ใช้สิทธิ์สไตลิสต์ 1 ครั้ง · คุณเหลืออีก <b style="color:var(--ok)">${n}</b> ครั้ง` : `This uses 1 stylist credit · you have <b style="color:var(--ok)">${n}</b> left`;
            r.className = 'vresult show';
            r.innerHTML = `<div class="note"><b style="color:var(--ink)">${head}</b><br>${body}<br><span style="color:var(--clay,#A75F3A)">${quota}</span></div>`;
          })();
        }
      }
    }, 80);
  } catch (_e) { /**/ }
}
boot();
