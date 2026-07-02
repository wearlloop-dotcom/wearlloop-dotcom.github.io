# บันทึกการแก้ไขจาก Audit — WEARLLOOP

> 2 ก.ค. 2026 · กระจาย 54 agent (1 ไฟล์/agent) แก้เฉพาะที่ปลอดภัยฝั่ง client · JS+inline JS ผ่าน syntax ทุกไฟล์

**แก้แล้ว 83 · เลื่อนไป backend/infra/product 47 · ไม่ใช่บั๊ก 5** (45 ไฟล์เปลี่ยน)

push ยังติด integration read-only — งานทั้งหมด commit บน branch `claude/end-to-end-role-audit-csf29q`

---

## ✅ แก้แล้ว (client-safe)

### `about.html`
- about.html:244 แก้ href และข้อความปุ่มจาก https://www.instagram.com/lloop.studio / IG @lloop.studio เป็น https://www.instagram.com/lloop.th / IG @lloop.th ให้ตรงกับ links.html:406 ที่ใช้ instagram.com/lloop.th เป็นบัญชีหลัก

### `accounting.html`
- ยืนยันว่า ops-menu.js expose แค่ window.opsMenu.mount และไม่ auto-mount (ops-menu.js:97-134) เพิ่มบรรทัด <script>window.opsMenu&&window.opsMenu.mount();</script> ต่อจาก <script src="ops-menu.js"></script> ที่ท้ายไฟล์ (บรรทัด 284) ตามแพทเทิร์นเดียวกับหน้าหลังบ้านอื่น เมนู ☰ จะ mount ได้แล้ว

### `analytics.html`
- เลือกทางแก้ฝั่ง client ที่ปลอดภัย (ติดป้ายให้ชัด) — เปลี่ยน label 'รายได้ 30 วัน' → 'รายได้จากโฆษณา 30 วัน' ทั้งใน pill (บรรทัด 342) และ hero KPI hero_rev (บรรทัด 163) เพื่อสื่อว่าเป็นรายได้ที่ระบุจากโฆษณา ไม่ใช่รายได้บัญชีจาก ledger. ไม่แตะ RPC mkt_overview (การให้ดึง revenue จาก ledger เป็นงาน backend).
- บรรทัด 490: เปลี่ยน body:'{}' → body:JSON.stringify({id_token:(window.opsIdToken?window.opsIdToken():'')}) ให้เหมือน marketing-ai ในไฟล์เดียวกัน (บรรทัด 412) ตาม contract id_token ที่ระบบใช้ gate edge functions อยู่แล้ว. เป็นการแก้ฝั่ง client (แนบวัตถุดิบให้ server ตรวจ role) โดยไม่เปลี่ยน action name หรือ contract; ส่วนการ verify id_token ต้องทำที่ edge function (backend).

### `api.js`
- ใน init() บล็อก if(lineUid) เพิ่มการตั้ง customer ตั้งต้นจากโปรไฟล์ LINE จริงก่อนเรียก me_profile: customer = { display_name: profile.displayName, picture_url: profile.pictureUrl, credit_balance: 0, profile_load_failed: true } ทำให้เมื่อ me_profile ล้มเหลว (if(data)customer=data ไม่ทำงาน) customer จะเป็นโปรไฟล์ว่างเครดิต 0 ไม่ใช่ MOCK.CUSTOMER อีกต่อไป จึงไม่มี ฿160/หุ่น 'คุณมายา' รั่ว และมี flag profile_load_failed ให้ UI ตรวจได้ (การแสดงข้อความ 'โหลดโปรไฟล์ไม่สำเร็จ' อยู่ฝั่ง app.js ซึ่งเป็นอีกไฟล์)
- เปลี่ยนบรรทัด 69 จาก let customer = window.MOCK.CUSTOMER; เป็น const MOCK = window.MOCK || {}; let customer = MOCK.CUSTOMER || {}; และบรรทัด return เปลี่ยน OCCASIONS: window.MOCK.OCCASIONS เป็น OCCASIONS: MOCK.OCCASIONS || {} — guard กัน TypeError เมื่อ data.js ไม่ถูกโหลด init จึงทำงานต่อในโหมด live ได้ ไม่ตก catch ไปโหมด mock (บรรทัด 61 return {...window.MOCK} อยู่ในเส้นทาง USE_MOCK เท่านั้น และ {...undefined} ปลอดภัยอยู่แล้ว จึงไม่แตะ; mock path ใน stylist() ก็รันเฉพาะ USE_MOCK ไม่กระทบ). ไม่ได้เพิ่ม <script data.js> ในไฟล์ HTML เพราะกฎให้แก้เฉพาะ api.js

### `app.js`
- เพิ่มคีย์ ems:'https://track.thailandpost.co.th/?trackNumber=' ใน COURIER_TRACK (บรรทัด ~2958) ให้ตรงกับ courier vocabulary 'ems' ที่ quote รองรับ trackUrl จะคืนลิงก์ได้แล้ว
- เพิ่ม let _reserving=false + จับ #bookBtn disable ตอนเริ่ม แล้วห่อ body ด้วย try/finally คืนสถานะ (_reserving=false, btn.disabled=false) ตามแพตเทิร์นเดียวกับ bookCartNow กัน bookWithBackups/payWithCredit ยิงซ้ำ
- ใน reserve เปลี่ยนจาก freeRange===false → checkAvail(id) (เช็กวันแรกซ้ำ โชว์ 'ว่าง' วนลูป) เป็นแสดงข้อความชัด 'ช่วงเช่า X–Y มีบางวันไม่ว่าง ลองสั้นลง/เลื่อนวัน' + toast แทน
- เพิ่ม let _bdayBooking=false + จับ .bdaybtn disable ตอนเริ่ม แล้วห่อ body ด้วย try/finally คืนสถานะ กัน birthdayReserve ยิงซ้ำก่อน window.BDAY ถูกเคลียร์
- เพิ่ม const _cancellingRentals=new Set() เป็น in-flight lock ต่อ rentalId (guard re-entry + try/finally ลบออก) กันกดซ้ำยิง cancel_rental ซ้ำฝั่ง client. หมายเหตุ: ส่วน idempotency key ไป backend เป็นของ backend ไม่ได้แตะ
- เพิ่ม const _cancellingAppts=new Set() lock ต่อ id + try/finally กัน pcCancelAppointment ยิงซ้ำแล้ว toast 'ยกเลิกไม่สำเร็จ' สับสน
- ใน catch ของ pickExtendDate เปลี่ยนจาก _extend.charge=0 เป็น charge=null + pick=null (ปุ่มยืนยัน disabled ตามเงื่อนไข S.charge!=null) และเพิ่ม toast 'คำนวณราคาไม่สำเร็จ ลองใหม่'
- เพิ่ม else หลัง if(g) ใน routeDeepLink: เมื่อมี gcode แต่หา g ไม่เจอ แสดง toast 'ชุดนี้ไม่ว่างตอนนี้ — ลองดูชุดคล้ายกัน' แทนตกหน้าแรกเงียบ
- เปลี่ยนเงื่อนไขจาก if(!CUSTOMER._impact) เป็น if(!loggedIn && !CUSTOMER._impact) — ใส่ค่า demo เฉพาะตอนยังไม่ล็อกอินจริง (dev/mock) ไม่ยัดให้ลูกค้าจริงที่ my_impact null
- แก้ gridCardHtml เป็น ${g.occasion_tags[0] ? occName(g.occasion_tags[0]) : ''} กัน occName(undefined) แทรกคำว่า undefined ลง hover bar
- เพิ่ม renderDatebar(); renderPersonalRail(); if(window.renderSpotlight) window.renderSpotlight(GARMENTS); ใน setLang. หมายเหตุ: ข้อความ spotlight hardcode ไทยอยู่ใน index.html แก้ที่ app.js ไม่ได้ (คนละไฟล์)
- เพิ่ม window._detailSeq เพิ่มค่าใน openDetail และให้ loadRating/loadFit/loadSocialProof/loadRecommendWith/renderAvailCalendar capture _seq ก่อน await แล้วเช็ค if(_seq!==window._detailSeq) return; ก่อนเขียน DOM กัน response ชุดก่อนเขียนทับชีตชุดปัจจุบัน

### `case-file.html`
- เพิ่ม map แปลไทย 2 ตัวหลัง baht (บรรทัด ~52): cStatusTh (อ้าง contracts.html:292 pill: draft/sent/viewed/signed/declined/void→ฉบับร่าง/รอลงนาม/เปิดอ่าน/ลงนามแล้ว/ขอแก้ไข/ยกเลิก) และ rStatusTh (อ้าง app.js:2976 rentalStatusLabel: reserved/hold/out/returned/cancelled/backup→จองแล้ว/รอชำระเงิน/จัดส่ง-กำลังใช้/คืนแล้ว/ยกเลิก/ชุดสำรอง). แก้ renderCustomer rentals: esc(o.status)→esc(rStatusTh(o.status)); แก้ renderContract: esc(c.status)→esc(cStatusTh(c.status)). ยังคง esc() ครอบเพื่อกัน XSS และ fallback ค่าที่ไม่รู้จัก/null เดิม

