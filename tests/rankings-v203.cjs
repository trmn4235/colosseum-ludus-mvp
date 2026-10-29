const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixture,id}=require('./rankings-v200.cjs');
const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261029193756_imperial_rankings_v203.sql'),'utf8');
async function run(){const db=await fixture();try{
 const A=id(1),B=id(2),C=id(3),G=id(11),G2=id(12),H=id(13),CL=id(31);let itemID=100;
 for(const [u,name]of [[A,'Tırman'],[B,'Valerius'],[C,'Aurelia']])await db.query('insert into ludus_accounts values($1,$2,$3)',[u,name,name+' Ludus']);
 await db.query("insert into ludus_gladiators values($1,$2,'Maximus','murmillo',80),($3,$2,'Vitus','secutor',60),($4,$5,'Spartacus','thraex',70)",[G,A,G2,H,B]);
 await db.query("insert into ludus_clans values($1,'Kartallar',1,'#b89957','#651c2b');",[CL]);await db.query('insert into ludus_clan_members values($1,$2)',[A,CL]);
 // Existing recorded Colosseum result must be backfilled once; misleading pit telemetry excluded.
 await db.query("insert into ludus_career_private.battles values($1,$2,'solo20',true,$3,now()),($4,$2,'pit',true,$3,now())",[id(201),G,{game_mode:'solo20',kills:2,alive:true},id(202)]);
 await db.exec(migration);
 async function board(o={}){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);return(await db.query('select ludus_rankings_v203($1,$2,$3,$4,$5,$6,$7,$8,$9) data',[o.scope||'players',o.category||'power',o.group||'all',o.sort||'score',o.clan||null,o.query||'',o.page||0,o.size||8,o.target||null])).rows[0].data;}
 const kinds=['weapon','shield','helmet','chest','gloves','legs'],slots=['main_hand','off_hand','helmet','chest','gloves','legs'];
 const profiles=[[7,3,5,3,5,3],[2,1,2,8,12,1],[4,2,3,4,4,4],[8,4,4,6,6,6],[4,2,2,4,5,2],[6,4,3,3,3,5]];
 const keys=[['physical_power','critical_rate','critical_damage','block_rate','block_power','armor_penetration'],['physical_defense','damage_reduction','critical_resistance','pierce_resistance','slash_resistance','projectile_resistance'],['acceleration','movement_speed','dodge_rate','recovery_speed','turn_speed','dodge_distance']];
 async function equip(g,u,values){for(let i=0;i<6;i++){const k=keys[Math.floor(i/2)],v=values[Math.floor(i/2)];await db.query('insert into ludus_items values($1,$2,$3,$4,$5,10,15,$6,$7,$8,null,null)',[id(itemID++),u,g,slots[i],kinds[i],Object.fromEntries(k.map((key,n)=>[key,profiles[i][n]*v/100])),Object.fromEntries(k.map(key=>[key,100])),[1,2,3,4].map(n=>({id:n,value:v}))]);}}
 await equip(G,A,[100,20,20]);await equip(G2,A,[20,100,100]);await equip(H,B,[60,60,60]);
 let b=await board();assert.equal(b.version,203);assert.equal(b.own.gladiator.id,G2);assert.equal(b.own.score,70);assert.equal(b.own.stats.gladiator,60);assert.equal(b.own.stats.attack,20);assert.equal(b.own.stats.defense,100);assert.equal(b.own.stats.mobility,100);
 assert.equal(b.rows.find(r=>r.id===B).score,62.5);assert.equal(b.rows.find(r=>r.id===C).rank,null);
 for(const [group,g,score]of [['gladiator',G,80],['attack',G,100],['defense',G2,100],['mobility',G2,100]]){b=await board({group});assert.equal(b.own.gladiator.id,g);assert.equal(b.own.score,score);assert.equal(b.own.stats.power,g===G?55:70);}
 assert.equal((await board({query:'Valer'})).rows[0].rank,2);assert.equal((await board({query:'Vitus'})).rows[0].id,A);assert.equal((await board({clan:CL})).total,1);
 // Recruiting an unequipped weak fighter cannot dilute the representative.
 await db.query("insert into ludus_gladiators values($1,$2,'Recruit','murmillo',10)",[id(14),A]);assert.equal((await board()).own.score,70);
 // Unknown item stats invalidate only their group, not unrelated groups or other gladiators.
 await db.query("insert into ludus_gladiators values($1,$2,'Veteran','scissor',95)",[id(15),A]);await equip(id(15),A,[100,33,44]);
 await db.query("update ludus_items set natural_stats='{}' where equipped_by=$1 and equipped_slot='main_hand'",[id(15)]);
 b=await board({group:'gladiator'});assert.equal(b.own.score,95);assert.equal(b.own.stats.attack,null);assert.equal(b.own.stats.defense,33);assert.equal(b.own.stats.mobility,44);assert.equal(b.own.stats.power,null);assert.equal((await board()).own.score,70);
 // Empty slot counts as zero; inventory, another owner's gear, vault and sale items do not count.
 await db.query("update ludus_items set equipped_by=null where equipped_by=$1 and equipped_slot='legs'",[H]);assert.equal((await board({group:'mobility'})).rows.find(r=>r.id===B).score,30);
 await db.query("update ludus_items set clan_vault_id=$1 where equipped_by=$2 and equipped_slot='main_hand'",[CL,H]);assert.equal((await board({group:'attack'})).rows.find(r=>r.id===B).score,30);
 await db.query("update ludus_items set market_listing_id=$1 where equipped_by=$2 and equipped_slot='off_hand'",[id(50),H]);assert.equal((await board({group:'attack'})).rows.find(r=>r.id===B).score,0);
 await db.query("update ludus_items set owner_id=$1 where equipped_by=$2 and equipped_slot='helmet'",[A,H]);assert.equal((await board({group:'defense'})).rows.find(r=>r.id===B).score,30);
 // Backfill + trigger are idempotent, and neither pit nor survival is Colosseum.
 b=await board({category:'colosseum'});assert.equal(b.own.score,1520);assert.equal(b.own.metrics.wins,1);assert.equal(b.own.metrics.assists,null);
 await db.exec('select ludus_rank_private.archive_colosseum_v203(to_jsonb(b)) from ludus_career_private.battles b');assert.equal((await board({category:'colosseum'})).own.metrics.matches,1);
 await db.query("insert into ludus_career_private.battles values($1,$2,'4x5',false,$3,now()),($4,$2,'survival',true,$5,now())",[id(203),G,{game_mode:'4x5',kills:3,alive:false,assists:1},id(204),{kills:100,alive:true,assists:10}]);
 b=await board({category:'colosseum'});assert.equal(b.own.score,1515);assert.equal(b.own.metrics.matches,2);assert.equal(b.own.metrics.losses,1);assert.equal(b.own.metrics.kd_kills,5);assert.equal(b.own.metrics.tracked,1);
 // Naval has its own 1500 baseline and losses reduce that rating independently.
 assert.equal((await board({category:'naval'})).own.score,1500);
 await db.query("insert into ludus_career_private.battles values($1,$2,'4x5',true,$3,now()),($4,$2,'4x5',false,$5,now())",[id(205),G,{game_mode:'naval4x5',kills:4,alive:true,assists:2},id(206),{game_mode:'naval4x5',kills:1,alive:false,assists:1}]);
 b=await board({category:'naval'});assert.equal(b.own.score,1515);assert.equal(b.own.metrics.rating,1515);assert.equal(b.own.metrics.wins,1);assert.equal(b.own.metrics.losses,1);assert.equal(b.own.metrics.kills,5);assert.equal(b.own.metrics.assists,3);
 assert.equal((await board({category:'colosseum'})).own.metrics.matches,2);
 // Online arena goes into Colosseum; preserve the legacy reader's point format.
 const players=[{owner:A,gladiator:{id:G},career:{kills:1,deaths:0,assist_version:200}},{owner:B,gladiator:{id:H},career:{kills:0,deaths:1,assist_version:200,killer:A}}];
 await db.query("insert into ludus_matches values($1,'finished',$2,now()-interval '1 minute',$3,now(),'arena')",[id(210),players,A]);
 b=await board({category:'colosseum'});assert.equal(b.own.score,1535);assert.equal(b.own.metrics.matches,3);assert.equal(b.own.metrics.wins,2);
 assert.equal((await db.query("select ludus_rankings_v200('players','multiplayer') d")).rows[0].d.own.score,1520);
 b=await board({category:'naval',sort:'wins'});assert.equal(b.own.score,1);assert.equal(b.own.metrics.rating,1515);
 // Equal score ranks must ignore K/D, K/D/A and match count entirely.
 await db.query("insert into ludus_career_private.battles values($1,$2,'4x5',true,$3,now()),($4,$2,'4x5',false,$3,now())",[id(207),H,{game_mode:'naval4x5',kills:900,alive:true,assists:900},id(208)]);
 b=await board({category:'naval'});assert.equal(b.rows.find(r=>r.id===A).rank,b.rows.find(r=>r.id===B).rank);assert.equal((await board({category:'naval',sort:'wins'})).rows.filter(r=>r.rank===1).length,2);
 // One team battle is one win, with the participants' K/D/A combined.
 await db.query('insert into ludus_supply_private.raids_v124 values($1,$2,$3,now(),true,$4)',[id(220),A,[G,G2],[{id:G,kills:2,deaths:0,assists:1},{id:G2,kills:1,deaths:1,assists:2}]]);
 await db.query('insert into ludus_supply_private.jobs values($1,$2,$3)',[id(221),A,[G]]);
 await db.query('select ludus_caravan_defense_result_v200($1,false,$2)',[id(221),[{id:G,kills:1,deaths:1,assists:1}]]);
 b=await board({category:'caravan'});assert.equal(b.own.score,1);assert.equal(b.own.metrics.losses,1);assert.equal(b.own.metrics.kills,4);assert.equal(b.own.metrics.assists,4);
 assert.equal((await board({category:'caravan',group:'raid'})).own.metrics.matches,1);assert.equal((await board({category:'caravan',group:'defense'})).own.metrics.wins,0);
 await db.query("insert into ludus_circus_private.heats values($1,$2,'settled',true,3,now(),now(),now()),($3,$2,'settled',false,3,now(),now(),now())",[id(230),A,id(231)]);
 assert.equal((await board({category:'circus'})).own.score,1);
 assert.equal((await board({scope:'clans'})).own.score,1500);assert.equal((await board({scope:'fighters'})).rows.length,0);
 assert.equal((await board({size:1,page:999})).page,2);assert.equal((await board({target:B})).profile.id,B);assert.ok((await board({query:'none'})).own);
 await db.exec('set role authenticated');assert.equal((await board()).version,203);
 await assert.rejects(board({sort:'kd'}));await assert.rejects(board({sort:'kda'}));await assert.rejects(board({category:'power',group:'raid'}));
 await assert.rejects(db.query('select * from ludus_rank_private.events'));await assert.rejects(db.query("select ludus_rank_private.archive_colosseum_v203('{}')"));
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select ludus_rankings_v203()'));
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(db.query('select ludus_rankings_v203()'));
 console.log('PASS V203: same-gladiator four-component power, best representative per measure, equipped-only groups, missing stats, independent 1500 ratings, Colosseum backfill/venues, wins/losses, KDA-independent ties, caravan defense, championships, legacy compatibility and permissions.');
 }finally{await db.close();}}
run().catch(e=>{console.error(e);process.exitCode=1;});
