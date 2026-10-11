/* Read-only presentation of the shipped combat caps and upgrade rules. */
(function(root){
 'use strict';
 const caps={physical_defense:50,block_rate:30,block_power:40,armor_penetration:60,acceleration:30,movement_speed:30,dodge_rate:20,recovery_speed:30,turn_speed:30,dodge_distance:25,max_hp:120,max_stamina:100,hp_regeneration:2,stamina_regeneration:8,minimum_damage:20,parry_rate:20,attack_speed:25};
 const notes={
  physical_power:'Vuruş yapan ekipmanın doğal gücü (+ seviyesi ve Safir dahil) hasarı çarpar. Fortitudo her yuvada aynı ek bonus havuzuna girer. Bu havuz, diğer ekipmanların doğal gücüyle birlikte en fazla 50 puandır.',
  critical_rate:'Rakibin kritik direnci çıkarıldıktan sonra en fazla %35 kritik ihtimali.',
  critical_damage:'Rakibin kritik hasarı azaltmasıyla birlikte hesaplanır. Son kritik çarpanı 1,1–2,2 arasındadır.',
  critical_resistance:'Rakibin kritik ihtimalinden çıkarılır; ihtimal sıfırın altına inmez.',
  critical_damage_reduction:'Rakibin kritik hasarını azaltır; son kritik çarpanı en az 1,1 olur.',
  damage_reduction:'İlgili kesici, delici veya fırlatılan silah direnciyle toplamı en fazla %55.',
  pierce_resistance:'Delici saldırılarda hasar azaltmayla toplamı en fazla %55.',
  slash_resistance:'Kesici saldırılarda hasar azaltmayla toplamı en fazla %55.',
  projectile_resistance:'Fırlatılan silahlarda hasar azaltmayla toplamı en fazla %55. Çevrimiçi arenada fırlatma eylemi henüz yok.',
  physical_defense:'Gladyatörün kendi savunmasına eklenir; buradaki sınır yalnızca ekipman katkısıdır.',
  block_rate:'Uygun durumda, önden gelen saldırıya karşı kalkanla otomatik blok ihtimali.',
  block_power:'Başarılı blokta harcanan dayanıklılığın iade edilen yüzdesi.',
  armor_penetration:'Rakibin ekipman savunmasına uygulanır; gladyatörün doğal savunmasına uygulanmaz.',
  hp_regeneration:'Uygun dinlenme durumunda saniyelik ek HP; ölü gladyatörü diriltmez.',
  stamina_regeneration:'Saniyelik ham ek yenilenme. Savaş temposu ×0,65 ve yemek bonusu daha sonra uygulanır.',
  minimum_damage:'Hasardaki %20 rastgele değişkenliği kapatır; 20 üstü ek fayda sağlamaz.',
  recovery_speed:'Darbe sonrası toparlanmayı, normal/mükemmel blok geri tepmesini ve yere düşme sonrası kalkışı hızlandırır. Ağ ve devam eden kırbaç çekişini bozmaz. %30 bonus, toparlanma süresini 1,30’a böler.',
  dodge_rate:'Uygun bekleme durumunda pasif kaçınma ihtimali.',
  parry_rate:'Uygun elde silah ve en az 6 dayanıklılık gerektirir.',
  attack_speed:'Refleks çarpanından ayrı uygulanır. Refleks 0–100 boyunca 0,70–1,30 çarpanı verir.'
 };
 function inspect(rules,selected,items=[]){
  const equipped=!!selected?.equipped_by;
  const gear=!selected?[]:equipped?items.filter(i=>i.equipped_by===selected.equipped_by):[selected];
  const totals={};for(const item of gear)for(const [key,value]of Object.entries(rules.effectiveStats(item)))totals[key]=(totals[key]||0)+value;
  const labels=new Map([...rules.natural.map(s=>[s.key,s.label]),...rules.emeralds.map(s=>[s.stat,s.label])]);
  const rows=Object.entries(totals).map(([key,raw])=>{const cap=caps[key]??null,used=cap===null?null:Math.min(cap,Math.max(0,raw));return{key,label:labels.get(key)||key,raw,cap,used,excess:used===null?null:Math.max(0,raw-used),note:notes[key]||'Ekipmanların toplam savaş katkısına uygulanır.'};});
  return{equipped,count:gear.length,legacy:gear.some(i=>i.stat_version!==10),rows};
 }
 function mount(getContext){
  const button=document.getElementById('openCombatInfo');if(!button)return;
  const dialog=document.createElement('dialog');dialog.id='combatInfo';dialog.setAttribute('aria-labelledby','combatInfoTitle');
  dialog.innerHTML='<header><h2 id="combatInfoTitle">İhtimaller ve savaş bonusları</h2><button type="button" aria-label="Bilgiyi kapat">✕</button></header><nav aria-label="Bilgi türü"><button type="button" data-tab="odds">İhtimaller</button><button type="button" data-tab="bonus">Savaş bonusları</button></nav><div class="combat-info-content"></div>';
  document.body.append(dialog);let tab='odds';
  const content=dialog.querySelector('.combat-info-content'),fmt=n=>Number(n.toFixed(3)).toLocaleString('tr-TR',{maximumFractionDigits:3});
  const add=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;content.append(node);return node;};
  function table(headers,rows){const t=document.createElement('table'),head=t.createTHead().insertRow();for(const label of headers){const h=document.createElement('th');h.scope='col';h.textContent=label;head.append(h);}const body=t.createTBody();for(const row of rows){const tr=body.insertRow();for(const value of row)tr.insertCell().textContent=value;}content.append(t);}
  function render(){
   const {rules,selected,items,action,material}=getContext();content.replaceChildren();
   for(const b of dialog.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b.dataset.tab===tab));
   if(tab==='odds'){
    add('h3','Elmas ve Yakut');
    if(selected){try{const ruby=action==='enhance'?material:null,chance=rules.enhancementChance(selected,ruby),risk=selected.enhancement>=6?(1-chance)*.13:0;
     add('p','Seçili ekipman +'+selected.enhancement+' → +'+(selected.enhancement+1)+' · Başarı %'+fmt(chance*100)+' · Deneme başına patlama %'+fmt(risk*100));
     add('p',ruby===2?'TENAX patlamada eşyayı ve + seviyesini korur.':ruby===3?'VESPER patlamada eşyayı korur, +4’e döndürür.':ruby===4?'CERTUS bu ekipmanda bir kez kesin başarı verir.':'Koruma yoksa patlama eşyayı yok eder.');
    }catch(e){add('p',e.message);}}else add('p','Seçili denemenin ihtimalini görmek için bir ekipman seç.');
    add('p','+6 ve üzerinde: başarısız denemelerin %13’ü patlar. Bu, her denemenin %13’ü değildir. FELIX başarıya 2 yüzde puanı ekler. TENAX ve VESPER yalnızca patlamada tüketilir.');
    add('h3','Safir ve Zümrüt');
    add('p','Her basım mevcut yüzdeyi yeni sonuçla değiştirir; yüzde düşebilir. Aşağıdaki ihtimaller sunucudaki ağırlıkların toplamına göre hesaplanır. Yuvarlama nedeniyle gösterilen toplam %100’den çok az sapabilir.');
    table(['Basılacak yüzde','Çıkma ihtimali'],rules.percentageChances.map(p=>['%'+p.value,'%'+fmt(p.chance)]));
    add('p','Safir: başlangıç statı × (1 + 0,1 × geliştirme seviyesi) × (1 + Safir yüzdesi / 100). Safir %100, geliştirilmiş doğal statı ikiye katlar. Zümrüt: taş gücü × basılan yüzde; + seviyesi Zümrüt gücünü artırmaz.');
   }else{
    const result=inspect(rules,selected,items);
    add('p',!selected?'Önce bir ekipman seç.':result.equipped?'Seçili ekipmanın takılı olduğu gladyatörün '+result.count+' eşyasının toplamı.':'Seçili tek eşyanın katkısı. Gladyatöre takıldığında diğer eşyalarla birlikte aynı tavana girer.');
    add('p','Ham: taşlar ve + seviyesi dahil toplam. Tavana kadar: bu toplamın sınır içinde kalan kısmı. Etki, saldırının ve savunmanın koşulları sağlandığında uygulanır.');
    table(['Bonus','Ham','Tavana kadar','Boşa çıkan'],result.rows.map(r=>[r.label,fmt(r.raw),r.used===null?'Duruma bağlı':fmt(r.used)+' / '+fmt(r.cap),r.excess===null?'—':fmt(r.excess)]));
    if(result.legacy)add('p','Eski tip eşyaların gladyatör özelliklerine katkıları bu taş bonusu tablosuna dahil değildir.');
    for(const r of result.rows){const d=add('details',''),s=document.createElement('summary'),p=document.createElement('p');s.textContent=r.label;p.textContent=r.note;d.append(s,p);}
    add('p','Refleks saldırı zamanlarını kısaltır: 0 → ×0,70; 50 → ×1,00; 65 → ×1,09; 80 → ×1,18; 100 → ×1,30. Celeritas ayrıca uygulanır.');
   }
  }
  button.onclick=()=>{render();dialog.showModal();};dialog.querySelector('header button').onclick=()=>dialog.close();
  for(const b of dialog.querySelectorAll('[data-tab]'))b.onclick=()=>{tab=b.dataset.tab;render();};
 }
 const api={caps,inspect,mount};if(typeof module!=='undefined')module.exports=api;else root.LudusCombatInspector=api;
})(typeof globalThis!=='undefined'?globalThis:this);
