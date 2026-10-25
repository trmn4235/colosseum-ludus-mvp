/* Shared equipment taxonomy and direct production recipes. Stock stays server-owned. */
((root)=>{
 'use strict';
 const groups=Object.freeze([
  {id:'swords',kind:'weapon',name:'Kılıçlar',models:['gladius','sica','scissor','halberd'],icon:'gladius'},
  {id:'polearms',kind:'weapon',name:'Trident, mızrak',models:['trident','spear'],icon:'trident'},
  {id:'blunt',kind:'weapon',name:'Gürzler, çekiçler',models:['mace','heavy_mace','warhammer'],icon:'heavy_mace'},
  {id:'flexible',kind:'weapon',name:'Ağ, kırbaç',models:['net','whip'],icon:'net'},
  {id:'large_shields',kind:'shield',name:'Büyük kalkanlar',models:['large'],icon:'shield-large'},
  {id:'small_medium_shields',kind:'shield',name:'Küçük & orta kalkanlar',models:['small','round','medium'],icon:'shield-medium'}
 ].map(g=>Object.freeze({...g,models:Object.freeze(g.models)})));
 const additions=[
  ['heavy_mace','Ağır gürz','weapon','heavy_mace',{steel:3,bronze:1,wood:2,leather:1,resin:1}],
  ['warhammer','Savaş çekici','weapon','warhammer',{steel:4,bronze:1,wood:2,leather:2,resin:1}]
 ];
 const groupFor=item=>groups.find(g=>g.kind===item?.kind&&g.models.includes(item.model));
 const matches=(item,id)=>!id||groupFor(item)?.id===id;
 const breaker=item=>groupFor(typeof item==='string'?{kind:'weapon',model:item}:item)?.id==='blunt';
 const feature=item=>breaker(item)?'Kalkan kırıcı: kalkana isabet eden 2 darbe kalkanı savaş boyunca kullanılamaz hâle getirir.':'';
 const api={version:168,groups,additions,groupFor,matches,breaker,feature};root.LudusEquipmentGroups=api;
 const p=root.LudusProduction;
 if(p&&p.version<168){
  const photo=p.photo,sku=p.skuForItem;
  p.equipment.push(...additions);
  p.recipes.push(...additions.map(([sku,name,kind,model,ingredients])=>({sku,name,kind,model,ingredients,output_type:'equipment',output_quantity:1,group:'equipment',subcategory:'blunt'})));
  p.photo=id=>additions.some(a=>a[0]===id)?'assets/items-v168/'+id+'.webp':photo(id);
  p.skuForItem=i=>additions.find(a=>a[0]===i?.sku||i?.kind==='weapon'&&a[3]===i.model)?.[0]||sku(i);
  const art=p.artwork;p.artwork=i=>{const id=p.skuForItem(i);if(!additions.some(a=>a[0]===id))return art(i);return '<svg class="equipment-icon item-photo-v118" viewBox="0 0 96 96" role="img" aria-label="'+additions.find(a=>a[0]===id)[1]+'"><image href="'+p.photo(id)+'" x="4" y="4" width="88" height="88" preserveAspectRatio="xMidYMid meet"/></svg>';};
  p.version=168;
 }
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
