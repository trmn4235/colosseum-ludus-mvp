const assert=require('node:assert/strict');

module.exports=async function verifyUniqueLearning(page){
  await page.evaluate(async()=>{
    const unique = {lesson:null,unique_id:'guard-first',title:'Muhafızın Son Vasiyeti',rarity:'unique',
      finder:'Ludus Tırman',found_at:'2026-11-17T23:30:00Z',read_at:null,
      effects:[{key:'caravan_defense_attack',label:'Kervan savunması saldırı bonusu',percent:.3}]};
    const attempts=window.readAttempts=[];
    const base=structuredClone(profile.state);
    const rpc=async(name,args)=>{
      if(name==='ludus_special_staff_read_unique'){
        attempts.push(args);
        if(attempts.length===1){unique.read_at='2026-11-18T07:00:00Z';throw Error('Bağlantı kesildi.');}
        if(args.p_request!==attempts[0].p_request)throw Error('İkinci işlem kimliği oluşturuldu.');
      }
      const state=structuredClone(base),guard=state.staff.find(x=>x.id==='guard');
      Object.assign(guard,{read:0,overall:0,unique_read:unique.read_at?1:0,bonuses:unique.read_at?unique.effects:[]});
      state.papyri[0]=unique;return {data:state,error:null};
    };
    window.staffFixtureClient.rpc=rpc;
    await profile.refresh();
  });
  const card=page.locator('.staff-paper[data-lesson="guard-first"]');
  await card.getByRole('button',{name:'Muhafızın Son Vasiyeti ayrıntıları'}).click();
  const dialog=page.getByRole('dialog',{name:'Muhafızın Son Vasiyeti',exact:true});
  await dialog.waitFor();
  assert.match(await dialog.innerText(),/Kervan savunması saldırı bonusu \+%0,3/);
  assert.match(await dialog.innerText(),/Ludus Tırman · 18\.11\.2026/);
  assert.ok(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1&&d.scrollHeight<=d.clientHeight+1));
  await dialog.getByRole('button',{name:'Papirüsü okut'}).click();
  await page.getByText('Bağlantı kesildi.',{exact:true}).waitFor();
  assert.equal(await page.locator('.staff-bonus').count(),0);
  await page.evaluate(()=>{profile.close();profile.open('guard');});
  await page.getByRole('button',{name:'Yeniden dene'}).click();
  await page.getByText('Eşsiz papirüs öğrenildi. Pasif bonus güncellendi.').waitFor();
  assert.equal(await page.locator('.staff-overall strong').innerText(),'0');
  assert.equal(await page.locator('.staff-bonus strong').innerText(),'+%0,3');
  assert.match(await page.locator('.staff-unique-count').innerText(),/1 · okundu/);
  assert.equal(await card.getByRole('button',{name:'Öğrenildi'}).isDisabled(),true);
  const attempts=await page.evaluate(()=>readAttempts);
  assert.equal(attempts.length,2);assert.equal(attempts[0].p_unique_id,'guard-first');
  assert.equal(attempts[0].p_request,attempts[1].p_request);
};
