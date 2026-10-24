const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const {runtime}=require('./combat-stats-v73.cjs'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const c=runtime();for(const file of ['combat-curves-v163.js','combat-motion-v163.js','pit-round-v176.js','pit-arena-v172.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
 c.ArenaAuthoredCombat.install(c.ArenaCombat,c.ArenaMotion);
 const ticket=JSON.parse(fs.readFileSync('/tmp/pit-fixtures-v176.json','utf8')).tickets[1];
 const sim=new c.ArenaCombat(()=>.5).reset('normal','secutor','pit');c.LudusLoadout.initialize(sim,ticket);c.PitArena.install(sim,ticket);
 for(const f of sim.fighters){assert.equal(f.pitAttackRate,1.2);f.stamina=100;f.cooldown=0;f.action='idle';assert.ok(sim.attack(f.id));const original=c.ArenaMotion.profile('heavy_mace',false,f.id!==0);assert.ok(Math.abs(f.duration-original.duration/c.ArenaMotion.speedFactor(f)/1.2)<1e-8,'every fighter gains exactly 20% attack rate');assert.equal(c.ArenaAuthoredCombat.clipName(f),'swordA');f.chain=2;assert.equal(c.ArenaAuthoredCombat.clipName(f),'swordB');f.chain=3;assert.equal(c.ArenaAuthoredCombat.clipName(f),'chop');}
 const untouched=new c.ArenaCombat(()=>.5).reset(),f=untouched.fighters[0];f.weapon='heavy_mace';untouched.attack(0);assert.ok(Math.abs(f.duration-c.ArenaMotion.profile('heavy_mace').duration/c.ArenaMotion.speedFactor(f))<1e-8,'other venues retain cadence');
 const attacker=sim.fighters[0],victim=sim.fighters[2];Object.assign(attacker,{x:0,z:0,angle:0});Object.assign(victim,{x:0,z:1,angle:Math.PI});
 for(const region of ['head','chest','legs'])for(const chain of [1,2,3]){
  Object.assign(attacker,{action:'idle',cooldown:0,stamina:100});assert.ok(sim.attack(0,chain===3,region));attacker.chain=chain;const p=attacker.attackProfile;
  const hits=z=>{victim.z=z;for(let t=p.wind;t<=p.wind+p.active;t+=1/120)if(c.ArenaMotion.contact(attacker,victim,t,t+1/120))return true;return false;};
  assert.ok(hits(1),region+' swing '+chain+' contacts an opponent in reach');assert.equal(hits(4),false,'mace never damages at a distance');
 }
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/tmp/chromium')?'/tmp/chromium':undefined),args:['--no-sandbox']});
 try{const page=await browser.newPage({viewport:{width:667,height:375},hasTouch:true});await page.setContent('<div id="pad" style="width:100px;height:100px;touch-action:none"></div><button id="attack">Attack</button>');await page.addScriptTag({path:path.join(root,'combat-pointer-v177.js')});
  await page.evaluate(()=>{window.motion=[0,0];window.enabled=true;window.control=CombatPointer.stick(document.getElementById('pad'),{active:()=>enabled,change:(x,y)=>motion=[x,y]});window.emit=(type,id,target='pad',extras={})=>{document.getElementById(target).dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:id,pointerType:'touch',clientX:95,clientY:58,buttons:1,...extras}));};});
  const moving=()=>page.evaluate(()=>Math.hypot(...motion)>.5),stopped=()=>page.evaluate(()=>motion.every(x=>x===0)&&!control.held);
  for(const type of ['pointerup','pointercancel','lostpointercapture']){await page.evaluate(()=>emit('pointerdown',8));assert.ok(await moving());await page.evaluate(type=>emit(type,8,'attack'),type);assert.ok(await stopped(),type+' outside the pad releases it');}
  await page.evaluate(()=>{emit('pointerdown',9);emit('pointerup',10,'attack');});assert.ok(await moving(),'lifting attack finger does not cancel movement');await page.waitForTimeout(750);assert.ok(await moving(),'holding still never expires');
  await page.evaluate(()=>{const start=new Event('touchstart',{bubbles:true});Object.defineProperty(start,'changedTouches',{value:[{identifier:44}]});document.getElementById('pad').dispatchEvent(start);const end=new Event('touchend',{bubbles:true});Object.defineProperty(end,'touches',{value:[{identifier:55}]});window.dispatchEvent(end);});assert.ok(await stopped(),'native touchend clears the missing pointerup even with another finger down');
  for(const type of ['blur','pagehide','orientationchange']){await page.evaluate(()=>emit('pointerdown',11));await page.evaluate(type=>window.dispatchEvent(new Event(type)),type);assert.ok(await stopped(),type);}
  await page.evaluate(()=>{emit('pointerdown',12,'pad',{pointerType:'mouse'});emit('pointermove',12,'attack',{pointerType:'mouse',buttons:0});});assert.ok(await stopped(),'released mouse cannot remain latched');
  await page.evaluate(()=>{emit('pointerdown',13);enabled=false;emit('pointermove',13);});assert.ok(await stopped(),'inactive combat releases input');
  console.log('V177 PASS: outside release, cancel, lost capture, native Safari touch reconciliation, multitouch, uninterrupted hold, lifecycle reset, exact +20% cadence, three authored mace clips, other venues unchanged.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
