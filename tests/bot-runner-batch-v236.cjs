const assert = require('node:assert/strict');

module.exports = async () => {
  const oldDeno=global.Deno, oldFetch=global.fetch;
  let handler, mode='normal', claims=0, saves=[], faults=[], authenticated=0;
  global.Deno={env:{get:key=>({SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-secret'})[key]},serve:fn=>{handler=fn;}};
  require('../supabase/functions/bot-runner-v233/index.ts');
  const realEngine=globalThis.LudusBotSimulationV233;
  globalThis.LudusBotSimulationV233={
    create:(ticket,seed)=>({ticket,seed,steps:0}),
    advance:(state,steps)=>{if(mode==='engine-error')throw Error('simulation failed');return {...state,steps:state.steps+steps,finished:false,abandoned:false};}
  };
  global.fetch=async(url,options)=>{
    const name=String(url).split('/').pop(), input=JSON.parse(options.body||'{}');
    const ok=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});
    if(name==='ludus_bot_secret_v233'){authenticated++;return ok(mode!=='unauthorized');}
    if(name==='ludus_bot_context_v233')return ok({ready:true,enabled:true});
    if(name==='ludus_bot_claim_v233'){
      claims++;
      if(mode==='claim-error'&&claims===2)return new Response(JSON.stringify({message:'claim failed'}),{status:500});
      if(mode==='idle'&&claims===2)return ok({idle:true});
      if(mode==='settled'&&claims===1)return ok({finished:true});
      return ok({slot:claims,lease:'lease-'+claims,battle:'battle-'+claims,seed:claims,ticket:{mode:'pit'}});
    }
    if(name==='ludus_bot_save_v233'){saves.push(input);return ok(true);}
    if(name==='ludus_bot_fault_v233'){faults.push(input);return ok(true);}
    throw Error('Unexpected request '+name);
  };
  const request=secret=>new Request('https://test.invalid/runner',{method:'POST',headers:{'X-Bot-Scheduler':secret,'Content-Type':'application/json'},body:'{}'});
  const secret='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  const reset=next=>{mode=next;claims=0;saves=[];faults=[];authenticated=0;};
  try{
    reset('normal');let r=await handler(request('wrong'));assert.equal(r.status,401);assert.equal(authenticated,0);
    reset('unauthorized');r=await handler(request(secret));assert.equal(r.status,401);assert.equal(claims,0);
    reset('normal');r=await handler(request(secret));assert.equal(r.status,200);assert.deepEqual(await r.json(),{processed:4,settled:0});
    assert.equal(saves.length,4);assert.deepEqual(saves.map(s=>s.p_slot),[1,2,3,4]);assert.ok(saves.every(s=>s.p_steps===400&&s.p_state&&s.p_result===null));
    reset('idle');r=await handler(request(secret));assert.deepEqual(await r.json(),{processed:1,settled:0});assert.equal(claims,2);
    reset('settled');r=await handler(request(secret));assert.deepEqual(await r.json(),{processed:3,settled:1});
    reset('claim-error');r=await handler(request(secret));assert.equal(r.status,400);assert.equal(saves.length,1);assert.equal(faults.length,0,'a released lease must never be faulted');
    reset('engine-error');r=await handler(request(secret));assert.equal(r.status,400);assert.equal(faults.length,1);assert.equal(faults[0].p_lease,'lease-1');
    console.log('V236 bot runner PASS: bounded batches, pause, settlement and lease isolation.');
  }finally{
    globalThis.LudusBotSimulationV233=realEngine;global.fetch=oldFetch;
    if(oldDeno===undefined)delete global.Deno;else global.Deno=oldDeno;
  }
};