### `creator.html`
- เพิ่มฟังก์ชัน esc() (escape &<>"') และ gigName(gigId) แบบหน้า ops. เปลี่ยนทุก onclick ให้ส่งแค่ gig_id ไม่ฝัง string ชื่อ: claim('${g.gig_id}') (บรรทัดเดิม 102,113), submitAndAudit('${gigId}') (เดิม138), uploadView('${gigId}') (เดิม189). ฟังก์ชัน claim/uploadView/submitAndAudit/showAudit ตัด param name ออก โดย uploadView lookup ชื่อจาก gigName() เอง. จุด render ชื่อทั้งหมดหุ้ม esc(): ph placeholder+name (เดิม97,99), mine name (เดิม110), หัวข้อ upload (เดิม132). ชื่อที่มี " หรือ ' ไม่ทำ handler พังและไม่หลุด HTML แล้ว. gig_id ยังฝังใน quote ตามเดิมเพราะเป็น system id ไม่มี quote
- ทำ guard ฝั่ง client ล้วน ไม่แตะ contract: เพิ่ม state submittedAsset. หลัง ugc_submit สำเร็จจำ {gig,id}. ถ้า ugc-audit ล้ม (catch คืน #go) แล้วกดใหม่ด้วยรูปเดิม → reuse asset เดิมยิงเฉพาะ ugc-audit ไม่สร้าง asset ใหม่. เคลียร์ submittedAsset เมื่อ audit สำเร็จ, เมื่อเลือกรูปใหม่ใน onPick (ตั้งใจส่งรูปใหม่=ยอมสร้าง asset ใหม่ = พฤติกรรมเดิม ไม่ regression), และเมื่อเข้า uploadView งานใหม่. ครอบเฉพาะเคส same-file retry ที่เป็น trigger ในรายงาน. หมายเหตุ: idempotency สมบูรณ์ (เช่นส่งคนละรูปซ้ำ/reload) ยังต้องพึ่ง backend idempotency key หรือให้ ugc_submit คืน asset submitted เดิม ซึ่งอยู่นอกขอบเขต client

### `csv.html`
- แก้เฉพาะส่วนคอลัมน์ที่ทำได้ใน csv.html: (บรรทัด 69) เพิ่มคีย์ที่ขาดเข้า COLS ให้ตรงกับ payload ของ RPC intake_garment ที่ intake.html:174-184 ใช้อยู่จริง — เพิ่ม 'size','condition' (ต่อจาก tier) และ 'acquisition_cost','rate_1d','rate_3d','rate_5d' (ต่อจาก rental_price). และ (บรรทัด 81) เติมค่าตัวอย่างใน template ให้ครบคีย์ใหม่ (size:'M',condition:'good',acquisition_cost:'450',rate_1d/3d/5d:'' = auto) เพื่อให้ header template/round-trip ครบ. import forward ทุกคอลัมน์อยู่แล้วผ่าน p={...r} ปลอดภัย ไม่เปลี่ยน contract. ตรวจ syntax array/object วงเล็บ+quote ครบ.

### `disputes.html`
- markDemandSent (เดิมยิงแค่ dispute_event kind=demand_sent) เพิ่มการเรียก dispute_update (action ที่มีอยู่แล้ว ใช้เหมือน saveUpdate) ตั้ง status='notice_sent' ต่อท้าย. ใส่ guard if(CUR.status==='open') ให้เลื่อนสถานะเฉพาะตอนยัง 'เปิด' เพื่อไม่ให้คดีที่ก้าวหน้ากว่า (police/court) ถอยหลัง และ preserve police_report_no/court_case_no เดิมกัน backend null ทับ. ไม่เปลี่ยน contract
- บรรทัด renderDetail <span class="badge"> เพิ่มเงื่อนไข ${['police','court'].includes(c.status)?'red':''} ให้ตรงกับ badge ใน renderList (บรรทัด 180) แก้ระดับ class/badge ฝั่ง client ล้วน
- ในลูป qcPhotos เพิ่ม const other=arr.filter(phase ไม่ใช่ before/after) แล้วต่อคอลัมน์ 'อื่น ๆ' แบบมีเงื่อนไข (other.length?col(...):'') รูป phase ว่าง/แปลกจะไม่หายไป และเมื่อไม่มีก็ไม่กระทบ layout เดิม

### `event.html`
- แก้ 2 จุดในขอบเขต event.html: (1) เพิ่ม <script src="data.js?v=38"></script> ก่อน liffAuth.js (บรรทัด 158) ให้ตรงกับ family.html:271 และ group-checkout.html:278 → window.MOCK มีค่าตอน api.js init() เข้าเส้นทาง non-mock ไม่โยน TypeError อีก หน้าจึงเข้าโหมด LIVE ได้จริง (หมายเหตุ: api.js:69-72,117 ก็ถูก agent อื่น guard ด้วย window.MOCK||{} แล้ว เป็น defense-in-depth). (2) แก้ demo note บรรทัด 152 ทั้งข้อความไทยและ data-i18n อังกฤษ จาก 'liff/api.js' → 'api.js' (ซากจากการย้าย liff/ → root ไฟล์จริงคือ /api.js). เลือก ?v=38 ให้ตรงกับสองหน้าพี่น้องที่ลิงก์เข้ามา ไม่แตะไฟล์อื่น ไม่เปลี่ยน contract backend.

### `family.html`
- family.html:443-445 แยกเช็ค cancel ก่อน trim: เปลี่ยนจาก `const name=(prompt(...)||'').trim(); if(name===null) return;` เป็น `const raw=prompt(...); if(raw===null) return; const name=raw.trim();` ตอนนี้กด Cancel จะ return ก่อน ไม่สร้างกลุ่มขยะ
- family.html:965 หลัง unwrap(joinGroup) เพิ่ม `if(r && r.error){ toast(friendlyErr(r.error)); } else {...}` ตาม convention เดียวกับ groupInvite (:898) เพื่อรับ error ระดับข้อมูลเช่น expired ที่ gateway ไม่ throw; และ family.html:845 openInvite/groupJoinToken เพิ่มเช็ค `if(data && data.error){ โชว์ 'สร้างลิงก์ไม่สำเร็จ'; inviteUrl=''; return; }` กันประกอบ URL token ว่างไปแชร์
- family.html:960-976 เมื่อ LIVE=false และมี token: เก็บลง sessionStorage('lloop_pending_join') แล้ว confirm ชวนเข้าสู่ระบบ → เรียก LiffAuth.signIn() (มีจริงใน liffAuth.js:33) redirect ไป LINE login; ฝั่ง LIVE เพิ่มอ่าน token จาก sessionStorage เป็น fallback (เพราะ signIn ใช้ baseUrl ตัด query ทิ้ง) แล้ว removeItem ก่อน process. เป็น client-safe ล้วน ไม่แตะ backend/contract

### `g.html`
- แก้ readCode() (เดิม ~บรรทัด 130): (1) เพิ่มอ่าน liff.state แบบเดียวกับ pay.html เผื่อกลับจาก LIFF deep-link รหัสถูกห่อใน liff.state; (2) เพิ่ม persist รหัสลง sessionStorage('gCode') เมื่อมี ?c และ fallback อ่านคืนจาก sessionStorage เมื่อ ?c หาย — กันเคส signIn redirect กลับมาด้วย baseUrl ที่ตัด query ทิ้ง ทำให้ไม่ dead-end อีก. เป็น client-side ล้วน ไม่แตะ liffAuth.js (ไฟล์อื่น) และไม่เปลี่ยน contract.
- แก้ onPick() (เดิม ~บรรทัด 227-230): เพิ่ม guard ก่อนเรียก window.API.quote — ถ้า !(CUSTOMER && CUSTOMER.id) ให้ข้าม quote (กัน me-api reauth() เด้ง liff.login) แล้วแสดงข้อความ 'เข้าสู่ระบบด้วย LINE เพื่อดูสรุปยอดและจองค่ะ' แทน. availMsg free/busy ยังทำงานปกติ, ปุ่ม bookBtn เป็น null สำหรับผู้ไม่ล็อกอินอยู่แล้วซึ่ง code ปลายทางเช็ค if(btn) รองรับไว้แล้ว. client-side ล้วน ไม่แตะ me-api.js.

### `garment.html`
- เพิ่มตาราง map สถานะไทย GST หลัง EVT (บรรทัด 78) โดยใช้คีย์/คำแปลชุดเดียวกับ stock.html (ST_TH) และ putaway.html (ST) เช่น cleaning='กำลังซัก', returned='รับคืนแล้ว', needs_review='รอตรวจ', retired='ปลดระวาง' ฯลฯ แล้วแก้บรรทัด 106 จาก `สถานะ: ${esc(g.status)}` เป็น `สถานะ: ${esc(GST[g.status]||g.status)}` (fallback เป็นค่าดิบพร้อม esc กัน XSS). ไม่แตะ EVT/gradePill ที่ map ครบอยู่แล้ว. syntax ครบ.

### `group-checkout.html`
- บรรทัด ~964: เปลี่ยนจากสร้าง <a href=event.html?event=${res.event_group||''}> เสมอ → render ปุ่มแบบมีเงื่อนไข ${res.event_group?`<a ... href=event.html?event=${esc(res.event_group)}>...`:''} ถ้าไม่มี event_group จะซ่อนปุ่ม เหลือแค่ปุ่ม 'กลับหน้ากลุ่ม' (family.html) แทนลิงก์ param ว่าง.
- เติมสถานะจาก SEL ตอน renderAssign สร้าง HTML 4 จุด: บรรทัด ~730 .look เพิ่ม class ${SEL[id]?'has':''}; บรรทัด ~734 #lpick เติมข้อความ ${SEL[id]?NAV.t('เลือกแล้ว','Selected'):''}; บรรทัด ~742 .pick เพิ่ม class ${SEL[id]===p.code?'sel':''}; บรรทัด ~752/757 .shipctl (ทั้ง split และ host) เพิ่ม class ${SEL[id]?'show':''} (replace_all). ตอนนี้หลัง re-render ติ๊กถูก/เลือกแล้ว/แถวส่งจะโชว์ตรงกับ SEL. renderShipping()+refreshSummary() ท้ายฟังก์ชันคืน boxsel/summary อยู่แล้ว.

### `hr.html`
- บรรทัด 224 แก้จาก const STAFF_BASE=(location.origin.includes('http')?location.origin:'https://lloop.app').replace('lloop-ops','lloop')+'/liff/staff.html'; เป็น const STAFF_BASE=location.origin+'/staff.html'; เพราะ staff.html ย้ายมาอยู่ที่ repo root แล้ว ไม่มีโฟลเดอร์ liff/ · ตัวแปรนี้ยังถูกใช้สร้าง verifyUrl และลิงก์สัญญาจ้างเหมือนเดิม (STAFF_BASE+'?token=...' / STAFF_BASE+'?ec=...') แค่ base เปลี่ยนเป็น path ที่ถูก

### `index.html`
- index.html:1358 เปลี่ยน `language: (window.lang === 'en' ? 'en' : 'th')` เป็น `language: (localStorage.getItem('lloop_lang') === 'en' ? 'en' : 'th')` เพราะ lang ใน app.js:51 ประกาศด้วย `let` ที่ top-level จึงไม่เป็น property ของ window (window.lang = undefined เสมอ) ตอนนี้อ่านคีย์ lloop_lang จาก localStorage ตรง ๆ ตรงกับ pattern app.js:51 ที่ใช้อยู่แล้ว ผู้ใช้ EN จะได้ผลค้นหาสถานที่เป็นภาษาอังกฤษ ไม่แตะไฟล์อื่นและไม่เปลี่ยน contract

### `influencers.html`
- แก้ปุ่มบรรทัด 460 จาก onclick="saveDeal()" เป็น saveDeal(this) และแก้ saveDeal ให้รับ btn: หลังผ่าน validation แล้ว btn.disabled=true ก่อน await sb.rpc('collab_upsert') แล้วครอบ await ด้วย try/finally เพื่อคืน btn.disabled=false เสมอ (เหมือน gcreate). กันกดปุ่มบันทึกรัวตอนสร้างดีลใหม่ (ที่ p ไม่มี id → insert ซ้ำ). ไม่แตะ contract กับ backend, syntax วงเล็บ/quote ครบ

### `intake.html`
- intake.html:160 แก้ Authorization:'Bearer'+SUPABASE_KEY เป็น Authorization:'Bearer '+SUPABASE_KEY (เพิ่มช่องว่าง) ให้ค่า header เป็น 'Bearer sb_...' ถูกต้องตาม RFC และตรงกับ seller.html:194 แก้อาการ 401 ที่ทำให้เข้า catch ตลอด

### `join.html`
- แก้ฝั่ง client ใน join.html เท่านั้น (ไม่แตะ liffAuth.js): (1) ใน doJoin ก่อนเรียก window.LiffAuth.signIn() เพิ่ม stash token ลง sessionStorage — `try{ if(TOKEN) sessionStorage.setItem('joinToken', TOKEN); }catch(_e){}`; (2) ใน readToken() เพิ่ม fallback อ่านคืนจาก sessionStorage เมื่อ URL ไม่มี token (หลัง redirect) แล้ว removeItem ทันทีเพื่อกัน token ค้าง (one-shot) — `if(!t){ try{ t=sessionStorage.getItem('joinToken')||null; if(t) sessionStorage.removeItem('joinToken'); }catch(_e){} }`. หลัง LINE login กลับมา readToken จึงกู้ token ได้ preview/join ทำงานต่อได้ ไม่เด้ง edge state ผิด

### `labels.html`
- แก้บรรทัด 63 QR_BASE จาก 'https://lloop.app/g/' เป็น 'https://wearlloop-dotcom.github.io/g.html?c=' ให้ตรงกับ intake.html:134 และ care-label.html:97 (ยืนยันแล้วว่า g.html:132 อ่าน ?c= หรือ ?code=) เป็นการแก้ค่าคงที่ที่ผิดฝั่ง client ไม่เปลี่ยน contract กับ backend ส่วน shipout.html/scan.js อยู่ไฟล์อื่น ไม่ได้แตะ

### `laundry-shops.html`
- แก้ที่ loadVendors() (เดิมบรรทัด 137): เก็บ const curVendor=$('wsVendor').value ก่อนเขียนทับ innerHTML แล้ว restore ด้วย if(curVendor && [...$('wsVendor').options].some(o=>o.value===curVendor)) $('wsVendor').value=curVendor; ทำให้ร้านที่เลือกไว้ค้างอยู่หลังส่งซัก ตรงกับข้อความ UI บรรทัด 51 'ร้านค้างไว้ให้'. ไม่แตะ contract/RPC และ guard ด้วยการเช็คว่ามี option นั้นจริงก่อน set (ถ้าร้านถูกปิด/หายไปก็ไม่เซ็ตค่าเก่า). วงเล็บ/quote ครบ syntax ถูกต้อง

### `laundry.html`
- แยกกรณี error จาก gateway ออกจากกรณีหาชุดไม่เจอ ตาม pattern ของ nfc.html:207-210 — เดิม `if(error||!data||data.error){...ไม่พบชุด...}` เหมารวมทุกกรณี. แก้เป็น: ถ้ามี error ให้เช็ค `redirecting_to_login` (return เงียบ ๆ ระหว่าง opsLogin พาไป LINE) มิฉะนั้นแสดง `error.message` จริง (เช่น 'เซสชันหมดอายุ เข้าสู่ระบบใหม่', 'ไม่มีสิทธิ์ใช้งานหลังบ้าน' จาก ops-api.js) โดย fallback เป็น 'ไม่พบชุด <code>'; ส่วน `!data||data.error` (ชุดไม่เจอจริง) ยังคงแสดง 'ไม่พบชุด <code>' เหมือนเดิม. ไม่เปลี่ยน contract กับ backend, ไม่แตะไฟล์อื่น (garment.html/shipout.html เป็นของ agent อื่น). syntax ครบ วงเล็บ/backtick ปิดถูก

### `liffAuth.js`
- baseUrl() คืน origin+pathname เท่านั้น (ไม่มี query) แล้วถูกใช้เป็น redirectUri ทั้ง auto-login (บรรทัด 23) และปุ่ม signIn (บรรทัด 42) ทำให้ param หายหลังกลับจาก LINE login. แก้แบบ client-safe ไม่แตะ contract backend: เพิ่ม helper redirectUrl() = baseUrl() + location.search (คง query เดิม) แล้วเปลี่ยน liff.login ทั้ง 2 จุดจาก baseUrl() → redirectUrl(). คง baseUrl() เดิมไว้เผื่อที่อื่นใช้. ทำให้ ?order/?event/?join/?garment ยังอยู่หลัง login param ไม่หาย.

### `links.html`
- แก้เฉพาะ CTA หลัก 'เริ่มเลย' บรรทัด 381: href https://liff.line.me/YOUR_LIFF_ID -> https://liff.line.me/2010486714-1g6lDuHo (ค่า LIFF_ID จริงยืนยันได้จาก config.js:6 และใช้อยู่แล้วใน about.html:155,243, contract.html, contracts.html). ส่วน lin.ee/YOUR_LINE_ID (บรรทัด 447) และ line.me/ti/g2/YOUR_OPENCHAT_ID (บรรทัด 486) SKIP: ไม่มีค่า LINE Official ID / OpenChat ID จริงอยู่ที่ไหนในทั้ง repo เลย (grep แล้วไม่พบ) เป็นค่าภายนอกที่ต้องได้จากฝั่ง business/LINE OA เดาไม่ได้ ถ้าใส่มั่วจะพาลูกค้าไปหน้า error เหมือนเดิม — ต้องให้ทีมกรอกค่าจริงเอง (product/config).

### `live.html`
- แก้ body ของ fetch(BROADCAST_URL) บรรทัด 274: จาก JSON.stringify({live_id:id}) → JSON.stringify({live_id:id,id_token:(window.opsIdToken?window.opsIdToken():'')}) ให้ตรง pattern เดียวกับ marketing.html:238 / influencers.html (window.opsIdToken มีจริงใน ops-api.js:52). เป็นการเพิ่ม field ใน body แบบ additive ไม่ทำลาย contract เดิม (server จะ verify เองตาม finding [2]).

### `marketing.html`
- loadGarments() (บรรทัด ~378) render การ์ดชุดโดยไม่มี element id gplat{i} เลย ทำให้ genGarmentPost บรรทัด 384 ตกไปที่ 'instagram' ตายตัว. เพิ่ม <select id="gplat{i}"> (tiktok/instagram/facebook) เข้าไปในการ์ดก่อนปุ่ม 'ให้ AI เขียนโพสต์' โดยเลียนแบบ markup ของ capPlat (บรรทัด 143) และย้าย style="margin-top:auto" จากปุ่มมาไว้ที่ select เพื่อรักษา layout เดิม. เป็นการแก้ฝั่ง client ล้วน ไม่เปลี่ยน contract (platform ถูกส่งไป callAI และ content_upsert อยู่แล้ว) ตอนนี้พนักงานเลือกแพลตฟอร์มได้ก่อนกดสร้างโพสต์

### `me-api.js`
- แก้ ensureInit() ที่บรรทัด 11-16: เดิมเรียก `await liff.init({liffId})` ตรง ๆ ด้วย flag _inited ของตัวเอง ไม่รู้จัก shared promise ของ LiffAuth → เปลี่ยนเป็นเช็ค `if (window.LiffAuth && window.LiffAuth.ensureInit)` แล้ว await LiffAuth.ensureInit() (แชร์ _initP ตัวเดียวกัน กัน init ซ้ำที่ทำ SDK throw) มี fallback เป็น liff.init({liffId:LIFF_ID}) เดิมกรณีไม่มี LiffAuth (บางหน้าที่ไม่โหลด liffAuth.js) — client-side ล้วน ไม่แตะ contract backend, LIFF_ID มาจาก window.CONFIG เดียวกับ CONFIG.LIFF_ID ที่ LiffAuth ใช้ จึงตรงกัน. syntax วงเล็บ/IIFE ครบ

### `nfc.html`
- ยืนยัน canonical เป็น lowercase (garment.html:82/laundry:118/repair:133/shipout:84 ใช้ .toLowerCase() ทั้งหมด) จึงแก้ 3 จุดให้ตรงกัน: บรรทัด 189 doPair `.toUpperCase()`→`.toLowerCase()`, ลบ `text-transform:uppercase` ออกจาก input CSS (บรรทัด 29), เปลี่ยน placeholder 'เช่น G1'→'เช่น g1' และ autocapitalize="characters"→"none" (บรรทัด 81) ค่าที่ยิงเข้า tag_register จึงเป็น lowercase ตรงกับ intake/put_away แล้ว
- เป็นบั๊กเดียวกับ [0] แก้พร้อมกันในการเปลี่ยน .toUpperCase()→.toLowerCase() + ลบ CSS uppercase + แก้ placeholder/autocapitalize
- เพิ่ม btn.disabled ระหว่าง await + คืนค่าใน finally: logScan รับพารามิเตอร์ btn เพิ่ม (ส่ง `this` จากปุ่มใน renderGarment) ครอบ tag_scan ด้วย try/finally; startScan โหมด pair disable/enable $('pairBtn') ตลอดช่วงแตะ+บันทึก คืนค่าใน finally
- ทั้งสองส่วนมี precedent ชัดในรีโป: (1) client อ่านเฉพาะ ?garment= (app.js:3923, scan.js:10, looks.html:262) จึงแก้ writeUrl บรรทัด 133 จาก '/?g=' → '/?garment='; (2) โดเมนออนไลน์จริงคือ wearlloop-dotcom.github.io (care-label:97/intake:134/labels:63 ระบุชัดว่า lloop.app ยังไม่ผูก DNS) จึงเปลี่ยน CUSTOMER_SITE 'https://lloop.app'→'https://wearlloop-dotcom.github.io' พร้อมอัปเดตคอมเมนต์ — เป็นการแก้ค่าคงที่/query param ที่ผิดฝั่ง client ไม่แตะ backend

### `ops-api.js`
- แก้ path ในคอมเมนต์ 'วิธี convert หน้า ops' บรรทัด 5 จาก `<script src="../liff/config.js"></script>` เป็น `<script src="config.js"></script>` ให้ตรงกับโครงสร้าง repo ปัจจุบันที่ไฟล์อยู่ root ไม่มีโฟลเดอร์ liff/ แล้ว ป้องกันคนสร้างหน้า ops ใหม่ตามคู่มือแล้วโดน 404 config.js. แก้แค่ comment ไม่กระทบ logic ใด ๆ

### `ops-looks.html`
- เพิ่มบรรทัด <script>window.opsMenu&&window.opsMenu.mount();</script> ต่อจาก <script src="ops-menu.js"></script> (ท้ายไฟล์ก่อน </body>) เหมือน marketing.html/ugc.html/requests.html ยืนยันแล้วว่า ops-menu.js นิยาม window.opsMenu={mount} เท่านั้น ไม่ mount เอง ปลอดภัยฝั่ง client ไม่แตะ contract
- เพิ่มบล็อกสไตล์ .lbrow/.lav/.lnm (รวม .lnm small) เข้าใน <style> ของหน้านี้ ยืนยันแล้วว่าคลาสพวกนี้มีแค่ใน looks.html:142-147 ไม่มีใน ops-ui.css ก็อปมาโดยแมป CSS var ให้ตรงกับ palette ของ ops-ui.css (--hair/--soft/--muted แทน --line/--sand ของ looks.html) จำกัด .lav เป็น 38x38 วงกลม object-fit:cover จัดแถวด้วย flex

### `ops-menu.js`
- แก้ส่วนที่ปลอดภัยฝั่ง client: เติมคีย์ที่ขาดใน ROLE_TH (บรรทัด 52) → เพิ่ม hr_admin:'หัวหน้าฝ่ายบุคคล', accounting:'บัญชี', stylist:'สไตลิสต์', sales:'ขาย', admin:'แอดมิน' (แปลตามที่ hr.html:122-129 นิยาม) พนักงานกลุ่มนี้จะไม่ขึ้นป้าย 'พนักงาน' อีก. ส่วนการขยาย roles ของ nav item (ให้ accounting เห็น accounting.html, hr_admin เห็น hr.html ฯลฯ) ไม่แก้ เพราะเป็นการตัดสิน role-access matrix ที่ต้อง align กับ allowlist ฝั่ง ops-rpc (backend) — ยืนยันไม่ได้ว่าหน้าไหน owner-gated ที่ gateway และไม่ชัดว่า sales/admin/stylist ควรเห็นหน้าใด (เสี่ยงโชว์เมนูที่ backend reject). ส่วนนี้ = skipped-backend
- แก้ค่า roles ที่ผิดใน OPS_NAV (บรรทัด 35): ['owner','manager'] → ['owner'] ให้ตรงกับ enforcement จริง (cockpit.html:148 เรียก owner_cockpit, error บรรทัด 156 ระบุ 'เข้าได้เฉพาะเจ้าของ (owner)') — manager ไม่เห็นเมนูที่กดแล้วเจอ error owner_only อีก. ส่วนแนวทาง 'ให้ทุกหน้า ops เรียก opsMe() gate role ก่อน render' ทำไม่ได้ในไฟล์นี้ ต้องแก้หน้า .html แต่ละไฟล์ (ห้ามแตะไฟล์อื่น) + ผูก fn→role ที่ gateway (backend) → ส่วนนั้น skipped-backend/risky

### `ops-partner.html`
- บรรทัด 273: เปลี่ยน const { data } → const { data, error } และเพิ่มเงื่อนไข if(error){...textContent=error.message...} ก่อนเช็ค !data||!data.found (ตาม contract ops-api.js:40-47 ที่คืน error.message เช่น 'ไม่มีสิทธิ์ใช้งานหลังบ้าน'/'เซสชันหมดอายุ' และตรงสไตล์ partner.html). ส่วน role gate (opsMe) ไม่แก้เพราะหน้านี้ไม่มี opsMe และพึ่ง gateway อยู่แล้ว — เกินขอบเขตที่ปลอดภัย

### `partner.html`
- เพิ่ม const esc=... (แบบเดียวกับ loadHistory) ใน loadClients/loadCalendar/loadBookings แล้วครอบค่าที่ลูกค้าคุมได้: loadClients escape nm(c.name), c.picture, c.code, c.headline (บ.703-712); loadCalendar escape s.customer (บ.806); loadBookings escape b.customer, b.code, b.customer_note (บ.846-847)
- เพิ่ม 'redirecting_to_login|login' เข้า regex needLogin ที่ initGate (บ.565) → error จาก me-api.js จะ match ทำให้แสดงข้อความ 'เปิดหน้านี้ผ่าน LINE' แทน 'ยังไม่พบสัญญาที่ลงนาม'

### `pay.html`
- แก้เงื่อนไข ok ที่ onPaid (เดิม `ok = !!(r && (r.ok || (r.data && r.data.paid)) && !r.error)`) เป็นเช็ค data.error ด้วย: `const d=r&&r.data; ok = !!(r && !r.error && d && !d.error && (d.paid===true||d.ok===true||d.reserved===true))` และเก็บ errCode จาก d.error. ยืนยัน contract จาก api.js:804-807 ว่า groupPayConfirm คืน {ok:!error,data,error} โดย business error อยู่ใน data.error (HTTP 200, error=null).
- เพิ่ม branch ใน boot(): เมื่อ CONFIG.USE_MOCK=false (โปรดักชัน) แต่ LIVE=false (init/login ไม่สำเร็จ) ให้ edgeState แจ้ง 'เข้าสู่ระบบ LINE ไม่สำเร็จ กรุณาเปิดลิงก์ใหม่' + return แทนการตกไปโชว์ MOCK_SUMMARY (บิล ฿780 + QR พร้อมเพย์จริง). MOCK fallback เหลือไว้เฉพาะ USE_MOCK=true (โหมดพรีวิวจริง) เท่านั้น.
- แก้ในการแก้เดียวกับ [1] ที่ onPaid — เพิ่มการเช็ค d.error และ map ข้อความ expired→'หมดเวลากันชุด ชุดถูกปล่อยคืน', denied→'นี่ไม่ใช่บิลของคุณ' ไปแสดงใน alert แทนการเด้งจอ Paid.

### `purchasing.html`
- แก้บรรทัด 239 (drawItems) จาก <option value="${s.id}">${esc(s.name)}</option> เป็น <option value="${esc(s.name)}"></option> ทำให้ autocomplete ใส่ 'ชื่อ' ลง input → SUPPLIES.find(s=>s.name===it.description) ที่บรรทัด 252 match ได้ supply_id ถูกผูกและ description ที่ส่งเป็นชื่ออ่านออก
- เพิ่ม .pill.draft{color:var(--stone);border-color:var(--hair);background:var(--canvas)} ต่อจาก .pill.low ในบล็อก <style> ให้ป้าย 'ร่าง' มีสไตล์รองรับ (cosmetic)
- แก้ในจุดเดียวกับ [3] ที่บรรทัด 239 เปลี่ยน value เป็นชื่อ (esc(s.name)) ครอบคลุมทั้งสอง finding — เลือกจากรายการแล้วได้ชื่อจริง supply_id ไม่หลุด

### `putaway.html`
- บรรทัด 95 เพิ่ม lost:'หาย', needs_review:'รอตรวจ' ต่อท้าย ST ให้ตรงกับ stock.html:65 ST_TH — แก้ fallback เป็นคำอังกฤษดิบใน doLocate/doBin/loadOverview
- ส่วนที่ทำได้ในไฟล์นี้: เติม lost/needs_review ลง ST บรรทัด 95 แล้ว (out มีอยู่แล้ว). ข้อเสนอรวม map กลางไว้ไฟล์ shared แล้วให้ทุกหน้า import เป็นงาน refactor ข้ามไฟล์ — ไม่แตะไฟล์อื่นตามกฎ
- ส่วน putaway เติม lost/needs_review ครบแล้ว (บรรทัด 95). การรวม map กลางใน ops-menu.js/shared และแก้ garment/nfc/stock เป็นงานข้ามไฟล์ ทำไม่ได้ในภารกิจนี้ (แก้ได้เฉพาะ putaway.html)

### `rental-terms.html`
- บรรทัด 1048: แก้ค่าคงที่ใน attribute data-i18n จาก 'version rental-2026d' → 'version rental-2026e' ให้ตรงกับข้อความไทยที่แสดง (rental-2026e) เป็นการแก้ค่าคงที่ที่ผิด ปลอดภัยฝั่ง client ไม่กระทบ contract

### `repair.html`
- cant() บรรทัด 268: เดิม const reason=prompt(...)||''; if(reason===null) return; เป็น dead check เพราะ ||'' ทำให้ไม่เป็น null → แก้เป็น const reason=prompt('เพราะอะไรถึงซ่อมไม่ได้',''); if(reason===null) return; ให้เช็ค null ก่อน (กด Cancel = return จริง, ค่าว่างยังส่ง '' ได้ตามเดิม). done() บรรทัด 263: เพิ่ม if(actual===null) return; ต่อท้าย prompt เพื่อให้กด Cancel ยกเลิกได้จริง ไม่เรียก repair_complete. ไม่เปลี่ยน contract RPC (repair_cant/repair_complete พารามิเตอร์เดิม)

### `review.html`
- review.html:816 เปลี่ยน `if (j.ok) data = j.data; else error = {...}` เป็น `if (r.ok && !j.error) data = j.data; else error = {...}` ให้ตรง contract {data,error} ของ me-rpc (ยืนยันจาก me-api.js:52,62 และ loadProfile ในไฟล์เดียวกันที่อ่าน j.data ตรง ๆ) และดึงข้อความ error ผ่าน j.error.message/j.error
- review.html:623-625 ตัด decodeURIComponent(...) ออก ใช้ params.get('garment_name'/'size'/'date_range') ตรง ๆ (URLSearchParams decode ให้แล้วหนึ่งชั้น) กัน URIError ที่ top-level ของ <script>
- review.html init(): เพิ่ม sessionStorage guard 'reviewLoginTried' — ถ้าเคยลอง login แล้วยัง not-logged-in ให้หยุดเด้งและ showErr แทน; เคลียร์ flag เมื่อ login สำเร็จ ตาม pattern เดียวกับ me-api.js/ops-api.js
- แก้ไปพร้อมกับ [1] ที่ review.html:623-625 แล้ว
- แก้ไปพร้อมกับ [0] ที่ review.html:816 แล้ว — ใช้ contract เดียวกับ me-api.js (r.ok && !j.error)

### `shipout.html`
- เพิ่มการอ่าน query param หลัง Enter listener (บรรทัด 148): const _q=new URLSearchParams(location.search).get('code'); if(_q){ $('code').value=_q; load(); } ทำให้ deep-link จาก today.html?code=g1 เติมช่อง input แล้วเรียก load() อัตโนมัติ. input มี CSS lowercase และ load() ทำ trim().toLowerCase() อยู่แล้วจึงปลอดภัย ไม่แตะ contract backend.
- finding เดียวกับ [0] แก้พร้อมกันด้วย URLSearchParams ท้ายสคริปต์ pattern เดียวกับ garment.html:122

### `staff.html`
- staff.html:202 แก้ ROLE_TH จากเซ็ตเก่า 7 ค่า (admin,stylist,laundry,repair,shipping,sales,owner) เป็นเซ็ตเดียวกับ hr.html:232 ครบ 13 ค่า (owner,manager,hr_admin,care,stock,marketing,accounting,stylist,sales,admin,laundry,repair,shipping) เป็นการเพิ่มคีย์ที่ขาดใน label map ที่มีอยู่แล้ว ปลอดภัยฝั่ง client ไม่กระทบ contract backend ตอนนี้ role อย่าง care/stock/marketing/manager/hr_admin/accounting จะแสดงภาษาไทยแทนโค้ดดิบ

### `stock.html`
- เพิ่ม returned:'รับคืนแล้ว' ใน ST_TH (บรรทัด 65) และเพิ่ม 'returned' ใน order array (บรรทัด 71) วางหลัง 'out' ตาม lifecycle. ตรงกับ putaway.html:95 ที่นิยาม returned:'รับคืนแล้ว'. เป็นการเพิ่มคีย์ที่ขาดใน map เดิม ปลอดภัยฝั่ง client ไม่แตะ contract
- ส่วน client-safe แก้แล้ว: เพิ่ม returned:'รับคืนแล้ว' ใน ST_TH (cleaning มีอยู่แล้ว ไม่ต้องเพิ่ม). แต่ส่วน leak-rule ใหม่ใน stock_audit ('ชุด check-in ค้างเกิน N วันไม่ปล่อยเช่า') ต้องแก้ backend RPC stock_audit จึง skip ส่วนนั้น ไม่เดาเพิ่ม logic ที่ต้องแก้ backend

### `today.html`
- บรรทัด 50 ลบ <a href="/market.html">เฝ้าตลาด</a> ออกจาก nav ฮาร์ดโค้ด ให้สอดคล้อง ops-menu.js:31 ที่กำหนด market.html เฉพาะ ['marketing','manager'] — role marketing/manager ยังเข้าได้ผ่านเมนู drawer (opsMenu) ตามปกติ

### `ugc.html`
- เพิ่ม guard กันกดซ้ำฝั่ง client ตามแพทเทิร์นเดียวกับ gig_create: (1) เปลี่ยน onclick ปุ่ม 'อนุมัติ + จ่าย' จาก approve('${r.asset_id}') เป็น approve('${r.asset_id}', this) เพื่อส่ง element ปุ่มเข้าไป (2) แก้ approve(asset) → approve(asset,btn) โดย disable ปุ่มทันทีที่กด (if(btn) btn.disabled=true) ห่อ rpc/await ด้วย try และคืนค่า btn.disabled=false ใน finally เสมอ ป้องกัน gig_approve ยิงซ้ำด้วย asset_id เดียวกันก่อน loadQueue จะลบการ์ด. หมายเหตุ: ส่วน server-side idempotency (gig_approve no-op เมื่อ approved แล้ว) เป็นงาน backend ไม่ได้แตะ.

### `wed.html`
- wed.html:161 เปลี่ยน status ที่ส่งใน wedSharePick จาก 'reserved' → 'eyeing' (soft, 'กำลังดู') ยืนยันจาก api.js:716 ว่า p_status default คือ 'eyeing' อยู่แล้ว จึงไม่เปลี่ยน contract กับ backend และ isHard (wed.html:125) จะไม่ trigger ทำให้ชุดไม่ถูกล็อก/ปุ่มไม่ถูกปิดสำหรับแขกคนอื่น ให้ backend เป็นผู้อัปเป็น 'reserved' เมื่อจองสำเร็จจริง; เพิ่มคอมเมนต์ไทยอธิบาย

---

## ⏳ เลื่อนไว้ (ต้อง backend / infra / ตัดสินใจ product)

### ต้องแก้ backend
- **`app.js`** — [0] หน้าออเดอร์โชว์ tracking ได้แต่ไม่มีที่บันทึกเลขพัสดุ (dead-end)
  - ต้องเพิ่ม UI+RPC ใหม่ (เช่น action set_shipment) ในหน้า shipout.html/today.html ให้สตาฟกรอก courier/tracking_no/eta เขียนกลับ ซึ่งอยู่นอก app.js และต้องมี backend action รองรับ — เกินขอบเขตไฟล์นี้และเป็น contract ใหม่กับ backend
- **`app.js`** — [2] ฝั่งลูกค้าไม่มีปุ่ม/สถานะ 'ส่งคืน'
  - ต้องเพิ่มปุ่มแจ้งส่งคืน + RPC เซ็ตสถานะ return_shipped/return_arrived และ hook ตอนของถึงร้าน ซึ่งเป็นฟีเจอร์ใหม่ที่ต้องมี backend action เซ็ต event เหล่านี้ (ปัจจุบันไม่มีที่ไหนเซ็ตเลย) — เกินขอบเขต client
- **`app.js`** — [5] hold expires_at มองไม่เห็นฝั่ง client + orderPay ไม่ re-check
  - การโชว์ countdown ต้องให้ bookWithBackups คืน expires_at (ฝั่ง backend ไม่ได้ส่งมา) และการ re-check hold หมดอายุก็ต้องพึ่งข้อมูล/สถานะ hold จาก server — แก้ฝั่ง client อย่างเดียวไม่ครบและเสี่ยงเดา contract
- **`app.js`** — [7] ยกเลิกชุดหลักไม่แตะชุดสำรอง (orphan spare)
  - การ cascade ยกเลิกสำรองที่ผูก primary_rental_id ควรทำฝั่ง server (atomic) การยิงยกเลิกสำรองตามฝั่ง client เสี่ยงสร้าง flow ครึ่ง ๆ และยืนยัน cascade behavior ของ backend ไม่ได้ — ปล่อยให้ backend จัดการ
- **`case-file.html`** — [2] หน้า evidence ยิง edge fn 'acct' ตรงด้วย raw idToken — role/PII gate เป็น server-only
  - การ gate role/owner/scope สาขาอยู่ที่ edge fn 'acct' ซึ่งไม่อยู่ใน repo ตรวจ/ยืนยันจาก client ไม่ได้ และการย้ายไปผ่าน ops-rpc gateway ต้องแก้ backend ด้วย — เกินขอบเขตไฟล์เดียว ไม่เดาแก้
- **`disputes.html`** — [0] party_type employee/supplier ไม่มี branch สร้างแฟ้มหลักฐาน
  - การแก้จริงต้องให้ backend (dispute_get) คืน evidence ชนิด employee/supplier ก่อน + แก้ case-file.html (อีกไฟล์) เพิ่ม stype ด้วย. เขียน branch renderEvidence ev.type==='employee'/'supplier' โดยไม่รู้ shape ข้อมูลที่ server คืน = เดา และปลายทางยังคืน JSON ดิบเหมือนเดิม. อยู่นอกขอบเขต client-safe (ต้องแก้ backend + ไฟล์อื่น) จึง skip
- **`disputes.html`** — [1] เปิดคดีไม่ผูก rental_id
  - ต้องเพิ่มฟิลด์ rental_id ใน payload dispute_open ซึ่งเป็นการเปลี่ยน contract/data model ฝั่ง backend (server ต้องรับ+เก็บ+ใช้ group evidence). ไม่ใช่การแก้ client ล้วน จึง skip
- **`disputes.html`** — [2] influencer_no_return ไม่มี party_type และไม่มี evidence panel
  - การเพิ่ม <option value='influencer'> ใน f_ptype เป็นการส่งค่า party_type ใหม่ที่ backend อาจไม่รองรับ (เปลี่ยน contract) และ branch renderEvidence influencer ต้องรอ server คืน evidence ชนิดนี้ก่อน + ต้องแก้ case-file.html ด้วย. อยู่นอกขอบเขต จึง skip
- **`disputes.html`** — [3] employee/supplier evidence panel ตกลง JSON ดิบ
  - ซ้ำกับ [0] — เพิ่ม branch renderEvidence โดยไม่รู้โครงสร้างข้อมูลที่ server คืน (ปัจจุบัน server ไม่มี branch นี้) ทำให้แก้ไม่ได้จริง ต้องแก้ backend + case-file.html. skip
- **`disputes.html`** — [7] คดีผูกด้วย uuid อิสระ ไม่เจาะจง rental/contract + ไม่ validate
  - ทับซ้อนกับ [1] — ต้องเพิ่มฟิลด์ rental_id/contract_id ใน payload (เปลี่ยน data model) และการ validate ว่า uuid มีจริงต้องเรียก lookup ฝั่ง backend. ไม่ใช่ client-safe จึง skip
- **`forecast.html`** — [0] forecast.html ข้าม gateway ops-rpc ใช้ anon key + p_uid เป็น auth และ update_plan_price เขียนราคาจริงได้ด้วย UID
  - ปัญหาเชิงสถาปัตยกรรม auth ทั้งหน้า แนวทางแก้คือย้ายไปเรียกผ่าน window.opsRpc (ops-api.js) ให้ gateway verify idToken + owner_only ฝั่ง server ซึ่งต้องมี RPC action (forecast_actuals/update_plan_price/plan_economics) เปิดใน opsRpc gateway และตรวจ owner ฝั่ง backend — ยืนยันฝั่ง backend ไม่ได้และเปลี่ยน contract/auth ที่ต้องแก้ backend ด้วย ผิดกฎ (ห้ามเพิ่ม gateway/auth ที่ต้องแก้ backend, ห้ามเดา RPC action). แก้ปลอดภัยฝั่ง client เดี่ยว ๆ ไม่ได้เพราะเอาช่องวาง UID/anon key ออกอย่างเดียวจะทำให้ทั้งหน้าใช้ไม่ได้ทันที
- **`forecast.html`** — [2] หน้าการเงินเจ้าของ (forecast.html) ข้าม ops-rpc gateway ทั้งหน้า ใช้ LINE UID พิมพ์เองเป็นรหัสผ่านผ่าน anon key ทั้งอ่านและเขียนราคาแผน
  - เป็น finding ซ้ำกับ [0] (ประเด็นเดียวกัน) แนวทางแก้เหมือนกันคือย้าย forecast_actuals/update_plan_price/plan_economics ไปผ่าน window.opsRpc + ตัดสิทธิ์ owner_only จาก idToken ฝั่ง server และเลิกรับ p_uid/cache UID — ต้องแก้ backend gateway ด้วย ยืนยัน RPC action ในฝั่ง opsRpc ไม่ได้ จึงไม่เดาแก้ ผิดกฎ (backend/auth). ปล่อยให้ทีม backend จัดการ
- **`group-checkout.html`** — [0] book_group_cart/book_group_split ไม่มี idempotency → hold/ออเดอร์ซ้ำเมื่อ response หลุด
  - แนวทางแก้จริงคือส่ง p_idempotency_key ให้ server dedup ซึ่งเป็นการเพิ่ม param ใหม่ในสัญญา RPC ที่ backend ต้องรองรับด้วย (ไม่รู้ว่ามีจริงฝั่ง server) — เกินขอบเขต client. ส่วนการ 'ไม่คืนปุ่มก่อนยืนยัน commit' ก็ไม่ช่วยจริงถ้าไม่มี dedup ฝั่ง server (network error หลัง commit สำเร็จยังทำให้จองซ้ำได้). ปัจจุบันมี guard btn.disabled ระหว่าง await + คืนใน finally อยู่แล้ว (881,903). ปล่อยให้ backend จัดการ idempotency.
- **`live.html`** — [0] announce broadcast ไม่มี idempotency key → ส่งซ้ำเมื่อ response หาย
  - แกนหลัก (idempotency/dedup key ให้ edge fn กันยิงซ้ำ + optimistic result) ต้องทำฝั่ง edge fn live-broadcast → skip. แต่ทำ client-safe mitigation ให้: แก้ข้อความ catch (บรรทัด 278) จาก 'เชื่อมต่อไม่สำเร็จ: ...' เป็น 'ไม่ทราบผล — อาจกระจายไปแล้ว อย่ากดซ้ำจนกว่าจะตรวจสอบ (...)' เพื่อไม่ชวนให้ staff กดซ้ำจน broadcast ซ้ำ. ไม่ใส่ AbortController timeout เพราะ abort จะยิ่งทำให้เข้าใจผิดว่าล้มเหลวแล้วกดซ้ำ (เสี่ยงกว่าเดิม).
- **`live.html`** — [1] ไม่มี action ตั้งสถานะเป็น 'live' → ปุ่มจบไลฟ์เข้าไม่ถึง / announce ค้างเปิด
  - การเดินสถานะเป็น 'live' + set started_at เป็น state machine/ธุรกิจฝั่ง backend ไม่รู้ว่า live_set_status รับ p_status='live' และ set started_at ให้หรือไม่ ถ้าเดาเพิ่มปุ่มเรียก setStatus(id,'live') อาจยิง status ที่ backend ไม่รองรับ → เสี่ยง. ปล่อยให้ backend/edge fn flip status เอง.
- **`live.html`** — [2] broadcast ยิงตรงด้วย publishable key ไม่ผ่าน gateway → ข้าม guard login/role
  - การ verify id_token + เช็ค role ต้องทำใน edge fn live-broadcast (หรือย้ายไปผ่าน ops-rpc gateway) = backend → skip. ฝั่ง client ได้แนบ id_token เข้า body แล้วตาม finding [4] เป็น prerequisite แต่ enforce auth เองไม่ได้ ต้องให้ server ตรวจ.
- **`live.html`** — [3] live_upsert เขียนทับด้วย id ล้วน ไม่มี version/lock → last-write-wins
  - optimistic lock ต้องมี column updated_at/version และให้ live_upsert reject เมื่อไม่ตรง = แก้ backend + data model → skip. เพิ่มแค่ฝั่ง client ไม่พอและอาจ mismatch กับ schema จริง.
- **`looks.html`** — [0] submitShare: retry หลังส่งล้ม อัปรูป+share_look ซ้ำ → look pending ซ้ำ
  - การกันกดซ้ำระหว่าง await มีอยู่แล้ว (btn.disabled=true บรรทัด 689 คืนค่าใน guard บรรทัด 693). ปัญหาที่เหลือคือ retry หลัง response หาย ทำให้ share_look สร้าง look ซ้ำ — แก้ได้ต้องส่ง client idempotency key + ให้ RPC share_look dedupe ฝั่ง backend (เปลี่ยน contract) จึงเกินขอบเขต looks.html ไฟล์เดียว. ไม่แตะไฟล์.
- **`ops-partner.html`** — [0] ฝั่ง owner ไม่มี UI ดูรายชื่อ/ผู้สมัครพาร์ทเนอร์ (service_modes/socials/place_name ฯลฯ หายเงียบ)
  - ต้องสร้างฟีเจอร์/UI ใหม่ทั้งส่วน (section รายชื่อผู้สมัคร) + ต้องมี RPC list ผ่าน ops-rpc ที่ไม่รู้ว่ามีจริงฝั่ง backend (grep ทั้ง repo ไม่มีไฟล์ไหน render คีย์เหล่านี้เลย). เกินขอบเขต client-safe (ห้ามสร้างหน้า/เพิ่ม RPC action ที่ไม่แน่ใจว่ามี) — ปล่อยให้ทีม backend/product ตัดสินใจ
- **`partner.html`** — [0] IG/TikTok/พิกัด ที่พาร์ทเนอร์กรอกตอนสมัคร ไม่มีหน้าไหนอ่านต่อ
  - partner.html ฝั่งสมัคร (partner_self_register) ส่ง place_name/lat/lng/socials ถูกต้องอยู่แล้ว บั๊กจริงคือ schema ของ partner_profile_self/partner_profile_save (backend) ไม่มีฟิลด์เหล่านี้ให้อ่าน/บันทึกทับ และหน้า owner (stylist-bookings.html/ops-partner.html) ไม่มีการแสดง — ต้องแก้ backend + ไฟล์อื่น ไม่สามารถแก้ในไฟล์เดียวได้
- **`partner.html`** — [1] service_modes ไม่ถูกใช้ + การจองฝั่งลูกค้า hardcode 'studio'
  - partner.html ส่ง service_modes ถูกต้องแล้ว บั๊กอยู่ที่ app.js (stylistCardHtml ไม่แสดงโหมด, confirmStylistBooking hardcode 'studio' ส่งเข้า pcBookSlot) และ contract p_mode ฝั่ง backend — ต้องแก้ app.js/api.js/backend ไม่เกี่ยวกับ partner.html
- **`pay.html`** — [3] group_pay_confirm ไม่มี idempotency กดยืนยันซ้ำหลัง response หลุด
  - ต้องส่ง idempotency key และให้ backend คืน 'already_confirmed' ให้ถือเป็นสำเร็จ ซึ่งเป็นการเปลี่ยน contract/พฤติกรรมฝั่ง server (ไม่รู้ว่ามี key นี้จริงไหม) — เกินขอบเขต client-safe. หมายเหตุ: onPaid มี btn.disabled กันกดรัวในหน้าเดียวอยู่แล้ว (คงไว้).
- **`purchasing.html`** — [0] รับของชุด (kind=asset) เป็น dead-end ไม่สร้าง garment ต้นทุนซ้ำ
  - po_receive เป็น RPC ฝั่ง edge function 'acct' garment สร้างจาก intake_garment (ops-rpc คนละ backend). การให้ po_receive สร้าง garment/ผูก po_id ต้องแก้ backend + data model (เพิ่ม field supply_id/po_id ใน intake) ไม่สามารถทำฝั่ง client ปลอดภัยได้ และไม่มี RPC action ที่รู้ว่ามีจริงให้เรียกเชื่อม จึง skip
- **`purchasing.html`** — [1] PO asset รับของแล้วไม่แปลงเป็น garment
  - ซ้ำประเด็นกับ [0]. การเพิ่ม branch วน items เรียก intake_garment ตอน po_receive หรือปุ่มแปลงเป็นชุด ต้องมี action/หน้าใหม่และแก้ backend ให้เชื่อม PO↔garment จึงเกินขอบเขต client-only, skip
- **`purchasing.html`** — [2] buy flow __intake prompt ขอรหัสชุดที่ต้องมีอยู่แล้ว ไม่สร้างชุดจริง
  - การให้ __intake เปิด intake.html พร้อม prefill (สร้างหน้า/flow ใหม่) หรือให้ buy_status สร้าง garment เอง ต้องอาศัยหน้า intake + RPC ฝั่ง backend ที่ผูก buy item→garment ไม่มี contract ให้เรียกฝั่ง client จึง skip ไม่เดาแก้
- **`requests.html`** — [0] คอลัมน์ "คนขอ" hardcode เลข 1 ทุกแถว + หัวเพจอ้างว่าเรียงตามดีมานด์ (requests.html:346, :172)
  - ค่าโหวต/ดีมานด์ per-request ถูก aggregate ในฝั่ง backend และคืนผ่าน RPC 'trending_requests' (meRpc ฝั่งลูกค้า, api.js:441-447 คืน field votes) เท่านั้น. หน้านี้เรียก opsRpc 'wishlist_ops_list' (requests.html:284) ซึ่งคืน row garment_requests ราย record (status/brand/item_description/budget_max/notified_at/ops_note) และไม่มี field votes/demand ให้อ่าน. การเปลี่ยน `1` เป็น `r.votes ?? 1` จะไม่แก้อาการจริง (field ไม่มีในผลลัพธ์ → ยังโชว์ 1) และ sort ตาม field ที่ไม่มีก็เป็น no-op — ต้องให้ wishlist_ops_list คืน demand/votes count (แก้ backend/data-model) ก่อน. ส่วนทางเลือกตัดคอลัมน์ทิ้ง+แก้ข้อความหัวเพจเป็นการตัดฟีเจอร์ = product decision. ทั้งสองทางอยู่นอกขอบเขต client-safe จึง skip ไม่แก้ไฟล์.
- **`seller.html`** — [0] broken-seam: acquisition รับซื้อแล้วชุดไม่เข้า garment/stock
  - seller.html ส่ง payload เข้า RPC seller_submit ถูกต้องอยู่แล้ว (บรรทัด 219-237) การจะให้ชุดที่รับซื้อกลายเป็น garment ต้องเพิ่ม RPC/พารามิเตอร์ให้ intake.html รับ acquisition_id แล้ว prefill หรือมี RPC อ่าน acquisition มาสร้าง garment ซึ่งเป็นงานฝั่ง backend + ต้องแก้ไฟล์อื่น (intake.html) แก้ในไฟล์เดียว seller.html ไม่ได้ และห้ามเดาสร้าง action ใหม่ที่ไม่รู้ว่ามีจริงฝั่ง backend จึง skip
- **`slips.html`** — [0] กล่องสลิปไม่มีปุ่มยืนยัน/ปฏิเสธ — สลิป 'รอยืนยันมือ' ไปต่อขึ้นบัญชีไม่ได้ (slips.html:137)
  - ไฟล์นี้เรียก edge function 'acct' แค่ 2 action คือ api('slips') และ api('slip_view') เท่านั้น ไม่มี action confirm/verify/settle/reject อยู่เลย การเพิ่มปุ่มยืนยัน/ปฏิเสธต้องเรียก RPC action ใหม่ (เช่น slip_confirm/slip_reject) ที่ยังไม่รู้ว่ามีจริงฝั่ง backend และต้องให้ backend โพสต์ ledger เอง ตามกฎห้ามเดาเพิ่ม RPC action ที่ไม่รู้ว่ามีจริง และการโพสต์ ledger เป็นงานฝั่ง backend/edge function ล้วน จึง skip ให้ทีม backend implement action + posting ledger ก่อน แล้วค่อยผูกปุ่มในหน้านี้
- **`today.html`** — [0] คิวรับซื้อมือสอง (acq) เป็น dead-end
  - แนวทางแก้ต้องเพิ่มปุ่ม accept/ปฏิเสธ/แปลงเป็นชุด ซึ่งพึ่ง RPC action ฝั่ง backend ที่ยืนยันไม่ได้ว่ามีจริง และการลิงก์ไป case-file.html?ref=<acquisition_id> ก็ยืนยัน contract ปลายทางไม่ได้ (แก้ได้เฉพาะ today.html) เป็นการตัดสินใจ workflow+backend จึง skip
- **`wishlist.html`** — [0] submit_garment_request ผ่าน anon client + p_uid ที่ client ส่งเอง (auth-gap PII)
  - แก้ไม่ได้ฝั่ง client อย่างเดียว. การเปลี่ยน sb.rpc('submit_garment_request',{p_uid:uid,...}) ที่บรรทัด 767 ไปเป็น window.meRpc(...) ต้องแก้ backend ด้วย 2 จุด: (1) เพิ่ม 'submit_garment_request' เข้า allowlist ของ me-rpc gateway (ไม่งั้นได้ fn_not_allowed) และ (2) ให้ server function derive customer_uid จาก idToken ที่ verify แล้วแทนการรับ p_uid — เพราะ gateway ปัจจุบัน override เฉพาะ p_customer/p_line_uid (ดู me-api.js บรรทัด 2-3) ไม่ได้เติม p_uid ที่ RPC นี้ใช้. เป็นการเปลี่ยน contract/gateway ที่ยืนยันฝั่ง backend ไม่ได้ ตามกฎจึง skip ไม่เดาแก้.

### ต้องแก้ infra
- **`accounting.html`** — [0] ปุ่ม 'พิมพ์' ใบกำกับภาษีชี้ tax-doc.html ที่ไม่มีไฟล์ (404)
  - ไฟล์ tax-doc.html ไม่มีอยู่จริงในโปรเจกต์ การแก้ต้องสร้างหน้าใหม่ (tax-doc.html) ที่อ่าน query type/id แล้วเรียก edge function 'acct' มาเรนเดอร์ ซึ่งเป็นการสร้างไฟล์/หน้าใหม่ที่กฎห้าม และต้องพึ่ง backend/infra ไม่มีหน้าปลายทางอื่นที่มีอยู่จริงให้ชี้ไปแทนได้อย่างปลอดภัย จึง skip ไม่เดาแก้ลิงก์
- **`case-file.html`** — [3] รูป QC render จาก URL ตรง (คาด bucket public) ต่างจาก KYC signed
  - การเปลี่ยน QC photos ให้เป็น bucket private + ออก signed URL เป็นการเปลี่ยน storage bucket/สิทธิ์ (public→private) และต้องแก้ฝั่งอัปโหลด/backend ที่ออก signed URL — ห้ามแก้ตามกฎ (infra) client เปลี่ยนเองไม่ได้
- **`csv.html`** — [0] ส่วนย่อย: หน้ากำพร้าไม่อยู่ใน OPS_NAV + ไม่มี client-side role gate
  - การเพิ่มลิงก์ csv.html เข้า OPS_NAV ต้องแก้ ops-menu.js (คนละไฟล์ ห้ามแตะ) และ role gate ฝั่ง client เป็นเรื่อง auth/allowlist ที่พึ่ง ops-rpc gateway อยู่แล้ว — เกินขอบเขต csv.html ไฟล์เดียว จึง skip
- **`forecast.html`** — [1] forecast.html เป็นหน้ากำพร้า ไม่มีลิงก์เข้าจาก OPS_NAV/nav ไหนเลย
  - การแก้ต้องเพิ่ม entry { href:'forecast.html', ... } ใน OPS_NAV ของไฟล์ ops-menu.js ซึ่งไม่ใช่ไฟล์ที่ได้รับมอบหมาย (แก้ได้เฉพาะ forecast.html) — เพิ่ม nav ในไฟล์นี้เองไม่ได้ ต้องให้ agent เจ้าของ ops-menu.js เป็นคนแก้ และควรทำหลังปิดช่องโหว่ auth ตาม finding ก่อนหน้า
- **`hr.html`** — [1] เอกสาร HR อัปโหลดเข้า public bucket 'hr-docs' (สำเนาบัตร ปชช. รั่ว)
  - การแก้ต้องย้ายไปอัปโหลดผ่าน edge function (แบบ kyc) เข้า private bucket และเปิดด้วย signed URL เหมือน slip_view — เป็นการเปลี่ยน storage bucket จาก public เป็น private + ต้องมี edge function/RPC ฝั่ง backend รองรับ ซึ่งอยู่นอกขอบเขต client และเปลี่ยน contract กับ backend จึงไม่เดาแก้

### ต้องตัดสินใจ product
- **`analytics.js`** — ชั้น analytics ไม่มีวันยิง event + 3 หน้าโหลด analytics.js โดยไม่มี config.js
  - ตัว analytics.js เองถูกต้องครบ (init GA, analyticsIdentify/Track, gaEvents helper ครบ) ไม่มีบั๊กในไฟล์นี้. ปัญหาทั้งหมดอยู่ไฟล์อื่นที่แก้ไม่ได้: (1) privacy.html/rental-terms.html/contract.html ต้องเพิ่ม <script src='config.js'> ก่อน analytics.js — เป็นไฟล์อื่น ห้ามแตะ (2) การเรียก gaEvents.* ตามจุด flow (contract_signed/begin_checkout/wishlist_*) ต้องไปแก้หน้าที่เกี่ยวข้อง — ไฟล์อื่นเช่นกัน และการตัดสินใจว่าจะใช้ GA ต่อหรือลบชั้น gaEvents เป็น product decision. ภายใน analytics.js ไม่มีสิ่งที่แก้ได้อย่างปลอดภัยโดยไม่เปลี่ยน contract จึง skip
- **`case-file.html`** — [0] acquisition.status/offered_price/voucher_no อ่านแต่ไม่มีหน้าเขียน
  - ต้องสร้าง UI/ปุ่มฝั่ง ops สำหรับ set offered_price + accept + ออก voucher_no พร้อม RPC action ใหม่ฝั่ง backend (acquisition_*) ซึ่งไม่มีในระบบ client และเป็นการตัดสินใจเชิง product/flow การรับซื้อ — เกินขอบเขต แก้ใน case-file.html ไม่ได้ (ไฟล์นี้แค่ render อ่านค่า)
- **`config.js`** — [0] GA4 ตายสนิท: GA4_ID ยังเป็น placeholder และ gaEvents ไม่ถูกเรียกจากที่ไหนเลย
  - แก้ไม่ได้ภายใน config.js อย่างปลอดภัย เพราะ (1) ต้องใช้ Measurement ID จริงจาก GA4 Admin ซึ่งเป็นค่าที่ทีมการตลาดต้องกำหนด (ห้ามเดา/แต่ง ID เอง และกฎห้ามแก้คีย์ config) (2) ส่วนสำคัญของบั๊กคือ funnel ไม่เคยเรียก gaEvents.checkoutStart/paymentInitiated ต้องไปแก้ที่ app.js reserve() ซึ่งเป็นไฟล์อื่น (นอกขอบเขตไฟล์เดียวที่รับผิดชอบ). การเปลี่ยนแค่ placeholder G-XXXXXXXXXX เป็น ID ปลอมจะทำให้ analytics.js โหลด gtag ด้วย ID ผิด แย่กว่าเดิม จึงไม่แตะ
- **`hr.html`** — [2] คำศัพท์ role ของ HR (13 ค่า) ไม่ตรงกับ role matrix ของ ops-menu (5 ค่า)
  - การ sync จริงต้องแก้ ops-menu.js (เพิ่ม role ลง OPS_NAV.roles) ซึ่งเป็นอีกไฟล์ที่ห้ามแตะ · ทางเลือกในไฟล์ hr.html คือตัด dropdown ให้เหลือ 5 role แต่เป็นการลบตัวเลือก/เปลี่ยนโมเดลสิทธิ์และตำแหน่งงาน = การตัดสินใจเชิง product/นโยบายสิทธิ์ ไม่ควรเดาแก้ฝั่งเดียว
- **`rental-terms.html`** — [1] กล่อง checkbox 'ยืนยันการยอมรับ' เป็น checkbox หลอก (ติ๊กแล้วไม่บันทึก) แต่อ้างว่าใช้เป็นหลักฐานทางกฎหมาย
  - การเอากล่อง checkbox ออก/เปลี่ยนเป็นข้อความอธิบาย เป็นการตัดฟีเจอร์+ตัดสินใจเชิง UX/กฎหมาย (นโยบายการยอมรับสัญญา) ส่วนการเก็บ consent จริงต้องยิง RPC record_consent ผ่าน gateway ซึ่งต้องแก้ backend — เกินขอบเขตที่แก้ได้ฝั่ง client จึง skip ตามกฎ (ห้ามลบฟีเจอร์/ตัดสินใจเชิง product/เพิ่ม RPC ที่ไม่รู้ว่ามีจริง). หมายเหตุ: การยอมรับจริงเกิดตอนกดยืนยันการเช่าใน flow จอง (api.js acceptTerms) อยู่แล้ว
- **`shipout.html`** — [1] หน้าเตรียมส่งไม่มีใบจ่าหน้า 'ส่งออกถึงลูกค้า'
  - เป็นการตัดสินใจเชิง product/ธุรกิจว่าจ่าหน้าขาออกทำที่หน้านี้หรือที่ระบบขนส่ง การเพิ่มบล็อกใบจ่าหน้าใหม่ (ผู้รับ=ลูกค้า) เป็นการเพิ่มฟีเจอร์/เปลี่ยน flow ไม่ใช่บั๊ก client-safe จึง skip ไว้ให้เจ้าของตัดสินใจ ยังไม่แก้.
- **`wed.html`** — [1] wed.html หลุดจากระบบ i18n และ topbar ทั้งหน้า (ไม่มีปุ่มสลับภาษา/ย้อนกลับ)
  - การเพิ่ม i18n เต็มหน้าต้องเขียนคำแปล EN ให้ทุกข้อความที่ hardcode ไทย (hero, badge, alert, ปุ่ม ฯลฯ) = การตัดสินใจเชิง content/ฟีเจอร์ ไม่ใช่ bugfix ฝั่ง client ที่ปลอดภัยและ minimal ตามกฎ; ถ้าใส่แค่ topbar placeholder โดยไม่แปล ปุ่มสลับภาษาก็ไม่มีผล จึงควรให้ทีมตัดสินใจก่อนว่าจะทำ i18n เต็มหรือคงไทยล้วน
- **`wed.html`** — [2] wed.html โหลด nav.js แต่ไม่มี .lloop-topbar placeholder และไม่มี data-i18n เลย
  - ซ้ำกับ [1] — เป็น finding เดียวกัน (i18n/topbar หายทั้งหน้า) การแก้ต้องเพิ่มคำแปล EN ทุกสตริง = content/product decision + เพิ่มฟีเจอร์ นอกขอบเขต safe client fix จึง skip พร้อมให้ทีมตัดสินใจแนวทาง (ทำ topbar+TH/EN เต็ม หรือถอด nav.js ออกถ้าตั้งใจไทยล้วน)

### เสี่ยงเกินจะเดา
- **`app.js`** — [11] การ์ดแจ้งเตือน CTA แตะแล้วไม่ไปไหน
  - ต้องแมป kind→target ที่ถูกต้องต่อชนิด (review_request→openReview(rental_id), abandon_checkout→pay/checkout) ซึ่งขึ้นกับ payload shape ที่ไม่แน่ชัดและเป็นการตัดสินใจ product ว่าปุ่มไหนพาไปไหน — เดาแล้วเสี่ยงพาไปผิดหน้า (บรีฟเองระบุ code→reRentByCode พาผิดทาง) จึงไม่แก้
- **`partner.html`** — [4] i18n: ข้อความ dynamic ไม่ถูกแปลแม้มีคำแปลใน PARTNER_EN
  - เป็นข้อจำกัดของ i18n engine ที่ collectI18n() เก็บ DOM ครั้งเดียวตอนโหลด การแก้ให้ครบต้องครอบ tr() ที่จุด render dynamic ~30 จุด (empty states, ปุ่มคิว, badge ปฏิทิน, earnings, toast ทุกตัว, gate) พร้อมเพิ่มคีย์เต็มประโยคที่ยังขาดจำนวนมาก (เช่น 'ยังไม่มีช่องเวลา — เพิ่มด้านบนได้เลย' มีแค่คีย์ย่อย 'ยังไม่มีช่องเวลา') — เป็นการรื้อทั้งไฟล์ ระดับ minor เสี่ยงทำ regression ถ้าแก้บางส่วนจะได้ UI แปลครึ่งเดียว เกินขอบเขต minimal-fix จึง skip
- **`seller.html`** — [1] field-mismatch: condition/size ของ seller เป็นคนละ vocabulary กับ intake/garment
  - gcond (บรรทัด 101) ถูกส่งเป็น condition:$('gcond').value เข้า seller_submit ตอนนี้ค่าเป็นข้อความไทย ('ใหม่ป้ายห้อย' ฯลฯ) ซึ่งเหมาะกับทีมประเมินอ่าน ถ้าเปลี่ยน option ให้มี value=new/good/fair/poor จะเปลี่ยน payload ที่ backend seller_submit เก็บ = เปลี่ยน contract กับ backend โดยไม่รู้ว่า schema acquisition รับ enum หรือไม่ อีกทั้ง finding เองระบุว่าตอนนี้ค่านี้ยังไม่ถูกส่งข้ามหน้า (ไม่มี seam ตาม [0]) การแก้จะมีความหมายก็ต่อเมื่อสร้าง bridge ตาม [0] ซึ่งเป็นงาน backend/product จึง skip ไม่เดาแก้
- **`webhooks.js`** — [0] webhooks.js เป็น dead code — ไม่มีหน้าไหนโหลดและไม่มีใครเรียก window.webhooks
  - ยืนยันแล้วว่า webhooks.js นิยาม window.webhooks (orderConfirmed/newArrivals/returnReminder/requestReview) ถูกต้องและ syntax ครบ ตัวไฟล์เองไม่มีบั๊กฝั่ง client ที่แก้ได้ ปัญหาคือ 'ไม่มีการ wire' — ทางแก้ทั้งสองทางอยู่นอกขอบเขตไฟล์นี้: (1) ลบ webhooks.js ทิ้ง = ลบฟีเจอร์ (ห้ามตามกฎ) และเป็นการแตะ/ลบไฟล์ (2) โหลด+เรียกใช้ในหน้า flow (slips.html, intake.html, laundry.html) ต้องแก้ไฟล์ HTML อื่นซึ่งห้ามแตะ เนื่องจากกฎบังคับแก้ได้เฉพาะ webhooks.js ไฟล์เดียว และการเปิดใช้งานจริงต้องอาศัยการตัดสินใจว่าจะเดินหน้า integrate n8n หรือลบทิ้ง (เชิง product/infra) จึง skip ไว้ให้ทีมตัดสินใจ ไม่แก้เอง

### ไม่ใช่บั๊ก
- **`join.html`** — [0] join.html ไม่โหลด data.js → API.init() พัง (window.MOCK undefined) → LIVE=false เสมอ
  - อ่าน api.js จริงพบว่า init() มี guard อยู่แล้ว (บรรทัด 71-72: `const MOCK = window.MOCK || {}; let customer = MOCK.CUSTOMER || {};` และบรรทัด 117 `MOCK.OCCASIONS || {}`) โดยคอมเมนต์ระบุชัดว่า event/join/looks/pay ตั้งใจโหลด api.js โดยไม่มี data.js. ตรวจแล้ว looks.html/pay.html ก็ไม่โหลด data.js เช่นกัน ดังนั้น TypeError ที่อ้างในบรรทัด 69 ไม่เกิดแล้ว init() คืนค่าปกติ join.html เข้าโหมด LIVE ได้ — ไม่ต้องเพิ่ม data.js ใน join.html (จะขัดดีไซน์เดิม). การแก้ที่แท้จริงอยู่ฝั่ง api.js ซึ่งไม่ใช่ไฟล์ที่รับผิดชอบและถูก guard ไว้แล้ว
- **`looks.html`** — [1] looks.html ไม่โหลด data.js → API.init() พัง → action ต่าง ๆ เด้ง toast ให้ล็อกอินตลอด
  - อ่าน api.js init() จริง (บรรทัด 69-71) พบว่ามี guard `const MOCK = window.MOCK || {}` อยู่แล้ว พร้อมคอมเมนต์ระบุชัดว่ากันหน้า event/join/looks/pay ที่โหลด api.js โดยไม่มี data.js → init() ไม่โยน TypeError อีกต่อไป และไม่ตกโหมด mock ถาวร. อาการที่รายงานไม่เกิดในโค้ดปัจจุบัน. การเพิ่ม <script src=data.js> เข้ามาไม่จำเป็นและยังเสี่ยงให้ข้อมูล mock รั่ว จึงไม่แก้.
- **`pay.html`** — [0] pay.html ไม่โหลด data.js → init พัง → LIVE=false ตลอด (broken-seam)
  - อ่าน api.js จริงแล้ว init() มี guard `const MOCK = window.MOCK || {}` (api.js:71) และ `MOCK.OCCASIONS || {}` (api.js:117) พร้อมคอมเมนต์ระบุว่าทำไว้สำหรับหน้า pay/event/join/looks ที่ไม่โหลด data.js → ไม่มี TypeError อีกแล้ว init ทำงานปกติ LIVE ได้ตามจริง. pay.html เองไม่ได้อ้าง window.MOCK เลย (MOCK_SUMMARY/MOCK_PAY เป็น const ในไฟล์) การเติม data.js จึงไม่มีผลต่อพฤติกรรม เลยไม่เติมตามหลักเปลี่ยนน้อยสุด. ส่วนความเสี่ยงโชว์บิลปลอมได้แก้ที่ finding [2] แทน.
- **`pay.html`** — [5] pay.html ไม่โหลด data.js → บิล MOCK + QR ปลอม (ซ้ำกับ [0])
  - ส่วน data.js เหมือน [0]: api.js:71 guard window.MOCK แล้ว init ไม่พังอีก. ส่วนความเสี่ยง 'โชว์บิล mock พร้อม QR จ่ายได้จริงในโปรดักชัน' ได้ปิดด้วยการแก้ [2] (บล็อก mock fallback เมื่อ USE_MOCK=false). ไม่เติม data.js เพราะ pay.html ไม่ใช้ window.MOCK และไม่มีผลใด ๆ.
- **`today.html`** — [1] Deep-link คิว 'ต้องส่งวันนี้' → shipout.html?code= ถูกทิ้ง
  - ฝั่ง today.html:115 ถูกต้องแล้ว — สร้างลิงก์ '/shipout.html?code='+encodeURIComponent(x.code) ครบถ้วน จุดที่ต้องแก้จริงคืออ่าน URLSearchParams ใน shipout.html (ไฟล์ของ agent อื่น) ไม่ใช่ today.html
