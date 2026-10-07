const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {database,state,grant,user,A}=require('./ludus-level-v37.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../level-work37/ui');fs.mkdirSync(out,{recursive:true});
const origin='http://127.0.0.1:8787',api='https://lryeeidutnlpgdesjxje.supabase.co';
const type=f=>f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'text/html';
async function main(){
 const db=await database(),browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];let lost=false,calls=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({A})=>{const token=['e30',btoa(JSON.stringify({sub:A,exp:Math.floor(Date.now()/1000)+3600})),'signature'].join('.');localStorage.setItem('sb-lryeeidutnlpgdesjxje-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:A,email:'fixture@example.invalid',is_anonymous:false}}));},{A});
 await page.route(origin+'/**',r=>{const f=path.join(root,new URL(r.request().url()).pathname);return fs.existsSync(f)?r.fulfill({status:200,body:fs.readFileSync(f),contentType:type(f)}):r.fulfill({status:404});});
 await page.route(api+'/**',async r=>{
  const url=new URL(r.request().url());
  if(url.pathname==='/auth/v1/user')return r.fulfill({contentType:'application/json',body:JSON.stringify({id:A,email:'fixture@example.invalid',is_anonymous:false})});
  if(url.pathname==='/rest/v1/rpc/ludus_progress'){
   const p=JSON.parse(r.request().postData()||'{}');await user(db,A);const data=(await db.query('select ludus_progress($1,$2) as r',[p.p_action||'state',p.p_level??null])).rows[0].r;
   if(p.p_action==='claim'){calls++;if(lost){lost=false;return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'lost response fixture'})});}}
   return r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  }
  return r.fulfill({status:404,contentType:'application/json',body:'{}'});
 });
 await page.goto(origin+'/ludus-seviye.html');await page.waitForFunction(()=>LudusLevelPage.state?.level===1);
 assert.equal(await page.locator('#levelGranted').innerText(),'2');assert.equal(await page.locator('#levelOwned').innerText(),'2');
 for(const [width,height]of [[1536,706],[1024,768],[844,390],[667,375],[640,320],[852,393]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(60);
  const g=await page.evaluate(()=>{const paper=document.getElementById('levelPaper'),area=document.getElementById('levelTableArea'),rows=[...document.querySelectorAll('#levelRows tr')],box=paper.getBoundingClientRect();return {pageOverflow:document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth,paperOverflow:paper.scrollHeight>paper.clientHeight+1,tableOverflow:area.scrollHeight>area.clientHeight+1,rows:rows.map(r=>({h:r.getBoundingClientRect().height,inside:r.getBoundingClientRect().bottom<=area.getBoundingClientRect().bottom+1})),frame:box.toJSON()};});
  assert.equal(g.pageOverflow,false,width+' page overflow');assert.equal(g.paperOverflow,false,width+' paper overflow');assert.equal(g.tableOverflow,false,width+' table overflow');assert.ok(g.rows.every(r=>r.inside&&r.h>=28),width+' rows');
  if(width===1536||width===844)await page.screenshot({path:path.join(out,'level-'+width+'.png')});
 }
 await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'Sonraki ödüller',exact:true}).click();assert.notEqual(await page.locator('#levelPage').innerText(),'1 / 9');await page.getByRole('button',{name:'Önceki ödüller',exact:true}).click();
 await grant(db,1000,'ui-1');await grant(db,1000,'ui-2');await grant(db,1000,'ui-3');await page.getByRole('button',{name:'Yenile',exact:true}).click();await page.waitForFunction(()=>LudusLevelPage.state.level===2);assert.equal(await page.locator('#levelGranted').innerText(),'3');
 await page.evaluate(()=>{document.querySelector('#levelClaimAll').click();document.querySelector('#levelClaimAll').click();});await page.waitForFunction(()=>LudusLevelPage.state.owned_gladiators===3&&!LudusLevelPage.pending);assert.equal(calls,1);
 await db.query('update ludus_progression set experience=16450 where owner_id=$1',[A]);await page.getByRole('button',{name:'Yenile',exact:true}).click();await page.waitForFunction(()=>LudusLevelPage.state.level===6);assert.equal(await page.locator('#levelGranted').innerText(),'4');
 lost=true;await page.getByRole('button',{name:'Ödülleri al · 4',exact:true}).click();await page.waitForFunction(()=>!!LudusLevelPage.pending&&document.getElementById('levelRetry').hidden===false);const before=await state(db);assert.equal(before.owned_gladiators,4);const wallet=before.wallet.gold;
 await page.reload();await page.waitForFunction(()=>LudusLevelPage.state?.owned_gladiators===4&&!LudusLevelPage.pending);assert.equal((await state(db)).wallet.gold,wallet,'lost response charged twice');
 await db.query('update ludus_progression set experience=33660 where owner_id=$1',[A]);await page.getByRole('button',{name:'Yenile',exact:true}).click();await page.waitForFunction(()=>LudusLevelPage.state.level===10);assert.equal(await page.locator('#levelGranted').innerText(),'5');await page.getByRole('button',{name:'Ödülleri al · 4',exact:true}).click();await page.waitForFunction(()=>LudusLevelPage.state.owned_gladiators===5&&!LudusLevelPage.pending);
 await page.screenshot({path:path.join(out,'level-10-claimed.png')});assert.deepEqual(errors,[]);await browser.close();await db.close();console.log('V37 UI passed: real migrated RPC, six landscape sizes, fixed non-scrolling layout, pagination, 2/3/4/5 rights, double tap and lost-response/reload retry.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
