/* V210: one icon/count gap; evenly distributed groups anchored at each wing’s endpoints. */
(function(root){
 'use strict';
 const families=['gold','diamond','sapphire','emerald','ruby'],labels=['Altın','Elmas','Safir','Zümrüt','Yakut'];
 const full=new Intl.NumberFormat('tr-TR',{maximumFractionDigits:0});
 const compact=new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:1});
 const short=new Intl.NumberFormat('tr-TR',{notation:'compact',maximumFractionDigits:0});
 const integer=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):null;
 function amount(value){const n=integer(value);return n===null?'—':n<10000?String(n):compact.format(n);}
 function rosterCounts(roster,loaded,now){
  const rows=roster.map(g=>g.record||g).filter(g=>g.id);
  return {free:loaded?rows.filter(g=>(!g.status||g.status==='available')&&!g.clan_roster_id&&!g.market_listing_id&&!g.locked_battle_id&&
   ![g.injured_until,g.training_ends_at,g.session?.train_until,g.session?.rest_until].some(t=>Date.parse(t)>now)).length:null,total:rows.length};
 }
 const crops={coin:[144,144,0,9,123,135],map:[144,144,0,16,139,127],gladiator:[144,144,7,0,137,144],
  caravan:[144,144,0,20,144,124],friends:[144,144,0,10,144,135],messages:[144,144,13,26,144,117],
  settings:[144,144,0,0,144,143],rankings:[144,144,0,14,144,129],level:[192,192,0,7,192,185],palmette:[1254,1254,176,119,1108,1088]};
 const ns='http://www.w3.org/2000/svg';
 function create(ctx){
  const menu=document.querySelector('.ludus-menu'),wallet=document.getElementById('accountSummary'),tools=menu.querySelector('.tools');
  menu.id='ludusHud';menu.dataset.hud='210';menu.setAttribute('role','group');menu.setAttribute('aria-label','Ludus kaynakları ve menü');
  const el=(tag,cls)=>{const n=document.createElement(tag);n.className=cls||'';return n;};
  const svgEl=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs||{}))n.setAttribute(k,v);return n;};
  const named=(node,label)=>{node.title=label;node.setAttribute('aria-label',label);return node;};
  function art(name){
   const clip=el('span','hud-art-clip');clip.setAttribute('aria-hidden','true');
   const img=el('img','hud-art hud-icon--'+name),gem=families.slice(1).includes(name);
   img.src=gem?'assets/hud-v207/'+name+'.svg':name==='palmette'?'assets/hud-v207/palmette.webp':'assets/hud-v202/'+name+'.webp';
   img.alt='';img.draggable=false;const [iw,ih,x,y,r,b]=crops[name]||[48,48,0,0,48,48];
   img.width=iw;img.height=ih;img.style.width=(100*iw/(r-x))+'%';img.style.height=(100*ih/(b-y))+'%';
   img.style.left=(-100*x/(r-x))+'%';img.style.top=(-100*y/(b-y))+'%';clip.append(img);return clip;
  }
  const frame=svgEl('svg',{'class':'hud-frame','aria-hidden':'true'});
  frame.innerHTML='<defs><linearGradient id="hud210-metal" x1="0" y1="0" x2="0" y2="1">'+
   '<stop offset="0" stop-color="#99621e"/><stop offset=".19" stop-color="#e4bc65"/><stop offset=".36" stop-color="#fff1bd"/><stop offset=".51" stop-color="#a76d24"/><stop offset=".72" stop-color="#e9c470"/><stop offset="1" stop-color="#96601d"/>'+
   '</linearGradient><pattern id="hud210-marble" width="1" height="1" viewBox="0 0 1024 128" preserveAspectRatio="none">'+
   '<image width="1024" height="128" preserveAspectRatio="xMidYMid slice" href="assets/hud-v207/cream-marble.webp"/></pattern></defs>'+
   '<path class="frame-shadow" fill="url(#hud210-marble)" stroke="#926321"/><path class="frame-metal" fill="none" stroke="url(#hud210-metal)"/><path class="frame-accent" fill="none" stroke="#6f1b28"/>';
  const track=el('div','hud-track'),safeArea=el('span','hud-safe-area'),units=[];safeArea.setAttribute('aria-hidden','true');
  wallet.replaceChildren();wallet.setAttribute('aria-label','Kaynaklar');
  const money=families.map((family,i)=>{
   const b=el('span','money hud-indicator');b.dataset.currency=family;b.dataset.key=family;b.append(art(i?family:'coin'));
   const value=el('span','hud-value');value.textContent='—';b.append(value);named(b,labels[i]+' yükleniyor');wallet.append(b);units.push(b);return {b,value,n:null};
  });
  const link=(id,key,label,href)=>{const a=named(el('a','hud-action hud-indicator'),label);a.id=id;a.dataset.key=key;a.href=href;a.append(art(key));return a;};
  const map=link('ludusMap','map','Harita','roma.html?v=revision210');
  const level=link('ludusLevelBadge','level','Ludus seviyesi yükleniyor','ludus-seviye.html?v=revision210');level.classList.add('hud-level');
  const levelSvg=svgEl('svg',{'class':'hud-level-type',viewBox:'0 0 48 48','aria-hidden':'true'});
  const levelNumber=svgEl('text',{'class':'hud-level-number',x:24,'text-anchor':'middle',fill:'#fff3d4','font-family':'Georgia,serif','font-weight':'600'});
  levelSvg.append(levelNumber);level.append(levelSvg);
  const measure=document.createElement('canvas').getContext('2d');
  function centerLevel(value){const text=String(value),size=text.length>2?14:20;levelNumber.textContent=text;levelNumber.setAttribute('font-size',size);
   measure.font='600 '+size+'px Georgia';const m=measure.measureText(text);levelNumber.setAttribute('y',String((93-7)/178*48+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2));}
  centerLevel('—');
  const rankings=link('imperialRankings','rankings','Sıralamalar','siralamalar.html?v=revision210&from=ludus.html');
  const nav=el('nav','hud-navigation');nav.setAttribute('aria-label','Dünya ve Ludus seviyesi');nav.append(map,level,rankings);units.push(map,level,rankings);
  const crew=el('div','hud-crew');crew.setAttribute('role','group');crew.setAttribute('aria-label','Boş ve toplam birimler');
  const button=(id,key,label,action)=>{const b=named(el('button','hud-action hud-indicator'),label);b.id=id;b.dataset.key=key;b.type='button';b.onclick=action;b.append(art(key));return b;};
  const fighters=button('gladiatorHud','gladiator','Gladyatör bilgileri yükleniyor',ctx.openGladiators),caravan=button('caravanHud','caravan','Kervan bilgileri yükleniyor',ctx.openCaravans);
  const fighterCount=el('span','hud-count'),caravanCount=el('span','hud-count caravan-hud-count');fighterCount.textContent=caravanCount.textContent='—/—';
  fighters.append(fighterCount);caravan.append(caravanCount);crew.append(fighters,caravan);units.push(fighters,caravan);
  tools.setAttribute('role','group');tools.setAttribute('aria-label','Sosyal ve ayarlar');
  for(const [id,key]of [['friendsOpen','friends'],['messagesOpen','messages'],['accountLink','settings']]){
   const b=document.getElementById(id);b.querySelectorAll('svg').forEach(n=>n.remove());b.prepend(art(key));b.classList.add('hud-action','hud-indicator');b.dataset.key=key;b.type='button';units.push(b);
  }
  track.append(wallet,nav,crew,tools);
  const leftDivider=el('span','hud-divider divider-left'),rightDivider=el('span','hud-divider divider-right');
  const ornaments=['left','right'].map(side=>{const n=el('span','hud-flourish flourish-'+side);n.setAttribute('aria-hidden','true');n.append(art('palmette'));return n;});
  leftDivider.setAttribute('aria-hidden','true');rightDivider.setAttribute('aria-hidden','true');menu.replaceChildren(frame,safeArea,track,leftDivider,rightDivider,...ornaments);
  let scheduled=0,lastFrame='';
  function schedule(){if(!scheduled)scheduled=requestAnimationFrame(()=>{scheduled=0;layout();});}
  function layout(){
   const bounds=menu.getBoundingClientRect(),safe=safeArea.getBoundingClientRect(),w=bounds.width,h=bounds.height;if(!w||!h)return;
   wallet.style.removeProperty('--hud210-wallet-number');
   for(const item of money)item.value.textContent=amount(item.n);
   const s=safe.width/1024,c=w/2,cy=h/2,t=cy-24*s,b=cy+24*s,side=28*s,r=15.2*s,reach=62*s,top=cy-40.48*s,bottom=cy+40.48*s;
   if(lastFrame!==w+':'+h+':'+s){
    lastFrame=w+':'+h+':'+s;const d=`M${side+r} ${t} H${c-reach} C${c-50*s} ${t} ${c-50*s} ${top} ${c} ${top} C${c+50*s} ${top} ${c+50*s} ${t} ${c+reach} ${t} H${w-side-r} Q${w-side} ${t} ${w-side} ${t+r} V${b-r} Q${w-side} ${b} ${w-side-r} ${b} H${c+reach} C${c+50*s} ${b} ${c+50*s} ${bottom} ${c} ${bottom} C${c-50*s} ${bottom} ${c-50*s} ${b} ${c-reach} ${b} H${side+r} Q${side} ${b} ${side} ${b-r} V${t+r} Q${side} ${t} ${side+r} ${t} Z`;
    frame.setAttribute('viewBox',`0 0 ${w} ${h}`);frame.querySelectorAll('path').forEach(p=>p.setAttribute('d',d));
    frame.querySelector('.frame-shadow').setAttribute('stroke-width',6.16*s);frame.querySelector('.frame-metal').setAttribute('stroke-width',4.4*s);frame.querySelector('.frame-accent').setAttribute('stroke-width',.704*s);
   }
   const widths=units.map(n=>n.querySelector('.hud-art-clip').getBoundingClientRect().width),place=(i,x)=>{units[i].style.left=x+'px';};
   const levelLeft=c-widths[6]/2,centerGap=10.56*s;place(6,levelLeft);place(5,levelLeft-centerGap-widths[5]);place(7,c+widths[6]/2+centerGap);
   const dividerX=levelLeft-centerGap-widths[5]-10*s;leftDivider.style.left=dividerX+'px';rightDivider.style.left=(w-dividerX)+'px';
   const origin=bounds.left;
   function distribute(indices,start,end){
    const pieces=indices.filter(i=>!units[i].hidden).map(i=>{const number=units[i].querySelector('.hud-value,.hud-count');return{i,number};});
    // Lock each text run to its rendered advance before distributing the pieces.
    function sizeNumbers(){for(const p of pieces)if(p.number){
     const range=document.createRange();range.selectNodeContents(p.number);
     p.number.style.setProperty('--hud210-value-width',range.getBoundingClientRect().width+'px');
    }}
    sizeNumbers();
    const pairGap=6*s,edge=8*s,minGroupGap=5*s,spaces=Math.max(1,pieces.length-1);
    const width=p=>widths[p.i]+(p.number?pairGap+p.number.getBoundingClientRect().width:0);
    const measureWidth=()=>pieces.reduce((sum,p)=>sum+width(p),0);
    const groupGap=()=>(end-start-2*edge-measureWidth())/spaces;
    // Every icon/value pair keeps the same gap, including when long balances need shorter labels.
    let gap=groupGap();
    if(indices[0]===0&&gap<minGroupGap){
     for(const p of pieces){const item=money[p.i];if(item.n>=10000)item.value.textContent=short.format(item.n).replace(/\s/g,'');}
     sizeNumbers();gap=groupGap();
     if(gap<minGroupGap){
      const textWidth=pieces.reduce((sum,p)=>sum+p.number.getBoundingClientRect().width,0);
      const available=end-start-2*edge-pieces.reduce((sum,p)=>sum+widths[p.i]+pairGap,0)-spaces*minGroupGap;
      const fontSize=parseFloat(getComputedStyle(pieces[0].number).fontSize);
      wallet.style.setProperty('--hud210-wallet-number',(fontSize*Math.min(1,available/textWidth)*.995)+'px');
      sizeNumbers();gap=groupGap();
     }
    }
    // Anchor the first and last groups, then share the remaining space equally between whole groups.
    let x=start+edge;
    for(const p of pieces){
     const unitWidth=width(p);
     units[p.i].style.setProperty('--hud210-unit-width',unitWidth+'px');
     units[p.i].style.setProperty('--indicator-gap',pairGap+'px');
     units[p.i].style.setProperty('--hit-x',Math.max(0,Math.min(9*s,Math.min(edge,gap)/2-1))+'px');
     place(p.i,x);x+=unitWidth+gap;
    }
    return gap;
   }
   // Measure transformed boundary artwork itself, including browser subpixels.
   menu.dataset.leftGap=String(distribute([0,1,2,3,4],Math.max(ornaments[0].getBoundingClientRect().right,safe.left)-origin,leftDivider.getBoundingClientRect().left-origin));
   menu.dataset.rightGap=String(distribute([8,9,10,11,12],rightDivider.getBoundingClientRect().right-origin,Math.min(ornaments[1].getBoundingClientRect().left,safe.right)-origin));
  }
  const resize=new ResizeObserver(schedule);resize.observe(menu);resize.observe(safeArea);
  const visibility=new MutationObserver(schedule);for(const n of units)visibility.observe(n,{attributes:true,attributeFilter:['hidden']});
  document.fonts?.ready.then(()=>{centerLevel(levelNumber.textContent);schedule();});schedule();
  function setOne(i,value){const item=money[i],n=integer(value);item.n=n;const text=amount(n);if(item.value.textContent!==text){item.value.textContent=text;schedule();}const title=n===null?labels[i]+' yükleniyor':full.format(n)+' '+labels[i];if(item.b.title!==title)named(item.b,title);}
  function setCount(node,textNode,free,total,label){const f=integer(free),t=integer(total),safe=f===null||t===null?null:Math.min(f,t),text=(safe??'—')+'/'+(t??'—');
   if(textNode.textContent!==text){textNode.textContent=text;schedule();}named(node,safe===null?label+' bilgileri yükleniyor':safe+' boş / '+t+' toplam '+label);node.dataset.free=safe??'';node.dataset.total=t??'';}
  return {
   setWallet:values=>values.forEach((v,i)=>{if(i<money.length)setOne(i,v);}),setGold:value=>setOne(0,value),
   setLevel:data=>{const n=integer(data?.level);centerLevel(n??'—');named(level,n===null?'Ludus seviyesi yükleniyor':'Ludus seviyesi '+n+' · '+(ctx.levelDescription?.(data)||'Seviye ödüllerini aç'));},
   setCaravans:data=>setCount(caravan,caravanCount,data?.free_caravans??data?.free_workers,data?.caravans??data?.workers,'kervan'),
   setRoster:(roster,loaded,now)=>{const counts=rosterCounts(roster,loaded,now);setCount(fighters,fighterCount,counts.free,counts.total,'gladyatör');fighters.disabled=!counts.total;},
   destroy:()=>{resize.disconnect();visibility.disconnect();cancelAnimationFrame(scheduled);}
  };
 }
 root.LudusHudV210={create,amount,rosterCounts};
})(globalThis);
