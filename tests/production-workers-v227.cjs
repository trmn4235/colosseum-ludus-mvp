// Exercise individual workers through the shipped caravan, market and delivery SQL.
const assert=require('node:assert/strict');
module.exports=async({db,q,A,B,call,migration,randomUUID})=>{
 await db.exec('begin');
 const admin=()=>db.exec('reset role'),auth=()=>db.exec('set role authenticated');
 const rejects=async(fn,pattern)=>{await q('savepoint worker_expected_error');try{await assert.rejects(fn,pattern);}finally{await q('rollback to savepoint worker_expected_error');await q('release savepoint worker_expected_error');}};
 const identity=async id=>{await admin();await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await auth();};
 await identity(A);await admin();
 await q("update ludus_supply_private.jobs set started_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '1 second' where owner_id=$1",[A]);
 await q('update ludus_accounts set gold=1000000 where user_id=$1',[A]);
 await q('update ludus_supply_private.stock set quantity=0 where owner_id=$1',[A]);
 await auth();const cities=(await call()).cities;
 // Quotes rotate every 15 minutes, and earlier suites consume shared stock.
 // Buy from an actual stocked city instead of assuming city 1 has every load.
 const key=async(sku,n)=>{
  for(const city of cities){
   const quote=(await q('select ludus_caravan_city($1)s',[city.id]))[0].s;
   if(quote.goods.some(g=>g.sku===sku&&g.stock>=n))return [city.id,sku,quote.epoch,n].join(':');
  }
  throw new Error('No city has '+n+' '+sku+' available for the worker test');
 };
 const oldRequest=randomUUID(),oldKey=await key('iron_ore',1),old=(await call('buy',oldKey,oldRequest)).result.job_id;
 await admin();for(const n of ['workers_profile_v226','workers_auth_v226','workers_eight_v226','workers_professions_v227'])await db.exec(migration(n));await auth();
 const roster=async()=>(await q('select ludus_workers_roster_v226()s'))[0].s;
 let r=await roster();const ids=r.workers.map(w=>w.id);
 assert.equal(ids.length,8);assert.equal(new Set(ids).size,8);assert.equal(r.professions.length,9);
 assert.deepEqual(r.professions.map(p=>p.sku),['iron_ore','copper_ore','tin_ore','lead_ore','wood','flax','hide','wool','resin']);
 assert.equal(r.professions.find(p=>p.sku==='hide').name,'Dericilik');assert.equal(r.professions.find(p=>p.sku==='wool').name,'Yüncülük');
 assert.deepEqual(r.level_thresholds,[0,60,180,360,600]);assert.ok(r.workers.every(w=>w.skills.length===9&&w.skills.every(s=>s.level===1&&s.xp===0&&s.delivered===0)));
 const depart=async({sku='iron_ore',qty=60,workers=[ids[0]],request=randomUUID(),route}={})=>(await q('select ludus_worker_caravan_depart_v227($1,$2,$3,$4,$5::uuid[],0,0,\'{}\'::uuid[])s',['buy',route||await key(sku,qty),workers.length,request,workers]))[0].s;
 const skill=(r,id,sku='iron_ore')=>r.workers.find(w=>w.id===id).skills.find(s=>s.sku===sku);
 const deliver=async job=>{await admin();await q("update ludus_supply_private.jobs set started_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '1 second' where id=$1",[job]);await auth();return roster();};
 await rejects(()=>depart({request:oldRequest,route:oldKey}),/başka bir çıkışta/);
 r=await deliver(old);assert.ok(r.workers.every(w=>w.skills.every(s=>s.xp===0)),'legacy deliveries are not attributed retroactively');
 const request=randomUUID(),route=await key('iron_ore',60);let s=await depart({request,route});const job=s.result.job_id;
 assert.equal(s.worker_roster.workers.find(w=>w.id===ids[0]).job_id,job);assert.equal(skill(s.worker_roster,ids[0]).xp,0);
 const replay=await depart({request,route});assert.equal(replay.result.job_id,job);assert.equal(replay.result.replayed,true);
 await rejects(()=>depart({request,route,workers:[ids[1]]}),/başka bir işçi seferinde/);
 const gold=s.gold;await rejects(()=>depart(),/zaten seferde/);assert.equal((await call()).gold,gold,'rejected reservation does not charge gold');
 await rejects(()=>depart({workers:[ids[1],ids[1]]}),/farklı bir işçi/);
 await rejects(()=>depart({route:route.replace(':iron_ore:',':fish:')}),/yalnızca ekipman/);
 await identity(B);const foreign=(await roster()).workers[0].id;assert.ok((await roster()).workers.every(w=>!ids.includes(w.id)));await identity(A);
 await rejects(()=>depart({workers:[foreign]}),/senin Ludusuna/);
 r=await deliver(job);assert.equal(skill(r,ids[0]).xp,60);assert.equal(skill(r,ids[0]).level,2);assert.equal(skill(r,ids[0]).delivered,60);assert.equal(r.workers[0].job_id,null);
 await depart({request,route});r=await roster();assert.equal(skill(r,ids[0]).xp,60,'replayed delivered request does not grant EXP');
 await admin();await q('update ludus_supply_private.jobs set claimed_at=claimed_at where id=$1',[job]);await auth();assert.equal(skill(await roster(),ids[0]).xp,60);
 s=await depart({workers:[ids[1],ids[2]],qty:61});r=await deliver(s.result.job_id);
 assert.equal(skill(r,ids[1]).delivered,31);assert.equal(skill(r,ids[2]).delivered,30);assert.equal(skill(r,ids[1]).xp+skill(r,ids[2]).xp,61,'no duplicate full-load EXP per worker');
 s=await depart({sku:'copper_ore',qty:3});r=await deliver(s.result.job_id);assert.equal(skill(r,ids[0],'copper_ore').xp,3);assert.equal(skill(r,ids[0]).xp,60,'professions are independent');
 // A full warehouse delays the reward and keeps the worker reserved.
 s=await depart({sku:'hide',qty:2,workers:[ids[3]]});await admin();await q("update ludus_supply_private.stock set quantity=50000 where owner_id=$1 and sku='hide'",[A]);await auth();r=await deliver(s.result.job_id);
 assert.equal(skill(r,ids[3],'hide').xp,0);assert.equal(r.workers.find(w=>w.id===ids[3]).job_id,s.result.job_id);
 await admin();await q("update ludus_supply_private.stock set quantity=0 where owner_id=$1 and sku='hide'",[A]);await auth();r=await roster();assert.equal(skill(r,ids[3],'hide').xp,2);assert.equal(r.workers.find(w=>w.id===ids[3]).job_id,null);
 // Cap EXP at level 5, but keep every delivered unit in lifetime totals.
 await admin();await q("update ludus_worker_private.skills_v227 set xp=590 where worker_id=$1 and sku='iron_ore'",[ids[0]]);await auth();
 s=await depart({qty:20});r=await deliver(s.result.job_id);assert.equal(skill(r,ids[0]).xp,600);assert.equal(skill(r,ids[0]).level,5);assert.equal(skill(r,ids[0]).delivered,80);assert.equal(r.assignments.find(a=>a.job_id===s.result.job_id).xp_awarded,10);
 s=await depart({qty:1});r=await deliver(s.result.job_id);assert.equal(skill(r,ids[0]).xp,600);assert.equal(skill(r,ids[0]).delivered,81);assert.equal(r.assignments.find(a=>a.job_id===s.result.job_id).xp_awarded,0);
 const beforeFood=JSON.stringify(r.workers.map(w=>w.skills));s=await call('send','fish');r=await deliver(s.result.job_id);assert.equal(JSON.stringify(r.workers.map(w=>w.skills)),beforeFood,'food trips create no profession EXP');
 for(const table of ['skills_v227','assignments_v227','receipts_v227'])await rejects(()=>q('select * from ludus_worker_private.'+table),/permission denied/);
 await q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");await rejects(roster,/giriş yap/);await rejects(()=>depart({route}),/giriş yap/);await q("select set_config('request.jwt.claims','{}',false)");
 await admin();await db.exec('set role anon');await rejects(roster,/permission denied/);await auth();
 await admin();await db.exec('rollback');await auth();
 console.log('V227 PASS: nine professions, eight owners-only workers, real purchases/deliveries, split EXP, caps, blocked delivery, replay, reservations, foreign/anonymous denial, and food/legacy exclusions.');
};
