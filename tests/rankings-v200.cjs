const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),sql=fs.readFileSync(path.join(root,'supabase/migrations',fs.readdirSync(path.join(root,'supabase/migrations')).find(f=>f.endsWith('_imperial_rankings_v200.sql'))),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function fixture(){
 const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema auth;create schema ludus_career_private;create schema ludus_supply_private;create schema ludus_circus_private;
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;
 create table public.ludus_accounts(user_id uuid primary key,username text,ludus_name text);
 create table public.ludus_gladiators(id uuid primary key,owner_id uuid,name text,class text,overall numeric);
 create table public.ludus_items(id uuid primary key,owner_id uuid,equipped_by uuid,equipped_slot text,kind text,stat_version int,enhancement int,natural_stats jsonb,natural_percentages jsonb,emeralds jsonb,clan_vault_id uuid,market_listing_id uuid);
 create table public.ludus_clans(id uuid primary key,name text,emblem int,emblem_color text,background text);
 create table public.ludus_clan_members(user_id uuid primary key,clan_id uuid);
 create table public.ludus_clan_rosters(id uuid primary key,clan_id uuid,state text);
 create table public.ludus_clan_roster_entries(id uuid primary key,roster_id uuid,user_id uuid,gladiator_id uuid);
 create table public.ludus_matches(id uuid primary key,status text,players jsonb,starts_at timestamptz,winner uuid,updated_at timestamptz,venue text);
 create table ludus_career_private.battles(id uuid primary key,gladiator_id uuid,mode text,won boolean,stats jsonb,finished_at timestamptz);
 create table ludus_supply_private.raids_v124(id uuid primary key,owner_id uuid,gladiators uuid[],resolved_at timestamptz,success boolean,career_stats jsonb);
 create table ludus_supply_private.jobs(id uuid primary key,owner_id uuid,escort uuid[]);
 create table ludus_circus_private.heats(id uuid primary key,owner_id uuid,status text,entered boolean,winner int,finish_at timestamptz,paid_at timestamptz,created_at timestamptz);
 `);await db.exec(sql);return db;
}
async function run(){const db=await fixture();try{
 const A=id(1),B=id(2),C=id(3),G=id(11),G2=id(12),G3=id(13),CA=id(31),CB=id(32);
 for(const [u,name]of [[A,'Tırman'],[B,'Valerius'],[C,'Aurelia']])await db.query('insert into ludus_accounts values($1,$2,$3)',[u,name,name+' Ludus']);
 await db.query('insert into ludus_gladiators values($1,$2,$3,$4,80),($5,$6,$7,$4,60),($8,$2,$9,$4,60)',[G,A,'Maximus','murmillo',G2,B,'Spartacus',G3,'Vitus']);
 await db.query("insert into ludus_clans values($1,'Kartallar',1,'#d8b36d','#791c2a'),($2,'Aslanlar',3,'#ffffff','#172b41')",[CA,CB]);
 await db.query('insert into ludus_clan_members values($1,$2),($3,$4)',[A,CA,B,CB]);
 async function board(opts={}){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[A]);return(await db.query('select ludus_rankings_v200($1,$2,$3,$4,$5,$6,$7,$8,$9) data',[opts.scope||'players',opts.category||'gladiator',opts.group||'all',opts.sort||'score',opts.clan||null,opts.query||'',opts.page||0,opts.size||8,opts.target||null])).rows[0].data;}
 let b=await board();assert.equal(b.rows.find(r=>r.id===A).score,70);assert.equal(b.rows.find(r=>r.id===A).rank,1);assert.equal(b.rows.find(r=>r.id===C).score,null);
 assert.equal((await board({query:'Valer'})).rows[0].rank,2);assert.equal((await board({clan:CB})).rows[0].rank,1);
 const profile={weapon:[7,3,5,3,5,3],shield:[2,1,2,8,12,1],helmet:[4,2,3,4,4,4],chest:[8,4,4,6,6,6],gloves:[4,2,2,4,5,2],legs:[6,4,3,3,3,5]};
 const keys=[['physical_power','critical_rate','critical_damage','block_rate','block_power','armor_penetration'],['physical_defense','damage_reduction','critical_resistance','pierce_resistance','slash_resistance','projectile_resistance'],['acceleration','movement_speed','dodge_rate','recovery_speed','turn_speed','dodge_distance']];
 let index=0;for(const [kind,base]of Object.entries(profile)){
  const k=keys[Math.floor(index/2)],item={kind,stat_version:10,enhancement:15,natural_stats:Object.fromEntries(k.map((v,i)=>[v,base[i]])),natural_percentages:Object.fromEntries(k.map(v=>[v,100])),emeralds:[1,2,3,4].map(v=>({id:v,value:100}))};
  const score=async it=>{const v=(await db.query('select ludus_rank_private.item_score($1) s',[it])).rows[0].s;return v===null?null:Number(v);};
  assert.equal(await score(item),100);assert.ok(await score({...item,enhancement:16})>100);assert.equal(await score({...item,emeralds:[]}),60);
  assert.equal(await score({...item,enhancement:0,natural_percentages:{},emeralds:[]}),12);
  assert.equal(await score({...item,natural_stats:{}}),null);
  for(const [g,owner]of [[G,A],[G3,A],[G2,B]])await db.query('insert into ludus_items values($1,$2,$3,$4,$5,10,15,$6,$7,$8,null,null)',[id(100+index*3+[G,G3,G2].indexOf(g)),owner,g,['main_hand','off_hand','helmet','chest','gloves','legs'][index],kind,item.natural_stats,item.natural_percentages,item.emeralds]);index++;
 }
 for(const group of ['all','attack','defense','mobility']){b=await board({category:'equipment',group});assert.equal(b.rows.find(r=>r.id===A).score,100);}
 await db.query("update ludus_items set enhancement=3 where equipped_by=$1 and equipped_slot='main_hand'",[G]);
 assert.ok((await board({category:'equipment'})).rows.find(r=>r.id===A).score<100);
 // Team raids must count one win, not one per selected gladiator.
 await db.query('insert into ludus_supply_private.raids_v124 values($1,$2,$3,now(),true,$4)',[id(200),A,[G,G3],[{id:G,kills:2,deaths:0,assists:1},{id:G3,kills:1,deaths:1,assists:2}]]);
 await db.query('insert into ludus_supply_private.raids_v124 values($1,$2,$3,now(),false,null)',[id(199),B,[G2]]);
 await db.exec('update ludus_supply_private.raids_v124 set resolved_at=resolved_at');
 b=await board({category:'caravan'});let r=b.rows.find(r=>r.id===A);assert.equal(r.score,1);assert.equal(r.metrics.kills,3);assert.equal(r.metrics.assists,3);
 await db.query('insert into ludus_supply_private.jobs values($1,$2,$3)',[id(201),A,[G,G3]]);
 await assert.rejects(db.query('select ludus_caravan_defense_result_v200($1,true,null)',[id(201)]));
 await assert.rejects(db.query('select ludus_caravan_defense_result_v200($1,true,$2)',[id(201),[{id:G,kills:-1,deaths:0,assists:0},{id:G3,kills:0,deaths:0,assists:0}]]));
 await db.query('select ludus_caravan_defense_result_v200($1,true,$2)',[id(201),[{id:G,kills:1,deaths:0,assists:0},{id:G3,kills:0,deaths:0,assists:1}]]);
 assert.equal((await board({category:'caravan',group:'defense'})).own.score,1);assert.equal((await board({category:'caravan'})).own.score,2);assert.equal((await board({category:'caravan',group:'raid'})).own.score,1);
 // Historical missing telemetry stays unknown, not a fabricated zero.
 await db.query('insert into ludus_career_private.battles values($1,$2,$3,true,$4,now())',[id(210),G,'4x5',{game_mode:'naval4x5',kills:2,alive:true}]);
 b=await board({category:'naval'});assert.equal(b.own.score,10);assert.equal(b.own.metrics.assists,null);
 await db.query('insert into ludus_career_private.battles values($1,$2,$3,false,$4,now())',[id(211),G,'4x5',{game_mode:'naval4x5',kills:3,alive:false,assists:1}]);
 b=await board({category:'naval'});assert.equal(b.own.metrics.assists,null);assert.equal(b.own.metrics.kd_kills,5);assert.equal(b.own.metrics.kda_kills,3);assert.equal(b.own.metrics.kda_assists,1);assert.equal(b.own.metrics.tracked,1);
 await db.query("insert into ludus_circus_private.heats values($1,$2,'settled',true,3,now(),now(),now()),($3,$2,'settled',false,3,now(),now(),now())",[id(220),A,id(221)]);
 assert.equal((await board({category:'circus'})).own.score,1,'betting wins are not racing wins');
 const players=[{owner:A,gladiator:{id:G},career:{kills:1,deaths:0,assist_version:200},maxHp:100},{owner:B,gladiator:{id:G2},career:{kills:0,deaths:1,assist_version:200,killer:A,contributors:{[A]:100}},maxHp:100}];
 await db.query("insert into ludus_matches values($1,'finished',$2,now()-interval '1 minute',$3,now(),'arena')",[id(230),players,A]);
 await db.exec('update ludus_matches set status=status');
 b=await board({category:'multiplayer'});assert.equal(b.own.score,1520);assert.equal(b.rows.find(r=>r.id===B).score,1495);
 // K/D/A cannot alter rank, including ties.
 await db.query("insert into ludus_matches values($1,'finished',$2,now()-interval '1 minute',$3,now(),'arena')",[id(231),[{owner:B,gladiator:{id:G2},career:{kills:900,deaths:0}},{owner:A,gladiator:{id:G},career:{kills:0,deaths:99}}],B]);
 b=await board({category:'multiplayer'});assert.equal(b.rows.find(r=>r.id===A).rank,b.rows.find(r=>r.id===B).rank);
 await db.query("insert into ludus_clan_rosters values($1,$2,'locked'),($3,$4,'locked')",[id(301),CA,id(302),CB]);
 await db.query('insert into ludus_clan_roster_entries values($1,$2,$3,$4),($5,$6,$7,$8)',[id(311),id(301),A,G,id(312),id(302),B,G2]);
 const war=[{id:G,kills:1,deaths:0,assists:0},{id:G2,kills:0,deaths:1,assists:0}];
 await assert.rejects(db.query('select ludus_guild_result_v200($1,$2,$3,$4,null)',[id(320),id(301),id(302),CA]));
 await assert.rejects(db.query('select ludus_guild_result_v200($1,$2,$3,$4,$5)',[id(320),id(301),id(302),CA,[{...war[0],assists:1.5},war[1]]]));
 await db.query('select ludus_guild_result_v200($1,$2,$3,$4,$5)',[id(320),id(301),id(302),CA,war]);
 await db.query('select ludus_guild_result_v200($1,$2,$3,$4,$5)',[id(320),id(301),id(302),CA,war]);
 b=await board({scope:'clans'});assert.equal(b.own.score,1516);assert.equal(b.own.metrics.wins,1);b=await board({scope:'fighters'});assert.equal(b.own.score,1516);assert.equal(b.rows.length,2,'bench gladiator excluded');
 const hit=(await db.query('select ludus_career_private.hit($1,$2,40) p',[{owner:A,hp:100,career:{version:162,kills:0,damage:0}},{owner:B,hp:40,career:{version:162,assist_version:200,deaths:0,damageTaken:0,contributors:{}}}])).rows[0].p;
 assert.equal(hit[1].career.killer,A);assert.equal(hit[1].career.contributors[A],40);assert.equal(hit[0].career.kills,1);
 b=await board({query:'no-such-user',page:999});assert.equal(b.total,0);assert.equal(b.rows.length,0);assert.equal(b.page,0);assert.ok(b.own);
 assert.equal((await board({size:1,page:999})).page,2);assert.ok((await board({target:B})).profile);
 await db.exec('set role authenticated');assert.equal((await board()).version,200);
 await assert.rejects(db.query('select * from ludus_rank_private.events'));
 await assert.rejects(db.query('select ludus_guild_result_v200($1,$2,$3,$4,$5)',[id(321),id(301),id(302),CA,war]));
 await assert.rejects(db.query('select ludus_caravan_defense_result_v200($1,true,$2)',[id(201),[]]));
 await assert.rejects(board({sort:'kd'}));await db.exec('reset role;set role anon');await assert.rejects(db.query('select ludus_rankings_v200()'));
 await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await assert.rejects(db.query('select ludus_rankings_v200()'));
 console.log('PASS V200 rankings: 6 equipment kinds, fixed scale, all bonuses, roster averages, unique wins, raid/defense split, unknown assists, 1500 rating, ties independent of KDA, guild/fighter Elo, bench exclusion, idempotency, search ranks, paging and permissions.');
 }finally{await db.close();}}
if(require.main===module)run().catch(e=>{console.error(e.message,e.position||'',e.where||'');process.exitCode=1;});
module.exports={fixture,id};
