
// A single validated download per asset; the same persistent cache is used on all three pages.
var ARENA_ASSET_BASE='https://pub-6910705f63a54355a6ec8cb2acbc2223.r2.dev/';
var ArenaAssets=(function(){
 const pending=new Map();
 function valid(data){if(data.byteLength<12)return false;const h=new DataView(data);return h.getUint32(0,true)===0x46546c67&&h.getUint32(4,true)===2&&h.getUint32(8,true)===data.byteLength;}
 function load(name,status=()=>{},label='Model'){
  const local=new URL(name,document.baseURI),key=new URL(local);key.searchParams.set('asset-version','models-2026-09-29');
  if(pending.has(key.href)){const job=pending.get(key.href);job.listeners.add(text=>status(label+text));return job.promise;}
  const job={listeners:new Set([text=>status(label+text)])};pending.set(key.href,job);
  const emit=text=>{for(const listener of job.listeners)try{listener(text);}catch{}};
  job.promise=(async()=>{
   let cache;try{cache=await caches.open('ludus-models-v1');const response=await cache.match(key.href);if(response){const bytes=await response.arrayBuffer();if(valid(bytes)){emit(' hazırlanıyor…');return bytes;}await cache.delete(key.href);}}catch{}
   emit(' yükleniyor…');
   const bytes=await new Promise((resolve,reject)=>{
    let settled=false,started=0,failed=0,fallback=false;const errors=[],controllers=[],timers=new Set();
    function timer(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;}
    function clear(id){clearTimeout(id);timers.delete(id);}
    function finish(error,data){if(settled)return;settled=true;timers.forEach(clearTimeout);controllers.forEach(c=>c.abort());error?reject(error):resolve(data);}
    function backup(){if(fallback||settled)return;fallback=true;run(new URL(name,ARENA_ASSET_BASE),1);}
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
      if(!valid(data))throw Error('Eksik veya geçersiz GLB');finish(null,data);
     }catch(e){if(settled)return;errors[index]=(index?'R2':'GitHub')+': '+(e.name==='AbortError'?'zaman aşımı':e.message);failed++;if(index===0)backup();if(failed===started&&fallback)finish(Error(errors.filter(Boolean).join(' / ')));}
     finally{clear(deadline);clear(stall);}
    }
    run(local,0);
   });
   if(cache)try{await cache.put(key.href,new Response(bytes,{headers:{'Content-Type':'model/gltf-binary'}}));}catch{}
   emit(' hazırlanıyor…');return bytes;
  })().finally(()=>pending.delete(key.href));return job.promise;
 }
 function prefetch(names){return Promise.allSettled(names.map(name=>load(name)));}
 let warmed=false;
 function warmArena(){if(!/\/savas\.html$/.test(new URL(document.baseURI).pathname)||warmed)return;warmed=true;const warm=()=>{prefetch(['Colosseum.glb']);};if(typeof requestIdleCallback==='function')requestIdleCallback(warm,{timeout:1500});else setTimeout(warm,500);}
 return {load,prefetch,warmArena,valid};
})();
function ArenaAssetLoad(name,status,label){return ArenaAssets.load(name,status,label);}
// Release inactive pages' GPU contexts instead of leaving them in Safari's back/forward cache.
function ArenaCreateRenderer(options){
 let renderer;
 try{renderer=new THREE.WebGLRenderer(options);}catch(first){renderer=new THREE.WebGLRenderer({...options,powerPreference:'default'});}
 let released=false;
 addEventListener('pagehide',()=>{released=true;renderer.setAnimationLoop?.(null);renderer.dispose();renderer.forceContextLoss?.();},{once:true});
 addEventListener('pageshow',event=>{if(event.persisted&&released)location.reload();});
 return renderer;
}



/*
The MIT License

Copyright © 2010-2023 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
