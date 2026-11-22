// Real gladiator rigs: skipped mobile poses must preserve roll/fall transforms.
// CPU scene-graph validation; these checks are not a physical device FPS claim.
const assert=require('node:assert/strict');
const {rigRuntime}=require('./performance-v84.cjs');
const motion=require('../multiplayer-motion-v251.js');
const angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-7,`${message}: ${a} vs ${b}`);

async function main(){
 const c=await rigRuntime('multiplayer.html',{skipEquipment:true});
 const make=()=>{
  const f=new c.ArenaCombat().reset('normal','murmillo').fighters[0];
  Object.assign(f,{x:0,z:0,angle:0,hp:100,move:0,action:'idle',timer:0});
  const m=c.ImportedGladiator.create(0,'murmillo');
  c.ImportedGladiator.animate(f,m,0,1/60);motion.capturePoseRoot(f,m);
  return {f,m};
 };
 // Negative control: the released skip path reverses a real sideways roll by90°.
 {
  const {f,m}=make();Object.assign(f,{action:'dodge',timer:.15,duration:.46,dx:1,dz:0});
  c.ImportedGladiator.animate(f,m,.15,.05);const authored=m.root.rotation.y;
  assert.ok(angle(authored,f.angle)>1.5,'the fixture exercises an authored sideways roll');
  motion.capturePoseRoot(f,m);m.root.rotation.y=f.angle;
  assert.ok(angle(authored,m.root.rotation.y)>1.5,'old root reset visibly reverses the roll');
  motion.updatePoseRoot(f,m);near(angle(authored,m.root.rotation.y),0,'skipped pose retains sideways heading');
  c.ImportedGladiator.dispose(m);
 }
 const reports=[];
 for(const fps of [30,60,120])for(const distance of [3,8]){
  const {f,m}=make(),interval=motion.poseInterval(true,false,true,distance);
  let next=0,last=0,poses=0,skipped=0,rollingSkipped=0,previousAction=f.action;
  for(let frame=0;frame<=fps;frame++){
   const time=frame/fps,t=time*1000,rolling=time>=.15&&time<.61;
   f.x=time*.5;f.z=time*.25;
   Object.assign(f,{action:rolling?'dodge':'idle',timer:rolling?time-.15:0,duration:.46,dx:1,dz:0});
   if(t>=next||motion.poseChanged(f,m)){
    c.ImportedGladiator.animate(f,m,time,frame?(t-last)/1000:1/fps);
    motion.capturePoseRoot(f,m);last=t;next=t+interval;poses++;
   }else{
    const heading=m.root.rotation.y,offsetX=m.root.position.x-(frame-1)/fps*.5,offsetZ=m.root.position.z-(frame-1)/fps*.25;
    motion.updatePoseRoot(f,m);skipped++;
    near(angle(m.root.rotation.y,heading),0,`${fps}fps keeps heading between full poses`);
    near(m.root.position.x,f.x+offsetX,'root follows current fighter X without losing pose offset');
    near(m.root.position.z,f.z+offsetZ,'root follows current fighter Z without losing pose offset');
    if(rolling)rollingSkipped++;
   }
   if(previousAction==='dodge'&&!rolling){near(angle(m.root.rotation.y,f.angle),0,'roll exit updates immediately');assert.equal(m.authoredRoll,null);}
   previousAction=f.action;
  }
  assert.ok(rollingSkipped>0,'test covers skipped frames inside the roll');
  assert.ok(poses<=Math.ceil(1000/interval)+4,'root continuity does not remove the mobile pose budget');
  assert.ok(skipped>0);reports.push({fps,interval,poses,skipped,rollingSkipped});
  c.ImportedGladiator.dispose(m);
 }
 // A death captures both the previous facing and a short root-position transition.
 {
  const {f,m}=make();Object.assign(f,{x:2,z:3,angle:.6});
  c.ImportedGladiator.animate(f,m,.1,.1);
  Object.assign(f,{x:2.4,z:3.2,angle:1.1,hp:0,action:'dead',deadTime:.05});
  c.ImportedGladiator.animate(f,m,.15,.05);motion.capturePoseRoot(f,m);
  const saved={x:m.root.position.x,z:m.root.position.z,heading:m.root.rotation.y};
  assert.ok(Math.abs(saved.x-f.x)>.3,'real death fixture includes a captured root offset');
  near(angle(saved.heading,.6),0,'death keeps its pre-death facing');
  f.x+=.1;f.z+=.2;f.angle=1.4;motion.updatePoseRoot(f,m);
  near(m.root.position.x,saved.x+.1,'death translation follows fighter reconciliation');
  near(m.root.position.z,saved.z+.2,'death translation retains captured offset');
  near(angle(m.root.rotation.y,saved.heading),0,'death heading stays captured on skipped frames');
  Object.assign(f,{hp:100,action:'idle',timer:0});assert.equal(motion.poseChanged(f,m),true,'revival requires a fresh pose');
  motion.updatePoseRoot(f,m);near(m.root.position.x,f.x,'stale death offset is not reused after revival');
  c.ImportedGladiator.dispose(m);
 }
 {
  const {f,m}=make();Object.assign(f,{action:'dodge',timer:.3,chain:1});motion.capturePoseRoot(f,m);
  f.timer=.01;assert.equal(motion.poseChanged(f,m),true,'restarted action requires a fresh pose');
  f.timer=.4;f.chain=2;assert.equal(motion.poseChanged(f,m),true,'next combo swing requires a fresh pose');
  c.ImportedGladiator.dispose(m);
 }
 console.log('PASS V291 authored roll/fall root continuity at30/60/120fps with50/100ms pose budgets: '+JSON.stringify(reports));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
