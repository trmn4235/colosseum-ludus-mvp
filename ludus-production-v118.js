/* V118: integer production units, one steel Gladius, shared photographic assets.
 * Server recipes and stock remain authoritative. This catalog supplies artwork,
 * migration inputs and readable names without inventing client-side inventory.
 */
(function(root){
 'use strict';
 const raw=[
  ['iron_ore','Demir cevheri',1.5],['copper_ore','Bakır cevheri',1.2],
  ['tin_ore','Kalay cevheri',2],['lead_ore','Kurşun cevheri',1],
  ['wood','Odun',.6],['flax','Ham keten',1],['hide','Ham deri',2.5],
  ['wool','Yün',1.2],['resin','Reçine',.8]
 ];
 const processed=[
  ['charcoal','Odun kömürü',{wood:2}],
  ['iron','Demir külçe',{iron_ore:2,charcoal:1}],
  ['copper','Bakır külçe',{copper_ore:2,charcoal:1}],
  ['bronze','Bronz külçe',{copper:3,tin_ore:1,charcoal:1}],
  ['steel','Çelik külçe',{iron:1,charcoal:1}],
  ['leather','İşlenmiş deri',{hide:1}],
  ['rope','İp',{flax:2}],
  ['linen','Keten kumaş',{flax:3}],
  ['wool_cloth','Yünlü kumaş',{wool:3}],
  ['wooden_handle','Ahşap sap',{wood:1,resin:1}],
  ['shield_frame_small','Küçük kalkan gövdesi',{wood:3,resin:1}],
  ['shield_frame_large','Büyük kalkan gövdesi',{wood:6,resin:2}],
  ['lead_weight','Kurşun ağırlık',{lead_ore:2,charcoal:1}],
  ['net_mesh','Ağ gövdesi',{rope:3}]
 ];
 const equipment=[
  ['gladius','Gladius','weapon','gladius',{steel:2,leather:1,wood:1}],
  ['sica','Sica','weapon','sica',{iron:2,leather:1,wood:1}],
  ['spear','Mızrak','weapon','spear',{steel:6,wooden_handle:3,rope:2}],
  ['trident','Trident','weapon','trident',{steel:8,wooden_handle:3,rope:3}],
  ['mace','Zincirli gürz','weapon','mace',{iron:2,wooden_handle:1,leather:1}],
  ['whip','Kırbaç','weapon','whip',{leather:3,wood:1}],
  ['scissor','Kol bıçağı','weapon','scissor',{iron:2,leather:1}],
  ['net','Savaş ağı','weapon','net',{net_mesh:2,rope:2,lead_weight:4}],
  ['shield-medium','Küçük kalkan','shield','round',{shield_frame_small:1,leather:2,bronze:1}],
  ['shield-large','Büyük kalkan','shield','large',{shield_frame_large:1,leather:3,bronze:2}],
  ['helmet-gold','Gladyatör miğferi','helmet','gold',{bronze:4,leather:3,linen:2,wool_cloth:1}],
  ['helmet-roman','Roma miğferi','helmet','roman',{bronze:4,leather:2,linen:3,wool_cloth:1}],
  ['helmet-silver','Şövalye miğferi','helmet','silver',{iron:12,leather:4,linen:3,wool_cloth:1}],
  ['helmet-winged','Kanatlı miğfer','helmet','winged',{iron:10,bronze:1,leather:4,linen:3,wool_cloth:1}],
  ['chest','Gladyatör göğüs zırhı','chest','gladiator_chest',{iron:14,leather:7,linen:4,wool_cloth:2}],
  ['chest-plate','İşlemeli göğüs zırhı','chest','chest_plate',{iron:18,leather:8,linen:5,wool_cloth:3}],
  ['gloves','İşlemeli çift omuzluk','gloves','armor_shoulder',{leather:2,bronze:1,wool_cloth:1}],
  ['shoulder-armor','Çift omuz koruma','gloves','shoulder_armor',{iron:3,leather:4,linen:1,wool_cloth:1}],
  ['legs','Bacaklık','legs','starter',{bronze:1,leather:1,wool_cloth:1}]
 ];
 const supplies=[['bow','Yay',{wood:3,rope:2,resin:1},1],['arrow','Ok',{wood:5,iron:1,rope:1},50]];
 const resources=[
  ...raw.map(([sku,name,base_price])=>({sku,name,stage:'raw',base_price})),
  ...processed.map(([sku,name])=>({sku,name,stage:'processed'})),
  ...supplies.map(([sku,name])=>({sku,name,stage:'supply'}))
 ];
 const recipes=[
  ...processed.map(([sku,name,ingredients])=>({sku,name,ingredients,kind:'material',output_type:'resource',output_quantity:1,group:'processing'})),
  ...equipment.map(([sku,name,kind,model,ingredients])=>({sku,name,kind,model,ingredients,output_type:'equipment',output_quantity:1,group:'equipment'})),
  ...supplies.map(([sku,name,ingredients,output_quantity])=>({sku,name,ingredients,kind:'supply',output_type:'resource',output_quantity,group:'equipment'}))
 ];
 const existing=new Set(['iron','copper','wood','leather','linen','grain','apple','meat','fish','egg','beer','olive_oil']);
 const known=new Set([...resources,...recipes].map(x=>x.sku));
 function photo(sku){if(sku==='mace')return 'assets/caravan-v124/mace.webp';return existing.has(sku)?'assets/resource-icons-v95/'+sku+'.webp':known.has(sku)?'assets/items-v118/'+sku+'.webp':null;}
 function skuForItem(item){
  if(known.has(item?.sku))return item.sku;
  const k=item?.kind,m=item?.model;
  if(k==='weapon')return equipment.find(x=>x[2]===k&&x[3]===m)?.[0]||null;
  if(k==='shield')return m==='large'?'shield-large':'shield-medium';
  if(k==='helmet')return ['roman','roman_helmet'].includes(m)?'helmet-roman':['silver','knights','knights_helm'].includes(m)?'helmet-silver':['winged','winged_helmet_gameready'].includes(m)?'helmet-winged':'helmet-gold';
  if(k==='chest')return m==='chest_plate'?'chest-plate':'chest';
  if(k==='gloves')return m==='shoulder_armor'?'shoulder-armor':'gloves';
  if(k==='legs')return 'legs';
  return null;
 }
 function artwork(item){
  const sku=skuForItem(item),src=photo(sku);if(!src)return null;
  const name=recipes.find(r=>r.sku===sku)?.name||resources.find(r=>r.sku===sku)?.name||'Ekipman';
  return '<svg class="equipment-icon item-photo-v118" style="display:block;width:100%;height:100%;overflow:hidden" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="'+name+'"><image href="'+src+'" x="4" y="4" width="88" height="88" preserveAspectRatio="xMidYMid meet"/></svg>';
 }
 const api={version:118,raw,processed,equipment,supplies,resources,recipes,photo,skuForItem,artwork};
 root.LudusProduction=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
