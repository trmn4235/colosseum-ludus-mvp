const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mock=`globalThis.supabase={createClient(){
 const data={user_id:'me',party:{id:'room',leader:'me',members:[{user_id:'me',gladiator_id:'g1',gladiator:'Aurelius',ludus:'Ludus Tırman',class:'murmillo',leader:true}]},invites:[],candidates:[{id:'f1',username:'arkadas',ludus:'Ludus Roma',type:'friend',invited:false},{id:'c1',username:'klanli',ludus:'Ludus Kartal',type:'clan',invited:false}],gladiators:[{id:'g1',name:'Aurelius',class:'murmillo'}]};
 const auth={getUser:async()=>({data:{user:{id:'me',is_anonymous:false}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
 return {auth,rpc:async(_name,p)=>{if(p.p_action==='invite')data.candidates.find(x=>x.id===p.p_peer).invited=true;return {data:structuredClone(data),error:null}},channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){}};
}};`;
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://ranked.test')return route.abort();
  if(u.pathname.endsWith('/assets/runtime/supabase-59d39487c358.js'))return route.fulfill({body:mock,contentType:'application/javascript'});
  const file=path.join(root,u.pathname);if(!fs.existsSync(file))return route.fulfill({status:404});const ext=path.extname(file),type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp'}[ext]||'application/octet-stream';return route.fulfill({body:fs.readFileSync(file),contentType:type});
 });
 for(const [width,height] of [[844,390],[667,375],[568,320]]){
  await page.setViewportSize({width,height});await page.goto('http://ranked.test/ranked-team-v244.html');
  await page.getByText('Aurelius',{exact:true}).first().waitFor();
  assert.equal(await page.locator('.slot').count(),5);assert.equal(await page.locator('.empty-slot').count(),4);
  assert.equal(await page.locator('#teamCount').innerText(),'1 / 5');assert.equal(await page.locator('.match').isEnabled(),false);
  assert.equal(await page.locator('#candidateList .candidate').count(),1);assert.match(await page.locator('#candidateList').innerText(),/arkadas/);
  await page.getByRole('button',{name:'Davet Et'}).click();assert.match(await page.locator('#candidateList').innerText(),/Gönderildi/);
  await page.getByRole('button',{name:'Klan',exact:true}).click();assert.match(await page.locator('#candidateList').innerText(),/klanli/);
  const boxes=await page.locator('.paper,.team-scene,.ranked-header').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}}));
  for(const b of boxes){assert.ok(b.x>=-1&&b.y>=-1&&b.right<=width+1&&b.bottom<=height+1,'panel must fit viewport');assert.ok(b.scrollHeight<=b.clientHeight+1,'panel must not vertically overflow');}
 }
 await browser.close();console.log('V244 UI PASS: five slots, friend/clan tabs, invitation action and landscape layouts.');
})().catch(e=>{console.error(e);process.exitCode=1});
