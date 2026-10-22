// Calibrate captured hands on the shipped rig; the same points drive visual IK and collision.
const fs=require('node:fs'),{rigRuntime}=require('../tests/performance-v84.cjs');
(async()=>{
 const c=await rigRuntime(),T=c.THREE,data=c.LUDUS_COMBAT_CURVES,m=c.ImportedGladiator.create(0,'murmillo');
 const f=new c.ArenaCombat(()=>.99).reset('normal','murmillo').fighters[0];Object.assign(f,{x:0,z:0,angle:0,action:'attack',attackLeft:false,attackWeapon:'gladius',attackRegion:'chest',attackKind:'light',attackProfile:c.ArenaMotion.profile('gladius'),reaction:0});
 const names=['pole','slash','swordA','swordB','stab','chop','jab','cross'];
 for(const name of names){const clip=c.LUDUS_AUTHORED_MOTION.clips[name],hands={Right:[],Left:[]};c.ArenaAuthoredCombat.clipName=()=>name;m.authored163={age:1};
  for(let i=0;i<clip.frames;i++){c.ArenaAuthoredCombat.phase=()=>i/(clip.frames-1);for(const [n,b]of m.boneEntries)b.quaternion.copy(m.rest.get(n).q);m.root.position.set(0,0,0);m.root.rotation.set(0,0,0);m.body.position.set(0,0,0);m.body.rotation.set(0,0,0);c.ArenaAuthoredMotion.apply(f,m,0);m.root.updateMatrixWorld(true);for(const side of ['Right','Left'])hands[side].push(m.root.worldToLocal(m.bones[side+'Hand'].getWorldPosition(new T.Vector3())).toArray().map(v=>Number(v.toFixed(5))));}
  data.clips[name].rigHands=hands;
 }
 fs.writeFileSync('combat-curves-v163.js','/* Captured motion + calibrated hands on the original gladiator. Generated offline. */\nglobalThis.LUDUS_COMBAT_CURVES='+JSON.stringify(data)+';\n');const manifestFile='docs/combat-animation-v163/source-manifest.json',manifest=JSON.parse(fs.readFileSync(manifestFile));manifest.targetRigSha256=require('node:crypto').createHash('sha256').update(fs.readFileSync('gladiator-mobile.glb')).digest('hex');fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');c.ImportedGladiator.dispose(m);
})().catch(e=>{console.error(e);process.exitCode=1});
