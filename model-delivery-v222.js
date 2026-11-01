/* V222: verified model delivery for scenes without the arena runtime.
 * Keep globals isolated: importing this must not change LudusOwner's loader.
 * The five embedded arena loaders retain their existing standalone contract.
 */
var LudusModelDelivery=(function(){
var ARENA_ASSET_BASE='https://pub-6910705f63a54355a6ec8cb2acbc2223.r2.dev/';
// Versioned models use an immutable, verified mirror; legacy scenery keeps its R2 source.
var ARENA_MODEL_MIRRORS=Object.freeze({"gladiator-mobile-v217.glb":{"url":"https://raw.githubusercontent.com/trmn4235/colosseum-ludus-mvp/4ee4be451aada7ecda4414962423da542ce5f904/gladiator-mobile-v217.glb","bytes":5912072,"sha256":"dae87e6a1d059f8e2e6beafc58184d495631aad7c280eb41536e8b67b14713ab"}});
var ArenaAssets=(function(){
 const pending=new Map();
 function valid(data){if(data.byteLength<12)return false;const h=new DataView(data);return h.getUint32(0,true)===0x46546c67&&h.getUint32(4,true)===2&&h.getUint32(8,true)===data.byteLength;}
 async function matches(data,name){
  if(!valid(data))return false;const mirror=ARENA_MODEL_MIRRORS[name];if(!mirror)return true;
  if(data.byteLength!==mirror.bytes)return false;
  const digest=await crypto.subtle.digest('SHA-256',data);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')===mirror.sha256;
 }
 function load(name,status=()=>{},label='Model'){
  const local=new URL(name,document.baseURI),key=new URL(local);key.searchParams.set('asset-version','models-2026-09-29');
  if(pending.has(key.href)){const job=pending.get(key.href);job.listeners.add(text=>status(label+text));return job.promise;}
  const job={listeners:new Set([text=>status(label+text)])};pending.set(key.href,job);
  const emit=text=>{for(const listener of job.listeners)try{listener(text);}catch{}};
  job.promise=(async()=>{
   let cache,timer;const cached=await Promise.race([(async()=>{try{cache=await caches.open('ludus-models-v1');const response=await cache.match(key.href);if(response){const bytes=await response.arrayBuffer();if(await matches(bytes,name))return bytes;cache.delete(key.href).catch(()=>{});}}catch{}return null;})(),new Promise(resolve=>{timer=setTimeout(()=>resolve(null),1200);})]);clearTimeout(timer);if(cached){emit(' hazırlanıyor…');return cached;}
   emit(' yükleniyor…');
   const bytes=await new Promise((resolve,reject)=>{
    let settled=false,started=0,failed=0,fallback=false;const errors=[],controllers=[],timers=new Set();
    function timer(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;}
    function clear(id){clearTimeout(id);timers.delete(id);}
    function finish(error,data){if(settled)return;settled=true;timers.forEach(clearTimeout);controllers.forEach(c=>c.abort());error?reject(error):resolve(data);}
    const mirror=ARENA_MODEL_MIRRORS[name],backupURL=mirror?mirror.url:new URL(name,ARENA_ASSET_BASE),backupLabel=mirror?'GitHub Raw':'R2';
    function backup(){if(fallback||settled)return;fallback=true;run(backupURL,1);}
    async function run(url,index){
     started++;const controller=new AbortController();controllers.push(controller);const deadline=timer(()=>controller.abort(),90000);
     let stall=index===0?timer(backup,6000):null;
     try{
      const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);
      let data;
      if(response.body?.getReader){
       const reader=response.body.getReader(),parts=[];let size=0;const total=Number(response.headers.get('content-length'));
       while(true){const {done,value}=await reader.read();if(done)break;parts.push(value);size+=value.byteLength;
        if(index===0){clear(stall);stall=timer(backup,6000);}if(!settled)emit((index?' alternatif kaynaktan yükleniyor…':' yükleniyor…')+(total>0?' '+Math.min(100,Math.round(size/total*100))+'%':''));
       }
       const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.byteLength;}data=result.buffer;
      }else data=await response.arrayBuffer();
      if(!await matches(data,name))throw Error('Eksik veya beklenen sürümle uyuşmayan GLB');finish(null,data);
     }catch(e){if(settled)return;errors[index]=(index?backupLabel:'GitHub Pages')+': '+(e.name==='AbortError'?'zaman aşımı':e.message);failed++;if(index===0)backup();if(failed===started&&fallback)finish(Error(errors.filter(Boolean).join(' / ')));}
     finally{clear(deadline);clear(stall);}
    }
    run(local,0);
   });
   if(cache)try{cache.put(key.href,new Response(bytes,{headers:{'Content-Type':'model/gltf-binary'}})).catch(()=>{});}catch{}
   emit(' hazırlanıyor…');return bytes;
  })().finally(()=>pending.delete(key.href));return job.promise;
 }
 function prefetch(names){return Promise.allSettled(names.map(name=>load(name)));}
 let warmed=false;
 function warmArena(){if(!/\/savas\.html$/.test(new URL(document.baseURI).pathname)||warmed)return;warmed=true;const warm=()=>{prefetch(['Colosseum.glb']);};if(typeof requestIdleCallback==='function')requestIdleCallback(warm,{timeout:1500});else setTimeout(warm,500);}
 return {load,prefetch,warmArena,valid};
})();
 return Object.freeze({load:ArenaAssets.load,models:ARENA_MODEL_MIRRORS});
})();
