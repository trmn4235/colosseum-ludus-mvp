// Real medical-production module and themed styles; every account operation is an isolated fixture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright'));
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/medical-supplies-v289';
const ludusHTML=fs.readFileSync(path.join(root,'ludus.html'),'utf8'),styles=[...ludusHTML.slice(0,ludusHTML.indexOf('</head>')).matchAll(/<style[^>]*>[\s\S]*?<\/style>|<link[^>]*rel="stylesheet"[^>]*>/g)].map(m=>m[0]).join('');
const names={beeswax:'Balmumu',olive_oil:'Zeytinyağı',laurel:'Defne',honey:'Bal',wine_vinegar:'Şarap sirkesi',fig:'İncir',wood:'Odun',wool:'Yün',rope:'İp',linen:'Keten',sponge:'Sünger'};
const definitions=[['beeswax_ointment','Balmumu Merhemi',['beeswax','olive_oil']],['laurel_ointment','Defne Merhemi',['laurel','beeswax','olive_oil']],['honey_vinegar_syrup','Ballı Sirke Şurubu',['honey','wine_vinegar']],['fig_syrup','İncir Şurubu',['fig','honey']],['wood_splint','Tahta Atel',['wood','wool','rope']],['linen_bandage','Keten Sargı Bezi',['linen','rope']],['vinegar_sponge','Sirkeli Sünger',['sponge','wine_vinegar']]];
const data={user_id:'00000000-0000-4000-8000-000000000001',server_now:new Date().toISOString(),recipes:definitions.map(([sku,name,inputs])=>({sku,name,output_quantity:1,max_craftable:10,ingredients:inputs.map(sku=>({sku,name:names[sku],quantity:1,owned:10,source:sku==='olive_oil'?'food':'resource'}))})),inventory:definitions.map(([sku,name])=>({sku,name,quantity:2}))};
const html='<!doctype html><html lang="tr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><script src="/ui-theme-v275.js"></script>'+styles+'<link rel="stylesheet" href="/infirmary-supplies-v289.css"><style>body{margin:0}</style></head><body data-art-direction="136" data-roman-screen="ludus"><button id="entry">Tıbbi malzeme üretimi</button><script src="/infirmary-supplies-v289.js"></script><script>window.medical=LudusInfirmarySuppliesV289.create({client:window.fixtureClient,ready:Promise.resolve({user_id:window.fixture.user_id}),onCraft:state=>window.doctorInventory=structuredClone(state.inventory)});document.getElementById("entry").onclick=()=>medical.open({returnTo:()=>window.returns++});</script></body></html>';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await(process.env.LUDUS_WEBKIT_TEST?webkit:chromium).launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH&&!process.env.LUDUS_WEBKIT_TEST?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{}),args:process.env.LUDUS_WEBKIT_TEST?[]:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:874,height:402}}),errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('.supabase.co'))network.push(r.url());});
  await page.addInitScript(fixture=>{
   window.fixture=fixture;window.calls=[];window.receipts={};window.commits=0;window.dropNext=false;window.returns=0;
   window.fixtureClient={rpc:async(name,args)=>{
    if(name!=='ludus_infirmary_v289')throw Error('Unexpected RPC '+name);calls.push(structuredClone(args));
    if(args.p_action==='state')return{data:structuredClone(fixture)};
    if(receipts[args.p_request]){const saved=structuredClone(receipts[args.p_request]);saved.outcome.replayed=true;return{data:saved};}
    const recipe=fixture.recipes.find(r=>r.sku===args.p_args.sku),count=args.p_args.quantity;
    if(count>recipe.max_craftable)return{error:{code:'P0001',message:'Malzeme yetersiz'}};
    commits++;fixture.inventory.find(i=>i.sku===recipe.sku).quantity+=count;
    for(const input of recipe.ingredients){for(const r of fixture.recipes){const shared=r.ingredients.find(i=>i.sku===input.sku&&i.source===input.source);if(shared)shared.owned-=count;}}
    for(const r of fixture.recipes)r.max_craftable=Math.min(100,...r.ingredients.map(i=>Math.floor(i.owned/i.quantity)));
    fixture.outcome={action:'craft',sku:recipe.sku,quantity:count,request_id:args.p_request,replayed:false,spent:recipe.ingredients.map(i=>({sku:i.sku,quantity:count,source:i.source}))};receipts[args.p_request]=structuredClone(fixture);
    if(dropNext){dropNext=false;return{error:{code:'08006',message:'Yanıt kayboldu'}};}return{data:structuredClone(fixture)};
   }};
  },data);
  await page.route('**/*',route=>{const file=new URL(route.request().url()).pathname.slice(1);if(file==='fixture')return route.fulfill({contentType:'text/html',body:html});const target=path.join(root,file);if(!target.startsWith(root+'/')||!fs.existsSync(target)||!fs.statSync(target).isFile())return route.fulfill({status:404,body:''});return route.fulfill({contentType:({'.css':'text/css','.js':'text/javascript','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(target)});});
  await page.goto('https://medical.test/fixture');await page.locator('#entry').click();await page.locator('[data-recipe]').first().waitFor();assert.equal(await page.locator('[data-recipe]').count(),7);
  const beforeRefresh=await page.evaluate(()=>calls.filter(c=>c.p_action==='state').length);await page.locator('.medsup289-reload').click();await page.waitForFunction(n=>calls.filter(c=>c.p_action==='state').length===n+1,beforeRefresh);
  for(const[width,height]of [[1280,720],[874,402],[667,375],[568,320],[390,844]]){
   await page.setViewportSize({width,height});
   for(const theme of ['blue','black','white']){
    await page.evaluate(theme=>{LudusTheme.set(theme);},theme);
    const bounds=await page.locator('#medicalSuppliesModal').evaluate(e=>{const r=e.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:e.scrollWidth-e.clientWidth,height:e.scrollHeight-e.clientHeight};});
    assert.ok(bounds.left>=0&&bounds.top>=0&&bounds.right<=width+1&&bounds.bottom<=height+1&&bounds.width<2&&bounds.height<2,JSON.stringify({width,height,theme,bounds}));
    const title=await page.locator('#medicalSuppliesTitle').evaluate(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n),head=n.closest('header'),h=head.getBoundingClientRect(),hs=getComputedStyle(head);return{x:r.left,y:r.top,r:r.right,b:r.bottom,width:r.width,height:r.height,header:{x:h.left,y:h.top,r:h.right,b:h.bottom},display:s.display,visibility:s.visibility,opacity:s.opacity,color:s.color,headColor:hs.color,headBackground:hs.backgroundColor,pointerEvents:hs.pointerEvents};});
    assert.ok(title.width>0&&title.height>0&&title.x>=title.header.x&&title.y>=title.header.y&&title.r<=title.header.r+1&&title.b<=title.header.b+1,'visible production title '+JSON.stringify({width,height,theme,title}));assert.notEqual(title.display,'none');assert.equal(title.visibility,'visible');assert.equal(title.opacity,'1');assert.equal(title.color,title.headColor);assert.notEqual(title.color,title.headBackground);assert.equal(title.pointerEvents,'auto');
    for(const recipe of data.recipes){await page.locator('[data-recipe="'+recipe.sku+'"]').click();assert.equal(await page.locator('.medsup289-heading h2').textContent(),recipe.name);assert.equal(await page.locator('.medsup289-materials tbody tr').count(),recipe.ingredients.length);assert.equal(await page.locator('[data-craft]').isDisabled(),false);}
   }
   await page.screenshot({path:path.join(out,'production-'+width+'.png')});
  }
  await page.setViewportSize({width:874,height:402});await page.locator('[data-recipe="beeswax_ointment"]').click();await page.locator('#medicalCraftQuantity').fill('3');await page.locator('#medicalCraftQuantity').dispatchEvent('change');
  assert.match(await page.locator('.medsup289-heading p').textContent(),/2 depoda → 5 depoda/);assert.equal(await page.evaluate(()=>commits),0,'recipe and quantity preview never crafts');
  assert.deepEqual(await page.locator('.medsup289-materials tbody tr').first().locator('td').allTextContents(),['Balmumu','10','3','7']);
  await page.locator('#medicalCraftQuantity').fill('11');await page.locator('#medicalCraftQuantity').dispatchEvent('change');assert.equal(await page.locator('[data-craft]').isDisabled(),true);
  await page.locator('#medicalCraftQuantity').fill('3');await page.locator('#medicalCraftQuantity').dispatchEvent('change');await page.evaluate(()=>dropNext=true);await page.locator('[data-craft]').click();await page.getByRole('button',{name:'Aynı üretimi kontrol et'}).waitFor();
  assert.equal(await page.evaluate(()=>commits),1);assert.equal(await page.locator('#medicalCraftQuantity').isDisabled(),true);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>returns),1);await page.locator('#entry').click();await page.getByRole('button',{name:'Aynı üretimi kontrol et'}).click();await page.waitForFunction(()=>document.querySelector('.medsup289-footer').textContent.includes('Ludus deposuna eklendi'));
  assert.equal(await page.evaluate(()=>commits),1);assert.equal(await page.evaluate(()=>doctorInventory.find(i=>i.sku==='beeswax_ointment').quantity),5);
  const transactions=await page.evaluate(()=>calls.filter(c=>c.p_action==='craft'));assert.equal(transactions.length,2);assert.equal(transactions[0].p_request,transactions[1].p_request);
  await page.getByRole('button',{name:'Geri dön',exact:true}).click();assert.equal(await page.locator('#medicalSuppliesModal').isVisible(),false);assert.equal(await page.evaluate(()=>returns),2,'visible header back button returns to the caller');assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  console.log('PASS V289 medical production UI: seven recipes, three themes/five sizes, live required/current/remaining preview, no preview writes, shared food/resource stock, retry-safe lost response, doctor inventory refresh and return route.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
