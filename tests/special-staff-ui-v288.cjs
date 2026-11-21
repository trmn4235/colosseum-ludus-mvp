const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {script}=require('./special-staff-fixture-v288.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'staff-v288-'));
const html=`<!doctype html><html lang="tr" data-ui-theme="white"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="/ui-theme-v275.css"><link rel="stylesheet" href="/special-staff-v288.css"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}button{touch-action:manipulation}</style></head><body><button id="entry">Çalışanlar</button><script src="/special-staff-people-v284.js"></script><script src="/special-staff-v288.js"></script><script>
window.testUser={id:'ui-owner'};window.__testClient={rpc:async(name,args)=>({data:{user_id:testUser.id,role:args.p_role,staff:[],papyri:[],paper_count:0,page:0}})};
${script()}
window.__calculationCalls=[];window.profile=LudusSpecialStaff.create({client:__testClient,ready:Promise.resolve({user_id:testUser.id}),openCalculation:role=>__calculationCalls.push(role)});document.querySelector('#entry').onclick=()=>profile.openDirectory();
</script></body></html>`;
const layoutSelectors='#specialStaffModal,.ss288-header,.ss288-tabs,.ss288-body,.ss288-home,.ss288-home-columns,.ss288-sidebar,.ss288-benefits,.ss288-passive-grid,.ss288-passive-column,.ss288-passive,.ss288-archive,.ss288-archive-controls,.ss288-archive-split,.ss288-paper-list,.ss288-paper-rows,.ss288-paper-row,.ss288-reading,.ss288-reading-actions,.ss288-directory';
async function layout(page,label){
 const bad=await page.evaluate(selectors=>[...document.querySelectorAll(selectors)].filter(node=>node.getClientRects().length).flatMap(node=>{
  const r=node.getBoundingClientRect(),overflow=node.scrollHeight>node.clientHeight+2||node.scrollWidth>node.clientWidth+2;
  return overflow||r.left<-.5||r.top<-.5||r.right>innerWidth+.5||r.bottom>innerHeight+.5?[{class:node.className,width:node.clientWidth,scrollWidth:node.scrollWidth,height:node.clientHeight,scrollHeight:node.scrollHeight,rect:[r.x,r.y,r.width,r.height]}]:[];
 }),layoutSelectors);
 assert.deepEqual(bad,[],label);
}
async function openRole(page,role){await page.evaluate(role=>profile.open(role),role);await page.waitForFunction(role=>profile.state?.role===role&&document.querySelector('#specialStaffModal').getAttribute('aria-busy')==='false',role);}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const safari=!!process.env.LUDUS_WEBKIT_TEST,options={headless:true};
 if(!safari){options.args=['--no-sandbox'];if(process.env.LUDUS_BROWSER_PATH)options.executablePath=process.env.LUDUS_BROWSER_PATH;}
 const browser=await(safari?webkit:chromium).launch(options),context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[],failedResources=[];let page;
 try{
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url()),name=decodeURIComponent(url.pathname);
   if(name==='/'||name==='/ludus.html')return route.fulfill({contentType:'text/html',body:html});
   const file=path.join(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){failedResources.push(name);return route.fulfill({status:404,body:'Not found'});}
   return route.fulfill({path:file,contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.webp')?'image/webp':undefined});
  });
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>failedResources.push(request.url()+': '+request.failure()?.errorText));
  await page.goto('https://staff.test/ludus.html');await page.locator('#entry').click();
  await page.waitForFunction(()=>profile.state?.papyri.length===25);assert.equal(await page.locator('.ss288-person').count(),6);
  await page.waitForFunction(()=>[...document.querySelectorAll('.ss288-person img')].every(img=>img.complete&&img.naturalWidth===300&&img.naturalHeight===400));
  await layout(page,'desktop directory');await page.screenshot({path:path.join(out,'v288-directory.png')});
  const roles=['trainer','cook','doctor','smith','guard','groom'];
  for(const role of roles){
   await openRole(page,role);assert.equal(await page.locator('.ss288-overall strong').innerText(),'20 / 100');assert.equal(await page.locator('.ss288-passive').count(),2);
   assert.equal(await page.locator('.ss288-person').count(),0);assert.equal(await page.locator('#specialStaffModal canvas').count(),0);
   const image=await page.locator('.ss288-portrait img').getAttribute('src');assert.equal(image,'assets/staff-v288/'+role+'.webp');
   assert.equal(await page.locator('.ss288-calculation').count(),role==='smith'?1:0);
  }
  await openRole(page,'smith');await page.getByRole('button',{name:'İşlem hesabı',exact:true}).click();assert.deepEqual(await page.evaluate(()=>__calculationCalls),['smith']);
  await page.locator('.ss288-info').first().click();await page.getByRole('dialog',{name:/Bütün uygun/}).waitFor();assert.match(await page.locator('.ss288-dialog').innerText(),/belirtilen oyun koşulunda/);await page.locator('.ss288-dialog-close').click();
  await page.getByRole('button',{name:'Papirüsler',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Hepsi',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.ss288-paper-row').count(),12);assert(await page.getByText('Sende yok',{exact:true}).count()>0);
  await page.getByRole('button',{name:'Olmayanlar',exact:true}).click();assert.equal(await page.locator('.ss288-paper-status').allTextContents().then(values=>values.every(v=>v==='Sende yok')),true);assert(await page.locator('.ss288-read').isDisabled());
  await page.evaluate(()=>{__papyrusFailOnce=true;return profile.readPaper(profile.state.papyri.find(p=>p.ordinal===3)).catch(()=>{});});
  assert.equal(await page.evaluate(()=>profile.state.papyri.find(p=>p.ordinal===3).learned),false);
  await page.getByRole('button',{name:'Yeniden dene',exact:true}).click();await page.waitForFunction(()=>!profile.pendingRead);
  assert.equal(await page.evaluate(()=>__papyrusReads.length===2&&__papyrusReads[0].p_request===__papyrusReads[1].p_request),true);
  assert.equal(await page.evaluate(()=>profile.state.papyri.find(p=>p.ordinal===3).owned_quantity),1);
  await page.getByRole('button',{name:'Ana sayfa',exact:true}).click();assert.equal(await page.locator('.ss288-passive').count(),3);assert.equal(await page.locator('.ss288-new').count(),1);
  await page.evaluate(()=>__papyrusSetMode('all'));
  for(const viewport of [{width:1440,height:900},{width:874,height:402},{width:852,height:393},{width:390,height:844}]){
   await page.setViewportSize(viewport);
   for(const role of roles){
    await openRole(page,role);assert.equal(await page.locator('.ss288-passive').count(),25);
    assert.deepEqual(await page.locator('.ss288-passive-column').evaluateAll(columns=>columns.map(column=>column.children.length)),[13,12]);
    await layout(page,JSON.stringify({viewport,role,screen:'home'}));
    if(viewport.width===1440||viewport.width===874)await page.screenshot({path:path.join(out,`v288-${viewport.width}-${role}-home.png`)});
    await page.getByRole('button',{name:'Papirüsler',exact:true}).click();
    // Every released paragraph and effect is fitted, not just the shortest example.
    const detailErrors=await page.evaluate(selectors=>{
     const errors=[];
     for(const rarity of ['Yaygın','Nadir','Çok nadir','Eşsiz']){
      [...document.querySelectorAll('.ss288-rarity-tabs button')].find(button=>button.textContent===rarity).click();
      for(let pages=0;pages<5;pages++){
       const ids=[...document.querySelectorAll('.ss288-paper-row')].map(row=>row.dataset.contentId);
       for(const id of ids){
        document.querySelector('.ss288-paper-row[data-content-id="'+id+'"]').click();
        for(const node of document.querySelectorAll(selectors)){
         if(!node.getClientRects().length)continue;
         const r=node.getBoundingClientRect();
         if(node.scrollHeight>node.clientHeight+2||node.scrollWidth>node.clientWidth+2||r.bottom>innerHeight+.5||r.right>innerWidth+.5)errors.push({id,class:node.className,height:node.clientHeight,scrollHeight:node.scrollHeight,width:node.clientWidth,scrollWidth:node.scrollWidth});
        }
       }
       const next=document.querySelector('.ss288-paper-list .ss288-pager button:last-child');if(next.disabled)break;next.click();
      }
     }
     return errors;
    },layoutSelectors);
    assert.deepEqual(detailErrors,[],JSON.stringify({viewport,role,screen:'all archive details'}));
    if(viewport.width===1440||viewport.width===874){await page.getByRole('button',{name:'Yaygın',exact:true}).click();await page.screenshot({path:path.join(out,`v288-${viewport.width}-${role}-archive.png`)});}
   }
  }
  await page.setViewportSize({width:874,height:402});await page.evaluate(()=>__papyrusSetMode('mixed'));
  for(const theme of ['white','blue','black']){
   await page.evaluate(theme=>document.documentElement.dataset.uiTheme=theme,theme);
   for(const role of roles){await openRole(page,role);await layout(page,theme+' mixed '+role);}
  }
  assert.deepEqual(errors,[],'No browser errors');assert.deepEqual(failedResources,[],'No failed UI or portrait resources');
  console.log('V288 staff browser UI passed: 150 full details, six roles, four viewport sizes, three themes, read retry and photographic assets. Screenshots: '+out);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
