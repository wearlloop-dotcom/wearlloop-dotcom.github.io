/* LLOOP — canonical Thai IG/lookbook brand taxonomy
   ใช้ enrich หน้าลูกค้า: Shop by Brand chips, หน้ารวมแบรนด์ (directory), ค้นหา alias
   "available" คำนวณตอนรันจาก GARMENTS (แบรนด์ไหนมีของจริง) — ไฟล์นี้เก็บแค่ metadata
   note  = "ความเด่น" รายแบรนด์ (แก้ได้อิสระ)
   types = ประเภทของที่แบรนด์นั้นทำ (เดรส/โค้ท/ชุดราตรี/กระเป๋า ฯลฯ) — ใช้กับ sourcing + ค้นหา
   tier: budget ≤1500 / mid 1500-4000 / premium 4000-8000
*/
(function (w) {
  const GROUPS = [
    { key: 'minimal',   label: 'มินิมอล · ใส่ทำงาน-ทุกวัน' },
    { key: 'feminine',  label: 'หวาน · ไปงาน' },
    { key: 'statement', label: 'ป้ายแซ่บ · ออกงาน-เซเลบ' },
    { key: 'party',     label: 'สนุก · ปาร์ตี้-สีสัน' },
    { key: 'outer',     label: 'โค้ท · เลเยอร์เที่ยวหนาว' },
    { key: 'korean',    label: 'เกาหลีแท้' },
    { key: 'swim',      label: 'ทะเล · บีช' }
  ];

  // ประเทศต้นทาง (origin) — แกนแยกจากสไตล์ · default ไทย, group korean → kr
  const ORIGINS = [
    { key: 'th',   label: 'แบรนด์ไทย' },
    { key: 'vn',   label: 'แบรนด์เวียดนาม' },
    { key: 'kr',   label: 'แบรนด์เกาหลี' },
    { key: 'cn',   label: 'แบรนด์จีน' },
    { key: 'intl', label: 'แบรนด์ต่างประเทศ' }
  ];

  // name = ชื่อแสดง · aliases = คำค้น/สะกดอื่น (lowercase) · hot = ดีมานด์สูง · types = ประเภทของ
  const BRANDS = [
    // — มินิมอล / everyday-premium —
    { key:'mitr',        name:'Mitr',         group:'minimal',  tier:'mid',    hot:true,  aliases:['มิตร','mitr'],            types:['เดรส','เสื้อ','กางเกง'],        note:'มินิมอลโทนเอิร์ธ คัตติ้งเนี้ยบ ใส่ทำงานทุกวัน' },
    { key:'gentlewoman', name:'Gentlewoman',  group:'minimal',  tier:'mid',    hot:true,  aliases:['gtw','เจนเทิลวูแมน'],     types:['เดรส','เสื้อ','กระเป๋า'],       note:'มินิมอลคลีน ดังเรื่องกระเป๋าโท้ท ลุคเรียบเท่' },
    { key:'maison',      name:'Maison',       group:'minimal',  tier:'mid',    hot:false, aliases:['maisonkeep','เมซอง'],     types:['เดรส','เสื้อ','ชุดเซ็ต'],       note:'มินิมอลชิค ผ้าดูแพง โทนนุ่ม' },
    { key:'merge',       name:'Merge',        group:'minimal',  tier:'mid',    hot:false, aliases:['เมิร์จ'],                 types:['เดรส','เสื้อ','กางเกง'],        note:'โมเดิร์นมินิมอล ทรงสะอาดตา' },
    { key:'sarin',       name:'Sarin',        group:'minimal',  tier:'mid',    hot:false, aliases:['ศริน','สาริน'],          types:['เดรส','ชุดเซ็ต'],              note:'เรียบหรู ดีเทลผู้ใหญ่ ออกงานกึ่งทางการ' },
    { key:'larobe8',     name:'Larobe8',      group:'minimal',  tier:'mid',    hot:true,  aliases:['larobe','ลาโรบ'],        types:['เดรส','ชุดเซ็ต'],              note:'เฟมินีนมินิมอล เดรสทำงานทรงสวย' },
    { key:'fabrique',    name:'Fabrique.co',  group:'minimal',  tier:'mid',    hot:false, aliases:['fabrique','fabriqueco'], types:['เดรส','เสื้อ','กางเกง'],        note:'คอนเทมโพรารี เบสิกมีดีเทล' },
    { key:'patina',      name:'Patina',       group:'minimal',  tier:'mid',    hot:false, aliases:['พาทิน่า'],               types:['เดรส','เสื้อ'],                note:'โทนวินเทจอบอุ่น เนื้อผ้าดี ลุคเรียบอุ่น' },
    { key:'odc',         name:'ODC',          group:'minimal',  tier:'budget', hot:false, aliases:[],                        types:['เสื้อ','กางเกง'],              note:'เบสิกสตรีท ใส่ง่ายทุกวัน' },
    { key:'movement',    name:'Movement',     group:'minimal',  tier:'mid',    hot:false, aliases:['rally movement'],        types:['เสื้อ','กางเกง','แอ็กทีฟแวร์'], note:'แอ็กทีฟ-แคชวล มินิมอลสปอร์ตตี้' },
    { key:'matchbox',    name:'Matchbox',     group:'minimal',  tier:'budget', hot:false, aliases:[],                        types:['เสื้อ','ชุดเซ็ต'],             note:'แคชวลมินิมอล มิกซ์แอนด์แมตช์ง่าย' },
    { key:'withit',      name:'with.it',      group:'minimal',  tier:'budget', hot:false, aliases:['withit','with it'],      types:['เดรส','เสื้อ'],                note:'ทันสมัยมินิมอล ตามเทรนด์ไว' },
    { key:'hofstore',    name:'Hofstore',     group:'minimal',  tier:'budget', hot:false, aliases:['hof'],                   types:['เสื้อ','เดรส'],                note:'เบสิกคลีน ราคาเข้าถึงง่าย' },
    { key:'flat2112',    name:'Flat2112',     group:'minimal',  tier:'budget', hot:true,  aliases:['flat 2112','2112'],      types:['เสื้อ','ชุดเซ็ต','กางเกง'],     note:'แคชวลสตรีท วัยรุ่นทำงาน' },

    // — หวาน / feminine occasion —
    { key:'aimer',       name:'Aimer',        group:'feminine', tier:'mid',    hot:true,  aliases:['แอเม่','เอเม่'],         types:['เดรส'],                        note:'หวานละมุน เดรสไปงานแต่ง/ดินเนอร์ ดีเทลโบว์-ลูกไม้' },
    { key:'everymay',    name:'Everymay',     group:'feminine', tier:'mid',    hot:true,  aliases:['everymay.shop','เอเวอรี่เมย์'], types:['เดรส','ชุดเซ็ต'],         note:'เฟมินีนสดใส มีสไตลิสต์แนะนำ ใส่ไปงานได้' },
    { key:'riley',       name:'Riley',        group:'feminine', tier:'mid',    hot:false, aliases:['riley apparels','ไรลี่'], types:['เดรส','เสื้อ'],               note:'หวานเรียบ เดรสมินิมอล-เฟมินีน' },
    { key:'pirunya',     name:'Pirunya',      group:'feminine', tier:'mid',    hot:false, aliases:['ภิรัญญา','พิรุณ'],       types:['เดรส'],                        note:'เฟมินีนคลาสสิก เดรสทรงสวยรับงาน' },
    { key:'punchita',    name:'Punchita',     group:'feminine', tier:'mid',    hot:false, aliases:['ปุณชิตา'],               types:['เดรส','ชุดเซ็ต'],              note:'หวานสาวออฟฟิศ เดรส-เซ็ตน่ารัก' },
    { key:'malimays',    name:'Malimays',     group:'feminine', tier:'mid',    hot:false, aliases:['malimay','มะลิเมย์'],    types:['เดรส','เสื้อ'],                note:'เฟมินีนทันเทรนด์ ลุคสาวเมือง' },
    { key:'nittaya',     name:'Nittaya',      group:'feminine', tier:'mid',    hot:false, aliases:['นิตยา'],                 types:['เดรส','ชุดไทยร่วมสมัย'],        note:'เฟมินีนไทยร่วมสมัย ดีเทลประณีต' },
    { key:'sawynnii',    name:'Sawynnii',     group:'feminine', tier:'mid',    hot:false, aliases:['sawynni'],               types:['เดรส','ชุดออกงาน'],            note:'หวานพรีเมียม เดรสออกงาน' },

    // — ป้ายแซ่บ / statement / celeb-evening —
    { key:'mayadress',   name:'Maya Dress',   group:'statement',tier:'premium',hot:true,  aliases:['maya','มายาเดรส','maya dress celeb'], types:['ชุดราตรี','ชุดออกงาน'], note:'ชุดออกงาน/ราตรี สายเซเลบ เด่นบนพรม — เหมาะเช่าราคาสูง' },
    { key:'mywynn',      name:'Mywynn',       group:'statement',tier:'mid',    hot:false, aliases:['mywyn'],                 types:['เดรส','ชุดออกงาน'],            note:'ป้ายแซ่บ เดรสเซ็กซี่ออกงานกลางคืน' },
    { key:'secret',      name:'Secret',       group:'statement',tier:'mid',    hot:false, aliases:[],                        types:['เดรส'],                        note:'ป้ายแซ่บ ลุคเปรี้ยวมั่นใจ' },
    { key:'lism',        name:'Lism',         group:'statement',tier:'mid',    hot:false, aliases:[],                        types:['เดรส'],                        note:'ป้ายแซ่บมินิมอล-เซ็กซี่ ทรงเข้ารูป' },
    { key:'lalapis',     name:'Lalapis',      group:'statement',tier:'mid',    hot:false, aliases:['ลาลาพิส'],               types:['เดรส'],                        note:'ป้ายแซ่บหวานเปรี้ยว ดีเทลจัด' },
    { key:'vgh',         name:'VGH',          group:'statement',tier:'mid',    hot:false, aliases:[],                        types:['เสื้อ','เดรส'],                note:'สตรีท-ลักชัวรี เด่นกราฟิก' },
    { key:'cintage',     name:'Cintage',      group:'statement',tier:'mid',    hot:false, aliases:['ซินเทจ'],                types:['เดรส','เสื้อ'],                note:'วินเทจ-เรโทร เด่นลายพิมพ์/ทรงยุค' },
    { key:'sos',         name:'SOS',          group:'statement',tier:'budget', hot:false, aliases:[],                        types:['เดรส','เสื้อ'],                note:'แฟชั่นจัด ตามเทรนด์เร็ว' },
    { key:'firrr',       name:'Firrr',        group:'statement',tier:'mid',    hot:false, aliases:['firrr officials'],       types:['ชุดออกงาน','เดรส'],            note:'ชุดออกงานทางการ ทรงเป๊ะ' },
    { key:'missmodern',  name:'Miss Modern',  group:'statement',tier:'mid',    hot:false, aliases:['มิสโมเดิร์น'],           types:['ชุดออกงาน','เดรส'],            note:'ชุดออกงานคลาสสิก ลุคผู้ใหญ่' },

    // — สนุก / party-colorful —
    { key:'pomolo',      name:'Pomolo',       group:'party',    tier:'mid',    hot:true,  aliases:['โพโมโล'],                types:['เดรส','เสื้อ','ชุดเซ็ต'],       note:'สีสันสนุก ลายกราฟิก ลุคปาร์ตี้-วันหยุด' },
    { key:'twotwice',    name:'Twotwice',     group:'party',    tier:'budget', hot:false, aliases:['two twice'],             types:['เดรส','เสื้อ'],                note:'สดใสวัยรุ่น มิกซ์สนุก' },
    { key:'feelfree',    name:'Feelfree',     group:'party',    tier:'budget', hot:false, aliases:['feelfree.bkk'],          types:['เดรส','ชุดเซ็ต'],              note:'ชิล-วันหยุด สบาย ๆ มีสไตล์' },
    { key:'jobsstudio',  name:'Jobs Studio',  group:'party',    tier:'mid',    hot:false, aliases:['joobs studio','joobs'],  types:['เดรส','เสื้อ'],                note:'ครีเอทีฟ ดีไซน์จัด ลุคอาร์ต' },
    { key:'endlessholiday',name:'Endlessholiday',group:'party', tier:'budget', hot:false, aliases:['endless holiday'],       types:['เดรส','ชุดเซ็ต'],              note:'วันหยุด-วาเคชัน โทนสดใส' },
    { key:'tangerine',   name:'Tangerine',    group:'party',    tier:'budget', hot:false, aliases:['แทนเจอรีน'],             types:['เดรส','เสื้อ'],                note:'สดใสอบอุ่น เดรสน่ารัก' },
    { key:'chuu',        name:'Chuu',         group:'party',    tier:'budget', hot:false, aliases:['ชู'],                    types:['เดรส','เสื้อ','กางเกง'],        note:'สไตล์เกาหลี สดใสหวาน' },

    // — โค้ท / outerwear —
    { key:'coatover',    name:'Coatover',     group:'outer',    tier:'mid',    hot:false, aliases:['coatovet'],              types:['โค้ท','แจ็กเก็ต'],             note:'ผู้เชี่ยวชาญโค้ท เลเยอร์อุ่น ลุคเที่ยวเมืองหนาว' },
    { key:'howdycoat',   name:'Howdycoat',    group:'outer',    tier:'mid',    hot:false, aliases:['howdy coat'],            types:['โค้ท','แจ็กเก็ต'],             note:'โค้ท-แจ็กเก็ตทรงสวย กันหนาวเที่ยวต่างประเทศ' },
    { key:'coatsweater', name:'Coatsweater',  group:'outer',    tier:'mid',    hot:false, aliases:['coat sweater'],          types:['โค้ท','นิต','สเวตเตอร์'],       note:'นิต-สเวตเตอร์-โค้ท โทนอุ่น' },

    // — เกาหลีแท้ —
    { key:'mardi',       name:'Mardi',        group:'korean',   tier:'mid',    hot:true,  aliases:['mardi mercredi','มาร์ดิ'], types:['เสื้อยืด','เดรส','นิต'],      note:'ไอคอนดอกเดซี่ เสื้อ-เดรสมินิมอลเกาหลี' },
    { key:'marithe',     name:'Marithé',      group:'korean',   tier:'mid',    hot:true,  aliases:['marithe','francois girbaud','มาริเต'], types:['เสื้อยืด','เสื้อ'],     note:'โลโก้คลาสสิก ดังในเกาหลี ทีเชิ้ต/เดรส' },
    { key:'emis',        name:'Emis',         group:'korean',   tier:'mid',    hot:false, aliases:['อีมิส'],                 types:['หมวก','กระเป๋า','เสื้อ'],       note:'หมวก-กระเป๋า-เสื้อผ้าเกาหลีฮิต' },
    { key:'sculptor',    name:'Sculptor',     group:'korean',   tier:'mid',    hot:false, aliases:['สคัลป์เตอร์'],           types:['เสื้อ','กางเกง'],              note:'สตรีทแวร์เกาหลี ลุคสปอร์ตวัยรุ่น' },

    // — ทะเล / swim —
    { key:'gigi',        name:'Gigi',         group:'swim',     tier:'budget', hot:false, aliases:['gigibeachbabes','gigi beach babes'], types:['ชุดว่ายน้ำ','ชุดทะเล'], note:'ชุดว่ายน้ำ-ชุดทะเล เด่นลุคบีช' },

    // — เวียดนาม (origin=vn) · style/vibe เป็น best-guess แก้ได้อิสระ · ส่งเพิ่มได้ —
    { key:'lseoul',      name:'Lseoul',       group:'feminine', origin:'vn', tier:'mid', hot:true,  aliases:['lseoul','แอลโซล'],              types:['เดรส','เสื้อ'],   note:'เฟมินีนเวียดนามยอดฮิต ลุคสาวหวาน' },
    { key:'huelleyrose', name:'Huelleyrose',  group:'feminine', origin:'vn', tier:'mid', hot:true,  aliases:['huelley rose','huelley'],       types:['เดรส'],          note:'หวานโรแมนติก เดรสออกงาน (เวียดนาม)' },
    { key:'ononmade',    name:'Ononmade',     group:'feminine', origin:'vn', tier:'mid', hot:false, aliases:['ononmad','on on made'],         types:['เดรส','ชุดเซ็ต'], note:'เฟมินีนมินิมอล (เวียดนาม)' },
    { key:'redbean',     name:'Redbean',      group:'party',    origin:'vn', tier:'mid', hot:false, aliases:['red bean','redbean beachclub'], types:['เดรส','ชุดทะเล'], note:'สดใส beachclub วันหยุด (เวียดนาม)' },
    { key:'ibiboss',     name:'Ibiboss',      group:'statement',origin:'vn', tier:'mid', hot:false, aliases:['ibi boss'],                     types:['เดรส'],          note:'ป้ายแซ่บ ลุคมั่นใจ (เวียดนาม)' },
    { key:'lanchy',      name:'Lanchy',       group:'feminine', origin:'vn', tier:'mid', hot:false, aliases:['lanchi'],                       types:['เดรส','เสื้อ'],   note:'เฟมินีนเวียดนาม' },

    // — แบรนด์ไทย (house/อินดี้) —
    { key:'lookbook',    name:'Lookbook',     group:'feminine', origin:'th', tier:'budget', hot:true, aliases:['lookbook'],                   types:['เดรส','เสื้อ','กางเกง'], note:'แบรนด์ไทย ลุคเฟมินีน-แคชวล (vibe แก้ได้)' }
  ];

  // map ชื่อแบรนด์ (lowercase) + alias → entry  สำหรับค้นหา/จับคู่กับ g.brand
  const INDEX = {};
  BRANDS.forEach(b => {
    INDEX[b.name.toLowerCase()] = b;
    INDEX[b.key.toLowerCase()] = b;
    (b.aliases || []).forEach(a => { INDEX[String(a).toLowerCase()] = b; });
  });

  // หา metadata จากชื่อแบรนด์ที่ติดมากับชุด (g.brand) — รองรับสะกดต่าง/มี alias
  function lookup(brandName) {
    if (!brandName) return null;
    const k = String(brandName).trim().toLowerCase();
    if (INDEX[k]) return INDEX[k];
    // เผื่อชื่อมีคำต่อท้าย เช่น "Aimer official" → จับคำแรกที่ match
    for (const key in INDEX) { if (k.includes(key) && key.length >= 3) return INDEX[key]; }
    return null;
  }

  // ชื่อมาตรฐานของแบรนด์ — ถ้าตรง taxonomy คืนชื่อแสดง (กันสะกด/ตัวพิมพ์เพี้ยน เช่น "aimer"/"AIMER"→"Aimer")
  function canon(name) { const m = lookup(name); return m ? m.name : (name ? String(name).trim() : ''); }
  // origin ของแบรนด์ — default ไทย, group korean → เกาหลี (แบรนด์ vn ระบุ origin เอง)
  function originOf(b) { return b && (b.origin || (b.group === 'korean' ? 'kr' : 'th')); }

  w.LLOOP_BRANDS = { GROUPS, ORIGINS, BRANDS, lookup, canon, originOf };
})(window);
