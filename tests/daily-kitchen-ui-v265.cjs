// V267: real daily kitchen, live regeneration preview, next-bonus guidance and safe serving.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'daily-kitchen-v265-'));
const user='00000000-0000-4000-8000-000000000001';
const state={user_id:user,server_now:new Date().toISOString(),clan:{id:'00000000-0000-4000-8000-000000000002',name:'Legio Aurea',gold:7800,level:3,member_count:8,capacity:12,emblem:2,emblem_color:'#c7a967',background:'#541d2b'},wallet:{gold:4800,ludus_name:'Tırman'},is_leader:true,vault_access:true,vault:[{id:'gear1',kind:'weapon',model:'gladius',enhancement:4}],inventory:[{id:'gear2',kind:'shield',model:'large',enhancement:2}],vault_stones:[{family:'sapphire',stone_id:3,quantity:12}],inventory_stones:[{family:'diamond',stone_id:1,quantity:2},{family:'emerald',stone_id:2,quantity:3}],trophies:{league:2,cup:1},gladiators:[]};
const mock=`window.__clan=${JSON.stringify(state)};const testUser={id:${JSON.stringify(user)},is_anonymous:false,user_metadata:{}};const testAccount={user_id:testUser.id,ludus_name:'Tırman',gold:4800,diamonds:2,sapphires:4};window.__testClient={auth:{getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user:testUser},error:null}),onAuthStateChange:()=>({})},from:name=>{const value=name==='ludus_accounts'?testAccount:[];const b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data:value,error:null}),then:(r,j)=>Promise.resolve({data:value,error:null}).then(r,j)};return b;},rpc:async(name)=>({data:name==='ludus_clan'||name==='ludus_clan_vault'?structuredClone(__clan):name==='ludus_imperial'?{server_now:new Date().toISOString(),missions:[],assignments:[],gladiators:[],is_admin:false,today:'2026-10-07'}:name==='ludus_daily_state'?{missions:[],claimed_count:0,bonus_claimed:false}:{server_now:new Date().toISOString(),gladiators:[]},error:null})};`;
const foodMock=`
window.__foodCalls=[];window.__foodOrders={};window.__failOnce=true;
window.__food={user_id:testUser.id,today:'2026-11-15',reset_at:'2099-11-16T00:00:00+03:00',server_now:new Date().toISOString(),gold:3020,crew_count:10,last_menu:null,history:[],items:[['grain','Tahıl',3,28],['apple','Elma',6,14],['fish','Balık',9,7],['meat','Et',12,7],['beer','Şarap',6,21],['egg','Yumurta',6,7],['olive_oil','Zeytinyağı',12,10]].map(([sku,name,price,quantity])=>({sku,name,price,quantity})),combat:{active_bonus:0},menu:{coverage:0,missing_units:1000},kitchen:{version:265,revision:0,ingredients:[],served_at:null}};
function syncFoodBonus(){__food.combat.active_bonus=LudusFood.menu(__food.crew_count,__food.kitchen.ingredients).stamina_bonus_percent;}
const oldRPC=__testClient.rpc;__testClient.rpc=async(name,args)=>{
 if(name==='ludus_food_state'){syncFoodBonus();return {data:structuredClone(__food),error:null};}
 if(name==='ludus_food_serve'){
  __foodCalls.push(structuredClone(args));
  if(!__foodOrders[args.p_request]){
   if(args.p_revision!==__food.kitchen.revision)return {error:{code:'P0001',message:'Menü başka bir oturumda değişti.'}};
   for(const i of args.p_items){__food.items.find(x=>x.sku===i.sku).quantity-=i.quantity;const old=__food.kitchen.ingredients.find(x=>x.sku===i.sku);if(old)old.quantity+=i.quantity;else __food.kitchen.ingredients.push({...i});}
   __food.kitchen.revision++;__food.kitchen.served_at=new Date().toISOString();__foodOrders[args.p_request]=true;
  }
  syncFoodBonus();if(__failOnce){__failOnce=false;throw Error('Bağlantı kesildi');}
  return {data:structuredClone(__food),error:null};
 }
 if(name==='ludus_food_buy'){if(!__foodOrders[args.p_request]){const i=__food.items.find(x=>x.sku===args.p_sku);i.quantity+=args.p_quantity;__food.gold-=args.p_quantity*i.price;__foodOrders[args.p_request]=true;}return {data:structuredClone(__food),error:null};}
 return oldRPC(name,args);
};`;
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:844,height:390}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:8765/**',r=>{const file=root+new URL(r.request().url()).pathname;if(!fs.existsSync(file))return r.fulfill({status:404});let body=fs.readFileSync(file);if(file.endsWith('ludus.html'))body=Buffer.from(body.toString().replace('const accountClient=LudusClient.create','let accountClient=LudusClient.create').replace('const accountReady=(async()=>{',mock+foodMock+'\nconst accountReady=(async()=>{accountClient=window.__testClient;'));return r.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.webp')?'image/webp':'application/octet-stream'});});await page.route('https://**',r=>r.abort());
 await page.goto('http://127.0.0.1:8765/ludus.html');await page.waitForFunction(()=>window.LudusPreview?.exploring&&LudusPreview.foodSystem?.state,null,{timeout:60000});
 assert.equal(await page.locator('#foodOpen').isVisible(),false);await page.evaluate(()=>LudusPreview.enterRoom(LudusPreview.rooms.find(r=>r.kind==='dining')));await page.waitForFunction(()=>!!LudusPreview.roomProps.getObjectByName('Mutfak kazanı'));await page.screenshot({path:out+'/entry.png'});await page.locator('#foodOpen').click();
 assert.equal(await page.locator('.kitchen-slot[data-empty]').count(),8);assert.equal(await page.getByRole('meter').count(),2);assert.equal(await page.locator('.kitchen-stock').count(),7);
 const stock=sku=>page.locator('.kitchen-stock[data-sku="'+sku+'"]');
 const bonus=()=>page.locator('.kitchen-effect-value').innerText(),hint=()=>page.locator('.kitchen-next-hint').innerText();
 assert.equal(await bonus(),'+%0');assert.match(await hint(),/10 porsiyon/);
 for(let i=0;i<10;i++)await stock('grain').click();
 assert.equal(await bonus(),'+%4');assert.match(await hint(),/\+%8 için 2 çeşit/);
 await page.getByRole('button',{name:'Tahıl seçimini azalt',exact:true}).click();await stock('apple').click();assert.equal(await bonus(),'+%4');assert.match(await hint(),/1 çeşit/);
 await page.getByRole('button',{name:'Tahıl seçimini azalt',exact:true}).click();await stock('fish').click();assert.equal(await bonus(),'+%8');assert.match(await hint(),/\+%12 için 2 çeşit/);
 await page.getByRole('button',{name:'Tahıl seçimini azalt',exact:true}).click();await stock('egg').click();assert.equal(await bonus(),'+%8');assert.match(await hint(),/1 çeşit/);
 await page.getByRole('button',{name:'Tahıl seçimini azalt',exact:true}).click();await stock('meat').click();assert.equal(await bonus(),'+%12');
 await page.getByRole('button',{name:'Tahıl seçimini azalt',exact:true}).click();assert.equal(await bonus(),'+%0');assert.match(await hint(),/1 porsiyon/);
 await page.getByRole('button',{name:'Seçimi temizle',exact:true}).click();assert.equal(await bonus(),'+%0');

 for(const sku of ['grain','apple','fish','meat','egg']){await stock(sku).click();await stock(sku).click();}
 assert.equal(await page.locator('.kitchen-slot[data-empty]').count(),3);assert.equal(await page.getByRole('meter',{name:'Porsiyon',exact:true}).getAttribute('aria-valuenow'),'100');assert.equal(await page.getByRole('meter',{name:'Çeşitlilik',exact:true}).getAttribute('aria-valuenow'),'100');
 assert.equal(await page.evaluate(()=>__food.items[0].quantity),28,'selection never spends pantry stock');
 await stock('beer').click();await stock('olive_oil').click();assert.equal(await bonus(),'+%12');assert.equal(await page.locator('.kitchen-active').innerText(),'Aktif: +%0');assert.equal(await page.locator('.kitchen-effect-status').innerText(),'Yemek verilince');
 const layoutErrors=[];
 for(const [width,height]of [[1280,800],[844,390],[667,375],[568,320],[393,852],[375,667]]){
  await page.setViewportSize({width,height});await page.waitForFunction(()=>[...document.querySelectorAll('.kitchen-stock img,.kitchen-slot img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:path.join(out,'kitchen-'+width+'x'+height+'.png')});
  if(height>width){assert.equal(await page.locator('#landscapeGate').isVisible(),true,'portrait retains the game orientation gate');continue;}
  const layout=await page.evaluate(()=>{const selectors=['.kitchen-body','.kitchen-menu','.kitchen-inventory','.kitchen-slot','.kitchen-stock','.kitchen-gauge','.kitchen-actions','.kitchen-note','.kitchen-inventory-note','.kitchen-effect','.kitchen-effect h3','.kitchen-effect-value','.kitchen-effect-status','.kitchen-next','.kitchen-slot-art img','.kitchen-stock img'];return selectors.flatMap(s=>[...document.querySelectorAll(s)].map(n=>{const r=n.getBoundingClientRect();return {s,overflow:n.scrollHeight>n.clientHeight+2||n.scrollWidth>n.clientWidth+2,out:r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1,box:[r.x,r.y,r.width,r.height],scroll:[n.scrollWidth,n.scrollHeight,n.clientWidth,n.clientHeight]}})).filter(n=>n.overflow||n.out||n.s.endsWith(' img')&&(n.box[2]<14||n.box[3]<14));});if(layout.length)layoutErrors.push({width,height,layout});
 }
 assert.deepEqual(layoutErrors,[],JSON.stringify(layoutErrors));
 await page.setViewportSize({width:844,height:390});await page.getByRole('button',{name:'Bugünün yemeğini ver',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.kitchen-status').textContent.includes('Bağlantı kesildi'));
 assert.equal(await page.locator('.kitchen-serve').isDisabled(),true);assert.equal(await page.locator('.kitchen-active').innerText(),'Aktif: +%0');assert.equal(await page.locator('.kitchen-effect-status').innerText(),'Doğrulanıyor');await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.kitchen-status').textContent.includes('Etkisi şimdi aktif'));
 const result=await page.evaluate(()=>({calls:__foodCalls,stock:__food.items[0].quantity,pending:localStorage.getItem('ludus-kitchen-pending-v265:'+__food.user_id)}));assert.equal(result.calls.length,2);assert.deepEqual(result.calls[0],result.calls[1]);assert.equal(result.stock,26);assert.equal(result.pending,null);assert.equal(await bonus(),'+%12');assert.equal(await page.locator('.kitchen-active').innerText(),'Aktif: +%12');assert.equal(await page.locator('.kitchen-effect-status').innerText(),'Bugün aktif');await page.screenshot({path:out+'/kitchen-served-844.png'});
 assert.equal(await page.getByRole('button',{name:'Tahıl seçimini azalt',exact:true}).isDisabled(),true,'served food cannot be refunded');
 await page.getByRole('button',{name:'Erzak al',exact:true}).click();await page.getByRole('spinbutton',{name:'Satın alınacak miktar'}).fill('2');await page.getByRole('button',{name:'Satın al',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.kitchen-status').textContent.includes('envantere eklendi'));assert.equal(await page.evaluate(()=>__food.gold),3014);assert.equal(await page.evaluate(()=>__food.items[0].quantity),28);
 await page.evaluate(async()=>{__food.today='2026-11-16';__food.kitchen={version:265,revision:0,ingredients:[],served_at:null};await LudusPreview.foodSystem.refresh();});assert.equal(await page.locator('.kitchen-slot[data-empty]').count(),8);assert.equal(await page.getByRole('meter',{name:'Porsiyon',exact:true}).getAttribute('aria-valuenow'),'0');assert.equal(await bonus(),'+%0');assert.equal(await page.locator('.kitchen-active').innerText(),'Aktif: +%0');
 await stock('grain').click();await page.evaluate(async()=>{__food.kitchen.revision=1;__food.kitchen.ingredients=[{sku:'fish',quantity:1}];await LudusPreview.foodSystem.refresh();});assert.equal(await page.locator('.kitchen-slot[data-sku="grain"]').count(),0,'other-tab delivery invalidates stale selection');
 await page.evaluate(async()=>{__food.crew_count=0;__food.kitchen.ingredients=[];await LudusPreview.foodSystem.refresh();});assert.equal(await stock('grain').isDisabled(),true);
 await page.getByRole('button',{name:'Mutfağı kapat'}).click();assert.equal(await page.evaluate(()=>LudusPreview.paused),false);await page.evaluate(()=>LudusPreview.leaveRoom());assert.equal(await page.locator('#foodOpen').isVisible(),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({pass:true,viewports:6,fullLudusIntegration:true,twoMeters:true,regenerationTiers:[0,4,8,12],livePreview:true,activeOnlyAfterConfirmation:true,inventorySelection:true,retrySafe:true,buy:true,midnight:true,otherTab:true,errors,out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
