const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {webcrypto,createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),pages=['arena.html','savas.html','multiplayer.html','ludus.html','caravan-assets-v126.js'],isolated='model-delivery-v222.js',loaders=[...pages,isolated];
const name='gladiator-mobile-v217.glb',bytes=fs.readFileSync(path.join(root,name));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function loader(file,fetch,cache,{stallDelay=6000}={}){
 const source=read(file),start=source.indexOf('var ARENA_ASSET_BASE='),end=source.indexOf('function ArenaAssetLoad',start);
 const timers=new Set(),context=vm.createContext({URL,URLSearchParams,ArrayBuffer,DataView,Uint8Array,Response,AbortController,crypto:webcrypto,fetch,
  document:{baseURI:'https://game.example/'+(file.endsWith('.html')?file:file===isolated?'circus-maximus.html':'caravan-field.html')},location:{search:''},
  caches:{open:async()=>cache||{match:async()=>null,put:async()=>{},delete:async()=>{}}},
  setTimeout(fn,ms){const id=setTimeout(()=>{timers.delete(id);fn();},ms===6000?stallDelay:ms);timers.add(id);return id;},
  clearTimeout(id){clearTimeout(id);timers.delete(id);}});
 vm.runInContext(file===isolated?source:source.slice(start,end),context);
 const assets=file===isolated?context.LudusModelDelivery:context.ArenaAssets;
 return {context,assets,mirrors:file===isolated?assets.models:context.ARENA_MODEL_MIRRORS,close(){timers.forEach(clearTimeout);}};
}
const response=()=>new Response(bytes);
const stalled=signal=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));
function memoryCache(){const entries=new Map();return {match:async key=>entries.get(key)?.clone(),put:async(key,value)=>{entries.set(key,value.clone());},delete:async key=>entries.delete(key)};}
// Run the real Circus consumer through its parse boundary; no renderer or race
// is needed to verify which bytes are handed to GLTFLoader after a network fault.
async function circusModel(l){
 l.context.CircusRace={trackCamera(){}};vm.runInContext(read('circus-war-view-v186.js'),l.context);
 const parsed=Error('model reached parser');let data;
 const T={GLTFLoader:class{async parseAsync(buffer){data=buffer;throw parsed;}}};
 await assert.rejects(l.context.CircusWarView.create(T,{},{}),error=>error===parsed);
 return data;
}

