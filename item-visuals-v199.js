/* V199: one visual identity for cards, inventory, upgrades, battle selection and fallbacks. */
(function(root){
 'use strict';
 const rows=[
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
    "icon": "assets/items-v199/chest-plate.webp",
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
    "icon": "assets/items-v199/manica.webp"
  },
  {
    "sku": "legs",
    "kind": "legs",
    "model": "starter",
    "name": "Bacaklık",
    "icon": "assets/items-v199/legs.webp",
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
 function artwork(item){const r=entry(item);if(!r)return null;return '<svg class="equipment-icon item-photo-v118" style="display:block;width:100%;height:100%;overflow:hidden" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+r.name+'"><image href="'+r.icon+'" x="4" y="4" width="88" height="88" preserveAspectRatio="xMidYMid meet"/></svg>';}
 function placeholder(item){return '<svg class="equipment-icon" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+(item?'Eşya görseli bulunamadı':'Boş ekipman yuvası')+'"><circle cx="48" cy="48" r="30" fill="none" stroke="#b8aa91"/><path d="M48 34v28M34 48h28" stroke="#b8aa91" stroke-width="2"/></svg>';}
 const api=Object.freeze({version:199,records,entry,nameForItem,photo,artwork,placeholder});root.LudusItemVisuals=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
