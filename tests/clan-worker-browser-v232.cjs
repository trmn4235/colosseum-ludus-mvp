const assert=require('node:assert/strict');
module.exports=async({page,fit})=>{
 const touch=async locator=>{const r=await locator.boundingBox();assert.ok(r&&r.height>0&&await locator.isEnabled());await page.mouse.click(r.x+r.width/2,r.y+r.height/2);};
 await page.goto('https://workers.test/clan');
 await page.getByRole('button',{name:'Klan Çalışmaları',exact:true}).click();
 await page.getByText('Haftalık Ludus sıralaması').waitFor();
 for(const [width,height] of [[874,402],[667,375],[568,320]]){
  await page.setViewportSize({width,height});
  await fit('.clan-work-shell');await fit('.clan-work-top');await fit('.clan-work-heading');await fit('.clan-work-row');
 }
 assert.equal(await page.locator('.clan-work-row').count(),4);
 await page.getByRole('button',{name:'Sonraki sayfa'}).click();assert.match(await page.locator('.clan-work-pages').innerText(),/2 \/ 2/);
 await page.getByRole('button',{name:'İşçi katkısı'}).click();assert.match(await page.locator('.clan-work-row').first().innerText(),/İşçi/);
 await page.getByRole('button',{name:'Klan deposu'}).click();assert.equal(await page.locator('.clan-work-stock-card').count(),9);await fit('.clan-work-stock');
 await page.getByRole('button',{name:'Ödüller'}).click();assert.match(await page.locator('.clan-work-row').first().innerText(),/0,50/);
 await page.getByRole('button',{name:'Ekip kur'}).click();assert.match(await page.locator('.clan-work-note').innerText(),/Deneme/);
 assert.ok(await page.locator('.clan-work-choice').nth(1).isDisabled(),'underlevel worker cannot be picked');
 assert.ok(await page.locator('.clan-work-choice').nth(2).isDisabled(),'worker already on a task cannot be picked');
 await fit('.clan-work-choice');
 console.log('V232 team layout',JSON.stringify(await page.locator('.clan-work-choice').first().evaluate(n=>{const r=n.getBoundingClientRect(),p=n.parentElement.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y,parentHeight:p.height,disabled:n.disabled,visibility:getComputedStyle(n).visibility,display:getComputedStyle(n).display};})));
 const choice=page.locator('.clan-work-choice').first(),rect=await choice.boundingBox();assert.ok(rect&&rect.height>0);await page.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);assert.equal(await choice.getAttribute('aria-pressed'),'true','a real pointer selects the worker');await touch(page.getByRole('button',{name:'Çalışmayı başlat'}));
 await page.getByText('Çalışma başlatıldı.').waitFor();assert.equal(await page.evaluate(()=>__workActions.filter(x=>x.action==='start').length),1);
 await touch(page.getByRole('button',{name:'Ayarlar',exact:true}));await page.locator('.clan-work-config input').first().fill('120');await touch(page.getByRole('button',{name:'Deneme ayarlarını kaydet'}));
 await page.getByText('Deneme ayarları kaydedildi.').waitFor();assert.equal(await page.evaluate(()=>__workActions.at(-1).payload.duration_minutes),120);
 await fit('.clan-work-shell');
 console.log('V232 browser PASS: paged rankings, worker contribution, storage, exact rewards, eligible team selection and admin test settings.');
};
