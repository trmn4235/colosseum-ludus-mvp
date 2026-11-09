// Real decoded rigs and equipment. RPC data is isolated from production accounts.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/ranked-v253';
const classes=['murmillo','retiarius','thraex','secutor','scissor'];
const members=classes.map((type,n)=>{
 const gladiator={id:'g'+n,name:'Gladyatör '+n,class:type,overall:50,level:1};
 const items=[{id:'w'+n,kind:'weapon',model:type==='retiarius'?'trident':type==='thraex'?'sica':'gladius',equipped_slot:'main_hand',enhancement:5},
  {id:'o'+n,kind:['retiarius','scissor'].includes(type)?'weapon':'shield',model:type==='retiarius'?'net':type==='scissor'?'scissor':type==='thraex'?'small':'large',equipped_slot:'off_hand',enhancement:5},
  {id:'h'+n,kind:'helmet',model:type,equipped_slot:'helmet',enhancement:0},
  {id:'l'+n,kind:'legs',model:'starter',equipped_slot:'legs',enhancement:0}];
 if(n===0)items.push({id:'c0',kind:'chest',model:'chest_plate',equipped_slot:'chest',enhancement:3},{id:'a0',kind:'gloves',model:'manica_lion',equipped_slot:'gloves',enhancement:2});
 return {user_id:'u'+n,gladiator_id:gladiator.id,gladiator:gladiator.name,class:type,ludus:'Roma-'+n,ready:false,leader:n===0,appearance:{gladiator,items}};
});
const fixture=`window.__team={user_id:'u0',ranked_rating:1500,party:{id:'room',leader:'u0',members:${JSON.stringify(members)}},candidates:[],invites:[],gladiators:[${JSON.stringify(members[0].appearance.gladiator)},{id:'other',name:'Yeni Thraex',class:'thraex'}]};
LudusClient.create=()=>({auth:{getUser:async()=>({data:{user:{id:'u0'}}})},rpc:async(name,args={})=>{
 if(name==='ludus_ranked_party_v253'){
  if(args.p_action==='select'){const g=__team.gladiators.find(g=>g.id===args.p_gladiator),m=__team.party.members[0];Object.assign(m,{gladiator_id:g.id,gladiator:g.name,class:g.class,appearance:{gladiator:g,items:[]}});}
  if(args.p_action==='remove')__team.party.members=__team.party.members.filter(m=>m.user_id!==args.p_peer);
  return {data:structuredClone(__team)};
 }
 if(name==='ludus_supply')return {data:{user_id:'u0',recipes:[],resources:[]}};
 if(name==='ludus_equip_item'){__team.party.members[0].appearance.items=[{id:'new-item',kind:'weapon',model:'halberd',enhancement:4,equipped_slot:args.p_slot}];return{data:{items:[]}};}
 return{data:null};
},from:()=>({select(){return this},eq(){return this},order:async()=>({data:[{id:'new-item',kind:'weapon',model:'halberd',enhancement:4}]})})});`;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+'/')||!fs.existsSync(file))return res.writeHead(404).end();
 let body=fs.readFileSync(file);if(file.endsWith('/ranked-team-v244.js'))body=Buffer.from(fixture+'\n'+body);
 if(file.endsWith('/ranked-lineup-v253.js'))body=Buffer.from(body.toString().replace('function draw(){','function draw(){window.__lineupDraws=(window.__lineupDraws||0)+1;').replace('return {update,dispose};','window.__lineup={models,get renderer(){return renderer},get slots(){return slots}};return {update,dispose};'));
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}).end(body);
});
let browser;
(async()=>{try{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1100,height:620},deviceScaleFactor:2,isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});page.on('console',m=>{if(m.type()==='warning')console.log(m.text());});await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port+'/ranked-team-v244.html');
 await page.waitForFunction(()=>window.__lineup?.models.size===5&&document.getElementById('lineupStatus').hidden,null,{timeout:90000});
 assert.equal(await page.locator('canvas').count(),1);
 assert.deepEqual(await page.evaluate(()=>[...__lineup.models.values()].map(e=>e.fighter.type)),classes);
 const before=await page.evaluate(()=>Object.fromEntries([...__lineup.models].map(([id,e])=>[id,e.model.root.uuid])));
 await page.screenshot({path:out+'/five-equipped-fighters.png'});
 for(const [width,height]of [[844,390],[667,375],[568,320]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(300);
  const box=await page.locator('#teamModels').boundingBox();assert.ok(box.height>100&&box.x>=0&&box.x+box.width<=width);
  const scroll=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.scrollHeight]);assert.ok(scroll[0]<=width&&scroll[1]<=height,'no scrolling');
  await page.screenshot({path:out+'/lineup-'+width+'.png'});
 }
 await page.waitForTimeout(1300);const draws=await page.evaluate(()=>__lineupDraws);await page.waitForTimeout(1300);
 assert.equal(await page.evaluate(()=>__lineupDraws),draws,'unchanged polling does not render or animate');
 assert.deepEqual(await page.evaluate(()=>Object.fromEntries([...__lineup.models].map(([id,e])=>[id,e.model.root.uuid]))),before,'polling preserves model instances');
 await page.locator('#openLoadout').click();await page.selectOption('#fighterSelect','other');
 await page.waitForFunction(()=>__lineup.models.get('u0')?.fighter.type==='thraex');
 assert.equal(await page.evaluate(()=>__lineup.models.get('u0').fighter.weapon),null,'unarmed selection is not given a stock weapon');
 await page.getByRole('button',{name:'Kuşan',exact:true}).click();
 await page.waitForFunction(()=>__lineup.models.get('u0')?.fighter.weapon==='halberd');
 assert.equal(await page.evaluate(()=>__lineup.models.get('u0').fighter.chest),false,'old armour is removed');
 await page.locator('#closeLoadout').click();await page.getByRole('button',{name:'Roma-4 takımından çıkar'}).click();
 await page.waitForFunction(()=>__lineup.models.size===4);
 assert.equal(await page.locator('.empty-slot').count(),1);assert.equal(await page.evaluate(()=>__lineup.models.has('u4')),false);
 await page.screenshot({path:out+'/changed-fighter-and-empty-slot.png'});
 assert.deepEqual(errors,[]);console.log('V253 PASS: real five-fighter lineup; selection, equipment and removal; unchanged polls draw zero frames; three mobile layouts.');
 }catch(e){for(const c of browser?.contexts()||[])for(const p of c.pages())await p.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await browser?.close();server.closeAllConnections();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
