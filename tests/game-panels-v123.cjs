// Exercises the real room dialogs under the complete page theme, with fixture RPCs only.
const assert=require('node:assert/strict');
module.exports=async({page,fit,out})=>{
 const panels=[
  {name:'settings',open:()=>page.evaluate(()=>LudusPreview.viewSettings.open()),close:()=>page.evaluate(()=>LudusPreview.viewSettings.dialog.close()),root:'.ludus-view-settings',frame:'.ludus-view-settings',heading:'.settings-heading'},
  {name:'guide',open:()=>page.evaluate(()=>{LudusPreview.leaveRoom();return LudusPreview.beginnerGuide.open();}),close:()=>page.evaluate(()=>LudusPreview.beginnerGuide.close()),root:'#beginnerGuide',frame:'.fq-shell',heading:'.fq-top'},
  {name:'training',open:()=>page.evaluate(()=>LudusPreview.showGladiator(LudusPreview.roster[0])),close:()=>page.evaluate(()=>LudusPreview.exercisePanel.close()),root:'#orders',frame:'.exercise-panel',heading:'.exercise-top'},
  {name:'missions',open:()=>page.evaluate(()=>LudusPreview.imperial.open()),close:()=>page.evaluate(()=>LudusPreview.imperial.close()),root:'.imperial-modal',frame:'.imperial-paper',heading:'.imperial-head'},
  {name:'pantry',open:()=>page.evaluate(()=>{const p=LudusPreview;p.enterRoom(p.rooms.find(r=>r.kind==='dining'));return p.foodSystem.open();}),close:()=>page.evaluate(()=>LudusPreview.foodSystem.close()),root:'#foodModal',frame:'.kitchen-frame',heading:'.kitchen-header'},
  {name:'clan-vault',open:()=>page.evaluate(()=>LudusPreview.clanVault.open()),close:()=>page.evaluate(()=>LudusPreview.clanVault.close()),root:'.clan-vault-modal',frame:'.clan-vault-frame',heading:'.clan-vault-top'},
  {name:'messages',open:()=>page.locator('#messagesOpen').click(),close:()=>page.evaluate(()=>document.getElementById('ludusMessages').close()),root:'#ludusMessages',frame:'#ludusMessages',heading:'.mc-head'}
 ];
 const palettes={white:{header:'rgb(89, 24, 35)',ink:'rgb(234, 210, 148)'},black:{header:'rgb(37, 43, 51)',ink:'rgb(227, 233, 238)'},blue:{header:'rgb(33, 68, 81)',ink:'rgb(238, 221, 182)'}};
 for(const [width,height,theme]of [[1536,706,'white'],[932,430,'black'],[844,390,'blue'],[768,353,'white'],[667,375,'blue']]){
  await page.setViewportSize({width,height});
  await page.evaluate(theme=>LudusTheme.set(theme),theme);
  for(const panel of panels){
   await panel.open();await page.waitForSelector(panel.root+':visible');
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await fit(panel.frame);
   // The guide replaces its children after async refresh and debounced resize.
   // Query and measure the current nodes in one browser task; a locator handle
   // can otherwise be detached between resolution and getComputedStyle().
   const presentation=await page.evaluate(({rootSelector,frameSelector,headingSelector})=>{
    const modal=document.querySelector(rootSelector),root=modal?.matches(frameSelector)?modal:modal?.querySelector(frameSelector),heading=modal?.querySelector(headingSelector),title=modal?.querySelector('h1,h2');
    if(!root?.isConnected||!heading?.isConnected||!title?.isConnected)throw Error('Panel presentation nodes are missing');
    const r=root.getBoundingClientRect(),h=heading.getBoundingClientRect();
    const wineArea=Math.max(0,...[root,...root.querySelectorAll('*')].filter(e=>e.getClientRects().length).map(e=>{const c=getComputedStyle(e).backgroundColor.match(/[\d.]+/g)?.map(Number)||[0,0,0,0],b=e.getBoundingClientRect();return(c[3]??1)>.5&&c[0]>c[1]*1.5&&c[0]>c[2]*1.2?b.width*b.height/(r.width*r.height):0}));
    return{wineArea,headingArea:h.width*h.height/(r.width*r.height),headingColor:getComputedStyle(heading).backgroundColor,titleColor:getComputedStyle(title).color,titleFont:getComputedStyle(title).fontFamily};
   },{rootSelector:panel.root,frameSelector:panel.frame,headingSelector:panel.heading});
   assert.equal(presentation.headingColor,palettes[theme].header,panel.name+' uses the selected '+theme+' header');
   assert.equal(presentation.titleColor,palettes[theme].ink,panel.name+' title stays readable on the selected header');
   assert.ok(presentation.headingArea<.25,panel.name+' keeps its header within a quarter of the panel');
   if(panel.name==='pantry'){
    assert.ok(presentation.wineArea<.25,'daily kitchen keeps its burgundy header within a quarter of the full screen');
    assert.match(presentation.titleFont,/Georgia/,'daily kitchen title');
    assert.equal(await page.getByRole('meter').count(),2,'daily kitchen has variety and portion meters');
    assert.equal(await page.locator('.kitchen-stock').count(),7,'daily kitchen displays the food inventory');
    await fit('.kitchen-body');await fit('.kitchen-stock');
   }else{
    assert.ok(presentation.wineArea<=Math.max(.15,presentation.headingArea+.001),panel.name+' limits burgundy to the header and small accents');
    assert.match(presentation.titleFont,panel.name==='settings'?/Georgia/:/Cinzel/,panel.name+' approved title face');
   }
   if(width===1536||width===844)await page.screenshot({path:out+'/modern-'+panel.name+'-'+width+'.png'});
   await panel.close();await page.waitForSelector(panel.root+':visible',{state:'hidden'});await page.waitForFunction(()=>!LudusPreview.paused);
  }
 }
 await page.evaluate(()=>LudusTheme.set('white'));
 console.log('V282 shared panels PASS: seven room dialogs use all three approved palettes at five screen sizes; daily kitchen inventory and two meters are preserved.');
};

