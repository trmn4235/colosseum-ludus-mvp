(function (root) {
 'use strict';

 // The existing ranking service computes the strongest fighter and equipped gear.
 // Clan totals are sums of these published Ludus scores, not invented battle stats.
 function create(client) {
  let target=null, selected=null, clanPage=0, memberPage=0, data=null, loading=false, error='';
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const score=value=>value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:Number(value);
  const fmt=value=>value===null?'—':Number(value).toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:2});

  function aggregate(clans, players) {
   const map=new Map(clans.map(c=>[c.id,{id:c.id,name:c.name,members:[],total:0,known:0}]));
   for(const p of players){
    const c=map.get(p.clan_id);if(!c)continue;
    const power=score(p.stats?.power);
    c.members.push({...p,power});
    if(power!==null){c.total+=power;c.known++;}
   }
   for(const c of map.values()){
    c.total=c.known?Math.round(c.total*100)/100:null;
    c.members.sort((a,b)=>(b.power??-Infinity)-(a.power??-Infinity)||String(a.subtitle).localeCompare(String(b.subtitle),'tr'));
   }
   return [...map.values()].sort((a,b)=>(b.total??-Infinity)-(a.total??-Infinity)||String(a.name).localeCompare(String(b.name),'tr'));
  }

  async function fetchAll() {
   const players=[];let clans=[],page=0,total=Infinity;
   while(players.length<total){
    const result=await client.rpc('ludus_rankings_v203',{p_scope:'players',p_category:'power',p_group:'all',p_page:page,p_page_size:20});
    if(result.error)throw Error(result.error.message||'Güç bilgileri alınamadı.');
    const value=result.data;
    if(!value||!Array.isArray(value.rows)||!Array.isArray(value.clans)||!Number.isInteger(value.total)||value.total<0||value.page!==page)
     throw Error('Güç bilgileri doğrulanamadı.');
    if(page===0){clans=value.clans;total=value.total;}
    if(!value.rows.length&&players.length<total)throw Error('Güç listesi tamamlanamadı.');
    players.push(...value.rows);page++;
   }
   return aggregate(clans,players);
  }

  async function refresh() {
   if(loading)return;loading=true;error='';draw();
   try{data=await fetchAll();if(!data.some(c=>c.id===selected))selected=data[0]?.id||null;}
   catch(e){error=e.message||'Güç bilgileri alınamadı.';}
   finally{loading=false;draw();}
  }

  function pager(kind,page,count,size){
   if(count<=size)return '';
   return '<div class="powerPager"><button type="button" data-power-page="'+kind+'" data-delta="-1" '+(!page?'disabled':'')+' aria-label="Önceki sayfa">‹</button><span>'+(page+1)+' / '+Math.ceil(count/size)+'</span><button type="button" data-power-page="'+kind+'" data-delta="1" '+((page+1)*size>=count?'disabled':'')+' aria-label="Sonraki sayfa">›</button></div>';
  }

  function draw(){
   if(!target||!target.isConnected)return;
   if(!data){target.innerHTML='<section class="panel powerLoading">'+esc(error||(loading?'Klan güçleri yükleniyor…':'Klan güçleri hazırlanıyor…'))+(error?'<button type="button" class="button compact" data-power-refresh>Tekrar dene</button>':'')+'</section>';wire();return;}
   clanPage=Math.max(0,Math.min(clanPage,Math.max(0,Math.ceil(data.length/5)-1)));
   const clan=data.find(c=>c.id===selected)||null,members=clan?.members||[];
   memberPage=Math.max(0,Math.min(memberPage,Math.max(0,Math.ceil(members.length/5)-1)));
   const clanRows=data.slice(clanPage*5,clanPage*5+5).map((c,i)=>'<button type="button" class="powerRow powerClan '+(c.id===selected?'selected':'')+'" data-power-clan="'+esc(c.id)+'"><span class="powerRank">'+(clanPage*5+i+1)+'</span><span class="powerIdentity"><strong>'+esc(c.name)+'</strong><small>'+c.members.length+' Ludus'+(c.known<c.members.length?' · '+(c.members.length-c.known)+' hesaplanamadı':'')+'</small></span><b>'+fmt(c.total)+'</b></button>').join('');
   const memberRows=members.slice(memberPage*5,memberPage*5+5).map(p=>'<div class="powerRow"><span class="powerIdentity"><strong>'+esc(p.subtitle||p.name)+'</strong><small>'+esc(p.gladiator?.name||'Gladyatör bilgisi yok')+' · @'+esc(p.name)+'</small></span><span class="powerNumbers"><b>'+fmt(p.power)+'</b><small>'+esc(p.power===null?'Hesaplanamadı':'Güç puanı')+'</small></span></div>').join('');
   target.innerHTML='<section class="panel powerPanel"><div class="powerHeading"><h2>Klan sıralaması</h2><button type="button" class="button secondary compact" data-power-refresh '+(loading?'disabled':'')+'>Yenile</button></div><div class="powerRows">'+(clanRows||'<p class="small">Henüz klan yok.</p>')+'</div>'+pager('clan',clanPage,data.length,5)+'</section><section class="panel powerPanel"><div class="powerHeading"><h2>'+esc(clan?.name||'Klan seç')+'</h2><span class="powerTotal">'+fmt(clan?.total??null)+' puan</span></div><div class="powerRows">'+(memberRows||'<p class="small">Bu klanda kayıtlı Ludus yok.</p>')+'</div>'+pager('member',memberPage,members.length,5)+'<p class="powerNote">Ludus gücü: en güçlü gladyatörün özellikleri ve kuşandığı ekipman. Klan gücü, hesaplanabilen Ludus puanlarının toplamıdır.</p>'+(error?'<p class="powerError">'+esc(error)+'</p>':'')+'</section>';
   wire();
  }
  function wire(){
   target.querySelector('[data-power-refresh]')?.addEventListener('click',refresh);
   target.querySelectorAll('[data-power-clan]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.powerClan;memberPage=0;draw();}));
   target.querySelectorAll('[data-power-page]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.powerPage==='clan')clanPage+=Number(button.dataset.delta);else memberPage+=Number(button.dataset.delta);draw();}));
  }
  return {mount(element,preferredClan){target=element;if(!selected)selected=preferredClan;draw();if(!data&&!loading)refresh();},refresh,aggregate};
 }
 root.LudusClanPowerV231={create};
})(globalThis);
