// Independent V290 acceptance tests against the released Ranked SQL stack.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite');
const {setup,migration}=require('./fixtures/ranked-staff-v290.cjs');
const trainer=[1,2,3,5,6,7,8,9,10,11,12,13,14,15,16,17,18,20,21,22,23,24,25].map(n=>'doctore_'+String(n).padStart(3,'0'));
const chef=[1,3,4,5,6,7,8,9,10,11,12,14,15,17,18,19,20,21,22,23,24,25].map(n=>'chef_'+String(n).padStart(3,'0'));
const supported=[...trainer,...chef],clone=structuredClone;
const near=(actual,expected,label='')=>assert.ok(Math.abs(Number(actual)-expected)<1e-7,`${label}: ${actual} != ${expected}`);
const stamp=Date.parse('2026-11-23T12:00:00Z'),at=(seconds=0)=>new Date(stamp+seconds*1000).toISOString();
const weapon=(model='gladius',hand='main_hand')=>({id:randomUUID(),kind:'weapon',model,equipped_slot:hand,enhancement:0});
const shield=(model='large')=>({id:randomUUID(),kind:'shield',model,equipped_slot:'off_hand',enhancement:0});
function fighter(owner,options={}){
 const profile={id:randomUUID(),owner_id:owner,class:'secutor',overall:50,level:1,stat_version:7,base_stats:{health:50,stamina:50,strength:50,defense:50,agility:50,speed:50}};
 return {owner,ranked_team:'a',ranked_joined:true,class:'secutor',name:'Test gladiator',gladiator:profile,items:[weapon()],
  stats_version:77,combat_stats:{attack:1,native_attack:1,defense:1,speed:1,agility:50,maxHp:100,maxStamina:100,items:{}},
  hp:100,maxHp:100,stamina:100,maxStamina:100,x:0,z:0,angle:0,serial:0,pull_serial:0,move:0,block:false,
  tick_at:at(-.1),stamina_at:at(-1),seen:at(-.1),career:{version:162,assist_version:200,kills:0,deaths:0,damage:0,damageTaken:0,contributors:{}},...options};
}
function stripStaff(value){if(Array.isArray(value))return value.map(stripStaff);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!k.startsWith('staff_ranked')).map(([k,v])=>[k,stripStaff(v)]));return value;}
(async()=>{
 const db=new PGlite();let checks=0;
 try{
  const {catalog}=await setup(db),q=async(sql,args=[])=>(await db.query(sql,args)).rows;
  const one=async(sql,args=[])=>{checks++;return(await q(sql,args))[0].r;};
  const owners=Array.from({length:12},()=>randomUUID());
  for(let n=0;n<owners.length;n++)await q('insert into ludus_accounts(user_id,username,ludus_name)values($1,$2,$3)',[owners[n],'staff-'+n,'Ludus '+n]);
  const learn=async(owner,ids)=>{for(const id of ids)await q('insert into ludus_staff_private.knowledge_v288(owner_id,content_id)values($1,$2)on conflict do nothing',[owner,id]);};
  const pair=()=>[fighter(owners[0]),fighter(owners[1],{ranked_team:'b',z:1.5,angle:Math.PI})];
  const input=(players,command,time=at())=>one('select ludus_ranked_match_private.apply_input_v252($1,0,$2,$3)r',[players,command,time]);
  const resolve=(players,time=at())=>one('select ludus_ranked_match_private.resolve_combat_v248($1,$2)r',[players,time]);
  const shots=(players,time=at())=>one('select ludus_ranked_match_private.projectiles_v248($1,$2)r',[players,time]);
  let migrated=false;
  const advance=(players,time=at())=>one('select '+(migrated?'ludus_staff_private.ranked_advance_v290':'private.ludus_advance_combat_v36')+'($1,$2)r',[players,time]);
  const special=(players,time=at())=>one('select private.ludus_resolve_special_v261($1,$2)r',[players,time]);
  const hit=(a,v,w='gladius',base=100,critical=.9,damage=1,projectile=false,region='chest',normal=true,secondary=false)=>one('select ludus_staff_private.ranked_hit_v290($1,$2,$3,\'main_hand\',$4,$5,$6,$7,$8,$9,$10)r',[a,v,w,base,critical,damage,projectile,region,normal,secondary]);
  const snap=async(players,{status='playing',venue='ranked',starts=at()}={})=>(await q('insert into ludus_matches(players,status,venue,starts_at)values($1,$2,$3,$4)returning id,players',[players,status,venue,starts]))[0];
  const seeded=async(fn)=>{await q('select setseed(.271)');const value=await fn();const next=(await q('select random() n'))[0].n;return{value,next};};
  const baselineCases=[];
  for(const model of ['gladius','spear','trident','warhammer','whip','halberd','mace']){
   const p=pair();p[0].items=[weapon(model)];baselineCases.push({name:'normal '+model,run:()=>input(p,{attack:true,attack_id:'baseline',region:'chest'})});
  }
  for(const [model,hand]of [['gladius','main_hand'],['spear','main_hand'],['net','off_hand'],['whip','main_hand'],['halberd','main_hand'],['mace','main_hand'],['shield','off_hand']]){
   const p=pair();p[0].items=model==='shield'?[weapon(),shield()]:[weapon(model,hand)];baselineCases.push({name:'special '+model,run:()=>input(p,{special:true,special_id:'baseline',hand,target:p[1].owner})});
  }
  {const p=pair();Object.assign(p[0],{strike_at:at(-.1),swing_at:at(-.4),strike_target:p[1].owner,strike_weapon:'gladius',strike_hand:'main_hand',strike_region:'chest'});baselineCases.push({name:'damage/RNG',run:()=>resolve(p)});}
  {const p=pair();p[0].stamina=45;baselineCases.push({name:'regeneration',run:()=>advance(p)});}
  for(const c of baselineCases)c.before=await seeded(c.run);
  const old=await snap(pair());
  if(process.argv.includes('--baseline-only')){console.log('PASS V290 fixture: genuine V261 normal/special input, damage, regeneration and old Ranked snapshot baselines.');return;}
  await db.exec(migration('_ranked_papyrus_v290.sql'));
  migrated=true;
  assert.equal((await q('select enabled from ludus_staff_private.deployment_v290'))[0].enabled,false,'Deployment stays disabled until the compatible client is released');
  const gated=await snap(pair());assert.equal(gated.players[0].staff_ranked_v290,undefined,'Disabled deployment creates no new snapshots');
  for(const role of ['anon','authenticated','service_role']){
   await db.exec('set role '+role);
   try{await assert.rejects(q('update ludus_staff_private.deployment_v290 set enabled=true'),/permission denied/);await assert.rejects(q("select ludus_staff_private.ranked_effect_v290('{}','chef_001')"),/permission denied/);}finally{await db.exec('reset role');}
  }
  await db.exec('update ludus_staff_private.deployment_v290 set enabled=true where singleton');
  for(const c of baselineCases){const after=await seeded(c.run);assert.deepEqual(stripStaff(after),stripStaff(c.before),'Unlearned legacy output/RNG preserved: '+c.name);}
  assert.deepEqual((await q('select players from ludus_matches where id=$1',[old.id]))[0].players,old.players,'Existing open matches are never retrofitted');

  // Every actor receives only their own learned entries; unread holdings confer no bonus.
  const allLearning=catalog.filter(r=>['trainer','cook'].includes(r.role_id)).map(r=>r.content_id);
  await learn(owners[0],allLearning);await learn(owners[1],['chef_001']);
  await q("insert into ludus_staff_private.holdings_v288(owner_id,content_id,quantity)values($1,'doctore_002',7)",[owners[2]]);
  let p=[...pair(),fighter(owners[2],{bot_v249:true,ranked_team:'b',z:2})];
  p[0].staff_ranked_v290={version:290,owner:owners[1],effects:{doctore_002:.99}};p[0].staff_ranked_state_v290={once:['chef_025']};
  let frozen=await snap(p);p=frozen.players;
  assert.deepEqual(Object.keys(p[0].staff_ranked_v290.effects).sort(),supported.slice().sort(),'Exact23Doctore/22Chef scope');
  for(const id of supported)near(p[0].staff_ranked_v290.effects[id],catalog.find(r=>r.content_id===id).effect.value,id+' uses approved rate');
  assert.equal(p[0].staff_ranked_v290.owner,owners[0]);assert.deepEqual(Object.keys(p[1].staff_ranked_v290.effects),['chef_001']);assert.deepEqual(p[2].staff_ranked_v290.effects,{});
  assert(!p[0].staff_ranked_state_v290.once.includes('chef_025'),'Supplied event state cannot claim an event already ran');
  near(p[0].maxStamina,100.6,'maximum receives .2%+.4% once');near(p[1].maxStamina,100.2);
  await learn(owners[2],['doctore_002']);
  assert.deepEqual((await q('select players from ludus_matches where id=$1',[frozen.id]))[0].players,p,'Learning during a match cannot change its snapshot');
  const otherMode=await snap(pair(),{venue:'colosseum'});assert.equal(otherMode.players[0].staff_ranked_v290,undefined,'Non-Ranked rooms stay outside this feature');
  const saved=clone(p[0]),withIds=(ids,extra={})=>({...fighter(owners[0]),...extra,staff_ranked_v290:{version:290,owner:owners[0],started_at:at(),effects:Object.fromEntries(ids.map(id=>[id,catalog.find(row=>row.content_id===id).effect.value]))},staff_ranked_state_v290:{started_at:at(),once:[],normal_hits:0,blocks:[]}});
  const enemy=()=>fighter(owners[1],{ranked_team:'b',z:1.5,angle:Math.PI});

  // Eligibility and payment use the same discounted amount, on normal and V261 paths.
  for(const [model,id]of [['gladius','doctore_003'],['halberd','doctore_020'],['trident','doctore_023']]){
   const a=withIds([id,'chef_003','chef_011'],{items:[weapon(model)],stamina:12.9});
   const after=await input([a,enemy()],{attack:true,attack_id:'normal-'+model});assert.equal(after[0].serial,1);near(after[0].stamina,12.9-13*.99,model+' normal cost');
   const rejected=await input([{...a,stamina:12.86},enemy()],{attack:true,attack_id:'low-'+model});assert.equal(rejected[0].serial,0);
  }
  for(const [model,hand,id]of [['net','off_hand','doctore_008'],['whip','main_hand','doctore_009'],['spear','main_hand','doctore_017'],['trident','main_hand','doctore_018'],['mace','main_hand','doctore_006'],['warhammer','main_hand','doctore_021'],['shield','off_hand','doctore_022']]){
   const a=withIds([id,'chef_006','chef_015'],{items:model==='shield'?[weapon(),shield()]:[weapon(model,hand)],stamina:25.8}),b=enemy();
   const after=await input([a,b],{special:true,special_id:'special-'+model,hand,target:b.owner});assert(after[0].special_v261,model+' special accepted below old26threshold');near(after[0].stamina,25.8-26*.99,model+' special cost');
   assert.equal((await input([{...a,stamina:25.73},b],{special:true,special_id:'short-'+model,hand,target:b.owner}))[0].special_v261,undefined);
  }
  {const a=withIds(['doctore_003','chef_003','chef_011']),b=enemy();a.stamina=19.4;let arr=await input([a,b],{special:true,special_id:'double',hand:'main_hand',target:b.owner});near(arr[0].stamina,19.4-13*.99);arr=await special(arr,at(.6));near(arr[0].stamina,19.4-19.5*.99,'double second payment uses same discount');}
  {const a=withIds(['chef_005','chef_012'],{stamina:24.9});const arr=await input([a,enemy()],{dodge:true,dodge_id:'roll',dodge_kind:'roll',x:1,z:0});near(arr[0].stamina,24.9-25*.994);assert.equal(arr[0].dodge_kind,'roll');
   for(const kind of ['step','duck','jump']){const result=await input([{...a,stamina:50},enemy()],{dodge:true,dodge_id:kind,dodge_kind:kind,x:1,z:0});near(result[0].stamina,50-(kind==='jump'?22:18),kind+' is not a roll');}}

  // Final rounding comes after relative damage; critical chance is percentage points.
  for(const [model,id]of [['spear','doctore_002'],['warhammer','doctore_007'],['whip','doctore_024'],['mace','doctore_025']]){
   const a=withIds([id],{items:[weapon(model)],x:0,z:0}),b=enemy();b.z=2;
   const result=await hit(a,b,model,100.4);assert.equal(result.damage,101,model+' multiplies100.4 before rounding');
   assert.equal((await hit({...a,staff_ranked_v290:undefined},b,model,100.4)).damage,100);
  }
  {const a=withIds(['doctore_001'],{items:[weapon('trident')]}),b=enemy();b.z=2;a.combat_stats.items.critical_rate=10;
   assert.equal((await hit(a,b,'trident',100,.101)).critical,true);assert.equal((await hit(a,b,'trident',100,.102)).critical,false);assert.equal((await hit(a,b,'gladius',100,.101)).critical,false);}
  {const a=withIds(['doctore_016']),b=enemy();a.combat_stats.items.critical_rate=35;assert.equal((await hit(a,b,'gladius',100,0)).damage,151,'Critical damage is relative1.004, not+.4to multiplier');}

  // Event state is server-owned, match-local and never pays the same first-event twice.
  const event=(a,kind,seconds=0,data={})=>one('select ludus_staff_private.ranked_event_v290($1,$2,$3,$4)r',[a,kind,at(seconds),data]);
  for(const [id,kind,gain]of [['chef_018','stand_up',.2],['chef_019','kill',.4],['chef_024','assist',.2]]){
   let a=withIds([id],{stamina:50});a=await event(a,kind);near(a.stamina,50+gain,id);a=await event(a,kind,1);near(a.stamina,50+gain,id+' once');
   near((await event(withIds([id],{hp:0,stamina:50}),kind)).stamina,50,'Dead actor cannot regain condition');
  }
  {let a=withIds(['chef_020','chef_023'],{stamina:10});a=await event(a,'block',0,{pre_stamina:24.99,attacker:owners[1]});near(a.stamina,10.2);a=await event(a,'block',4,{pre_stamina:20,attacker:owners[1]});near(a.stamina,10.2,'Same attacker not two opponents');a=await event(a,'block',5,{pre_stamina:20,attacker:owners[2]});near(a.stamina,10.6);a=await event(a,'block',6,{pre_stamina:20,attacker:owners[3]});near(a.stamina,10.6);
   near((await event(withIds(['chef_020'],{stamina:50}),'block',0,{pre_stamina:25,attacker:owners[1]})).stamina,50,'Exactly25% is not below25%');}
  {let a=withIds(['chef_023'],{stamina:50});a=await event(a,'block',5,{pre_stamina:50,attacker:owners[1]});a=await event(a,'block',4,{pre_stamina:30,attacker:owners[2]});near(a.stamina,50.4,'Normal/projectile resolution may arrive out of impact order');
   let b=withIds(['chef_023'],{stamina:50});b=await event(b,'block',0,{pre_stamina:50,attacker:owners[1]});b=await event(b,'block',5.001,{pre_stamina:30,attacker:owners[2]});near(b.stamina,50,'More than5seconds is outside the block window');}
  {let a=withIds(['chef_021'],{stamina:50});for(const hit of [true,true,false,true,true])a=await event(a,'normal',0,{hit});near(a.stamina,50);a=await event(a,'normal',0,{hit:true});near(a.stamina,50.2);for(let n=0;n<3;n++)a=await event(a,'normal',0,{hit:true});near(a.stamina,50.2);}
  {let a=withIds(['chef_022'],{stamina:50});for(const target of [owners[1],owners[1]])a=await event(a,'special_hit',0,{special_id:'sweep1',target});near(a.stamina,50);a=await event(a,'special_hit',0,{special_id:'sweep1',target:owners[2]});near(a.stamina,50.2);a=await event(a,'special_hit',0,{special_id:'sweep1',target:owners[3]});near(a.stamina,50.2);for(const target of [owners[1],owners[2]])a=await event(a,'special_hit',1,{special_id:'sweep2',target});near(a.stamina,50.4);}
  {let a=withIds(['chef_025'],{stamina:50});a=await event(a,'clock',59.999);near(a.stamina,50);a=await event(a,'clock',60);near(a.stamina,50.4);a=await event(a,'clock',61);near(a.stamina,50.4);}
  // Protected regions require the actual matching piece; a manica protects the right arm only.
  for(const [id,slot,model,region]of [['doctore_012','helmet','imperial','head'],['doctore_013','chest','lorica','chest'],['doctore_014','gloves','manica_segmented','rightArm'],['doctore_015','legs','greaves','leftLeg']]){
   const a=fighter(owners[1]),v=withIds([id],{items:[{id:randomUUID(),kind:slot,equipped_slot:slot,model}]});
   assert.equal((await hit(a,v,'gladius',100.6,.9,1,false,region)).damage,100,id+' applies before rounding to a protected region');
   assert.equal((await hit(a,{...v,items:[]},'gladius',100.6,.9,1,false,region)).damage,101,id+' bare region has no protection');
   if(slot==='gloves')assert.equal((await hit(a,v,'gladius',100.6,.9,1,false,'leftArm')).damage,101,'Bare left arm is not protected by a right manica');
  }
  const strike=(a,b,seconds=0)=>({...a,strike_at:at(seconds),swing_at:at(seconds-.3),strike_target:b.owner,strike_weapon:a.items.find(i=>i.equipped_slot==='main_hand')?.model||'gladius',strike_hand:'main_hand',strike_region:'chest'});
  for(const [model,id]of [['large','doctore_010'],['small','doctore_011'],['shield_parma','doctore_011']]){
   for(const perfect of [false,true]){
    const b=withIds([id,'chef_004','chef_010'],{owner:owners[1],ranked_team:'b',z:1.5,angle:Math.PI,items:[weapon(),shield(model)],block:true,guard_at:perfect?at(-.1):at(-1),stamina:perfect?5.97:19.9});b.staff_ranked_v290.owner=b.owner;
    const a=fighter(owners[0]),out=await resolve([strike(a,b),b]);
    assert.equal(out[1].last_defense,perfect?'perfect':'block',model+' discounted block affordability');
    near(out[1].stamina,b.stamina-(perfect?6:20)*.99,model+' actual successful block payment');assert.equal(out[1].hp,100);
   }
  }
  // The two unconditional rates combine, while the threshold rate is strictly below25%.
  for(const [start,rate]of [[24.9,.01],[25,.006],[50,.006]]){
   const a=withIds(['chef_007','chef_008','chef_014'],{stamina:start,stamina_at:at(-1)}),out=await advance([a]);near(out[0].stamina,start+10.4*(1+rate),'Actual regeneration at '+start+'%');
  }
  {const a=withIds(['chef_017']),b=enemy();const out=await input([a,b],{attack:true,attack_id:'delay'});near((Date.parse(out[0].stamina_regen_at)-stamp)/1000,.996,'Regeneration delay is shortened by.4%');}
  // Real normal resolver drives the streak, including a miss that breaks it.
  {let a=withIds(['chef_021'],{stamina:50}),b=enemy();b.hp=1000;b.maxHp=1000;
   for(let n=0;n<2;n++){const out=await resolve([strike(a,b,n),b],at(n));a=out[0];b=out[1];}near(a.stamina,50);
   b.z=8;[a,b]=await resolve([strike(a,b,2),b],at(2));b.z=1.5;
   for(let n=3;n<6;n++){[a,b]=await resolve([strike(a,b,n),b],at(n));}near(a.stamina,50.2,'Three actual hits following a miss pay once');
  }
  // A sweep must hit two distinct enemies; only the secondary receives its weapon bonus.
  {const a=withIds(['doctore_005','chef_022'],{items:[weapon('halberd')],stamina:60}),b=enemy(),c=fighter(owners[2],{ranked_team:'b',x:.3,z:1.6,angle:Math.PI});
   const entered=await input([a,b,c],{special:true,special_id:'real-sweep',hand:'main_hand',target:b.owner});
   const out=await special(entered,at(.4));assert(out[1].hp<100&&out[2].hp<100,'Both real sweep victims were hit');near(out[0].stamina,34.2,'Two actual targets grant one restoration');
   near((await special(out,at(.5)))[0].stamina,34.2,'Polling a resolved special cannot repeat the restoration');
   assert.equal((await hit(a,b,'halberd',100.4,.9,1,false,'chest',false,false)).damage,100);
   assert.equal((await hit(a,b,'halberd',100.4,.9,1,false,'chest',false,true)).damage,101,'Second-target damage uses relative.4% before rounding');
   let current=out;for(const [time,id]of [[9,'other-sweep'],[18,'real-sweep']]){current[0].stamina=60;current=await input(current,{special:true,special_id:id,hand:'main_hand',target:b.owner},at(time));assert.equal(current[0].special_v261.id,id);current=await special(current,at(time+.4));near(current[0].stamina,34.2,'Reused command ID is a new accepted execution at a later server start');}
  }
  // Net/pull remain their existing real status actions; neither invents damage or extra targets.
  for(const [model,hand,id,status]of [['net','off_hand','doctore_008','net_until'],['whip','main_hand','doctore_009','pull_until']]){
   const a=withIds([id,'chef_022'],{items:[weapon(model,hand)],stamina:60}),b=enemy();const begun=await input([a,b],{special:true,special_id:'impact-'+model,hand,target:b.owner});const out=await special(begun,at(.6));assert(out[1][status],model+' existing effect lands');assert.equal(out[1].hp,100);near(out[0].stamina,60-26*.996);
  }
  // Genuine bash recovery is the only stand-up trigger; ordinary stagger is insufficient.
  {const a=fighter(owners[1],{items:[weapon(),shield()],ranked_team:'b'}),b=withIds(['chef_018'],{z:1.5,angle:Math.PI,stamina:50});
   const begun=await input([a,b],{special:true,special_id:'knockdown',hand:'off_hand',target:b.owner});const out=await special(begun,at(.4));assert(out[1].knocked_until,'Bash really knocked the enemy down');
   const clock=(actor,t)=>one('select ludus_staff_private.ranked_after_clock_v290($1,$2)r',[actor,at(t)]);
   near((await clock(out[1],1.899)).stamina,50);const recovered=await clock(out[1],1.9);near(recovered.stamina,50.2);near((await clock(recovered,2)).stamina,50.2);
   near((await clock(withIds(['chef_018'],{stamina:50,stagger_until:at(1)}),2)).stamina,50);
  }
  // A lethal real hit uses the career contributor ledger, including its10% assist threshold.
  {const killer=withIds(['chef_019','chef_024'],{stamina:50}),victim=enemy();victim.hp=1;
   const helper=withIds(['chef_024'],{owner:owners[2],stamina:50,x:4}),below=withIds(['chef_024'],{owner:owners[3],stamina:50,x:5}),dead=withIds(['chef_024'],{owner:owners[4],stamina:50,hp:0,x:6});for(const a of [helper,below,dead])a.staff_ranked_v290.owner=a.owner;
   victim.career.contributors={[helper.owner]:10,[below.owner]:9.999,[dead.owner]:20};
   const out=await resolve([strike(killer,victim),victim,helper,below,dead]);assert.equal(out[1].hp,0);assert.equal(out[0].career.kills,1);near(out[0].stamina,50.4,'Killer gets kill, never its own assist');near(out[2].stamina,50.2,'Exactly10% contributor gets real assist');near(out[3].stamina,50,'Subthreshold contribution is not an assist');near(out[4].stamina,50,'Dead contributor is not revived');
   const repeated=await resolve(out,at(1));for(const i of [0,2,3,4])near(repeated[i].stamina,out[i].stamina,'Dead victim cannot repay event');
  }
  // A projectile keeps the frozen learning and original weapon after a genuine gear refresh.
  {const a=withIds(['doctore_002','chef_001','chef_009'],{items:[weapon('spear')],stamina:70,maxStamina:100.6}),b=enemy();b.z=2;
   const begun=await input([a,b],{special:true,special_id:'frozen-throw',hand:'main_hand',target:b.owner});const actor=begun[0],projectile=actor.projectile;
   assert.equal(actor.items.length,0);assert.deepEqual(projectile.attacker.staff_ranked_v290.effects,a.staff_ranked_v290.effects,'Flying weapon keeps learned snapshot after unequip');
   const baseStats=await one('select private.ludus_combat_stats_v73($1,$2)r',[actor.gladiator,actor.items]);near(actor.maxStamina,Number(baseStats.maxStamina)*1.006,'Refreshed base is multiplied once');near(actor.combat_stats.maxStamina,actor.maxStamina,'Public combat stats agree with current maximum');
   const originalMax=actor.maxStamina;const out=await shots(begun,at(.5));assert(out[1].hp<100,'Actual server projectile hit');near(out[0].maxStamina,originalMax,'Projectile tick never compounds maximum');
   const clean=clone(begun);delete clean[0].projectile.attacker.staff_ranked_v290;const boostedDamage=await hit(projectile.attacker,b,'spear',100.4,.9,1,true);assert.equal(boostedDamage.damage,101,'Flying snapshot retains weapon damage gain');
  }
  // The clock starts on the actual transition to playing, after the old120s setup countdown.
  {const waiting=await snap([withIds(['chef_025'],{stamina:50}),enemy()],{status:'waiting',starts:at(120)});assert.equal(waiting.players[0].staff_ranked_state_v290.started_at,null);
   const out=(await q("update ludus_matches set status='playing',starts_at=$2 where id=$1 returning players",[waiting.id,at(5)]))[0].players;
   assert.equal(Date.parse(out[0].staff_ranked_state_v290.started_at),stamp+5000);out[0].stamina=50;
   near((await event(out[0],'clock',64.999)).stamina,50);near((await event(out[0],'clock',65)).stamina,50+out[0].maxStamina*.004);
  }
  // Client payload fields cannot replace server-side frozen knowledge or event state.
  {const a=withIds(['chef_003']),before=clone(a.staff_ranked_v290),out=await input([a,enemy()],{staff_ranked_v290:{version:290,owner:a.owner,effects:{chef_003:.99}},staff_ranked_state_v290:{once:[]},action_costs_v290:{attack:{main_hand:0}},attack:true,attack_id:'forged'});assert.deepEqual(out[0].staff_ranked_v290,before);near(out[0].stamina,100-13*.998);}

  // Exercise genuine creation paths for ten human owners, then one human and nine bots.
  await q("update ludus_matches set status='finished',updated_at=clock_timestamp()-interval '1 hour'");
  const gladiators=[];for(let n=0;n<10;n++){
   const gid=randomUUID();gladiators.push(gid);await q("insert into ludus_gladiators(id,owner_id,name,class)values($1,$2,$3,'secutor')",[gid,owners[n],'Fighter '+n]);
   await q("insert into ludus_items(id,owner_id,equipped_by,equipped_slot,kind,model)values($1,$2,$3,'main_hand','weapon','gladius')",[randomUUID(),owners[n],gid]);
   await q('insert into ludus_presence(user_id,last_seen)values($1,clock_timestamp())',[owners[n]]);
  }
  const rooms=[];for(const n of [0,5])rooms.push((await q('insert into ludus_ranked_party_private.rooms_v244(leader_id)values($1)returning id',[owners[n]]))[0].id);
  for(let n=0;n<10;n++)await q('insert into ludus_ranked_party_private.members_v244(room_id,user_id,gladiator_id,ready_signature)values($1,$2,$3,ludus_ranked_party_private.signature_v246($2,$3))',[rooms[n<5?0:1],owners[n],gladiators[n]]);
  const humanId=await one('select ludus_ranked_match_private.create_live_match($1,$2)r',[owners.slice(0,5),owners.slice(5,10)]),humans=(await q('select players from ludus_matches where id=$1',[humanId]))[0].players;
  assert.equal(humans.length,10);for(const actor of humans){assert.equal(actor.staff_ranked_v290.owner,actor.owner);const expected=actor.owner===owners[0]?supported:actor.owner===owners[1]?['chef_001']:actor.owner===owners[2]?['doctore_002']:[];assert.deepEqual(Object.keys(actor.staff_ranked_v290.effects).sort(),expected.slice().sort(),'Human entry ownership '+actor.owner);assert.equal(actor.staff_ranked_state_v290.started_at,null);}
  // Public producer contract: both full and compact responses quote only the authenticated owner.
  const publicState=async(owner,action='state',command={})=>{await q("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated');try{return await one('select public.ludus_ranked_match_v252($1,$2,null,\'{}\',$3)r',[action,humanId,command]);}finally{await db.exec('reset role');}};
  const assertQuote=(state,owner,cost)=>{assert.equal(state.players.filter(actor=>actor.action_costs_v290).length,1);const self=state.players.find(actor=>actor.owner===owner);assert.equal(self.action_costs_v290.owner,owner);near(self.action_costs_v290.attack.main_hand,cost);near(self.action_costs_v290.attack.off_hand,cost,'Offhand attack correctly falls back to the main sword');for(const actor of state.players.filter(actor=>actor.owner!==owner))assert.equal(actor.action_costs_v290,undefined,'Other players receive no private cost quote');};
  for(let n=0;n<10;n++){const state=await publicState(owners[n]);assert.equal(state.status,'waiting');assertQuote(state,owners[n],n===0?12.87:13);}
  await q("update ludus_matches set starts_at=clock_timestamp()-interval '1 millisecond'where id=$1",[humanId]);
  const full=await publicState(owners[0]);assert.equal(full.status,'playing');assert.equal(full.delta_version,undefined);assertQuote(full,owners[0],12.87);
  const compact=await publicState(owners[0],'step',{action_costs_v290:{attack:{main_hand:0}},staff_ranked_v290:{version:290,owner:owners[0],effects:{chef_003:.99}}});assert.equal(compact.status,'playing');assert.equal(compact.delta_version,252);assertQuote(compact,owners[0],12.87);
  assertQuote(await publicState(owners[1]),owners[1],13);await assert.rejects(publicState(owners[11]),/Bu maça erişemezsin/);
  const persisted=(await q('select players from ludus_matches where id=$1',[humanId]))[0].players;for(const actor of persisted)assert.equal(actor.action_costs_v290,undefined,'A client quote never mutates match storage');assert.deepEqual(persisted.find(actor=>actor.owner===owners[0]).staff_ranked_v290.effects,humans[0].staff_ranked_v290.effects);
  // A due lethal impact at59.95s resolves before an alive-at60s reward on a delayed poll.
  {const now=Date.parse((await q('select clock_timestamp() now'))[0].now),time=ms=>new Date(now+ms).toISOString(),arr=clone(persisted),victim=arr.find(actor=>actor.owner===owners[0]),attacker=arr.find(actor=>actor.owner===owners[5]);
   Object.assign(victim,{hp:1,stamina:50,x:0,z:1.5,block:false,guard_at:null,stamina_at:time(0),stamina_regen_at:time(10000)});victim.staff_ranked_state_v290={once:[],normal_hits:0,blocks:[],started_at:time(-60050)};
   Object.assign(attacker,{x:0,z:0,angle:0,strike_at:time(-100),swing_at:time(-400),strike_target:victim.owner,strike_weapon:'gladius',strike_hand:'main_hand',strike_region:'chest',stagger_until:null,pull_from:null});
   await q('update ludus_matches set players=$2,starts_at=$3,updated_at=clock_timestamp()where id=$1',[humanId,arr,time(-60050)]);
   const response=await publicState(owners[0]),dead=response.players.find(actor=>actor.owner===victim.owner);assert.equal(dead.hp,0,'Pending lethal normal hit actually resolves through the public state RPC');near(dead.stamina,50,'An earlier lethal hit prevents the later60s restoration');assert(!dead.staff_ranked_state_v290.once.includes('chef_025'),'Dead actor never records the alive-at60s award');
  }
  await q("update ludus_matches set status='finished',updated_at=clock_timestamp()-interval '1 hour'");await q('delete from ludus_ranked_party_private.rooms_v244');
  await q('insert into ludus_bot_private.settings_v233 values(true,$1,true,true)',[owners[0]]);for(let n=1;n<10;n++)await q('insert into ludus_bot_private.members_v233(slot,user_id)values($1,$2)',[n,owners[n]]);
  const clan=randomUUID();await q("insert into ludus_clans(id,name)values($1,'Test clan')",[clan]);for(let n=0;n<5;n++)await q('insert into ludus_clan_members values($1,$2)',[owners[n],clan]);
  const botRoom=(await q('insert into ludus_ranked_party_private.rooms_v244(leader_id)values($1)returning id',[owners[0]]))[0].id;
  await q('insert into ludus_ranked_party_private.members_v244(room_id,user_id,gladiator_id,ready_signature)values($1,$2,$3,ludus_ranked_party_private.signature_v246($2,$3))',[botRoom,owners[0],gladiators[0]]);
  await q("select set_config('request.jwt.claim.sub',$1,false)",[owners[0]]);const botId=await one('select ludus_bot_private.start_ranked_v249($1)r',[owners[0]]),bots=(await q('select players from ludus_matches where id=$1',[botId]))[0].players;
  assert.equal(bots.length,10);assert.equal(bots.filter(actor=>actor.bot_v249).length,9);for(const actor of bots){assert.equal(actor.staff_ranked_v290.owner,actor.owner);const corresponding=humans.find(h=>h.owner===actor.owner);assert.deepEqual(actor.staff_ranked_v290.effects,corresponding.staff_ranked_v290.effects,'Bot entry takes its own learning, never the human host\'s');}
  console.log('PASS V290 Ranked staff:',checks,'SQL assertions/calls; genuine V261 fixture, legacy RNG baseline, frozen ownership, approved rates, affordability, relative damage and first-event boundaries.');
 }finally{await db.close();}
})().catch(error=>{console.error(error.stack||error.message,error.where||'',error.detail||'');process.exitCode=1;});
