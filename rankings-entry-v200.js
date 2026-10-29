/* Small navigation entry; no rankings queries or heavy assets on the 3D pages. */
(()=>{
 function mount(){
  if(document.getElementById('imperialRankings'))return;
  const file=location.pathname.split('/').pop();
  const host=file==='ludus.html'?document.querySelector('.ludus-menu .tools'):file==='roma.html'?document.querySelector('.rome-header'):file==='klan.html'?document.querySelector('#clanStage .topWallet'):null;
  if(!host)return;
  const b=document.createElement('button');b.id='imperialRankings';b.type='button';b.title='İmparatorluk Sıralaması';b.setAttribute('aria-label','İmparatorluk Sıralaması');
  b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10v5c0 4-3 6-5 6s-5-2-5-6ZM7 5H3v3c0 3 2 4 5 4m9-7h4v3c0 3-2 4-5 4M12 14v5m-4 2h8M9 19h6"/></svg>';
  b.onclick=()=>{location.href='siralamalar.html?v=revision200&from='+encodeURIComponent(file);};
  if(file==='ludus.html')host.prepend(b);else host.append(b);
  const style=document.createElement('style');style.textContent='#imperialRankings{display:grid;place-items:center;flex-shrink:0;cursor:pointer}#imperialRankings svg{width:22px;height:22px}body:not([data-roman-screen="ludus"]) #imperialRankings{background:transparent;border:1px solid #b89957;border-radius:4px;color:inherit;width:34px;height:34px;padding:4px}.rome-header #imperialRankings{color:#651c2b}#clanStage #imperialRankings{width:40px;height:40px;margin-left:8px}';document.head.append(style);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
