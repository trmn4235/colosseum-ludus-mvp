// Real rigs: cached/uncached transforms must match through animation and gear changes.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {rigRuntime}=require('./performance-v84.cjs');
const Runtime=require('../arena-runtime-v96.js');
async function main(){
 const rows=[];
 for(const page of ['arena.html','savas.html','multiplayer.html','caravan-field.html','ludus.html']){
  const c=await rigRuntime(page,page==='caravan-field.html'?{rigFile:'caravan-rig-v126.js'}:{}),T=c.THREE;
  const a=c.ImportedGladiator.create(1,'murmillo'),b=c.ImportedGladiator.create(1,'murmillo');
  const f=new c.ArenaCombat(()=>.999).reset('normal','murmillo').fighters[0];
  Object.assign(f,{id:1,chest:true,chestModel:'gladiator_chest',shoulders:true,helmet:true,motionVersion:163});
  let count=0;const multiply=T.Matrix4.prototype.multiplyMatrices,compose=T.Matrix4.prototype.compose;
  T.Matrix4.prototype.multiplyMatrices=function(...args){count++;return multiply.apply(this,args);};
  T.Matrix4.prototype.compose=function(...args){count++;return compose.apply(this,args);};
  let ordinary=0,cached=0,worst=0;
  for(const pose of ['idle','walk','attack','guard','hurt','duck','jump','roll','dead']){
   Object.assign(f,{hp:100,action:'idle',reaction:0,move:0,blocking:false,timer:0});
   if(pose==='walk')f.move=1;
   if(pose==='guard')f.blocking=true;
   if(pose==='hurt')Object.assign(f,{action:'hurt',reaction:.2,lastRegion:'chest'});
   if(pose==='attack')Object.assign(f,{action:'attack',attackWeapon:'gladius',attackKind:'light',attackRegion:'chest',attackProfile:c.ArenaMotion.profile('gladius'),duration:.65});
   if(['duck','jump','roll'].includes(pose))Object.assign(f,{action:pose==='roll'?'dodge':'evade',evadeKind:pose,duration:.65});
   if(pose==='dead')Object.assign(f,{hp:0,action:'down'});
   for(let n=0;n<36;n++){
    Object.assign(f,{timer:n/60,deadTime:n/30,walk:n/9,x:n*.03,z:n*.02,angle:n*.027});
    if(n===18)f.helmetModel=f.helmetModel==='roman'?'gladiator':'roman';
    c.ArenaRuntime.matrixCache.enabled=false;count=0;c.ImportedGladiator.animate(f,a,n/60,1/60);ordinary+=count;
    c.ArenaRuntime.matrixCache.enabled=true;count=0;c.ImportedGladiator.animate(f,b,n/60,1/60);cached+=count;
    const aa=[],bb=[];a.root.traverse(o=>aa.push(o));b.root.traverse(o=>bb.push(o));assert.equal(aa.length,bb.length);
    for(let i=0;i<aa.length;i++)for(const key of ['matrix','matrixWorld'])for(let j=0;j<16;j++)worst=Math.max(worst,Math.abs(aa[i][key].elements[j]-bb[i][key].elements[j]));
   }
  }
  assert.ok(worst<1e-9,page+': pose changed '+worst);
  assert.ok(cached<ordinary*.65,page+': transform budget regressed '+cached+'/'+ordinary);
  assert.equal(a.chestModel,'chest_plate');let triangles=0;a.gear.chest.group.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
  assert.ok(triangles<=500,'Retired chest reintroduced');
  rows.push({page,frames:324,ordinary,cached,reduction:Math.round((1-cached/ordinary)*100)+'%',maxPoseError:worst,chestTriangles:triangles});
 }
 // Host timing must preserve real elapsed time at 10/15/30/60/120 Hz.
 for(const fps of [10,15,30,60,120]){
  let last=1000,elapsed=0;for(let i=1;i<=fps*2;i++){const now=1000+i*1000/fps;elapsed+=Runtime.frameDelta(now,last);last=now;}assert.ok(Math.abs(elapsed-2)<1e-8);
 }
 assert.equal(Runtime.frameDelta(100000,1000),.25);assert.equal(Runtime.frameDelta(500,1000),0);assert.equal(Runtime.frameDelta(1000,0),0);
 assert.ok(Runtime.pixelRatio(3,true,932,430)<=1.25);assert.ok(Runtime.pixelRatio(3,false,1920,1080)<=1);
 const root=path.join(__dirname,'..');for(const name of ['arena.html','caravan-field-v125.js','circus-maximus-v147.js'])assert.match(fs.readFileSync(path.join(root,name),'utf8'),/ArenaRuntime\.frameDelta/);
 console.log(JSON.stringify({rows,clockRates:[10,15,30,60,120]}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
