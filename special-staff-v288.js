/* V288 keeps ownership and learning authoritative on the server. */
(function (root) {
 'use strict';
 const rarities = {common:'Yaygın', rare:'Nadir', very_rare:'Çok nadir', unique:'Eşsiz'};
 const rarityKeys = Object.keys(rarities);
 const fmt = value => new Intl.NumberFormat('tr-TR', {maximumFractionDigits:3}).format(Number(value) || 0);
 const plain = value => String(value || '').replace(/\*\*/g, '');
 const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
 };
 function button(text, action, className) {
  const node = element('button', className, text);
  node.type = 'button';
  node.onclick = action;
  return node;
 }
 function papyrusIcon() {
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
  icon.setAttribute('class','ss288-paper-symbol');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');
  icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.4');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');
  const outline=document.createElementNS('http://www.w3.org/2000/svg','path');
  outline.setAttribute('d','M6 3h12a2 2 0 0 1 2 2v3h-4V5a2 2 0 0 1 2-2M6 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M4 17h10v2a2 2 0 0 0 2 2M8 8h5M8 11h5M8 14h5');
  icon.append(outline);return icon;
 }
 function valueOf(paper) {
  const effect = paper.effect || paper.effects?.[0] || {};
  const amount = effect.unit === 'fraction' ? Number(effect.value || 0) * 100 : Number(effect.percent ?? effect.value ?? 0);
  const operation = effect.operation || '';
  if (operation === 'add_probability' || operation === 'add_percentage_points') return '+' + fmt(amount);
  if (/decrease/.test(operation)) return '−%' + fmt(amount);
  if (/probability/.test(operation)) return '%' + fmt(amount);
  return '+%' + fmt(amount);
 }
 function conditionsOf(paper) {
  const words = {arena:'Arena',own_ludus_gladiator:'Kendi ludusunun gladyatörü',trident:'Trident',spear:'Mızrak',sword:'Kılıç',axe:'Balta',halberd:'Teber',mace:'Gürz',hammer:'Çekiç',net:'Ağ',whip:'Kırbaç',shield:'Kalkan',normal_attack:'Normal saldırı',special_area_attack:'Özel alan saldırısı',second:'İkinci hedef',shield_break_special:'Kalkan kırma',net_throw:'Ağ atma',whip_pull:'Kırbaçla çekme',spear_throw:'Mızrak fırlatma',trident_throw:'Trident fırlatma',shield_push_special:'Kalkanla itme',large:'Büyük kalkan',small:'Küçük kalkan',medium:'Orta kalkan',helmet:'Miğfer',chest_armor:'Göğüs zırhı',manica:'Kolluk',greave:'Bacaklık',head:'Baş',torso:'Gövde',arm:'Kol',leg:'Bacak'};
  return (paper.conditions || []).map(condition => {
   if (typeof condition === 'string') return condition.replace(/emerald/g,'zümrüt').replace(/sapphire/g,'safir');
   if (!condition || ['mode','beneficiary'].includes(condition.field)) return '';
   if (condition.field === 'block_successful') return 'Başarılı blok';
   if (condition.field === 'hit_region_covered_by_equipment') return 'Takılı ekipmanın koruduğu bölge';
   return [].concat(condition.value ?? []).map(value => words[value]).filter(Boolean).join(' / ');
  }).filter(Boolean);
 }
 const smithLabels = ['Genel + basma başarısı','+1–+4 hedef geliştirme','+5–+8 hedef geliştirme','+9 ve üzeri hedef geliştirme','Başarılı + basıştan sonraki deneme','+ basma serisinde 3. ve sonrası','+ basma serisinde 5. ve sonrası','Başarısız + basıştan sonraki deneme','İki başarısız + basış sonrası','Safir · Genel kalite şansı','Safir · Seride 3. ve sonrası','Safir · Seride 5. ve sonrası','Safir · Önceki sonuç %95 altındaysa','Safir · Son iki sonuç %95 altındaysa','Safir · Mevcut item +5–+8 ise','Safir · Mevcut item +9 ve üzeriyse','Safir · Itemde %95+ zümrüt varsa','Zümrüt · Genel kalite şansı','Zümrüt · Seride 3. ve sonrası','Zümrüt · Seride 5. ve sonrası','Zümrüt · Önceki sonuç %95 altındaysa','Zümrüt · Son iki sonuç %95 altındaysa','Zümrüt · Mevcut item +5–+8 ise','Zümrüt · Mevcut item +9 ve üzeriyse','Zümrüt · Itemde %95+ safir varsa'];
 // Labels describe the effect and its trigger; the separate value keeps the
 // authoritative amount. Never strip percentages: some are trigger thresholds.
 const effectLabels = {
  smith:smithLabels,
  trainer:[
   'Trident · Kritik vuruş ihtimali',
   'Mızrak · Verilen hasar',
   'Kılıç saldırısı · Kondisyon tüketimi',
   'Balta · Kritik vuruş hasarı',
   'Teber alan saldırısı · İkinci hedef hasarı',
   'Gürzle kalkan kırma · Kondisyon tüketimi',
   'Çekiç · Verilen hasar',
   'Ağ atma · Kondisyon tüketimi',
   'Kırbaçla çekme · Kondisyon tüketimi',
   'Büyük kalkanla başarılı blok · Kondisyon tüketimi',
   'Küçük/orta kalkanla başarılı blok · Kondisyon tüketimi',
   'Miğferin koruduğu baş · Alınan hasar',
   'Göğüs zırhının koruduğu bölge · Alınan hasar',
   'Kolluğun koruduğu kol · Alınan hasar',
   'Bacaklığın koruduğu bölge · Alınan hasar',
   'Kılıç · Kritik vuruş hasarı',
   'Mızrak fırlatma · Kondisyon tüketimi',
   'Trident fırlatma · Kondisyon tüketimi',
   'Balta normal saldırısı · Kondisyon tüketimi',
   'Teber normal saldırısı · Kondisyon tüketimi',
   'Çekiçle kalkan kırma · Kondisyon tüketimi',
   'Kalkanla itme · Kondisyon tüketimi',
   'Trident normal saldırısı · Kondisyon tüketimi',
   'Kırbaç normal saldırısı · Verilen hasar',
   'Gürz normal saldırısı · Verilen hasar'
  ],
  cook:[
   'Maksimum arena kondisyonu',
   'Koşu · Kondisyon tüketimi',
   'Normal saldırı · Kondisyon tüketimi',
   'Başarılı blok · Kondisyon tüketimi',
   'Yuvarlanma · Kondisyon tüketimi',
   'Özel hareket · Kondisyon tüketimi',
   'Kondisyon yenilenme hızı',
   'Kondisyon %25 altındayken · Yenilenme hızı',
   'Maksimum arena kondisyonu',
   'Başarılı blok · Kondisyon tüketimi',
   'Normal saldırı · Kondisyon tüketimi',
   'Yuvarlanma · Kondisyon tüketimi',
   'Koşu · Kondisyon tüketimi',
   'Kondisyon yenilenme hızı',
   'Özel hareket · Kondisyon tüketimi',
   'Kayma · Kondisyon tüketimi',
   'Kondisyon yenilenmesine başlama bekleme süresi',
   'İlk ayağa kalkış · Maks. kondisyon iadesi (1/maç)',
   'İlk rakip öldürme · Maks. kondisyon iadesi (1/maç)',
   'Kondisyon %25 altındayken blok · Maks. kondisyon iadesi (1/maç)',
   '3 ardışık normal isabet · Maks. kondisyon iadesi (1/maç)',
   'Özel hamlede 2+ rakibe isabet · Maks. kondisyon iadesi',
   '5 sn’de 2 farklı rakibi blok · Maks. kondisyon iadesi (1/maç)',
   'İlk asist · Maks. kondisyon iadesi (1/maç)',
   '60. saniyede hayattayken · Maks. kondisyon iadesi (1/maç)'
  ],
  doctor:[
   '2+ sargılı tedavi · Bir sargı koruma ihtimali',
   'Atelli tedavi · Bir atel koruma ihtimali',
   'Sirkeli Sünger · Bir adet koruma ihtimali',
   'Balmumu Merhemi · Bir doz koruma ihtimali',
   'Defne Merhemi · Bir doz koruma ihtimali',
   'Ballı Sirke Şurubu · Ek yorgunluk giderimi',
   'İncir Şurubu · Taburculukta yorgunluk giderimi',
   '3 saatlik revir · Yorgunluk azalma hızı',
   '12 saatlik revir · Yorgunluk azalma hızı',
   '24 saatlik revir · Yorgunluk azalma hızı',
   'Omuzda zırh vurması ihtimali',
   'Hafif baldır zorlanması ihtimali',
   'Ayak bileği burkulması ihtimali',
   'Kırık sonrası ilk maç · Aynı kemiğin yeniden kırılma ihtimali',
   'Ağır kafa travması sonrası ilk maç · Aynı travmanın tekrarı',
   'Maçta düşme · Diz sıyrığı ihtimali',
   'Baş darbesi · Kaş yarılması ihtimali',
   'Omza darbe · Omuz ezilmesi ihtimali',
   'Derin ön kol kesiği · Bir sargı koruma ihtimali',
   'Kaburga ezilmesi · Ballı Sirke Şurubuyla ek yorgunluk giderimi',
   'Açık kaval kırığı → kapalı, parçalı olmayan kırık ihtimali',
   'Sert düşüş · Leğen kemiği kırığı ihtimali',
   'Ağır gövde darbesi · İç kanamalı karın yaralanması ihtimali',
   'Kötü sakatlık sonrası ilk maç · Farklı kötü sakatlık ihtimali',
   'Aynı klan savaşı · 2. ve sonraki yaralıda bir sarf malzemesi koruma'
  ],
  groom:[
   'Beslenmeden gelen maksimum yarış kondisyonu',
   'Atın kondisyon antrenmanı gelişimi',
   'Yarış sonrası ahırda kondisyon yenilenme hızı',
   'Yarışın ilk hızlanması · Kondisyon tüketimi',
   'İlk tur, orta hız · Kondisyon tüketimi',
   'Düzlükte en yüksek hız · Kondisyon tüketimi',
   'Orta hızla girilen viraj · Kondisyon tüketimi',
   'Viraj çıkışında ilk hızlanma · Kondisyon tüketimi',
   '5 sn korunan hız kademesi · Kondisyon tüketimi',
   'Düşük hız kademesi · Kondisyon yenilenme hızı',
   'Düzlükte rakibe bir araba boyu mesafe · Hızlanma kondisyon tüketimi',
   'Çarpışma öncesi hıza dönüş · Kondisyon tüketimi',
   'Atın kondisyonu %25 altındayken · Yenilenme hızı',
   '5. tura en az %50 kondisyonla giriş · Maks. kondisyon iadesi',
   '5. turun son düzlüğü, en yüksek hız · Kondisyon tüketimi',
   'Yarış içinde hızlanma hızı',
   'Virajdan kaynaklanan hız kaybı',
   'Çarpışmadan kaynaklanan hız kaybı',
   'Virajda yön değiştirme hızı',
   'Atın hız antrenmanı gelişimi',
   'Atın antrenmandan kazandığı yorgunluk',
   'Yarışın ilk hızlanmasının hızı',
   '5. tur · Maksimum hız',
   'Yarış sonunda ata eklenen yorgunluk',
   '5. tur, kondisyon %25 altında · Hızlanma kondisyon tüketimi'
  ],
  guard:[
   'Kervan savunması · Saldırı bonusu',
   'Silahlı işçi · Ok hasarı',
   'Gladyatör normal yakın dövüşü · Kondisyon tüketimi',
   'Mızrak fırlatma · Kondisyon tüketimi',
   'Trident fırlatma · Kondisyon tüketimi',
   'Başarılı kalkan bloğu · Kondisyon tüketimi',
   'Kalkanla itme · Kondisyon tüketimi',
   'Yuvarlanma · Kondisyon tüketimi',
   'Koşu · Kondisyon tüketimi',
   'Savunmacı gladyatör · Kondisyon yenilenme hızı',
   'Kondisyon %25 altındayken · Yenilenme hızı',
   'Can %25 altındayken · Gladyatöre gelen hasar',
   'İşçi · Gelen ok hasarı',
   'İşçi · Gelen yakın dövüş hasarı',
   'Yük arabası · Gelen ok hasarı',
   'Yük arabası · Gelen yakın dövüş hasarı',
   'Miğferin koruduğu baş · Alınan hasar',
   'Göğüs zırhının koruduğu bölge · Alınan hasar',
   'Kolluğun koruduğu kol · Alınan hasar',
   'Bacaklığın koruduğu bölge · Alınan hasar',
   '1. dalga · Savunmacı gladyatörün verdiği hasar',
   '5. dalga · Savunmacı gladyatörün verdiği hasar',
   'Ağ atma · Kondisyon tüketimi',
   'Kırbaçla çekme · Kondisyon tüketimi',
   'Gürz/çekiçle kalkan kırma · Kondisyon tüketimi'
  ]
 };
 function effectLabel(paper) {
  const ordinal=Number(paper.ordinal || (paper.content_id||paper.id)?.match(/(\d+)$/)?.[1]);
  return effectLabels[paper.role]?.[ordinal-1] || plain(paper.effect_text || paper.effects?.[0]?.label);
 }
 function create(ctx) {
  const defs = root.LudusSpecialPeople.roles;
  let opened = false, role = 'trainer', screen = 'directory', owner = null, data = null;
  let loading = false, busy = false, serial = 0, lastFocus = null, pending = null;
  let ownership = 'all', rarity = 'common', selected = null, archivePage = 0, homePage = 0;
  let legacy = null, legacyPage = 0, legacyUnique = false;
  const newlyLearned = new Set();
  const modal = element('section','special-staff ss288');
  modal.id = 'specialStaffModal';
  modal.hidden = true;
  modal.setAttribute('role','dialog');
  modal.setAttribute('aria-modal','true');
  modal.setAttribute('aria-labelledby','specialStaffTitle');
  const header = element('header','ss288-header');
  const back = button('←',goBack,'ss288-back');
  const heading = element('h1','','Özel çalışanlar');
  heading.id = 'specialStaffTitle';
  header.append(back,heading,element('span','ss288-brand','COLOSSEUM & MAGNUS'));
  const tabs = element('nav','ss288-tabs');
  tabs.setAttribute('aria-label','Çalışan bölümleri');
  const homeTab = button('Ana sayfa',()=>navigate('home'),'ss288-tab');
  const archiveTab = button('Papirüsler',()=>openArchive(),'ss288-tab');
  tabs.append(homeTab,archiveTab);
  const body = element('main','ss288-body');
  const footer = element('footer','ss288-footer');
  const status = element('span');
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  const retry = button('Yeniden dene',()=>pending ? submit() : refresh(),'ss288-retry');
  retry.hidden = true;
  footer.append(status,retry);
  modal.append(header,tabs,body,footer);
  document.body.append(modal);
  const detail = element('dialog','ss288-dialog');
  detail.setAttribute('aria-labelledby','staffDetailTitle');
  document.body.append(detail);
  const person = () => defs.find(entry => entry.id === role);
  const state = () => data?.staff?.find(entry => entry.id === role);
  const papers = () => data?.role === role ? data.papyri || [] : [];
  const learned = paper => !!(paper.learned || paper.read_at);
  const quantity = paper => Math.max(0,Number(paper.owned_quantity) || 0);
  const acquired = paper => learned(paper) || quantity(paper) > 0;
  const readable = paper => !learned(paper) && quantity(paper) > 0;
  const key = paper => paper.content_id || paper.id;
  const active = paper => (paper.runtime_status || paper.runtime_binding_status) === 'active';
  const readLabels = {trainer:'Doctore’ye okut',cook:'Aşçıya okut',doctor:'Doktora okut',smith:'Demirciye okut',guard:'Muhafıza okut',groom:'Seyise okut'};
  function message(text,error=false) { status.textContent = text; status.dataset.error = String(error); }
  function portrait(definition, className='ss288-portrait') {
   const wrapper = element('div',className);
   const img = element('img');
   img.alt = definition.title;
   img.src = ctx.portraits?.[definition.id] || definition.portrait || 'assets/staff-v288/' + definition.id + '.webp';
   img.onerror = () => { img.hidden = true; wrapper.append(element('span','ss288-portrait-fallback',definition.name.slice(0,1))); };
   wrapper.append(img);
   return wrapper;
  }
  function enter() {
   if (opened) return;
   opened = true;
   lastFocus = document.activeElement;
   modal.hidden = false;
   ctx.onOpen?.();
  }
  function navigate(target) {
   if (busy || loading || screen === target) return;
   screen = target;
   if (target === 'home') homePage = 0;
   render();
  }
  function counts() {
   const all = papers();
   return {owned:all.filter(acquired).length,learned:all.filter(learned).length,readable:all.filter(readable).length,missing:all.filter(paper=>!acquired(paper)).length};
  }
  function filtered() {
   return papers().filter(paper => paper.rarity === rarity && (ownership === 'all' || ownership === 'owned' && acquired(paper) || ownership === 'missing' && !acquired(paper) || ownership === 'learned' && learned(paper) || ownership === 'readable' && readable(paper)));
  }
  function openArchive(filter='all', chosenRarity=null) {
   if (busy || loading) return;
   ownership = typeof filter === 'string' ? filter : 'all';
   rarity = chosenRarity || 'common';
   if (!chosenRarity && ownership !== 'all') {
    const candidate = papers().find(paper => ownership === 'owned' && acquired(paper) || ownership === 'missing' && !acquired(paper) || ownership === 'learned' && learned(paper) || ownership === 'readable' && readable(paper));
    if (candidate) rarity = candidate.rarity;
   }
   screen = 'archive';
   selected = null;
   archivePage = 0;
   render();
  }
  function showInfo(paper) {
   const title = element('h2','',plain(paper.effect_text || effectLabel(paper)));
   title.id = 'staffDetailTitle';
   detail.replaceChildren(title);
   const conditions = conditionsOf(paper);
   if (conditions.length) detail.append(element('p','',conditions.join(' · ')));
   const runtimeNote=paper.runtime_note||paper.runtime_reason;
   if(runtimeNote)detail.append(element('p','ss288-runtime-note',runtimeNote));
   const effect = paper.effect || {};
   if (effect.operation === 'add_probability' || effect.operation === 'add_percentage_points') detail.append(element('p','','Katkı '+valueOf(paper)+' yüzde puandır.'));
   detail.append(button('Kapat',()=>detail.close(),'ss288-dialog-close'));
   detail.showModal();
  }
  function calculation() {
   if (ctx.openCalculation) ctx.openCalculation(role);
   else root.location.assign(new URL('gelistirmeler.html?v=revision288&smith=1',root.location.href).href);
  }
  function renderDirectory() {
   const directory = element('div','ss288-directory');
   for (const definition of defs) {
    const staff = data?.staff?.find(entry=>entry.id===definition.id);
    const card = button('',()=>open(definition.id),'ss288-person');
    card.dataset.role = definition.id;
    const info = element('div','ss288-person-text');
    info.append(element('strong','',definition.title),element('small','',definition.place));
    info.append(element('span','ss288-person-count',staff ? fmt(staff.collected)+' / 25 bilgi' : 'Bilgiler yükleniyor…'));
    card.append(portrait(definition,'ss288-person-portrait'),info);
    directory.append(card);
   }
   body.append(directory);
  }
  function countLink(label,value,filter) {
   const row = button('',()=>openArchive(filter),'ss288-count');
   row.append(element('span','',label),element('strong','',value+' ›'));
   row.disabled = loading;
   return row;
  }
  function pager(current,total,action,className='ss288-pager') {
   const row = element('div',className);
   const previous = button('‹',()=>action(current-1));
   const next = button('›',()=>action(current+1));
   previous.setAttribute('aria-label','Önceki sayfa');
   next.setAttribute('aria-label','Sonraki sayfa');
   previous.disabled = loading || busy || current === 0;
   next.disabled = loading || busy || current >= total-1;
   row.append(previous,element('span','', 'Sayfa '+(current+1)+' / '+Math.max(1,total)),next);
   return row;
  }
  function renderHome() {
   const definition = person(), count = counts();
   const home = element('div','ss288-home');
   const summary = element('div','ss288-summary');
   const text = element('div','ss288-summary-text');
   text.append(element('h2','',definition.title),element('span','',definition.id==='smith'?'Geliştirme ve taş işçiliği':definition.profession));
   const overall = element('div','ss288-overall');
   overall.append(element('span','','Overall'),element('strong','',data?.role===role?fmt(count.owned*4)+' / 100':'— / 100'));
   summary.append(portrait(definition),text,overall);
   const columns = element('div','ss288-home-columns');
   const sidebar = element('aside','ss288-sidebar');
   sidebar.append(element('h3','','Papirüs durumu'),countLink('Sahip olunan',count.owned+' / 25','owned'),countLink('Öğrenilmiş',String(count.learned),'learned'),countLink('Okutulabilir',String(count.readable),'readable'),countLink('Eksik',String(count.missing),'missing'));
   const rarityHeading = element('div','ss288-rarity-heading');
   rarityHeading.append(element('h3','','Nadirlik dağılımı'),element('span','','Sahip / Toplam'));
   sidebar.append(rarityHeading);
   for (const type of rarityKeys) {
    const all = papers().filter(paper=>paper.rarity===type);
    const row = button('',()=>openArchive('all',type),'ss288-rarity-count');
    const label = element('span','');
    const dot = element('i','ss288-rarity-dot');
    dot.dataset.rarity = type;
    label.append(dot,document.createTextNode(rarities[type]));
    row.append(label,element('strong','',all.filter(acquired).length+' / '+all.length+' ›'));
    row.disabled = loading;
    sidebar.append(row);
   }
   sidebar.append(element('small','ss288-distinct-note','Farklı bilgiler sayılır.'));
   const pendingCount=papers().filter(paper=>learned(paper)&&!active(paper)).length;
   if(pendingCount)sidebar.append(element('small','ss288-pending-note',pendingCount+' öğrenilmiş etki hazırlanıyor.'));
   if (Number(state()?.legacy_read)>0) sidebar.append(button('Önceki bilgiler · '+fmt(state().legacy_read),()=>openLegacy(),'ss288-legacy-link'));
   const benefits = element('section','ss288-benefits');
   const learnedPapers = papers().filter(paper=>learned(paper)&&active(paper));
   const benefitsHeading = element('div','ss288-benefits-heading');
   benefitsHeading.append(element('h3','','Etkin pasifler · '+learnedPapers.length));
   if (role === 'smith') benefitsHeading.append(element('span','ss288-unit-note','Katkılar yüzde puandır'),button('İşlem hesabı',calculation,'ss288-calculation'));
   if (role === 'doctor' && ctx.openInfirmary) benefitsHeading.append(button('Reviri aç',()=>{close();ctx.openInfirmary();},'inf289-staff-action'));
   benefits.append(benefitsHeading);
   const current = learnedPapers.slice(homePage*25,homePage*25+25);
   const grid = element('div','ss288-passive-grid');
   for (const subset of [current.slice(0,13),current.slice(13)]) {
    const column = element('div','ss288-passive-column');
    for (const paper of subset) {
     const row = element('div','ss288-passive');
     row.dataset.contentId = key(paper);
     const marker = element('span','ss288-passive-number',String(paper.ordinal || Number(key(paper).match(/(\d+)$/)?.[1]) || 0).padStart(2,'0'));
     if (newlyLearned.has(key(paper))) { marker.classList.add('ss288-new'); marker.title='Yeni öğrenilen'; }
     const info = button('ⓘ',()=>showInfo(paper),'ss288-info');
     info.setAttribute('aria-label',effectLabel(paper)+' koşulları');
     const label = element('span','ss288-passive-label',effectLabel(paper));
     label.title = effectLabel(paper)+' · '+valueOf(paper);
     row.append(marker,label,element('strong','ss288-value',valueOf(paper)),info);
     column.append(row);
    }
    grid.append(column);
   }
   benefits.append(grid);
   if (!learnedPapers.length) benefits.append(element('p','ss288-empty',loading?'Bilgiler yükleniyor…':'Öğrenilen bilgiler burada görünür.'));
   const bottom = element('div','ss288-benefits-bottom');
   bottom.append(element('span','ss288-new-legend','● Yeni öğrenilen'));
   bottom.append(pager(homePage,Math.ceil(learnedPapers.length/25),page=>{homePage=page;render();}));
   benefits.append(bottom);
   columns.append(sidebar,benefits);
   home.append(summary,columns);
   body.append(home);
  }
  function paperState(paper) {
   if (learned(paper)) return '✓ Öğrenildi';
   if (quantity(paper)) return 'Kasada '+fmt(quantity(paper));
   return 'Sende yok';
  }
  function renderReading(paper) {
   const pane = element('section','ss288-reading');
   if (!paper) { pane.append(element('p','ss288-empty',loading?'Papirüsler yükleniyor…':'Bu seçimde papirüs bulunmuyor.')); return pane; }
   pane.dataset.contentId = key(paper);
   const topline = element('div','ss288-reading-top');
   topline.append(element('span','ss288-scroll-icon','📜'),element('small','',rarities[paper.rarity]+' · '+person().title));
   pane.append(topline,element('h2','',paper.title),element('p','ss288-subtitle',paper.subtitle || ''),element('p','ss288-paragraph',plain(paper.paragraph)));
   const effect = element('div','ss288-reading-effect');
   effect.append(element('h3','',!active(paper)?'Etki hazırlanıyor':learned(paper)?'Öğrenilen etki':'Öğrenince kazanılacak etki'),element('p','',plain(paper.effect_text)),element('strong','ss288-value',valueOf(paper)+((paper.effect?.operation==='add_probability'||paper.effect?.operation==='add_percentage_points')?' yüzde puan':'')));
   if(!active(paper))effect.append(element('small','ss288-runtime-note',paper.runtime_reason||'Bu bilgi öğrenilebilir. İlgili oyun hesabına bağlantısı hazırlanıyor.'));
   pane.append(effect);
   const actions = element('div','ss288-reading-actions');
   actions.append(element('span','ss288-reading-status',paperState(paper)+(learned(paper)&&quantity(paper)?' · Kasada '+fmt(quantity(paper))+' adet':'')));
   const read = button(busy?'Okunuyor…':learned(paper)?'Öğrenildi':readable(paper)?readLabels[role]:'Sende yok',()=>readPaper(paper).catch(()=>{}),'ss288-read');
   read.setAttribute('aria-label',readable(paper)?person().title+' için '+paper.title+' papirüsünü okut':read.textContent);
   read.disabled = !readable(paper)||busy||loading||!!pending;
   actions.append(read,element('small','','1 nüsha kullanılır. Bilgi kalıcı olarak öğrenilir.'));
   if (paper.finder) actions.append(element('small','ss288-finder','İlk bulan · '+paper.finder));
   pane.append(actions);
   return pane;
  }
  function renderArchive() {
   const archive = element('div','ss288-archive');
   const controls = element('div','ss288-archive-controls');
   const ownershipTabs = element('div','ss288-ownership');
   for (const [value,label] of [['owned','Olanlar'],['missing','Olmayanlar'],['all','Hepsi']]) {
    const tab = button(label,()=>{ownership=value;archivePage=0;selected=null;render();});
    tab.setAttribute('aria-pressed',String(ownership===value||value==='owned'&&['learned','readable'].includes(ownership)));
    tab.disabled=busy;
    ownershipTabs.append(tab);
   }
   const rarityTabs=element('nav','ss288-rarity-tabs');
   rarityTabs.setAttribute('aria-label','Papirüs nadirliği');
   for (const type of rarityKeys) {
    const tab=button(rarities[type],()=>{rarity=type;archivePage=0;selected=null;render();});
    tab.setAttribute('aria-pressed',String(rarity===type));
    tab.disabled=busy;
    rarityTabs.append(tab);
   }
   const portraitViewport=root.innerHeight>root.innerWidth;
   const pageSize=portraitViewport?Math.max(4,Math.min(13,Math.floor(((root.innerHeight-191)*.42-40)/26))):root.innerHeight<=600?Math.max(4,Math.min(13,Math.floor((root.innerHeight-165)/27))):13;
   const all=filtered(),pages=Math.max(1,Math.ceil(all.length/pageSize));
   archivePage=Math.min(archivePage,pages-1);
   const visible=all.slice(archivePage*pageSize,(archivePage+1)*pageSize);
   if (!visible.some(paper=>key(paper)===selected)) selected=key(visible[0]||{});
   controls.append(ownershipTabs,rarityTabs,element('span','ss288-filter-count',rarities[rarity]+' · '+all.length+' bilgi'));
   archive.append(controls);
   const split=element('div','ss288-archive-split'),list=element('section','ss288-paper-list');
   const listHeading=element('div','ss288-list-heading');
   listHeading.append(element('strong','','Bilgi ve koşulu'),element('span','',role==='smith'?'yüzde puan':'Katkı'));
   list.append(listHeading);
   const rows=element('div','ss288-paper-rows');
   rows.style.setProperty('--row-count',String(Math.max(1,visible.length)));
   for (const paper of visible) {
    const row=button('',()=>{selected=key(paper);render();},'ss288-paper-row');
    row.dataset.contentId=key(paper);
    row.dataset.rarity=paper.rarity;
    row.setAttribute('aria-pressed',String(key(paper)===selected));
    const info=element('span','ss288-paper-name');
    info.append(element('strong','',paper.title),element('small','',effectLabel(paper)));
    row.append(element('span','ss288-paper-number',String(paper.ordinal||Number(key(paper).match(/(\d+)$/)?.[1])||0).padStart(2,'0')),info,element('strong','ss288-value',valueOf(paper)),element('span','ss288-paper-status',paperState(paper)),papyrusIcon());
    rows.append(row);
   }
   if (!visible.length) rows.append(element('p','ss288-empty',loading?'Papirüsler yükleniyor…':'Bu filtrede papirüs bulunmuyor.'));
   list.append(rows,pager(archivePage,pages,page=>{archivePage=page;selected=null;render();}));
   split.append(list,renderReading(visible.find(paper=>key(paper)===selected)));
   archive.append(split);
   body.append(archive);
  }
  async function openLegacy(unique=false,page=0) {
   if (busy||loading) return;
   screen='legacy';legacyUnique=unique;legacyPage=page;legacy=null;
   const request=++serial;loading=true;render();
   try {
    await identify();
    const result=await ctx.client.rpc('ludus_special_staff_archive',{p_role:role,p_page:page,p_unique:unique});
    if(request!==serial)return;
    if(result.error)throw result.error;
    if(result.data?.user_id!==owner||result.data?.role!==role)throw Error('Papirüs arşivi doğrulanamadı.');
    legacy=result.data;legacyPage=legacy.page||0;
   }catch(error){if(request===serial)message(error.message||'Arşiv alınamadı.',true);}
   finally{if(request===serial){loading=false;render();}}
  }
  function renderLegacy() {
   const section=element('div','ss288-legacy');
   section.append(element('h2','','Önceki bilgiler'));
   const nav=element('div','ss288-ownership');
   for(const [unique,label] of [[false,'Öğrenilenler'],[true,'Eşsizler']]){
    const tab=button(label,()=>openLegacy(unique));tab.setAttribute('aria-pressed',String(unique===legacyUnique));nav.append(tab);
   }
   section.append(nav);
   const rows=element('div','ss288-legacy-rows');
   for(const paper of legacy?.papyri||[]){const row=element('article','ss288-legacy-paper');row.append(element('h3','',paper.title),element('p','',(paper.effects||[]).map(effect=>effect.label+' +%'+fmt(effect.percent)).join(' · ')));rows.append(row);}
   if(!legacy?.papyri?.length)rows.append(element('p','ss288-empty',loading?'Bilgiler yükleniyor…':'Öğrenilen bilgi bulunmuyor.'));
   section.append(rows,pager(legacyPage,Math.ceil((legacy?.paper_count||0)/6),page=>openLegacy(legacyUnique,page)));
   body.append(section);
  }
  function render() {
   if(!opened)return;
   modal.dataset.screen=screen;
   modal.dataset.directory=String(screen==='directory');
   modal.dataset.role=role;
   modal.setAttribute('aria-busy',String(loading||busy));
   back.setAttribute('aria-label',screen==='directory'?'Özel çalışanları kapat':screen==='home'?'Çalışan listesine dön':'Çalışan ana sayfasına dön');
   heading.textContent=screen==='directory'?'Özel çalışanlar':person().title+(screen==='archive'?' · Papirüsler':'');
   tabs.hidden=screen==='directory';
   homeTab.setAttribute('aria-current',screen==='home'?'page':'false');
   archiveTab.setAttribute('aria-current',screen==='archive'?'page':'false');
   homeTab.disabled=busy||loading;archiveTab.disabled=busy||loading;
   body.replaceChildren();
   if(screen==='directory')renderDirectory();
   else if(screen==='home')renderHome();
   else if(screen==='legacy')renderLegacy();
   else renderArchive();
  }
  async function identify() {
   if(owner)return;
   const account=await ctx.ready;
   owner=account?.user_id;
   if(!owner)throw Error('Giriş gerekiyor.');
   try{
    const stored=localStorage.getItem('ludus-staff-read-v288:'+owner)||localStorage.getItem('ludus-staff-read-v284:'+owner);
    const value=JSON.parse(stored||'null');
    if(value?.owner===owner&&defs.some(entry=>entry.id===value.role)&&value.request&&(value.content_id||Number.isInteger(value.lesson)||value.unique_id))pending=value;
   }catch{}
  }
  function adopt(result) {
   if(result?.user_id!==owner)throw Error('Çalışan hesabı doğrulanamadı.');
   data=result;
   ctx.onState?.(data.staff);
   root.dispatchEvent(new CustomEvent('ludus-staff-change',{detail:{staff:data.staff}}));
  }
  async function refresh() {
   if(busy||loading)return;
   const request=++serial,requestedRole=role;
   loading=true;retry.hidden=true;render();
   try{
    await identify();
    const result=await ctx.client.rpc('ludus_papyrus_state_v288',{p_role:requestedRole});
    if(request!==serial)return;
    if(result.error)throw result.error;
    if(result.data?.role!==requestedRole)throw Error('Çalışan profili doğrulanamadı.');
    adopt(result.data);
    if(pending){message('Önceki okumanın sonucu bekliyor. Yeniden dene ile kontrol et.');retry.hidden=false;}
   }catch(error){if(request===serial){message(error.message||'Çalışan bilgileri alınamadı.',true);retry.hidden=false;}}
   finally{if(request===serial){loading=false;render();}}
  }
  function clearPending() {
   pending=null;
   for(const version of ['v288','v284'])try{localStorage.removeItem('ludus-staff-read-'+version+':'+owner);}catch{}
  }
  async function readPaper(paper) {
   await identify();
   if(busy)throw Error('Önceki okuma sürüyor.');
   const contentId=paper.content_id||(!paper.lesson&&!paper.unique_id?paper.id:null);
   const targetRole=paper.role||role;
   if(pending&&(pending.role!==targetRole||(pending.content_id||null)!==(contentId||null)||(pending.lesson??null)!==(paper.lesson??null)||(pending.unique_id??null)!==(paper.unique_id??null)))throw Error('Önceki okumanın sonucunu yeniden dene ile kontrol et.');
   if(!pending){
    pending={owner,role:targetRole,content_id:contentId||null,lesson:paper.lesson??null,unique_id:paper.unique_id??null,request:crypto.randomUUID()};
    try{localStorage.setItem('ludus-staff-read-v288:'+owner,JSON.stringify(pending));}catch(error){pending=null;throw error;}
   }
   serial++;loading=false;
   return submit(true);
  }
  async function submit(propagate=false) {
   if(busy||!pending)return;
   busy=true;retry.hidden=true;message('Papirüs okunuyor…');render();
   try{
    const command=pending;
    let name='ludus_papyrus_read_v288',args={p_content_id:command.content_id,p_request:command.request};
    if(!command.content_id){name=command.unique_id?'ludus_special_staff_read_unique':'ludus_special_staff_read';args={p_role:command.role,p_request:command.request};if(command.unique_id)args.p_unique_id=command.unique_id;else args.p_lesson=command.lesson;}
    const result=await ctx.client.rpc(name,args);
    if(result.error){if(['P0001','22023','22P02','23514'].includes(result.error.code))clearPending();throw result.error;}
    if(result.data?.user_id!==owner)throw Error('Çalışan hesabı doğrulanamadı.');
    if(command.content_id){newlyLearned.add(command.content_id);adopt(result.data);}
    else {ctx.onState?.(result.data.staff);root.dispatchEvent(new CustomEvent('ludus-staff-change',{detail:{staff:result.data.staff}}));}
    clearPending();
    message('Papirüs öğrenildi. Bilgi kalıcı olarak arşive eklendi.');
    return result.data;
   }catch(error){message(error.message||'Sonuç alınamadı. Yeniden deneyebilirsin.',true);retry.hidden=false;if(propagate)throw error;}
   finally{busy=false;render();}
  }
  function openDirectory() {
   if(busy)return;
   enter();screen='directory';serial++;loading=false;message('');render();refresh();
  }
  function open(id='trainer') {
   if(!defs.some(entry=>entry.id===id)||busy)return;
   enter();serial++;loading=false;role=id;screen='home';selected=null;homePage=0;archivePage=0;legacy=null;message('');render();back.focus({preventScroll:true});refresh();
  }
  function openFromLink() {
   const url=new URL(root.location.href),id=url.searchParams.get('staff');
   if(!defs.some(entry=>entry.id===id))return false;
   open(id);url.searchParams.delete('staff');root.history.replaceState(null,'',url);return true;
  }
  function goBack() {
   if(busy)return;
   if(detail.open){detail.close();return;}
   if(screen==='directory')close();
   else if(screen==='home')openDirectory();
   else{screen='home';serial++;loading=false;render();if(data?.role!==role)refresh();}
  }
  function close() {
   if(!opened||busy)return;
   detail.close();opened=false;serial++;loading=false;modal.hidden=true;ctx.onClose?.();
   if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});
  }
  modal.addEventListener('pointerdown',event=>event.stopPropagation());
  root.addEventListener('resize',()=>{if(opened)render();});
  modal.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();goBack();}
   if(event.key==='Tab'){
    const items=[...modal.querySelectorAll('button:not(:disabled)')].filter(node=>node.getClientRects().length);
    if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}
    else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0]?.focus();}
   }
  });
  return {open,openDirectory,openFromLink,close,refresh,readPaper,retryRead:async()=>{await identify();if(!pending)throw Error('Bekleyen okuma yok.');return submit(true);},get pendingRead(){return pending;},get archive(){return screen==='legacy'?legacy:{role,page:archivePage,paper_count:filtered().length,papyri:filtered()};},get state(){return data;},get visible(){return opened;}};
 }
 function stations(ctx){
  const T=ctx.T,entries=[];let lastRoom=undefined,loaded=false;
  for(const d of root.LudusSpecialPeople.roles.filter(d=>d.id!=='groom')){
   const group=new T.Group();group.position.set(d.x,d.y||0,d.z);group.rotation.y=d.yaw;group.name=d.title+' · '+d.name;
   const b=button(d.title,()=>ctx.open(d.id),'staff-world-action room-world-action');b.hidden=true;b.setAttribute('aria-label',d.title+' profilini aç');document.body.append(b);
   const e={d,group,button:b,point:new T.Vector3(d.x,(d.y||0)+d.appearance.height/100+.2,d.z),ready:false,pending:false,lastAttempt:0};entries.push(e);
   if(!d.room){ctx.scene.add(group);ctx.colliders.push({kind:'special-staff-'+d.id,x:d.x,z:d.z,half:.38});}
  }
  function load(e){if(e.ready||e.pending||Date.now()-e.lastAttempt<15000)return;e.pending=true;e.lastAttempt=Date.now();root.LudusSpecialPeople.model(e.d.id).then(model=>{e.group.add(model);e.ready=true;ctx.invalidate?.();}).catch(()=>{e.button.title='Karakter yüklenemedi; yeniden denenecek.';}).finally(()=>{e.pending=false;});}
  function tick(){
   const room=ctx.room();if(room!==lastRoom){for(const e of entries.filter(e=>e.d.room)){e.group.removeFromParent();if(e.d.room===room){ctx.roomScene.add(e.group);ctx.roomColliders.push({kind:'special-staff-'+e.d.id,minX:e.d.x-.38,maxX:e.d.x+.38,minZ:e.d.z-.38,maxZ:e.d.z+.38});}}lastRoom=room;}
   if(!loaded)Promise.resolve(ctx.ready).then(()=>{loaded=true;}).catch(()=>{});
   for(const e of entries){if(e.d.room&&e.d.room===room&&!ctx.roomColliders.some(c=>c.kind==='special-staff-'+e.d.id))ctx.roomColliders.push({kind:'special-staff-'+e.d.id,minX:e.d.x-.38,maxX:e.d.x+.38,minZ:e.d.z-.38,maxZ:e.d.z+.38});const visible=loaded&&ctx.exploring()&&e.d.room===room;e.group.visible=visible;if(visible)load(e);root.LudusRoomActions.place(e.button,e.point,ctx,visible&&e.ready,5);}
  }
  return {tick,entries};
 }
 root.LudusSpecialStaff={create,stations,formatPercent:value=>'+%'+fmt(value)};
})(globalThis);
