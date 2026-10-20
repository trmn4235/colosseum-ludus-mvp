// Real page markup/styles, with isolated fixtures for daily, clan and level renderers.
// Static-only screens deliberately do not start 3D scenes or authenticated game flows.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/art-v136-pages';fs.mkdirSync(out,{recursive:true});
const user={id:'00000000-0000-4000-8000-000000000001',is_anonymous:false};
const wallet={ludus_name:'Aquila',gold:3660,diamonds:12};
const daily={day:'2026-10-11',server_now:new Date().toISOString(),reset_at:new Date(Date.now()+18*3600000).toISOString(),wallet,claimed_count:1,bonus_claimed:false,bonus_exp:300,missions:[['visit','Ludus’a dönüş','Ludus’unu ziyaret et.',1,1],['battle','Arena zaferi','Arenada bir savaş kazan.',0,1],['training','Disiplinli antrenman','Gladyatörlerine antrenman yaptır.',1,3],['market','Pazar alışverişi','Pazardan bir eşya al.',0,1]].map(([key,title,description,progress,target],i)=>({key,title,description,progress,target,gold:100,ludus_exp:150,claimed:i===0,destination:'ludus.html'}))};
const clan={wallet,clan:{name:'Legio Aurea',level:3,gold:8750,member_count:2,capacity:12,emblem:2,emblem_color:'#c7a967',background:'#591823',experience:1500,exp_cost:5000,coin_cost:6000,lifetime_experience:12000},leader:true,members:[{name:'Aquila',username:'aquila',leader:true,online:true},{name:'Invicta',username:'invicta',online:false}],requests:[],trophies:{league:1,cup:2},inventory:[],vault:[],ledger:[],gladiators:[],roster:null};
const level={wallet,level:6,current_exp:1500,next_exp:4500,granted_gladiators:4,owned_gladiators:4,battle_exp_today:300,claimable_count:0,pending_gladiator_count:0,rewards:Array.from({length:49},(_,i)=>({level:i+2,diamonds:2,sapphire:1,emerald:0,ruby:0,denarius:250,items:1,gladiators:i===0||i===4?1:0,unlocked:i+2<=6,claimed:i+2<=6,claimable:false}))};
function fixtureClient(data,user,wallet){return {
 auth:{getUser:async()=>({data:{user},error:null}),getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 rpc:(name,p={})=>{
  const result=(async()=>{
   if(p.p_action&&!['state','list','heartbeat','ping'].includes(p.p_action))throw Error('Theme fixture refuses mutation '+p.p_action);
   return {data:structuredClone(name==='ludus_daily_state'?data.daily:name==='ludus_clan'?data.clan:name==='ludus_progress'?data.level:{friends:[],pending:[],requests:[],messages:[]}),error:null};
  })();
  // Match the awaitable builder used by the clan renderer.
  result.abortSignal=()=>result;return result;
 },
 from:()=>{const b={select:()=>b,eq:()=>b,single:async()=>({data:wallet,error:null}),then:(r,j)=>Promise.resolve({data:[],error:null}).then(r,j)};return b;}
};}
const fixtureBootstrap=`window.__themeClient=(${fixtureClient.toString()})(${JSON.stringify({daily,clan,level})},${JSON.stringify(user)},${JSON.stringify(wallet)});`;
const pages=[
 {file:'gorevler.html',ready:'.quest-card'},
 {file:'klan.html',ready:'.homeBanner'},
 {file:'ludus-seviye.html',ready:'#levelRows tr'},
 {file:'savas.html',static:true,prepare:()=>{document.querySelector('#modePage').hidden=true;document.querySelector('#setupPage').hidden=false;}},
 {file:'arena.html',static:true,prepare:()=>{document.querySelector('#pauseMenu').hidden=false;}},
 {file:'multiplayer.html',static:true},
];
(async()=>{

 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}),reports=[];
 for(const entry of pages){
  const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://theme.test')return r.abort();const file=path.join(root,decodeURIComponent(u.pathname));if(!fs.existsSync(file)||!fs.statSync(file).isFile())return r.fulfill({status:404});let body=fs.readFileSync(file);
   if(file.endsWith('.html')){let s=body.toString();if(entry.static)s=s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');else s=s.replace('<head>','<head><script>'+fixtureBootstrap+'</script>').replaceAll(/supabase\.createClient\([^)]*\)/g,'window.__themeClient').replaceAll(/LudusClient\.create\([^)]*\)/g,'window.__themeClient');body=Buffer.from(s);}
   if(file.endsWith('ludus-level-v37.js'))body=Buffer.from(body.toString().replaceAll(/\(globalThis\.LudusClient\?\.create\|\|supabase\.createClient\)\([^)]*\)/g,'window.__themeClient').replaceAll(/supabase\.createClient\([^)]*\)/g,'window.__themeClient').replaceAll(/LudusClient\.create\([^)]*\)/g,'window.__themeClient'));
   return r.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'application/octet-stream'});
  });
  await page.goto('http://theme.test/'+entry.file,{waitUntil:'load'});if(entry.prepare)await page.evaluate(entry.prepare);if(entry.ready)await page.locator(entry.ready).first().waitFor({timeout:12000});
  for(const [width,height]of [[1536,706],[932,430],[874,402],[852,393],[667,375],[568,320]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>document.documentElement.style.setProperty('--game-height',innerHeight+'px'));
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(80);
   assert.equal(await page.evaluate(()=>document.fonts.check('600 16px Cinzel')),true,'local Roman title font loaded');
   if(entry.file==='ludus-seviye.html'){
    const summary=await page.locator('.level-summary').evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight,children:[...e.children].filter(c=>c.getClientRects().length).map(c=>({top:c.getBoundingClientRect().top,bottom:c.getBoundingClientRect().bottom}))}));
    assert.ok(summary.scroll<=summary.client+2,'level summary fits '+width);
    for(let i=1;i<summary.children.length;i++)assert.ok(summary.children[i].top>=summary.children[i-1].bottom-1,'level summary rows do not overlap '+width);
   }
   const bounds=await page.evaluate(()=>{const issues=[];for(const e of document.querySelectorAll('h1,h2,h3,button')){if(!e.getClientRects().length||e.closest('[hidden]'))continue;const r=e.getBoundingClientRect();if(r.right>innerWidth+1||r.bottom>innerHeight+1||r.left< -1||r.top< -1)issues.push({text:e.textContent.slice(0,45),class:e.className,bounds:[r.x,r.y,r.width,r.height]});}if(document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1)issues.push({pageScroll:true});return issues;});assert.deepEqual(bounds,[],entry.file+' '+width+' viewport bounds');
   await page.screenshot({path:path.join(out,entry.file.replace('.html','')+'-'+width+'.png')});
   if(entry.file==='arena.html'){await page.locator('.pause-help summary').click();for(const selector of ['#resume','#restart','#menu']){const r=await page.locator(selector).boundingBox();assert.ok(r.y+r.height<=height+1,'pause actions remain visible with the guide open '+width);}await page.screenshot({path:path.join(out,'pause-help-'+width+'.png')});await page.locator('.pause-help summary').click();}
   if(entry.file==='klan.html'){for(const tab of ['members','roster','vault','trophies','manage']){await page.locator('[data-view="'+tab+'"]').click();await page.screenshot({path:path.join(out,'klan-'+tab+'-'+width+'.png')});}await page.locator('[data-view="home"]').click();}reports.push({page:entry.file,width,height,mode:entry.static?'static markup / CSS':'real renderer / fixture RPC'});
  }

  assert.deepEqual(errors,[],entry.file+' JavaScript errors');await page.close();
 }
 console.log(JSON.stringify({pages:pages.length,views:reports.length,clanTabs:5,reports,out}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
