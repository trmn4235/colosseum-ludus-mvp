// Real map/controller and all production styles; isolated RPC fixtures, no live mutations.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..'),kind=process.env.LUDUS_WEBKIT_TEST?'webkit':'chromium',out=process.env.LUDUS_TEST_OUTPUT||'/tmp/workers-v230/'+kind;
const source=fs.readFileSync(path.join(root,'ludus.html'),'utf8');
const styles=[...source.slice(0,source.indexOf('</head>')).matchAll(/<style[^>]*>[\s\S]*?<\/style>|<link[^>]*rel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('');
const fixture=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}</head><body data-art-direction="136" data-roman-screen="ludus"><script src="/ludus-work-map-v260.js"></script><script src="/ludus-supply-v85.js"></script><script>
window.__owner='00000000-0000-4000-8000-000000000109';window.__calls=[];window.__fail=false;window.__reject=false;
const professions=Object.keys(LudusWorkMapV260.labels).map((sku,i)=>({sku,name:LudusWorkMapV260.labels[sku],sort_order:i+1}));
window.__clan={user_id:__owner,clan_id:'aquila',is_leader:true,enabled:true,server_now:new Date(Date.now()+3600000).toISOString(),config:{duration_minutes:360,min_level:5,team_limit:5,tax_percent:20,yield_by_level:[5,6,7,8,9,10].map((level,i)=>({level,gross:[10,15,20,20,25,30][i],tax:[2,3,4,4,5,6][i],net:[8,12,16,16,20,24][i]}))},professions,workers:Array.from({length:9},(_,i)=>({id:'worker-'+i,owner_id:i<3?__owner:'ally',name:'İşçi '+i,ludus_name:i<3?'Ludus Aquila-1':'Ludus Aquila-2',busy:i===7,skills:Object.fromEntries(professions.map(p=>[p.sku,i===8?1:5+i%6]))})),jobs:[]};
window.__supply={user_id:__owner,server_now:new Date().toISOString(),licensed_work_version:255,shopping_seconds:10800,caravan_capacity:10,workers:6,free_workers:6,busy_workers:0,gold:100000,level:10,resources:professions.map(p=>({sku:p.sku,name:p.name,stage:'raw',quantity:100,food:['grain','apple','fish','meat','egg','beer','olive_oil'].includes(p.sku)})),jobs:[],deliveries:[],cities:[{id:1,name:'Roma'}],destinations:LudusSupply.atlas.filter(d=>d.food)};
window.__receipts={};
window.__client={rpc:async(name,args={})=>{
 if(name==='ludus_supply')return{data:structuredClone(__supply)};
 if(name==='ludus_workers_roster_v226')return{data:{user_id:__owner,workers:[]}};
 if(name==='ludus_caravan_city')return{data:{city:__supply.cities[0],server_now:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString(),epoch:1,goods:__supply.resources.map(r=>({...r,stock:300,bar:10,unit_price:1}))}};
 if(name!=='ludus_clan_work_v232')throw Error('Unexpected RPC '+name);
 if(args.p_action==='start'){
  __calls.push(structuredClone(args));
  if(__reject)return{error:{code:'P0001',message:'İşçi başka görevde.'}};
  if(!__receipts[args.p_request]){
   const participants=args.p_data.workers.map(id=>{const w=__clan.workers.find(w=>w.id===id),level=w.skills[args.p_data.sku],y=__clan.config.yield_by_level.find(y=>y.level===level);w.busy=true;return{worker_name:w.name,ludus_name:w.ludus_name,owner_id:w.owner_id,level,quantity:y.net,gross_quantity:y.gross,tax_quantity:y.tax};});
   const job={id:'job-'+Object.keys(__receipts).length,sku:args.p_data.sku,worker_count:5,started_at:__clan.server_now,ends_at:new Date(Date.parse(__clan.server_now)+21600000).toISOString(),participants,quantity:participants.reduce((n,p)=>n+p.quantity,0),gross_quantity:participants.reduce((n,p)=>n+p.gross_quantity,0),tax_quantity:participants.reduce((n,p)=>n+p.tax_quantity,0)};
   __clan.jobs.unshift(job);__receipts[args.p_request]=job;
  }
  if(__fail){__fail=false;throw Error('Bağlantı kesildi.');}
 }
 return{data:structuredClone(__clan)};
}};
window.supply=LudusSupply.create({client:__client,ready:Promise.resolve({user_id:__owner}),inRoom:()=>true});supply.enter();window.__ready=supply.open('map');setInterval(()=>supply.tick(),100);
</script></body></html>`;
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await(kind==='webkit'?webkit:chromium).launch({headless:true,...(kind==='chromium'?{args:['--no-sandbox','--disable-dev-shm-usage']}:{} )});
 const context=await browser.newContext({viewport:{width:874,height:402}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const url=new URL(route.request().url()),file=path.resolve(root,'.'+url.pathname);if(url.hostname!=='localhost'||!file.startsWith(root+path.sep))return route.abort();try{return route.fulfill({body:url.pathname==='/map'?fixture:fs.readFileSync(file),contentType:url.pathname==='/map'?'text/html; charset=utf-8':({'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404});}});
 const fit=async sel=>{for(const e of await page.locator(sel).all()){if(!await e.isVisible())continue;const r=await e.evaluate(n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,r:b.right,b:b.bottom,h:n.scrollHeight-n.clientHeight,w:n.scrollWidth-n.clientWidth};});assert.ok(r.x>=-1&&r.y>=-1&&r.r<=page.viewportSize().width+1&&r.b<=page.viewportSize().height+1&&r.h<3&&r.w<3,sel+' '+JSON.stringify(r));}};
 const refresh=async()=>{await page.locator('.workmap-nav').getByRole('button',{name:'Yenile',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.workmap-nav button:last-child').disabled);};
 const selectFive=async()=>{for(let i=0;i<5;i++)await page.locator('[data-work-worker="worker-'+i+'"]').click();};
 try{
  await page.goto('http://localhost/map');await page.evaluate(()=>__ready);await page.locator('.supply-work-open').click();
  assert.equal(await page.locator('[data-destination]').count(),16);assert.equal(await page.evaluate(()=>__calls.length),0);
  for(const [width,height]of [[1536,706],[874,402],[844,390],[667,375],[568,320]]){await page.setViewportSize({width,height});await fit('.supply-head');await fit('.supply-map-controls');await fit('.supply-map');await page.screenshot({path:out+'/workmap-map-'+width+'.png'});}
  await page.setViewportSize({width:874,height:402});
  for(const site of await page.evaluate(()=>LudusSupply.atlas.map(d=>({id:d.id,sku:d.sku||d.id})))){await page.locator('[data-destination="'+site.id+'"]').click();await page.locator('.workmap-title').waitFor();assert.equal(await page.locator('.workmap-screen').getAttribute('data-work-site'),site.sku);await page.locator('.workmap-nav').getByRole('button',{name:'‹ Kaynak haritası',exact:true}).click();}
  await page.locator('[data-destination=fish]').click();await page.locator('.workmap-title').waitFor();
  for(const [width,height]of [[1536,706],[874,402],[844,390],[667,375],[568,320]]){await page.setViewportSize({width,height});for(const sel of ['.workmap-screen','.workmap-site','.workmap-worker','.workmap-send','.workmap-nav','.workmap-filter'])await fit(sel);await page.screenshot({path:out+'/workmap-team-'+width+'.png'});}
  await page.setViewportSize({width:874,height:402});await page.locator('#workmapLudus').selectOption('ally');assert.equal(await page.locator('[data-work-worker]').count(),6);assert.ok(await page.locator('[data-work-worker=worker-7]').isDisabled());assert.ok(await page.locator('[data-work-worker=worker-8]').isDisabled());await page.locator('#workmapLudus').selectOption('');
  for(let i=0;i<4;i++)await page.locator('[data-work-worker="worker-'+i+'"]').click();assert.ok(await page.locator('[data-work-send]').isDisabled());await page.locator('[data-work-worker=worker-4]').click();assert.ok(await page.locator('[data-work-send]').isEnabled());assert.ok(await page.locator('[data-work-worker=worker-5]').isDisabled());assert.match(await page.locator('.workmap-send').innerText(),/72 net.*18 devlet/);
  // Ambiguous response retains the same UUID and exact team even after a reload.
  await page.evaluate(()=>__fail=true);await page.locator('[data-work-send]').click();await page.getByRole('button',{name:'Gönderimi doğrula',exact:true}).waitFor();assert.equal(await page.evaluate(()=>__clan.jobs.length),1);assert.equal(await page.evaluate(()=>__calls.length),1);
  const saved=await page.evaluate(()=>({clan:__clan,receipts:__receipts,calls:__calls}));await page.reload();await page.evaluate(()=>__ready);await page.evaluate(s=>{__clan=s.clan;__receipts=s.receipts;__calls=s.calls;},saved);await page.locator('.supply-work-open').click();await page.locator('[data-destination=grain]').click();await page.getByRole('button',{name:'Gönderimi doğrula',exact:true}).waitFor();assert.equal(await page.locator('.workmap-screen').getAttribute('data-work-site'),'fish');await page.locator('[data-work-send]').click();await page.locator('[data-work-job]').waitFor();
  const calls=await page.evaluate(()=>__calls);assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.equal(await page.evaluate(()=>__clan.jobs.length),1);assert.equal(await page.evaluate(()=>localStorage.getItem('ludus-work-map-v260:'+__owner)),null);assert.match(await page.locator('[data-work-clock]').innerText(),/^(06:00:00|05:59:\d\d)$/);
  await page.locator('[data-work-job]').click();assert.equal(await page.locator('.workmap-person').count(),5);assert.match(await page.locator('.workmap-total').innerText(),/Brüt 90.*Devlet 18.*Luduslara 72/);
  for(const [width,height]of [[874,402],[667,375],[568,320]]){await page.setViewportSize({width,height});await fit('.workmap-screen');await fit('.workmap-person');await page.screenshot({path:out+'/workmap-delivery-'+width+'.png'});}
  await page.evaluate(()=>{__clan.jobs[0].finished_at=new Date().toISOString();__clan.jobs[0].participants[0].pending=true;});await refresh();assert.match(await page.locator('.workmap-person').first().innerText(),/Depoda yer bekliyor/);
  await page.evaluate(()=>{const j=__clan.jobs[0];__clan.jobs=Array.from({length:7},(_,i)=>({...j,id:'history-'+i}));});await refresh();await page.getByRole('button',{name:'Çalışma ekipleri',exact:true}).click();assert.equal(await page.locator('[data-work-job]').count(),4);await page.getByRole('button',{name:'Sonraki işçiler veya görevler'}).click();assert.equal(await page.locator('[data-work-job]').count(),3);
  await page.setViewportSize({width:874,height:402});await page.locator('.workmap-nav').getByRole('button',{name:'‹ Kaynak haritası'}).click();await page.locator('[data-destination=iron_ore]').click();
  await page.evaluate(()=>{__clan.workers.forEach(w=>w.busy=false);__reject=true;});await refresh();await selectFive();await page.locator('[data-work-send]').click();await page.getByText('İşçi başka görevde.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('ludus-work-map-v260:'+__owner)),null);
  await page.evaluate(()=>{__clan.is_leader=false;});await refresh();assert.ok(await page.locator('[data-work-send]').isDisabled());assert.equal(await page.locator('[data-work-worker]:not(:disabled)').count(),0);assert.match(await page.locator('.workmap-info').innerText(),/klan lideri/);
  await page.evaluate(()=>{__clan.is_leader=true;__clan.workers.forEach(w=>w.skills.iron_ore=1);});await refresh();assert.ok(await page.locator('[data-work-send]').isDisabled());assert.match(await page.locator('.workmap-info').innerText(),/hazır Sv. 5 işçi yok/);await page.locator('.workmap-training').click();await page.locator('.supply-source-detail[data-source=iron_ore]').waitFor();assert.ok(await page.locator('#supplyModal').isVisible());
  await page.locator('.supply-license-open').click();await page.locator('.workmap-title').waitFor();await page.evaluate(()=>__clan.clan_id=null);await refresh();assert.match(await page.locator('.workmap-empty').innerText(),/Klan üyesi değilsin/);
  assert.deepEqual(errors,[]);console.log('V260 '+kind+' PASS: 16 real map sites, five-worker cross-Ludus selection, eligibility, net/tax, one-hour clock skew, replay after lost response/reload, mission details, pending delivery, pagination, member restrictions, shopping link and five viewport sizes.');
 }catch(e){await page.screenshot({path:out+'/workmap-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
