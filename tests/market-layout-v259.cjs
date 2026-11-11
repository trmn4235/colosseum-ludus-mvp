// Real UI, local catalogue/account fixtures. No live purchase or clan mutation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright'),root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/v259';fs.mkdirSync(out,{recursive:true});
const categories={weapon:'Silahlar',shield:'Kalkanlar',helmet:'Miğferler',chest:'Göğüs Zırhı',gloves:'Omuzluk',legs:'Bacaklık'};
const catalog=require('../ludus-production-v119.js').recipes.filter(r=>categories[r.kind]).map(r=>({...r,category:categories[r.kind]}));
const food={gold:1109709,items:['grain','apple','fish','meat','beer','egg','bread','olive_oil'].map((sku,i)=>({sku,name:['Tahıl','Elma','Balık','But','Şarap','Yumurta','Ekmek','Zeytinyağı'][i],quantity:20,nutrition:20,daily:2,price:3})),menu:{units:0,daily_need:200,available_units:160}};
const mock=`window.__testClient={auth:{getUser:async()=>({data:{user:{id:'00000000-0000-4000-8000-000000000001'}}})},from:name=>{const data=name==='ludus_accounts'?{gold:1109709}:${JSON.stringify(catalog)};const b={select:()=>b,eq:()=>b,order:()=>b,single:async()=>({data}),then:r=>Promise.resolve({data}).then(r)};return b},rpc:async(name,args)=>{if(args?.p_request)throw Error('Fixture refuses purchases');return {data:${JSON.stringify(food)}}}};`;
let clanTest=fs.readFileSync(__dirname+'/clan-power-v231.cjs','utf8');clanTest=clanTest.slice(clanTest.indexOf('const root='),clanTest.indexOf('(async()=>{\n const browser'));
const context={path,fs,__dirname};vm.createContext(context);vm.runInContext(clanTest+"\nclan.members.forEach((m,i)=>{if(i)m.username='bot_0e8ca0f7_'+String(i).padStart(2,'0')});this.bootstrap='window.__requests=[];window.__client=('+fixtureClient.toString()+')('+JSON.stringify(clan)+','+JSON.stringify(clans)+','+JSON.stringify(players)+','+JSON.stringify(id)+');';",context);
(async()=>{
 const engine=process.env.LUDUS_WEBKIT_TEST?'webkit':'chromium',browser=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']}: {})});
 try{
  const page=await browser.newPage({viewport:{width:874,height:402}}),errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='https://layout.test')return route.abort();const file=path.join(root,decodeURIComponent(u.pathname));if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404});let body=fs.readFileSync(file);if(file.endsWith('pazar.html'))body=Buffer.from(body.toString().replace('<head>','<head><script>'+mock+'</script>').replaceAll(/LudusClient\.create\([^)]*\)/g,'window.__testClient'));if(file.endsWith('market-v56.js'))body=Buffer.from(body.toString().replace(/\(globalThis\.LudusClient\?\.create\|\|supabase\.createClient\)\([^)]*\)/g,'window.__testClient'));if(file.endsWith('klan.html'))body=Buffer.from(body.toString().replace('<head>','<head><script>'+context.bootstrap+'</script>').replaceAll(/LudusClient\.create\([^)]*\)/g,'window.__client'));return route.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream'});});
  await page.goto('https://layout.test/pazar.html');await page.locator('.product').first().waitFor();
  for(const [width,height] of [[1536,706],[874,402],[844,390],[667,375],[568,320]]){
   await page.setViewportSize({width,height});
   for(const category of [...Object.values(categories),'Gıda']){
    await page.locator('#categories button').filter({hasText:category}).click();
    const expected=Math.min(6,category==='Gıda'?food.items.length:catalog.filter(r=>r.category===category).length);assert.equal(await page.locator('.product').count(),expected);
    const fit=await page.evaluate(()=>{
     const cards=[...document.querySelectorAll('.product')],rect=e=>e.getBoundingClientRect();
     return{count:cards.length,columns:getComputedStyle(document.getElementById('products')).gridTemplateColumns.split(' ').length,bodyOverflow:document.documentElement.scrollWidth>innerWidth+1||document.documentElement.scrollHeight>innerHeight+1,
      clipped:cards.flatMap(c=>[...c.querySelectorAll('h2,.basic,.food-detail,.price,.market-quantity,.buy')].filter(e=>e.scrollHeight>e.clientHeight+2||e.scrollWidth>e.clientWidth+2).map(e=>({text:e.textContent,client:[e.clientWidth,e.clientHeight],scroll:[e.scrollWidth,e.scrollHeight]}))),
      minArt:Math.min(...cards.map(c=>rect(c.querySelector('.art')).height)),reachable:cards.every(c=>{const e=c.querySelector('.buy'),b=rect(e),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return b.bottom<=innerHeight&&b.right<=innerWidth&&(hit===e||e.contains(hit));}),intro:document.body.textContent.includes('Başlangıç ekipmanları')};
    });report.push({width,category,...fit});
    await page.screenshot({path:path.join(out,engine+'-'+width+'-'+Object.keys(categories).find(k=>categories[k]===category)+'.png')});
    assert.equal(fit.columns,6);assert.equal(fit.bodyOverflow,false);assert.equal(fit.reachable,true,JSON.stringify(report.at(-1)));assert.equal(fit.intro,false);assert.deepEqual(fit.clipped,[],JSON.stringify(report.at(-1)));assert.ok(fit.minArt>=28,JSON.stringify(report.at(-1)));
   }
  }
  await page.setViewportSize({width:874,height:402});await page.locator('#categories button').filter({hasText:'Silahlar'}).click();
  const first=await page.locator('.product h2').allTextContents();await page.locator('#nextProducts').click();const second=await page.locator('.product h2').allTextContents();assert.equal(second.some(n=>first.includes(n)),false,'pages never repeat items');await page.locator('#previousProducts').click();assert.deepEqual(await page.locator('.product h2').allTextContents(),first);await page.locator('.product .art').first().click();await page.locator('#equipmentInspect').waitFor();await page.locator('#inspectClose').click();
  await page.goto('https://layout.test/klan.html');await page.locator('.homeBanner').waitFor();
  for(const view of ['members','manage']){await page.locator('[data-view="'+view+'"]').click();for(const [width,height] of [[874,402],[568,320]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);
   const fit=await page.locator('.memberList').evaluate(list=>{const rows=[...list.querySelectorAll(':scope>.row,:scope>.permissionRow')];return{count:rows.length,botHandles:/@bot/i.test(list.textContent),centered:rows.slice(1).every(r=>{const a=r.getBoundingClientRect(),b=r.querySelector('strong').getBoundingClientRect();return Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<1.2}),scroll:list.scrollHeight>list.clientHeight+1};});assert.deepEqual(fit,{count:10,botHandles:false,centered:true,scroll:false});await page.screenshot({path:path.join(out,engine+'-clan-'+view+'-'+width+'.png')});
  }}
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/layout-'+engine+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({engine,views:report.length,clanViews:4,paging:true,inspection:true,errors}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
