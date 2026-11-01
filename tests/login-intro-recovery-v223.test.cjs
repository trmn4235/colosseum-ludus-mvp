// Exercise the real intro script without network, browser timing, or credentials.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(process.env.LOGIN_INTRO_TEST_SOURCE||path.join(__dirname,'../login-intro-v40.js'),'utf8');

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
function target(properties={}){
 const events=new Map();
 return Object.assign({
  addEventListener(type,fn,options={}){if(!events.has(type))events.set(type,new Map());events.get(type).set(fn,options);},
  removeEventListener(type,fn){events.get(type)?.delete(fn);},
  dispatch(type,details={}){for(const[fn,options]of [...(events.get(type)||[])]){if(options.once)events.get(type).delete(fn);fn({target:this,type,...details});}},
  listenerCount(){return [...events.values()].reduce((sum,list)=>sum+list.size,0);}
 },properties);
}
function fixture({complete=false,width=1536,decode=()=>Promise.resolve(),landscape=true,hidden=false,reduced=false}={}){
 let now=0,sequence=0;const timers=new Map(),frames=[];
 const artwork=target({complete,naturalWidth:width,hidden:false});if(decode!==null)artwork.decode=decode;
 const panel=target({inert:true,attributes:new Set(['aria-hidden']),removeAttribute(name){this.attributes.delete(name);}});
 const fallback={hidden:true},orientation=target({matches:landscape}),motion={matches:reduced};
 const document=target({hidden,body:{dataset:{introState:'loading'}},getElementById:id=>({loginArtwork:artwork,entryPanel:panel,artworkFallback:fallback})[id]});
 const window=target();
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 vm.runInNewContext(source,{document,window,Promise,Error,matchMedia:query=>query.includes('orientation')?orientation:motion,
  performance:{now:()=>now},requestAnimationFrame:fn=>frames.push(fn),
  setTimeout(fn,ms){const id=++sequence;timers.set(id,{at:now+ms,fn});return id;},clearTimeout:id=>timers.delete(id)
 },{filename:'login-intro-v40.js'});
 async function advance(ms){
  const end=now+ms;await flush();
  while(true){const next=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}
  now=end;await flush();
 }
 async function paint(){await flush();for(let i=0;i<2;i++){const pending=frames.splice(0);pending.forEach(fn=>fn(now));await flush();}}
 return{artwork,panel,fallback,document,window,orientation,advance,paint,flush,
  get state(){return document.body.dataset.introState;},get timers(){return timers.size;},get frames(){return frames.length;}};
}
function ready(f){assert.equal(f.state,'ready');assert.equal(f.panel.inert,false);assert.equal(f.panel.attributes.has('aria-hidden'),false);assert.equal(f.timers,0);assert.equal(f.artwork.listenerCount(),0);assert.equal(f.frames,0);}
async function finish(f){await f.paint();await f.advance(3000);ready(f);}

test('an unfinished image request falls back at 8 seconds and releases the form',async()=>{
 const f=fixture();await f.advance(7999);assert.equal(f.state,'loading');assert.equal(f.fallback.hidden,true);
 await f.advance(1);assert.equal(f.artwork.hidden,true);assert.equal(f.fallback.hidden,false);assert.equal(f.artwork.listenerCount(),0);assert.equal(f.timers,0);
 await finish(f);
});

test('a cached image whose decode never settles has the same bounded fallback',async()=>{
 const f=fixture({complete:true,decode:()=>new Promise(()=>{})});await f.advance(8000);
 assert.equal(f.fallback.hidden,false);await finish(f);
});

test('transfer and decode share one deadline instead of two eight-second waits',async()=>{
 const f=fixture({decode:()=>new Promise(()=>{})});await f.advance(7500);f.artwork.dispatch('load');await f.advance(499);assert.equal(f.fallback.hidden,true);
 await f.advance(1);assert.equal(f.fallback.hidden,false);await finish(f);
});

test('normal load and decode preserve the two-second hold and one-second reveal',async()=>{
 const decoding=deferred(),f=fixture({decode:()=>decoding.promise});f.artwork.dispatch('load');await f.flush();assert.equal(f.state,'loading');assert.equal(f.timers,1);assert.equal(f.artwork.listenerCount(),0);
 decoding.resolve();await f.paint();assert.equal(f.state,'artwork');assert.equal(f.fallback.hidden,true);assert.equal(f.artwork.hidden,false);
 await f.advance(1999);assert.equal(f.state,'artwork');assert.equal(f.panel.inert,true);
 await f.advance(1);assert.equal(f.state,'revealing');await f.advance(999);assert.equal(f.panel.inert,true);await f.advance(1);ready(f);
});

