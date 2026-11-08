import './caravan-core-v126.js';
import './combat-curves-v163.js';
import './combat-motion-v163.js';
import './bot-simulation-v233.js';

const url=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'};
const response=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
async function call(path:string,method='GET',body?:unknown){
 const r=await fetch(url+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(18000)});
 let value:any;try{value=await r.json();}catch{value={};}
 if(!r.ok)throw Error(String(value.message||value.msg||value.error_description||value.error||'Sunucu işlemi başarısız.').slice(0,200));return value;
}
const rpc=(name:string,data:unknown={})=>call('/rest/v1/rpc/'+name,'POST',data);
function toBase64(bytes:Uint8Array){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
function fromBase64(value:string){const s=atob(value),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i);return out;}
async function compress(value:unknown){const stream=new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip'));return toBase64(new Uint8Array(await new Response(stream).arrayBuffer()));}
async function decompress(value:string){const stream=new Blob([fromBase64(value)]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(stream).text());}
async function findUser(email:string,nonce:string,slot:number){
 for(let page=1;page<=20;page++){
  const data=await call('/auth/v1/admin/users?page='+page+'&per_page=200');const users=Array.isArray(data)?data:data.users||[];
  const found=users.find((u:any)=>u.email===email);if(found){if(found.user_metadata?.ludus_bot_nonce!==nonce||Number(found.user_metadata?.ludus_bot_slot)!==slot)throw Error('Bot hesabı başka bir kullanıcıya ait.');return found.id;}
  if(users.length<200)break;
 }
 return null;
}
async function provision(context:any){
 for(const bot of context.missing){
  const slot=Number(bot.slot),n=String(slot).padStart(2,'0'),prefix=context.nonce.replaceAll('-','').slice(0,8),email='bot-'+context.nonce+'-'+n+'@bots.invalid';
  let id=await findUser(email,context.nonce,slot);
  if(!id){
   const metadata={username:'bot_'+prefix+'_'+n,ludus_name:bot.name,ludus_bot_nonce:context.nonce,ludus_bot_slot:String(slot)};
   try{const user=await call('/auth/v1/admin/users','POST',{email,email_confirm:true,password:crypto.randomUUID()+crypto.randomUUID(),user_metadata:metadata});id=user.id||user.user?.id;}
   catch(e){id=await findUser(email,context.nonce,slot);if(!id)throw e;}
  }
  if(!id)throw Error('Bot hesabı oluşturulamadı.');await rpc('ludus_bot_register_v233',{p_slot:slot,p_user:id});
 }
 if(!context.missing.length)await rpc('ludus_bot_assign_v233');
 return {provisioned:context.missing.length};
}
Deno.serve(async req=>{
 if(req.method!=='POST')return response({error:'POST gerekli.'},405);
 const secret=req.headers.get('X-Bot-Scheduler')||'';
 if(!/^[0-9a-f-]{36}$/i.test(secret))return response({error:'Yetki gerekli.'},401);
 let lease:any=null;
 try{
  if(await rpc('ludus_bot_secret_v233',{p_secret:secret})!==true)return response({error:'Yetki gerekli.'},401);
  const context=await rpc('ludus_bot_context_v233');
  const request=await req.json().catch(()=>({}));
  if(request.probe===true)return response({ok:true,ready:context.ready,enabled:context.enabled});
  if(context.setup_requested&&!context.ready){try{return response(await provision(context));}catch(e){await rpc('ludus_bot_setup_error_v233',{p_error:e instanceof Error?e.message:'Kurulum başarısız.'});throw e;}}
  if(!context.ready||!context.enabled)return response({idle:true});
  // Each saved chunk releases its lease before the next claim. This advances
  // four different due bots per invocation without increasing scheduled calls.
  const engine=(globalThis as any).LudusBotSimulationV233,deadline=Date.now()+16000;
  let processed=0,settled=0;
  for(let i=0;i<4;i++){
   if(i&&Date.now()>=deadline)break;
   lease=await rpc('ludus_bot_claim_v233');
   if(!lease?.lease){
    if(lease?.finished)settled++;
    if(lease?.idle||lease?.fault)break;
    lease=null;continue;
   }
   const state=lease.state?await decompress(lease.state):engine.create(lease.ticket,Number(lease.seed));
   const next=engine.advance(state,400);
   const result=next.finished?{won:next.result==='win',stats:next.stats}:next.abandoned?{won:false,stats:{game_mode:next.mode,seconds:600,alive:false,exit_slots:{},abandoned:true}}:null;
   await rpc('ludus_bot_save_v233',{p_slot:lease.slot,p_lease:lease.lease,p_battle:lease.battle,p_steps:next.steps,p_state:result?null:await compress(next),p_result:result});
   processed++;lease=null;
  }
  return response({processed,settled});
 }catch(e){
  if(lease?.lease)try{await rpc('ludus_bot_fault_v233',{p_slot:lease.slot,p_lease:lease.lease,p_error:e instanceof Error?e.message:'Bot görevi başarısız.'});}catch{}
  return response({error:e instanceof Error?e.message:'Bot işlemi başarısız.'},400);
 }
});
