const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const mock=`(()=>{
 const read=()=>JSON.parse(sessionStorage.getItem('mockV254')||'null')||{due:Date.now()+180000,n:0,invites:[],party:null,calls:[]};
 const save=s=>sessionStorage.setItem('mockV254',JSON.stringify(s));save(read());
 globalThis.supabase={createClient(){return {auth:{getUser:async()=>({data:{user:{id:'me'}}}),onAuthStateChange(fn){globalThis.changeAuth=fn;return{data:{subscription:{unsubscribe(){}}}}}},rpc:async(name,p={})=>{
 const s=read();s.calls.push({name,action:p.p_action,time:Date.now()});
 if(name==='ludus_ranked_invites_v254'){
  if(p.p_action==='pause'){s.paused=true;s.due=Date.now()+180000;save(s);return{data:{invites:[],paused:true,next_in_ms:180000}};}
  if(s.paused){s.paused=false;s.due=Date.now()+180000;}
  if(Date.now()>=s.due&&!s.party){s.n++;s.due=Date.now()+180000;s.invites=[{id:'invite-'+s.n,leader:['Xion-4','Aquila-2','Roma-7'][(s.n-1)%3],expires_at:new Date(s.due).toISOString()}];}
  save(s);return{data:{invites:s.party?[]:s.invites,next_in_ms:s.due-Date.now(),server_now:new Date().toISOString()}};
 }
 if(p.p_action==='decline')s.invites=s.invites.filter(i=>i.id!==p.p_invite);
 if(p.p_action==='accept'){
  if(!s.invites.some(i=>i.id===p.p_invite))return{error:{message:'Davet sona erdi.'}};
  s.party={id:'room',leader:'clan0',auto_start:true,queue:{status:'idle'},members:[0,1,2,3].map(i=>({user_id:'clan'+i,gladiator_id:'g'+i,gladiator:'Klan gladyatörü '+i,ludus:'Roma-'+i,ready:true,leader:i===0}))};
  s.party.members.push({user_id:'me',gladiator_id:'mine',gladiator:'Seçilen gladyatör',ludus:'Benim Ludus',ready:false});s.invites=[];
 }
 if(p.p_action==='ready'){s.party.members.find(m=>m.user_id==='me').ready=true;s.party.queue={status:'matched',match_id:'00000000-0000-4000-8000-000000000254'};}
 save(s);return{data:{user_id:'me',party:s.party,invites:s.invites,gladiators:[{id:'mine',name:'Seçilen gladyatör',class:'murmillo'}],candidates:[],ranked_rating:1500}};
 }}}};})();`;