test('every active model has the same immutable mirror and exact shipped hash in every loader',()=>{
 let expected;
 for(const file of loaders){const l=loader(file,()=>{}),mirrors=JSON.parse(JSON.stringify(l.mirrors));
  if(expected)assert.deepEqual(mirrors,expected,file);expected=mirrors;
  for(const [asset,m]of Object.entries(mirrors)){
   const data=fs.readFileSync(path.join(root,asset));assert.equal(m.bytes,data.length);assert.equal(m.sha256,createHash('sha256').update(data).digest('hex'));
   assert.match(m.url,new RegExp('^https://raw\\.githubusercontent\\.com/trmn4235/colosseum-ludus-mvp/[a-f0-9]{40}/'+asset.replaceAll('.','\\.')+'$'));
  }l.close();
 }
 for(const file of [...pages,'caravan-rig-v126.js','circus-war-view-v186.js']){
  const calls=[...read(file).matchAll(/(?:ArenaAssetLoad|LudusModelDelivery\.load)\('(gladiator-mobile[^']*\.glb)'/g)];
  if(file!=='caravan-assets-v126.js')assert.ok(calls.length,file+': use the verified model loader');
  for(const match of calls)assert.ok(expected[match[1]],file+': register and verify the new model mirror');
 }
 for(const file of ['caravan-battle-v126.js','pit-visit-v172.js'])assert.match(read(file),/file==='caravan-assets-v126\.js'\?'revision222'/,file);
 const caravanRevision=read('caravan-field.html').match(/caravan-battle-v126\.js\?v=revision(\d+)/)?.[1];
 assert.ok(Number(caravanRevision)>=222,'Caravan cache version must include the verified model loader');
 const pitRevision=read('san-avlusu.html').match(/pit-visit-v172\.js\?v=revision(\d+)/)?.[1];
 assert.ok(Number(pitRevision)>=222,'Aventinus cache version must include the verified model loader');
 assert.match(read('index.html'),/ludus\.html\?v=revision222/);
 const circus=read('circus-maximus.html'),helper=circus.indexOf('model-delivery-v222.js?v=revision222'),view=circus.indexOf('circus-war-view-v186.js?v=revision222');
 assert.ok(helper>=0&&view>helper,'Circus loads the verified downloader before its active crew view');
});

for(const file of loaders)test(file+': failed primary loads the exact current model from its pinned mirror',async t=>{
 const calls=[],l=loader(file,async url=>{calls.push(String(url));return calls.length===1?new Response('',{status:503}):response();});t.after(l.close);
 const result=await l.assets.load(name);
 assert.deepEqual(Buffer.from(result),bytes);assert.equal(calls.length,2);assert.equal(calls[1],l.mirrors[name].url);
 assert.ok(calls.every(url=>!url.includes('.r2.dev/')),'never send the current model to the missing R2 path');
});

test('Circus crew uses the exact mirror after a failed primary without changing the owner loader',async t=>{
 const calls=[],l=loader(isolated,async url=>{calls.push(String(url));return calls.length===1?new Response('',{status:503}):response();});t.after(l.close);
 assert.equal(typeof l.context.ArenaAssetLoad,'undefined');assert.equal(typeof l.context.ArenaAssets,'undefined');assert.equal(typeof l.context.ARENA_ASSET_BASE,'undefined');
 assert.deepEqual(Buffer.from(await circusModel(l)),bytes);assert.equal(calls.length,2);assert.equal(calls[1],l.mirrors[name].url);
 // LudusOwner keeps its original THREE loader because no ArenaAssetLoad global
 // is installed by the Circus-specific download namespace.
 let ownerLoads=0;const ownerError=Error('owner original loader');
 l.context.THREE={GLTFLoader:class{load(url,resolve,progress,reject){ownerLoads++;reject(ownerError);}}};
 l.context.Image=class{set src(value){queueMicrotask(()=>this.onload());}};
 vm.runInContext(read('owner-avatar.js'),l.context);
 await assert.rejects(l.context.LudusOwner.load(),error=>error===ownerError);assert.equal(ownerLoads,1);assert.equal(calls.length,2);
});

test('Circus rejects wrong cached and primary bytes before passing the mirror to its parser',async t=>{
 const wrong=Buffer.from(bytes);wrong[wrong.length-1]^=1;let calls=0,deletes=0;
 const cache={match:async()=>new Response(wrong),delete:async()=>{deletes++;},put:async()=>{}};
 const l=loader(isolated,async()=>++calls===1?new Response(wrong):response(),cache);t.after(l.close);
 assert.deepEqual(Buffer.from(await circusModel(l)),bytes);assert.equal(deletes,1);assert.equal(calls,2);
});

test('Circus reuses the verified model cached by another scene with no second download',async t=>{
 const cache=memoryCache();let calls=0;
 const arena=loader('arena.html',async()=>{calls++;return response();},cache);t.after(arena.close);await arena.assets.load(name);
 const circus=loader(isolated,async()=>{throw Error('network must not be needed');},cache);t.after(circus.close);
 assert.deepEqual(Buffer.from(await circusModel(circus)),bytes);assert.equal(calls,1);
});

test('healthy primary deduplicates downloads and is reused through the cross-page cache',async t=>{
 let calls=0;const entries=new Map(),cache={match:async key=>entries.get(key)?.clone(),put:async(key,value)=>{entries.set(key,value.clone());},delete:async key=>entries.delete(key)};
 const l=loader('arena.html',async()=>{calls++;return response();},cache);t.after(l.close);
 const [a,b]=await Promise.all([l.assets.load(name),l.assets.load(name)]);assert.equal(a,b);assert.equal(calls,1);
 const next=loader('ludus.html',async()=>{throw Error('must use verified cache');},cache);t.after(next.close);
 assert.deepEqual(Buffer.from(await next.assets.load(name)),bytes);
});

test('corrupt cached model and structurally valid wrong primary cannot replace the expected version',async t=>{
 const wrong=Buffer.from(bytes);wrong[wrong.length-1]^=1;let calls=0,deletes=0;
 const cache={match:async()=>new Response(wrong),delete:async()=>{deletes++;},put:async()=>{}};
 const l=loader('arena.html',async()=>++calls===1?new Response(wrong):response(),cache);t.after(l.close);
 assert.deepEqual(Buffer.from(await l.assets.load(name)),bytes);assert.equal(deletes,1);assert.equal(calls,2);
});

test('stalled primary starts the mirror and aborts the losing request',async t=>{
 const signals=[],l=loader('arena.html',async(url,{signal})=>{signals.push(signal);return signals.length===1?stalled(signal):response();},null,{stallDelay:50});t.after(l.close);
 assert.deepEqual(Buffer.from(await l.assets.load(name)),bytes);assert.equal(signals.length,2);assert.ok(signals[0].aborted);
});

test('failed mirror does not cancel a primary download that can still complete',async t=>{
 let release,calls=0;const primary=new Promise(resolve=>{release=resolve;});
 const l=loader('arena.html',async()=>{if(++calls===1)return primary;setTimeout(()=>release(response()),10);return new Response('',{status:404});},null,{stallDelay:50});t.after(l.close);
 assert.deepEqual(Buffer.from(await l.assets.load(name)),bytes);assert.equal(calls,2);
});

test('both sources failing rejects clearly, drops the pending request, and permits retry',async t=>{
 let calls=0,healthy=false;const l=loader('arena.html',async()=>{calls++;return healthy?response():new Response('',{status:404});});t.after(l.close);
 await assert.rejects(l.assets.load(name),/GitHub Pages: HTTP 404 \/ GitHub Raw: HTTP 404/);assert.equal(calls,2);
 healthy=true;assert.deepEqual(Buffer.from(await l.assets.load(name)),bytes);assert.equal(calls,3);
});

test('legacy scenery keeps its existing R2 fallback',async t=>{
 const calls=[],l=loader('arena.html',async url=>{calls.push(String(url));return calls.length===1?new Response('',{status:503}):response();});t.after(l.close);
 await l.assets.load('Colosseum.glb');assert.equal(calls[1],'https://pub-6910705f63a54355a6ec8cb2acbc2223.r2.dev/Colosseum.glb');
});
