const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {read,accessor,values}=require('../tools/retopo-character-v214.cjs'),root=path.resolve(__dirname,'..');
const before=read(root+'/gladiator-mobile-v213.glb'),after=read(root+'/gladiator-mobile-v214.glb'),a=before.json,b=after.json;
for(const key of ['nodes','skins','animations','scenes','scene','materials','textures','samplers','extensionsUsed','extensionsRequired'])assert.deepEqual(b[key],a[key],key);
const changed=new Set(),rows=[];
for(let i=0;i<a.meshes.length;i++){
 const old=a.meshes[i],next=b.meshes[i],p=old.primitives[0],q=next.primitives[0];assert.deepEqual(next,old,'mesh identity and material');
 const count=b.accessors[q.attributes.POSITION].count,indices=values(after,q.indices);assert.ok(indices.every(x=>x<count),'valid indices');
 const joints=values(after,q.attributes.JOINTS_0),weights=values(after,q.attributes.WEIGHTS_0);
 for(let k=0;k<count;k++){let sum=0;for(let t=0;t<4;t++){assert.ok(joints[k*4+t]<b.skins[0].joints.length);sum+=weights[k*4+t];}assert.ok(Math.abs(sum-1)<1e-5,'normalized weights');}
 if(!/^(loin|shoes)_geo/.test(old.name))continue;
 const ids=Object.values(p.attributes),oldBuffers=ids.map(id=>accessor(before,id)),newBuffers=ids.map(id=>accessor(after,id)),widths=ids.map((id,k)=>oldBuffers[k].length/a.accessors[id].count);
 const key=(buffers,index)=>buffers.map((buf,k)=>buf.subarray(index*widths[k],(index+1)*widths[k]).toString('base64')).join('|'),vertices=new Set();
 for(let v=0;v<a.accessors[p.attributes.POSITION].count;v++)vertices.add(key(oldBuffers,v));
 for(let v=0;v<count;v++)assert.ok(vertices.has(key(newBuffers,v)),'retained position/normal/tangent/UV/joints/weights are byte identical');
 ids.concat(p.indices).forEach(id=>changed.add(id));rows.push({name:old.name,triangles:indices.length/3,vertices:count});
}
for(let i=0;i<a.accessors.length;i++)if(!changed.has(i))assert.deepEqual(accessor(after,i),accessor(before,i),'unchanged accessor '+i);
for(let i=0;i<a.images.length;i++){const av=a.bufferViews[a.images[i].bufferView],bv=b.bufferViews[b.images[i].bufferView];assert.deepEqual(after.binary.subarray(bv.byteOffset,bv.byteOffset+bv.byteLength),before.binary.subarray(av.byteOffset,av.byteOffset+av.byteLength),'texture '+i);}
const visible=j=>j.meshes.filter(m=>!/^(helmet|shield|weapon)_geo/.test(m.name)).reduce((s,m)=>s+j.accessors[m.primitives[0].indices].count/3,0);
assert.ok(visible(b)<visible(a)*.86);assert.ok(after.bytes.length<before.bytes.length*.95);
for(const file of ['arena.html','savas.html','multiplayer.html','ludus.html','caravan-rig-v126.js','circus-war-view-v186.js'])assert.ok(fs.readFileSync(root+'/'+file,'utf8').includes("'gladiator-mobile-v214.glb'"),file+' fresh model URL');
console.log(JSON.stringify({beforeBytes:before.bytes.length,afterBytes:after.bytes.length,beforeVisibleTriangles:visible(a),afterVisibleTriangles:visible(b),texturesIdentical:true,skinAnimationBodyEyesIdentical:true,meshes:rows},null,2));
