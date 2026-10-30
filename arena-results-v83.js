/* Match statistics are local combat facts; rewards appear only after the server receipt. */
var ArenaBattleResult=(()=>{
 'use strict';
 const kinds={weapon:'Silah',shield:'Kalkan',helmet:'Miğfer',chest:'Göğüslük',gloves:'Kolluk',legs:'Bacaklık'};
 const number=value=>Math.max(0,Number(value)||0).toLocaleString('tr-TR',{maximumFractionDigits:0});
 function rewardRows(reward){
  const rows=[];
  for(const [key,label,icon]of [['fame','Şan','exp'],['gold','Denarius','coin'],['ludus_exp','Ludus EXP','exp'],['diamonds','Elmas','diamond']])if(Number(reward[key])>0)rows.push({label,value:number(reward[key]),icon});
  if(Number(reward.teammate_fame)>0)rows.push({label:'Takım arkadaşının Şanı',value:number(reward.teammate_fame),icon:'exp'});
  if(reward.stone?.name)rows.push({label:String(reward.stone.name),value:number(reward.stone.quantity||1),icon:'stone'});
  else if(Number(reward.sapphires)>0)rows.push({label:'Safir',value:number(reward.sapphires),icon:'stone'});
  if(reward.kind)rows.push({label:kinds[reward.kind]||'Eşya',value:'1',icon:'equipment'});
  if(reward.extracted?.length)rows.push({label:'Envantere dönen ekipman',value:number(reward.extracted.length),icon:'inventory'});
  return rows;
 }
 function statsRows(combat){
  const s=combat.stats;
  return [['Dövüş süresi',number(combat.time)+' sn'],['Verilen hasar',number(s.damage)],['Alınan hasar',number(s.damageTaken)],['İsabetli darbe',number(s.hits)],['Alt edilen rakip',number(s.kills)],['Blok',number(s.blocks)],['Sıyrılma',number(s.dodges)],['Savuşturma',number(s.parries)]];
 }
 function glyph(kind){
  const paths={coin:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="M14 7h-3v10m-2-8h6m-6 5h6"/>',exp:'<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>',diamond:'<path d="m3 7 4-4h10l4 4-9 14ZM3 7h18M7 3l5 18 5-18"/>',stone:'<path d="m12 2 8 5v10l-8 5-8-5V7ZM4 7h16M4 17h16M12 2 8 7v10l4 5 4-5V7Z"/>',equipment:'<path d="m4 20 4-4m-2-2 4 4m-3-3L18 3l3 3-12 11M3 21l3-1-2-2Z"/>',inventory:'<path d="M3 7h18v14H3ZM2 3h20v4H2Zm7 8h6"/>'};
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">'+(paths[kind]||paths.stone)+'</svg>';
 }
 function rewards(doc,reward){
  const list=doc.getElementById('resultRewards');list.replaceChildren();
  for(const row of rewardRows(reward)){const line=doc.createElement('div'),icon=doc.createElement('i'),label=doc.createElement('span'),value=doc.createElement('b');line.className='result-reward-row';icon.className='result-reward-icon '+row.icon;icon.innerHTML=glyph(row.icon);label.textContent=row.label;value.textContent=row.value;line.append(icon,label,value);list.append(line);}
  if(!list.childElementCount){const p=doc.createElement('p');p.className='result-empty';p.textContent=reward.survival?'Rekorun kaydedildi. Ekipmanın korunur.':'Bu savaşta ödül kazanılmadı.';list.append(p);}
 }
 function show(doc,combat){
  const survival=!!combat.survival;const win=combat.result==='win',solo=combat.mode==='solo20',player=combat.fighters[0];
  doc.getElementById('result').dataset.outcome=win?'win':'loss';
  doc.getElementById('resultMode').textContent=combat.mode==='pit'?'AVENTINUS ARENASI · BİRE BİR':survival?'SURVIVAL':solo?'SOLO 20':'4 × 5 TAKIM SAVAŞI';
  doc.getElementById('resultTitle').textContent=survival?'STAGE '+combat.survival.stage:win?'ZAFER':'MAĞLUBİYET';
  doc.getElementById('resultDescription').textContent=combat.mode==='pit'?'Şan düellosu · Ekipmanın korunur':survival?'Tek hedef sendin · Mücadelen sona erdi':solo?'Yirmi gladyatör · Son kalan kazanır':'Dört takım · Beşer gladyatör';
  doc.getElementById('resultGladiator').textContent=player.name;
  doc.getElementById('resultRank').textContent=combat.mode==='pit'?(win?'Düello galibiyeti':'Düello mağlubiyeti'):survival?number(combat.survival.completed):solo?number(win?1:combat.stats.placement||combat.fighters.filter(f=>f.hp>0).length+1)+' / 20':win?'Takım zaferi':'Takım mağlubiyeti';
  doc.getElementById('resultRankLabel').textContent=combat.mode==='pit'?'DÜELLO SONUCU':survival?'TAMAMLANAN STAGE':solo?'SOLO 20 DERECESİ':'TAKIM SONUCU';
  if(combat.pitRound){
   const pairs=combat.pitRound.mode==='2x5';
   doc.getElementById('resultMode').textContent='AVENTINUS ARENASI · '+combat.pitRound.mode;
   doc.getElementById('resultDescription').textContent=pairs?'Beş takım · İkişer gladyatör':'On gladyatör · Sırayla katılım';
   doc.getElementById('resultGladiator').textContent=combat.fighters.filter(f=>f.team===0).map(f=>f.name).join(' · ');
   doc.getElementById('resultRank').textContent=pairs?(win?'Takım zaferi':'Takım mağlubiyeti'):(win?'Son kalan savaşçı':'Savaşçın elendi');
   doc.getElementById('resultRankLabel').textContent= combat.pitRound.mode+' SONUCU';
  }
  const list=doc.getElementById('resultStats');list.replaceChildren();
  for(const [label,value]of statsRows(combat)){const row=doc.createElement('div'),dt=doc.createElement('dt'),dd=doc.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);list.append(row);}
 }
 return {show,rewards,rewardRows,statsRows};
})();
if(typeof module!=='undefined')module.exports=ArenaBattleResult;
