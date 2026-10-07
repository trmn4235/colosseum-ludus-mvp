const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('monuments retain metre scale and the specified southeast two-kilometre relationship',()=>{
 const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'ludus-city-v29.js'),'utf8'),ctx);
 const {colosseum:c,pantheon:p}=ctx.LudusCity.landmarks;
 assert.equal(c.height,48);assert.equal(p.height,43.3);assert.equal(p.yaw,0);
 const east=c.position[0]-p.position[0],south=c.position[2]-p.position[2];assert.ok(east>0&&south>0);assert.ok(Math.abs(Math.hypot(east,south)-2000)<1e-8);
 // Looking north from the Pantheon leaves south behind and east to the right.
 for(const m of [c,p]){const bytes=fs.readFileSync(path.join(root,m.file));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);assert.ok(bytes.length<20*1024*1024);const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));assert.ok(doc.meshes.length>0);}
});
test('camera preference survives reload and handles unavailable or invalid storage',()=>{
 let value='far';const ctx=vm.createContext({localStorage:{getItem:()=>value}});vm.runInContext(fs.readFileSync(path.join(root,'ludus-settings-v29.js'),'utf8'),ctx);
 assert.equal(ctx.LudusViewSettings.load(),'far');value='invalid';assert.equal(ctx.LudusViewSettings.load(),'medium');ctx.localStorage.getItem=()=>{throw Error('disabled');};assert.equal(ctx.LudusViewSettings.load(),'medium');assert.equal(ctx.LudusViewSettings.presets.medium.distance,3.6);
});
test('settings resume input synchronously and the late close event does not clear new movement',()=>{
 const handlers={},select={value:''},form={addEventListener:(name,fn)=>handlers['form:'+name]=fn},dialog={setAttribute(){},querySelectorAll:()=>[],querySelector:s=>s==='select'?select:s==='form'?form:{},addEventListener:(name,fn)=>handlers[name]=fn,showModal(){}};
 let paused=false,closes=0,stored='medium';const keys=new Set();const ctx=vm.createContext({document:{createElement:()=>dialog,body:{append(){}}},localStorage:{getItem:()=>stored,setItem:(_,v)=>stored=v}});vm.runInContext(fs.readFileSync(path.join(root,'ludus-settings-v29.js'),'utf8'),ctx);
 let distance=3.6;const settings=ctx.LudusViewSettings.create({onOpen:()=>paused=true,onChange:p=>distance=p.distance,onClose:()=>{paused=false;keys.clear();closes++;}});
 settings.open();assert.equal(paused,true);select.value='far';select.onchange();assert.equal(stored,'far');assert.equal(distance,5);
 handlers['form:submit']();assert.equal(paused,false);keys.add('KeyW');handlers.close();assert.ok(keys.has('KeyW'));assert.equal(closes,1);
 settings.open();handlers.close();assert.equal(paused,false);assert.equal(closes,2);
});
