// Actual courtyard equipment selection, persistence into the live rig and mobile recipes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'..'),req=createRequire(__dirname+'/production-browser-v119.cjs'),{chromium,webkit}=req('playwright'),rows=require('../assets/equipment-v198/build-report.json').items;
let fixture=fs.readFileSync(__dirname+'/production-browser-v119.cjs','utf8');fixture=fixture.slice(0,fixture.lastIndexOf('\n(async()=>{'));
fixture=fixture.replace("const progress=JSON.parse(fs.readFileSync('/tmp/caravan-progress-v116.json'));","const progress={rewards:[]};");
fixture=fixture.replace('const fixture=`',"items.find(i=>i.kind==='shield').model='shield_viridis';items.push(..."+JSON.stringify(rows.map(r=>({id:r.id,kind:'shield',model:r.id,name:r.label,equipped_by:null,equipped_slot:null,enhancement:0})))+");\nconst fixture=`");
fixture=fixture.replace('  __rpcCalls.push({name,args});',`  __rpcCalls.push({name,args});
  if(name==='ludus_equip_item'){for(const i of __items)if(i.equipped_by===args.p_gladiator&&i.equipped_slot===args.p_slot){i.equipped_by=null;i.equipped_slot=null;}Object.assign(__items.find(i=>i.id===args.p_item),{equipped_by:args.p_gladiator,equipped_slot:args.p_slot});return{data:{items:__items,training:{server_now:new Date().toISOString(),gladiators:__fighters}}};}`);
