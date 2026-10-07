// Reuse the real office/model fixture and verify the new level-book entry.
const fs=require('node:fs'),Module=require('node:module'),path=require('node:path');
const filename=require.resolve('./imperial-office-v33.cjs');
let source=fs.readFileSync(filename,'utf8');
const rpc="if(name!=='ludus_imperial')return";
if(!source.includes(rpc))throw Error('Office RPC fixture changed');
source=source.replace(rpc,"if(name==='ludus_progress')return {data:window.__levels||{level:1,current_exp:0,next_exp:3000,claimable_count:0},error:null};"+rpc);
const entry="const daily=page.getByRole('button',{name:'Günlük görevleri defterden aç',exact:true});";
if(!source.includes(entry))throw Error('Office entry fixture changed');
source=source.replace(entry,`await page.route('http://127.0.0.1:8765/ludus-seviye.html**',r=>r.fulfill({body:'<h1>Level navigation fixture</h1>',contentType:'text/html'}));
 await page.evaluate(async()=>{window.__levels={level:2,current_exp:0,next_exp:3115,claimable_count:1};await LudusPreview.levelProgress.refresh();LudusPreview.imperial.tick();});
 const level=page.getByRole('button',{name:'Ludus seviye defterini aç',exact:true});
 assert.equal(await level.isVisible(),true);assert.equal(await level.getAttribute('data-state'),'ready');
 const bounds=await level.boundingBox();assert.ok(bounds.y>=55&&bounds.y+bounds.height<=390,'Level arrow stays below the HUD');
 await page.evaluate(async()=>{window.__levels.claimable_count=0;await LudusPreview.levelProgress.refresh();LudusPreview.imperial.tick();});
 assert.equal(await level.getAttribute('data-state'),'idle');
 const daily=page.getByRole('button',{name:'Ludus seviye defterini aç',exact:true});`);
source=source.replace("await page.waitForURL('**/gorevler.html**')","await page.waitForURL('**/ludus-seviye.html**')").replace('dailyOpensFromBook:true','levelBookOpens:true');
const fixture=new Module(filename,module);fixture.filename=filename;fixture.paths=Module._nodeModulePaths(path.dirname(filename));fixture._compile(source,filename);
