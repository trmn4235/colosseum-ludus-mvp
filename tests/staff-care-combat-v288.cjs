/* Exercise Chef one-time events in the shipped ArenaCombat, not a mock engine. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const seed=fs.readFileSync(root+'/supabase/migrations/20261121224449_papyrus_catalog_v288.sql','utf8');
const catalog=JSON.parse(seed.match(/\$catalog\$([\s\S]*?)\$catalog\$/)[1]);
const rows=ids=>catalog.filter(r=>ids.includes(r.content_id)).map(r=>({...r,role:r.role_id,effect:{...r.effect},learned_at:'2026-11-21T00:00:00Z'}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function runtime(page){
 const html=fs.readFileSync(root+'/'+page,'utf8'),ctx=vm.createContext({console});
 vm.runInContext(fs.readFileSync(root+'/special-staff-care-v288.js','utf8'),ctx);
 const start=html.indexOf('var ArenaClasses='),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);";
 vm.runInContext(html.slice(start,html.indexOf(ending,html.indexOf(marker,start))+ending.length),ctx);
 const load=html.indexOf('var LudusLoadout='),finish=html.indexOf('})();',html.indexOf('P.damageProjectileV10=',load))+5;
 vm.runInContext(html.slice(load,finish).replace(/<\/script>[\s\S]*?<script[^>]*>/g,''),ctx);
 ctx.SpecialStaffCareV288.installCombat(ctx.ArenaCombat);return ctx;
}
function fixture(ctx,ids=[]){
 const sim=new ctx.ArenaCombat(()=>.999).reset('normal','secutor'),f=sim.fighters[0],enemy=sim.fighters[5];
 for(const p of sim.fighters){p.hp=0;p.cooldown=999;}
 ctx.LudusLoadout.apply(f,{class:'secutor',overall:50,level:1},[]);
 Object.assign(f,{hp:1000,maxHp:1000,maxStamina:100,stamina:50,x:0,z:0,angle:0,action:'idle',regenDelay:100,cooldown:0});
 Object.assign(enemy,{hp:10000,maxHp:10000,x:0,z:1,angle:Math.PI,action:'idle',cooldown:999,blocking:false,regenDelay:100});
 f.staffChefV288=ctx.SpecialStaffCareV288.createChef(rows(ids));return{sim,f,enemy};
}
for(const page of ['arena.html','savas.html','multiplayer.html']){
 const ctx=runtime(page);
 {
  const{sim,f,enemy}=fixture(ctx,['chef_019']);enemy.hp=1;sim.damage(f,enemy,100,'chest');near(f.stamina,50.4);
  const second=sim.fighters[6];Object.assign(second,{hp:1,maxHp:1});sim.damage(f,second,100,'chest');near(f.stamina,50.4);
 }
 {
  const{sim,f,enemy}=fixture(ctx,['chef_020','chef_023']);f.shield=true;f.shieldHeldBy=null;f.blocking=true;f.stamina=24;f.guardPressedAt=0;enemy.action='attack';
  assert.equal(sim.guard(enemy,f),true);near(f.stamina,18.2,'first low-stamina successful perfect block restores .2');
  sim.time=3;f.blocking=true;f.stamina=50;f.guardPressedAt=-99;
  const second=sim.fighters[6];Object.assign(second,{hp:100,x:0,z:1,angle:Math.PI,action:'idle'});
  assert.equal(sim.guard(second,f),true);near(f.stamina,30.4,'two distinct attackers within five seconds restore .4');
 }
 {
  const{sim,f,enemy}=fixture(ctx,['chef_021']);
  const swing=hit=>{Object.assign(f,{x:0,z:0,angle:0,action:'idle',cooldown:0,stamina:80});Object.assign(enemy,{x:0,z:1,action:'idle'});assert.equal(sim.attack(0),true);f.stamina=50;if(hit){assert.equal(sim.hit(f,enemy),true);}f.attackSettled=true;sim.tick(.001,{});return f.stamina;};
  near(swing(true),50);near(swing(false),50);near(swing(true),50);near(swing(true),50);near(swing(true),50.2);near(swing(true),50);
 }
 {
  const trained=fixture(ctx,['chef_018']),plain=fixture(ctx);
  for(const{sim,f,enemy}of[trained,plain]){sim.damage(enemy,f,1,'legs',true);for(let n=0;n<27;n++)sim.tick(.05,{});}
  assert.notEqual(trained.f.action,'knocked');near(trained.f.stamina-plain.f.stamina,.2);
  for(const{sim,f,enemy}of[trained,plain]){sim.damage(enemy,f,1,'legs',true);for(let n=0;n<27;n++)sim.tick(.05,{});}
  near(trained.f.stamina-plain.f.stamina,.2,'second getup gives no additional bonus');
 }
 {
  const{sim,f}=fixture(ctx,['chef_025']);sim.time=59.98;sim.tick(.05,{});near(f.stamina,50.4);sim.tick(.05,{});near(f.stamina,50.4);
 }
}
// Actual arena launch hook shares costs/regen with the trainer module. A match
// consumes its frozen snapshot and equipment refresh must never compound max.
{
 const ctx=runtime('arena.html');vm.runInContext(fs.readFileSync(root+'/staff-combat-v288.js','utf8'),ctx);
 const{sim,f,enemy}=fixture(ctx),effects=rows(['chef_001','chef_003','chef_004','chef_005','chef_006','chef_007','chef_008','chef_009','chef_010','chef_011','chef_012','chef_014','chef_015','chef_017']);
 ctx.StaffCombatV288.attachArena(sim,{mode:'4x5',snapshot:{staff_combat_v288:{version:288,effects}}});
 near(f.maxStamina,100.6);assert.equal(enemy.staffChefV288,undefined,'owner knowledge does not spread to opponents');
 effects.find(r=>r.content_id==='chef_003').effect.value=.5;
 f.stamina=12.95;assert.equal(sim.attack(0),true,'discounted threshold permits the real attack');near(f.stamina,12.95-13*.994);near(f.regenDelay,.9*.996);
 Object.assign(f,{action:'idle',cooldown:0,stamina:24.9});assert.equal(sim.dodge(0,1,0),true);near(f.stamina,24.9-25*.994);near(f.regenDelay,.8*.996);
 Object.assign(f,{action:'idle',cooldown:0,stamina:25.9,x:0,z:0,angle:0,weapon:'gladius',pickupHand:'weapon'});Object.assign(enemy,{x:0,z:1,action:'idle'});
 assert.equal(sim.special(0,0),true);near(f.stamina,25.9-26*.994);
 Object.assign(f,{action:'idle',cooldown:0,stamina:19.9,shield:true,shieldHeldBy:null,blocking:true,guardPressedAt:-99});
 assert.equal(sim.guard(enemy,f),true);near(f.stamina,19.9-20*.994);
 Object.assign(f,{action:'idle',blocking:false,stamina:50,regenDelay:0,cooldown:999});sim.tick(.01,{});near(f.stamina,50+.01*15.75*.65*1.006);
 Object.assign(f,{action:'idle',blocking:false,stamina:20,regenDelay:0,cooldown:999});sim.tick(.01,{});near(f.stamina,20+.01*15.75*.65*1.010);
 const profile={class:'secutor',overall:50,level:1};ctx.LudusLoadout.apply(f,profile,[]);const maximum=f.maxStamina;
 ctx.LudusLoadout.apply(f,profile,[]);near(f.maxStamina,maximum,'equipment recalculation does not compound maximum stamina');
}
console.log('V288 actual ArenaCombat: one-time events on three pages; arena frozen ownership, attack/roll/special/block thresholds, regen stacking, delay and max refresh passed.');
