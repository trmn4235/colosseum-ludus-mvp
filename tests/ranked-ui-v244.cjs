const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mock=`globalThis.supabase={createClient(){
 const data={user_id:'me',party:{id:'room',leader:'me',members:[{user_id:'me',gladiator_id:'g1',gladiator:'Aurelius',ludus:'Ludus Tırman',class:'murmillo',leader:true}]},invites:[],candidates:[{id:'f1',username:'arkadas',ludus:'Ludus Roma',type:'friend',invited:false},{id:'c1',username:'klanli',ludus:'Ludus Kartal',type:'clan',invited:false}],gladiators:[{id:'g1',name:'Aurelius',class:'murmillo'}]};
 globalThis.mockRankedParty=data.party;
 const auth={getUser:async()=>({data:{user:{id:'me',is_anonymous:false}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
 const supply={user_id:'me',recipes:[{sku:'gladius',name:'Gladius',output_type:'equipment',ingredients:{wood:1}}],resources:[{sku:'wood',name:'Odun',quantity:2}]};
 let items=[{id:'i1',kind:'weapon',model:'gladius',enhancement:0,equipped_by:null}];globalThis.calls=[];
 return {auth,rpc:async(name,p={})=>{globalThis.calls.push({name,p});
  if(name==='ludus_supply'){if(p.p_action==='craft'){supply.resources[0].quantity--;items.push({id:'i2',kind:'weapon',model:'gladius'});}return {data:structuredClone(supply),error:null};}
  if(name==='ludus_equip_item'){items[0].equipped_by=p.p_gladiator;items[0].equipped_slot=p.p_slot;data.party.members[0].ready=false;return{data:{items:structuredClone(items)},error:null};}
  if(p.p_action==='invite')data.candidates.find(x=>x.id===p.p_peer).invited=true;
  if(p.p_action==='remove')data.party.members=data.party.members.filter(m=>m.user_id!==p.p_peer);
  if(p.p_action==='ready')data.party.members[0].ready=true;if(p.p_action==='unready'||p.p_action==='select')data.party.members[0].ready=false;
  return {data:structuredClone(data),error:null}},from(){return{select(){return this},eq(){return this},order(){return Promise.resolve({data:structuredClone(items),error:null})}}},channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){}};
}};`;
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});const page=await browser.newPage();
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://ranked.test')return route.abort();
  if(u.pathname.endsWith('/assets/runtime/supabase-59d39487c358.js'))return route.fulfill({body:mock,contentType:'application/javascript'});
  const file=path.join(root,u.pathname);if(!fs.existsSync(file))return route.fulfill({status:404});const ext=path.extname(file),type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp'}[ext]||'application/octet-stream';return route.fulfill({body:fs.readFileSync(file),contentType:type});
 });
 for(const [width,height] of [[844,390],[667,375],[568,320]]){
  await page.setViewportSize({width,height});await page.goto('https://ranked.test/ranked-team-v244.html');
  await page.getByText('Aurelius',{exact:true}).first().waitFor();
  assert.equal(await page.locator('.slot').count(),5);assert.equal(await page.locator('.empty-slot').count(),4);
  assert.equal(await page.locator('#teamCount').innerText(),'1 / 5');assert.equal(await page.locator('.match').isEnabled(),false);
  await page.getByRole('button',{name:'Hazır olduğunu bildir'}).click();assert.equal(await page.locator('.slot-ready.own').innerText(),'HAZIR');
  await page.getByRole('button',{name:'Hazır durumunu kaldır'}).click();assert.equal(await page.locator('.slot-ready.own').innerText(),'READY');
  assert.equal(await page.locator('#candidateList .candidate').count(),1);assert.match(await page.locator('#candidateList').innerText(),/arkadas/);
  await page.getByRole('button',{name:'Davet Et'}).click();assert.match(await page.locator('#candidateList').innerText(),/Gönderildi/);
  await page.getByRole('button',{name:'Klan',exact:true}).click();assert.match(await page.locator('#candidateList').innerText(),/klanli/);
  await page.evaluate(()=>{mockRankedParty.members.push({user_id:'friend',gladiator_id:'g2',gladiator:'Rufus',ludus:'Ludus Roma',leader:false,ready:false});document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByText('Rufus',{exact:true}).waitFor();await page.getByRole('button',{name:'Ludus Roma takımından çıkar'}).click();
  assert.equal(await page.locator('.empty-slot').count(),4,'the leader can remove a teammate');
  await page.getByRole('button',{name:'Hazır olduğunu bildir'}).click();
  await page.getByRole('button',{name:'GLADYATÖR & EŞYA'}).click();await page.getByRole('button',{name:'Kuşan',exact:true}).first().waitFor();
  await page.getByRole('button',{name:'Kuşan',exact:true}).first().click();assert.ok(await page.evaluate(()=>calls.some(x=>x.name==='ludus_equip_item'&&x.p.p_gladiator==='g1'&&x.p.p_item==='i1')));
  assert.equal(await page.locator('.slot-ready.own').innerText(),'READY');
  assert.ok(await page.evaluate(()=>calls.findIndex(x=>x.name==='ludus_equip_item')>calls.map(x=>x.p.p_action).lastIndexOf('unready')),'readiness is cleared before changing equipment');
  await page.getByRole('button',{name:'Eşya Üretimi'}).click();assert.match(await page.locator('#recipeDetails').innerText(),/Odun 2 \/ 1/);
  await page.getByRole('button',{name:'ÜRET',exact:true}).click();assert.ok(await page.evaluate(()=>calls.some(x=>x.name==='ludus_supply'&&x.p.p_action==='craft'&&x.p.p_request&&x.p.p_key==='gladius')));
  assert.match(await page.locator('#recipeDetails').innerText(),/Odun 1 \/ 1/);
  const dialog=await page.locator('.loadout-paper').evaluate(e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}});
  assert.ok(dialog.x>=0&&dialog.y>=0&&dialog.right<=width&&dialog.bottom<=height&&dialog.scrollHeight<=dialog.clientHeight+1,`loadout must fit ${width}x${height}: ${JSON.stringify(dialog)}`);
  await page.getByRole('button',{name:'Paneli kapat'}).click();
  const boxes=await page.locator('.paper,.team-scene,.ranked-header').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return{element:e.className,x:b.x,y:b.y,right:b.right,bottom:b.bottom,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}}));
  for(const b of boxes){assert.ok(b.x>=-1&&b.y>=-1&&b.right<=width+1&&b.bottom<=height+1,`panel must fit ${width}x${height}: ${JSON.stringify(b)}`);assert.ok(b.scrollHeight<=b.clientHeight+1,`panel overflow ${width}x${height}: ${JSON.stringify(b)}`);}
 }
 await browser.close();console.log('V244 UI PASS: five slots, friend/clan tabs, invitation action and landscape layouts.');
})().catch(e=>{console.error(e);process.exit(1)});
