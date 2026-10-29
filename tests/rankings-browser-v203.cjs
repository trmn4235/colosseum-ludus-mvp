const {chromium,webkit}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/rankings-v203';fs.mkdirSync(out,{recursive:true});
const fixture=()=>{
 const ids=Array.from({length:36},(_,i)=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
 const clans=[{id:ids[32],name:'Aurelius Hanedanı'},{id:ids[33],name:'Tırman İmparatorluğu'},{id:ids[34],name:'Valeria Muhafızları'}];
 const names=['Aurelius','Tırman','Valerius','Cassius','Lucius','Octavia','Cornelius','Livia','Flavius','Aelia','Marcellus','Titus','Gaius','Iulia','Sergius','Antonia','Publius','Decimus','Severus','Marcus','Quintus','Claudia','Drusus','Vespasianus'];
 const stats=(i,offset=0)=>({matches:100+i,wins:60-i,losses:30+i,kills:i===3?null:75+i*3,deaths:i===0?0:12+i,assists:i===3?null:30+i,points:offset-i*15,rating:1500+offset-i*15});
 const people=names.map((name,i)=>({id:ids[i],owner_id:ids[i],name,subtitle:i===7?'Çok Uzun İsimli İmparatorluk Gladyatör Okulu':name+' Ludus',clan_id:clans[i%3].id,clan:clans[i%3].name,emblem:i%3+1,emblem_color:'#b89957',background:'#651c2b',mine:i===1,class:null,
  gladiator:{id:ids[i],name:['Maximus','Spartacus','Vitus'][i%3]+' '+(i+1),class:'murmillo'},stats:{power:92.2125-i*.675,gladiator:89.25-i*.6,equipment:92.8-i*.7,attack:95-i,defense:91-i*.5,mobility:92.4-i*.6,roster_count:5,colosseum:stats(i,385),naval:stats(i,600),circus:stats(i),caravan:stats(i),caravan_raid:stats(i),caravan_defense:stats(i)}}));
 window.rankFixture={requests:[],people,clans,delay:0,error:false,guildMatches:20,defenseMatches:10,authListeners:[]};
 function response(a){const f=window.rankFixture;let rows;
  if(a.p_scope==='players')rows=f.people.map(r=>({...r}));
  else if(a.p_scope==='clans')rows=clans.map((c,i)=>({...c,owner_id:null,clan_id:c.id,clan:c.name,subtitle:'Hanedan',emblem:i+1,emblem_color:'#b89957',background:'#651c2b',mine:i===1,stats:{guild:{...stats(i),points:1600-i*40}}}));
  else rows=f.guildMatches?f.people.map((r,i)=>({...r,id:ids[i],name:['Maximus','Spartacus','Vitus'][i%3]+' '+(i+1),subtitle:r.name,class:'murmillo',stats:{gladiator:90-i,guild:{...stats(i),points:1750-i*15}}})):[];
  for(const r of rows){const c=a.p_category,group=a.p_group,m=c==='caravan'&&group!=='all'?'caravan_'+group:c;r.metrics=r.stats[m]||{};
   r.score=c==='power'?r.stats[group==='all'?'power':group]:a.p_sort==='wins'||['circus','caravan'].includes(c)?r.metrics.wins||0:['colosseum','naval'].includes(c)?r.metrics.rating:r.metrics.points||0;
  }
  if(a.p_clan)rows=rows.filter(r=>r.clan_id===a.p_clan);rows.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));rows.forEach((r,i)=>r.rank=i+1);const own=rows.find(r=>r.mine)||null;
  if(a.p_query)rows=rows.filter(r=>(r.name+' '+r.subtitle).toLocaleLowerCase('tr-TR').includes(a.p_query.toLocaleLowerCase('tr-TR')));
  const total=rows.length,page=Math.min(a.p_page,Math.max(0,Math.ceil(total/a.p_page_size)-1));rows=rows.slice(page*a.p_page_size,(page+1)*a.p_page_size);
  return {version:203,rows,total,page,page_size:a.p_page_size,own,my_clan:clans[1].id,clans,server_now:new Date().toISOString(),guild_matches:f.guildMatches,defense_matches:f.defenseMatches};
 }
 window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:ids[1]}}}),onAuthStateChange:fn=>{window.rankFixture.authListeners.push(fn);return{data:{subscription:{unsubscribe(){}}}};}},rpc:(name,a)=>{
  if(name!=='ludus_rankings_v203')throw Error('Wrong reader');window.rankFixture.requests.push(a);const delay=window.rankFixture.delay,result=response(a),error=window.rankFixture.error;
  const p=new Promise(resolve=>setTimeout(()=>resolve(error?{error:{message:'offline'}}:{data:result}),delay));p.abortSignal=()=>p;return p;
 }})};
};
async function run(){
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.join(root,pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{const body=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.webp')?'image/webp':'application/octet-stream');res.end(body);}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await(process.env.LUDUS_WEBKIT_TEST?webkit:chromium).launch({headless:true,...(!process.env.LUDUS_WEBKIT_TEST?{args:['--no-sandbox']}: {})});
 try{
  for(const [width,height]of [[1366,768],[932,430],[844,390],[667,375],[568,320],[393,852],[320,568]]){
   const context=await browser.newContext({viewport:{width,height},hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/assets/runtime/supabase-*.js',route=>route.fulfill({contentType:'text/javascript',body:'('+fixture.toString()+')();'}));
   await page.goto('http://127.0.0.1:'+server.address().port+'/siralamalar.html');
   const ready=()=>page.waitForFunction(()=>document.querySelector('#rankTable').getAttribute('aria-busy')==='false'&&window.rankFixture?.requests.length>0);
   await ready();
   async function layout(label){const result=await page.evaluate(()=>{
    const els=[...document.querySelectorAll('.rank-header,.rank-sheet,.rank-navigation,.rank-categories,.rank-categories button,.rank-tools,.rank-context,.rank-table,.rank-footer,.rank-row,.rank-value,dialog[open]')];
    return {body:document.documentElement.scrollHeight<=innerHeight+1,overflow:els.filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+.5||r.top<-.5||r.bottom>innerHeight+.5||e.scrollHeight>e.clientHeight+2||(e.classList.contains('rank-value')||e.matches('.rank-categories button'))&&e.scrollWidth>e.clientWidth+2)}).map(e=>({tag:e.className||e.id,text:e.matches('.rank-categories button')?e.textContent:null,w:e.clientWidth,sw:e.scrollWidth,h:e.clientHeight,sh:e.scrollHeight})),rows:document.querySelectorAll('.rank-row').length};
   });assert.equal(result.body,true,label+' body');assert.deepEqual(result.overflow,[],width+'×'+height+' '+label);return result;}
   await layout('general power');await page.screenshot({path:path.join(out,`power-${width}x${height}.png`)});
   assert.equal(await page.locator('.rank-row').first().locator('.rank-value').count(),5);
   for(const g of ['gladiator','attack','defense','mobility','all']){
    await page.click('[data-category="'+g+'"]');await ready();assert.equal(await page.evaluate(()=>rankFixture.requests.at(-1).p_group),g);await layout('power '+g);
    assert.equal(await page.locator('.rank-row').first().locator('.selected').getAttribute('data-metric'),g);
   }
   await page.locator('.rank-row').first().click();await layout('power detail');assert.ok((await page.locator('#rankDetail').innerText()).includes('GENEL GÜÇ'));await page.locator('#rankDetail button[aria-label="Kapat"]').click();
   await page.click('[data-section="achievements"]');await ready();
   for(const c of ['colosseum','naval','circus','caravan']){
    await page.click('[data-category="'+c+'"]');await ready();await layout(c);
    if(c==='caravan')for(const g of ['raid','defense','all']){await page.click('[data-group="'+g+'"]');await ready();assert.equal(await page.evaluate(()=>rankFixture.requests.at(-1).p_group),g);await layout('caravan '+g);}
    if(c!=='circus')for(const m of ['wins','losses','kd','kda'])assert.equal(await page.locator('.rank-row').first().locator('[data-metric="'+m+'"]').isVisible(),true);
    if(c==='circus')assert.ok((await page.locator('#rankHead').innerText()).includes('ŞAMPİYONLUK')||(await page.locator('#rankHead').textContent()).includes('Şampiyonluk'));
    await page.locator('.rank-row').first().click();await layout(c+' detail');await page.locator('#rankDetail button[aria-label="Kapat"]').click();
    if(c==='naval'||c==='caravan')await page.screenshot({path:path.join(out,`${c}-${width}x${height}.png`)});
   }
   await page.click('[data-category="colosseum"]');await ready();assert.equal(await page.locator('#rankSort option').count(),2);
   const rating=await page.locator('.rank-row').first().locator('[data-metric="score"]').innerText();
   await page.selectOption('#rankSort','wins');await ready();assert.equal(await page.evaluate(()=>rankFixture.requests.at(-1).p_sort),'wins');assert.equal(await page.locator('.rank-row').first().locator('[data-metric="score"]').innerText(),rating);
   await page.fill('#rankSearch','Valerius');await page.waitForFunction(()=>rankFixture.requests.at(-1).p_query==='Valerius');await ready();assert.equal(await page.locator('.rank-row').count(),1);assert.notEqual(await page.locator('.rank-place').first().textContent(),'1');
   await page.fill('#rankSearch','ZZZNone');await page.waitForFunction(()=>rankFixture.requests.at(-1).p_query==='ZZZNone');await ready();assert.equal(await page.locator('.rank-row').count(),0);await layout('empty');
   await page.fill('#rankSearch','');await page.waitForFunction(()=>rankFixture.requests.at(-1).p_query==='');await ready();await page.click('#rankNext');await ready();assert.equal(await page.evaluate(()=>rankFixture.requests.at(-1).p_page),1);
   await page.click('[data-scope="guilds"]');await ready();await layout('clans');await page.screenshot({path:path.join(out,`clans-${width}x${height}.png`)});
   await page.click('[data-category="fighters"]');await ready();await layout('fighters');await page.locator('.rank-row').first().click();await layout('fighter detail');await page.locator('#rankDetail button[aria-label="Kapat"]').click();
   await page.click('#rankRules');for(let i=0;i<4;i++){await layout('help '+i);if(i<3)await page.locator('#rankHelp .rank-dialog-foot button').last().click();}await page.locator('#rankHelp button[aria-label="Kapat"]').click();
   await page.evaluate(()=>{rankFixture.guildMatches=0;});await page.click('#rankRefresh');await ready();assert.equal(await page.locator('.rank-row').count(),0);await layout('no guild wars');
   await page.evaluate(()=>{rankFixture.error=true;});await page.click('#rankRefresh');await page.waitForFunction(()=>document.querySelector('#rankState strong')?.textContent==='Sıralama yüklenemedi');await layout('offline');
   await page.evaluate(()=>{rankFixture.error=false;});await page.locator('#rankState button').click();await ready();
   await page.evaluate(()=>rankFixture.authListeners.forEach(fn=>fn('SIGNED_OUT',null)));assert.equal(await page.locator('.rank-row').count(),0);assert.equal(await page.locator('#rankOwn').isDisabled(),true);await layout('signed out');
   assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}×${height}: four-component power, achievement categories, caravan groups, visible wins/losses/ratios, search rank, pagination, guilds, dialogs, empty/offline/auth states; no scrolling.`);
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture};
