const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),vm=require('node:vm');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'staff-v284-'));
const base=fs.readFileSync(path.join(__dirname,'daily-kitchen-ui-v265.cjs'),'utf8'),sandbox={};
vm.runInNewContext(base.slice(base.indexOf("const user="),base.indexOf('(async()=>{'))+';this.fixture=mock+foodMock;',sandbox);
const mock=sandbox.fixture+require('./special-staff-fixture-v284.cjs')();
let watchdog;
function checkpoint(name){
 clearTimeout(watchdog);console.log('Staff UI checkpoint',name);
 watchdog=setTimeout(()=>{console.error('Staff UI stopped responding at '+name);process.exit(1);},120000);
 watchdog.unref();
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const safari=!!process.env.LUDUS_WEBKIT_TEST,browser=await(safari?webkit:chromium).launch(safari?{headless:true}:{headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 let page;
 try{
 const errors=[];
 async function activate(target){
  if(!safari)return target.click();await page.bringToFront();await target.waitFor({state:'visible'});assert.equal(await target.isEnabled(),true);let point,prior,stable=false;
  for(let attempt=0;attempt<50;attempt++){let timer;try{point=await Promise.race([target.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,width:r.width,height:r.height,hit:e.contains(hit),onScreen:x>=0&&y>=0&&x<innerWidth&&y<innerHeight,obstruction:hit?.tagName+'#'+hit?.id+'.'+hit?.className};}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Staff touch hit-test did not respond within 5 seconds')),5000);})]);}finally{clearTimeout(timer);}if(point.hit&&point.onScreen&&prior?.x===point.x&&prior?.y===point.y&&prior?.width===point.width&&prior?.height===point.height){stable=true;break;}prior=point;await page.waitForTimeout(100);}
  assert.ok(stable&&point.hit&&point.onScreen&&point.width>0&&point.height>0,'Staff touch target: '+JSON.stringify(point));await page.touchscreen.tap(point.x,point.y);
 }
 async function openViewport(width,height){page=await browser.newPage({viewport:{width,height},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;window.__staffContexts=new Set();HTMLCanvasElement.prototype.getContext=function(type,...args){const c=original.call(this,type,...args);if(c&&/webgl/.test(type))__staffContexts.add(c);return c;};});
 await page.route('http://127.0.0.1:8765/**',r=>{const file=root+new URL(r.request().url()).pathname;if(!fs.existsSync(file))return r.fulfill({status:404});let body=fs.readFileSync(file);if(file.endsWith('ludus.html'))body=Buffer.from(body.toString().replace('const accountClient=LudusClient.create','let accountClient=LudusClient.create').replace('const accountReady=(async()=>{',mock+'\nconst accountReady=(async()=>{accountClient=window.__testClient;'));return r.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});});await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:8765/ludus.html');await page.waitForFunction(()=>window.LudusPreview?.exploring&&LudusPreview.staffStations.entries.filter(e=>!e.d.room).every(e=>e.ready),null,{timeout:90000});await page.bringToFront();}
 checkpoint('open courtyard');await openViewport(874,402);
 const worldContexts=await page.evaluate(()=>__staffContexts.size);
 assert.equal(await page.evaluate(()=>LudusPreview.staffStations.entries.filter(e=>e.group.visible).length),2);
 await activate(page.getByRole('button',{name:/^Özel çalışanlar/}));
 await page.locator('#specialStaffModal[data-directory=true]').waitFor();
 await page.getByText('26 papirüs okunabilir',{exact:true}).waitFor();
 await page.screenshot({path:out+'/directory.png'});
 assert.equal(await page.locator('.staff-directory-person:visible').count(),6);
 assert.equal(await page.locator('#ludusLevelBadge').evaluate(n=>n.nextElementSibling.id),'specialStaffHud');
 const portraits=new Set();
 for(const [role,name] of [['trainer','Varro'],['cook','Gaius'],['doctor','Aulus'],['smith','Lucius'],['groom','Titus'],['guard','Marcus']]){
  checkpoint('directory '+role);await activate(page.locator('.staff-directory-person[data-role="'+role+'"]'));
  await page.waitForFunction(id=>LudusPreview.specialStaff.state?.role===id&&document.querySelector('.staff-art-status').hidden,role,{timeout:90000});
  assert.equal(await page.locator('.staff-info h2').innerText(),name);assert.equal(await page.locator('.staff-portrait canvas').getAttribute('data-staff-role'),role);
  const pixels=await page.locator('.staff-portrait canvas').evaluate(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let opaque=0,hash=2166136261;for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619);if(i%4===3&&data[i]>128)opaque++;}return {opaque,hash:hash>>>0};});assert(pixels.opaque>100,'Visible portrait for '+role);portraits.add(pixels.hash);await page.screenshot({path:out+'/profile-'+role+'.png'});
  if(role!=='guard')await activate(page.getByRole('button',{name:'Çalışan listesine dön'}));
 }
 assert.equal(portraits.size,6,'Six distinct rendered staff portraits');
 assert.equal(await page.evaluate(()=>__staffContexts.size),worldContexts,'Profiles reuse the world context');
 await page.waitForFunction(()=>LudusPreview.specialStaff.state?.role==='guard'&&document.querySelector('.staff-art-status').hidden,null,{timeout:90000});
 assert.equal(await page.locator('.staff-overall strong').innerText(),'0');assert.equal(await page.locator('.staff-collection strong').innerText(),'0 / 500');assert.equal(await page.locator('.staff-paper').count(),0);
 const layoutErrors=[];
 async function checkLayout(width,height){for(const theme of ['blue','black','white']){await page.evaluate(t=>LudusTheme.set(t),theme);await page.waitForTimeout(100);const bad=await page.evaluate(()=>[...document.querySelectorAll('#specialStaffModal,.staff-header,.staff-nav,.staff-body,.staff-identity,.staff-info,.staff-content,.staff-benefits,.staff-papers,.staff-paper,.staff-read')].filter(n=>{const r=n.getBoundingClientRect();return n.scrollWidth>n.clientWidth+2||n.scrollHeight>n.clientHeight+2||r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(n=>n.className));if(bad.length)layoutErrors.push({theme,width,height,bad});}}
 checkpoint('read from personal chest');await checkLayout(874,402);assert.deepEqual(layoutErrors,[]);
 await activate(page.getByRole('button',{name:'Kasadaki papirüsler',exact:true}));
 await page.getByText('26 okunmamış papirüs',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Kasayı kapat'}).waitFor({state:'visible'});
 const vaultLayout=await page.evaluate(()=>[...document.querySelectorAll('#personalVaultModal,.personal-vault-header,.personal-vault-tabs,.personal-vault-grid,.personal-vault-card,.personal-vault-footer')].filter(e=>{const r=e.getBoundingClientRect();return e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2||r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(e=>e.className));assert.deepEqual(vaultLayout,[]);
 await page.screenshot({path:out+'/personal-chest.png'});
 await activate(page.locator('.personal-vault-card').first());
 await activate(page.getByRole('button',{name:'Papirüsü okut',exact:true}));
 await page.locator('#personalVaultModal').getByText('Bağlantı kesildi. Yeniden dene.').waitFor();
 assert.equal(await page.evaluate(()=>LudusPreview.specialStaff.state.staff.find(s=>s.id==='guard').overall),0,'wait for acknowledgement');
 await activate(page.getByRole('button',{name:'Yeniden dene',exact:true}));
 await page.getByText('25 okunmamış papirüs',{exact:true}).waitFor();
 assert.equal(await page.locator('.hud-staff-unread').innerText(),'25');
 assert.equal(await page.evaluate(()=>__staffReads[0].p_request===__staffReads[1].p_request),true);
 await activate(page.getByRole('button',{name:'Kasayı kapat'}));
 await activate(page.getByRole('button',{name:/^Özel çalışanlar/}));
 await activate(page.locator('.staff-directory-person[data-role="guard"]'));
 await page.waitForFunction(()=>LudusPreview.specialStaff.state?.role==='guard'&&!document.querySelector('.staff-collection').disabled);
 assert.equal(await page.locator('.staff-overall strong').innerText(),'0,2');assert.equal(await page.locator('.staff-bonus strong').innerText(),'+%0,03');
 assert.equal(await page.locator('.staff-collection strong').innerText(),'1 / 500');
 await activate(page.getByRole('button',{name:'Okunan papirüsleri göster'}));
 await page.waitForFunction(()=>LudusPreview.specialStaff.archive?.paper_count===1);
 assert.equal(await page.locator('.staff-paper').count(),1);assert.equal(await page.locator('.staff-learned').innerText(),'Öğrenildi');
 await page.screenshot({path:out+'/profile.png'});checkpoint('switch to cook and return');await activate(page.getByRole('button',{name:'Aşçı',exact:true}));await page.waitForFunction(()=>LudusPreview.specialStaff.state?.role==='cook'&&document.querySelector('.staff-art-status').hidden);assert.equal(await page.locator('.staff-overall strong').innerText(),'0');checkpoint('return to directory');await activate(page.getByRole('button',{name:'Çalışan listesine dön'}));await page.locator('#specialStaffModal[data-directory=true]').waitFor();checkpoint('close directory');await activate(page.getByRole('button',{name:'Özel çalışanları kapat'}));assert.equal(await page.evaluate(()=>LudusPreview.paused),false);
 const roles=[];for(const [room,id]of [['dining','cook'],['infirmary','doctor'],['upgrades','smith']]){checkpoint('visit '+room);await page.evaluate(kind=>{LudusPreview.leaveRoom();LudusPreview.enterRoom(LudusPreview.rooms.find(r=>r.kind===kind));},room);checkpoint('wait for '+room);await page.waitForFunction(id=>LudusPreview.staffStations.entries.some(e=>e.d.id===id&&e.ready&&e.group.visible),id,{timeout:60000});roles.push(await page.evaluate(id=>{const e=LudusPreview.staffStations.entries.find(e=>e.d.id===id);return {id,model:e.group.children[0].userData.staffRole,blocked:!LudusPreview.allowed(e.d.x,e.d.z)};},id));}assert(roles.every(r=>r.id===r.model&&r.blocked));
 checkpoint('visit office chest');await page.evaluate(()=>{LudusPreview.leaveRoom();LudusPreview.enterRoom(LudusPreview.rooms.find(r=>r.kind==='office'));});await page.waitForFunction(()=>LudusPreview.personalVault.chest?.parent===LudusPreview.roomProps&&LudusPreview.roomColliders.some(c=>c.kind==='personal-vault'),null,{timeout:60000});await page.evaluate(()=>Object.assign(LudusPreview.player,{x:-2.1,z:.4,yaw:0,pitch:0}));await page.locator('#personalVaultMarker').waitFor({state:'visible',timeout:30000});await page.screenshot({path:out+'/office-chest.png'});await activate(page.getByRole('button',{name:'Ludus kasasını aç'}));await page.locator('#personalVaultModal').waitFor({state:'visible'});await activate(page.getByRole('button',{name:'Kasayı kapat'}));
 checkpoint('visit stable');await page.evaluate(()=>{LudusPreview.leaveRoom();LudusPreview.enterRoom(LudusPreview.rooms.find(r=>r.kind==='stable'));});await page.waitForFunction(()=>LudusPreview.stableRoom.groom?.userData.staffRole==='groom',null,{timeout:60000});
 checkpoint('kitchen portions');await page.evaluate(()=>{LudusPreview.leaveRoom();LudusPreview.enterRoom(LudusPreview.rooms.find(r=>r.kind==='dining'));});await page.waitForFunction(()=>LudusPreview.diningRoom.ready);await page.evaluate(()=>LudusPreview.foodSystem.open());await page.getByLabel('Yemek verilen kişiler').waitFor();assert.match(await page.getByLabel('Yemek verilen kişiler').innerText(),/10 gladyatör · 8 kervan işçisi · 6 özel çalışan/);assert.match(await page.locator('.kitchen-date').innerText(),/24 kişi/);
 // Open each viewport separately; repeated resizing of the live courtyard can stall software WebGL.
 for(const [width,height]of [[1280,588],[568,320]]){checkpoint('viewport '+width);await page.close();await openViewport(width,height);await page.evaluate(()=>LudusPreview.specialStaff.open('guard'));await page.waitForFunction(()=>LudusPreview.specialStaff.state?.role==='guard'&&document.querySelector('.staff-art-status').hidden,null,{timeout:90000});await checkLayout(width,height);}
 assert.deepEqual(layoutErrors,[]);assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,layoutChecks:9,models:6,serverReadRetry:true,percentPrecision:true,kitchenPeople:true,errors}));
 }catch(error){console.error(error);let timer;try{if(page&&!page.isClosed()){const info=await Promise.race([page.evaluate(()=>({visibility:document.visibilityState,role:window.LudusPreview?.specialStaff?.state?.role,modal:document.querySelector('#specialStaffModal')?.getAttribute('aria-busy'),portrait:document.querySelector('.staff-art-status')?.outerHTML,canvas:document.querySelector('.staff-portrait canvas')?.dataset.staffRole,selected:document.querySelector('.staff-tab[aria-pressed=true]')?.textContent,footer:document.querySelector('.staff-footer')?.textContent})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('diagnostic timeout')),5000);})]);console.error('Staff failure state',JSON.stringify(info));await page.screenshot({path:out+'/failure.png',timeout:5000});}}catch(e){console.error('Staff failure diagnostics',e.message);}finally{clearTimeout(timer);}throw error;}finally{checkpoint('close browser');await browser.close();clearTimeout(watchdog);}
})().catch(e=>{console.error(e);process.exitCode=1;});
