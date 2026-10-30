/* V206: transparent compact HUD, with the live level at the far right. */
(function(root){
 'use strict';
 const families=['gold','diamond','sapphire','emerald','ruby'];
 const labels=['Altın','Elmas','Safir','Zümrüt','Yakut'];
 const full=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0});
 const compact=new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:1});
 const integer=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):null;
 function amount(value,family){const n=integer(value);return n===null?'—':n>=(family==='gold'?1000000:10000)?compact.format(n):family==='gold'?full.format(n):String(n);}
 function rosterCounts(roster,loaded,now){
  const rows=roster.map(g=>g.record||g).filter(g=>g.id);
  const free=loaded?rows.filter(g=>(!g.status||g.status==='available')&&!g.clan_roster_id&&!g.market_listing_id&&!g.locked_battle_id&&
   ![g.injured_until,g.training_ends_at,g.session?.train_until,g.session?.rest_until].some(t=>Date.parse(t)>now)).length:null;
  return {free,total:rows.length};
 }
 function create(ctx){
  const menu=document.querySelector('.ludus-menu'),wallet=document.getElementById('accountSummary'),tools=menu.querySelector('.tools');
  menu.id='ludusHud';menu.dataset.hud='206';menu.setAttribute('role','group');menu.setAttribute('aria-label','Ludus kaynakları ve menü');
  const el=(tag,cls)=>{const n=document.createElement(tag);n.className=cls||'';return n;};
  const icon=name=>{const img=el('img','hud-icon hud-icon--'+name);img.src='assets/hud-v202/'+name+'.webp';img.alt='';img.width=144;img.height=144;img.draggable=false;return img;};
  const named=(node,label)=>{node.title=label;node.setAttribute('aria-label',label);return node;};
  const button=(id,label,action)=>{const b=named(el('button','hud-action'),label);b.id=id;b.type='button';b.onclick=action;return b;};
  const level=named(el('a','hud-level'),'Ludus seviyesi yükleniyor');level.id='ludusLevelBadge';level.href='ludus-seviye.html?v=revision206';
  const ns='http://www.w3.org/2000/svg',levelSvg=document.createElementNS(ns,'svg'),levelNumber=document.createElementNS(ns,'text');
  levelSvg.setAttribute('viewBox','0 0 192 192');levelSvg.setAttribute('aria-hidden','true');levelSvg.classList.add('hud-level-type');
  levelNumber.classList.add('hud-level-number');levelNumber.setAttribute('x','96');levelNumber.setAttribute('text-anchor','middle');
  levelSvg.append(levelNumber);level.append(icon('level'),levelSvg);
  const measure=document.createElement('canvas').getContext('2d');
  function centerLevel(value){
   const text=String(value),size=text.length>2?56:76;levelNumber.textContent=text;levelNumber.setAttribute('font-size',String(size));
   // Center the visible numeral ink in the burgundy disk (y=93), not the font line box or lower wreath knot.
   measure.font='600 '+size+'px Georgia';const metrics=measure.measureText(text);
   levelNumber.setAttribute('y',String(93+(metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2));
  }
  centerLevel('—');document.fonts?.ready.then(()=>centerLevel(levelNumber.textContent));
  wallet.replaceChildren();wallet.setAttribute('aria-label','Kaynaklar');
  const money=families.map((family,i)=>{
   const b=el('span','money');b.dataset.currency=family;
   if(i===0)b.append(icon('coin'));else{const gem=el('span','hud-gem');gem.innerHTML=root.LudusGems.svg(family);b.append(gem);}
   const value=el('span','hud-value');value.textContent='—';b.append(value);named(b,labels[i]+' yükleniyor');wallet.append(b);return {b,value};
  });
  const crew=el('div','hud-crew');crew.setAttribute('role','group');crew.setAttribute('aria-label','Boş ve toplam birimler');
  const caravan=button('caravanHud','Kervan bilgileri yükleniyor',ctx.openCaravans),fighters=button('gladiatorHud','Gladyatör bilgileri yükleniyor',ctx.openGladiators);
  const caravanCount=el('span','hud-count caravan-hud-count'),fighterCount=el('span','hud-count');
  caravanCount.textContent=fighterCount.textContent='—/—';caravan.append(icon('caravan'),caravanCount);fighters.append(icon('gladiator'),fighterCount);crew.append(caravan,fighters);
  const nav=el('nav','hud-navigation');nav.setAttribute('aria-label','Dünya');
  for(const [id,name,label,href]of [['ludusMap','map','Harita','roma.html?v=revision206'],['imperialRankings','rankings','Sıralamalar','siralamalar.html?v=revision206&from=ludus.html']]){
   const a=named(el('a','hud-action'),label);a.id=id;a.href=href;a.append(icon(name));nav.append(a);
  }
  tools.setAttribute('role','group');tools.setAttribute('aria-label','Sosyal ve ayarlar');
  for(const [id,name]of [['friendsOpen','friends'],['messagesOpen','messages'],['accountLink','settings']]){
   const b=document.getElementById(id);b.querySelectorAll('svg').forEach(n=>n.remove());b.prepend(icon(name));b.classList.add('hud-action');b.type='button';
  }
  menu.replaceChildren(wallet,crew,nav,tools,level);
  function setOne(i,value){const {b,value:node}=money[i],n=integer(value),text=amount(n,families[i]);if(node.textContent!==text)node.textContent=text;const title=n===null?labels[i]+' yükleniyor':full.format(n)+' '+labels[i];if(b.title!==title)named(b,title);}
  function setCount(node,textNode,free,total,label){
   const f=integer(free),t=integer(total),safe=f===null||t===null?null:Math.min(f,t),text=(safe??'—')+'/'+(t??'—');
   if(textNode.textContent!==text)textNode.textContent=text;
   const description=safe===null?label+' bilgileri yükleniyor':safe+' boş / '+t+' toplam '+label;
   if(node.title!==description)named(node,description);node.dataset.free=safe??'';node.dataset.total=t??'';
  }
  return {
   setWallet:values=>values.forEach((v,i)=>{if(i<money.length)setOne(i,v);}),setGold:value=>setOne(0,value),
   setLevel:data=>{const n=integer(data?.level);centerLevel(n??'—');named(level,n===null?'Ludus seviyesi yükleniyor':'Ludus seviyesi '+n+' · '+(ctx.levelDescription?.(data)||'Seviye ödüllerini aç'));},
   setCaravans:data=>setCount(caravan,caravanCount,data?.free_caravans??data?.free_workers,data?.caravans??data?.workers,'kervan'),
   setRoster:(roster,loaded,now)=>{const c=rosterCounts(roster,loaded,now);setCount(fighters,fighterCount,c.free,c.total,'gladyatör');fighters.disabled=!c.total;}
  };
 }
 root.LudusHudV206={create,amount,rosterCounts};
})(globalThis);