for(const mode of ['cached good','cached missing','load error','decode rejection','decode throws','no decode API']){
 test(mode+' settles promptly without a leftover image timer or listener',async()=>{
  const good=mode==='cached good'||mode==='no decode API';
  const f=fixture({complete:mode!=='load error',width:mode==='cached missing'?0:1536,
   decode:mode==='no decode API'?null:mode==='decode rejection'?()=>Promise.reject(Error('decode failed')):mode==='decode throws'?()=>{throw Error('decode failed');}:()=>Promise.resolve()});
  if(mode==='load error')f.artwork.dispatch('error');await f.flush();
  assert.equal(f.timers,0);assert.equal(f.artwork.listenerCount(),0);assert.equal(f.fallback.hidden,good);assert.equal(f.artwork.hidden,!good);await finish(f);
 });
}

for(const late of ['load','error','decode resolution','decode rejection']){
 test('late '+late+' cannot restart the intro or hide its ready form',async()=>{
  const decoding=deferred(),f=fixture({complete:late.startsWith('decode'),decode:()=>decoding.promise});
  await f.advance(8000);await finish(f);
  if(late==='decode resolution')decoding.resolve();else if(late==='decode rejection')decoding.reject(Error('late decode'));else f.artwork.dispatch(late);
  await f.flush();await f.advance(10000);ready(f);assert.equal(f.artwork.hidden,true);assert.equal(f.fallback.hidden,false);
 });
}

test('the timeout fallback still waits for landscape before consuming its hold',async()=>{
 const f=fixture({landscape:false});await f.advance(8000);await f.paint();assert.equal(f.state,'artwork');assert.equal(f.timers,0);
 await f.advance(10000);assert.equal(f.state,'artwork');assert.equal(f.panel.inert,true);
 f.orientation.matches=true;f.orientation.dispatch('change');await f.advance(1999);assert.equal(f.state,'artwork');await f.advance(1001);ready(f);
});

test('background time does not consume the two visible seconds after fallback',async()=>{
 const f=fixture({hidden:true});await f.advance(8000);await f.paint();assert.equal(f.state,'artwork');assert.equal(f.timers,0);
 await f.advance(10000);f.document.hidden=false;f.document.dispatch('visibilitychange');await f.advance(750);
 f.document.hidden=true;f.document.dispatch('visibilitychange');assert.equal(f.timers,0);await f.advance(10000);assert.equal(f.state,'artwork');
 f.document.hidden=false;f.document.dispatch('visibilitychange');await f.advance(1249);assert.equal(f.state,'artwork');await f.advance(1001);ready(f);
});

test('portrait pauses a partially consumed hold and pageshow does not duplicate it',async()=>{
 const f=fixture({complete:true});await f.paint();await f.advance(600);f.orientation.matches=false;f.orientation.dispatch('change');
 await f.advance(5000);assert.equal(f.state,'artwork');assert.equal(f.timers,0);
 f.orientation.matches=true;f.window.dispatch('pageshow');f.orientation.dispatch('change');f.window.dispatch('pageshow');assert.equal(f.timers,1);
 await f.advance(1399);assert.equal(f.state,'artwork');await f.advance(1001);ready(f);
});

test('reduced motion keeps the hold but releases the form without a reveal delay',async()=>{
 const f=fixture({reduced:true});await f.advance(8000);await f.paint();await f.advance(1999);assert.equal(f.state,'artwork');await f.advance(1);ready(f);
});

test('the opacity transition releases controls and clears its safety timer once',async()=>{
 const f=fixture({complete:true});await f.paint();await f.advance(2000);assert.equal(f.state,'revealing');assert.equal(f.timers,1);
 f.panel.dispatch('transitionend',{propertyName:'transform'});assert.equal(f.panel.inert,true);
 f.panel.dispatch('transitionend',{propertyName:'opacity'});ready(f);f.panel.dispatch('transitionend',{propertyName:'opacity'});await f.advance(10000);ready(f);
});
