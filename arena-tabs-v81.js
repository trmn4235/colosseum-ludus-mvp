(()=>{
 const tabs=[...document.querySelectorAll('[data-arena-tab]')],panels=[...document.querySelectorAll('[data-arena-panel]')];
 function select(name){for(const b of tabs){const active=b.dataset.arenaTab===name;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}for(const p of panels)p.hidden=p.dataset.arenaPanel!==name;document.querySelector('#modePage h1').textContent=name==='clan'?'KLAN SAVAŞLARI':'SAVAŞINI SEÇ';document.querySelector('#modePage .heading p').textContent=name==='clan'?'KUMDA VE SUDA · KLANINLA ZAFERE':'ARENADA TEK HEDEF: AYAKTA KALMAK.';}
 tabs.forEach((b,i)=>{b.onclick=()=>select(b.dataset.arenaTab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const j=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;select(tabs[j].dataset.arenaTab);tabs[j].focus();};});select('single');
})();
