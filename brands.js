/* LLOOP — canonical Thai IG/lookbook brand taxonomy
   ใช้ enrich หน้าลูกค้า: Shop by Brand chips, หน้ารวมแบรนด์ (directory), ค้นหา alias
   "available" คำนวณตอนรันจาก GARMENTS (แบรนด์ไหนมีของจริง) — ไฟล์นี้เก็บแค่ metadata
   note = "ความเด่น" รายแบรนด์ (แก้ได้อิสระ)  ·  tier: budget ≤1500 / mid 1500-4000 / premium 4000-8000
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

  // name = ชื่อแสดง · aliases = คำค้น/สะกดอื่น (lowercase) · hot = แบรนด์ดีมานด์สูง
  const BRANDS = [
    // — มินิมอล / everyday-premium —
    { key:'mitr',        name:'Mitr',         group:'minimal',  tier:'mid',    hot:true,  aliases:['มิตร','mitr'],            note:'มินิมอลโทนเอิร์ธ คัตติ้งเนี้ยบ ใส่ทำงานทุกวัน' },
    { key:'gentlewoman', name:'Gentlewoman',  group:'minimal',  tier:'mid',    hot:true,  aliases:['gtw','เจนเทิลวูแมน'],     note:'มินิมอลคลีน ดังเรื่องกระเป๋าโท้ท ลุคเรียบเท่' },
    { key:'maison',      name:'Maison',       group:'minimal',  tier:'mid',    hot:false, aliases:['maisonkeep','เมซอง'],     note:'มินิมอลชิค ผ้าดูแพง โทนนุ่ม' },
    { key:'merge',       name:'Merge',        group:'minimal',  tier:'mid',    hot:false, aliases:['เมิร์จ'],                 note:'โมเดิร์นมินิมอล ทรงสะอาดตา' },
    { key:'sarin',       name:'Sarin',        group:'minimal',  tier:'mid',    hot:false, aliases:['ศริน','สาริน'],          note:'เรียบหรู ดีเทลผู้ใหญ่ ออกงานกึ่งทางการ' },
    { key:'larobe8',     name:'Larobe8',      group:'minimal',  tier:'mid',    hot:true,  aliases:['larobe','ลาโรบ'],        note:'เฟมินีนมินิมอล เดรสทำงานทรงสวย' },
    { key:'fabrique',    name:'Fabrique.co',  group:'minimal',  tier:'mid',    hot:false, aliases:['fabrique','fabriqueco'], note:'คอนเทมโพรารี เบสิกมีดีเทล' },
    { key:'patina',      name:'Patina',       group:'minimal',  tier:'mid',    hot:false, aliases:['พาทิน่า'],               note:'โทนวินเทจอบอุ่น เนื้อผ้าดี ลุคเรียบอุ่น' },
    { key:'odc',         name:'ODC',          group:'minimal',  tier:'budget', hot:false, aliases:[],                        note:'เบสิกสตรีท ใส่ง่ายทุกวัน' },
    { key:'movement',    name:'Movement',     group:'minimal',  tier:'mid',    hot:false, aliases:['rally movement'],        note:'แอ็กทีฟ-แคชวล มินิมอลสปอร์ตตี้' },
    { key:'matchbox',    name:'Matchbox',     group:'minimal',  tier:'budget', hot:false, aliases:[],                        note:'แคชวลมินิมอล มิกซ์แอนด์แมตช์ง่าย' },
    { key:'withit',      name:'with.it',      group:'minimal',  tier:'budget', hot:false, aliases:['withit','with it'],      note:'ทันสมัยมินิมอล ตามเทรนด์ไว' },
    { key:'hofstore',    name:'Hofstore',     group:'minimal',  tier:'budget', hot:false, aliases:['hof'],                   note:'เบสิกคลีน ราคาเข้าถึงง่าย' },
    { key:'flat2112',    name:'Flat2112',     group:'minimal',  tier:'budget', hot:true,  aliases:['flat 2112','2112'],      note:'แคชวลสตรีท วัยรุ่นทำงาน' },

    // — หวาน / feminine occasion —
    { key:'aimer',       name:'Aimer',        group:'feminine', tier:'mid',    hot:true,  aliases:['แอเม่','เอเม่'],         note:'หวานละมุน เดรสไปงานแต่ง/ดินเนอร์ ดีเทลโบว์-ลูกไม้' },
    { key:'everymay',    name:'Everymay',     group:'feminine', tier:'mid',    hot:true,  aliases:['everymay.shop','เอเวอรี่เมย์'], note:'เฟมินีนสดใส มีสไตลิสต์แนะนำ ใส่ไปงานได้' },
    { key:'riley',       name:'Riley',        group:'feminine', tier:'mid',    hot:false, aliases:['riley apparels','ไรลี่'], note:'หวานเรียบ เดรสมินิมอล-เฟมินีน' },
    { key:'pirunya',     name:'Pirunya',      group:'feminine', tier:'mid',    hot:false, aliases:['ภิรัญญา','พิรุณ'],       note:'เฟมินีนคลาสสิก เดรสทรงสวยรับงาน' },
    { key:'punchita',    name:'Punchita',     group:'feminine', tier:'mid',    hot:false, aliases:['ปุณชิตา'],               note:'หวานสาวออฟฟิศ เดรส-เซ็ตน่ารัก' },
    { key:'malimays',    name:'Malimays',     group:'feminine', tier:'mid',    hot:false, aliases:['malimay','มะลิเมย์'],    note:'เฟมินีนทันเทรนด์ ลุคสาวเมือง' },
    { key:'nittaya',     name:'Nittaya',      group:'feminine', tier:'mid',    hot:false, aliases:['นิตยา'],                 note:'เฟมินีนไทยร่วมสมัย ดีเทลประณีต' },
    { key:'sawynnii',    name:'Sawynnii',     group:'feminine', tier:'mid',    hot:false, aliases:['sawynni'],               note:'หวานพรีเมียม เดรสออกงาน' },

    // — ป้ายแซ่บ / statement / celeb-evening —
    { key:'mayadress',   name:'Maya Dress',   group:'statement',tier:'premium',hot:true,  aliases:['maya','มายาเดรส','maya dress celeb'], note:'ชุดออกงาน/ราตรี สายเซเลบ เด่นบนพรม — เหมาะเช่าราคาสูง' },
    { key:'mywynn',      name:'Mywynn',       group:'statement',tier:'mid',    hot:false, aliases:['mywyn'],                 note:'ป้ายแซ่บ เดรสเซ็กซี่ออกงานกลางคืน' },
    { key:'secret',      name:'Secret',       group:'statement',tier:'mid',    hot:false, aliases:[],                        note:'ป้ายแซ่บ ลุคเปรี้ยวมั่นใจ' },
    { key:'lism',        name:'Lism',         group:'statement',tier:'mid',    hot:false, aliases:[],                        note:'ป้ายแซ่บมินิมอล-เซ็กซี่ ทรงเข้ารูป' },
    { key:'lalapis',     name:'Lalapis',      group:'statement',tier:'mid',    hot:false, aliases:['ลาลาพิส'],               note:'ป้ายแซ่บหวานเปรี้ยว ดีเทลจัด' },
    { key:'vgh',         name:'VGH',          group:'statement',tier:'mid',    hot:false, aliases:[],                        note:'สตรีท-ลักชัวรี เด่นกราฟิก' },
    { key:'cintage',     name:'Cintage',      group:'statement',tier:'mid',    hot:false, aliases:['ซินเทจ'],                note:'วินเทจ-เรโทร เด่นลายพิมพ์/ทรงยุค' },
    { key:'sos',         name:'SOS',          group:'statement',tier:'budget', hot:false, aliases:[],                        note:'แฟชั่นจัด ตามเทรนด์เร็ว' },
    { key:'firrr',       name:'Firrr',        group:'statement',tier:'mid',    hot:false, aliases:['firrr officials'],       note:'ชุดออกงานทางการ ทรงเป๊ะ' },
    { key:'missmodern',  name:'Miss Modern',  group:'statement',tier:'mid',    hot:false, aliases:['มิสโมเดิร์น'],           note:'ชุดออกงานคลาสสิก ลุคผู้ใหญ่' },

    // — สนุก / party-colorful —
    { key:'pomolo',      name:'Pomolo',       group:'party',    tier:'mid',    hot:true,  aliases:['โพโมโล'],                note:'สีสันสนุก ลายกราฟิก ลุคปาร์ตี้-วันหยุด' },
    { key:'twotwice',    name:'Twotwice',     group:'party',    tier:'budget', hot:false, aliases:['two twice'],             note:'สดใสวัยรุ่น มิกซ์สนุก' },
    { key:'feelfree',    name:'Feelfree',     group:'party',    tier:'budget', hot:false, aliases:['feelfree.bkk'],          note:'ชิล-วันหยุด สบาย ๆ มีสไตล์' },
    { key:'jobsstudio',  name:'Jobs Studio',  group:'party',    tier:'mid',    hot:false, aliases:['joobs studio','joobs'],  note:'ครีเอทีฟ ดีไซน์จัด ลุคอาร์ต' },
    { key:'endlessholiday',name:'Endlessholiday',group:'party', tier:'budget', hot:false, aliases:['endless holiday'],       note:'วันหยุด-วาเคชัน โทนสดใส' },
    { key:'tangerine',   name:'Tangerine',    group:'party',    tier:'budget', hot:false, aliases:['แทนเจอรีน'],             note:'สดใสอบอุ่น เดรสน่ารัก' },
    { key:'chuu',        name:'Chuu',         group:'party',    tier:'budget', hot:false, aliases:['ชู'],                    note:'สไตล์เกาหลี สดใสหวาน' },

    // — โค้ท / outerwear —
    { key:'coatover',    name:'Coatover',     group:'outer',    tier:'mid',    hot:false, aliases:['coatovet'],              note:'ผู้เชี่ยวชาญโค้ท เลเยอร์อุ่น ลุคเที่ยวเมืองหนาว' },
    { key:'howdycoat',   name:'Howdycoat',    group:'outer',    tier:'mid',    hot:false, aliases:['howdy coat'],            note:'โค้ท-แจ็กเก็ตทรงสวย กันหนาวเที่ยวต่างประเทศ' },
    { key:'coatsweater', name:'Coatsweater',  group:'outer',    tier:'mid',    hot:false, aliases:['coat sweater'],          note:'นิต-สเวตเตอร์-โค้ท โทนอุ่น' },

    // — เกาหลีแท้ —
    { key:'mardi',       name:'Mardi',        group:'korean',   tier:'mid',    hot:true,  aliases:['mardi mercredi','มาร์ดิ'], note:'ไอคอนดอกเดซี่ เสื้อ-เดรสมินิมอลเกาหลี' },
    { key:'marithe',     name:'Marithé',      group:'korean',   tier:'mid',    hot:true,  aliases:['marithe','francois girbaud','มาริเต'], note:'โลโก้คลาสสิก ดังในเกาหลี ทีเชิ้ต/เดรส' },
    { key:'emis',        name:'Emis',         group:'korean',   tier:'mid',    hot:false, aliases:['อีมิส'],                 note:'หมวก-กระเป๋า-เสื้อผ้าเกาหลีฮิต' },
    { key:'sculptor',    name:'Sculptor',     group:'korean',   tier:'mid',    hot:false, aliases:['สคัลป์เตอร์'],           note:'สตรีทแวร์เกาหลี ลุคสปอร์ตวัยรุ่น' },

    // — ทะเล / swim —
    { key:'gigi',        name:'Gigi',         group:'swim',     tier:'budget', hot:false, aliases:['gigibeachbabes','gigi beach babes'], note:'ชุดว่ายน้ำ-ชุดทะเล เด่นลุคบีช' }
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

  w.LLOOP_BRANDS = { GROUPS, BRANDS, lookup };
})(window);
