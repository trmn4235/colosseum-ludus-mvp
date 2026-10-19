import './caravan-core-v126.js';
import './caravan-simulation-v126.js';
import './caravan-simulation-v127.js';

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Content-Type':'application/json'};
const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
async function request(path:string,authorization:string,key:string,body?:unknown){
 const response=await fetch(url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:authorization,apikey:key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok)throw Error(data.message||data.msg||'Savaş kaydı alınamadı.');return data;
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'POST gerekli.'},405);
 try{
  const token=req.headers.get('Authorization')||'';
  if(!token.startsWith('Bearer '))return reply({error:'Giriş gerekli.'},401);
  const user=await request('/auth/v1/user',token,anon);
  if(!user.id||user.is_anonymous)return reply({error:'Hesabına giriş yap.'},401);
  const text=await req.text();if(text.length>250000)return reply({error:'Savaş kaydı çok büyük.'},413);
  const body=JSON.parse(text);if(!/^[a-f0-9-]{36}$/i.test(body.raid||''))throw Error('Baskın kimliği geçersiz.');
  const state=await request('/rest/v1/rpc/ludus_caravan_raid',token,anon,{p_action:'state'});
  if(state.user_id!==user.id)throw Error('Hesap doğrulanamadı.');
  const ticket=[state.active,...state.history].find(j=>j?.id===body.raid);
  if(!ticket)throw Error('Bu hesaba ait baskın bulunamadı.');
  if(ticket.status==='resolved')return reply({result:ticket,replayed:true});
  if(!ticket.battle_started_at)throw Error('Önce savaşa giriş yap.');
  const engine=ticket.encounter?.rules===127?(globalThis as any).CaravanSimulationV127:(globalThis as any).CaravanSimulation;
  const sim=engine.replay(ticket,body.commands,body.steps);
  if(!sim.combat.finished&&body.abandon!==true)throw Error('Savaş henüz bitmedi.');
  const result=await request('/rest/v1/rpc/ludus_caravan_verified_v126','Bearer '+service,service,{
   p_owner:user.id,p_raid:ticket.id,p_won:body.abandon!==true&&sim.combat.result==='win',p_seconds:sim.steps/30
  });
  return reply({result});
 }catch(e){return reply({error:e instanceof Error?e.message:'Savaş doğrulanamadı.'},400);}
});
