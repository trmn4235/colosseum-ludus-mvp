/* V199: one visual identity for cards, inventory, upgrades, battle selection and fallbacks. */
(function(root){
 'use strict';
 const rows=[
  {sku:'chest-officer', kind:'chest', model:'officer_chest', name:'Roma subayı göğüs zırhı', icon:'assets/items-v295/officer_chest.webp'},
  {sku:'chest-officer-black', kind:'chest', model:'officer_chest_black', name:'Siyah Roma subayı göğüs zırhı', icon:'assets/items-v295/officer_chest_black.webp'},
  {
    "sku": "shield-dura",
    "kind": "shield",
    "model": "shield_dura",
    "name": "Dura Europos oval kalkanı",
    "icon": "assets/items-v198/shield-dura.webp"
  },
  {
    "sku": "shield-parma",
    "kind": "shield",
    "model": "shield_parma",
    "name": "Ahşap Parma kalkanı",
    "icon": "assets/items-v198/shield-parma.webp"
  },
  {
    "sku": "shield-celtic",
    "kind": "shield",
    "model": "shield_celtic",
    "name": "Yeşil motifli kalkan",
    "icon": "assets/items-v198/shield-celtic.webp"
  },
  {
    "sku": "shield-azure",
    "kind": "shield",
    "model": "shield_azure",
    "name": "Mavi demir kuşaklı kalkan",
    "icon": "assets/items-v198/shield-azure.webp"
  },
  {
    "sku": "shield-viridis",
    "kind": "shield",
    "model": "shield_viridis",
    "name": "Yeşil Roma kule kalkanı",
    "icon": "assets/items-v198/shield-viridis.webp"
  },
  {
    "sku": "shield-aquila",
    "kind": "shield",
    "model": "shield_aquila",
    "name": "Kartal işlemeli kule kalkanı",
    "icon": "assets/items-v198/shield-aquila.webp"
  },
  {
    "sku": "manica-segmented",
    "kind": "gloves",
    "model": "manica_segmented",
    "name": "Plakalı gladyatör kolluğu",
    "icon": "assets/items-v199/manica-segmented.webp"
  },
  {
    "sku": "manica-lion",
    "kind": "gloves",
    "model": "manica_lion",
    "name": "Aslan başlı gladyatör kolluğu",
    "icon": "assets/items-v199/manica-lion.webp"
  },
  {
    "sku": "manica-leather",
    "kind": "gloves",
    "model": "manica_leather",
    "name": "Tokalı deri kolluk",
    "icon": "assets/items-v199/manica-leather.webp"
  },
  {
    "sku": "trident-gladiator",
    "kind": "weapon",
    "model": "trident_gladiator",
    "name": "Gladyatör tridenti",
    "icon": "assets/items-v199/trident-gladiator.webp"
  },
  {
    "sku": "halberd",
    "kind": "weapon",
    "model": "halberd",
    "name": "Halberd",
    "icon": "assets/items-v199/halberd.webp"
  },
  {
    "sku": "gladius",
    "kind": "weapon",
    "model": "gladius",
    "name": "Gladius",
    "icon": "assets/items-v118/gladius.webp"
  },
  {
    "sku": "sica",
    "kind": "weapon",
    "model": "sica",
    "name": "Sica",
    "icon": "assets/items-v118/sica.webp"
  },
  {
    "sku": "spear",
    "kind": "weapon",
    "model": "spear",
    "name": "Mızrak",
    "icon": "assets/items-v199/spear.webp"
  },
  {
    "sku": "trident",
    "kind": "weapon",
    "model": "trident",
    "name": "Trident",
    "icon": "assets/items-v199/trident.webp"
  },
  {
    "sku": "mace",
    "kind": "weapon",
    "model": "mace",
    "name": "Zincirli gürz",
    "icon": "assets/items-v199/mace.webp"
  },
  {
    "sku": "whip",
    "kind": "weapon",
    "model": "whip",
    "name": "Kırbaç",
    "icon": "assets/items-v199/whip.webp"
  },
  {
    "sku": "scissor",
    "kind": "weapon",
    "model": "scissor",
    "name": "Kol bıçağı",
    "icon": "assets/items-v199/scissor.webp"
  },
  {
    "sku": "net",
    "kind": "weapon",
    "model": "net",
    "name": "Savaş ağı",
    "icon": "assets/items-v199/net.webp"
  },
  {
    "sku": "shield-medium",
    "kind": "shield",
    "model": "round",
    "name": "Küçük kalkan",
    "icon": "assets/items-v199/shield-medium.webp",
    "aliases": [
      "small",
      "medium"
    ]
  },
  {
    "sku": "shield-large",
    "kind": "shield",
    "model": "large",
    "name": "Büyük kalkan",
    "icon": "assets/items-v199/shield-large.webp"
  },
  {
    "sku": "helmet-viking",
    "kind": "helmet",
    "model": "viking_helmet",
    "name": "Boynuzlu Viking miğferi",
    "icon": "assets/items-v189/helmet-viking.webp"
  },
  {
    "sku": "helmet-steel",
    "kind": "helmet",
    "model": "steel_helmet",
    "name": "Çelik miğfer",
    "icon": "assets/items-v189/helmet-steel.webp"
  },
  {
    "sku": "helmet-sylvain",
    "kind": "helmet",
    "model": "sylvain_helmet",
    "name": "Vizörlü gladyatör miğferi",
    "icon": "assets/items-v169/helmet-sylvain.webp"
  },
  {
    "sku": "helmet-gold",
    "kind": "helmet",
    "model": "gold",
    "name": "Gladyatör miğferi",
    "icon": "assets/items-v194/helmet-gold.webp",
    "aliases": [
      "gladiator",
      "gladiator_helmet",
      "starter",
      "secutor"
    ]
  },
  {
    "sku": "helmet-roman",
    "kind": "helmet",
    "model": "roman",
    "name": "Roma miğferi",
    "icon": "assets/items-v194/helmet-roman.webp",
    "aliases": [
      "roman_helmet"
    ]
  },
  {
    "sku": "helmet-silver",
    "kind": "helmet",
    "model": "silver",
    "name": "Şövalye miğferi",
    "icon": "assets/items-v194/helmet-silver.webp",
    "aliases": [
      "knights",
      "knights_helm"
    ]
  },
  {
    "sku": "helmet-winged",
    "kind": "helmet",
    "model": "winged",
    "name": "Kanatlı miğfer",
    "icon": "assets/items-v194/helmet-winged.webp",
    "aliases": [
      "winged_helmet_gameready"
    ]
  },
  {
    "sku": "chest",
    "kind": "chest",
    "model": "gladiator_chest",
    "name": "Gladyatör göğüs zırhı",
    "icon": "assets/items-v199/chest.webp"
  },
  {
    "sku": "chest-plate",
    "kind": "chest",
    "model": "chest_plate",
    "name": "İşlemeli göğüs zırhı",
    "icon": "assets/items-v276/chest-plate.webp",
    "aliases": [
      "starter"
    ]
  },
  {
    "sku": "gloves",
    "kind": "gloves",
    "model": "armor_shoulder",
    "name": "İşlemeli çift omuzluk",
    "icon": "assets/items-v199/gloves.webp",
    "aliases": [
      "starter"
    ]
  },
  {
    "sku": "shoulder-armor",
    "kind": "gloves",
    "model": "shoulder_armor",
    "name": "Çift omuz koruma",
    "icon": "assets/items-v199/shoulder-armor.webp"
  },
  {
    "sku": "manica",
    "kind": "gloves",
    "model": "manica",
    "name": "Kolluk",
    "icon": "assets/items-v276/manica.webp"
  },
  {
    "sku": "legs",
    "kind": "legs",
    "model": "starter",
    "name": "Bacaklık",
    "icon": "assets/items-v276/legs.webp",
    "aliases": [
      "legs",
      "greaves"
    ]
  },
  {
    "sku": "heavy_mace",
    "kind": "weapon",
    "model": "heavy_mace",
    "name": "Ağır gürz",
    "icon": "assets/items-v199/heavy_mace.webp"
  },
  {
    "sku": "warhammer",
    "kind": "weapon",
    "model": "warhammer",
    "name": "Savaş çekici",
    "icon": "assets/items-v199/warhammer.webp"
  },
  {
    "sku": "bow",
    "kind": "supply",
    "model": "bow",
    "name": "Yay",
    "icon": "assets/items-v199/bow.webp"
  }
];
 const frames={
  "shield-dura":[44,16,237,287,320,320],
  "shield-parma":[21,15,285,288,320,320],
  "shield-celtic":[17,16,286,288,320,320],
  "shield-azure":[22,15,276,289,320,320],
  "shield-viridis":[81,16,160,288,320,320],
  "shield-aquila":[94,16,136,288,320,320],
  "manica-segmented":[79,17,172,280,320,320],
  "manica-lion":[83,22,149,282,320,320],
  "manica-leather":[70,54,194,236,320,320],
  "trident-gladiator":[23,15,279,282,320,320],
  "halberd":[38,42,240,239,320,320],
  "gladius":[12,17,297,291,320,320],
  "sica":[1,19,319,283,320,320],
  "spear":[12,20,288,288,320,320],
  "trident":[11,14,294,295,320,320],
  "mace":[17,46,280,233,320,320],
  "whip":[11,12,298,297,320,320],
  "scissor":[84,9,132,273,320,320],
  "net":[94,8,132,304,320,320],
  "shield-medium":[57,8,213,303,320,320],
  "shield-large":[83,7,157,305,320,320],
  "helmet-viking":[62,66,209,191,320,320],
  "helmet-steel":[74,39,175,252,320,320],
  "helmet-sylvain":[57,23,213,279,320,320],
  "helmet-gold":[105,57,306,407,512,512],
  "helmet-roman":[107,62,270,396,512,512],
  "helmet-silver":[120,49,372,416,512,512],
  "helmet-winged":[117,59,379,422,512,512],
  "chest":[41,12,244,298,320,320],
  "chest-plate":[0,6,410,495,410,512],
  "gloves":[17,95,288,129,320,320],
  "shoulder-armor":[17,89,287,142,320,320],
  "manica":[15,9,380,503,410,512],
  "legs":[0,0,368,503,410,512],
  "heavy_mace":[17,22,280,280,320,320],
  "warhammer":[17,27,262,272,320,320],
  "bow":[45,46,258,260,320,320]
 };
 const records=Object.freeze(Object.fromEntries(rows.map(r=>[r.sku,Object.freeze({...r,aliases:Object.freeze(r.aliases||[])})]))),byModel=new Map();
 for(const r of Object.values(records))for(const model of [r.model,...r.aliases])byModel.set(r.kind+':'+model,r);
 function entry(item){
  if(!item)return null;
  // Explicit model identity wins over a stale SKU. Unknown models never impersonate another item.
  if(item.kind&&item.model)return byModel.get(item.kind+':'+item.model)||null;
  const r=records[item.sku];if(r&&(!item.kind||r.kind===item.kind))return r;
  const defaults={helmet:'gold',chest:'chest_plate',gloves:'armor_shoulder',legs:'starter',shield:'round'};return byModel.get(item.kind+':'+defaults[item.kind])||null;
 }
 function nameForItem(item){const r=entry(item);return r&&!['sica','gladius'].includes(r.model)?r.name:null;}
 function photo(sku){return records[sku]?.icon||null;}
 // Orient the weapon tip towards the upper left, keeping the enhancement
 // header fixed. SVG transforms preserve the original raster detail.
 const northwest={gladius:'rotate',sica:'vertical',halberd:'horizontal',spear:'horizontal',trident:'horizontal','trident-gladiator':'horizontal',mace:'horizontal',heavy_mace:'horizontal',warhammer:'horizontal',whip:'horizontal'};
 function artwork(item){
  const r=entry(item);if(!r)return null;
  const level=Number(item?.enhancement),hasLevel=item?.enhancement!=null&&Number.isFinite(level)&&level>=0&&r.kind!=='supply';
  // The number owns a separate header strip. Only transparent margins around
  // the original bitmap are excluded by the art viewport; pixels are unchanged.
  const f=frames[r.sku],box=f?f.slice(0,4).join(' '):'0 0 320 320',w=f?.[4]||320,h=f?.[5]||320;
  const direction=northwest[r.sku],cx=f?2*f[0]+f[2]:w,cy=f?2*f[1]+f[3]:h;
  const transform=direction==='rotate'?'translate('+cx+' '+cy+') scale(-1 -1)':direction==='vertical'?'translate(0 '+cy+') scale(1 -1)':direction==='horizontal'?'translate('+cx+' 0) scale(-1 1)':'';
  const badge=hasLevel?'<span class="item-enhancement-v269" aria-hidden="true" style="position:absolute;right:4px;top:1px;font:600 11px/13px Arial,sans-serif;color:var(--item-enhancement-color,#363b40)!important;background:none!important;pointer-events:none">+'+Math.floor(level)+'</span>':'';
  return '<span class="item-photo-v118" style="display:block;position:relative;width:100%;height:100%;overflow:hidden;--item-header:'+(hasLevel?'15px':'2px')+';--item-footer:2px" role="img" aria-label="'+r.name+(hasLevel?' +'+level:'')+'"><svg class="equipment-icon item-image-v271" viewBox="'+box+'" preserveAspectRatio="xMidYMid meet" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" style="position:absolute;left:2px;top:var(--item-header);width:calc(100% - 4px);height:calc(100% - var(--item-header) - var(--item-footer));background:transparent!important;overflow:hidden"><image href="'+r.icon+'" x="0" y="0" width="'+w+'" height="'+h+'"'+(transform?' transform="'+transform+'" data-tip="northwest"':'')+'/></svg>'+badge+'</span>';
 }

 function placeholder(item){return '<svg class="equipment-icon" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+(item?'Eşya görseli bulunamadı':'Boş ekipman yuvası')+'"><circle cx="48" cy="48" r="30" fill="none" stroke="#b8aa91"/><path d="M48 34v28M34 48h28" stroke="#b8aa91" stroke-width="2"/></svg>';}
 const api=Object.freeze({version:199,records,entry,nameForItem,photo,artwork,placeholder});root.LudusItemVisuals=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
