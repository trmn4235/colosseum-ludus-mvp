const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),vm=require('node:vm');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'staff-v284-'));
const base=fs.readFileSync(path.join(__dirname,'daily-kitchen-ui-v265.cjs'),'utf8'),sandbox={};
vm.runInNewContext(base.slice(base.indexOf("const user="),base.indexOf('(async()=>{'))+';this.fixture=mock+foodMock;',sandbox);
const {catalog,script:papyrusScript}=require('./special-staff-fixture-v288.cjs');
assert.equal(catalog.length,150,'The world fixture uses the released 150-paper catalog');
// Keep the existing world RPCs and use the same V288 contract as the isolated UI
// suite. This scenario starts with 25 unread guard papers and no learned powers.
const worldCatalogFixture=String.raw`
__papyrusSetMode('empty');__papyrusFailOnce=true;
for(const paper of __papyrusRows){paper.owned_quantity=paper.role==='guard'?1:0;paper.runtime_status=paper.content_id==='guard_001'?'active':'pending_feature';}
const staffWorldVaultRPC=__testClient.rpc;__testClient.rpc=async(name,args={})=>{
 if(name==='ludus_personal_vault'){
  const all=__papyrusRows.filter(p=>p.owned_quantity>0&&(!args.p_role||p.role===args.p_role)),page=Math.min(args.p_page||0,Math.max(0,Math.ceil(all.length/8)-1));
  const rows=all.slice(page*8,page*8+8).map(p=>({...p,type:'papyrus',key:p.content_id,name:p.title,quantity:p.owned_quantity,available:!p.learned&&p.owned_quantity>0,role_name:LudusSpecialPeople.roles.find(r=>r.id===p.role).name,role_title:LudusSpecialPeople.roles.find(r=>r.id===p.role).title,effects:[{key:p.effect.metric,label:p.effect_text,percent:p.effect.value*100}]}));
  return{data:structuredClone({user_id:testUser.id,gold:12345,category:args.p_category,page,role:args.p_role,total:all.length,counts:{papyrus:all.reduce((n,p)=>n+p.owned_quantity,0)},rows}),error:null};
 }
 return staffWorldVaultRPC(name,args);
};`;
const mock=sandbox.fixture+require('./special-staff-fixture-v284.cjs')()+papyrusScript()+worldCatalogFixture;
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
 async function openViewport(width,height){page=await browser.newPage({viewport:{width,height},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.text().startsWith('STAFF_TRACE'))console.log(m.text());});await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;window.__staffContexts=new Set();HTMLCanvasElement.prototype.getContext=function(type,...args){const c=original.call(this,type,...args);if(c&&/webgl/.test(type))__staffContexts.add(c);return c;};});
 await page.route('http://127.0.0.1:8765/**',r=>{const file=root+new URL(r.request().url()).pathname;if(!fs.existsSync(file))return r.fulfill({status:404});let body=fs.readFileSync(file);if(file.endsWith('ludus.html'))body=Buffer.from(body.toString().replace('const accountClient=LudusClient.create','let accountClient=LudusClient.create').replace('const accountReady=(async()=>{',mock+'\nconst accountReady=(async()=>{accountClient=window.__testClient;'));return r.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});});await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:8765/ludus.html');await page.waitForFunction(()=>window.LudusPreview?.exploring&&LudusPreview.staffStations.entries.filter(e=>!e.d.room).every(e=>e.ready),null,{timeout:90000});await page.bringToFront();}
 checkpoint('open courtyard');await openViewport(874,402);
 const worldContexts=await page.evaluate(()=>__staffContexts.size);
 assert.equal(await page.evaluate(()=>LudusPreview.staffStations.entries.filter(e=>e.group.visible).length),2);
 await activate(page.getByRole('button',{name:/^Özel çalışanlar/}));
 await page.locator('#specialStaffModal[data-directory=true]').waitFor();
 await page.getByText('25 / 25 bilgi',{exact:true}).waitFor();
 await page.screenshot({path:out+'/directory.png'});
 assert.equal(await page.locator('.ss288-person:visible').count(),6);
 assert.equal(await page.locator('#ludusLevelBadge').evaluate(n=>n.nextElementSibling.id),'specialStaffHud');
 const portraits=new Set();
 for(const [role,title] of [['trainer','Doctore'],['cook','Aşçı'],['doctor','Doktor'],['smith','Demirci'],['groom','Seyis'],['guard','Kapı muhafızı']]){
  checkpoint('directory '+role);await activate(page.locator('.ss288-person[data-role="'+role+'"]'));
  await page.waitForFunction(id=>LudusPreview.specialStaff.state?.role===id&&document.querySelector('.ss288-portrait img')?.complete&&document.querySelector('.ss288-portrait img')?.naturalWidth>0,role,{timeout:90000});
  assert.equal(await page.locator('.ss288-summary h2').innerText(),title);
  const portrait=await page.locator('.ss288-portrait img').evaluate(img=>({src:new URL(img.src).pathname,width:img.naturalWidth,height:img.naturalHeight}));
  assert.equal(portrait.src,'/assets/staff-v288/'+role+'.webp');assert.deepEqual([portrait.width,portrait.height],[300,400]);portraits.add(portrait.src);
  assert.equal(await page.locator('#specialStaffModal canvas').count(),0,'Profile uses the approved photographic asset');
  assert.equal(await page.locator('.ss288-person').count(),0,'Employee is selected once, before the profile');
  await page.screenshot({path:out+'/profile-'+role+'.png'});
  if(role!=='guard')await activate(page.getByRole('button',{name:'Çalışan listesine dön'}));
 }
 assert.equal(portraits.size,6,'Six distinct photographic staff portraits');
 assert.equal(await page.evaluate(()=>__staffContexts.size),worldContexts,'Photographic profiles do not allocate another WebGL context');
 await page.waitForFunction(()=>LudusPreview.specialStaff.state?.role==='guard'&&document.querySelector('.ss288-portrait img')?.naturalWidth>0,null,{timeout:90000});
 assert.equal(await page.locator('.ss288-overall strong').innerText(),'100 / 100');assert.equal(await page.locator('.ss288-count').first().locator('strong').innerText(),'25 / 25 ›');assert.equal(await page.locator('.ss288-passive').count(),0);
 const layoutErrors=[];
 async function checkLayout(width,height){for(const theme of ['blue','black','white']){await page.evaluate(t=>LudusTheme.set(t),theme);await page.waitForTimeout(100);const bad=await page.evaluate(()=>[...document.querySelectorAll('#specialStaffModal,.ss288-header,.ss288-tabs,.ss288-body,.ss288-summary,.ss288-summary-text,.ss288-home-columns,.ss288-sidebar,.ss288-benefits,.ss288-passive-grid')].filter(n=>{const r=n.getBoundingClientRect();return n.scrollWidth>n.clientWidth+2||n.scrollHeight>n.clientHeight+2||r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(n=>n.className));if(bad.length)layoutErrors.push({theme,width,height,bad});}}
 checkpoint('read catalog paper from personal chest');await checkLayout(874,402);assert.deepEqual(layoutErrors,[]);
 await page.evaluate(()=>{LudusPreview.specialStaff.close();return LudusPreview.personalVault.open('papyrus');});
 await page.getByText('25 okunmamış papirüs',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Kasayı kapat'}).waitFor({state:'visible'});
 const vaultLayout=await page.evaluate(()=>[...document.querySelectorAll('#personalVaultModal,.personal-vault-header,.personal-vault-tabs,.personal-vault-grid,.personal-vault-card,.personal-vault-footer')].filter(e=>{const r=e.getBoundingClientRect();return e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2||r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(e=>e.className));assert.deepEqual(vaultLayout,[]);
 await page.screenshot({path:out+'/personal-chest.png'});
 await activate(page.locator('.personal-vault-card').first());
 await activate(page.getByRole('button',{name:'Papirüsü okut',exact:true}));
 await page.locator('#personalVaultModal').getByText('Bağlantı kesildi. Yeniden dene.').waitFor();
 assert.equal(await page.evaluate(()=>LudusPreview.specialStaff.state.staff.find(s=>s.id==='guard').read),0,'Wait for acknowledgement before displaying knowledge');
 await activate(page.getByRole('button',{name:'Yeniden dene',exact:true}));
 await page.getByText('24 okunmamış papirüs',{exact:true}).waitFor();
 assert.equal(await page.locator('.hud-staff-unread').innerText(),'24');
 assert.equal(await page.evaluate(()=>__papyrusReads.length===2&&__papyrusReads[0].p_request===__papyrusReads[1].p_request&&__papyrusReads[0].p_content_id==='guard_001'),true,'Retry reuses the same catalog read receipt');
 await activate(page.getByRole('button',{name:'Kasayı kapat'}));
 await activate(page.getByRole('button',{name:/^Özel çalışanlar/}));
 await activate(page.locator('.ss288-person[data-role="guard"]'));
 await page.waitForFunction(()=>LudusPreview.specialStaff.state?.role==='guard'&&!document.querySelector('.ss288-count').disabled);
 assert.equal(await page.locator('.ss288-overall strong').innerText(),'100 / 100','Reading preserves collection-based overall');
 assert.equal(await page.locator('.ss288-count').first().locator('strong').innerText(),'25 / 25 ›');
 assert.equal(await page.locator('.ss288-passive').count(),1);
 assert.equal(await page.locator('.ss288-passive .ss288-value').innerText(),'+%0,01');
 assert.equal(await page.locator('.ss288-passive .ss288-value').evaluate(e=>{const [r,g,b]=getComputedStyle(e).color.match(/\d+/g).map(Number);return g>r&&g>b;}),true,'The contribution stays green in the selected theme');
 await activate(page.locator('.ss288-count').filter({hasText:'Öğrenilmiş'}));
 await page.waitForFunction(()=>LudusPreview.specialStaff.archive?.paper_count===1);
 assert.equal(await page.locator('.ss288-paper-row').count(),1);assert.equal(await page.locator('.ss288-reading-status').innerText(),'✓ Öğrenildi');
 await page.screenshot({path:out+'/profile.png'});
 checkpoint('switch to cook through directory');await activate(page.getByRole('button',{name:'Çalışan ana sayfasına dön'}));await activate(page.getByRole('button',{name:'Çalışan listesine dön'}));await activate(page.locator('.ss288-person[data-role="cook"]'));
 await page.waitForFunction(()=>LudusPreview.specialStaff.state?.role==='cook'&&document.querySelector('.ss288-portrait img')?.naturalWidth>0);
 assert.equal(await page.locator('.ss288-overall strong').innerText(),'0 / 100');
 checkpoint('return to directory');await activate(page.getByRole('button',{name:'Çalışan listesine dön'}));await page.locator('#specialStaffModal[data-directory=true]').waitFor();checkpoint('close directory');await activate(page.getByRole('button',{name:'Özel çalışanları kapat'}));assert.equal(await page.evaluate(()=>LudusPreview.paused),false);
 if(safari)await page.evaluate(()=>{
  for(const [label,object,method]of [['world',LudusPreview.renderer,'render'],['staff',LudusPreview.staffStations,'tick'],['imperial',LudusPreview.imperial,'tick'],['kitchen',LudusPreview.foodSystem,'tick'],['stable',LudusPreview.stableRoom,'tick']]){let count=0;const fn=object[method];object[method]=function(...args){const log=++count<=3;if(log)console.log('STAFF_TRACE before '+label);const value=fn.apply(this,args);if(log)console.log('STAFF_TRACE after '+label);return value;};}
  requestAnimationFrame(()=>console.log('STAFF_TRACE animation callback resumed'));
  let count=0;const timer=setInterval(()=>{console.log('STAFF_TRACE timer '+JSON.stringify({visibility:document.visibilityState,paused:LudusPreview.paused,staff:LudusPreview.staffStations.entries.map(e=>({id:e.d.id,ready:e.ready,visible:e.group.visible}))}));if(++count===4)clearInterval(timer);},1000);
 });
 const roles=[];for(const [room,id]of [['dining','cook'],['infirmary','doctor'],['upgrades','smith']]){checkpoint('visit '+room);await page.evaluate(kind=>{LudusPreview.leaveRoom();LudusPreview.enterRoom(LudusPreview.rooms.find(r=>r.kind===kind));},room);checkpoint('wait for '+room);await page.waitForFunction(id=>LudusPreview.staffStations.entries.some(e=>e.d.id===id&&e.ready&&e.group.visible),id,{timeout:60000,polling:100});roles.push(await page.evaluate(id=>{const e=LudusPreview.staffStations.entries.find(e=>e.d.id===id);return {id,model:e.group.children[0].userData.staffRole,blocked:!LudusPreview.allowed(e.d.x,e.d.z)};},id));}assert(roles.every(r=>r.id===r.model&&r.blocked));
 checkpoint('visit office chest');await page.evaluate(()=>{LudusPreview.leaveRoom();LudusPreview.enterRoom(LudusPreview.rooms.find(r=>r.kind==='office'));});await page.waitForFunction(()=>LudusPreview.personalVault.chest?.parent===LudusPreview.roomProps&&LudusPreview.roomColliders.some(c=>c.kind==='personal-vault'),null,{timeout:60000});await page.evaluate(()=>Object.assign(LudusPreview.player,{x:-2.1,z:.4,yaw:0,pitch:0}));await page.locator('#personalVaultMarker').waitFor({state:'visible',timeout:30000});await page.screenshot({path:out+'/office-chest.png'});await activate(page.getByRole('button',{name:'Ludus kasasını aç'}));await page.locator('#personalVaultModal').waitFor({state:'visible'});await activate(page.getByRole('button',{name:'Kasayı kapat'}));
 checkpoint('visit stable');await page.evaluate(()=>{LudusPreview.leaveRoom();LudusPreview.enterRoom(LudusPreview.rooms.find(r=>r.kind==='stable'));});await page.waitForFunction(()=>LudusPreview.stableRoom.groom?.userData.staffRole==='groom',null,{timeout:60000});
 checkpoint('kitchen portions');await page.evaluate(()=>{LudusPreview.leaveRoom();LudusPreview.enterRoom(LudusPreview.rooms.find(r=>r.kind==='dining'));});await page.waitForFunction(()=>LudusPreview.diningRoom.ready);await page.evaluate(()=>LudusPreview.foodSystem.open());await page.getByLabel('Yemek verilen kişiler').waitFor();assert.match(await page.getByLabel('Yemek verilen kişiler').innerText(),/10 gladyatör · 8 kervan işçisi · 6 özel çalışan/);assert.match(await page.locator('.kitchen-date').innerText(),/24 kişi/);
 // Open each viewport separately; repeated resizing of the live courtyard can stall software WebGL.
 for(const [width,height]of [[1280,588],[568,320]]){checkpoint('viewport '+width);await page.close();await openViewport(width,height);await page.evaluate(()=>LudusPreview.specialStaff.open('guard'));await page.waitForFunction(()=>LudusPreview.specialStaff.state?.role==='guard'&&document.querySelector('.ss288-portrait img')?.naturalWidth>0,null,{timeout:90000});await checkLayout(width,height);}
 assert.deepEqual(layoutErrors,[]);assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,layoutChecks:9,models:6,catalogVersion:288,catalogReadRetry:true,collectionOverall:true,photographicPortraits:6,percentPrecision:true,kitchenPeople:true,errors}));
 }catch(error){console.error(error);let timer;try{if(page&&!page.isClosed()){const info=await Promise.race([page.evaluate(()=>({visibility:document.visibilityState,role:window.LudusPreview?.specialStaff?.state?.role,modal:document.querySelector('#specialStaffModal')?.getAttribute('aria-busy'),portrait:document.querySelector('.ss288-portrait img')?.outerHTML,screen:document.querySelector('#specialStaffModal')?.dataset.screen,selected:document.querySelector('.ss288-tab[aria-current=page]')?.textContent,footer:document.querySelector('.ss288-footer')?.textContent})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('diagnostic timeout')),5000);})]);console.error('Staff failure state',JSON.stringify(info));await page.screenshot({path:out+'/failure.png',timeout:5000});}}catch(e){console.error('Staff failure diagnostics',e.message);}finally{clearTimeout(timer);}throw error;}finally{checkpoint('close browser');await browser.close();clearTimeout(watchdog);}
})().catch(e=>{console.error(e);process.exitCode=1;});
