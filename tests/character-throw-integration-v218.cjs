/* Execute the production rendering callsites with controlled presentation
 * dependencies. These checks cover scheduling and projection, not GPU pixels. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(process.env.LUDUS_TEST_ROOT||path.join(__dirname,'..'));
const read=file=>fs.readFileSync(path.join(root,file),'utf8'),noop=()=>{};
function loadHelpers(context){vm.runInContext(read('arena-anatomy-v166.js'),context,{filename:'arena-anatomy-v166.js'});}
function model(){return {root:{visible:true,position:{set:noop},rotation:{}},teamMark:{visible:true},gear:{},poseBudget:0};}
function fighter(id,left=false){return {id,team:0,x:id*10,z:0,angle:0,hp:100,maxHp:100,stamina:70,maxStamina:100,action:'spearcast',timer:.2,duration:.7,attackLeft:left,weapon:left?'gladius':null,offhand:null,move:0,reaction:0,guardFlash:0,absoluteBlockUntil:0,pickupHand:left?'offhand':'weapon',name:'Fixture'};}
function snapshot(fighters,shots){return JSON.stringify({fighters,shots});}
function caravanChecks(){
 const source=read('caravan-battle-v126.js'),start=source.indexOf(' function renderActors(dt){'),end=source.indexOf('\n function frame(dt){',start);
 assert.ok(start>=0&&end>start,'production caravan renderer boundaries');
 let frames=0,cases=0;
 for(const left of [false,true])for(const outcome of ['launch','cancel','death']){
  const f=fighter(1,left),p={...fighter(0),action:'idle',weapon:'gladius'},fighters=[p,f],shot={owner:1,kind:left?'sica':'spear',launched:false,age:.2},shots=[shot],models=[model(),model()],calls=[];
  const c={fighters,projectiles:shots,arrows:[],time:1,finished:false,lockedTarget:null,enemy:()=>false,alive:()=>1};
  const elements=new Map(),element=id=>{if(!elements.has(id))elements.set(id,{style:{},setAttribute:noop});return elements.get(id);};
  const context=vm.createContext({state:{combat:c},accumulator:0,sim:{STEP:1/30},motionTimeline:{read:live=>({...live,timer:.24})},hudClock:0,hudState:'',paused:false,models,bars:[],arrowMeshes:[],
   field:{camera:{position:{lerp:noop},lookAt:noop},height:()=>0,startleHorses:noop},GamePerformance:{beginVisibility:noop,characterVisibility:noop,characterShadows:noop},
   NavalPerformance:{beginFrame:noop,focus:()=>false,character:noop,interval:()=>.1,phase:()=>0,shadow:()=>false},ArenaRuntime:{settleCorpse:noop},
   ImportedGladiator:{animate:(pose,m,time,dt)=>{calls.push({pose,m,time,dt});m.renderedWeapon=pose.weapon;m.renderedOffhand=pose.offhand;}},
   THREE:{Vector3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}}},innerWidth:800,innerHeight:400,cameraYaw:0,cameraPitch:.57,ticket:{team:[{},{}]},$:element,renderEquipment:noop,firstDeathSeen:true,performance:{now:()=>0},toastUntil:Infinity});
  loadHelpers(context);vm.runInContext(source.slice(start,end),context,{filename:'caravan-renderActors-production.js'});
  const draw=()=>{const before=snapshot(fighters,shots),at=calls.length;context.renderActors(.001);assert.equal(snapshot(fighters,shots),before,'caravan render mutated combat');frames++;return calls.slice(at).filter(row=>row.pose.id===f.id);};
  // No previous model weapon is available: a first frame can arrive mid-wind-up.
  let rows=draw();assert.equal(rows.length,1,'first distant wind-up must render');
  assert.equal(rows[0].pose[left?'offhand':'weapon'],shot.kind,'caravan restores the live throwing hand');
  assert.equal(rows[0].pose[left?'weapon':'offhand'],f[left?'weapon':'offhand'],'caravan preserves other hand');
  assert.equal(f[left?'offhand':'weapon'],null,'true inventory stays empty');
  assert.equal(rows[0].pose.timer,.24,'display interpolation is retained');
  assert.equal(draw().length,0,'unchanged distant wind-up remains throttled');
  if(outcome==='launch'){shot.launched=true;shot.age=.3;f.timer=.3;}
  else if(outcome==='cancel'){f.action='hurt';shots.length=0;}
  else f.hp=0;
  rows=draw();assert.equal(rows.length,1,outcome+' forces a render below the pose interval');
  assert.equal(rows[0].pose[left?'offhand':'weapon'],null,outcome+' removes the held weapon');
  if(outcome==='launch'){assert.equal(rows[0].pose.timer,.24,'release beats a stale display timer');assert.equal(draw().length,0,'completed release resumes throttling');}
  if(outcome!=='death'){f.action='idle';shots.length=0;rows=draw();assert.equal(rows.length,1,'recovery renders');assert.equal(rows[0].pose[left?'offhand':'weapon'],null,'recovery never resurrects the thrown item');}
  cases++;
 }
 return {cases,frames};
}
function pitChecks(){
 const source=read('pit-visit-v172.js'),callback=source.split('\n').find(line=>line.includes('rigs.forEach(({f,m},i)=>')&&line.includes('ImportedGladiator.animate'));
 assert.ok(callback,'production exhibition rendering callback');let frames=0,cases=0;
 for(const left of [false,true])for(const outcome of ['launch','cancel','death']){
  const f=fighter(0,left),shot={owner:0,kind:left?'sica':'spear',launched:false,age:.2},shots=[shot],m=model(),missing=model(),excluded=model(),calls=[];
  const rigs=[{f,m},{f:null,m:missing},{f:{...fighter(2),action:'idle'},m:excluded}];
  const context=vm.createContext({rigs,exhibition:{elapsed:1,combat:{projectiles:shots}},state:{bout:{participants:2}},view:'watch',dt:1/30,
   ImportedGladiator:{animate:pose=>calls.push(pose)}});loadHelpers(context);
  const draw=()=>{const before=snapshot(rigs.map(r=>r.f),shots),at=calls.length;vm.runInContext(callback,context,{filename:'pit-render-callback-production.js'});assert.equal(snapshot(rigs.map(r=>r.f),shots),before,'exhibition render mutated combat');frames++;return calls.slice(at).find(row=>row.id===0);};
  let pose=draw();assert.equal(pose[left?'offhand':'weapon'],shot.kind,'exhibition restores pending weapon on first render');
  assert.equal(m.root.visible,true,'participant remains visible');assert.equal(missing.root.visible,false,'missing participant hidden');assert.equal(excluded.root.visible,false,'participant limit preserved');assert.equal(m.teamMark.visible,false,'exhibition hides team markers');
  if(outcome==='launch'){shot.launched=true;shot.age=.3;f.timer=.24;}
  else if(outcome==='cancel'){f.action='hurt';shots.length=0;}
  else f.hp=0;
  pose=draw();assert.equal(pose[left?'offhand':'weapon'],null,outcome+' clears exhibition held mesh');
  context.view='overview';draw();assert.equal(m.root.visible,false,'leaving watch hides fighter');cases++;
 }
 return {cases,frames};
}
function run(){return {caravan:caravanChecks(),exhibition:pitChecks(),note:'Production callsite execution with controlled rendering dependencies; GPU and physical-device validation are separate.'};}
if(require.main===module)try{console.log(JSON.stringify(run(),null,2));}catch(error){console.error(error);process.exitCode=1;}
module.exports={run};
