const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.LUDUS_TIMING_ROOT||path.join(__dirname,'..'));
const source=fs.readFileSync(path.join(root,'arena.html'),'utf8');
function block(start){let depth=0;const first=source.indexOf('{',start);for(let i=first;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&!--depth)return source.slice(start,i+1);}throw Error('Unclosed source block');}
const animation=block(source.indexOf('function updateCharacterRoot('))+';'+block(source.indexOf('function animateCharacter('));
function fixture(distance=10,id=1,afterPose=()=>{}){
 const model={root:{position:{x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}},rotation:{y:0}}};
 const fighter={id,x:distance,z:0,angle:0,hp:100,action:'idle',move:1};
 const poses=[];
 const context=vm.createContext({naval:null,NavalPerformance:{...require('../naval-performance-v106.js'),character(){},shadow(){return true;}},combat:{fighters:[{x:0,z:0}]},GamePerformance:{characterShadows(){}},ImportedGladiator:{animate(f,m,t,dt){poses.push({t,dt,action:f.action});m.root.position.set(f.x,0,f.z);m.root.rotation.y=f.angle;afterPose(f,m);}}});
 vm.runInContext(fs.readFileSync(path.join(root,'arena-anatomy-v166.js'),'utf8'),context);
 vm.runInContext(animation,context);return{model,fighter,poses,animate:context.animateCharacter};
}
for(const [label,intervals] of Object.entries({'60 Hz':[1/60],'60.24 Hz':[.0166],'30.03 Hz':[.0333],'30 Hz':[1/30],'120 Hz':[1/120],'uneven frames':[.010,.018,.024,.013,.019]})){
 test('distant poses retain 30 Hz budget and world movement at '+label,()=>{
  const f=fixture();let elapsed=0,frames=0;
  while(elapsed<12){const dt=intervals[frames%intervals.length];elapsed+=dt;frames++;f.fighter.z+=dt*3;f.fighter.angle+=dt*.3;f.animate(f.fighter,f.model,elapsed,dt);
   assert.equal(f.model.root.position.z,f.fighter.z,'position must advance on skipped pose frames');assert.equal(f.model.root.rotation.y,f.fighter.angle);
  }
  const expected=Math.min(frames,elapsed*30);assert.ok(Math.abs(f.poses.length-expected)<2,`${f.poses.length} poses, expected about ${expected}`);
  const accounted=f.poses.reduce((sum,p)=>sum+p.dt,0)+(f.model.poseDelta||0);assert.ok(Math.abs(accounted-elapsed)<1e-8,'pose delta must preserve all elapsed time');
 });
}
test('nearby characters animate every display frame',()=>{const f=fixture(2);for(let n=0;n<240;n++)f.animate(f.fighter,f.model,n/120,1/120);assert.equal(f.poses.length,240);});
test('offscreen skeletons rest while world movement continues, then resume immediately',()=>{
 const f=fixture(20);f.model.root.visible=false;
 for(let n=0;n<120;n++){f.fighter.z+=.05;f.animate(f.fighter,f.model,n/60,1/60);assert.equal(f.model.root.position.z,f.fighter.z);}
 assert.equal(f.poses.length,0);f.model.root.visible=true;f.animate(f.fighter,f.model,2,1/60);
 assert.equal(f.poses.length,1);assert.ok(f.poses[0].dt<=.05,'returning poses do not jump through two seconds of animation');
});
test('nearby fighters keep their pose and shadow updates even outside the view',()=>{
 const f=fixture(2);f.model.root.visible=false;
 for(let n=0;n<30;n++)f.animate(f.fighter,f.model,n/60,1/60);assert.equal(f.poses.length,30);
});
test('attack, guard, reaction, movement and death transitions render immediately',()=>{
 const f=fixture();let t=0;const frame=()=>f.animate(f.fighter,f.model,t+=.005,.005);frame();
 for(const change of [{action:'attack'},{blocking:true},{reaction:.32},{move:0},{hp:0}]){const before=f.poses.length;Object.assign(f.fighter,change);frame();assert.equal(f.poses.length,before+1,JSON.stringify(change));}
});
for(const fps of [60,120])test('distant rolls and falls retain authored offsets and advance each display frame at '+fps+' Hz',()=>{
 for(const action of ['dodge','knocked']){
  let authoredHeading;
  const f=fixture(10,1,(fighter,model)=>{model.root.position.set(fighter.x+.3,.4,fighter.z-.2);model.root.rotation.y=authoredHeading=fighter.angle+Math.PI/2;});
  f.fighter.action=action;
  for(let n=0;n<fps;n++){
   f.fighter.z+=3/fps;f.fighter.angle+=.2/fps;f.animate(f.fighter,f.model,n/fps,1/fps);
   assert.ok(Math.abs(f.model.root.position.x-(f.fighter.x+.3))<1e-8);
   assert.ok(Math.abs(f.model.root.position.z-(f.fighter.z-.2))<1e-8,'roll/fall world translation must not freeze between skeleton poses');
   assert.equal(f.model.root.position.y,.4);
   assert.equal(f.model.root.rotation.y,authoredHeading,'roll/fall heading stays captured even while combat facing turns');
  }
  assert.ok(f.poses.length<=31,'full skeleton pose budget stays at 30 Hz');
 }
});
test('skipped death poses retain their captured heading',()=>{
 const f=fixture(10,1,(fighter,model)=>{model.root.rotation.y=.6;});
 Object.assign(f.fighter,{hp:0,action:'dead',angle:1.2});f.animate(f.fighter,f.model,0,1/120);
 f.fighter.angle=1.8;f.animate(f.fighter,f.model,1/120,1/120);
 assert.equal(f.poses.length,1);assert.equal(f.model.root.rotation.y,.6);
});
test('combo changes and restarted actions render before the distant pose deadline',()=>{
 const f=fixture();Object.assign(f.fighter,{action:'attack',timer:.3,chain:1});f.animate(f.fighter,f.model,0,1/120);
 f.fighter.chain=2;f.animate(f.fighter,f.model,1/120,1/120);assert.equal(f.poses.length,2);
 f.fighter.timer=.01;f.animate(f.fighter,f.model,2/120,1/120);assert.equal(f.poses.length,3);
});

