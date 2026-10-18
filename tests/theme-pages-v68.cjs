// Real page markup/styles, with isolated fixtures for daily, clan and level renderers.
// Static-only screens deliberately do not start 3D scenes or authenticated game flows.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/theme-v68';fs.mkdirSync(out,{recursive:true});
const gold='rgb(228, 199, 123)',burgundy='rgb(89, 24, 35)',white='rgb(255, 255, 255)';
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
 {file:'gorevler.html',ready:'.quest-card',checks:[['.daily-sidebar','backgroundColor',burgundy],['.daily-sidebar h1','color',gold],['.quest-card','backgroundColor',white],['.quest-action','color',gold]]},
 {file:'klan.html',ready:'.homeBanner',checks:[['header','backgroundColor',burgundy],['.nav:not(.active)','color',gold],['.panel','backgroundColor',white],['.nav.active','backgroundColor',white],['.nav.active','color',burgundy],['.foot #message','color',gold]]},
 {file:'ludus-seviye.html',ready:'#levelRows tr',checks:[['.level-paper','backgroundColor',white],['.level-head','backgroundColor',white],['.level-head h1','color','rgb(32, 41, 54)']]},
 {file:'gelistirmeler.html',static:true,checks:[['.panel','backgroundColor',white],['.top','color',gold]]},
 {file:'savas.html',static:true,prepare:()=>{document.querySelector('#modePage').hidden=true;document.querySelector('#setupPage').hidden=false;},checks:[['.paper','backgroundColor',white],['.top','color',gold],['.roster h2','color',gold]]},
 {file:'arena.html',static:true,prepare:()=>{document.querySelector('#pauseMenu').hidden=false;},checks:[['#pauseMenu .intro','backgroundColor',white],['#attack','backgroundColor',burgundy],['#attack','color',gold]]},
 {file:'multiplayer.html',static:true,checks:[['.queue-footer button','backgroundColor',burgundy],['.queue-footer button','color',gold]]},
 {file:'kurulum.html',static:true,checks:[['main','backgroundColor',white],['a.action','color',gold],['button','backgroundColor',burgundy]]},
];
(async()=>{
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){const s=fs.readFileSync(path.join(root,file),'utf8');assert.equal(s.split('roman-theme-v68.css').length-1,1,file+' one theme link');assert.ok(s.includes('data-roman-screen='),file+' scoped screen');}
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox']}),reports=[];
 for(const entry of pages){
  const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!=='http://theme.test')return r.abort();const file=path.join(root,decodeURIComponent(u.pathname));if(!fs.existsSync(file)||!fs.statSync(file).isFile())return r.fulfill({status:404});let body=fs.readFileSync(file);
   if(file.endsWith('.html')){let s=body.toString();if(entry.static)s=s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');else s=s.replace('<head>','<head><script>'+fixtureBootstrap+'</script>').replaceAll(/supabase\.createClient\([^)]*\)/g,'window.__themeClient').replaceAll(/LudusClient\.create\([^)]*\)/g,'window.__themeClient');body=Buffer.from(s);}
   if(file.endsWith('ludus-level-v37.js'))body=Buffer.from(body.toString().replaceAll(/\(globalThis\.LudusClient\?\.create\|\|supabase\.createClient\)\([^)]*\)/g,'window.__themeClient').replaceAll(/supabase\.createClient\([^)]*\)/g,'window.__themeClient').replaceAll(/LudusClient\.create\([^)]*\)/g,'window.__themeClient'));
   return r.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'application/octet-stream'});
  });
  await page.goto('http://theme.test/'+entry.file,{waitUntil:'load'});if(entry.prepare)await page.evaluate(entry.prepare);if(entry.ready)await page.locator(entry.ready).first().waitFor({timeout:12000});
  for(const [width,height]of [[1536,706],[844,390],[667,375]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>document.documentElement.style.setProperty('--game-height',innerHeight+'px'));
   for(const [selector,property,expected]of entry.checks){assert.equal(await page.locator(selector).first().evaluate((e,p)=>getComputedStyle(e)[p],property),expected,entry.file+' '+selector+' '+property);}
   await page.screenshot({path:path.join(out,entry.file.replace('.html','')+'-'+width+'.png')});reports.push({page:entry.file,width,height,mode:entry.static?'static markup / CSS':'real renderer / fixture RPC'});
  }
  if(entry.file==='klan.html'){for(const tab of ['members','roster','vault','trophies','manage']){await page.locator('[data-view="'+tab+'"]').click();await page.screenshot({path:path.join(out,'klan-'+tab+'.png')});assert.equal(await page.locator('.panel').first().evaluate(e=>getComputedStyle(e).backgroundColor),white);}}
  assert.deepEqual(errors,[],entry.file+' browser errors');await page.close();
 }
 console.log(JSON.stringify({pages:pages.length,views:reports.length,clanTabs:5,reports,out}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
