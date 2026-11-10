const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'..'),id='00000000-0000-4000-8000-000000000001';
const clans=Array.from({length:6},(_,i)=>({id:'clan-'+i,name:i===0?'Legio Aurea':'Klan '+i}));
const players=Array.from({length:26},(_,i)=>({id:'user-'+i,name:'user'+i,subtitle:i===0?'<img src=x onerror=alert(1)>':'Ludus '+i,clan_id:i<21?'clan-0':'clan-'+(i-20),stats:{power:i===20?null:50+i},gladiator:{name:'Gladyatör '+i}}));
const clan={wallet:{ludus_name:'Aquila',gold:10},clan:{id:'clan-0',name:'Legio Aurea',level:1,gold:0,member_count:10,capacity:10,emblem:2,emblem_color:'#c7a967',background:'#591823',experience:0,exp_cost:1,coin_cost:1,lifetime_experience:0},leader:true,members:Array.from({length:10},(_,i)=>({user_id:i?'member-'+i:id,name:i?'Ludus '+['Aquila','Varro','Felix','Drusus','Cassius','Titus','Lucius','Aurelius','Maximus'][i-1]+'-'+i:'Tırman',username:i?'ludus_'+i:'trmn42',leader:i===0,online:i===0,vault_access:i===0})),requests:[],trophies:{},inventory:[],vault:[],ledger:[],gladiators:[],roster:null};
function fixtureClient(clan,clans,players,id){window.__clanFixture=clan;window.__botState={user_id:id,ready:true,enabled:true,created:39,total:39,bots:Array.from({length:39},(_,i)=>({slot:i+1,name:'Bot '+(i+1),clan:'Legio',matches:i,gold:100,diamonds:2,enabled:true,build:[1,3,10,12]}))};return {
 auth:{getUser:async()=>({data:{user:{id}},error:null})},
 rpc:(name,args={})=>{const p=(async()=>{if(name==='ludus_bot_admin_v233'){if(args.p_action==='bot')window.__botState.bots.find(b=>b.slot===args.p_data.slot).enabled=args.p_data.enabled;if(args.p_action==='fleet')window.__botState.enabled=args.p_data.enabled;return {data:structuredClone(window.__botState),error:null};}if(name==='ludus_clan'){if(args.p_action==='permission')clan.members.find(m=>m.user_id===args.p_data.user_id).vault_access=args.p_data.enabled;return {data:args.p_action==='permission'?{state:structuredClone(clan)}:structuredClone(clan),error:null};}if(name==='ludus_rankings_v203'){
 window.__requests.push(args);if(window.__fail)return {data:null,error:{message:'Bağlantı hatası'}};
 return {data:{page:args.p_page,total:players.length,rows:players.slice(args.p_page*20,(args.p_page+1)*20),clans},error:null};}
 return {data:{},error:null};})();p.abortSignal=()=>p;return p;}
};}
const mock=`window.__requests=[];window.__fail=false;window.__client=(${fixtureClient.toString()})(${JSON.stringify(clan)},${JSON.stringify(clans)},${JSON.stringify(players)},${JSON.stringify(id)});`;
(async()=>{
 const browser=await (process.env.LUDUS_WEBKIT_TEST?webkit:chromium).launch({headless:true,...(!process.env.LUDUS_WEBKIT_TEST?{executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']}: {})});
 const out=process.env.LUDUS_TEST_OUTPUT||'/tmp';fs.mkdirSync(out,{recursive:true});
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Clan browser error:',e.message);});
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://clan.test')return route.abort();const file=path.join(root,decodeURIComponent(u.pathname));if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404});let body=fs.readFileSync(file);
  if(file.endsWith('.html'))body=Buffer.from(body.toString().replace('<head>','<head><script>'+mock+'</script>').replaceAll(/LudusClient\.create\([^)]*\)/g,'window.__client'));
  return route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'});
 });
 await page.goto('https://clan.test/klan.html');await page.locator('.homeBanner').waitFor();await page.locator('[data-view="bots"]').waitFor();
 for(const [width,height]of [[1536,706],[874,402],[844,390],[667,375],[568,320]]){
  await page.setViewportSize({width,height});await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.getElementById('clanStage')).transform).a-Math.min(innerWidth/1440,innerHeight/760))<.001);
  const layout=await page.evaluate(()=>{const nav=[...document.querySelectorAll('.clan-navigation .nav,.clan-navigation a')];const boxes=nav.map(e=>e.getBoundingClientRect());return {count:nav.length,sameRow:boxes.every(r=>Math.abs(r.top-boxes[0].top)<2),inHeader:boxes.every(r=>r.top>=0&&r.bottom<=document.querySelector('.clan-topbar').getBoundingClientRect().bottom+1),clipped:nav.filter(e=>[...e.querySelectorAll('span')].some(s=>s.scrollWidth>s.clientWidth+1)).map(e=>e.textContent),sidebar:!!document.querySelector('.sidebar'),bodyScroll:document.documentElement.scrollHeight>innerHeight+1};});
  assert.deepEqual(layout,{count:9,sameRow:true,inHeader:true,clipped:[],sidebar:false,bodyScroll:false},width+' horizontal clan navigation');
  await page.screenshot({path:path.join(out,'clan-home-'+width+'x'+height+'.png')});
 }
 for(const view of ['members','manage']){
  await page.locator('[data-view="'+view+'"]').click();
  for(const [width,height]of [[1536,706],[874,402],[844,390],[667,375],[568,320]]){
   await page.setViewportSize({width,height});await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.getElementById('clanStage')).transform).a-Math.min(innerWidth/1440,innerHeight/760))<.001);
   const layout=await page.evaluate(()=>{
    const list=document.querySelector('.memberList'),panel=list.closest('.panel'),bounds=list.getBoundingClientRect(),rows=[...list.querySelectorAll(':scope>.row,:scope>.permissionRow')];
    return {count:rows.length,scroll:list.scrollHeight>list.clientHeight+1||panel.scrollHeight>panel.clientHeight+1,
     outside:rows.some(r=>{const b=r.getBoundingClientRect();return b.top<bounds.top-1||b.bottom>bounds.bottom+1;}),
     clipped:rows.some(r=>[r,...r.querySelectorAll('.identity,strong,small,button')].some(e=>e.scrollHeight>e.clientHeight+1)),
     buttonsReachable:rows.every(r=>[...r.querySelectorAll('button')].every(e=>{const b=e.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return hit===e||e.contains(hit);})),
     bodyScroll:document.documentElement.scrollHeight>innerHeight+1};
   });
   assert.deepEqual(layout,{count:10,scroll:false,outside:false,clipped:false,buttonsReachable:true,bodyScroll:false},view+' '+width+' ten visible accounts');
   await page.screenshot({path:path.join(out,'clan-'+view+'-'+width+'x'+height+'.png')});
  }
 }
 await page.locator('[data-action="permission"][data-id="member-9"]').click();await page.waitForFunction(()=>document.querySelector('[data-action="permission"][data-id="member-9"]')?.textContent==='Yetkiyi kaldır');
 await page.locator('[data-action="ask_transfer"][data-id="member-9"]').click();assert.match(await page.locator('#confirmText').textContent(),/Ludus Maximus-9/);await page.locator('#confirmNo').click();
 await page.locator('[data-action="ask_kick"][data-id="member-9"]').click();assert.match(await page.locator('#confirmText').textContent(),/Ludus Maximus-9/);await page.locator('#confirmNo').click();
 await page.evaluate(()=>{__clanFixture.members.push({...__clanFixture.members[9],user_id:'member-10',name:'Ludus Undecimus-10'});});await page.locator('#refresh').click();await page.locator('[data-action="page"][data-key="permissions"][data-page="1"]').waitFor();
 assert.equal(await page.locator('.memberList>.permissionRow').count(),10);assert.equal(await page.locator('.memberList').evaluate(e=>e.scrollHeight<=e.clientHeight+1&&[...e.querySelectorAll('.permissionRow')].every(r=>r.scrollHeight<=r.clientHeight+1)),true,'ten rows and pagination remain visible');await page.locator('[data-action="page"][data-key="permissions"][data-page="1"]').click();assert.equal(await page.locator('.memberList>.permissionRow').count(),1);assert.match(await page.locator('.memberList').textContent(),/Ludus Undecimus-10/);
 await page.locator('[data-view="members"]').click();assert.equal(await page.locator('.memberList>.row').count(),10);await page.locator('[data-action="page"][data-key="members"][data-page="1"]').click();assert.equal(await page.locator('.memberList>.row').count(),1);assert.match(await page.locator('.memberList').textContent(),/Ludus Undecimus-10/);
 await page.setViewportSize({width:844,height:390});await page.locator('[data-view="power"]').click();
 await page.getByText('Klan sıralaması').waitFor();assert.equal(await page.evaluate(()=>__requests.length),2,'all ranking pages loaded');
 assert.equal(await page.locator('[data-power-clan="clan-0"]').count(),1);assert.match(await page.locator('.powerTotal').innerText(),/1\.190/);
 assert.match(await page.locator('[data-power-clan="clan-0"]').innerText(),/1 hesaplanamadı/);
 await page.locator('[data-power-page="member"][data-delta="1"]').click();assert.match(await page.locator('.powerRows').nth(1).innerText(),/Ludus 14/);
 await page.locator('[data-power-page="clan"][data-delta="1"]').click();await page.locator('[data-power-clan]').first().click();assert.notEqual(await page.locator('.powerHeading h2').nth(1).innerText(),'Legio Aurea');
 for(const [width,height]of [[844,390],[667,375],[1536,706]]){await page.setViewportSize({width,height});await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.getElementById('clanStage')).transform).a-Math.min(innerWidth/1440,innerHeight/760))<.001);const boxes=await page.evaluate(()=>{const within=e=>{const r=e.getBoundingClientRect();return r.top>=-1&&r.left>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};return {nav:within(document.querySelector('[data-view="manage"]')),screen:within(document.querySelector('#screen')),panels:[...document.querySelectorAll('.powerPanel')].every(within),page:document.documentElement.scrollHeight<=innerHeight+1};});assert.deepEqual(boxes,{nav:true,screen:true,panels:true,page:true},width+' layout');}
 await page.setViewportSize({width:844,height:390});await page.screenshot({path:path.join(out,'clan-power-v231.png')});
 await page.evaluate(()=>{window.__fail=true});await page.locator('[data-power-refresh]').click();await page.getByText('Bağlantı hatası').waitFor();
 await page.evaluate(()=>{window.__fail=false});await page.locator('[data-power-refresh]').click();await page.waitForFunction(()=>!document.querySelector('.powerError'));
 await page.locator('[data-view="bots"]').click();await page.getByRole('heading',{name:'Bot Ludusları',exact:true}).waitFor();assert.equal(await page.locator('.botRow').count(),5);assert.match(await page.locator('.botDetail').innerText(),/Vita/);
 for(const [width,height]of [[844,390],[667,375],[568,320]]){await page.setViewportSize({width,height});await page.waitForFunction(()=>Math.abs(new DOMMatrixReadOnly(getComputedStyle(document.getElementById('clanStage')).transform).a-Math.min(innerWidth/1440,innerHeight/760))<.001);const fit=await page.evaluate(()=>{const boxes=[...document.querySelectorAll('.botPanel,.botDetail,[data-view="bots"]')].map(e=>{const b=e.getBoundingClientRect();return {name:e.className||e.dataset.view,left:b.left,top:b.top,right:b.right,bottom:b.bottom}});return {boxes,height:document.documentElement.scrollHeight,viewport:[innerWidth,innerHeight]};});assert.ok(fit.boxes.every(b=>b.left>=-1&&b.top>=-1&&b.right<=width+1&&b.bottom<=height+1)&&fit.height<=height+1,'bot admin fits '+width+': '+JSON.stringify(fit));}
 await page.setViewportSize({width:844,height:390});await page.locator('[data-bot-toggle]').click();await page.getByRole('button',{name:'Botu çalıştır'}).waitFor();assert.equal(await page.evaluate(()=>__botState.bots[0].enabled),false);
 await page.locator('[data-bot-fleet]').click();await page.getByRole('button',{name:'Tümünü çalıştır'}).waitFor();assert.equal(await page.evaluate(()=>__botState.enabled),false);
 await page.locator('[data-bot-page="1"]').click();assert.match(await page.locator('.botRow').first().innerText(),/Bot 6/);
 assert.deepEqual(errors,[]);console.log('V231 PASS: all pages, clan sums, unknown scores, pagination, error retry, and landscape layout.');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
