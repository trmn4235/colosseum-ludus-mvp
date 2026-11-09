const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('ranked-invites-v244.js','utf8'),flush=()=>new Promise(r=>setImmediate(r));
function harness({getUser=async()=>({data:{user:{id:'recipient'}}}),legacy=false,slow=false}={}){
 const nodes=[],calls=[],timers=new Map(),stored=new Map();let callback,serial=0,release;
 function node(tag){return{tag,hidden:false,style:{},children:[],clientWidth:360,events:{},setAttribute(){},append(...x){this.children.push(...x)},addEventListener(name,fn){this.events[name]=fn}};}
 const hud={getBoundingClientRect:()=>({top:0,height:44,bottom:44})};
 const client={auth:{getUser,...(!legacy?{onAuthStateChange(fn){callback=fn}}:{})},rpc(name,p){
  calls.push({name,p});const r=p.p_action==='pulse'?{invites:[{id:'invite-1',leader:'<img src=x onerror=bad()>',expires_at:new Date(Date.now()+180000).toISOString()}],next_in_ms:180000,server_now:new Date().toISOString()}:p.p_action==='accept'?{party:{members:[{user_id:'recipient'}]}}:{invites:[]};
  const promise=slow&&p.p_action==='pulse'?new Promise(resolve=>{release=()=>resolve({data:r})}):Promise.resolve({data:r});
  // Supabase query builders are thenables; they need not expose Promise.catch.
  return{then:promise.then.bind(promise)};
 }};
 const document={hidden:false,body:{append(x){nodes.push(x)}},createElement:node,getElementById:id=>nodes.find(n=>n.id===id),querySelector:()=>null,querySelectorAll:()=>[hud],addEventListener(){}};
 const context={document,location:{href:'',pathname:'/ludus.html'},innerHeight:390,supabase:{},LudusClient:{create:()=>client},
  sessionStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},
  ResizeObserver:class{observe(){}disconnect(){}},MutationObserver:class{observe(){}},
  setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,delay});return id},clearTimeout:id=>timers.delete(id),addEventListener(){}};
 context.globalThis=context;vm.runInNewContext(code,context);
 const zeroTimers=()=>{for(const[id,t]of [...timers])if(!t.delay){timers.delete(id);t.fn();}};
 return{nodes,calls,context,release:()=>release(),logout:()=>{callback('SIGNED_OUT',null);zeroTimers();}};
}
(async()=>{
 const h=harness();await flush();const box=h.nodes[0],row=box.children[0],text=row.children[0],button=row.children[1];
 assert.equal(box.hidden,false);assert.equal(h.calls[0].name,'ludus_ranked_invites_v254');assert.equal(h.calls[0].p.p_action,'pulse');
 assert.equal(text.textContent,'<img src=x onerror=bad()>’ten Ranked 5v5','untrusted names are plain text');assert.equal(box.style.top,'52px');
 assert.equal(h.context.location.href,'');await button.onclick();assert.equal(h.calls.at(-1).p.p_action,'accept');assert.equal(h.context.location.href,'ranked-team-v244.html?v=254');
 h.logout();assert.equal(box.hidden,true);
 const dismiss=harness();await flush();dismiss.nodes[0].events.keydown({key:'Escape',preventDefault(){}});await flush();assert.equal(dismiss.nodes[0].hidden,true);assert.equal(dismiss.calls.at(-1).p.p_action,'decline','thenable decline is actually executed');
 const late=harness({slow:true});await flush();late.logout();late.release();await flush();assert.equal(late.nodes[0].hidden,true,'late inbox replies cannot reopen the banner after logout');
 let resolveAuth;const lateAuth=harness({getUser:()=>new Promise(r=>resolveAuth=r)});lateAuth.logout();resolveAuth({data:{user:{id:'recipient'}}});await flush();assert.equal(lateAuth.calls.length,0,'late identity lookup cannot resurrect a signed-out account');
 const anon=harness({getUser:async()=>({data:{user:{id:'anonymous',is_anonymous:true}}})});await flush();assert.equal(anon.calls.length,0);
 const legacy=harness({legacy:true,getUser:async()=>({data:{user:null}})});await flush();assert.equal(legacy.calls.length,0);
 console.log('V254 NOTICE PASS: recipient-only requests, safe names, explicit acceptance, thenable RPCs, dismissal, sign-out races, anonymous and legacy auth.');
})().catch(e=>{console.error(e);process.exitCode=1});
