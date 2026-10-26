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
 try{const page=await browser.newPage({viewport:{width:874,height:402},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https:/,r=>r.abort());await page.goto('http://127.0.0.1:'+server.address().port+'/ludus.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.LudusPreview?.roster?.[0]?.model?.gear,null,{timeout:90000});
  // WebKit can expose the first rig before the rest of the courtyard finishes loading.
  await page.evaluate(async()=>{await LudusPreview.accountReady;await LudusPreview.residentsReady;});
  await page.locator('#loading').waitFor({state:'hidden',timeout:90000});await page.bringToFront();
  assert.equal(await page.evaluate(()=>LudusPreview.roster[0].state.shieldStyle),'shield_viridis');
  for(const row of rows){
   await page.evaluate(()=>LudusPreview.exercisePanel.open(LudusPreview.roster[0],{slot:'off_hand'}));
   if(!await page.locator('[data-item="'+row.id+'"]').count())await page.getByRole('button',{name:'Sonraki eşya sayfası',exact:true}).click();
   const choice=page.locator('[data-item="'+row.id+'"]');
   try{await choice.click();}catch(error){console.error('Shield picker state',await choice.evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),disabled:e.disabled,visibility:getComputedStyle(e).visibility,ordersHidden:document.getElementById('orders').hidden,loadingHidden:document.getElementById('loading').hidden})),errors);throw error;}
   await page.waitForFunction(id=>LudusPreview.roster[0].state.shieldStyle===id,row.id);
   const stats=await page.evaluate(async id=>{const v=LudusPreview,g=v.roster[0],m=g.model;await LudusEquipmentCatalog.load(THREE,id);v.exercisePanel.close();v.roster.forEach(r=>{r.body.visible=r===g});Object.assign(g.state,{x:0,z:0,angle:0,action:'idle',blocking:false,hp:100});for(let i=0;i<16;i++)ImportedGladiator.animate(g.state,m,i/60,1/60);v.camera.position.set(1.6,1.65,3.3);v.camera.lookAt(.1,1,0);v.renderer.render(v.scene,v.camera);return{model:m.gear.shield.group.userData.catalogId,visible:m.gear.shield.group.visible,recipe:LudusProduction.skuForItem({kind:'shield',model:id}),icon:LudusProduction.photo(LudusProduction.skuForItem({kind:'shield',model:id})),calls:__rpcCalls.filter(r=>r.name==='ludus_equip_item').length};},row.id);
   assert.equal(stats.model,row.id);assert.equal(stats.visible,true);assert.equal(stats.recipe,row.sku);assert.equal(stats.icon,'assets/items-v198/'+row.sku+'.webp');await page.screenshot({path:path.join(out,row.id+'.png')});
  }
  await page.evaluate(()=>{const v=LudusPreview;if(!v.exploring)v.toggleExplore();v.enterRoom(v.rooms.find(r=>r.kind==='upgrades'));const s=v.supplySystem;s.enter('forge');return s.open();});await page.locator('#supplyCraftFilter').selectOption('shield');
  for(const [width,height]of [[874,402],[667,375],[568,320]]){await page.setViewportSize({width,height});for(const row of rows){await page.locator('#supplyCraftSubcategory').selectOption(row.group);await page.locator('[data-recipe="'+row.sku+'"]').click();assert.ok((await page.locator('.supply-craft-detail').innerText()).includes(row.label));assert.match(await page.locator('.supply-output').innerText(),/Çıktı: 1/);assert.ok(await page.locator('[data-craft="'+row.sku+'"]').isEnabled());
    const image=await page.locator('.supply-craft-detail img').evaluateAll(es=>Promise.all(es.map(async e=>{await e.decode();return{src:e.getAttribute('src'),width:e.naturalWidth};})));assert.ok(image.some(i=>i.src==='assets/items-v198/'+row.sku+'.webp'&&i.width===320));
    const box=await page.locator('.supply-craft-detail').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1);await page.screenshot({path:path.join(out,row.sku+'-'+width+'.png')});}}
  assert.deepEqual(errors,[]);console.log('V198 '+(safari?'WebKit':'Chromium')+' PASS: saved shield on courtyard entry, all six selected through equipment UI, exact live models/icons and mobile recipe categories.');
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