module.exports=async(browser,root)=>{
 for(const [width,height]of [[844,390],[568,320],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-11-09T12:00:00Z')});await page.clock.pauseAt(new Date('2026-11-09T12:00:01Z'));
  await page.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin!=='https://incoming.test')return route.abort();
   if(u.pathname==='/assets/runtime/supabase-59d39487c358.js')return route.fulfill({body:mock,contentType:'application/javascript'});
   if(['/browse.html','/next.html','/multiplayer.html'].includes(u.pathname))return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#eee9df}#ludusHud{height:46px;background:#fff8e9;border-bottom:2px solid #ae8a51;font:18px Georgia;color:#741d2c;display:flex;align-items:center;justify-content:center}</style><header id="ludusHud">COLOSSEUM & MAGNUS</header><main>Oyun ekranı</main><script>'+mock+'</script><script src="ludus-client-v84.js"></script>'});
   const file=path.join(root,u.pathname);if(!fs.existsSync(file))return route.fulfill({status:404});const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream';route.fulfill({body:fs.readFileSync(file),contentType:type});
  });
  const card=()=>page.locator('#rankedInvite'),state=()=>page.evaluate(()=>JSON.parse(sessionStorage.mockV254));
  await page.goto('https://incoming.test/browse.html');await page.waitForFunction(()=>document.querySelector('#rankedInvite'));
  assert.equal(await card().isVisible(),false);await page.clock.runFor(90000);assert.equal(await card().isVisible(),false);
  await page.goto('https://incoming.test/next.html');await page.clock.runFor(89000);assert.equal(await card().isVisible(),false,'navigation does not restart or accelerate the timer');
  await page.clock.runFor(1000);await page.waitForFunction(()=>!document.querySelector('#rankedInvite').hidden);
  assert.match(await card().innerText(),/Xion-4’ten Ranked 5v5/);assert.equal(await card().getByRole('button',{name:'KATIL'}).count(),1);
  let rect=await card().boundingBox(),hud=await page.locator('#ludusHud').boundingBox();assert.ok(rect.y>=hud.y+hud.height+7&&rect.x>=0&&rect.x+rect.width<=width,'banner sits below menu within viewport');
  fs.mkdirSync('/tmp/ranked-v253',{recursive:true});await page.screenshot({path:'/tmp/ranked-v253/invite-v254-'+width+'.png'});
  // A real touch gesture, not a direct call to the dismissal implementation.
  const touch=await context.newCDPSession(page),x=rect.x+20,y=rect.y+rect.height/2;
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+110,y,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await card().isVisible(),false,'right swipe dismisses');assert.ok((await state()).calls.some(c=>c.action==='decline'));
  await page.reload();await page.clock.runFor(1000);assert.equal(await card().isVisible(),false,'dismissed invite stays hidden across navigation');
  await page.clock.runFor(179000);await page.waitForFunction(()=>!document.querySelector('#rankedInvite').hidden);
  assert.match(await card().innerText(),/Aquila-2’ten Ranked 5v5/);assert.equal(await page.locator('#rankedInvite').count(),1);
  await page.evaluate(()=>{const b=document.querySelector('#rankedInvite button');b.click();b.click();});
  await page.waitForURL('**/ranked-team-v244.html?v=254');await page.getByText('Seçilen gladyatör',{exact:true}).first().waitFor();
  assert.equal((await state()).calls.filter(c=>c.action==='accept').length,1,'double taps cannot join twice');
  assert.equal(await page.locator('#incoming').isVisible(),false,'KATIL already accepted; there is no second confirmation');
  assert.equal(await page.locator('.slot-ready.ready').count(),4);assert.equal(await page.locator('#startMatch').innerText(),'READY İLE BAŞLA');
  await page.getByRole('button',{name:'Hazır olduğunu bildir'}).click();await page.waitForURL('**/multiplayer.html?venue=ranked&v=252');
  assert.equal((await state()).calls.filter(c=>c.action==='start').length,0,'READY enters without a second start action');
  await page.waitForFunction(()=>JSON.parse(sessionStorage.mockV254).paused);
  let before=(await state()).calls.length;await page.clock.runFor(180000);assert.equal((await state()).calls.length,before,'battle does not poll invitations');assert.equal(await card().isVisible(),false);
  await page.evaluate(()=>{const s=JSON.parse(sessionStorage.mockV254);s.party=null;sessionStorage.mockV254=JSON.stringify(s)});
  await page.goto('https://incoming.test/browse.html');await page.clock.runFor(179000);assert.equal(await card().isVisible(),false);await page.clock.runFor(1000);await page.waitForFunction(()=>!document.querySelector('#rankedInvite').hidden);
  assert.match(await card().innerText(),/Roma-7’ten Ranked 5v5/);
  await page.evaluate(()=>changeAuth('SIGNED_OUT',null));await page.clock.runFor(1);assert.equal(await card().isVisible(),false);
  before=(await state()).calls.length;await page.clock.runFor(180000);assert.equal((await state()).calls.length,before,'logout stops incoming requests');
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS V254 browser: 3-minute cadence across pages, top-menu placement, real touch swipe, different inviter, single acceptance, READY -> match, pause, return and logout (3 sizes).');
};