function simulation(fps,withImpacts){
 const frameStart=source.indexOf('function frame(now)'),activeBlock=block(source.indexOf('if(active()){',frameStart)),events=block(source.indexOf('function events(){'));
 const context=vm.createContext({performance:{now:()=>0},active:()=>true,worldInput:()=>({}),syncSurvivalWave(){},floating(){},burst(){},audio(){},Math,combat:{time:0,ticks:0,fighters:[{id:0,x:0}],pending:[],tick(dt){this.time+=dt;this.ticks++;this.fighters[0].x+=dt*4.2;},drain(){return this.pending.splice(0);}}});
 vm.runInContext(fs.readFileSync(path.join(root,'arena-motion-stability-v165.js'),'utf8'),context);
 vm.runInContext('const motionTimeline=ArenaMotionStability.createTimeline();let accumulator=0,queuedAttack=null,hitStop=0,shake=0,hitUntil=0;'+events+';function step(now,dt){'+activeBlock+'}',context);
 const types=['hit','block','parry','bashhit'];
 for(let n=0;n<fps*10;n++){if(withImpacts&&n%5===0)context.combat.pending.push({type:types[Math.floor(n/5)%types.length],id:0,source:1,damage:1,metal:true,heavy:true});context.step(n*1000/fps,1/fps);}
 return {time:context.combat.time,distance:context.combat.fighters[0].x,ticks:context.combat.ticks};
}
for(const fps of [30,60,120])test('repeated impacts never pause simulation or movement at '+fps+' FPS',()=>{
 const quiet=simulation(fps,false),impacts=simulation(fps,true);assert.deepEqual(impacts,quiet);assert.ok(Math.abs(impacts.time-10)<1/60+.000001);assert.ok(Math.abs(impacts.distance-42)<.08);
});

for(const fps of [60,120])test('twenty distant arena poses spread evenly across frames at '+fps+' Hz',()=>{
 const group=Array.from({length:20},(_,i)=>fixture(12,i+1)),counts=[];
 for(let frame=0;frame<fps*3;frame++){
  let count=0;
  for(const f of group){const before=f.poses.length;f.animate(f.fighter,f.model,frame/fps,1/fps);count+=f.poses.length-before;}
  if(frame>fps)counts.push(count);
 }
 const maximum=Math.max(...counts),minimum=Math.min(...counts);
 assert.ok(maximum<=Math.ceil(20*30/fps)+2,JSON.stringify({fps,maximum,minimum}));
 assert.ok(minimum>=Math.floor(20*30/fps)-2,JSON.stringify({fps,maximum,minimum}));
 for(const f of group)assert.ok(Math.abs(f.poses.length-90)<2,'each fighter keeps 30 poses per second');
});
