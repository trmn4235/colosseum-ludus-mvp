const assert=require('node:assert/strict'),fs=require('node:fs');
module.exports=async({db,q,A,B,call,migration,randomUUID})=>{
 await db.exec('begin;reset role');
 for(const n of ['workers_profile_v226','workers_auth_v226','workers_eight_v226','workers_professions_v227','worker_tasks_archery_v229','worker_caravan_defense_v230'])await db.exec(migration(n));
 const admin=()=>db.exec('reset role'),auth=()=>db.exec('set role authenticated');
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q('update ludus_accounts set gold=10000000 where user_id=$1',[A]);
 await q("update ludus_supply_private.jobs set started_at=clock_timestamp()-interval '3 hours',ends_at=clock_timestamp()-interval '1 hour' where owner_id=$1 and claimed_at is null",[A]);
 await q('update ludus_supply_private.stock set quantity=0 where owner_id=$1',[A]);
 await auth();await call();await admin();await q("update ludus_gladiators set status='available',injured_until=null where owner_id=$1",[A]);
 await q("update ludus_supply_private.stock set quantity=case sku when 'bow' then 20 when 'arrow' then 1000 else 0 end where owner_id=$1",[A]);await auth();
 const roster=async()=>(await q('select ludus_workers_roster_v226() s'))[0].s;
 const worker=(await roster()).workers[0].id;
 const api=async(action='state',id=null,gid=null)=>(await q('select ludus_caravan_defense_v230($1,$2,$3) s',[action,id,gid]))[0].s;
 const route=async()=>{for(const c of (await call()).cities){const s=(await q('select ludus_caravan_city($1) s',[c.id]))[0].s;if(s.goods.some(g=>g.sku==='iron_ore'&&g.stock>=4))return[c.id,'iron_ore',s.epoch,4].join(':');}throw Error('No iron stock');};
 const depart=async(key=undefined,request=randomUUID())=>(await q("select ludus_worker_caravan_depart_v227('buy',$1,1,$2,array[$3]::uuid[],1,6,'{}'::uuid[]) s",[key||await route(),request,worker]))[0].s;
 const finish=async id=>{await admin();await q("update ludus_supply_private.jobs set started_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '1 second' where id=$1",[id]);await auth();return roster();};
 const reject=async(fn,re)=>{await q('savepoint expected');try{await assert.rejects(fn,re);}finally{await db.exec('rollback to savepoint expected;release savepoint expected');}};
 // Staged rollout keeps old clients and existing trips unaffected.
 let s=await depart();await admin();assert.equal((await q('select count(*)::integer n from ludus_worker_private.defense_counter_v230'))[0].n,0);await auth();await finish(s.result.job_id);
 await admin();await q('update ludus_worker_private.defense_config_v230 set enabled=true');await auth();
 const attacks=[];
 for(let i=0;i<10;i++){
  const key=await route(),request=randomUUID();s=await depart(key,request);const id=s.result.job_id;
  await depart(key,request);await admin();assert.equal((await q('select departures from ludus_worker_private.defense_counter_v230 where owner_id=$1',[A]))[0].departures,i+1);
  const d=(await q('select * from ludus_worker_private.defenses_v230 where id=$1',[id]))[0];await auth();
  if(d){
   assert.ok(!(await api()).encounters.some(x=>x.id===id),'future ambush remains hidden');await reject(()=>api('enter',id),/Aktif/);
   await admin();await q("update ludus_worker_private.defenses_v230 set starts_at=clock_timestamp()-interval '1 second' where id=$1",[id]);await auth();
   let a=await api();assert.ok(a.encounters.some(x=>x.id===id));const g=a.gladiators.find(x=>x.ready);assert.ok(g);
   await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);await reject(()=>api('enter',id,g.id),/hesaba ait/);await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
   await reject(()=>q('select ludus_caravan_defense_verified_v230($1,$2,true)',[A,id]),/permission denied/);
   a=await api('enter',id,g.id);assert.equal(a.result.status,'fighting');assert.equal(a.result.team[0].id,g.id);
   assert.deepEqual((await api('enter',id)).result,a.result,'re-entry keeps frozen ticket and deadline');
   assert.equal((await api()).gladiators.find(x=>x.id===g.id).ready,false,'selected gladiator is reserved');
   if(!attacks.length){fs.writeFileSync('/tmp/defense-ticket-v230.json',JSON.stringify(a.result));fs.writeFileSync('/tmp/defense-state-v230.json',JSON.stringify(a));}
   // Delivery cannot race a running battle, even through legacy claim.
   await finish(id);assert.equal((await roster()).workers.find(w=>w.id===worker).job_id,id);
   await reject(()=>call('claim',id),/saldırı altında/);
   await admin();await db.exec('set role service_role');
   const won=attacks.length%2===0,result=(await q('select ludus_caravan_defense_verified_v230($1,$2,$3) s',[A,id,won]))[0].s;
   assert.equal(result.success,won);assert.equal(result.lost_cargo.iron_ore,won?0:2);
   assert.deepEqual((await q('select ludus_caravan_defense_verified_v230($1,$2,$3) s',[A,id,!won]))[0].s,result,'settlement cannot be replayed for different cargo');
   await admin();assert.equal((await q('select cargo from ludus_supply_private.jobs where id=$1',[id]))[0].cargo.iron_ore,won?4:2);await auth();attacks.push({departure:i+1,id});
  }
  const r=await finish(id);assert.equal(r.workers.find(w=>w.id===worker).job_id,null);
 }
 assert.equal(attacks.filter(x=>x.departure<=5).length,2);assert.equal(attacks.filter(x=>x.departure>5).length,2);
 // No rescue: resolve once from the frozen bow/ammunition/escort strength.
 let autoId;
 for(let i=0;i<5&&!autoId;i++){s=await depart();const id=s.result.job_id;await admin();const d=(await q('select * from ludus_worker_private.defenses_v230 where id=$1',[id]))[0];
  if(d){autoId=id;await q("update ludus_worker_private.defenses_v230 set starts_at=clock_timestamp()-interval '2 hours',deadline=clock_timestamp()-interval '1 second' where id=$1",[id]);}
  await auth();await finish(id);
 }
 assert.ok(autoId);s=await api();const result=s.encounters.find(x=>x.id===autoId);assert.equal(result.automatic,true);assert.equal(result.success,false);assert.equal(result.lost_cargo.iron_ore,2);
 await reject(()=>q('select * from ludus_worker_private.defenses_v230'),/permission denied/);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);assert.ok((await api()).encounters.every(x=>x.owner_id===B));await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");await reject(()=>api(),/giriş yap/);await q("select set_config('request.jwt.claims','{}',false)");
 await admin();await db.exec('rollback');await auth();
 console.log('V230 SQL PASS: exact 2/5 attacks, no replay reroll, frozen workers, owner isolation, gladiator locking, re-entry, delivery/claim blocking, verified win/loss once and automatic timeout.');
};
