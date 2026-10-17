// Browser regression against the real courtyard; account APIs are mocked.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),exercise=require('../gladiator-exercise-v46.js');
const root=path.resolve(__dirname,'..'),owner='00000000-0000-4000-8000-000000000109';
require('../ludus-first-quests-v111.js');const questCatalog=globalThis.LudusOnboarding.quests;
const combatReport=process.env.LUDUS_COMBAT_VALUES_TEST?JSON.parse(fs.readFileSync(path.join(process.env.LUDUS_TEST_OUTPUT||'/tmp/combat-values-v110','combat-values-fixture.json'),'utf8')):null;
const fighters=['murmillo','retiarius'].map((type,i)=>({id:'00000000-0000-4000-8000-00000000011'+i,name:['Aulus Varro','Cassius Nero'][i],class:type,owner_id:owner,overall:50,level:1,status:'available',session:null,stat_version:46,base_stats:exercise.profile(type),fatigue_value:0,exercise_units:0}));
const items=fighters.flatMap(g=>[['weapon','gladius','main_hand'],['shield','large','off_hand'],['helmet','gold','helmet'],['chest','murmillo','chest'],['gloves','starter','gloves'],['legs','starter','legs']].map(([kind,model,slot],i)=>({id:g.id+'-'+i,owner_id:owner,kind,model,equipped_by:g.id,equipped_slot:slot,enhancement:0})));
const mission={id:'00000000-0000-4000-8000-000000000119',title:'Aventinus Tepesi’nde Hırsız Avı',description:'Mahalledeki hırsızların izini sür.',difficulty:1,slot:1,day:'2026-10-17',image:'imperial-missions/gun01-kolay-aventinus-kart.webp'};
const fixture=`
window.__fixtureUser={id:${JSON.stringify(owner)},is_anonymous:false,user_metadata:{}};
window.__fighters=${JSON.stringify(fighters)};window.__items=${JSON.stringify(items)};window.__mission=${JSON.stringify(mission)};
window.__guideState=JSON.parse(localStorage.getItem('test-guide-state')||'null')||{should_open:true,quests:Object.fromEntries(${JSON.stringify(questCatalog.map(q=>q[0]))}.map((key,i)=>[key,{progress:0,target:['inspect','training'].includes(key)?2:key==='stones'?4:1,complete:false,unlocked:i<22}])),count:0,total:22,starters:__fighters.map(g=>g.id),inspected:[],trained:[],completed_at:null};
window.__calc=function(){for(const q of Object.values(__guideState.quests))q.complete=q.progress===q.target;__guideState.count=Object.entries(__guideState.quests).filter(([k,q])=>!['supply','craft'].includes(k)&&q.complete).length;if(__guideState.count===22)__guideState.completed_at=__guideState.completed_at||new Date().toISOString();localStorage.setItem('test-guide-state',JSON.stringify(__guideState));};
window.__assignments=[];window.__rpcCalls=[];window.__authListeners=[];window.__failGuide=false;
window.__combatReport=${JSON.stringify(combatReport)};
window.__fixtureClient={
 auth:{getUser:async()=>({data:{user:__fixtureUser}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:fn=>{__authListeners.push(fn);return{};}},
 from:name=>{const value=name==='ludus_accounts'?{user_id:__fixtureUser.id,ludus_name:'Test Ludus',gold:1000,diamonds:3}:name==='ludus_gladiators'?__fighters:name==='ludus_items'?__items:[];const b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data:value}),then:(r,j)=>Promise.resolve({data:value}).then(r,j)};return b;},
 rpc:async(name,args={})=>{
  __rpcCalls.push({name,args});
  if(name==='ludus_combat_values')return{data:{...__combatReport,owner_id:__fixtureUser.id,gladiator:__fighters.find(g=>g.id===args.p_gladiator)}};
  const training=()=>({server_now:new Date().toISOString(),gladiators:__fighters});
  if(name==='ludus_first_quests'){
   if(__failGuide)return{error:{message:'Offline fixture'}};
   if(args.p_action==='present'||args.p_action==='dismiss')__guideState.should_open=false;
   if(args.p_action==='inspect'){if(!__guideState.inspected.includes(args.p_subject))__guideState.inspected.push(args.p_subject);__guideState.quests.inspect.progress=__guideState.inspected.length;}
   if(['controls','combat'].includes(args.p_action))__guideState.quests[args.p_action].progress=1;
   __calc();return{data:JSON.parse(JSON.stringify(__guideState))};
  }
  if(name==='ludus_train_exercise'){
   for(const id of args.p_gladiators){const g=__fighters.find(g=>g.id===id);g.session={id:'training-'+id,exercise_stat:args.p_stat,started_at:new Date().toISOString(),train_until:new Date(Date.now()+3600000).toISOString(),rest_until:new Date(Date.now()+7200000).toISOString()};g.trained_today=true;}
   __guideState.trained=[...new Set([...__guideState.trained,...args.p_gladiators])];__guideState.quests.training.progress=__guideState.trained.length;__calc();return{data:training()};
  }
  if(name==='ludus_imperial'){
   if(args.p_action==='join'){for(const id of args.p_gladiators)__fighters.find(g=>g.id===id).status='locked';__assignments.push({id:'assignment',mission_id:__mission.id,mission:__mission,gladiators:__fighters.filter(g=>args.p_gladiators.includes(g.id)),ends_at:new Date(Date.now()+43200000).toISOString(),claimed_at:null});}
   return{data:{...training(),missions:[__mission],assignments:__assignments,is_admin:false,today:'2026-10-17'}};
  }
  return{data:name==='ludus_message_center'?{friends:[],conversations:[],unread:0,can_send:false,messages:[],message_total:0,notifications:[],notification_total:0,notification_unread:0}:name==='ludus_clan'||name==='ludus_clan_vault'?{...training(),clan:null}:name==='ludus_progress'?{level:1,current_exp:0,next_exp:3000,claimable_count:0}:name==='ludus_daily_state'?{missions:[],claimed_count:0,bonus_claimed:false}:training()};
 }
};
const accountClient=window.__fixtureClient;`;
const standalone=`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;overflow:hidden;background:#32251d}.tools{display:flex}button{font:14px Georgia}</style><link rel="stylesheet" href="/ludus-first-quests-v111.css"></head><body><div class="tools"><button id="accountLink">Ayarlar</button></div><script>${fixture}</script><script src="/combat-control-settings-v44.js"></script><script src="/ludus-settings-v29.js"></script><script src="/ludus-first-quests-v111.js"></script><script>
let paused=false;const roster=__fighters.map(record=>({record,name:record.name,type:record.class}));let guide;
const settings=LudusViewSettings.create({onHelp:()=>guide.open(),onControlsSave:value=>guide.record('controls',value),onChange:()=>{},onOpen:()=>{paused=true;},onClose:()=>{paused=false;}});
guide=LudusOnboarding.create({client:__fixtureClient,getUser:()=>__fixtureUser?.id,menu:document.querySelector('.tools'),roster:()=>roster,canOpen:()=>!paused,refresh:async()=>{},onOpen:()=>{paused=true;},onClose:()=>{paused=false;},navigate:target=>{if(target==='settings')settings.open();}});
document.querySelector('#accountLink').onclick=()=>settings.open();window.LudusPreview={beginnerGuide:guide,viewSettings:settings,roster,get paused(){return paused;}};guide.start();</script></body></html>`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{if(req.url.startsWith('/guide-fixture')){res.setHeader('Content-Type','text/html');res.end(standalone);return;}const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}let body=fs.readFileSync(file);if(file.endsWith('/ludus.html'))body=Buffer.from(body.toString().replace(/const accountClient=LudusClient.create\([^;]+;/,()=>fixture));res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);});
async function layout(page,label,selector='#beginnerGuide'){
 const bad=await page.evaluate(selector=>[...document.querySelectorAll(selector+','+selector+' *')].filter(e=>e.getClientRects().length&&!(e instanceof SVGElement)).flatMap(e=>{const r=e.getBoundingClientRect();return e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2||r.top<-.5||r.bottom>innerHeight+.5||r.left<-.5||r.right>innerWidth+.5?[{class:e.className,tag:e.tagName,text:e.textContent.slice(0,50),height:e.clientHeight,scroll:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth}]:[];}),selector);
 assert.deepEqual(bad,[],label+' overflow');
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:852,height:393}});await context.route(/^https:/,r=>r.abort());
 const page=await context.newPage(),errors=[],standalone=!!process.env.LUDUS_QUEST_STANDALONE;page.on('pageerror',e=>errors.push(e.stack||e.message));
 const clickQuest=async key=>{await page.getByRole('button',{name:'İlk görevler',exact:true}).click();while(!await page.locator('.fq-row[data-quest="'+key+'"]').count())await page.getByRole('button',{name:'Sonraki görev sayfası',exact:true}).click();await page.locator('.fq-row[data-quest="'+key+'"]').click();};
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+(standalone?'/guide-fixture':'/ludus.html'),{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#beginnerGuide:not([hidden])',{timeout:60000});await page.waitForFunction(()=>LudusPreview.beginnerGuide.state?.total===22);
  assert.equal(await page.locator('.fq-count').textContent(),'0 / 22 tamamlandı');assert.equal(await page.evaluate(()=>LudusPreview.paused),true);
  for(const [width,height]of [[1440,900],[874,402],[852,393],[740,360],[667,375],[568,320]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(150);await page.getByRole('button',{name:'İlk görevler',exact:true}).click();
   const seen=new Set();do{const rows=await page.locator('.fq-row').getAttribute('data-quest').catch(()=>null);for(const key of await page.locator('.fq-row').evaluateAll(rows=>rows.map(r=>r.dataset.quest))){seen.add(key);await page.locator('.fq-row[data-quest="'+key+'"]').click();await layout(page,width+'x'+height+' '+key);}const next=page.getByRole('button',{name:'Sonraki görev sayfası',exact:true});if(await next.isDisabled())break;await next.click();}while(true);
   assert.equal(seen.size,22);await page.getByRole('button',{name:'5. seviye görevleri',exact:true}).click();assert.equal(await page.locator('.fq-row').count(),2);await layout(page,'advanced '+width+'x'+height);console.log('PASS all 22 quest pages '+width+'x'+height);
  }
  await page.setViewportSize({width:852,height:393});await page.waitForTimeout(100);await clickQuest('inspect');
  fs.mkdirSync('/tmp/first-quests-v111',{recursive:true});await page.screenshot({path:'/tmp/first-quests-v111/guide.png'});
  if(!standalone){
   await page.setViewportSize({width:393,height:852});await page.waitForTimeout(150);assert.equal(await page.locator('#landscapeGate').isVisible(),true);assert.equal(await page.locator('#beginnerGuide').isVisible(),false);assert.equal(await page.locator('#beginnerGuide').evaluate(e=>e.inert),true);
   await page.setViewportSize({width:852,height:393});await page.waitForTimeout(150);
   await page.locator('.fq-action[data-fighter="'+fighters[0].id+'"]').click();await page.waitForSelector('#orders:not([hidden])');
   await page.waitForFunction(()=>__guideState.quests.inspect.progress===1);
   // Switching within the detail panel must inspect the second gladiator too.
   await page.locator('.exercise-roster-card').filter({hasText:'Cassius Nero'}).click();await page.waitForFunction(()=>__guideState.quests.inspect.progress===2);
   if(combatReport){await page.getByRole('button',{name:'Savaş Değerleri',exact:true}).click();await page.waitForSelector('.combat-values-stat');await page.locator('.combat-values-stat').first().click();await page.waitForFunction(()=>__guideState.quests.combat.complete);await page.keyboard.press('Escape');}
   await page.evaluate(()=>LudusPreview.exercisePanel.close());await page.waitForSelector('#beginnerGuide:not([hidden])');
   await clickQuest('training');await page.locator('.fq-action[data-fighter="'+fighters[0].id+'"]').click();await page.click('.exercise-primary');await page.waitForFunction(()=>__guideState.quests.training.progress===1);await page.evaluate(()=>LudusPreview.exercisePanel.close());await page.waitForSelector('#beginnerGuide:not([hidden])');
   await page.locator('.fq-action[data-fighter="'+fighters[1].id+'"]').click();await page.click('.exercise-primary');await page.waitForFunction(()=>__guideState.quests.training.complete);await page.evaluate(()=>LudusPreview.exercisePanel.close());await page.waitForSelector('#beginnerGuide:not([hidden])');
  }
  await clickQuest('controls');await page.getByRole('button',{name:'Ayarları aç',exact:true}).click();await page.waitForSelector('.ludus-view-settings[open]');
  for(const [width,height]of [[852,393],[568,320]]){await page.setViewportSize({width,height});await layout(page,'settings '+height,'.ludus-view-settings');}
  await page.locator('#combatControlPreset').selectOption('classic');await page.click('#saveCombatControls');await page.waitForFunction(()=>__guideState.quests.controls.complete);await page.getByRole('button',{name:'Yardım · Başlangıç rehberi',exact:true}).click();await page.waitForSelector('#beginnerGuide:not([hidden])');
  await page.evaluate(()=>{__failGuide=true;return LudusPreview.beginnerGuide.refresh();});await page.getByRole('button',{name:'Tekrar dene',exact:true}).waitFor();await layout(page,'offline');await page.evaluate(()=>__failGuide=false);await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.fq-status').textContent.includes('yenilenemedi'));
  // Server fixture reports real completion; the client cannot toggle goals itself.
  await page.evaluate(()=>{for(const [key,q]of Object.entries(__guideState.quests))if(!['supply','craft'].includes(key))q.progress=q.target;__calc();return LudusPreview.beginnerGuide.refresh();});await page.waitForFunction(()=>LudusPreview.beginnerGuide.state.count===22);
  assert.equal(await page.locator('#beginnerOpen').isVisible(),false);await page.getByRole('button',{name:'Başlangıç rehberini kapat',exact:true}).click();assert.equal(await page.evaluate(()=>LudusPreview.paused),false);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>LudusPreview.beginnerGuide.state?.count===22);assert.equal(await page.locator('#beginnerOpen').isVisible(),false);assert.equal(await page.locator('#beginnerGuide').isVisible(),false);
  await page.click('#accountLink');await page.click('#beginnerHelp');await page.waitForSelector('#beginnerGuide:not([hidden])');assert.equal(await page.locator('.fq-count').textContent(),'22 / 22 tamamlandı');
  await page.evaluate(()=>__authListeners.forEach(fn=>fn('SIGNED_OUT',null)));assert.equal(await page.locator('#beginnerGuide').isVisible(),false);assert.equal(await page.locator('#beginnerOpen').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS: guide paging, settings/help, completion, hidden book after reload, offline retry, account reset'+(standalone?'':' and full courtyard inspection/training/rotation'));
 }catch(e){console.error(e,{errors});try{fs.mkdirSync('/tmp/first-quests-v111',{recursive:true});await page.screenshot({path:'/tmp/first-quests-v111/failure.png'});console.log('FAIL_SCREENSHOT_BASE64:'+(await page.screenshot({type:'jpeg',quality:55})).toString('base64')+':END_FAIL_SCREENSHOT');}catch{}throw e;}
 finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
