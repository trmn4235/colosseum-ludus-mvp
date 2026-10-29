/* V201: named destinations; no rankings queries or heavy assets on the 3D pages. */
(()=>{
 function mount(){
  if(document.getElementById('imperialRankings'))return;
  const file=location.pathname.split('/').pop();
  const host=file==='ludus.html'?document.body:file==='roma.html'?document.querySelector('.rome-map-panel'):file==='klan.html'?document.querySelector('#clanStage .sideBottom'):null;
  if(!host)return;
  const b=document.createElement('a');b.id='imperialRankings';b.className='rank-entry';b.href='siralamalar.html?v=revision201&from='+encodeURIComponent(file);b.setAttribute('aria-label','İmparatorluk Sıralaması');
  const crest='<svg class="rank-entry-crest" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 34C5 31 4 17 11 8M23 34c12-3 13-17 6-26M9 14l-4-2 1 6 3 2m-1 2-4-1 3 6 3 1m2 2-3 1 5 4 3-1m14-20 4-2-1 6-3 2m1 2 4-1-3 6-3 1m-2 2 3 1-5 4-3-1"/><path d="M15 10h10v5c0 4-2 6-5 6s-5-2-5-6ZM15 12h-3v3c0 2 1 3 4 3m9-6h3v3c0 2-1 3-4 3M20 21v6m-4 1h8"/></svg>';
  if(file==='roma.html'){
   const overview=document.createElement('div');overview.className='rome-city-overview';host.before(overview);overview.append(host,b);
   b.classList.add('rank-entry--rome');b.innerHTML=crest+'<span class="rank-entry-copy"><small>İMPARATORLUK</small><strong>Sıralamalar</strong></span><span class="rank-entry-detail">Oyuncular · Hanedanlar</span><span class="rank-entry-arrow" aria-hidden="true">›</span>';
  }else if(file==='ludus.html'){
   const nav=document.createElement('nav');nav.id='ludusWorldNav';nav.setAttribute('aria-label','Roma ve sıralamalar');
   const map=document.createElement('a');map.href='roma.html?v=revision201';map.setAttribute('aria-label','Roma haritasını aç');map.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15"/></svg><span>Harita</span>';
   b.innerHTML=crest+'<span>Sıralamalar</span>';nav.append(map,b);host.append(nav);
  }else{
   b.classList.add('rank-entry--clan');b.innerHTML=crest+'<span>Sıralamalar</span><span class="rank-entry-arrow" aria-hidden="true">›</span>';host.classList.add('rank-entry-slot');host.replaceChildren(b);
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
