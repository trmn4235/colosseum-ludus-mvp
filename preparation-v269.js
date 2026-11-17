/* Read-only presentation of the exact item rules used by combat. */
(function(root){
 'use strict';
 const number=v=>Number.isFinite(v)?Number(v.toFixed(2)).toLocaleString('tr-TR'):'—';
 const profileRequests=new WeakMap();
 function el(tag,cls,text){const n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;}
 function profile(host,gladiator,career,mode){
  const token={};profileRequests.set(host,token);host.replaceChildren();
  const values={};
  for(const [key,label,value,title]of [
   ['overall','Overall',root.LudusExercise.format(gladiator.overall??50)],
   ['level','Seviye',gladiator.level],
   ['energy','Enerji',root.LudusExercise.format(root.LudusExercise.energy(gladiator))+'%'],
   ['kd','K/D','—','Öldürme / Ölüm'],
   ['kda','K/D/A','—','(Öldürme + Asist) / Ölüm'],
   ['record','Gal. / Mağ.','—','Galibiyet / Mağlubiyet']
  ]){const dt=el('dt','',label),dd=el('dd','',value);dt.title=title||label;dd.title=title||label;dd.dataset.profileField=key;values[key]=dd;host.append(dt,dd);}
  if(!career?.summary)return;
  const ratio=(k,d)=>k==null||d==null?'—':d===0?(k>0?'∞':'0'):number(k/d);
  career.summary(gladiator.id,mode).then(s=>{
   if(profileRequests.get(host)!==token)return;
   const partialKD=s.kd_matches>0&&s.kd_matches<s.matches,partialKDA=s.kda_matches>0&&s.kda_matches<s.matches;
   values.kd.textContent=s.kd_matches>0?ratio(s.kd_kills,s.kd_deaths)+(partialKD?'*':''):'—';
   values.kda.textContent=s.kda_matches>0?ratio(s.kda_kills+s.kda_assists,s.kda_deaths)+(partialKDA?'*':''):'—';
   values.kd.title='Öldürme / Ölüm · '+(s.kd_matches||0)+' / '+s.matches+' maçta kayıt';
   values.kda.title='(Öldürme + Asist) / Ölüm · '+(s.kda_matches||0)+' / '+s.matches+' maçta kayıt';
   values.record.textContent=number(s.wins)+' / '+number(s.losses);
  }).catch(()=>{if(profileRequests.get(host)===token)for(const key of ['kd','kda','record'])values[key].title='Kariyer kaydı alınamadı';});
 }
 function mini(item){
  const box=el('span','prep-item-summary'),rules=root.LudusItemSystem,stats=rules.effectiveStats(item),key=rules.statsFor(item.kind)[0];
  box.append(el('span','',key?key.label+' '+number(stats[key.key]):''));
  const dots=el('span','prep-gem-dots');dots.setAttribute('aria-label',(item.emeralds||[]).length+' / 4 zümrüt');
  for(let i=0;i<4;i++)dots.append(el('i',item.emeralds?.[i]?'filled':''));box.append(dots);return box;
 }
 function render(host,item,name){
  host.replaceChildren();const rules=root.LudusItemSystem,head=el('header','prep-item-head');
  head.append(el('span','prep-eyebrow','EKİPMAN ÖZELLİKLERİ'),el('h3','',item?name(item)+' +'+(Number(item.enhancement)||0):'Boş ekipman yuvası'));host.append(head);
  if(!item){host.append(el('p','prep-empty','Envanterden bir eşya seç. Özellikleri ve zümrütleri burada görünecek.'));return;}
  const values=rules.effectiveStats(item),grid=el('dl','prep-stat-grid');
  for(const stat of rules.statsFor(item.kind)){const cell=el('div','prep-stat');const label=el('dt','',({pierce_resistance:'Delici Direnci',slash_resistance:'Kesici Direnci',projectile_resistance:'Fırlatma Direnci'})[stat.key]||stat.label);label.title=stat.label;cell.append(label,el('dd','',number(values[stat.key])));grid.append(cell);}host.append(grid);
  const gems=item.emeralds||[],heading=el('div','prep-gem-heading');heading.append(el('h4','','ZÜMRÜT YUVALARI'),el('span','',gems.length+' / 4'));host.append(heading);
  const sockets=el('div','prep-sockets');
  for(let i=0;i<4;i++){
   const socket=gems[i],stone=socket&&rules.stone('emerald',socket.id),cell=el('div','prep-socket'+(stone?' filled':' empty')),art=el('span','prep-gem-art'),copy=el('div','prep-gem-copy');
   if(stone){art.innerHTML=root.LudusGems.svg('emerald',stone.id);const amount=rules.emeraldPower[stone.id-1]*socket.value/100;copy.append(el('strong','',stone.title+' · %'+number(socket.value)),el('span','',stone.label),el('b','','+'+number(amount)));cell.title=stone.name+' · '+stone.label+' +'+number(amount);}
   else{art.textContent='◇';copy.append(el('strong','','Boş yuva'),el('span','',String(i+1)+'. zümrüt yuvası'));}
   cell.append(art,copy);sockets.append(cell);
  }
  host.append(sockets,el('p','prep-total-note','Değerler geliştirme ve taş bonuslarını içerir.'));
 }
 root.LudusPreparation=Object.freeze({render,mini,profile});
})(globalThis);
