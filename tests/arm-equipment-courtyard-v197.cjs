// Exercise the real courtyard runtime, including its distinct training-motion API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),req=createRequire(__dirname+'/production-browser-v119.cjs'),{chromium,webkit}=req('playwright');
let fixture=fs.readFileSync(__dirname+'/production-browser-v119.cjs','utf8');fixture=fixture.slice(0,fixture.lastIndexOf('\n(async()=>{'));
// This suite needs no caravan reward state from an unrelated workflow.
fixture=fixture.replace("const progress=JSON.parse(fs.readFileSync('/tmp/caravan-progress-v116.json'));","const progress={rewards:[]};");
const {server}=new Function('require','__dirname','process',fixture+'\nreturn{server};')(req,__dirname,process);
const out=process.env.LUDUS_TEST_OUTPUT||'/tmp/arm-fit-v197-'+(process.env.LUDUS_WEBKIT_TEST?'webkit':'chromium');fs.mkdirSync(out,{recursive:true});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await(process.env.LUDUS_WEBKIT_TEST?webkit:chromium).launch(process.env.LUDUS_WEBKIT_TEST?{headless:true}:{headless:true,args:['--no-sandbox',...(process.env.LUDUS_SINGLE_PROCESS?['--no-zygote','--single-process']:[]),'--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:874,height:402},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https:/,r=>r.abort());
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/ludus.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.LudusPreview?.roster?.some(g=>g.model?.gear),null,{timeout:90000});
  for(const id of ['manica_segmented','manica_lion','manica_leather','manica']){
   for(const pose of ['idle','walk','attack']){
    const result=await page.evaluate(async({id,pose})=>{
     const v=LudusPreview,g=v.roster.find(g=>g.model?.gear),m=g.model,T=THREE;if(id!=='manica')await LudusEquipmentCatalog.load(T,id);await LudusEquipmentCatalog.load(T,'trident_gladiator');
     v.roster.forEach(r=>{r.body.visible=r===g});if(v.ownerAvatar)v.ownerAvatar.root.visible=false;
     const p=ArenaMotion.profile('trident_gladiator');Object.assign(g.state,{x:0,z:0,angle:0,hp:100,action:pose==='attack'?'attack':'idle',timer:pose==='attack'?p.wind+p.active*.4:0,attackWeapon:'trident_gladiator',attackProfile:p,duration:p.duration,attackRegion:'chest',weapon:'trident_gladiator',offhand:null,leftGear:null,shield:false,helmet:false,chest:false,shoulders:true,shoulderModel:id,greaves:true,move:pose==='walk'?1:0,walk:.9,blocking:false,reaction:0});
     for(let i=0;i<20;i++)ImportedGladiator.animate(g.state,m,i/60,1/60);m.teamMark.visible=false;m.root.updateMatrixWorld(true);
     const slots=id==='manica'?['Rightmanica','Leftmanica']:['armFore','armUpper','shoulder'],groups=slots.map(k=>m.gear[k].group),visible=groups.map(g=>g.visible&&g.children.length>0);
     v.camera.position.set(-1.5,1.7,2.5);v.camera.lookAt(-.08,1.3,0);
     const gl=v.renderer.getContext(),pixels=()=>{v.renderer.render(v.scene,v.camera);const data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;},withArmour=pixels();
     const state=groups.map(g=>g.visible);groups.forEach(g=>g.visible=false);const bare=pixels();groups.forEach((g,i)=>g.visible=state[i]);let changed=0;for(let i=0;i<bare.length;i+=4)if(Math.max(Math.abs(bare[i]-withArmour[i]),Math.abs(bare[i+1]-withArmour[i+1]),Math.abs(bare[i+2]-withArmour[i+2]))>20)changed++;
     // Measure against the visible shaft geometry, not just an attachment matrix.
     const hand=m.bones.RightHand,palm=new T.Vector3(0,.075,.025).applyQuaternion(hand.getWorldQuaternion(new T.Quaternion())).add(hand.getWorldPosition(new T.Vector3())),weapon=m.weaponAnchor.children[0],local=weapon.worldToLocal(palm.clone());let near=[];
     weapon.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){const y=a.getY(i);if(Math.abs(y-local.y)<.12)near.push([a.getX(i),a.getZ(i)]);}});
     const center=near.length?[0,1].map(k=>(Math.min(...near.map(p=>p[k]))+Math.max(...near.map(p=>p[k])))/2):[99,99],shaftError=Math.hypot(local.x-center[0],local.z-center[1]);v.renderer.render(v.scene,v.camera);
     return{changed,visible,shaftError,shaftVertices:near.length,localPalm:local.toArray(),calls:v.renderer.info.render.calls};
    },{id,pose});
    assert.ok(result.visible[0],id+' forearm is loaded and visible');assert.ok(result.changed>100,id+' '+pose+' must visibly cover the arm: '+JSON.stringify(result));assert.ok(result.shaftVertices>5&&result.shaftError<.04,'visible shaft must cross the palm: '+JSON.stringify(result));
    console.log(id,pose,result);await page.screenshot({path:path.join(out,id+'-'+pose+'.png')});
   }
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
