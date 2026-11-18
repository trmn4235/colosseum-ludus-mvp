const assert=require('node:assert/strict');
module.exports=async function verifyChestLearning(page,screenshot){
 await page.evaluate(async()=>{
  const owner=profile.state.user_id,roles=LudusSpecialPeople.roles,unique={role:'guard',lesson:null,unique_id:'guard-first',title:'Muhafızın Son Vasiyeti',rarity:'unique',finder:'Ludus Tırman',found_at:'2026-11-17T23:30:00Z',read_at:null,effects:[{key:'defense',label:'Kervan savunması saldırı bonusu',percent:.3}]};
  const attempts=window.readAttempts=[],standard=Array.from({length:130},(_,i)=>({role:'guard',lesson:i+1,title:'Savunma papirüsü '+(i+1),rarity:'common',read_at:'2026-11-18T00:00:00Z',effects:[{key:'defense',label:'Kervan savunması saldırı bonusu',percent:.01}]}));
  const other={role:'cook',lesson:1,title:'Aşçı papirüsü',rarity:'common',read_at:null,effects:[]};
  staffFixtureClient.rpc=async(name,args)=>{
   if(name==='ludus_special_staff_read_unique'){
    attempts.push(args);if(attempts.length===1){unique.read_at='2026-11-18T07:00:00Z';throw Error('Bağlantı kesildi.');}
    if(args.p_request!==attempts[0].p_request)throw Error('İkinci işlem kimliği oluşturuldu.');
   }
   const bonuses=[{key:'defense',label:'Kervan savunması saldırı bonusu',percent:unique.read_at ? .42 : .12}];
   if(name==='ludus_special_staff_archive'){
    const all=args.p_role==='guard'?(args.p_unique?(unique.read_at?[unique]:[]):standard):[],p=Math.min(args.p_page,Math.max(0,Math.ceil(all.length/6)-1));
    return {data:{user_id:owner,role:args.p_role,page:p,unique:args.p_unique,paper_count:all.length,papyri:structuredClone(all.slice(p*6,p*6+6))}};
   }
   if(name==='ludus_personal_vault'){
    let all=[{type:'money',key:'money',name:'Denarius',quantity:12345},{type:'resource',key:'iron',sku:'iron_ore',name:'Demir cevheri',quantity:23,stage:'raw'},...(!unique.read_at?[unique]:[]).concat([other]).map(p=>({...p,type:'papyrus',key:p.unique_id||p.role+':'+p.lesson,name:p.title,quantity:1,role_name:p.role==='guard'?'Marcus':'Gaius',bonuses}))];
    if(args.p_category!=='all')all=all.filter(x=>x.type===args.p_category);if(args.p_role)all=all.filter(x=>x.role===args.p_role);
    return {data:{user_id:owner,gold:12345,page:0,total:all.length,category:args.p_category,role:args.p_role,counts:{papyrus:unique.read_at?1:2},rows:structuredClone(all)}};
   }
   return {data:{user_id:owner,role:args.p_role||'guard',page:0,paper_count:131,papyri:[],staff:roles.map(r=>({...r,total:500,collected:r.id==='guard'?130:1,read:r.id==='guard'?130:0,overall:r.id==='guard'?26:0,unique_collected:r.id==='guard'?1:0,unique_read:r.id==='guard'&&unique.read_at?1:0,readable:r.id==='guard'&&!unique.read_at?1:0,bonuses:r.id==='guard'?bonuses:[]}))}};
  };
  profile.close();window.vault=LudusPersonalVault.create({ready:Promise.resolve({user_id:owner}),client:staffFixtureClient,staff:profile});await vault.open('papyrus');
 });
 await page.getByText('2 okunmamış papirüs',{exact:true}).waitFor();
 if(screenshot)await page.screenshot({path:screenshot+'-chest.png'});
 await page.getByRole('button',{name:'Tümü',exact:true}).click();await page.getByText('4 kayıt',{exact:true}).waitFor();assert.equal(await page.locator('.personal-vault-card[data-type=resource]').count(),1);
 await page.getByRole('button',{name:'Papirüsler',exact:true}).click();await page.getByText('2 okunmamış papirüs',{exact:true}).waitFor();
 await page.locator('.personal-vault-card[data-key="guard-first"]').click();
 let dialog=page.getByRole('dialog',{name:'Muhafızın Son Vasiyeti',exact:true});await dialog.waitFor();
 if(screenshot)await page.screenshot({path:screenshot+'-before-read.png'});
 assert.match(await dialog.locator('.vault-bonus-preview').innerText(),/\+%0,12 → \+%0,42/);
 assert.match(await dialog.innerText(),/Ludus Tırman · 18\.11\.2026/);
 assert.ok(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1&&d.scrollHeight<=d.clientHeight+1));
 await dialog.getByRole('button',{name:'Papirüsü okut'}).click();await page.getByText('Bağlantı kesildi.',{exact:true}).waitFor();
 assert.equal(await page.locator('.personal-vault-card[data-key="guard-first"]').count(),1,'no optimistic removal before acknowledgement');
 await page.getByRole('button',{name:'Kasayı kapat'}).click();await page.evaluate(()=>vault.open('papyrus'));
 await page.getByRole('button',{name:'Yeniden dene'}).click();await page.getByText('Okuma doğrulandı; papirüs çalışanın arşivinde.').waitFor();
 assert.equal(await page.locator('.personal-vault-card[data-key="guard-first"]').count(),0);
 assert.equal(await page.locator('.personal-vault-balance').innerText(),'12.345 denarius');
 await page.locator('.personal-vault-card').click();dialog=page.getByRole('dialog',{name:'Aşçı papirüsü',exact:true});assert.equal(await dialog.getByRole('button',{name:'Henüz okunamaz'}).isDisabled(),true);await dialog.getByRole('button',{name:'Kapat',exact:true}).click();
 for(const theme of ['blue','black','white']){
  await page.evaluate(t=>document.documentElement.dataset.uiTheme=t,theme);
  const bad=await page.evaluate(()=>[...document.querySelectorAll('#personalVaultModal,.personal-vault-header,.personal-vault-tabs,.personal-vault-grid,.personal-vault-card,.personal-vault-footer')].filter(e=>{const r=e.getBoundingClientRect();return e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2||r.left<0||r.top<0||r.right>innerWidth+1||r.bottom>innerHeight+1;}).map(e=>e.className));assert.deepEqual(bad,[],theme);
 }
 await page.evaluate(()=>{vault.close();profile.open('guard');});await page.waitForFunction(()=>profile.state?.staff.find(r=>r.id==='guard').unique_read===1);
 assert.equal(await page.locator('.staff-collection strong').innerText(),'130 / 500');assert.equal(await page.locator('.staff-overall strong').innerText(),'26');assert.equal(await page.locator('.staff-bonus strong').innerText(),'+%0,42');
 await page.getByRole('button',{name:'Okunan papirüsleri göster'}).click();await page.waitForFunction(()=>profile.archive?.paper_count===130);assert.equal(await page.locator('.staff-paper').count(),6);
 for(let i=0;i<21;i++){await page.getByRole('button',{name:'Sonraki papirüsler'}).click();await page.waitForFunction(n=>profile.archive?.page===n,i+1);}
 assert.equal(await page.locator('.staff-paper').count(),4);assert.equal(await page.locator('.staff-paper[data-lesson="130"]').count(),1);
 await page.getByRole('button',{name:'Okunan eşsiz papirüsleri göster'}).click();await page.waitForFunction(()=>profile.archive?.unique===true&&profile.archive?.paper_count===1);
 await page.getByRole('button',{name:'Muhafızın Son Vasiyeti ayrıntıları'}).click();dialog=page.getByRole('dialog',{name:'Muhafızın Son Vasiyeti',exact:true});assert.match(await dialog.innerText(),/Öğrenildi: 18\.11\.2026/);await dialog.getByRole('button',{name:'Kapat',exact:true}).click();
 const attempts=await page.evaluate(()=>readAttempts);assert.equal(attempts.length,2);assert.equal(attempts[0].p_unique_id,'guard-first');assert.equal(attempts[0].p_request,attempts[1].p_request);
 await page.evaluate(()=>{profile.close();history.replaceState(null,'','?staff=guard&keep=yes');profile.openFromLink();});await page.waitForFunction(()=>profile.state?.role==='guard');
 assert.equal(await page.evaluate(()=>new URL(location.href).searchParams.get('staff')),null);assert.equal(await page.evaluate(()=>new URL(location.href).searchParams.get('keep')),'yes');
 await page.getByRole('button',{name:'Çalışan listesine dön'}).click();assert.equal(await page.getByText('1 papirüs okunabilir',{exact:true}).count(),0);
};
