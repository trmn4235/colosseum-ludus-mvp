// Real shipped SQL: owned task snapshots and exactly-once armed-trip training.
const assert=require('node:assert/strict');
module.exports=async({db,q,A,B,call,migration,randomUUID})=>{
 await db.exec('begin');
 const admin=()=>db.exec('reset role'),auth=()=>db.exec('set role authenticated');
 const rejects=async(fn,pattern)=>{await q('savepoint expected_worker_error');try{await assert.rejects(fn,pattern);}finally{await q('rollback to savepoint expected_worker_error');await q('release savepoint expected_worker_error');}};
 await admin();await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q('update ludus_accounts set gold=1000000 where user_id=$1',[A]);
 await q('update ludus_supply_private.stock set quantity=0 where owner_id=$1',[A]);
 await q("update ludus_supply_private.jobs set started_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '1 second' where owner_id=$1 and claimed_at is null",[A]);
 await auth();const cities=(await call()).cities;await admin();
 for(const name of ['workers_profile_v226','workers_auth_v226','workers_eight_v226','workers_professions_v227'])await db.exec(migration(name));
 await q("update ludus_supply_private.stock set quantity=case sku when 'bow' then 8 when 'arrow' then 400 else 0 end where owner_id=$1",[A]);await auth();
 const roster=async()=>(await q('select ludus_workers_roster_v226() s'))[0].s;
 const ids=(await roster()).workers.map(w=>w.id),worker=(r,i)=>r.workers.find(w=>w.id===ids[i]);
 // A new quote must not cross the live 15-minute epoch while the departure RPC
 // runs. Explicit replay keys below are preserved, including after expiry.
 const route=async(sku,n)=>{const remaining=900000-Date.now()%900000;if(remaining<2000)await new Promise(resolve=>setTimeout(resolve,remaining+20));for(const c of cities){const quote=(await q('select ludus_caravan_city($1) s',[c.id]))[0].s;if(quote.goods.some(g=>g.sku===sku&&g.stock>=n))return [c.id,sku,quote.epoch,n].join(':');}throw Error('No stocked city for '+sku);};
 const depart=async({sku='iron_ore',qty=1,workers=[ids[0]],bows=1,arrows=20,request=randomUUID(),key}={})=>(await q("select ludus_worker_caravan_depart_v227('buy',$1,$2,$3,$4::uuid[],$5,$6,'{}'::uuid[]) s",[key||await route(sku,qty),workers.length,request,workers,bows,arrows]))[0].s;
 const deliver=async id=>{await admin();await q("update ludus_supply_private.jobs set started_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '1 second' where id=$1",[id]);await auth();return roster();};
 const legacy=await depart({workers:[ids[7]]});await admin();await db.exec(migration('worker_tasks_archery_v229'));await auth();
 let r=await roster();assert.ok(Number.isFinite(Date.parse(r.server_now)));assert.equal(r.archery_xp_per_trip,10);assert.equal(r.archery_xp_per_level,100);assert.equal(r.archery_max_level,20);
 assert.ok(r.workers.every(w=>w.skills.length===9&&w.archery.xp===0&&w.archery.level===1&&w.archery.base_damage===9));
 r=await deliver(legacy.result.job_id);assert.equal(worker(r,7).archery.xp,0,'in-flight legacy assignments gain no retroactive archery');
 const request=randomUUID(),key=await route('iron_ore',3);let s=await depart({workers:[ids[0],ids[1]],qty:3,bows:1,arrows:20,request,key});
 const job=s.jobs.find(j=>j.id===s.result.job_id);assert.equal(job.worker_defense.length,2);assert.deepEqual(job.worker_defense.map(w=>[w.worker_id,w.armed,w.arrows,w.archery_level,w.base_damage]),[[ids[0],true,20,1,9],[ids[1],false,0,1,9]]);
 const onTrip=worker(s.worker_roster,0);assert.equal(onTrip.job.id,job.id);assert.equal(onTrip.job.ends_at,job.ends_at);assert.equal(onTrip.job.cargo.iron_ore,3);assert.equal(onTrip.archery.xp,0,'no early training');
 assert.equal((await depart({workers:[ids[0],ids[1]],qty:3,bows:1,arrows:20,request,key})).result.replayed,true);
 await rejects(()=>depart({workers:[ids[1],ids[0]],qty:3,bows:1,arrows:20,request,key}),/başka bir işçi seferinde/);
 r=await deliver(job.id);assert.equal(worker(r,0).archery.xp,10);assert.equal(worker(r,0).archery.training_trips,1);assert.equal(worker(r,1).archery.xp,0);assert.equal(worker(r,0).job,null);
 assert.deepEqual(r.assignments.filter(a=>a.job_id===job.id).map(a=>a.archery_xp_awarded),[10,0]);
 await depart({workers:[ids[0],ids[1]],qty:3,bows:1,arrows:20,request,key});assert.equal(worker(await roster(),0).archery.xp,10,'request replay cannot retrain');
 await admin();await q('update ludus_supply_private.jobs set claimed_at=claimed_at where id=$1',[job.id]);await auth();assert.equal(worker(await roster(),0).archery.xp,10,'repeat settlement cannot retrain');
 await admin();await q('update ludus_worker_private.archery_v229 set xp=90,training_trips=9 where worker_id=$1',[ids[0]]);await auth();
 s=await depart();const frozen=s.jobs.find(j=>j.id===s.result.job_id).worker_defense[0];r=await deliver(s.result.job_id);assert.equal(worker(r,0).archery.level,2);assert.equal(worker(r,0).archery.base_damage,10);assert.equal(frozen.archery_level,1);assert.equal(frozen.base_damage,9);
 s=await depart();assert.equal(s.jobs.find(j=>j.id===s.result.job_id).worker_defense[0].base_damage,10);await deliver(s.result.job_id);
 // A full warehouse delays both profession and archery gains.
 s=await depart({sku:'hide',workers:[ids[2]]});await admin();await q("update ludus_supply_private.stock set quantity=50000 where owner_id=$1 and sku='hide'",[A]);await auth();r=await deliver(s.result.job_id);assert.equal(worker(r,2).archery.xp,0);assert.equal(worker(r,2).job.id,s.result.job_id);
 await admin();await q("update ludus_supply_private.stock set quantity=0 where owner_id=$1 and sku='hide'",[A]);await auth();r=await roster();assert.equal(worker(r,2).archery.xp,10);assert.equal(worker(r,2).job,null);
 // Trip training is independent of how an uneven material load is split.
 s=await depart({workers:[ids[3],ids[4]],bows:2,arrows:2});r=await deliver(s.result.job_id);assert.equal(worker(r,3).archery.xp,10);assert.equal(worker(r,4).archery.xp,10);
 s=await depart({workers:[ids[3],ids[4]],bows:2,arrows:1});assert.deepEqual(s.jobs.find(j=>j.id===s.result.job_id).worker_defense.map(a=>a.armed),[true,false]);r=await deliver(s.result.job_id);assert.equal(worker(r,3).archery.xp,20);assert.equal(worker(r,4).archery.xp,10);
 s=await depart({workers:[ids[5]],arrows:0});r=await deliver(s.result.job_id);assert.equal(worker(r,5).archery.xp,0,'a bow without arrows gives no training');
 await admin();await q('update ludus_worker_private.archery_v229 set xp=1895 where worker_id=$1',[ids[0]]);await auth();s=await depart();r=await deliver(s.result.job_id);assert.equal(worker(r,0).archery.xp,1900);assert.equal(worker(r,0).archery.level,20);assert.equal(worker(r,0).archery.base_damage,28);assert.equal(r.assignments.find(a=>a.job_id===s.result.job_id).archery_xp_awarded,5);
 s=await depart();r=await deliver(s.result.job_id);assert.equal(worker(r,0).archery.xp,1900);assert.equal(r.assignments.find(a=>a.job_id===s.result.job_id).archery_xp_awarded,0);
 await rejects(()=>q('select * from ludus_worker_private.archery_v229'),/permission denied/);await rejects(()=>q('update ludus_worker_private.archery_v229 set xp=1900'),/permission denied/);
 await admin();const levels=await q('select i,ludus_worker_private.archery_level_v229((i-1)*100) as level,ludus_worker_private.arrow_damage_v229(i) as damage from generate_series(1,20)i');assert.ok(levels.every(v=>v.level===v.i&&v.damage===8+v.i));
 await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);await auth();r=await roster();assert.ok(r.workers.every(w=>!ids.includes(w.id)&&w.archery.xp===0));
 await admin();await db.exec('rollback');await auth();
 console.log('V229 PASS: live task snapshots, owned archery, frozen level/damage, armed selection order, exactly-once training, arrival delay, level/cap progression and legacy isolation.');
};
