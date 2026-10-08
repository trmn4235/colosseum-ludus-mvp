const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/gladiator-v46';
const html=fs.readFileSync(root+'/ludus.html','utf8'),styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
(async()=>{
 fs.mkdirSync(out,{recursive:true});let checked=0;
 for(const engine of(process.env.LUDUS_TEST_ENGINES||'chromium,webkit').split(',')){
  const browser=await(engine==='webkit'?webkit.launch({headless:true}):chromium.launch({headless:true,executablePath:'/tmp/chromium',args:['--no-sandbox']}));const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://ludus.test/**',r=>{const file=path.join(root,new URL(r.request().url()).pathname);return fs.existsSync(file)?r.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.webp')?'image/webp':'text/javascript'}):r.fulfill({status:404});});await page.goto('https://ludus.test/blank');
  await page.setContent('<style>'+styles+'\n'+fs.readFileSync(root+'/gladiator-exercise-v46.css','utf8')+'</style><section id="orders" hidden></section>');await page.addScriptTag({path:root+'/gladiator-exercise-v46.js'});
  await page.evaluate(()=>{
   window.glads=Object.keys(LudusExercise.profiles).map((type,i)=>({name:'Gladyatör '+(i+1),type,record:{id:'g'+i,class:type,status:'available',overall:50,stat_version:46,base_stats:LudusExercise.profile(type),exercise_units:0,exercise_completed:false,fatigue_value:0,fatigue_rest_from:new Date().toISOString()}}));window.calls=[];
   window.controller=LudusExercise.create({roster:()=>glads,loaded:()=>true,className:g=>g.type,refresh:async()=>{},apply:data=>{for(const row of data.gladiators)glads.find(g=>g.record.id===row.id).record=row;},client:{rpc:async(name,args)=>{calls.push({name,args});return{data:{gladiators:glads.filter(g=>args.p_gladiators.includes(g.record.id)).map(g=>({...g.record,status:'training',trained_today:true}))}};}}});
  });
  for(const [width,height]of[[1536,706],[844,390],[667,375],[640,320],[1024,768]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>controller.open(glads[0]));await page.locator('.exercise-portrait').evaluate(i=>i.decode());
   assert.equal(await page.locator('.exercise-attribute').count(),7);assert.equal(await page.locator('.exercise-overall strong').textContent(),'50');assert.equal(await page.locator('.exercise-meter.daily [role=progressbar]').getAttribute('aria-valuenow'),'0');
   const geometry=await page.evaluate(()=>{const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right};};return{panel:rect(document.querySelector('.exercise-panel')),header:rect(document.querySelector('.exercise-header')),bars:rect(document.querySelector('.exercise-bars')),stats:rect(document.querySelector('.exercise-attributes')),scrollWidth:document.querySelector('.exercise-panel').scrollWidth,clientWidth:document.querySelector('.exercise-panel').clientWidth};});
   assert.ok(geometry.panel.left>=0&&geometry.panel.right<=width+1);assert.ok(geometry.panel.top>=0&&geometry.panel.bottom<=height+1);assert.ok(geometry.header.bottom-geometry.header.top>50);assert.ok(geometry.header.bottom<=geometry.bars.top);assert.ok(geometry.bars.bottom<=geometry.stats.top);assert.equal(geometry.scrollWidth,geometry.clientWidth);
   await page.screenshot({path:out+'/gladiator-v46-'+engine+'-'+width+'.png'});checked++;
   await page.getByRole('button',{name:'Kas gücü',exact:false}).first().click();assert.equal(await page.getByRole('button',{name:'Kas gücü',exact:false}).first().getAttribute('aria-pressed'),'true');
   await page.getByRole('button',{name:'Toplu antrenman',exact:true}).click();assert.equal(await page.locator('.exercise-bulk input:checked').count(),7);await page.locator('.exercise-bulk input').first().uncheck();assert.equal(await page.locator('.exercise-bulk input:checked').count(),6);await page.getByRole('button',{name:'Tek gladyatöre dön',exact:true}).click();
  }
  await page.evaluate(()=>{glads[0].record.fatigue_value=71;glads[0].record.fatigue_rest_from=new Date(Date.now()+3600000).toISOString();controller.open(glads[0]);});assert.ok((await page.locator('.exercise-meter.energy small').textContent()).includes('%25 sakatlık'));assert.equal(await page.locator('.exercise-meter.danger').count(),1);
  await page.getByRole('button',{name:'Kas gücü çalış',exact:true}).click();await page.waitForFunction(()=>calls.length===1);assert.equal(await page.evaluate(()=>calls[0].args.p_stat),'muscle');assert.deepEqual(await page.evaluate(()=>calls[0].args.p_gladiators),['g0']);
  await page.evaluate(()=>{glads[1].record.exercise_units=3;glads[1].record.exercise_completed=true;controller.open(glads[1]);});assert.equal(await page.locator('.exercise-primary').first().isDisabled(),true);assert.equal(await page.locator('.exercise-meter.daily [role=progressbar]').getAttribute('aria-valuenow'),'100');
  await page.evaluate(()=>{glads[2].record.status='injured';glads[2].record.injured_until=new Date(Date.now()+43200000).toISOString();glads[2].record.overall=45;controller.open(glads[2]);});assert.equal(await page.locator('.exercise-overall strong').textContent(),'45');assert.equal(await page.locator('.exercise-primary').first().isDisabled(),true);assert.ok((await page.locator('#ordersText').textContent()).includes('Sakat'));
  await page.getByRole('button',{name:'Kapat',exact:true}).click();assert.equal(await page.locator('#orders').isHidden(),true);assert.deepEqual(errors,[]);await browser.close();
 }
 console.log(JSON.stringify({viewports:checked,photoBesideOverall:true,barsAboveSevenStats:true,targetedAndBulkActions:true,fatigueWarning:true,dailyCap:true,injuryState:true,pageErrors:0}));
})().catch(e=>{console.error(e);process.exit(1);});
