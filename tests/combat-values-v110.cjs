// Run the actual combat functions in PostgreSQL and compare the read-only report
// with the shipped combat engine. No production accounts or test rewards.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {runtime,item,fixture,database,g,core}=require('./combat-stats-v73.cjs');
const root=path.resolve(__dirname,'..'),A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const near=(a,b,label='')=>assert.ok(Math.abs(Number(a)-Number(b))<1e-6,`${label}: ${a} != ${b}`);
async function main(){
 const db=await database(),q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 try{
  await db.exec(fs.readFileSync(root+'/supabase/migrations/20261017050254_combat_values_v110.sql','utf8'));
  const c=runtime(),food={combat_stamina_bonus:12,combat_morale:80};
  const report=async(glad,items=[],nutrition=food)=>(await q('select ludus_private.values_report_v110($1,$2,$3) r',[JSON.stringify(glad),JSON.stringify(items),JSON.stringify(nutrition)]))[0].r;
  const cases=[];
  for(const type of Object.keys(c.ArenaClasses))cases.push([{...g,class:type,base_stats:c.LudusExercise.profile(type)},[]]);
  for(const value of[0,50,100])cases.push([{...g,base_stats:Object.fromEntries(Object.keys(core).map(k=>[k,value]))},[]]);
  for(const s of c.LudusItemSystem.emeralds)cases.push([g,[item(c,'weapon',{emeralds:[{id:s.id,value:100}]})]]);
  for(const s of c.LudusItemSystem.natural){const kind=s.group==='offense'?'weapon':s.group==='defense'?'chest':'legs';cases.push([g,[item(c,kind,{enhancement:15,natural_percentages:{[s.key]:100}})]]);}
  const gear=['weapon','shield','helmet','chest','gloves','legs'].map((k,i)=>item(c,k,{id:'item-'+i,name:k==='weapon'?'Gladius':k,enhancement:15,natural_percentages:Object.fromEntries(Object.keys(c.LudusItemSystem.baseStats(k)).map(k=>[k,100])),emeralds:[{id:1,value:100},{id:2,value:100},{id:3,value:100},{id:4,value:100}]}));
  cases.push([{...g,level:21},gear]);
  cases.push([g,[item(c,'weapon'),item(c,'weapon',{equipped_slot:'off_hand',model:'sica'})]]);
  cases.push([{class:'murmillo',stat_version:7,base_stats:c.ArenaClasses.murmillo.stats,level:2,overall:62},[{kind:'helmet',equipped_slot:'helmet',base_stats:{health:4,defense:3},enhancement:6,sapphires:[{stat:'strength',value:10,percent:true}],rubies:[]}]]);
  for(const [glad,items]of cases){
   const r=await report(glad,items),f=fixture(c).a;c.LudusLoadout.apply(f,glad,items);
   for(const[k,v]of Object.entries(r.totals))near(r.sources.reduce((n,s)=>n+(s.delta[k]||0),0),v,'source sum '+k);
   for(const [key,value]of Object.entries({max_hp:f.maxHp,max_stamina:f.maxStamina,physical_defense:f.defenseBonus*50,attack_speed:(.7+.006*Math.max(0,Math.min(100,f.agility)))*(1+Math.max(0,Math.min(.25,(f.itemStats.attack_speed||0)/100))),movement_speed:f.speedBonus,hp_regeneration:Math.min(2,f.itemStats.hp_regeneration||0),stamina_regeneration_pve:(15.75+Math.min(8,f.itemStats.stamina_regeneration||0))*.65*1.12*1.03,stamina_regeneration_pvp:(16+Math.min(8,f.itemStats.stamina_regeneration||0))*.65*1.12*1.03}))near(r.totals[key],value,key);
   const snap=(await q('select private.ludus_combat_stats_v73($1,$2) s',[JSON.stringify(glad),JSON.stringify(items)]))[0].s;
   for(const hand of['main','off'])for(const mode of['pve','pvp'])for(const end of['min','max']){
    const slot=hand==='main'?'main_hand':'off_hand',w=items.find(i=>i.kind==='weapon'&&i.equipped_slot===slot&&['gladius','sica','spear','trident','mace','whip'].includes(i.model));
    const base=mode==='pvp'?14:11.2*(w?1:.35);
    const hit=(await q('select private.ludus_hit_v73($1,$2,$3,$4,$5,1,$6) h',[JSON.stringify({stats_version:77,combat_stats:snap,items}),JSON.stringify({combat_stats:{defense:1,items:{}}}),w?.model||'fist',slot,base,end==='min'?0:1]))[0].h;
    near(r.totals[hand+'_'+mode+'_'+end],hand==='off'&&!w?0:hit.damage,'live damage');
    if(mode==='pve'&&(hand==='main'||w)){
     const {sim,a,v}=fixture(c);c.LudusLoadout.apply(a,glad,items);
     Object.assign(v,{action:'hurt',chest:false,hp:100000});v.body.chest=100;
     Object.assign(a,{weapon:w?.model||null,attackWeapon:w?.model||null,attackLeft:hand==='off'});
     const rolls=[1,end==='min'?0:1];sim.random=()=>rolls.shift()??1;
     sim.damage(a,v,20*(w?1:.35),'chest');near(r.totals[hand+'_'+mode+'_'+end],100000-v.hp,'actual PvE hit');
    }
   }
  }
  const capped=await report({...g,level:21},gear);
  assert.ok(capped.raw.max_stamina>100);near(capped.totals.max_stamina,220);
  assert.ok(capped.sources.some(s=>s.kind==='emerald'&&s.raw.max_stamina>0&&!s.delta.max_stamina),'capped stone remains explainable');
  assert.ok(capped.sources.some(s=>s.kind==='sapphire'),'natural percentage source');
  assert.ok(capped.sources.some(s=>s.kind==='enhancement'),'upgrade source');
  assert.equal((await report(g,[])).totals.off_pve_max,0);
  const nofood=await report(g,[],{combat_stamina_bonus:0,combat_morale:0});near(nofood.totals.stamina_regeneration_pve,15.75*.65*.95);
  // Owner-only RPC, genuine stored gear, anonymous guard and private helper grants.
  await q('insert into ludus_accounts(user_id,gold)values($1,1000),($2,2000)',[A,B]);
  const ga=(await q("insert into ludus_gladiators(owner_id,name,class,base_stats,stat_version)values($1,'Aulus Varro','secutor',$2,46)returning id",[A,JSON.stringify(core)]))[0].id;
  const gb=(await q("insert into ludus_gladiators(owner_id,name,class,base_stats,stat_version)values($1,'Other','secutor',$2,46)returning id",[B,JSON.stringify(core)]))[0].id;
  await q("insert into ludus_items(owner_id,kind,model,equipped_by,equipped_slot,stat_version,natural_stats)values($1,'weapon','gladius',$2,'main_hand',10,'{\"physical_power\":7}')",[A,ga]);
  await q("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims','{\"is_anonymous\":false}',false)",[A]);
  await q('set role authenticated');
  const live=(await q('select public.ludus_combat_values($1) r',[ga]))[0].r;
  assert.equal(live.owner_id,A);assert.equal(live.gladiator.id,ga);assert.equal(live.items.length,1);assert.ok(Date.parse(live.valid_until)>Date.parse(live.server_now));
  await assert.rejects(()=>q('select public.ludus_combat_values($1)',[gb]),/Gladyatör bulunamadı/);
  await assert.rejects(()=>q("select ludus_private.values_report_v110('{}','[]','{}')"),/permission denied/);
  await q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");
  await assert.rejects(()=>q('select public.ludus_combat_values($1)',[ga]),/Giriş gerekiyor/);
  await q('reset role');
  assert.deepEqual((await q("select has_function_privilege('anon','public.ludus_combat_values(uuid)','execute') anon,has_function_privilege('authenticated','public.ludus_combat_values(uuid)','execute') auth"))[0],{anon:false,auth:true});
  assert.deepEqual((await q('select gold from ludus_accounts order by user_id')).map(r=>r.gold),[1000,2000]);
  if(process.env.LUDUS_TEST_OUTPUT){fs.mkdirSync(process.env.LUDUS_TEST_OUTPUT,{recursive:true});fs.writeFileSync(path.join(process.env.LUDUS_TEST_OUTPUT,'combat-values-fixture.json'),JSON.stringify({...capped,owner_id:A,gladiator:{...g,id:ga,name:'Aulus Varro',level:21},items:gear,server_now:new Date().toISOString(),valid_until:new Date(Date.now()+3600000).toISOString()}));}
  console.log(JSON.stringify({parityCases:cases.length,sourceSums:true,damageBothModes:true,caps:true,foodAndMorale:true,ownerIsolation:true,anonymousBlocked:true,privateHelpers:true,currencyUnchanged:true}));
 }finally{await db.close();}
}
main().catch(e=>{console.error({message:e.message,where:e.where,stack:e.stack});process.exitCode=1;});
