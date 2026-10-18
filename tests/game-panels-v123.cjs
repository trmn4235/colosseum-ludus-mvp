// Exercises the real room dialogs under the complete page theme, with fixture RPCs only.
const assert=require('node:assert/strict');
module.exports=async({page,fit,out})=>{
 const panels=[
  {name:'settings',open:()=>page.evaluate(()=>LudusPreview.viewSettings.open()),close:()=>page.evaluate(()=>LudusPreview.viewSettings.dialog.close()),root:'.ludus-view-settings',frame:'.ludus-view-settings',heading:'.settings-heading'},
  {name:'guide',open:()=>page.evaluate(()=>{LudusPreview.leaveRoom();return LudusPreview.beginnerGuide.open();}),close:()=>page.evaluate(()=>LudusPreview.beginnerGuide.close()),root:'#beginnerGuide',frame:'.fq-shell',heading:'.fq-top'},
  {name:'training',open:()=>page.evaluate(()=>LudusPreview.showGladiator(LudusPreview.roster[0])),close:()=>page.evaluate(()=>LudusPreview.exercisePanel.close()),root:'#orders',frame:'.exercise-panel',heading:'.exercise-top'},
  {name:'missions',open:()=>page.evaluate(()=>LudusPreview.imperial.open()),close:()=>page.evaluate(()=>LudusPreview.imperial.close()),root:'.imperial-modal',frame:'.imperial-paper',heading:'.imperial-head'},
  {name:'pantry',open:()=>page.evaluate(()=>{const p=LudusPreview;p.enterRoom(p.rooms.find(r=>r.kind==='dining'));return p.foodSystem.open();}),close:()=>page.evaluate(()=>LudusPreview.foodSystem.close()),root:'#foodModal',frame:'.food-frame',heading:'.food-top'},
  {name:'clan-vault',open:()=>page.evaluate(()=>LudusPreview.clanVault.open()),close:()=>page.evaluate(()=>LudusPreview.clanVault.close()),root:'.clan-vault-modal',frame:'.clan-vault-frame',heading:'.clan-vault-top'},
  {name:'messages',open:()=>page.locator('#messagesOpen').click(),close:()=>page.evaluate(()=>document.getElementById('ludusMessages').close()),root:'#ludusMessages',frame:'#ludusMessages',heading:'.mc-head'}
 ];
 for(const [width,height]of [[1536,706],[932,430],[844,390],[768,353],[667,375]]){
  await page.setViewportSize({width,height});
  for(const panel of panels){
   await panel.open();await page.waitForSelector(panel.root+':visible');
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await fit(panel.frame);
   const wineArea=await page.locator(panel.frame).evaluate(root=>{const r=root.getBoundingClientRect();return Math.max(0,...[root,...root.querySelectorAll('*')].filter(e=>e.getClientRects().length).map(e=>{const c=getComputedStyle(e).backgroundColor.match(/[\d.]+/g)?.map(Number)||[0,0,0,0],b=e.getBoundingClientRect();return(c[3]??1)>.5&&c[0]>c[1]*1.5&&c[0]>c[2]*1.2?b.width*b.height/(r.width*r.height):0}));});assert.ok(wineArea<.15,panel.name+' uses burgundy as an accent, not a large surface');
   assert.equal(await page.locator(panel.heading).first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)',panel.name+' light heading');
   assert.match(await page.locator(panel.root+' h1,'+panel.root+' h2').first().evaluate(e=>getComputedStyle(e).fontFamily),/Inter/,panel.name+' common digital typography');
   if(width===1536||width===844)await page.screenshot({path:out+'/modern-'+panel.name+'-'+width+'.png'});
   await panel.close();await page.waitForSelector(panel.root+':visible',{state:'hidden'});await page.waitForFunction(()=>!LudusPreview.paused);
  }
 }
 console.log('V123 shared panels PASS: settings, guide, training, missions, pantry, clan vault and messages use common light headers and digital typography at 5 screen sizes.');
};
