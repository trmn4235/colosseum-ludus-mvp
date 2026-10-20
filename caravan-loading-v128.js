/* Progress advances only when a real preparation stage completes. */
window.CaravanLoading=(()=>{
 const raid=new URLSearchParams(location.search).has('raid');
 const weights=raid?{forest:65,scripts:10,account:5,actors:12,driver:3,ready:5}:{forest:95,ready:5};
 const values={},box=document.getElementById('loading'),bar=document.getElementById('loadProgress'),detail=document.getElementById('loadDetail'),percent=document.getElementById('loadPercent');
 let failed=false;
 if(!raid)box.querySelector('strong').textContent=new URLSearchParams(location.search).get('mode')==='defense'?'Kervan Savunması':'Orman Geçidi';
 function set(stage,value,label){
  if(failed)return;values[stage]=Math.max(values[stage]||0,Math.min(1,value));
  const progress=Math.floor(Object.entries(weights).reduce((n,[key,w])=>n+w*(values[key]||0),0));
  bar.value=progress;percent.textContent=progress+'%';if(label)detail.textContent=label;
 }
 function hide(){box.hidden=true;}
 function finish(){for(const key of Object.keys(weights))values[key]=1;set('ready',1,'Hazır');hide();}
 function fail(message){failed=true;box.hidden=false;box.classList.add('load-failed');box.querySelector('strong').textContent='Alan açılamadı';detail.textContent=message;document.getElementById('retry').hidden=false;document.getElementById('loadBack').hidden=false;}
 set('forest',0,'Orman yolu hazırlanıyor…');
 return{set,finish,hide,fail};
})();
