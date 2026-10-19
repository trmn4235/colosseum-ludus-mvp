const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),fixture=JSON.parse(fs.readFileSync('/tmp/raid-state-v126.json'));
for(const name of ['caravan-core-v126.js','caravan-simulation-v126.js'])assert.deepEqual(fs.readFileSync(path.join(root,name)),fs.readFileSync(path.join(root,'supabase/functions/caravan-combat-v126',name)),'browser and verifier bytes must match');
let handler,settlements=[],state=fixture,anonymous=false;
globalThis.Deno={env:{get:name=>({SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'public-fixture',SUPABASE_SERVICE_ROLE_KEY:'service-fixture'})[name]},serve:fn=>handler=fn};
globalThis.fetch=async(url,options)=>{
 const route=new URL(url).pathname;
 if(route==='/auth/v1/user')return Response.json({id:fixture.user_id,is_anonymous:anonymous});
 if(route.endsWith('/ludus_caravan_raid'))return Response.json(state);
 if(route.endsWith('/ludus_caravan_verified_v126')){assert.equal(options.headers.apikey,'service-fixture');const args=JSON.parse(options.body);settlements.push(args);return Response.json({...fixture.active,status:'resolved',success:args.p_won});}
 throw Error('Unexpected request '+url);
};
(async()=>{
 await import(pathToFileURL(path.join(root,'supabase/functions/caravan-combat-v126/index.ts')));
 const call=(body,token=true)=>handler(new Request('https://fixture.invalid/verify',{method:'POST',headers:token?{Authorization:'Bearer fixture'}:{},body:JSON.stringify(body)}));
 assert.equal((await call({},false)).status,401);
 anonymous=true;assert.equal((await call({})).status,401);anonymous=false;
 const S=globalThis.CaravanSimulation,ticket=fixture.active,s=S.create(ticket);
 while(!s.combat.finished){S.step(s,[0,0,3142,1]);s.combat.drain();}
 const body={raid:ticket.id,steps:s.steps,commands:s.commands,won:s.combat.result!=='win',cargo:'diamond',quantity:99999};
 assert.equal((await call({...body,raid:'invalid'})).status,400);
 assert.equal((await call({...body,steps:0,commands:[]})).status,400);
 assert.equal((await call({...body,steps:1,commands:[[101,0,0,1]]})).status,400);
 state={...fixture,active:{...ticket,battle_started_at:new Date().toISOString()}};
 const owned=state;state={...state,user_id:'another-account'};assert.equal((await call(body)).status,400);state=owned;const response=await call(body);assert.equal(response.status,200);assert.equal((await response.json()).result.success,s.combat.result==='win');
 assert.deepEqual(settlements[0],{p_owner:fixture.user_id,p_raid:ticket.id,p_won:s.combat.result==='win',p_seconds:s.steps/30});
 assert.equal((await call({raid:ticket.id,commands:[],steps:0,abandon:true,won:true})).status,200);assert.equal(settlements.at(-1).p_won,false);
 state={...state,active:null,history:[{...ticket,status:'resolved',success:false}]};const n=settlements.length;assert.equal((await call(body)).status,200);assert.equal(settlements.length,n,'replayed settlement must not issue a second reward');
 console.log('V126 verifier PASS: identical simulation bytes, authenticated ownership, invalid controls, unfinished battle, derived result, ignored client loot/outcome and idempotent return.');
})().catch(e=>{console.error(e);process.exitCode=1;});
