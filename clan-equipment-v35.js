/* Reused game equipment rules and original inventory artwork. */
// C.docx master v1.0. Deterministic rules only: no client-side rolls or currency writes.
var LudusItemSystem = (() => {
 'use strict';
 const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
 const groups={offense:['weapon','shield'],defense:['helmet','chest'],mobility:['gloves','legs']};
 const naturalRows=[
  ['physical_power','Physical Power','Fiziksel Güç'],
  ['critical_rate','Critical Rate','Kritik Oranı'],
  ['critical_damage','Critical Damage','Kritik Hasarı'],
  ['block_rate','Block Rate','Blok Oranı'],
  ['block_power','Block Power','Blok Gücü'],
  ['armor_penetration','Armor Penetration','Zırh Delme'],
  ['physical_defense','Physical Defense','Fiziksel Savunma'],
  ['damage_reduction','Damage Reduction','Hasar Azaltma'],
  ['critical_resistance','Critical Resistance','Kritik Direnci'],
  ['pierce_resistance','Pierce Resistance','Delici Hasar Direnci'],
  ['slash_resistance','Slash Resistance','Kesici Hasar Direnci'],
  ['projectile_resistance','Projectile Resistance','Fırlatılan Silah Direnci'],
  ['acceleration','Acceleration','Hızlanma'],
  ['movement_speed','Movement Speed','Hareket Hızı'],
  ['dodge_rate','Dodge Rate','Kaçınma Oranı'],
  ['recovery_speed','Recovery Speed','Toparlanma Hızı'],
  ['turn_speed','Turn Speed','Dönüş Hızı'],
  ['dodge_distance','Dodge Distance','Kaçınma Mesafesi']
 ];
 const natural=naturalRows.map(([key,en,label],i)=>({id:i+1,key,en,label,group:['offense','defense','mobility'][Math.floor(i/6)]}));
 const sapphires=natural.map(s=>({id:s.id,family:'sapphire',roman:roman[s.id-1],name:'Safir '+roman[s.id-1],stat:s.key,label:s.label,description:s.label+' başlangıç değerine eklenir. %100 Safir bu statı iki katına çıkarır; yeni deneme mevcut yüzdeyi değiştirir.',asset:'sapphire-'+s.id+'.webp'}));
 const emeraldRows=[
  ['max_hp','Vita','Maksimum HP'],['hp_regeneration','Sanatio','HP Yenilenmesi'],
  ['max_stamina','Stamina','Maksimum Kondisyon'],['stamina_regeneration','Recuperatio','Kondisyon Yenilenmesi'],
  ['physical_power','Fortitudo','Fiziksel Saldırı Gücü'],['critical_rate','Critical','Kritik Vuruş Şansı'],
  ['critical_damage','Ferocia','Kritik Vuruş Hasarı'],['armor_penetration','Penetratio','Zırh Delme'],
  ['minimum_damage','Strike','Minimum Hasarı Maksimuma Yaklaştırma'],['physical_defense','Defensio','Fiziksel Savunma'],
  ['parry_rate','Parry','Silahla Savuşturma Şansı'],['block_rate','Block','Kalkanla Blok Oranı'],
  ['critical_damage_reduction','Aegis','Alınan Kritik Hasarı Azaltma'],['movement_speed','Agilitas','Hareket Hızı'],
  ['attack_speed','Celeritas','Saldırı Hızı']
 ];
 const emeralds=emeraldRows.map(([stat,title,label],i)=>({id:i+1,family:'emerald',roman:roman[i],name:'Zümrüt '+roman[i]+' · '+title,title,stat,label,description:label+' sağlar. Ekipman türü kısıtlaması yoktur; bir itemde en fazla dört farklı Zümrüt bulunur.',asset:'emerald-'+(i+1)+'.webp'}));
 const rubies=[
  {id:1,title:'FELIX',label:'Talih',description:'Elmasla + basarken başarı şansına +2 yüzde puan. Aynı denemede yalnızca bir tane; sonuç ne olursa olsun tüketilir.'},
  {id:2,title:'TENAX',label:'Direnç',description:'+6 ve üzerindeki itemi patladığında yok olmaktan korur. Yalnızca patlama gerçekleştiğinde tüketilir.'},
  {id:3,title:'VESPER',label:'Dönüş',description:'+6 ve üzerindeki item patladığında yok olmak yerine +4 seviyesine döner. Yalnızca patlama gerçekleştiğinde tüketilir.'},
  {id:4,title:'CERTUS',label:'Kesinlik',description:'+10–+15 geliştirme bandındaki tek bir + denemesini %100 başarılı yapar. Aynı itemde yalnızca bir kez kullanılabilir.'}
 ].map(s=>({...s,family:'ruby',roman:roman[s.id-1],name:'Yakut '+roman[s.id-1]+' · '+s.title,asset:'ruby-'+s.id+'.webp'}));
 const diamond={id:1,family:'diamond',name:'Elmas',label:'+ Geliştirme',description:'Itemin + seviyesini artırmak için kullanılır.',asset:null};
 const percentageChances=[[100,.1],[95,.5],[90,1],[85,3],[80,5],[75,8],[70,12],[65,16],[60,20],[50,30],[40,45],[30,60],[20,75],[10,90]].map(([value,weight])=>({value,weight,chance:weight/365.6*100}));
 const baseProfiles={weapon:[7,3,5,3,5,3],shield:[2,1,2,8,12,1],helmet:[4,2,3,4,4,4],chest:[8,4,4,6,6,6],gloves:[4,2,2,4,5,2],legs:[6,4,3,3,3,5]};
 const emeraldPower=[20,.5,20,3,7,3,8,5,10,5,4,4,8,4,4];
 function enhancementScale(level){return 1+.1*Math.max(0,Number(level)||0);}
 function baseStats(kind){return Object.fromEntries(statsFor(kind).map((s,i)=>[s.key,baseProfiles[kind][i]]));}
 function effectiveStats(item){const result={};if(item.stat_version!==10)return result;for(const [key,v] of Object.entries(naturalValues(item)))result[key]=v.effective||0;for(const socket of item.emeralds||[]){const s=stone('emerald',socket.id);if(s)result[s.stat]=(result[s.stat]||0)+emeraldPower[s.id-1]*socket.value/100;}return result;}
 const kinds=Object.values(groups).flat();
 function groupFor(kind){return Object.keys(groups).find(g=>groups[g].includes(kind))||null;}
 function statsFor(kind){const group=groupFor(kind);return natural.filter(s=>s.group===group);}
 function stone(family,id){const rows=({sapphire:sapphires,emerald:emeralds,ruby:rubies,diamond:[diamond]})[family];return rows?.find(s=>s.id===Number(id))||null;}
 function baseChance(level){if(!Number.isInteger(level)||level<0)throw Error('Geçersiz + seviyesi');return level<4?.70:level<6?.60:level<8?.50:level<10?.40:.30;}
 function enhancementChance(item,rubyId=null){
  const level=item.enhancement??0;const base=baseChance(level);
  if(rubyId!==null&&!stone('ruby',rubyId))throw Error('Yakut tanımlı değil');
  if(Number(rubyId)===4){if(level<10||level>=15||item.certus_used)throw Error('CERTUS bu itemde kullanılamaz');return 1;}
  if([2,3].includes(Number(rubyId))&&level<6)throw Error('Koruma Yakutu +6 ve üzerinde kullanılır');
  return Math.min(1,base+(Number(rubyId)===1?.02:0));
 }
 function validPercentage(value){return typeof value==='number'&&percentageChances.some(p=>p.value===value);}
 function validateItem(item){
  if(!kinds.includes(item.kind))throw Error('Geçersiz ekipman türü');
  if(item.stat_version!==10)throw Error('Item yeni stat sistemine henüz geçirilmedi');
  if(!Number.isInteger(item.enhancement)||item.enhancement<0)throw Error('Geçersiz + seviyesi');
  const allowed=statsFor(item.kind).map(s=>s.key);
  for(const [key,value] of Object.entries(item.natural_stats||{}))if(!allowed.includes(key)||typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('Doğal stat bu item grubuna uygun değil');
  for(const [key,value] of Object.entries(item.natural_percentages||{}))if(!allowed.includes(key)||(value!==0&&!validPercentage(value)))throw Error('Safir yüzdesi geçersiz');
  const sockets=item.emeralds||[];
  if(!Array.isArray(sockets)||sockets.length>4)throw Error('En fazla dört Zümrüt basılabilir');
  const ids=new Set();for(const socket of sockets){if(!stone('emerald',socket.id)||ids.has(Number(socket.id))||!validPercentage(socket.value))throw Error('Zümrütler farklı ve geçerli olmalı');ids.add(Number(socket.id));}
  return true;
 }
 function canSocket(item,id){return kinds.includes(item.kind)&&!!stone('emerald',id)&&Array.isArray(item.emeralds||[])&&(item.emeralds||[]).length<4&&!(item.emeralds||[]).some(s=>Number(s.id)===Number(id));}
 function naturalValues(item){
  validateItem(item);
  return Object.fromEntries(statsFor(item.kind).map(s=>{
   const written=item.natural_stats?.[s.key],percent=item.natural_percentages?.[s.key]??0;
   return [s.key,{base:written??null,written:written!==undefined?written*enhancementScale(item.enhancement):null,percent,effective:written!==undefined?written*enhancementScale(item.enhancement)*(1+percent/100):null}];
  }));
 }
 function pouchSlots(family,counts={}){
  const catalog=({diamond:[diamond],sapphire:sapphires,emerald:emeralds,ruby:rubies})[family];
  if(!catalog)throw Error('Taş kategorisi bulunamadı');
  return Array.from({length:20},(_,i)=>catalog[i]?{stone:catalog[i],count:Math.max(0,Number.isSafeInteger(counts[catalog[i].id])?counts[catalog[i].id]:0)}:null);
 }
 function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
 return freeze({version:10,source:'C.docx master v1.0',groups,natural,sapphires,emeralds,rubies,diamond,percentageChances,baseProfiles,emeraldPower,enhancementScale,baseStats,effectiveStats,groupFor,statsFor,stone,baseChance,enhancementChance,validateItem,canSocket,naturalValues,pouchSlots,
  destructionChanceOnFailure:.13,unresolved:[],transactionsEnabled:true});
})();
if(typeof module!=='undefined'&&module.exports)module.exports=LudusItemSystem;

var LUDUS_EQUIPMENT_ATLAS="clan-equipment-0-v35.webp";
var LUDUS_HELMET_ICONS={"gladiator":"clan-equipment-1-v35.webp","knights":"clan-equipment-2-v35.webp","winged":"clan-equipment-3-v35.webp","roman":"clan-equipment-4-v35.webp"};
var LUDUS_ARMOUR_ICONS={"gladiator_chest":"clan-equipment-5-v35.webp","chest_plate":"clan-equipment-6-v35.webp","armor_shoulder":"clan-equipment-7-v35.webp","shoulder_armor":"clan-equipment-8-v35.webp"};
var LudusIcons=(function(){
 const cells={gladius:0,sica:1,spear:2,trident:3,net:4,mace:5,whip:6,scissor:7};
 const bounds=[[8,6,299,301],[329,5,293,298],[629,5,299,302],[953,7,292,301],[7,337,295,242],[329,313,281,279],[650,351,281,241],[956,319,289,278],[44,607,236,292],[339,614,269,288],null,null,[16,910,265,323],[319,926,296,300],[660,916,278,313],[945,942,292,270]];
 function helmetKey(value){return value==='roman'||value==='roman_helmet'?'roman':value==='silver'||value==='knights'||value==='knights_helm'?'knights':value==='winged'||value==='winged_helmet_gameready'?'winged':'gladiator';}
 function index(it){if(!it)return -1;if(it.kind==='weapon')return cells[it.model]??0;if(it.kind==='shield')return it.model==='large'?8:9;if(it.kind==='helmet')return helmetKey(it.model)==='knights'?11:10;return {chest:12,gloves:13,legs:14,pouch:15}[it.kind]??-1;}
 function svg(it){const n=index(it),label=String(it?.name||'Ekipman görünümü').replace(/[&<>"']/g,'');
  if(n<0)return '<svg viewBox="0 0 96 96" role="img" aria-label="Boş ekipman yuvası"><path d="M48 33v30M33 48h30" stroke="#cbb381" stroke-width="2"/><circle cx="48" cy="48" r="30" fill="none" stroke="#cbb38155" stroke-width="1"/></svg>';
  if(it.kind==='helmet')return '<svg class="equipment-icon" data-equipment="helmet" viewBox="0 0 96 96" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+label+'" style="display:block;width:100%;height:100%;overflow:hidden"><rect width="96" height="96" fill="#fff"/><image x="4" y="4" width="88" height="88" preserveAspectRatio="xMidYMid meet" href="'+LUDUS_HELMET_ICONS[helmetKey(it.model)]+'"/></svg>';
  if(it.kind==='chest'||it.kind==='gloves'){const key=it.kind==='chest'?(it.model==='chest_plate'?'chest_plate':'gladiator_chest'):(it.model==='shoulder_armor'?'shoulder_armor':'armor_shoulder');return '<svg class="equipment-icon" data-equipment="'+key+'" viewBox="0 0 96 96" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+label+'" style="display:block;width:100%;height:100%;overflow:hidden"><rect width="96" height="96" fill="#fff"/><image x="3" y="3" width="90" height="90" preserveAspectRatio="xMidYMid meet" href="'+(LUDUS_ARMOUR_ICONS[key]||LUDUS_HELMET_ICONS.gladiator)+'"/></svg>';}
  const b=bounds[n],scale=84/Math.max(b[2],b[3]),x=(96-b[2]*scale)/2,y=(96-b[3]*scale)/2,id='equipment-crop-'+n;
  return '<svg class="equipment-icon" data-equipment="'+n+'" viewBox="0 0 96 96" preserveAspectRatio="xMidYMid meet" role="img" aria-label="'+label+'" style="display:block;width:100%;height:100%;overflow:hidden"><rect width="96" height="96" fill="#fff"/><defs><clipPath id="'+id+'"><rect x="'+x+'" y="'+y+'" width="'+(b[2]*scale)+'" height="'+(b[3]*scale)+'"/></clipPath></defs><image clip-path="url(#'+id+')" x="'+(x-b[0]*scale)+'" y="'+(y-b[1]*scale)+'" width="'+(1254*scale)+'" height="'+(1254*scale)+'" href="'+LUDUS_EQUIPMENT_ATLAS+'"/></svg>';

 }
 return {svg,index,bounds,helmetKey};
})();
