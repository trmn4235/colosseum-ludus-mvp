/* Execute production input bindings against the real combat and replay engines.
 * CPU only: no renderer, network, account or production state. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rigRuntime}=require('./performance-v84.cjs');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const arenaSource=read('arena.html'),caravanSource=read('caravan-battle-v126.js');
function between(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'production fixture boundaries: '+start);return source.slice(a,b);
}
function sourceLine(source,start,optional=false){
 const lines=source.split('\n').filter(line=>line.trimStart().startsWith(start));
 if(optional&&!lines.length)return '';
 assert.equal(lines.length,1,'one production binding: '+start);return lines[0];
}
function events(){
 const nodes=new Map(),windowEvents=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{handlers:new Map(),addEventListener(type,fn){this.handlers.set(type,fn);}});return nodes.get(id);};
 return{node,listen:(type,fn)=>windowEvents.set(type,fn),
  pointer(id){node(id).handlers.get('pointerdown')({preventDefault(){}});},
  key(code,repeat=false){windowEvents.get('keydown')({code,repeat,target:{tagName:'CANVAS'},preventDefault(){}});}};
}
function arenaControls(runtime){
 const combat=new runtime.ArenaCombat(()=>.999).reset('normal','murmillo'),io=events(),notices=[];
 const sandbox={combat,naval:null,started:true,paused:false,keys:new Set(),touchGuardRegion:'head',
  worldInput:()=>({x:.6,z:.8}),toast:message=>notices.push(message),$:io.node,
  addEventListener:io.listen};
 sandbox.window=sandbox;sandbox.active=()=>sandbox.started&&!sandbox.paused&&!combat.finished;
 vm.createContext(sandbox);
 vm.runInContext([
  between(arenaSource,'function escape(','\nCombatEvasionControls.mount('),
  sourceLine(arenaSource,"$('dodge').addEventListener('pointerdown'"),
  sourceLine(arenaSource,"window.addEventListener('keydown',e=>")
 ].join('\n'),sandbox);
 return{sandbox,combat,fighter:combat.fighters[0],notices,perform:kind=>kind==='default'?sandbox.escape():kind==='touch'?io.pointer('dodge'):io.key(kind)};
}
test('arena primary touch, L and B execute a real roll with the existing cost and duration',async()=>{
 const runtime=await rigRuntime('arena.html',{skipEquipment:true});
 for(const input of ['default','touch','KeyL','KeyB']){
  const ui=arenaControls(runtime),f=ui.fighter;f.stamina=100;
  ui.perform(input);assert.equal(f.action,'dodge',input+' must roll, not use the step action');
  assert.equal(f.duration,.46);assert.equal(f.stamina,75);assert.equal(f.dx,.6);assert.equal(f.dz,.8);
  if(input==='touch')assert.equal(ui.sandbox.touchGuardRegion,null,'touch releases the previous directional guard');
  ui.perform(input);assert.equal(f.stamina,75,'repeated input cannot spend during an active roll');
  const exhausted=arenaControls(runtime);exhausted.fighter.stamina=24.999;exhausted.perform(input);
  assert.equal(exhausted.fighter.action,'idle');assert.equal(exhausted.fighter.stamina,24.999);
  assert.match(exhausted.notices.at(-1),/25 kondisyon/);
 }
 for(const setup of [ui=>{ui.sandbox.paused=true;},ui=>{ui.sandbox.naval={manual:true};},ui=>{ui.fighter.navJump={airborne:true};}]){
  const ui=arenaControls(runtime),before=ui.fighter.stamina;setup(ui);ui.perform('touch');
  assert.equal(ui.fighter.action,'idle');assert.equal(ui.fighter.stamina,before,'existing inactive/ship-control/jump guards stay intact');
 }
});
function caravanRuntime(){
 const c=vm.createContext({console});c.globalThis=c;
 for(const name of ['caravan-core-v126.js','combat-curves-v163.js','combat-motion-v163.js','caravan-simulation-v126.js','caravan-simulation-v127.js','caravan-simulation-v163.js','caravan-simulation-v168.js','caravan-defense-simulation-v230.js'])vm.runInContext(read(name),c,{filename:name});
 return c;
}
function ticket(version){
 return{encounter:{version:version===230?230:126,...(version===126?{}:{rules:version}),seed:12345,guards:2,archers:1},
  team:['murmillo','thraex'].map((type,i)=>({id:'roll-fixture-'+i,name:'Fighter '+i,class:type,overall:50,items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'}]})),
  ...(version===230?{workers:[{id:'worker',name:'Worker',armed:false,arrows:0,base_damage:9}]}:{})};
}
function caravanControls(c,sim,state){
 const io=events(),sandbox={sim,state,paused:false,queued:0,keys:new Set(),held:new Set(),keyFlags:{KeyJ:1,KeyK:2,ShiftLeft:2},
  stick:{x:.6,y:.8},cameraYaw:0,selectedRegion:'chest',guardRegion:null,$:io.node,addEventListener:io.listen,
  CaravanSimulation:c.CaravanSimulation,CaravanSimulationV127:c.CaravanSimulationV127,
  CaravanSimulationV163:c.CaravanSimulationV163,CaravanSimulationV168:c.CaravanSimulationV168,CaravanDefenseV230:c.CaravanDefenseV230};
 vm.createContext(sandbox);
 vm.runInContext([
  sourceLine(caravanSource,'function primaryRollFlag(',true),sourceLine(caravanSource,'function queue('),
  between(caravanSource,' function input(){','\n function bow('),
  sourceLine(caravanSource,"for(const [id,flag]of [['target',128]"),
  sourceLine(caravanSource,"addEventListener('keydown',e=>")
 ].join('\n'),sandbox);
 return{sandbox,perform:kind=>kind==='touch'?io.pointer('dodge'):io.key(kind),packet:()=>sandbox.input()};
}
test('caravan primary controls produce replayable modern roll packets and preserve legacy roll flags',()=>{
 for(const [version,name,flag]of [[126,'CaravanSimulation',4],[127,'CaravanSimulationV127',4],[163,'CaravanSimulationV163',1024],[168,'CaravanSimulationV168',1024],[230,'CaravanDefenseV230',1024]]){
  const runtime=caravanRuntime(),sim=runtime[name],snapshot=ticket(version);
  for(const input of ['touch','KeyL']){
   const state=sim.create(snapshot),ui=caravanControls(runtime,sim,state),f=state.combat.fighters[0],before=f.stamina;
   ui.perform(input);const packet=ui.packet();assert.equal(packet[3],flag,version+' '+input+' uses its real replay protocol');
   assert.ok(sim.valid(packet));assert.equal(ui.packet()[3],0,'queued roll is consumed once');
   sim.step(state,packet);assert.equal(f.action,'dodge',version+' '+input+' reaches the actual roll');
   assert.equal(f.duration,.46);assert.equal(before-f.stamina,25,'existing roll cost stays unchanged');
   const replay=sim.replay(snapshot,state.commands,state.steps),other=replay.combat.fighters[0];
   assert.deepEqual([other.action,other.duration,other.stamina,other.x,other.z],[f.action,f.duration,f.stamina,f.x,f.z],'same packet reproduces the same authoritative roll');
  }
 }
});
