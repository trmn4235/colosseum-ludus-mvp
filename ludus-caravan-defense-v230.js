/* Owned ambush alerts. The server selects attacks and verifies all battle results. */
(function(root){
 'use strict';
 function create(ctx){
  let owner=null,state={encounters:[],gladiators:[]},busy=false,last=0,offset=0,entering=false,page=0;
  const active=()=>state.encounters.filter(d=>d.status!=='resolved'&&Date.parse(d.deadline)>Date.now()+offset);
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
  async function refresh(){if(busy||document.hidden)return;busy=true;last=Date.now();try{owner=(await ctx.ready).user_id;const r=await ctx.client.rpc('ludus_caravan_defense_v230',{p_action:'state'});if(r.error)throw r.error;if(r.data?.user_id!==owner||r.data.version!==230)throw Error('Savunma bilgisi doğrulanamadı.');state=r.data;offset=Date.parse(state.server_now)-Date.now();ctx.onChange?.(active());}catch{ctx.onUnavailable?.();}finally{busy=false;}}
  function render(container){
   const rows=active();if(!rows.length)return false;page=Math.min(page,Math.ceil(rows.length/2)-1);
   const list=el('div','worker-defenses');
   for(const d of rows.slice(page*2,page*2+2)){
    const ally=d.owner_id!==owner,otherDefender=d.status==='fighting'&&(d.defender_id||d.owner_id)!==owner;
    const card=el('article','worker-defense'),main=el('div','worker-defense-main'),choices=ally?state.gladiators.filter(g=>g.ready):(d.escort_team?.length?d.escort_team:state.gladiators.filter(g=>g.ready));
    main.append(el('strong','',ally?(d.owner_ludus||'Klan arkadaşı')+' kervanı saldırı altında':'Kervan saldırı altında'),el('small','',d.workers.map(w=>w.name).join(' · ')),el('small','',d.encounter.guards+' haydut · Kurtarma süresi: '+Math.max(1,Math.ceil((Date.parse(d.deadline)-Date.now()-offset)/60000))+' dk'));
    const controls=el('div','worker-defense-controls'),select=el('select');select.setAttribute('aria-label','Savunmaya katılacak gladyatör');
    for(const g of choices){const option=el('option','',g.name+' · '+(g.class||''));option.value=g.id;select.append(option);}
    const button=el('button','workers-save',otherDefender?'Başka bir Ludus savunuyor':d.status==='fighting'?'Savunmaya devam et':'Savunmaya katıl');button.type='button';button.disabled=entering||otherDefender||(d.status!=='fighting'&&!choices.length);
    const error=el('small','worker-defense-error');error.setAttribute('role','status');
    button.onclick=async()=>{if(entering)return;entering=true;button.disabled=true;error.textContent='';try{const r=await ctx.client.rpc('ludus_caravan_defense_v230',{p_action:'enter',p_id:d.id,p_gladiator:select.value||null});if(r.error)throw r.error;if(r.data?.user_id!==owner||r.data.result?.id!==d.id)throw Error('Savunma doğrulanamadı.');if(r.data.result.status==='resolved'){await refresh();return;}root.location.href='caravan-field.html?defense='+encodeURIComponent(d.id)+'&mode=defense&v=revision231';}catch(e){error.textContent=e.message||'Bağlantını kontrol edip tekrar dene.';}finally{entering=false;button.disabled=false;}};
    if(d.status!=='fighting'&&choices.length)controls.append(select);if(d.status!=='fighting'&&!choices.length)controls.append(el('small','','Savunmaya katılmak için hazır gladyatör gerekli.'));
    controls.append(button,error);card.append(main,controls);list.append(card);
   }
   container.append(list,el('p','worker-defense-note','Zaferde yükün tamamı korunur. Yenilgide yükün yarısı kaybolur; işçiler geri döner. Katılmazsan yaylı işçiler ve refakatçiler otomatik savunur.'));
   if(rows.length>2){const nav=el('div','workers-pager');for(const [label,delta]of [['‹',-1],['›',1]]){const b=el('button','workers-page-button',label);b.type='button';b.setAttribute('aria-label',delta<0?'Önceki saldırılar':'Sonraki saldırılar');b.disabled=delta<0?page===0:(page+1)*2>=rows.length;b.onclick=()=>{page+=delta;container.replaceChildren();render(container);};nav.append(b);}nav.insertBefore(el('span','',(page+1)+' / '+Math.ceil(rows.length/2)),nav.lastChild);container.append(nav);}
   return true;
  }
  const timer=root.setInterval(()=>{if(Date.now()-last>=15000)refresh();},1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});root.addEventListener('ludus-supply-change',refresh);
  refresh();return{active,render,refresh,get history(){return state.encounters.filter(d=>d.status==='resolved');},get clan(){return state.clan||null;},destroy:()=>root.clearInterval(timer)};
 }
 root.LudusCaravanDefenseV230={create};
})(globalThis);
