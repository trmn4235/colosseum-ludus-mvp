const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const{preview,createStore}=require('../infirmary-supplies-v289.js');
const owner='00000000-0000-4000-8000-000000000001',sku='beeswax_ointment';
const fixture=()=>({user_id:owner,server_now:new Date().toISOString(),recipes:[{sku,name:'Balmumu Merhemi',output_quantity:1,max_craftable:4,ingredients:[{sku:'beeswax',name:'Balmumu',quantity:1,owned:8,source:'resource'},{sku:'olive_oil',name:'Zeytinyağı',quantity:1,owned:4,source:'food'}]}],inventory:[{sku,name:'Balmumu Merhemi',quantity:2}]});
(async()=>{
 const initial=fixture(),copy=JSON.stringify(initial),p=preview(initial.recipes[0],3,initial.inventory);
 assert.equal(p.canCraft,true);assert.equal(p.output,3);assert.equal(p.after,5);assert.deepEqual(p.ingredients.map(i=>i.remaining),[5,1]);assert.equal(JSON.stringify(initial),copy,'preview never mutates source stock');
 for(const n of [0,-1,1.5,101,Infinity,NaN])assert.equal(preview(initial.recipes[0],n,initial.inventory).canCraft,false);
 assert.equal(preview(initial.recipes[0],5,initial.inventory).canCraft,false,'food and resource availability both constrain production');
 assert.equal(preview({...initial.recipes[0],max_craftable:0},1,initial.inventory).canCraft,false,'server product capacity is respected');
 const memory=new Map(),storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 let state=fixture(),calls=[],receipts=new Map(),drop=true,effects=0,observed=null;
 const client={rpc:async(name,args)=>{
  assert.equal(name,'ludus_infirmary_v289');calls.push(structuredClone(args));
  if(args.p_action==='state')return{data:structuredClone(state)};
  const previous=receipts.get(args.p_request);
  if(previous)return{data:{...structuredClone(previous),outcome:{...previous.outcome,replayed:true}}};
  const count=args.p_args.quantity;effects++;state.inventory[0].quantity+=count;state.recipes[0].ingredients.forEach(i=>i.owned-=count);state.recipes[0].max_craftable-=count;
  state.outcome={action:'craft',sku,quantity:count,spent:[{sku:'beeswax',quantity:count,source:'resource'},{sku:'olive_oil',quantity:count,source:'food'}],request_id:args.p_request,replayed:false};receipts.set(args.p_request,structuredClone(state));
  if(drop){drop=false;return{error:{code:'08006',message:'Yanıt bağlantısı koptu'}};}return{data:structuredClone(state)};
 }};
 const settings={client,ready:Promise.resolve({user_id:owner}),storage,uuid:randomUUID,onCraft:s=>{observed=s;}};
 const store=createStore(settings);await store.refresh();assert.equal(store.snapshot().data.inventory[0].quantity,2);
 assert.equal(await store.craft(sku,2),false);assert.equal(effects,1);assert(store.snapshot().pending);assert.equal(memory.size,1);
 await assert.rejects(()=>store.craft(sku,3),/Önce bekleyen/);
 const restored=createStore(settings);await restored.refresh();const saved=restored.snapshot().pending;assert.equal(saved.quantity,2);
 assert.equal(await restored.craft(sku,2),true);assert.equal(effects,1,'lost response and restored screen must reuse one receipt');assert.equal(observed.outcome.replayed,true);assert.equal(observed.inventory[0].quantity,4);assert.equal(restored.snapshot().pending,null);assert.equal(memory.size,0);
 const commits=calls.filter(c=>c.p_action==='craft');assert.equal(commits[0].p_request,commits[1].p_request);assert.deepEqual(commits[0].p_args,commits[1].p_args);
 const wrong=createStore({...settings,client:{rpc:async()=>({data:{...fixture(),user_id:'someone-else'}})}});await wrong.refresh();assert.equal(wrong.snapshot().data,null);assert.match(wrong.snapshot().error,/doğrulanamadı/);
 const denied=createStore({...settings,client:{rpc:async(_name,args)=>args.p_action==='state'?{data:fixture()}:{error:{code:'P0001',message:'Stok yetersiz'}}}});await denied.refresh();assert.equal(await denied.craft(sku,1),false);assert.equal(denied.snapshot().pending,null);assert.equal(memory.size,0);
 let release,attempts=0;const double=createStore({...settings,client:{rpc:async(_name,args)=>{if(args.p_action==='state')return{data:fixture()};attempts++;await new Promise(r=>release=r);return{error:{code:'P0001',message:'Fixture rejection'}};}}});await double.refresh();const first=double.craft(sku,1),second=double.craft(sku,1);await new Promise(r=>setImmediate(r));assert.equal(attempts,1,'rapid clicks submit once');release();await Promise.all([first,second]);
 // A receipt must be durable before any first production request reaches the server.
 let storageBlocked=true,writeCalls=0,storedRequest=null;const durable=new Map(),blockedStorage={getItem:k=>durable.get(k)||null,setItem:(k,v)=>{if(storageBlocked)throw Error('QuotaExceededError');durable.set(k,v);},removeItem:k=>durable.delete(k)};
 const blocked=createStore({...settings,storage:blockedStorage,client:{rpc:async(_name,args)=>{if(args.p_action==='state')return{data:fixture()};writeCalls++;storedRequest=args.p_request;return{error:{code:'P0001',message:'Fixture business rejection'}};}}});
 await blocked.refresh();assert.equal(await blocked.craft(sku,1),false);assert.equal(writeCalls,0);assert(blocked.snapshot().pending);const blockedId=blocked.snapshot().pending.request;assert.match(blocked.snapshot().error,/Üretim başlamadı/);
 storageBlocked=false;assert.equal(await blocked.craft(sku,1),false);assert.equal(writeCalls,1);assert.equal(storedRequest,blockedId);assert.equal(blocked.snapshot().pending,null);assert.equal(durable.size,0);assert(blockedId);
 const unknown=createStore({...settings,client:{rpc:async(_name,args)=>args.p_action==='state'?{data:fixture()}:{error:{code:'XX001',message:'Unknown result'}}}});await unknown.refresh();await unknown.craft(sku,1);assert(unknown.snapshot().pending,'unrecognized server errors must preserve the original receipt');memory.clear();
 console.log('PASS V289 medical production: reversible mixed-stock preview, limits/capacity, ownership, atomic receipt contract, lost response/reopen retry, business rejection, one click in flight, shared inventory refresh.');
})().catch(error=>{console.error(error);process.exitCode=1;});