const {server}=new Function('require','__dirname','process',fixture+'\nreturn{server};')(req,__dirname,process),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/shields-v198/courtyard';fs.mkdirSync(out,{recursive:true});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const safari=!!process.env.LUDUS_WEBKIT_TEST,browser=await(safari?webkit:chromium).launch(safari?{headless:true}:{headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[];let page;
 async function openCourtyard(width,height){
  page=await browser.newPage({viewport:{width,height},hasTouch:true});page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));await page.route(/^https:/,r=>r.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/ludus.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.LudusPreview?.roster?.[0]?.model?.gear,null,{timeout:90000});
  await page.evaluate(async()=>{await LudusPreview.accountReady;await LudusPreview.residentsReady;});await page.locator('#loading').waitFor({state:'hidden',timeout:90000});await page.bringToFront();
 }
 try{await openCourtyard(874,402);
  assert.equal(await page.evaluate(()=>LudusPreview.roster[0].state.shieldStyle),'shield_viridis');
  async function tap(target){
   await target.waitFor({state:'visible'});assert.equal(await target.isEnabled(),true);
   const point=await target.evaluate(e=>{const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return{x,y,width:r.width,height:r.height,onScreen:x>=0&&y>=0&&x<innerWidth&&y<innerHeight,hit:e.contains(document.elementFromPoint(x,y))};});
   assert.ok(point.width>0&&point.height>0&&point.onScreen&&point.hit,'Tap must reach the visible item: '+JSON.stringify(point));
   await page.touchscreen.tap(point.x,point.y);
  }
  for(const row of rows){
   await page.evaluate(()=>LudusPreview.exercisePanel.open(LudusPreview.roster[0],{slot:'off_hand'}));
   if(!await page.locator('[data-item="'+row.id+'"]').count())await tap(page.getByRole('button',{name:'Sonraki eşya sayfası',exact:true}));
   const choice=page.locator('[data-item="'+row.id+'"]');
   try{await tap(choice);}catch(error){console.error('Shield picker state',error.message,await page.evaluate(()=>({selected:LudusPreview.roster[0].state.shieldStyle,ordersHidden:document.getElementById('orders').hidden,loadingHidden:document.getElementById('loading').hidden,choices:[...document.querySelectorAll('[data-item]')].map(e=>e.dataset.item),calls:__rpcCalls.filter(r=>r.name==='ludus_equip_item')})),errors);throw error;}
   await page.waitForFunction(id=>LudusPreview.roster[0].state.shieldStyle===id,row.id);
   const stats=await page.evaluate(async id=>{const v=LudusPreview,g=v.roster[0],m=g.model;await LudusEquipmentCatalog.load(THREE,id);v.exercisePanel.close();v.roster.forEach(r=>{r.body.visible=r===g});Object.assign(g.state,{x:0,z:0,angle:0,action:'idle',blocking:false,hp:100});for(let i=0;i<16;i++)ImportedGladiator.animate(g.state,m,i/60,1/60);v.camera.position.set(1.6,1.65,3.3);v.camera.lookAt(.1,1,0);v.renderer.render(v.scene,v.camera);return{model:m.gear.shield.group.userData.catalogId,visible:m.gear.shield.group.visible,recipe:LudusProduction.skuForItem({kind:'shield',model:id}),icon:LudusProduction.photo(LudusProduction.skuForItem({kind:'shield',model:id})),calls:__rpcCalls.filter(r=>r.name==='ludus_equip_item').length};},row.id);
   assert.equal(stats.model,row.id);assert.equal(stats.visible,true);assert.equal(stats.recipe,row.sku);assert.equal(stats.icon,'assets/items-v198/'+row.sku+'.webp');await page.screenshot({path:path.join(out,row.id+'.png')});
  }
  console.log('V198 '+(safari?'WebKit':'Chromium')+': all six shields equipped by touch and rendered in the courtyard.');
  await page.close();
  // Test each phone viewport from a clean opening, without resizing a live WebGL courtyard.
  for(const [width,height]of [[874,402],[667,375],[568,320]]){await openCourtyard(width,height);
   await page.evaluate(()=>{const v=LudusPreview;if(!v.exploring)v.toggleExplore();v.enterRoom(v.rooms.find(r=>r.kind==='upgrades'));const s=v.supplySystem;s.enter('forge');return s.open();});await page.locator('#supplyCraftFilter').selectOption('shield');
   for(const row of rows){console.log('V198 recipe check',safari?'WebKit':'Chromium',width,height,row.sku);await page.locator('#supplyCraftSubcategory').selectOption(row.group);await tap(page.locator('[data-recipe="'+row.sku+'"]'));assert.ok((await page.locator('.supply-craft-detail').innerText()).includes(row.label));assert.match(await page.locator('.supply-output').innerText(),/Çıktı: 1/);assert.ok(await page.locator('[data-craft="'+row.sku+'"]').isEnabled());
    await page.waitForFunction(()=>{const es=[...document.querySelectorAll('.supply-craft-detail img')];return es.length>0&&es.every(e=>e.complete&&e.naturalWidth>0);},null,{timeout:20000,polling:100});
    const image=await page.locator('.supply-craft-detail img').evaluateAll(es=>es.map(e=>({src:e.getAttribute('src'),width:e.naturalWidth})));assert.ok(image.some(i=>i.src==='assets/items-v198/'+row.sku+'.webp'&&i.width===320));
    // Stock refresh replaces the detail node; measure the current visible node atomically.
    try{await page.waitForFunction(({label,width,height})=>{const e=document.querySelector('.supply-craft-detail');if(!e||!e.innerText.includes(label))return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1;},{label:row.label,width,height},{timeout:15000,polling:100});}catch(error){console.error('Recipe layout state',await page.evaluate(()=>({viewport:[innerWidth,innerHeight],hidden:document.getElementById('supplyModal')?.hidden,details:[...document.querySelectorAll('.supply-craft-detail')].map(e=>({text:e.innerText,box:e.getBoundingClientRect().toJSON(),display:getComputedStyle(e).display}))})));throw error;}
    await page.screenshot({path:path.join(out,row.sku+'-'+width+'.png'),timeout:30000});}console.log('V198 '+(safari?'WebKit':'Chromium')+': six recipe layouts fit '+width+'x'+height);await page.close();}
  assert.deepEqual(errors,[]);console.log('V198 '+(safari?'WebKit':'Chromium')+' PASS: saved shield on courtyard entry, all six selected through equipment UI, exact live models/icons and mobile recipe categories.');
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
