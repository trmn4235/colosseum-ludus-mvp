// Reproduce: node tools/bake-bandit-locomotion-v170.mjs FBX_DIRECTORY THREE_PACKAGE_DIRECTORY
// Deterministic skeletal sampling only. Source meshes/textures are not included.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const source=path.resolve(process.argv[2]),dep=path.resolve(process.argv[3]);
const T=await import(pathToFileURL(path.join(dep,'build/three.module.js')));
const {FBXLoader}=await import(pathToFileURL(path.join(dep,'examples/jsm/loaders/FBXLoader.js')));
T.TextureLoader.prototype.load=()=>new T.Texture();
globalThis.window={URL:{createObjectURL:()=>''}};
const links={UpLeg:'Leg',Leg:'Foot',Foot:'ToeBase',Arm:'ForeArm',ForeArm:'Hand'},torso=['Hips','Spine','Spine1','Spine2','Neck','Head'];
const round=x=>+x.toFixed(6),vec=v=>v.toArray().map(round);
function load(id){const file='Bandit@'+id+'.fbx',bytes=fs.readFileSync(path.join(source,file));return {file,hash:crypto.createHash('sha256').update(bytes).digest('hex'),scene:new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')};}
const reference=load('idle').scene;reference.updateMatrixWorld(true);
const rest=Object.fromEntries(torso.map(k=>[k,reference.getObjectByName(k).getWorldQuaternion(new T.Quaternion()).invert()]));
const clips={};
for(const [id,file]of [['walk','walk'],['run','run_forward'],['idle','idle']]){
 const {scene,hash}=load(file);scene.updateMatrixWorld(true);
 // FBX has duplicate rig names; AnimationMixer binds the FIRST matching node.
 const bone=k=>scene.getObjectByName(k),position=k=>bone(k).getWorldPosition(new T.Vector3());
 const legLength=['Left','Right'].reduce((sum,s)=>sum+position(s+'UpLeg').distanceTo(position(s+'Leg'))+position(s+'Leg').distanceTo(position(s+'Foot')),0)/2;
 const unit=1/legLength,clip=scene.animations[0],mixer=new T.AnimationMixer(scene),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 const frames=49,directions={},rotations={},lift=[],footZ=[];
 for(let i=0;i<frames;i++){
  mixer.setTime(i/(frames-1)*(clip.duration-1e-6));scene.updateMatrixWorld(true);
  for(const k of torso)(rotations[k]??=[]).push(bone(k).getWorldQuaternion(new T.Quaternion()).multiply(rest[k]));
  for(const side of ['Left','Right'])for(const [a,b]of Object.entries(links))(directions[side+a]??=[]).push(position(side+b).sub(position(side+a)).normalize());
  lift.push(position('Hips').y*unit);footZ.push((position('LeftFoot').z-position('Hips').z)*unit);
 }
 // Align the forward-most left foot across both travel cycles, close seams gradually.
 const shift=id==='idle'?0:footZ.slice(0,-1).indexOf(Math.max(...footZ.slice(0,-1)));
 const phase=a=>{const p=a.slice(0,-1);return [...p.slice(shift),...p.slice(0,shift),p[shift]];};
 for(const [key,a]of Object.entries(directions)){const drift=a.at(-1).clone().sub(a[0]);directions[key]=phase(a.map((v,i)=>vec(v.addScaledVector(drift,-i/(frames-1)).normalize())));}
 for(const [key,a]of Object.entries(rotations)){const drift=a[0].clone().multiply(a.at(-1).clone().invert());rotations[key]=phase(a.map((q,i)=>vec(new T.Quaternion().slerp(drift,i/(frames-1)).multiply(q).normalize())));}
 const baseline=lift.reduce((s,v)=>s+v,0)/frames,drift=lift.at(-1)-lift[0];
 // In-place recordings contain no travel. Keep the established target run stride (3.11 leg lengths);
 // foot excursion alone underestimates running travel during flight. Walk uses measured excursion.
 const stride=id==='idle'?0:id==='run'?3.11:2*(Math.max(...footZ)-Math.min(...footZ));
 clips[id]={source:'Bandit@'+file+'.fbx',sha256:hash,frames,duration:round(clip.duration),legLength:1,stride:round(stride),speed:round(stride/clip.duration),directions,rotations,lift:phase(lift.map((v,i)=>round(v-baseline-drift*i/(frames-1))))};
 mixer.stopAllAction();
}
const output={version:170,source:'tokeshi / Fantasy Bandit / CGTrader',clips};
fs.writeFileSync('arena-locomotion-data-v170.js','/* Selected Fantasy Bandit movement; attribution and calibration: docs/locomotion-v170.md. */\nObject.assign(ARENA_LOCOMOTION.clips,'+JSON.stringify(clips)+');\nARENA_LOCOMOTION.version=170;\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(clips).map(([k,c])=>[k,{duration:c.duration,stride:c.stride,speed:c.speed}]))));
