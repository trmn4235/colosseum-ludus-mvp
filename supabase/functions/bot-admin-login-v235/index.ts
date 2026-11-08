// Separate administrator sign-in. The game login endpoint remains unchanged.
const SUPA=Deno.env.get('SUPABASE_URL')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const ORIGIN='https://colosseum-bot-yonetim.inf5535152.chatgpt.site';
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
async function digest(value:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(SERVICE+':'+value));return Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');}
async function serviceRpc(name:string,body:unknown){
 const r=await fetch(SUPA+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:SERVICE,Authorization:'Bearer '+SERVICE,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Giriş hizmeti kullanılamıyor.');return r.json();
}
export async function handle(request:Request):Promise<Response>{
 if(request.headers.get('Origin')!==ORIGIN)return reply(403,{error:'Bu kaynaktan giriş desteklenmiyor.'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method!=='POST')return reply(405,{error:'Geçersiz istek.'});
 if(!request.headers.get('content-type')?.includes('application/json'))return reply(415,{error:'Geçersiz istek.'});
 try{
  const raw=await request.text();if(raw.length>4096)return reply(413,{error:'Geçersiz istek.'});
  const body=JSON.parse(raw),username=typeof body.username==='string'?body.username.trim().toLowerCase():'',password=body.password;
  if(!/^[a-z0-9_]{3,24}$/.test(username)||typeof password!=='string'||password.length<1||password.length>128)return reply(400,{error:'Yönetici girişi doğrulanamadı.'});
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const [accountOK,ipOK]=await Promise.all([serviceRpc('ludus_login_allow',{p_bucket:'u:'+await digest(username),p_limit:10}),serviceRpc('ludus_login_allow',{p_bucket:'ip:'+await digest(ip),p_limit:30})]);
  if(!accountOK||!ipOK)return reply(429,{error:'Çok fazla deneme. Bir dakika sonra tekrar dene.'});
  const email=await serviceRpc('ludus_login_email',{p_username:username});
  const r=await fetch(SUPA+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:email||'unknown@invalid.example',password}),signal:AbortSignal.timeout(15000)});
  const session=await r.json();
  if(!r.ok||!email||!session.access_token||!session.refresh_token||!session.user?.id)return reply(401,{error:'Yönetici girişi doğrulanamadı.'});
  const check=await fetch(SUPA+'/rest/v1/rpc/ludus_bot_admin_v233',{method:'POST',headers:{apikey:ANON,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
  if(!check.ok)return reply(403,{error:'Yönetici girişi doğrulanamadı.'});
  const state=await check.json();if(state.user_id!==session.user.id)return reply(403,{error:'Yönetici girişi doğrulanamadı.'});
  return reply(200,{access_token:session.access_token,refresh_token:session.refresh_token});
 }catch{return reply(503,{error:'Giriş şu anda tamamlanamıyor. Biraz sonra tekrar dene.'});}
}
Deno.serve(handle);
