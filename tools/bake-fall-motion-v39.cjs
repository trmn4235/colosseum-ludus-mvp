// Reproduce the authored 30 fps motion from the CC0 glTF, without importing its mesh.
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({console,URL,Blob,fetch,Request,Response,Headers,TextDecoder,TextEncoder,atob,btoa,AbortController,setTimeout,clearTimeout,ProgressEvent:class{constructor(t,v){Object.assign(this,v);}}});vm.runInContext(fs.readFileSync(root+'/owner-three-r160.js','utf8'),ctx);const T=ctx.THREE;
(async()=>{
 const source=process.argv[2];if(!source)throw Error('Usage: node tools/bake-fall-motion-v39.cjs /absolute/path/AnimationLibrary_Godot_Standard.gltf');const doc=JSON.parse(fs.readFileSync(source));doc.buffers.forEach(b=>b.uri='data:application/octet-stream;base64,'+fs.readFileSync(path.join(path.dirname(source),b.uri)).toString('base64'));
 const g=await new T.GLTFLoader().parseAsync(JSON.stringify(doc),'');g.scene.updateMatrixWorld(true);const names={Hips:'DEF-hips',Spine:'DEF-spine.001',Spine1:'DEF-spine.002',Spine2:'DEF-spine.003',Neck:'DEF-neck',Head:'DEF-head'};
 for(const side of ['Left','Right'])for(const [suffix,name]of Object.entries({Arm:'upper_arm',ForeArm:'forearm',Hand:'hand',UpLeg:'thigh',Leg:'shin',Foot:'foot',ToeBase:'toe'}))names[side+suffix]='DEF-'+name+'.'+side[0];
 const bones={},rest={},initial={};for(const [key,name]of Object.entries(names)){const i=doc.nodes.findIndex(n=>n.name===name);bones[key]=await g.parser.getDependency('node',i);rest[key]=bones[key].getWorldQuaternion(new T.Quaternion());initial[key]={p:bones[key].position.clone(),q:bones[key].quaternion.clone(),s:bones[key].scale.clone()};}
 const clip=g.animations.find(c=>c.name==='Death01'),mixer=new T.AnimationMixer(g.scene);mixer.clipAction(clip).play();const duration=clip.duration,frames=Math.ceil(duration*30)+1,rotations={},directions={},hips=[],ends={Arm:'ForeArm',ForeArm:'Hand',UpLeg:'Leg',Leg:'Foot',Foot:'ToeBase'};let start;
 for(let k=0;k<frames;k++){
  mixer.setTime(k/(frames-1)*(duration-1e-6));g.scene.updateMatrixWorld(true);
  for(const [key,bone]of Object.entries(bones)){const q=bone.getWorldQuaternion(new T.Quaternion()).multiply(rest[key].clone().invert());(rotations[key]??=[]).push(q.toArray().map(v=>+v.toFixed(6)));}
  for(const side of ['Left','Right'])for(const [suffix,end]of Object.entries(ends)){const dir=bones[side+end].getWorldPosition(new T.Vector3()).sub(bones[side+suffix].getWorldPosition(new T.Vector3())).normalize();(directions[side+suffix]??=[]).push(dir.toArray().map(v=>+v.toFixed(6)));}
  const p=bones.Hips.getWorldPosition(new T.Vector3());if(!start)start=p.clone();hips.push(p.sub(start).toArray().map(v=>+v.toFixed(6)));
 }
 const data={version:1,author:'Quaternius',license:'CC0-1.0',source:'https://quaternius.com/packs/universalanimationlibrary.html',clip:{original:'Death01',duration,frames,hipHeight:+start.y.toFixed(6),rotations,directions,hips}};fs.writeFileSync(root+'/arena-fall-motion-v39.js','/* Quaternius Death01, CC0. World-space motion sampled at 30 fps; see ANIMATION_ASSETS.md. */\nvar LUDUS_FALL_MOTION='+JSON.stringify(data)+';\n');
 console.log(JSON.stringify({duration,frames,hipStart:hips[0],hipEnd:hips.at(-1),head:directions.LeftLeg.at(-1),bytes:fs.statSync(root+'/arena-fall-motion-v39.js').size}));
})().catch(e=>{console.error(e);process.exitCode=1});
