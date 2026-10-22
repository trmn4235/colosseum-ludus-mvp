/* CPU-only scene-graph validation. No browser, GPU, production account or pixel renderer. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const root=path.resolve(process.env.LUDUS_PERF_ROOT||path.join(__dirname,'..'));
function scripts(page,base=root){const html=fs.readFileSync(path.join(base,page),'utf8');return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(m=>({attrs:m[1],text:m[2]}));}
async function rigRuntime(page='arena.html',options={}){
 const root=path.resolve(options.root||process.env.LUDUS_PERF_ROOT||path.join(__dirname,'..'));
 const context=vm.createContext({console:{log(){},warn(){},error(){}},URL,TextDecoder,TextEncoder,ArrayBuffer,Uint8Array,Uint16Array,Uint32Array,Float32Array,Float64Array,Int8Array,Int16Array,Int32Array,DataView,Blob,AbortController,Response,setTimeout,clearTimeout,performance});context.self=context;
 const paint=new Proxy({}, {get:(o,k)=>k==='canvas'?{}:()=>paint});
 context.document={baseURI:'https://fixture.invalid/',getElementById:()=>({textContent:''}),createElement:()=>({width:256,height:256,getContext:()=>paint})};
 vm.runInContext(fs.readFileSync(root+'/owner-three-r160.js','utf8'),context);
 if(fs.existsSync(root+'/ludus-manica-v119.js'))vm.runInContext(fs.readFileSync(root+'/ludus-manica-v119.js','utf8'),context);
 if(fs.existsSync(root+'/arena-runtime-v96.js'))vm.runInContext(fs.readFileSync(root+'/arena-runtime-v96.js','utf8'),context);
 const T=context.THREE,OriginalLoader=T.GLTFLoader;
 T.GLTFLoader=class extends OriginalLoader{constructor(...args){super(...args);this.register(()=>({name:'CPU_TEXTURE_PLACEHOLDERS',loadTexture:()=>Promise.resolve(new T.Texture())}));}};
 T.TextureLoader.prototype.load=function(url,onload){const t=new T.Texture();onload?.(t);return t;};
 context.ArenaAssetLoad=async name=>{const p=new URL(name,'https://fixture.invalid/').pathname.slice(1),bytes=fs.readFileSync(root+'/'+p);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);};
 context.ArenaAssets={warmArena(){}};
 for(const name of ['combat-curves-v163.js','combat-motion-v163.js','arena-authored-data-v163.js','arena-authored-motion-v163.js','arena-anatomy-v166.js','arena-equipment-fit-v164.js','arena-motion-stability-v165.js'])if(fs.existsSync(root+'/'+name))vm.runInContext(fs.readFileSync(root+'/'+name,'utf8'),context);
 const source=scripts(page,root),combat=scripts('arena.html',root).find(s=>s.text.includes('var ArenaClasses='));
 const marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",ending="})(typeof window!=='undefined'?window:globalThis);";
 const start=combat.text.indexOf('var ArenaClasses='),finish=combat.text.indexOf(ending,combat.text.indexOf(marker,start))+ending.length;vm.runInContext(combat.text.slice(start,finish),context);
 const graphics=options.rigFile?{text:fs.readFileSync(root+'/'+options.rigFile,'utf8')}:source.find(s=>s.text.includes('var ImportedGladiator=')),endMarker="return {load,create,animate,dispose,get loaded(){return !!template;}};",end=graphics.text.indexOf('})();',graphics.text.indexOf(endMarker))+5;
 vm.runInContext(graphics.text.slice(0,end),context);
 context.ArenaAssetLoad=async name=>{const p=new URL(name,'https://fixture.invalid/').pathname.slice(1),bytes=fs.readFileSync(root+'/'+p);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);};context.ArenaAssets.warmArena=()=>{};
 const locomotion=source.map(s=>s.attrs.match(/\bsrc=["']([^"'?]+)/)?.[1]).filter(name=>/^arena-locomotion(?:-data)?-v\d+\.js$/.test(name||''));
 for(const name of ['arena-fall-motion-v39.js','arena-ground-fall-v39.js','arena-roll-motion-v72.js','arena-roll-v72.js',...locomotion])vm.runInContext(fs.readFileSync(root+'/'+name,'utf8'),context);
 if(page==='ludus.html')vm.runInContext(fs.readFileSync(root+'/training-motion-v50.js','utf8'),context);
 await context.ImportedGladiator.load(()=>{});return context;
}
function inspectScripts(){
 const pages=fs.readdirSync(root).filter(p=>p.endsWith('.html')),result=[];
 for(const page of pages){let bytes=0,external=[];
  for(const s of scripts(page)){
   if(/type=["'](?:application\/json|importmap)/.test(s.attrs))continue;
   const src=s.attrs.match(/\bsrc=["']([^"']+)/)?.[1];
   if(src){if(!/^https?:/.test(src)){const file=src.split('?')[0];assert.ok(fs.existsSync(root+'/'+file),page+': '+src);new vm.Script(fs.readFileSync(root+'/'+file,'utf8'));external.push(file);}}
   else{new vm.Script(s.text);bytes+=Buffer.byteLength(s.text);}
  }
  result.push({page,htmlBytes:fs.statSync(root+'/'+page).size,inlineScriptBytes:bytes,externalScripts:external});
 }return result;
}
async function measure(){
 const c=await rigRuntime(),T=c.THREE,models=[],fighters=[];
 for(let i=0;i<12;i++){const type=Object.keys(c.ArenaClasses)[i%7],m=c.ImportedGladiator.create(i,type),f=new c.ArenaCombat(()=>.999).reset('normal',type).fighters[0];f.id=i;f.team=i%4;f.x=i*2;f.z=0;models.push(m);fighters.push(f);}
 const counters={vectors:0,quaternions:0,eulers:0},constructors={};
 for(const [key,name]of [['vectors','Vector3'],['quaternions','Quaternion'],['eulers','Euler']]){const Base=T[name];constructors[name]={original:Base,counted:class extends Base{constructor(...args){super(...args);counters[key]++;}}};}
 const snapshots=[],batches=[];
 const scenarios=['walk','run','attack','guard','hurt','dodge','dead'];
 for(const scenario of scenarios){
  for(let i=0;i<fighters.length;i++){const f=fighters[i];Object.assign(f,{hp:100,action:'idle',reaction:0,passiveEvade:0,blocking:false,move:0,timer:0,deadTime:0});if(scenario==='walk'||scenario==='run')f.move=1;if(scenario==='attack'){f.action='attack';f.weapon='gladius';f.attackWeapon='gladius';f.attackKind='light';f.attackProfile=c.ArenaMotion.profile('gladius');f.duration=f.attackProfile.duration;}if(scenario==='guard')f.blocking=true;if(scenario==='hurt'){f.action='hurt';f.lastRegion='chest';f.reaction=.20;}if(scenario==='dodge'){f.action='dodge';f.duration=.46;}if(scenario==='dead'){f.hp=0;f.action='down';}}
  for(let n=0;n<25;n++)for(let i=0;i<models.length;i++){const f=fighters[i];f.walk+=.1;f.timer=(n%35)/60;f.deadTime=n/60;f.z+=(scenario==='run'?6:scenario==='walk'?1:0)/60;c.ImportedGladiator.animate(f,models[i],n/60,1/60);}
  const samples=[],batch=()=>{for(let n=0;n<40;n++)for(let i=0;i<models.length;i++){const f=fighters[i];f.walk+=.1;f.timer=(n%35)/60;f.deadTime=1+n/60;f.z+=(scenario==='run'?6:scenario==='walk'?1:0)/60;c.ImportedGladiator.animate(f,models[i],(100+n)/60,1/60);}};
  // Time the original constructors; count explicit public constructor calls in a separate pass.
  for(let run=0;run<5;run++){const start=performance.now();batch();samples.push(performance.now()-start);}
  const m=models[0];m.root.updateMatrixWorld(true);snapshots.push({scenario,bones:Object.fromEntries(['Hips','Head','LeftHand','RightHand','LeftFoot','RightFoot'].map(k=>[k,m.bones[k].matrixWorld.elements.map(Number)])),body:m.body.position.toArray(),root:m.root.position.toArray(),clip:m.locomotionClip});
  const before={...counters};for(const [name,row]of Object.entries(constructors))T[name]=row.counted;for(let run=0;run<5;run++)batch();for(const [name,row]of Object.entries(constructors))T[name]=row.original;
  batches.push({scenario,characters:12,animatedFrames:2400,timedFramesPerSample:480,samples:5,medianMs:samples.sort((a,b)=>a-b)[2],allocations:Object.fromEntries(Object.keys(counters).map(k=>[k,counters[k]-before[k]]))});
 }
 models.forEach(m=>c.ImportedGladiator.dispose(m));return{notes:'CPU-only, placeholder texture images; exact original geometry/rig. Timings exclude constructor instrumentation and are scene-graph work, not GPU or phone FPS. Allocation counts track explicit public Vector3/Quaternion/Euler constructors in a separate pass; library-internal clones and other allocations are not included.',pages:inspectScripts(),batches,snapshots};
}
if(require.main===module)measure().then(r=>process.stdout.write(JSON.stringify(r,null,2)+'\n')).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={rigRuntime,measure,inspectScripts};
