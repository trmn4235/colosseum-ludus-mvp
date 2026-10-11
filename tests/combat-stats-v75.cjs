const assert=require('node:assert/strict');
const {runtime,fixture,item,database,g}=require('./combat-stats-v73.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
async function main(){
 const db=await database(),q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 const snap=async items=>(await q('select private.ludus_combat_stats_v73($1::jsonb,$2::jsonb) s',[JSON.stringify(g),JSON.stringify(items)]))[0].s;
 const player=async(items=[],version=75)=>({items,stats_version:version,combat_stats:await snap(items)});
 const sqlHit=async(a,v,hand='main_hand')=>(await q("select private.ludus_hit_v73($1::jsonb,$2::jsonb,'gladius',$3,1120,.999,.999) h",[JSON.stringify(a),JSON.stringify(v),hand]))[0].h.damage;
 let slotCases=0,recoveryCases=0;
 for(const page of ['arena.html','savas.html','multiplayer.html']){
  const c=runtime(page),baseGear=['weapon','shield','helmet','chest','gloves','legs'].map((kind,i)=>item(c,kind,{id:String(i)}));
  function pveHit(gear,hand='main_hand',thrown=false){const{sim,a,v}=fixture(c);c.LudusLoadout.apply(a,g,gear);v.hp=100000;v.chest=false;v.body.chest=100;a.attackLeft=hand==='off_hand';
   if(thrown){const held=gear.find(i=>i.equipped_slot===hand);c.LudusLoadout.apply(a,g,gear.filter(i=>i!==held));sim.damageProjectileV10(a,v,{kind:'gladius',itemEntry:{item:held}},2000,'chest');}
   else sim.damage(a,v,2000,'chest');return 100000-v.hp;}
  for(const offhand of [false,true]){
   const gear=structuredClone(baseGear);if(offhand)gear[1]=item(c,'weapon',{id:'1',equipped_slot:'off_hand'});
   const hand=offhand?'off_hand':'main_hand';let expected=null;
   for(let slot=0;slot<gear.length;slot++){
    const equipped=structuredClone(gear);equipped[slot].emeralds=[{id:5,value:100}];
    const amount=pveHit(equipped,hand);if(expected===null)expected=amount;assert.equal(amount,expected,'same Fortitudo contribution in every slot');
    assert.equal(amount,await sqlHit(await player(equipped),await player(),hand),'actual PvE / SQL damage parity');
    assert.equal(pveHit(equipped,hand,true),amount,'thrown item contributes exactly once');slotCases++;
   }
  }
  const weapon=item(c,'weapon'),gemWeapon={...weapon,emeralds:[{id:5,value:100}]},doubleNatural={...weapon,natural_percentages:{physical_power:100}};
  assert.ok(pveHit([gemWeapon])>pveHit([weapon]));assert.ok(pveHit([gemWeapon])<pveHit([doubleNatural]));
  near(pveHit([doubleNatural]),2*pveHit([weapon]));
  // Recovery consistently scales animation duration and gameplay locks once.
  for(const bonus of [0,15,30,100]){
   const factor=1+Math.min(30,bonus)/100;
   for(const perfect of [false,true]){const{sim,a,v}=fixture(c);a.itemStats={recovery_speed:bonus};sim.attack(0);sim.deflectAttack(a,v,perfect);near(a.duration,(perfect?.62:.23)/factor);const duration=a.duration;sim.deflectAttack(a,v,perfect);near(a.duration,duration);recoveryCases++;}
   for(const heavy of [false,true]){const{sim,a,v}=fixture(c);v.itemStats={recovery_speed:bonus};v.hp=100000;sim.damage(a,v,1,heavy?'legs':'chest',heavy);assert.equal(v.action,heavy?'knocked':'hurt');near(v.duration,(heavy?1.25:.25)/factor);recoveryCases++;}
   const{sim,a,v}=fixture(c);v.itemStats={recovery_speed:bonus};sim.knock(v,1.5);near(v.duration,1.5/factor);near(v.stunUntil,sim.time+v.duration);near(v.knockedUntil,v.stunUntil);
   const end=v.stunUntil;while(sim.time+.025<end)sim.tick(.025,{});assert.equal(v.action,'knocked');assert.ok(v.timer/v.duration>.9);sim.tick(.025,{});assert.notEqual(v.action,'knocked');assert.ok(v.stunUntil<=sim.time);recoveryCases++;
   sim.knock(a,.62,'pull');near(a.duration,.62); // Active restraint is not a recovery animation.
  }
 }
 const c=runtime(),weapon=item(c,'weapon',{emeralds:[{id:5,value:100}]}),victim=await player();
 const old=await sqlHit(await player([weapon],74),victim),modern=await sqlHit(await player([weapon],75),victim);assert.ok(old>modern,'running old matches retain the prior damage rule');
 const now='2026-10-11T15:00:01Z',impact='2026-10-11T15:00:00.5Z';
 for(const version of [74,75])for(const defense of ['block','parry','perfect']){
  const a={...await player([item(c,'legs',{natural_stats:{recovery_speed:30}})],version),owner:'a',hp:100,stamina:100,x:0,z:0,angle:0,strike_at:impact,strike_target:'v',strike_weapon:'gladius',swing_at:'2026-10-11T15:00:00Z'};
  const gear=defense==='parry'?[item(c,'weapon',{natural_stats:{},emeralds:[{id:11,value:100}]})]:[item(c,'shield')];
  const v={...await player(gear,version),owner:'v',hp:100,stamina:100,x:0,z:1.25,angle:Math.PI,block:defense!=='parry',guard_at:defense==='perfect'?'2026-10-11T15:00:00.4Z':null};
  if(defense==='parry')v.combat_stats.items.parry_rate=20;
  let resolved;for(let seed=1;seed<=100;seed++){await q('select setseed($1)',[seed/100]);resolved=(await q('select private.ludus_resolve_combat_v36($1::jsonb,$2::timestamptz) p',[JSON.stringify([a,v]),now]))[0].p;if(resolved[0].attack_result===defense)break;}
  assert.equal(resolved[0].attack_result,defense);const duration=(Date.parse(resolved[0].recoil_until)-Date.parse(now))/1000;
  assert.ok(Math.abs(duration-(defense==='perfect'?.62/1.3:version===75?.23/1.3:.23))<.001);
  assert.equal(resolved[0].cooldown_until,resolved[0].recoil_until);
 }
 await db.close();console.log(JSON.stringify({slotParityCases:slotCases,recoveryCases,projectileParity:true,naturalWeaponScaling:true,oldMatchRules:true,serverRecoil:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
