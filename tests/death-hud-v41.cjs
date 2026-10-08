const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.QA_OUTPUT||path.resolve(root,'..','qa-v41');fs.mkdirSync(out,{recursive:true});
const fixture=`const fixtureUser={id:'00000000-0000-4000-8000-000000000001',is_anonymous:false,user_metadata:{}};const fixtureAccount={user_id:fixtureUser.id,ludus_name:'Tırman',gold:4260,diamonds:0};const fixtureFighters=[{id:'g1',class:'hoplomachus',name:'Hoplomachus',overall:50,status:'available'},{id:'g2',class:'retiarius',name:'Retiarius',overall:50,status:'available'}];window.__sentMessages=[];window.__messageFail=false;window.__fixtureClient={auth:{getSession:async()=>({data:{session:{user:fixtureUser}},error:null}),getUser:async()=>({data:{user:fixtureUser},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:name=>{const data=name==='ludus_accounts'?fixtureAccount:name==='ludus_gladiators'?fixtureFighters:[];const b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data,error:null}),then:(r,j)=>Promise.resolve({data,error:null}).then(r,j)};return b;},rpc:async(name,args)=>{if(name==='ludus_messages'){const friend={id:'peer1',name:'Marcus',username:'marcus'};if(args.p_action==='send'){window.__sentMessages.push(args);if(window.__messageFail){window.__messageFail=false;return {data:null,error:{message:'Bağlantı kesildi. Tekrar dene.'}};}window.__lastMessage=args.p_body;}return {data:{friends:[friend],conversations:[{...friend,last_body:'Merhaba',unread:1}],unread:args.p_peer?0:1,peer:args.p_peer?friend:null,messages:args.p_peer?[{id:'m1',body:'<img src=x onerror=alert(1)>',mine:false,created_at:new Date().toISOString()},...(window.__lastMessage?[{id:'m2',body:window.__lastMessage,mine:true,created_at:new Date().toISOString()}]:[])]:[]},error:null};}return {data:name==='ludus_clan_vault'?{clan:null,wallet:{gold:4260,ludus_name:'Tırman'},gladiators:fixtureFighters,vault:[],inventory:[],vault_stones:[],inventory_stones:[]}:name==='ludus_progress'?{level:1,current_exp:0,next_exp:3000,claimable_count:0}:name==='ludus_imperial'?{server_now:new Date().toISOString(),missions:[],assignments:[],gladiators:fixtureFighters,is_admin:false,today:'2026-10-08'}:name==='ludus_daily_state'?{missions:[],claimed_count:0,bonus_claimed:false}:{friends:[],pending:[],server_now:new Date().toISOString(),gladiators:fixtureFighters},error:null};}};supabase.createClient=()=>window.__fixtureClient;`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://local'),f=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!f.startsWith(root+'/')||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}let b=fs.readFileSync(f);if(u.pathname==='/ludus.html')b=Buffer.from(b.toString().replace('const accountClient=supabase.createClient','let accountClient=supabase.createClient').replace('const accountReady=(async()=>{',fixture+'\nconst accountReady=(async()=>{accountClient=window.__fixtureClient;').replace('function frame(now){requestAnimationFrame(frame);','function frame(now){requestAnimationFrame(frame);if(window.__freezeFrame)return;'));
res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','content-security-policy':"connect-src 'self' data: blob:"});res.end(b);});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/ludus.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.LudusPreview?.exploring,null,{timeout:90000});
  await page.evaluate(async()=>{await Promise.all([LudusPreview.residentsReady,LudusPreview.ownerAvatar.ready,LudusPreview.accountReady]);window.__freezeFrame=true;});
  const hud=[];
  for(const [width,height]of [[667,375],[740,360],[844,390],[932,430],[1366,768]]){
   await page.setViewportSize({width,height});
   const d=await page.evaluate(()=>{
    const menu=document.querySelector('.ludus-menu').getBoundingClientRect();return {viewport:[innerWidth,innerHeight],menu:[menu.left,menu.top,menu.right,menu.bottom],buttons:[...document.querySelectorAll('.tools button:not([hidden])')].map(e=>({id:e.id,border:getComputedStyle(e).borderWidth,background:getComputedStyle(e).backgroundColor,width:e.getBoundingClientRect().width})),scroll:document.documentElement.scrollWidth>innerWidth};
   });
   assert.deepEqual(d.buttons.map(b=>b.id),['friendsOpen','messagesOpen','accountLink']);
   for(const b of d.buttons){assert.equal(b.border,'0px');assert.equal(b.background,'rgba(0, 0, 0, 0)');assert.ok(b.width<=34.1);}
   assert.ok(d.menu[0]>=0&&d.menu[2]<=width+.5);assert.equal(d.scroll,false);hud.push(d);
   await page.locator('#messagesOpen').click();assert.equal(await page.evaluate(()=>LudusPreview.paused),true);
   await page.locator('#ludusMessages select').selectOption('peer1');await page.waitForFunction(()=>document.querySelector('.message-bubble'));
   assert.equal(await page.locator('.message-bubble img').count(),0);
   const size=await page.locator('#ludusMessages').evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,scroll:e.scrollHeight>e.clientHeight+1};});
   assert.ok(size.left>=0&&size.top>=0&&size.right<=width+.5&&size.bottom<=height+.5);assert.equal(size.scroll,false);
   if(width===844)await page.screenshot({path:out+'/messages.png'});
   await page.getByRole('button',{name:'Mesajları kapat'}).click();await page.waitForFunction(()=>!LudusPreview.paused);
  }
  await page.setViewportSize({width:844,height:390});await page.screenshot({path:out+'/hud.png'});
  await page.locator('#messagesOpen').click();await page.locator('#ludusMessages select').selectOption('peer1');
  await page.locator('#ludusMessages textarea').fill('Arena hazır.');await page.evaluate(()=>{window.__messageFail=true;});await page.getByRole('button',{name:'Gönder',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.messages-status').textContent.includes('Tekrar dene'));
  await page.getByRole('button',{name:'Gönder',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.message-bubble.mine'));
  const sent=await page.evaluate(()=>window.__sentMessages);assert.equal(sent.length,2);assert.equal(sent[0].p_request,sent[1].p_request);assert.equal(sent[1].p_peer,'peer1');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!LudusPreview.paused);assert.equal(await page.evaluate(()=>document.activeElement.id),'messagesOpen');
  const doors=await page.evaluate(()=>{const icons=[];LudusPreview.scene.traverse(o=>{if(o.userData.doorIcon)icons.push({kind:o.userData.kind,name:o.userData.name,transparent:o.material.transparent});});return icons;});assert.equal(doors.length,10);assert.equal(new Set(doors.map(d=>d.kind)).size,10);assert.ok(doors.every(d=>d.transparent));
  await page.evaluate(()=>{LudusPreview.camera.position.set(0,6,-4);LudusPreview.camera.lookAt(0,3,11);LudusPreview.renderer.render(LudusPreview.scene,LudusPreview.camera);});await page.screenshot({path:out+'/doors.png'});
  const arenaSource=fs.readFileSync(path.join(root,'arena.html'),'utf8'),motionStart=arenaSource.indexOf('var ArenaMotion='),motionEnd=arenaSource.indexOf("if(typeof module!=='undefined')module.exports=ArenaMotion;",motionStart);
  await page.evaluate(source=>(0,eval)(source),arenaSource.slice(motionStart,motionEnd));
  const metrics=[];
  for(const scenario of ['standing','attack','falling','prone']){
   const result=await page.evaluate(scenario=>{
    const T=THREE,scene=new T.Scene();scene.background=new T.Color('#d5ccba');scene.add(new T.HemisphereLight(0xffffff,0x615743,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(3,5,4);scene.add(light);
    const floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:'#b9ab8e'}));floor.rotation.x=-Math.PI/2;floor.position.y=.005;scene.add(floor);
    const m=ImportedGladiator.create(0,'murmillo'),f={id:0,type:'murmillo',team:0,x:4,z:2,angle:.2,hp:100,action:'idle',timer:0,duration:1.5,walk:0,move:0,helmet:true,helmetModel:'roman',helmetStyle:'murmillo',shield:true,shieldStyle:'murmillo',chest:true,chestModel:'roman',shoulders:true,greaves:true,weapon:'gladius',offhand:null,leftGear:null,wear:{},reaction:0,shieldHeldBy:null,deadTime:0,knockOrigin:{x:-8,z:-9},knockAngle:2};scene.add(m.root);
    for(let i=0;i<15;i++)ImportedGladiator.animate(f,m,i/60,1/60);
    if(scenario==='attack'){Object.assign(f,{action:'attack',timer:.24,attackKind:'heavy',attackRegion:'head',attackWeapon:'gladius',chain:1});for(let i=0;i<5;i++)ImportedGladiator.animate(f,m,.3,1/60);}
    if(['falling','prone'].includes(scenario)){f.action='knocked';f.knockOrigin={x:4,z:2};f.knockAngle=.2;for(let i=0;i<=(scenario==='prone'?54:21);i++){f.timer=i/60;ImportedGladiator.animate(f,m,i/60,1/60);}}
    const point=key=>m.bones[key].getWorldPosition(new T.Vector3()),before={head:point('Head'),hip:point('Hips'),root:m.root.position.clone()};
    f.corpseEquipment=Object.fromEntries(['weapon','offhand','leftGear','shield','helmet','chest','greaves','shoulders','shieldStyle','helmetStyle','helmetColor','helmetModel','chestModel','shoulderModel','netBusy'].map(k=>[k,f[k]]));
    Object.assign(f,{hp:0,action:'down',timer:0,deadTime:0,weapon:null,shield:false,helmet:false,chest:false,greaves:false,shoulders:false});
    let maxHeadStep=0,maxRootStep=0,firstHeadStep=0,maxHipRise=0,head=before.head,root=before.root;
    for(let i=0;i<=75;i++){f.deadTime=i/60;ImportedGladiator.animate(f,m,i/60,1/60);const next=point('Head'),position=m.root.position.clone();maxHeadStep=Math.max(maxHeadStep,head.distanceTo(next));maxRootStep=Math.max(maxRootStep,root.distanceTo(position));maxHipRise=Math.max(maxHipRise,point('Hips').y-before.hip.y);if(!i)firstHeadStep=head.distanceTo(next);head=next;root=position;for(const bone of Object.values(m.bones))if(!bone.quaternion.toArray().every(Number.isFinite))throw Error('Nonfinite death bone');}
    const gear={helmet:m.gear.helmet.group.visible,shield:m.gear.shield.group.visible,chest:m.gear.chest.group.visible,weapon:m.weaponAnchor.children.length};
    const camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.01,60);camera.position.set(7,1.8,6);camera.lookAt(4,.65,2);LudusPreview.renderer.render(scene,camera);
    window.__deathTestModel=m;
    return{scenario,maxHeadStep,maxRootStep,firstHeadStep,maxHipRise,finalHead:point('Head').toArray(),gear};
   },scenario);
   assert.ok(result.firstHeadStep<.035,JSON.stringify(result));assert.ok(result.maxRootStep<.04,JSON.stringify(result));assert.ok(result.maxHeadStep<.24,JSON.stringify(result));
   if(scenario==='prone')assert.ok(result.maxHipRise<.06,JSON.stringify(result));
   assert.equal(result.gear.helmet,true);assert.equal(result.gear.shield,true);assert.equal(result.gear.chest,true);assert.ok(result.gear.weapon>0);
   await page.screenshot({path:out+'/death-'+scenario+'.png'});await page.evaluate(()=>ImportedGladiator.dispose(__deathTestModel));metrics.push(result);console.log("death",JSON.stringify(result));
  }
  assert.deepEqual(errors,[]);const report={hud,doors,death:metrics,mockMessages:sent.length,errors};fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
