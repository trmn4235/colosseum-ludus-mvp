// Offline, reproducible sampling of publisher-distributed clips. No source meshes are shipped.
// Usage: node tools/bake-combat-motion-v163.mjs SOURCE_DIR THREE_PACKAGE_DIR
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const source=path.resolve(process.argv[2]),dependency=path.resolve(process.argv[3]);
const T=await import(pathToFileURL(path.join(dependency,'build/three.module.js')));
const {GLTFLoader}=await import(pathToFileURL(path.join(dependency,'examples/jsm/loaders/GLTFLoader.js')));
const {FBXLoader}=await import(pathToFileURL(path.join(dependency,'examples/jsm/loaders/FBXLoader.js')));
globalThis.ProgressEvent=class{constructor(type,data){Object.assign(this,data);}};
globalThis.self=globalThis;
const root=path.resolve(import.meta.dirname,'..');
const definitions=[
 ['pole','kevin','HumanM@AttackPolearm01.fbx',null,.22,.42],
 ['poleIdle','kevin','HumanM@CombatIdlePolearm01.fbx'],
 ['slash','kevin','HumanM@Attack1H01_R.fbx',null,.28,.46],
 ['shieldBash','kevin','HumanM@AttackShield01.fbx',null,.25,.48],
 ['crouch','quaternius','quaternius1.glb','Crouch_Idle_Loop'],
 ['jumpStart','quaternius','quaternius1.glb','Jump_Start'],
 ['jumpAir','quaternius','quaternius1.glb','Jump_Loop'],
 ['jumpLand','quaternius','quaternius1.glb','Jump_Land'],
 ['hitChest','quaternius','quaternius1.glb','Hit_Chest'],
 ['hitHead','quaternius','quaternius1.glb','Hit_Head'],
 ['jab','quaternius','quaternius1.glb','Punch_Jab',.2,.45],
 ['cross','quaternius','quaternius1.glb','Punch_Cross',.2,.45],
 ['swordA','quaternius','quaternius2.glb','Sword_Regular_A',.28,.62],
 ['swordB','quaternius','quaternius2.glb','Sword_Regular_B',.28,.62],
 ['guard','quaternius','quaternius2.glb','Idle_Shield_Loop'],
 ['guardHit','quaternius','quaternius2.glb','Shield_OneShot'],
 ['block','quaternius','quaternius2.glb','Sword_Block'],
 ['throw','quaternius','quaternius2.glb','OverhandThrow',.25,.4],
 ['dodgeLeft','kaykit','kaykit-MovementAdvanced.glb','Dodge_Left'],
 ['dodgeRight','kaykit','kaykit-MovementAdvanced.glb','Dodge_Right'],
 ['dodgeBack','kaykit','kaykit-MovementAdvanced.glb','Dodge_Backward'],
 ['dodgeForward','kaykit','kaykit-MovementAdvanced.glb','Dodge_Forward'],
 ['stab','kaykit','kaykit-CombatMelee.glb','Melee_1H_Attack_Stab',.28,.55],
 ['chop','kaykit','kaykit-CombatMelee.glb','Melee_1H_Attack_Chop',.30,.58],
 ['bowDraw','kaykit','kaykit-CombatRanged.glb','Ranged_Bow_Draw'],
 ['bowRelease','kaykit','kaykit-CombatRanged.glb','Ranged_Bow_Release'],
];
if(fs.existsSync(path.join(source,'HumanM@ThrowSpear01_R.fbx')))definitions.push(['spearThrow','kevin','HumanM@ThrowSpear01_R.fbx',null,.30,.53]);
const maps={
 quaternius:{Hips:'pelvis',Spine:'spine_01',Spine1:'spine_02',Spine2:'spine_03',Neck:'neck_01',Head:'Head'},
 kevin:{Hips:'B-hips',Spine:'B-spine',Spine1:'B-chest',Spine2:'B-chest',Neck:'B-neck',Head:'B-head'},
 kaykit:{Hips:'hips',Spine:'spine',Spine1:'chest',Spine2:'chest',Neck:'head',Head:'head'}
};
for(const side of ['Left','Right'])for(const [key,q,k,y] of [['Arm','upperarm','upperArm','upperarm'],['ForeArm','lowerarm','forearm','lowerarm'],['Hand','hand','hand','hand'],['UpLeg','thigh','thigh','upperleg'],['Leg','calf','shin','lowerleg'],['Foot','foot','foot','foot'],['ToeBase','ball','toe','toes']]){
 maps.quaternius[side+key]=q+'_'+side[0].toLowerCase();maps.kevin[side+key]='B-'+k+side[0];maps.kaykit[side+key]=y+'.'+side[0].toLowerCase();
}
const clipData={},curves={},manifest=[];
const round=x=>+x.toFixed(5),vec=v=>v.toArray().map(round),ends={Arm:'ForeArm',ForeArm:'Hand',UpLeg:'Leg',Leg:'Foot',Foot:'ToeBase'};
for(const [id,family,filename,original,wind=.25,impact=.55] of definitions){
 const buffer=fs.readFileSync(path.join(source,filename)),array=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
 let scene,clips;
 if(filename.endsWith('.fbx')){try{scene=new FBXLoader().parse(array,'');clips=scene.animations;}catch(error){if(id!=='spearThrow')throw error;console.warn('Optional spear-throw FBX has orphan animation connections; validated Quaternius throw is retained.');continue;}}
 else{const loader=new GLTFLoader();loader.register(()=>({name:'OFFLINE_TEXTURE_SKIP',loadTexture:()=>Promise.resolve(new T.Texture())}));const gltf=await loader.parseAsync(array,'');scene=gltf.scene;clips=gltf.animations;}
 const wrapper=new T.Group();wrapper.add(scene);wrapper.updateMatrixWorld(true);
 const lookup={};scene.traverse(o=>lookup[o.name]=o);const names=maps[family],bones=Object.fromEntries(Object.entries(names).map(([key,name])=>[key,lookup[name]||lookup[T.PropertyBinding.sanitizeNodeName(name)]]));
 if(Object.values(bones).some(b=>!b))throw Error(id+': missing bones '+Object.entries(bones).filter(([k,v])=>!v).map(([k])=>k));
 const up=bones.Head.getWorldPosition(new T.Vector3()).sub(bones.Hips.getWorldPosition(new T.Vector3()));
 if(Math.abs(up.z)>Math.abs(up.y))wrapper.rotation.x=-Math.PI/2;
 wrapper.updateMatrixWorld(true);
 const hip=bones.Hips.getWorldPosition(new T.Vector3()),floor=Math.min(bones.LeftToeBase.getWorldPosition(new T.Vector3()).y,bones.RightToeBase.getWorldPosition(new T.Vector3()).y),height=hip.y-floor;
 if(!(height>0))throw Error('Invalid hip height '+id);
 const normal=1/height,rest=Object.fromEntries(Object.entries(bones).map(([key,bone])=>[key,bone.getWorldQuaternion(new T.Quaternion())]));
 const clip=original?clips.find(c=>c.name===original):clips[0];if(!clip)throw Error('Missing clip '+original);
 const mixer=new T.AnimationMixer(wrapper),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const frames=Math.min(73,Math.max(13,Math.ceil(clip.duration*24)+1)),rotations={},directions={},hips=[],hands={Left:[],Right:[]},feet={Left:[],Right:[]};
 for(let n=0;n<frames;n++){
  mixer.setTime(n/(frames-1)*Math.max(0,clip.duration-1e-6));wrapper.updateMatrixWorld(true);
  for(const [key,bone] of Object.entries(bones)){
   const q=bone.getWorldQuaternion(new T.Quaternion()).multiply(rest[key].clone().invert());(rotations[key]??=[]).push(vec(q));
  }
  for(const side of ['Left','Right'])for(const [part,end] of Object.entries(ends)){
   const d=bones[side+end].getWorldPosition(new T.Vector3()).sub(bones[side+part].getWorldPosition(new T.Vector3())).normalize();(directions[side+part]??=[]).push(vec(d));
  }
  hips.push(vec(bones.Hips.getWorldPosition(new T.Vector3()).sub(hip).multiplyScalar(normal)));
  for(const side of ['Left','Right']){
   const hand=bones[side+'Hand'].getWorldPosition(new T.Vector3());hand.x-=hip.x;hand.y-=floor;hand.z-=hip.z;hands[side].push(vec(hand.multiplyScalar(normal)));
   const foot=bones[side+'Foot'].getWorldPosition(new T.Vector3());foot.x-=hip.x;foot.y-=floor;foot.z-=hip.z;feet[side].push(vec(foot.multiplyScalar(normal)));
  }
 }
 // A single neutral basis makes bone-axis differences explicit; authored rotations remain intact.
 clipData[id]={family,original:clip.name,duration:round(clip.duration),frames,hipHeight:1,rotations,directions,hips,feet};
 curves[id]={frames,duration:round(clip.duration),wind,impact,hands,hips};
 manifest.push({id,family,file:filename,original:clip.name,sourceSha256:crypto.createHash('sha256').update(buffer).digest('hex'),frames,duration:clip.duration});
 mixer.stopAllAction();
}
const header='/* V163 publisher-authored motion, sampled offline; see ANIMATION_ASSETS.md. */\n';
fs.writeFileSync(path.join(root,'arena-authored-data-v163.js'),header+'var LUDUS_AUTHORED_MOTION='+JSON.stringify({version:163,clips:clipData})+';\n');
fs.writeFileSync(path.join(root,'combat-curves-v163.js'),header+'var LUDUS_COMBAT_CURVES='+JSON.stringify({version:163,clips:curves})+';\nif(typeof globalThis!=="undefined")globalThis.LUDUS_COMBAT_CURVES=LUDUS_COMBAT_CURVES;\n');
fs.mkdirSync(path.join(root,'docs/combat-animation-v163'),{recursive:true});fs.writeFileSync(path.join(root,'docs/combat-animation-v163/source-manifest.json'),JSON.stringify({version:163,samplingHz:24,clips:manifest},null,2)+'\n');
console.log(JSON.stringify({clips:manifest.length,poseBytes:fs.statSync(path.join(root,'arena-authored-data-v163.js')).size,curveBytes:fs.statSync(path.join(root,'combat-curves-v163.js')).size}));
