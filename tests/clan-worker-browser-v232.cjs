const assert=require('node:assert/strict');
module.exports=async({page,fit,out})=>{
 const touch=async locator=>{const r=await locator.boundingBox();assert.ok(r&&r.height>0&&await locator.isEnabled());assert.ok(await locator.evaluate(n=>{const b=n.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return hit===n||n.contains(hit);}), 'the control receives the real pointer');await page.mouse.click(r.x+r.width/2,r.y+r.height/2);};
 await page.goto('https://workers.test/clan');
 await touch(page.getByRole('button',{name:'Klan Çalışmaları',exact:true}));
 await page.locator('.clan-work-heading').filter({hasText:'Haftalık toplanan'}).waitFor();
 for(const [width,height] of [[874,402],[667,375],[568,320],[390,844]]){
  await page.setViewportSize({width,height});
  await fit('.clan-work-shell');await fit('.clan-work-top');await fit('.clan-work-heading');await fit('.clan-work-row');
  await page.screenshot({path:out+'/licensed-weekly-'+width+'.png'});
 }
 await page.setViewportSize({width:568,height:320});
 assert.equal(await page.locator('.clan-work-row').count(),4);
 assert.match(await page.locator('.clan-work-note').innerText(),/Alışveriş dahil değil/);
 await touch(page.getByRole('button',{name:'Sonraki sayfa'}));assert.match(await page.locator('.clan-work-pages').innerText(),/2 \/ 2/);
 await touch(page.getByRole('button',{name:'İşçi üretimi'}));assert.match(await page.locator('.clan-work-row').first().innerText(),/İşçi/);
 await touch(page.getByRole('button',{name:'Depom',exact:true}));
 assert.equal(await page.locator('.clan-work-stock-card').count(),16);await page.getByText('80 birim teslimat bekliyor').waitFor();
 for(const [width,height] of [[1536,706],[874,402],[667,375],[568,320],[390,844]]){
  await page.setViewportSize({width,height});await fit('.clan-work-stock');await fit('.clan-work-stock-card');
  await page.waitForFunction(()=>[...document.querySelectorAll('.clan-work-stock-image')].every(e=>e.complete&&e.naturalWidth>0));
  const stock=await page.locator('.clan-work-stock-card').evaluateAll(cards=>{
   const boxes=cards.map(c=>c.getBoundingClientRect());return {
    columns:boxes.filter(b=>Math.abs(b.top-boxes[0].top)<1).length,
    ordered:cards.every(c=>{const [image,name,amount]=[...c.children].slice(0,3).map(e=>e.getBoundingClientRect());return image.right<=name.left+1&&name.right<=amount.left+1;}),
    namesVisible:cards.every(c=>{const e=c.querySelector('.clan-work-stock-name');return e.scrollHeight<=e.clientHeight+1;}),
    amounts:cards.map(c=>c.querySelector('.clan-work-stock-quantity').textContent)
   };
  });
  assert.equal(stock.columns,4,width+' four products per row');assert.equal(stock.ordered,true,width+' image, name, amount order');assert.equal(stock.namesVisible,true,width+' names fit');assert.equal(stock.amounts[0],'528 birim');
  assert.equal(await page.locator('.clan-work-pages').count(),0,'all 16 products fit on one page');
  await page.screenshot({path:out+'/personal-stock-'+width+'.png'});
 }
 await page.setViewportSize({width:568,height:320});
 await touch(page.getByRole('button',{name:'Ödüller'}));assert.match(await page.locator('.clan-work-row').first().innerText(),/0,50/);
 await touch(page.getByRole('button',{name:'Lisanslar',exact:true}));await touch(page.locator('.clan-work-row').first());assert.match(await page.locator('.clan-work-row').first().innerText(),/50 \/ 10 \/ 40/);await fit('.clan-work-heading');await fit('.clan-work-row');
 await touch(page.getByRole('button',{name:'Ekip kur'}));assert.match(await page.locator('.clan-work-note').first().innerText(),/6 saat.*%20/);
 const start=page.getByRole('button',{name:'Lisansı başlat',exact:true});assert.ok(await start.isDisabled());
 assert.ok(await page.locator('.clan-work-choice').nth(1).isDisabled(),'underlevel worker cannot be picked');
 assert.ok(await page.locator('.clan-work-choice').nth(2).isDisabled(),'worker already on a task cannot be picked');
 for(const id of ['worker-0','worker-3'])await touch(page.locator('[data-worker-id="'+id+'"]'));
 await touch(page.getByRole('button',{name:'Sonraki sayfa'}));
 for(const id of ['worker-4','worker-5'])await touch(page.locator('[data-worker-id="'+id+'"]'));
 assert.ok(await start.isDisabled(),'four is insufficient');await touch(page.locator('[data-worker-id="worker-6"]'));
 assert.ok(await start.isEnabled());assert.ok(await page.locator('[data-worker-id="worker-7"]').isDisabled(),'a sixth worker cannot be added');
 assert.match(await page.locator('.clan-work-estimate').innerText(),/115 brüt.*23 devlet.*92 Luduslara/);
 for(const [width,height] of [[874,402],[667,375],[568,320],[390,844]]){await page.setViewportSize({width,height});await fit('.clan-work-shell');await fit('.clan-work-select');await fit('.clan-work-choice');await fit('.clan-work-estimate');await page.screenshot({path:out+'/licensed-team-'+width+'.png'});}
 await touch(start);await page.getByText('5 işçi için 6 saatlik lisans başladı.').waitFor();assert.equal(await page.evaluate(()=>__workActions.filter(x=>x.action==='start').length),1);assert.equal(await page.evaluate(()=>__workActions[0].payload.workers.length),5);
 assert.equal(await page.getByRole('button',{name:'Ayarlar',exact:true}).count(),0,'fixed license rules cannot be changed in this panel');
 await touch(page.getByRole('button',{name:'İşçilerim',exact:true}));await fit('.worker-card');await fit('.worker-card .workers-portrait');assert.ok(await page.locator('.worker-card').evaluateAll(cards=>cards.every(card=>{const a=card.getBoundingClientRect(),p=card.querySelector('.workers-portrait').getBoundingClientRect();return p.left>=a.left&&p.right<=a.right&&p.top>=a.top&&p.bottom<=a.bottom;})),'portrait stays inside its own card');await touch(page.locator('.worker-card').first());await page.locator('.worker-profile').waitFor();
 for(const [width,height] of [[874,402],[568,320],[390,844]]){await page.setViewportSize({width,height});await fit('.worker-profile');await fit('.worker-skills');await fit('.worker-skill-pages');}
 assert.equal(await page.locator('.worker-skill').count(),6);await touch(page.getByRole('button',{name:'Sonraki meslekler'}));assert.equal(await page.locator('.worker-skill').count(),6);assert.equal(await page.locator('[data-profession=fish]').count(),1);await fit('.worker-skills');for(const [width,height] of [[874,402],[568,320],[390,844]]){await page.setViewportSize({width,height});await fit('.worker-skill');await fit('.worker-skill-heading');await page.screenshot({path:out+'/food-professions-'+width+'.png'});}
 await touch(page.getByRole('button',{name:'Sonraki meslekler'}));assert.equal(await page.locator('.worker-skill').count(),4);assert.equal(await page.locator('[data-profession=olive_oil]').count(),1);assert.ok(await page.getByRole('button',{name:'Sonraki meslekler'}).isDisabled());
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ludus-work-license',{detail:{sku:'fish'}})));await page.getByLabel('Lisans ürünü').waitFor();assert.equal(await page.getByLabel('Lisans ürünü').inputValue(),'fish');
 console.log('V255 browser PASS: paged net rankings, personal/pending stock, per-worker tax, exact five-person selection, fixed six-hour license, 16 paged professions and source-to-license navigation at four sizes.');
};
