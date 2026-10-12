const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),baseline=process.env.LUDUS_BASELINE_ROOT;
function assets(){const manifest=JSON.parse(fs.readFileSync(root+'/assets/performance-assets-v84.json'));
 for(const [file,row]of Object.entries({...manifest.vendors,...manifest.images})){const b=fs.readFileSync(root+'/'+file);assert.equal(b.length,row.bytes,file);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),row.sha256,file);if(baseline&&manifest.images[file]){for(const page of row.pages){const old=fs.readFileSync(baseline+'/'+page,'utf8');assert.ok(old.includes(b.toString('base64')),file+' original bytes');}}}
 const three=fs.readFileSync(root+'/owner-three-r160.js','utf8'),sdk=fs.readFileSync(root+'/'+Object.keys(manifest.vendors).find(x=>x.includes('supabase-')),'utf8');
 for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html']){const html=fs.readFileSync(root+'/'+page,'utf8');assert.ok(!html.includes(three));assert.ok(!html.includes(sdk));assert.ok(html.includes('owner-three-r160.js?v=revision26'));}
 if(baseline){const tracked=require('node:child_process').execFileSync('git',['ls-files'],{cwd:baseline,encoding:'utf8'}).trim().split('\n');for(const f of tracked.filter(f=>/\.(glb|webp|png|jpg|jpeg|svg|zip)$/.test(f)))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(root+'/'+f)).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(baseline+'/'+f)).digest('hex'),f);}
}
async function auth(){let made=0,network=0,events=[],resolvers=[];const c=vm.createContext({supabase:{createClient:(u,k,options)=>{made++;const auth={getUser:jwt=>{network++;return new Promise(r=>resolvers.push(()=>r({data:{user:{id:jwt||'A'}}})));},onAuthStateChange:f=>events.push(f)};return {auth,options};}}});vm.runInContext(fs.readFileSync(root+'/ludus-client-v84.js','utf8'),c);
 const a=c.LudusClient.create('url','key'),b=c.LudusClient.create('url','key',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});assert.equal(a,b);assert.equal(made,1);
 const p=a.auth.getUser(),q=b.auth.getUser();assert.equal(p,q);await Promise.resolve();assert.equal(network,1);resolvers.shift()();await p;
 const next=a.auth.getUser();await Promise.resolve();assert.equal(network,2);resolvers.shift()();await next;
 const jwt=a.auth.getUser('explicit');assert.equal(network,3);resolvers.shift()();assert.equal((await jwt).data.user.id,'explicit');
 const stale=a.auth.getUser();await Promise.resolve();events[0]('SIGNED_OUT');const fresh=b.auth.getUser();await Promise.resolve();assert.notEqual(stale,fresh);resolvers.shift()();resolvers.shift()();await Promise.all([stale,fresh]);
 assert.notEqual(c.LudusClient.create('url','key',{auth:{persistSession:false}}),a);assert.equal(made,2);
}
function work(){const perf=require('../game-performance-v84.js');let traversals=0,casts=0;const mesh={isMesh:true,material:{},set castShadow(v){casts++;this._cast=v;}};const model={gearRevisionV84:1,root:{traverse:f=>{traversals++;f(mesh);}}};for(let n=0;n<600;n++)perf.characterShadows(model,true);assert.equal(traversals,1);assert.equal(casts,1);perf.characterShadows(model,false);assert.equal(traversals,1);assert.equal(mesh._cast,false);model.gearRevisionV84++;perf.characterShadows(model,false);assert.equal(traversals,2);
 let writes=0;const el={_text:'',style:new Proxy({}, {set(o,k,v){writes++;o[k]=v;return true;}}),get textContent(){return this._text;},set textContent(v){writes++;this._text=v;},get innerHTML(){return this._html;},set innerHTML(v){writes++;this._html=v;}};for(let n=0;n<600;n++){perf.text(el,'100 / 100');perf.html(el,'<span>SOLO 20</span>');perf.style(el,'width','100%');}assert.equal(writes,3);perf.text(el,'99 / 100');assert.equal(writes,4);
 perf.style(el,'opacity',0);el.style.opacity='1';perf.style(el,'opacity',0);assert.equal(el.style.opacity,'0','an event can show a toast and the HUD can hide it again');el.innerHTML='<span>event</span>';perf.html(el,'<span>SOLO 20</span>');assert.equal(el.innerHTML,'<span>SOLO 20</span>');
 let layouts=0;const canvas={getBoundingClientRect:()=>({width:++layouts*100})};perf.beginFrame(1);const first=perf.rect(canvas);for(let n=0;n<20;n++)assert.equal(perf.rect(canvas),first);assert.equal(layouts,1);perf.beginFrame(2);assert.equal(perf.rect(canvas).width,200);assert.equal(layouts,2);
}
function visibility(c){
 vm.runInContext(fs.readFileSync(root+'/game-performance-v84.js','utf8'),c);const T=c.THREE,perf=c.GamePerformance,camera=new T.PerspectiveCamera(50,1.6,.1,100);camera.position.set(0,3,9);camera.lookAt(0,1.1,0);perf.beginVisibility(camera);
 const model={root:new T.Group()};model.root.position.set(0,0,0);perf.characterVisibility(model);assert.equal(model.root.visible,true);
 model.root.position.set(100,0,0);perf.characterVisibility(model);assert.equal(model.root.visible,false);perf.characterVisibility(model,true);assert.equal(model.root.visible,true,'player always retained');
 // The six-metre sphere crosses the view edge even when its centre is outside it.
 model.root.position.set(8,0,0);perf.characterVisibility(model);assert.equal(model.root.visible,true,'edge and weapon margin');
 model.root.position.set(100,0,0);perf.characterVisibility(model);model.root.position.set(0,0,0);perf.characterVisibility(model);assert.equal(model.root.visible,true,'return into view');
 camera.position.set(100,3,9);camera.lookAt(100,1.1,0);perf.beginVisibility(camera);model.root.position.set(100,0,0);perf.characterVisibility(model);assert.equal(model.root.visible,true,'camera movement updates frustum');
}
async function ownerCleanup(){
 const {rigRuntime}=require('./performance-v84.cjs'),c=await rigRuntime();c.Image=class{set src(value){this.width=this.height=1024;queueMicrotask(()=>this.onload?.());}};
 vm.runInContext(fs.readFileSync(root+'/owner-avatar.js','utf8'),c);const a=c.LudusOwner.create(),b=c.LudusOwner.create({version:2,height:190});await Promise.all([a.ready,b.ready]);const scene=new c.THREE.Scene();scene.add(a.root,b.root);
 const skeletons=model=>{const list=[];model.body.traverse(o=>{if(o.isSkinnedMesh)list.push(o.skeleton);});return list;},as=skeletons(a),bs=skeletons(b);assert.ok(as.length>0);assert.notEqual(as[0],bs[0]);
 let disposed=0;for(const s of as){s.computeBoneTexture();s.boneTexture.addEventListener('dispose',()=>disposed++);}for(const s of bs)s.computeBoneTexture();a.dispose();assert.equal(disposed,as.length);assert.equal(a.root.parent,null);assert.equal(b.root.parent,scene);assert.ok(bs.every(s=>s.boneTexture),'other preview stays alive');b.dispose();
 const closedEarly=c.LudusOwner.create();closedEarly.dispose();await closedEarly.ready;assert.equal(closedEarly.body.children.length,0,'closed pending model never mounts');
}
async function poses(){const {rigRuntime}=require('./performance-v84.cjs'),results={};
 for(const page of ['arena.html','savas.html','multiplayer.html','ludus.html']){
  const c=await rigRuntime(page),m=c.ImportedGladiator.create(0,'secutor'),f=new c.ArenaCombat(()=>.999).reset('normal','secutor').fighters[0],list=[];
  if(page==='arena.html')visibility(c);
  for(const action of ['idle','attack','hurt','dodge','knocked','dead']){Object.assign(f,{hp:100,action,timer:0,deadTime:0,duration:1.5,move:0,blocking:false,reaction:0,attackProfile:c.ArenaMotion.profile('gladius'),attackKind:'light'});if(action==='idle')f.move=1;if(action==='hurt')f.reaction=.2;if(action==='dead')f.hp=0;
   for(let n=0;n<45;n++){f.timer=n/60;f.deadTime=n/60;f.walk+=.1;f.z+=action==='idle'?1/60:0;c.ImportedGladiator.animate(f,m,n/60,1/60);}m.root.updateMatrixWorld(true);list.push({action,bones:Object.fromEntries(['Hips','Head','LeftHand','RightHand','LeftFoot','RightFoot'].map(k=>[k,m.bones[k].matrixWorld.elements.map(Number)]))});}
  // A training override deliberately invalidates equipment without changing its type.
  const old=m.weaponAnchor.children[0];m.weaponAnchor.clear();m.weaponAnchor.add(new c.THREE.Group());m.equippedWeapon=undefined;f.hp=100;f.action='idle';c.ClassEquipment.sync(m,f);assert.equal(m.equippedWeapon,f.weapon);assert.ok(m.weaponAnchor.children[0].children.length,'normal weapon restored');
  results[page]=list;c.ImportedGladiator.dispose(m);
 }return results;
}
async function main(){assets();await auth();work();await ownerCleanup();const result=await poses();if(process.env.LUDUS_BASELINE_POSES)assert.deepEqual(JSON.parse(JSON.stringify(result)),JSON.parse(fs.readFileSync(process.env.LUDUS_BASELINE_POSES)),'all four pages retain their original bone matrices');if(process.env.LUDUS_POSE_OUTPUT)fs.writeFileSync(process.env.LUDUS_POSE_OUTPUT,JSON.stringify(result,null,2));console.log(JSON.stringify({rasterAndModelBytesIdentical:true,sharedLibraries:true,authRequestDeduplication:true,freshUserAfterSignOut:true,customClientsIndependent:true,shadowTraversal:600+' → 1',unchangedHudWrites:1800+' → 3',rectReads:21+' → 1 per frame',frustumAndPlayerVisibility:true,ownerSkeletonCleanup:true,allFourRigPages:true,originalBoneMatrices:!!process.env.LUDUS_BASELINE_POSES,equipmentInvalidation:true}));}
main().catch(e=>{console.error(e);process.exitCode=1;});
