const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({console,TextDecoder,TextEncoder,URL,Blob});
vm.runInContext(fs.readFileSync(path.join(root,'owner-avatar.js'),'utf8'),ctx);const owner=vm.runInContext('LudusOwner',ctx);
test('cosmetics restrict natural colours, link facial hair and retain only white clothing',()=>{
 const a=owner.normalize({version:2,hair:'unknown',skin:'#000080',skinTone:999,hairColor:'#00ff00',beardColor:'#ff0000',height:999,weight:-5,muscle:Infinity,outfit:'imperial',cloth:'#ff0000'});
 assert.equal(a.hair,owner.defaults.hair);assert.equal(a.hairColor,owner.defaults.hairColor);assert.equal(a.beardColor,a.hairColor);assert.equal(a.browColor,a.hairColor);assert.equal(a.skinTone,1);assert.equal(a.weight,0);assert.equal(a.height,200);assert.equal(a.outfit,'tunic');assert.equal(a.cloth,owner.defaults.cloth);
 assert.equal(owner.normalize({version:2,weight:.37,skinTone:.58}).weight,.37);assert.equal(owner.normalize({version:2,weight:.37,skinTone:.58}).skinTone,.58);
 assert.equal(owner.normalize({body:'stocky'}).weight,.85);
});
test('downloaded model includes a real skinned body and matching anatomy/clothing morphs',()=>{
 const bytes=fs.readFileSync(path.join(root,'owner-makehuman-v27.glb'));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.length,bytes.readUInt32LE(8));
 const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert.ok(doc.skins.some(s=>s.joints.length>=40));
 for(const part of ['OwnerSkin','OwnerWhiteTunic','Hair_short','Hair_crop','Beard_full','Beard_moustache','Brow_natural','OwnerSandals','Hair_swept','Hair_parted','Hair_waves','Beard_scruffy','Beard_handlebar','Brow_arched']){
  const node=doc.nodes.find(n=>n.extras?.part===part);assert.ok(node,part);assert.ok(node.skin!==undefined,part+' skin');const mesh=doc.meshes[node.mesh];assert.deepEqual(mesh.extras.targetNames,['Thin','Heavy','Muscular','Soft']);
  for(const primitive of mesh.primitives){assert.ok(primitive.attributes.JOINTS_0!==undefined);assert.equal(primitive.targets.length,4);const count=doc.accessors[primitive.attributes.POSITION].count;for(const target of primitive.targets)assert.equal(doc.accessors[target.POSITION].count,count);}
 }
 for(const name of ['OwnerWalk','OwnerIdle']){const clip=doc.animations.find(a=>a.name===name);assert.ok(clip,name);assert.ok(clip.channels.length>=30);assert.ok(clip.samplers.some(s=>doc.accessors[s.input].count>10));}
 assert.ok(bytes.length<25*1024*1024,'mobile asset budget');
});
