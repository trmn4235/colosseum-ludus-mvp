const assert=require('node:assert/strict');
module.exports=async({db,q,migration,randomUUID})=>{
 const admin=()=>db.exec('reset role'),identify=async id=>{await admin();await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const reject=async(fn,rx)=>{await db.exec('savepoint v255_reject');try{await assert.rejects(fn,rx);}finally{await db.exec('rollback to savepoint v255_reject;release savepoint v255_reject');}};
 const work=async(action='state',data={},id=null)=>(await q('select public.ludus_clan_work_v232($1,$2,$3) s',[action,JSON.stringify(data),id]))[0].s;
 const roster=async()=>(await q('select public.ludus_workers_roster_v226() s'))[0].s;
 const supply=async()=>(await q('select public.ludus_supply() s'))[0].s;
 await admin();
 const owners=[randomUUID(),randomUUID(),randomUUID()],clan=randomUUID();
 for(let i=0;i<owners.length;i++){
  await q('insert into public.ludus_accounts(user_id,gold,ludus_name) values($1,1000000,$2)',[owners[i],'License Ludus '+i]);
  await q("insert into public.ludus_gladiators(owner_id,name,class) values($1,'License fighter','murmillo')",[owners[i]]);
 }
 await q("insert into public.ludus_clans(id,name,leader_id) values($1,'Licenses',$2)",[clan,owners[0]]);
 for(const owner of owners.slice(0,2))await q('insert into public.ludus_clan_members(user_id,clan_id) values($1,$2)',[owner,clan]);
 const workers=[];for(const owner of owners){await identify(owner);await supply();workers.push((await roster()).workers.map(w=>w.id));}
 await admin();
 await q("insert into ludus_worker_private.skills_v227(worker_id,sku,xp) values($1,'iron_ore',600)",[workers[0][0]]);
 await identify(owners[0]);let before=await work('start',{sku:'iron_ore',workers:[workers[0][0]]},randomUUID());
 const legacy=before.jobs[0].id;
 await admin();await db.exec(migration('licensed_collection_v255'));
 await q('update ludus_worker_private.defense_config_v230 set enabled=false');
 assert.equal(Number((await q('select count(*) n from ludus_worker_private.professions_v227'))[0].n),16);
 assert.equal(Number((await q('select count(*) n from ludus_supply_private.market_goods_v116 where active'))[0].n),16);
 for(let n=5;n<=10;n++){
  const y=(await q('select ludus_worker_private.license_yield_v255($1) y',[n]))[0].y;
  assert.equal(y.gross,y.tax+y.net);assert.equal(y.tax*5,y.gross);assert.equal(y.net,40+(n-5)*8);
 }
 for(const f of ['license_yield_v255(integer)','deliver_licensed_owner_v255(uuid,timestamptz)','clan_tick_before_licenses_v255(timestamptz)','clan_work_before_licenses_v255(text,jsonb,uuid)']){
  const result=(await q("select has_function_privilege('authenticated',$1,'execute') a,has_function_privilege('anon',$1,'execute') b",['ludus_worker_private.'+f]))[0];assert.deepEqual(result,{a:false,b:false});
 }
 await q("update ludus_worker_private.clan_work_jobs_v232 set started_at=clock_timestamp()-interval '61 minutes',ends_at=clock_timestamp()-interval '1 minute' where id=$1",[legacy]);
 await q('select ludus_worker_private.clan_tick_v232(clock_timestamp())');
 assert.equal(Number((await q("select quantity from ludus_worker_private.clan_material_stock_v232 where clan_id=$1 and sku='iron_ore'",[clan]))[0].quantity),1,'legacy production retains its original destination');
 assert.equal(Number((await q('select count(*) n from ludus_worker_private.state_collections_v255'))[0].n),0,'no retrospective tax');
 const team=[workers[0][1],workers[0][2],workers[1][1],workers[1][2],workers[1][3]],xp=[600,900,1260,1680,2700],levels=[5,6,7,8,10];
 for(let i=0;i<team.length;i++)await q("insert into ludus_worker_private.skills_v227(worker_id,sku,xp) values($1,'iron_ore',$2),($1,'fish',$2)",[team[i],xp[i]]);
 await identify(owners[0]);let state=await work();assert.equal(state.rules_version,255);assert.equal(state.config.duration_minutes,360);assert.equal(state.config.team_limit,5);
 const prof=(await roster()).workers[1].skills;assert.equal(prof.length,16);assert.ok(prof.some(p=>p.sku==='fish'&&p.level===5));
 await reject(()=>work('start',{sku:'iron_ore',workers:team.slice(0,4)},randomUUID()),/tam 5/);
 await reject(()=>work('start',{sku:'iron_ore',workers:[...team,workers[0][3]]},randomUUID()),/tam 5/);
 await reject(()=>work('start',{sku:'iron_ore',workers:[team[0],team[0],...team.slice(2)]},randomUUID()),/farklı/);
 await reject(()=>work('start',{sku:'iron_ore',workers:[workers[2][0],...team.slice(1)]},randomUUID()),/bu klanın/);
 await reject(()=>work('start',{sku:'iron_ore',workers:[workers[0][3],...team.slice(1)]},randomUUID()),/en az 5/);
 await reject(()=>work('configure',{duration_minutes:1,team_limit:1}),/kuralı sabit/);
 await identify(owners[1]);await reject(()=>work('start',{sku:'iron_ore',workers:team},randomUUID()),/lideri/);await identify(owners[0]);
 const request=randomUUID(),payload={sku:'iron_ore',workers:team};state=await work('start',payload,request);
 const job=state.jobs.find(j=>j.rules_version===255);assert.ok(job);assert.equal(Date.parse(job.ends_at)-Date.parse(job.started_at),21600000);
 const expected=levels.map(level=>40+(level-5)*8),net=expected.reduce((a,b)=>a+b,0);
 assert.equal(job.quantity,net);assert.equal(job.gross_quantity,job.tax_quantity+job.quantity);assert.equal(job.tax_quantity*5,job.gross_quantity);
 assert.equal((await work('start',{...payload,workers:[...team].reverse()},request)).jobs.filter(j=>j.id===job.id).length,1);
 await reject(()=>work('start',{...payload,sku:'fish'},request),/farklı/);
 await reject(()=>work('start',payload,randomUUID()),/başka bir görevde/);
 const quote=await routeFor('iron_ore',4);
 await reject(()=>q("select public.ludus_worker_caravan_depart_v227('buy',$1,1,$2,array[$3]::uuid[],0,0,'{}'::uuid[])",[quote,randomUUID(),team[0]]),/klan çalışmasında/);
 await admin();await q('select ludus_worker_private.clan_tick_v232(clock_timestamp())');assert.equal((await q('select completed_at from ludus_worker_private.clan_work_people_v232 where job_id=$1 limit 1',[job.id]))[0].completed_at,null);
 await q("update ludus_worker_private.skills_v227 set xp=2700 where worker_id=$1 and sku='iron_ore'",[team[0]]);
 await q("insert into ludus_supply_private.stock(owner_id,sku,quantity) values($1,'iron_ore',50000) on conflict(owner_id,sku) do update set quantity=50000",[owners[1]]);
 await q('delete from public.ludus_clan_members where user_id=$1',[owners[1]]);
 await q("update ludus_worker_private.clan_work_jobs_v232 set started_at='2026-11-15 14:58:30+00',ends_at='2026-11-15 20:58:30+00' where id=$1",[job.id]);
 await q("select ludus_worker_private.clan_tick_v232('2026-11-15 20:58:31+00')");
 const ownNet=expected[0]+expected[1],otherNet=net-ownNet;
 assert.equal(Number((await q("select quantity from ludus_supply_private.stock where owner_id=$1 and sku='iron_ore'",[owners[0]]))[0].quantity),ownNet,'each owner receives only their frozen worker output');
 assert.equal(Number((await q("select quantity from ludus_supply_private.stock where owner_id=$1 and sku='iron_ore'",[owners[1]]))[0].quantity),50000,'full warehouse is not overfilled');
 assert.equal(Number((await q("select quantity from ludus_worker_private.state_collections_v255 where sku='iron_ore'"))[0].quantity),job.tax_quantity);
 assert.equal(Number((await q("select quantity from ludus_worker_private.clan_material_stock_v232 where clan_id=$1 and sku='iron_ore'",[clan]))[0].quantity),1,'licensed production never enters clan stock');
 await identify(owners[1]);state=await work();assert.equal(Number(state.pending_delivery.iron_ore),otherNet,'a departed clan member keeps personal proceeds');
 await admin();await q("update ludus_supply_private.stock set quantity=0 where owner_id=$1 and sku='iron_ore'",[owners[1]]);await identify(owners[1]);await roster();await roster();
 await admin();assert.equal(Number((await q("select quantity from ludus_supply_private.stock where owner_id=$1 and sku='iron_ore'",[owners[1]]))[0].quantity),otherNet,'pending delivery retries exactly once');
 await q("select ludus_worker_private.clan_tick_v232('2026-11-15 20:59:00+00')");await q("select ludus_worker_private.clan_tick_v232('2026-11-15 21:59:00+00')");
 const rewards=await q("select owner_id,quantity from ludus_worker_private.clan_work_rewards_v232 where clan_id=$1 and week_end='2026-11-15 20:59:00+00'",[clan]);
 assert.equal(rewards.length,2);assert.equal(Number(rewards.find(r=>r.owner_id===owners[1]).quantity),otherNet,'weekly gathered totals use net earned output, even while storage was full');
 assert.equal(Number((await q("select collected from ludus_worker_private.skills_v227 where worker_id=$1 and sku='iron_ore'",[team[0]]))[0].collected),expected[0]);
 // A three-hour food purchase carries at most 120, charges gold, trains its
 // chosen worker and never counts toward weekly gathering.
 await identify(owners[0]);const initial=await supply();assert.equal(initial.caravan_capacity,120);assert.equal(initial.shopping_seconds,10800);
 await reject(()=>q("select public.ludus_supply('send','grain',1,$1)",[randomUUID()]),/ücretsiz sefer kaldırıldı/);
 let purchaseKey=await routeFor('grain',121);await reject(()=>q("select public.ludus_worker_caravan_depart_v227('buy',$1,1,$2,array[$3]::uuid[],0,0,'{}'::uuid[])",[purchaseKey,randomUUID(),workers[0][4]]),/120/);
 purchaseKey=await routeFor('grain',120);const bought=(await q("select public.ludus_worker_caravan_depart_v227('buy',$1,1,$2,array[$3]::uuid[],0,0,'{}'::uuid[]) s",[purchaseKey,randomUUID(),workers[0][4]]))[0].s;
 const shopping=bought.jobs.find(j=>j.id===bought.result.job_id);assert.equal(Date.parse(shopping.ends_at)-Date.parse(shopping.started_at),10800000);assert.ok(bought.gold<initial.gold);
 await admin();await q("update ludus_supply_private.jobs set started_at=clock_timestamp()-interval '3 hours',ends_at=clock_timestamp()-interval '1 second' where id=$1",[shopping.id]);await identify(owners[0]);
 const trained=(await roster()).workers.find(w=>w.id===workers[0][4]).skills.find(s=>s.sku==='grain');assert.equal(trained.xp,120);assert.equal(Number(trained.delivered),120);assert.equal(Number(trained.collected),0);
 // Food work uses the dining warehouse and the same 20% cut; there is no
 // second tax on later consumption and no retroactive feeding of prior days.
 await admin();await q('insert into public.ludus_clan_members(user_id,clan_id) values($1,$2)',[owners[1],clan]);await identify(owners[0]);
 const foodStart=await work('start',{sku:'fish',workers:team},randomUUID()),foodJob=foodStart.jobs.find(j=>j.sku==='fish');
 await admin();await q("update ludus_worker_private.clan_work_jobs_v232 set started_at=clock_timestamp()-interval '6 hours',ends_at=clock_timestamp()-interval '1 second' where id=$1",[foodJob.id]);
 await q('select ludus_worker_private.clan_tick_v232(clock_timestamp())');
 assert.equal(Number((await q("select quantity from public.ludus_food_stock where owner_id=$1 and sku='fish'",[owners[0]]))[0].quantity),ownNet);
 assert.equal(Number((await q("select quantity from public.ludus_food_stock where owner_id=$1 and sku='fish'",[owners[1]]))[0].quantity),otherNet);
 await identify(owners[0]);await q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");await reject(()=>work(),/giriş yap/);await q("select set_config('request.jwt.claims','{}',false)");
 await reject(()=>q('select * from ludus_worker_private.state_collections_v255'),/permission denied/);
 await admin();
 console.log('V255 SQL PASS: 16 professions, exact five-worker/six-hour licenses, frozen 20% tax, per-owner stock, pending delivery, clan exit, food training and dining delivery, three-hour/120-unit purchases, legacy preservation, weekly net collection, authorization and replay.');
 return {db,q,migration,randomUUID,owners,workers,team,work,roster,supply,identify,admin,reject,routeFor};
 async function routeFor(sku,quantity){for(const c of (await supply()).cities){const quote=(await q('select public.ludus_caravan_city($1) s',[c.id]))[0].s;if(quote.goods.some(g=>g.sku===sku&&g.stock>=quantity))return[c.id,sku,quote.epoch,quantity].join(':');}throw Error('No quote for '+sku);}
};
