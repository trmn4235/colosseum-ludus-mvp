const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {database,runtime}=require('./combat-stats-v73.cjs'),uuid=()=>require('node:crypto').randomUUID();
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,'supabase/migrations',fs.readdirSync(path.join(root,'supabase/migrations')).find(f=>f.endsWith('_'+n+'.sql'))),'utf8');
async function setup(){
 const db=await database();await db.exec(read('survival_v83'));await require('./combat-motion-sql-v163.cjs').install(db);
 await db.exec("create table if not exists public.ludus_shop_catalog(sku text primary key,name text,kind text,model text,price integer,category text);create table ludus_supply_private.production_recipes_v118(sku text primary key,name text,kind text,model text,ingredients jsonb,output_type text,output_quantity int,sort_order int);create table ludus_supply_private.recipes(sku text primary key,ingredients jsonb);");
 for(const name of ['equipment_groups_v168','pit_arena_v172','pit_four_fighters_v173','pit_ten_fighters_v176','pit_bow_v178'])await db.exec(read(name));return db;
}
function simulation(ticket){
 const c=runtime();for(const file of ['pit-round-v176.js','pit-arena-v172.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
 const sim=new c.ArenaCombat(()=>.5).reset('normal','secutor','pit');c.LudusLoadout.initialize(sim,ticket);c.PitArena.install(sim,ticket);sim.botStep=()=>{};return {sim,c};
}
(async()=>{const db=await setup();try{
 const q=async(s,a=[])=>(await db.query(s,a)).rows,u=uuid(),other=uuid(),g=uuid(),mate=uuid(),foreign=uuid();
 for(const id of [u,other])await q('insert into ludus_accounts(user_id,username,ludus_name,gold) values($1::uuid,$1::text,$2,2000)',[id,id===u?'Tırman':'Other']);
 for(const [id,owner,name]of [[g,u,'Cassius'],[mate,u,'Severus'],[foreign,other,'Nero']])await q("insert into ludus_gladiators(id,owner_id,name,class,status,stat_version,base_stats)values($1,$2,$3,'secutor','available',46,$4)",[id,owner,name,{attack_technique:50,defense_technique:50,muscle:50,speed:50,reflex:50,conditioning:50,tactics:50}]);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[u]);
 await q('set role authenticated');const state=(await q('select ludus_pit() r'))[0].r;await q('reset role');assert.equal(state.lineups['1x10'].length,9);assert.equal(state.lineups['2x5'].length,8);assert.ok(state.roster.every(g=>g.ready));
 const start=async(slots,req=uuid())=>(await q("select ludus_start_battle_v2($1,'pit',$2,$3) r",[g,slots,req]))[0].r;
 const one={pit_mode:'1x10',pit_weapon:'pit_stone_mace'},two={pit_mode:'2x5',pit_weapon:'pit_stone_mace',teammate:mate,teammate_weapon:'pit_wood_mace'};
 await assert.rejects(()=>start({...one,pit_mode:'online'}),/Geçersiz/);
 await assert.rejects(()=>start({...two,teammate:g}),/farklı/);
 await assert.rejects(()=>start({...two,teammate:foreign}),/Hazır/);
 await assert.rejects(()=>start({...two,teammate_weapon:'gladius'}),/gürz/);
 await assert.rejects(()=>start({...one,main_hand:uuid()}),/yalnızca/);
 await q("update ludus_gladiators set injured_until=now()+interval '1 hour' where id=$1",[mate]);
 await assert.rejects(()=>start(two),/Hazır/);await q('update ludus_gladiators set injured_until=null where id=$1',[mate]);
 const req=uuid(),first=await start(one,req);assert.equal((await start(one,req)).id,first.id);await assert.rejects(()=>start(two,req),/kimliği/);
 const ticket=(await q('select * from ludus_battles where id=$1',[first.id]))[0];assert.equal(ticket.snapshot.pit_roster.length,10);assert.deepEqual(ticket.snapshot.pit_roster.slice(1),state.lineups['1x10']);assert.equal(ticket.loot.length,10);
 const {sim,c}=simulation(ticket);assert.equal(sim.fighters.filter(f=>f.hp>0).length,4);assert.equal(sim.fighters.filter(f=>f.pitWaiting).length,6);assert.match(c.PitRound.score(sim),/4\/10/);assert.equal(c.PitRound.stats(sim).opponents_defeated,0);
 sim.fighters[1].hp=0;sim.tick(.05);assert.equal(sim.pitRound.entered,5);assert.ok(sim.fighters[4].hp>0);assert.equal(sim.finished,false);
 sim.fighters[2].hp=sim.fighters[3].hp=sim.fighters[4].hp=0;sim.tick(.05);assert.equal(sim.finished,false,'waiting entrants prevent an early win');
 for(let i=0;i<120;i++){for(const f of sim.fighters.slice(1))if(!f.pitWaiting)f.hp=0;sim.tick(.05);}
 assert.equal(sim.pitRound.entered,10);assert.equal(sim.result,'win');assert.equal(c.PitRound.stats(sim).opponents_defeated,9);
 assert.equal(sim.events.filter(e=>e.type==='pitentry').length,6);assert.equal(new Set(sim.events.filter(e=>e.type==='pitentry').map(e=>e.id)).size,6);
 const loss=simulation(ticket).sim;loss.fighters[0].hp=0;loss.tick(.05);assert.equal(loss.result,'loss');
 const stats={...c.PitRound.stats(sim),kills:2,alive:true},finish=async(id,st)=>(await q('select ludus_finish_battle_v2($1,true,$2) r',[id,st]))[0].r;
 await assert.rejects(()=>finish(first.id,stats),/doğrulanamadı/);await q("update ludus_battles set started_at=now()-interval '30 seconds' where id=$1",[first.id]);
 await assert.rejects(()=>finish(first.id,{...stats,entrants:4}),/doğrulanamadı/);await assert.rejects(()=>finish(first.id,{...stats,opponents_defeated:3}),/doğrulanamadı/);
 const prize=await finish(first.id,stats);assert.equal(prize.fame,1);assert.deepEqual(await finish(first.id,stats),prize);
 const second=await start(two),teamTicket=(await q('select * from ludus_battles where id=$1',[second.id]))[0];assert.deepEqual(teamTicket.snapshot.pit_roster.slice(2),state.lineups['2x5']);assert.equal(teamTicket.snapshot.teammate.id,mate);
 const team=simulation(teamTicket);assert.equal(team.sim.fighters.filter(f=>f.hp>0).length,10);assert.equal(new Set(team.sim.fighters.map(f=>f.team)).size,5);assert.equal(team.sim.enemy(team.sim.fighters[0],team.sim.fighters[1]),false);assert.equal(team.sim.fighters[1].pitWeapon,'pit_wood_mace');
 team.sim.fighters[0].hp=0;team.sim.tick(.05);assert.equal(team.sim.finished,false);for(const f of team.sim.fighters.slice(2))f.hp=0;team.sim.tick(.05);assert.equal(team.sim.result,'win');
 const teamStats={...team.c.PitRound.stats(team.sim),kills:0,alive:false};assert.equal(teamStats.opponents_defeated,8);await q("update ludus_battles set started_at=now()-interval '30 seconds' where id=$1",[second.id]);
 await assert.rejects(()=>finish(second.id,{...teamStats,team_alive:0}),/doğrulanamadı/);
 const teamPrize=await finish(second.id,teamStats);assert.equal(teamPrize.fame,1);assert.equal(teamPrize.teammate_fame,1);await finish(second.id,teamStats);assert.equal((await q('select points from ludus_pit_private.fame where gladiator_id=$1',[mate]))[0].points,1);
 const legacy=await start({pit_weapon:'pit_stone_mace'});assert.equal(legacy.snapshot.pit_version,173);await q("update ludus_battles set started_at=now()-interval '30 seconds' where id=$1",[legacy.id]);assert.equal((await finish(legacy.id,{opponents_defeated:3,kills:1,alive:true})).fame,1);
 const bowStart=await start({...two,pit_weapon:'pit_bow',teammate_weapon:'pit_bow'}),bowTicket=(await q('select * from ludus_battles where id=$1',[bowStart.id]))[0];assert.equal(bowTicket.snapshot.items[0].pit_model,'pit_bow');assert.equal(bowTicket.loot[1].item.pit_model,'pit_bow');assert.deepEqual(await start({...two,pit_weapon:'pit_bow',teammate_weapon:'pit_bow'},bowTicket.start_request_id),bowStart);
 const permissions=(await q("select has_function_privilege('authenticated','ludus_pit_private.start(uuid,jsonb,uuid)','EXECUTE') s,has_function_privilege('authenticated','ludus_pit_private.lineup(text)','EXECUTE') l"))[0];assert.deepEqual(permissions,{s:false,l:false});
 fs.writeFileSync('/tmp/pit-fixtures-v176.json',JSON.stringify({user:u,g:ticket.snapshot.gladiator,mate:teamTicket.snapshot.teammate,state,tickets:[ticket,teamTicket,bowTicket]}));
 console.log('V176 PASS: sequential entrants; no premature victory; five allied pairs; teammate can win; actual lineups; ownership, readiness, per-fighter weapons, replay safety, legacy and both fame awards.');
}finally{await db.close();}})().catch(e=>{console.error(e.message,e.where,e.stack);process.exitCode=1;});
