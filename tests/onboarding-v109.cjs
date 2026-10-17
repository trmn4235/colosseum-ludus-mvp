// Browser regression against the real courtyard; account APIs are mocked.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),exercise=require('../gladiator-exercise-v46.js');
const root=path.resolve(__dirname,'..'),owner='00000000-0000-4000-8000-000000000109';
const fighters=['murmillo','retiarius'].map((type,i)=>({id:'00000000-0000-4000-8000-00000000011'+i,name:['Aulus Varro','Cassius Nero'][i],class:type,owner_id:owner,overall:50,level:1,status:'available',session:null,stat_version:46,base_stats:exercise.profile(type),fatigue_value:0,exercise_units:0}));
const items=fighters.flatMap(g=>[['weapon','gladius','main_hand'],['shield','large','off_hand'],['helmet','gold','helmet'],['chest','murmillo','chest'],['gloves','starter','gloves'],['legs','starter','legs']].map(([kind,model,slot],i)=>({id:g.id+'-'+i,owner_id:owner,kind,model,equipped_by:g.id,equipped_slot:slot,enhancement:0})));
const mission={id:'00000000-0000-4000-8000-000000000119',title:'Aventinus Tepesi’nde Hırsız Avı',description:'Mahalledeki hırsızların izini sür.',difficulty:1,slot:1,day:'2026-10-17',image:'imperial-missions/gun01-kolay-aventinus-kart.webp'};
const fixture=`
window.__fixtureUser={id:${JSON.stringify(owner)},is_anonymous:false,user_metadata:{}};
window.__fighters=${JSON.stringify(fighters)};window.__items=${JSON.stringify(items)};window.__mission=${JSON.stringify(mission)};
window.__guideState=JSON.parse(localStorage.getItem('test-guide-state')||'null')||{should_open:true,steps:{inspect:false,equipment:true,mission:false,training:false},completed_at:null};
window.__assignments=[];window.__rpcCalls=[];window.__authListeners=[];window.__failGuide=false;
window.__fixtureClient={
 auth:{getUser:async()=>({data:{user:__fixtureUser}}),getSession:async()=>({data:{session:null}}),onAuthStateChange:fn=>{__authListeners.push(fn);return{};}},
 from:name=>{const value=name==='ludus_accounts'?{user_id:__fixtureUser.id,ludus_name:'Test Ludus',gold:1000,diamonds:3}:name==='ludus_gladiators'?__fighters:name==='ludus_items'?__items:[];const b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data:value}),then:(r,j)=>Promise.resolve({data:value}).then(r,j)};return b;},
 rpc:async(name,args={})=>{
  __rpcCalls.push({name,args});
  const training=()=>({server_now:new Date().toISOString(),gladiators:__fighters});
  if(name==='ludus_onboarding'){
   if(__failGuide)return{error:{message:'Offline fixture'}};
   if(args.p_action==='present'||args.p_action==='dismiss')__guideState.should_open=false;
   if(args.p_action==='inspect')__guideState.steps.inspect=true;
   if(Object.values(__guideState.steps).every(Boolean))__guideState.completed_at=__guideState.completed_at||new Date().toISOString();
   localStorage.setItem('test-guide-state',JSON.stringify(__guideState));return{data:JSON.parse(JSON.stringify(__guideState))};
  }
  if(name==='ludus_train_exercise'){
   for(const id of args.p_gladiators){const g=__fighters.find(g=>g.id===id);g.session={id:'training-'+id,exercise_stat:args.p_stat,started_at:new Date().toISOString(),train_until:new Date(Date.now()+3600000).toISOString(),rest_until:new Date(Date.now()+7200000).toISOString()};g.trained_today=true;}
   __guideState.steps.training=true;return{data:training()};
  }
  if(name==='ludus_imperial'){
   if(args.p_action==='join'){__guideState.steps.mission=true;for(const id of args.p_gladiators)__fighters.find(g=>g.id===id).status='locked';__assignments.push({id:'assignment',mission_id:__mission.id,mission:__mission,gladiators:__fighters.filter(g=>args.p_gladiators.includes(g.id)),ends_at:new Date(Date.now()+43200000).toISOString(),claimed_at:null});}
   return{data:{...training(),missions:[__mission],assignments:__assignments,is_admin:false,today:'2026-10-17'}};
  }
  return{data:name==='ludus_message_center'?{friends:[],conversations:[],unread:0,can_send:false,messages:[],message_total:0,notifications:[],notification_total:0,notification_unread:0}:name==='ludus_clan'||name==='ludus_clan_vault'?{...training(),clan:null}:name==='ludus_progress'?{level:1,current_exp:0,next_exp:3000,claimable_count:0}:name==='ludus_daily_state'?{missions:[],claimed_count:0,bonus_claimed:false}:training()};
 }
};
const accountClient=window.__fixtureClient;`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}let body=fs.readFileSync(file);if(file.endsWith('/ludus.html'))body=Buffer.from(body.toString().replace(/const accountClient=LudusClient.create\([^;]+;/,()=>fixture));res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);});
async function layout(page,label){
 const bad=await page.evaluate(()=>{
  const selectors=['#beginnerGuide','.bg-shell','.bg-panel','.bg-fighter','.bg-items','.bg-goals','.bg-bottom'];
  return [...document.querySelectorAll(selectors.join(','))].filter(e=>e.getClientRects().length).flatMap(e=>{
   const r=e.getBoundingClientRect(),bad=e.scrollHeight>e.clientHeight+2||r.top<-.5||r.bottom>innerHeight+.5||r.left<-.5||r.right>innerWidth+.5;
   return bad?[{class:e.className,height:e.clientHeight,scroll:e.scrollHeight,top:r.top,bottom:r.bottom}]:[];
  });
 });
 assert.deepEqual(bad,[],label+' overflow');
 const clipped=await page.evaluate(()=>[...document.querySelectorAll('#beginnerGuide button')].filter(e=>e.getClientRects().length).flatMap(e=>{const r=e.getBoundingClientRect(),parent=e.closest('.bg-panel');if(!parent)return[];const p=parent.getBoundingClientRect();return r.bottom>p.bottom+1||r.top<p.top-1?[e.getAttribute('aria-label')]:[];}));
 assert.deepEqual(clipped,[],label+' unreachable buttons');
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:852,height:393}});await context.route(/^https:/,r=>r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack||e.message));
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/ludus.html',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#beginnerGuide:not([hidden])',{timeout:60000});
  await page.waitForFunction(()=>LudusPreview.beginnerGuide.state?.steps.equipment);
  assert.equal(await page.locator('.bg-fighter').count(),2);assert.equal(await page.evaluate(()=>LudusPreview.paused),true);
  for(const [width,height]of [[1440,900],[852,393],[874,402],[740,360],[667,375],[393,852],[320,568]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(150);
   if(height>width){assert.equal(await page.locator('#landscapeGate').isVisible(),true);assert.equal(await page.locator('#beginnerGuide').isVisible(),false);assert.equal(await page.locator('#beginnerGuide').evaluate(e=>e.inert),true);console.log('PASS rotation gate '+width+'x'+height);continue;}
   assert.equal(await page.locator('#landscapeGate').isVisible(),false);
   for(const tab of width<=700?['Gladyatörler','Ekipman','İlk görev']:[null]){if(tab)await page.locator('.bg-tabs').getByRole('button',{name:tab,exact:true}).click();await layout(page,width+'x'+height+' '+tab);}
   console.log('PASS layout '+width+'x'+height);
  }
  await page.setViewportSize({width:852,height:393});await page.waitForTimeout(100);
  console.log('GUIDE_SCREENSHOT_BASE64:'+(await page.screenshot({type:'jpeg',quality:65})).toString('base64')+':END_GUIDE_SCREENSHOT');
  await page.getByRole('button',{name:'Aulus Varro · İncele',exact:true}).click();await page.waitForSelector('#orders:not([hidden])');
  assert.equal(await page.evaluate(()=>LudusPreview.paused),true);
  await page.evaluate(()=>LudusPreview.exercisePanel.close());await page.waitForSelector('#beginnerGuide:not([hidden])');await page.waitForFunction(()=>LudusPreview.beginnerGuide.state.steps.inspect);
  await page.getByRole('button',{name:'Ekipmanını hazırla · Tamamlandı',exact:true}).click();await page.waitForSelector('#orders:not([hidden])');
  await page.evaluate(()=>LudusPreview.exercisePanel.close());await page.waitForSelector('#beginnerGuide:not([hidden])');
  await page.getByRole('button',{name:'Görevi seç  ›',exact:true}).click();await page.waitForSelector('#imperialJoin');
  assert.equal(await page.evaluate(()=>LudusPreview.beginnerGuide.state.steps.mission),false,'Opening mission must not complete it');
  await page.locator('.imperial-roster button').filter({hasText:'Aulus Varro'}).click();await page.click('#imperialJoin');await page.waitForFunction(()=>__guideState.steps.mission);
  await page.evaluate(()=>LudusPreview.imperial.close());await page.waitForSelector('#beginnerGuide:not([hidden])');
  await page.getByRole('button',{name:'Antrenmana başla',exact:true}).click();await page.waitForSelector('#orders:not([hidden])');
  assert.equal(await page.evaluate(()=>LudusPreview.exercisePanel.selected.name),'Cassius Nero');
  await page.click('.exercise-primary');await page.waitForFunction(()=>__guideState.steps.training);
  await page.evaluate(()=>LudusPreview.exercisePanel.close());await page.waitForSelector('#beginnerGuide:not([hidden])');
  await page.waitForFunction(()=>!!LudusPreview.beginnerGuide.state.completed_at);assert.equal(await page.locator('.bg-goal[data-complete=true]').count(),4);
  await page.getByRole('button',{name:'Ludus’a dön',exact:true}).click();assert.equal(await page.evaluate(()=>LudusPreview.paused),false);
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>LudusPreview.beginnerGuide.state?.completed_at);
  assert.equal(await page.locator('#beginnerGuide').isVisible(),false,'Completed guide must not auto-open');
  await page.click('#beginnerOpen');await page.waitForSelector('#beginnerGuide:not([hidden])');
  await page.evaluate(()=>{__failGuide=true;return LudusPreview.beginnerGuide.refresh();});
  await page.waitForFunction(()=>document.querySelector('.bg-status').textContent.includes('kaydedilemedi'));
  await page.setViewportSize({width:667,height:375});await page.waitForTimeout(150);await layout(page,'offline message');
  await page.evaluate(()=>__failGuide=false);await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.bg-status').textContent.includes('kaydedilemedi'));
  await page.locator('.bg-tabs').getByRole('button',{name:'Gladyatörler',exact:true}).click();
  await page.evaluate(()=>{LudusPreview.roster[0].name='<img src=x onerror=alert(1)>';return LudusPreview.beginnerGuide.refresh();});
  assert.equal(await page.locator('.bg-fighter-copy h3 img').count(),0,'Names must be plain text');await layout(page,'long name');
  await page.evaluate(()=>__authListeners.forEach(fn=>fn('SIGNED_OUT',null)));
  assert.equal(await page.locator('#beginnerGuide').isVisible(),false);assert.equal(await page.locator('#beginnerOpen').isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: real courtyard; auto-open, navigation, mission/training, resume/pause, persistence, manual reopen, retry, account reset, text safety.');
 }catch(e){console.error(e,{errors});try{console.log('FAIL_SCREENSHOT_BASE64:'+(await page.screenshot({type:'jpeg',quality:60,timeout:5000})).toString('base64')+':END_FAIL_SCREENSHOT');}catch{}throw e;}
 finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
