const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{rigRuntime}=require('./performance-v84.cjs');
(async()=>{
 const c=await rigRuntime(),T=c.THREE,report=[];let samples=0;
 for(const kind of ['gladius','sica','mace','whip','spear','trident'])for(const left of [false,true])for(const region of ['head','chest','legs']){
  const sim=new c.ArenaCombat(()=>.999).reset('normal','murmillo');sim.botStep=()=>{};for(const f of sim.fighters)f.hp=0;
  const f=sim.fighters[0],v=sim.fighters[5];Object.assign(f,{hp:100,x:0,z:0,angle:0,weapon:kind,offhand:left?kind:null,shield:false,cooldown:0,attackLeft:left,move:0,agility:50});Object.assign(v,{hp:1000,x:0,z:1,angle:Math.PI,shield:false,cooldown:999});
  const m=c.ImportedGladiator.create(0,'murmillo');for(let n=0;n<15;n++)c.ImportedGladiator.animate(f,m,n/60,1/60);
  sim.attack(0,false,region);f.attackLeft=left;let error=0,minFoot=99,maxTip=-99;
  const duration=f.duration;for(let n=0;n<=Math.ceil(duration*60);n++){f.timer=Math.min(duration,n/60);c.ImportedGladiator.animate(f,m,1+n/60,1/60);const s=c.ArenaMotion.sample(f),anchor=left?m.offhandAnchor:m.weaponAnchor,grip=m.root.worldToLocal(anchor.getWorldPosition(new T.Vector3())),tip=m.root.worldToLocal(anchor.localToWorld(s.local?.length?new T.Vector3(s.local.at(-1).x,s.local.at(-1).y,s.local.at(-1).z):new T.Vector3(0,f.attackProfile.length-(s.choke||0),0)));
   error=Math.max(error,tip.distanceTo(new T.Vector3(s.tip.x,s.tip.y,s.tip.z)));maxTip=Math.max(maxTip,tip.z);for(const side of ['Left','Right'])minFoot=Math.min(minFoot,m.bones[side+'Foot'].getWorldPosition(new T.Vector3()).y);
   for(const [,b]of m.boneEntries)assert.ok(b.quaternion.toArray().every(Number.isFinite));samples++;
  }
  report.push({kind,left,region,error,minFoot,maxTip});c.ImportedGladiator.dispose(m);
 }
 const sim=new c.ArenaCombat(()=>.999).reset('normal','murmillo');sim.botStep=()=>{};const f=sim.fighters[0];const m=c.ImportedGladiator.create(30,'murmillo'),evades=[];
 for(const kind of ['duck','jump','step','roll']){Object.assign(f,{action:'idle',stamina:100,evadeReadyAt:0,x:0,z:0,angle:0});assert.ok(sim.evade(0,1,0,kind));const before=f.stamina;assert.equal(sim.evade(0,0,0,kind),false);assert.equal(f.stamina,before);let lowest=99,highest=-99,foot=99;
  const duration=f.duration;for(let n=0;n<=Math.ceil(duration*60);n++){f.timer=Math.min(duration,n/60);c.ImportedGladiator.animate(f,m,5+n/60,1/60);const head=m.bones.Head.getWorldPosition(new T.Vector3()).y;lowest=Math.min(lowest,head);highest=Math.max(highest,head);foot=Math.min(foot,m.bones.LeftFoot.getWorldPosition(new T.Vector3()).y,m.bones.RightFoot.getWorldPosition(new T.Vector3()).y);}
  evades.push({kind,lowest,highest,foot});
 }
 const result={samples,report,evades};fs.mkdirSync('docs/combat-animation-v163',{recursive:true});fs.writeFileSync('docs/combat-animation-v163/rig-validation.json',JSON.stringify(result,null,2));
 if(!process.env.LUDUS_RIG_DIAGNOSTIC){for(const r of report){assert.ok(r.error<.045,JSON.stringify(r));assert.ok(r.minFoot>-.05,JSON.stringify(r));if(['spear','trident'].includes(r.kind))assert.ok(r.maxTip<1,JSON.stringify(r));}assert.ok(evades[0].lowest<1.6);assert.ok(evades[1].highest>2.15);}
 console.log(JSON.stringify({samples,maxGripError:Math.max(...report.map(r=>r.error)),evades}));
})().catch(e=>{console.error(e);process.exitCode=1});
