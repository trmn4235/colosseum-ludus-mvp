// Actual courtyard dialogs with isolated data. No account writes or mission joins.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/art-v137-details';
fs.mkdirSync(out,{recursive:true});
const prefix=fs.readFileSync(root+'/tests/production-browser-v122.cjs','utf8').split('const mime=')[0];
let fixture=new Function('require','__dirname',prefix+'\nreturn fixture;')(createRequire(root+'/tests/production-browser-v122.cjs'),root+'/tests');
fixture=fixture.replace('const accountClient=window.__fixtureClient;',`
window.__detailMode='normal';window.__socialRows=[];window.__rejectedWrites=[];
const originalDetailRpc=__fixtureClient.rpc;
__fixtureClient.rpc=async(name,args={})=>{
 if(['ludus_imperial','ludus_social','ludus_daily_state'].includes(name)){
  if(args.p_action&&!['state','list','ping'].includes(args.p_action)){__rejectedWrites.push({name,args});throw Error('Visual fixture refuses mutations');}
  if(__detailMode==='error')return{error:{message:'Bağlantı kurulamadı. Lütfen yeniden dene.'}};
  if(name==='ludus_social')return{data:{friends:structuredClone(__socialRows)}};
  if(name==='ludus_daily_state')return{data:{day:'2026-10-20',server_now:new Date().toISOString(),bonus_exp:300,bonus_claimed:false,claimed_count:0,missions:[['visit','Ludus seni bekliyor',1,1],['battles','Arena tecrübesi',0,2],['solo','Tek başına arenada',0,1],['training','Doctore’nin disiplini',0,1]].map(([key,title,progress,target])=>({key,title,progress,target,claimed:false,gold:25,ludus_exp:150,description:'Günlük hedefi tamamla.',destination:'ludus.html'}))}};
  return{data:{server_now:new Date().toISOString(),today:'2026-10-20',cycle_day:4,is_admin:false,assignments:[],gladiators:Array.from({length:12},(_,i)=>({...__fighters[i%2],id:'detail-fighter-'+i,name:'Aulus Septimius Varro '+(i+1)})),missions:__detailMode==='empty'?[]:[{...__mission,id:'detail-mission',day:'2026-10-20',title:'Portus Limanında Kaçakçılara Baskın',description:'Subura hamamlarında bir imparatorluk görevlisine karşı suikast planlandığına dair gizli bir haber ulaştı. Gladyatörlerin kalabalığın içine sızarak komplocuları izleyecek, hedefi güvenli bir çıkışa ulaştıracak ve saldırı gerçekleşmeden şebekeyi etkisiz hale getirecek. Sarayın en hassas emri için toplam gücü yüksek bir ekip gerekiyor.',image:'imperial-portus-v31.webp'}]}};
 }
 return originalDetailRpc(name,args);
};
window.LudusClient.create=()=>__fixtureClient;
const accountClient=__fixtureClient;`);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff':'font/woff','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
 if(!file.startsWith(root+'/')||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
 let body=fs.readFileSync(file);
 if(file.endsWith('/ludus.html'))body=Buffer.from(body.toString().replace('function frame(now){requestAnimationFrame(frame);','function frame(now){requestAnimationFrame(frame);if(window.__freeze)return;').replace(/const accountClient=LudusClient.create\([^;]+;/,()=>fixture));
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(body);
});
function inspect(selector){
 const root=document.querySelector(selector),issues=[],r=root.getBoundingClientRect();
 if(r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1)issues.push('frame outside viewport');
 for(const e of root.querySelectorAll('.owner-fields,.owner-field,.imperial-content,.imperial-detail-copy,.imperial-description,.imperial-daily-card,#friendList,.friend-row')){
  if(!e.getClientRects().length)continue;
  if(e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2)issues.push({element:e.className||e.id,client:[e.clientWidth,e.clientHeight],scroll:[e.scrollWidth,e.scrollHeight]});
 }
 for(const e of root.querySelectorAll('button,input,select,h1,h2,h3,.owner-field>span')){
  if(!e.getClientRects().length||e.closest('[hidden]'))continue;
  const b=e.getBoundingClientRect();
  if(b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1)issues.push('control outside frame: '+(e.textContent||e.name));
  if(e.matches('.owner-field>span,h1,h2,h3')&&getComputedStyle(e).textOverflow!=='ellipsis'){
   const range=document.createRange();range.selectNodeContents(e);
   for(const t of range.getClientRects())if(t.right>b.right+1||t.bottom>b.bottom+2)issues.push('text outside heading: '+e.textContent);
  }
 }
 return issues;
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:874,height:402}}),errors=[],report=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route(/^https:/,r=>r.abort());
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/ludus.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.LudusPreview?.roster?.filter(g=>g.model?.gear).length===2,null,{timeout:90000});
  await page.evaluate(async()=>{await LudusPreview.accountReady;await LudusPreview.residentsReady;});
  await page.waitForFunction(()=>document.getElementById('loading').hidden,null,{timeout:60000});
  async function capture(name,selector,width){
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(180);
   const issues=await page.evaluate(inspect,selector);report.push({name,width,issues});
   await page.screenshot({path:out+'/'+name+'-'+width+'.png'});
  }
  for(const [width,height]of [[1536,706],[932,430],[874,402],[852,393],[667,375],[568,320]].filter(([w])=>!process.env.LUDUS_ART_WIDTHS||process.env.LUDUS_ART_WIDTHS.split(',').includes(String(w)))){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>document.getElementById('roomOwnerButton').click());
   for(const tab of ['face','body','dress']){await page.locator('.owner-custom [data-tab="'+tab+'"]').click();await capture('owner-'+tab,'.owner-sheet',width);}
   await page.locator('.owner-sheet [data-action=close]').click();
   await page.evaluate(()=>{__detailMode='normal';return LudusPreview.imperial.openMission('detail-mission');});
   await page.locator('.imperial-description').waitFor();await capture('mission-detail','.imperial-paper',width);
   await page.locator('.imperial-roster button').first().click();
   assert.equal(await page.locator('#imperialJoin').isEnabled(),true,'mission selection stays usable '+width);
   await page.evaluate(()=>LudusPreview.imperial.openDaily());await capture('mission-daily','.imperial-paper',width);
   await page.evaluate(()=>{__detailMode='empty';return LudusPreview.imperial.open();});await capture('mission-empty','.imperial-paper',width);
   assert.doesNotMatch(await page.locator('.imperial-heading p').textContent(),/Günlük görevler/,'empty imperial tab has the correct subtitle');
   await page.evaluate(()=>{__detailMode='error';return LudusPreview.imperial.open();});await capture('mission-error','.imperial-paper',width);
   await page.evaluate(()=>LudusPreview.imperial.openDaily());await capture('daily-error','.imperial-paper',width);
   await page.evaluate(()=>__detailMode='normal');await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await page.locator('.imperial-daily-card').first().waitFor();
   await page.evaluate(()=>LudusPreview.imperial.close());
   for(const state of ['empty','accepted','pending']){
    await page.evaluate(state=>{__socialRows=state==='empty'?[]:Array.from({length:8},(_,i)=>({id:'friend-'+i,name:'Aulus Septimius Varro '+(i+1),username:'aulus_septimius_varro_'+i,state,online:i%2===0,incoming:i%2===0}));document.getElementById('friendsOpen').click();},state);
    await page.waitForFunction(()=>!document.getElementById('friendSend').disabled);
    await page.locator('#friendTabs [data-filter="'+(state==='pending'?'pending':'accepted')+'"]').click();
    await capture('friends-'+state,'.friends-paper',width);
    await page.locator('#friendsClose').click();
   }
  }
  assert.deepEqual(await page.evaluate(()=>__rejectedWrites),[],'no account mutations');
  fs.writeFileSync(out+'/report.json',JSON.stringify({report,errors},null,2));
  const failures=report.filter(r=>r.issues.length);console.log(JSON.stringify({views:report.length,failures,errors,out}));
  assert.deepEqual(failures,[],'detail layouts');assert.deepEqual(errors,[],'detail JavaScript errors');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
