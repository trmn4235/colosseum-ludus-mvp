// DOM interaction tests; no browser or live account is used.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.LUDUS_JSDOM_MODULE||'jsdom');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(root+'/'+f,'utf8');
const pause=()=>new Promise(r=>setTimeout(r,0)),owner='00000000-0000-4000-8000-000000000001';
function dom(html='<body></body>'){return new JSDOM(html,{url:'https://example.test/ludus.html',runScripts:'outside-only'});}
function script(w,file){w.eval(read(file));}
const resources=[['iron','Demir'],['copper','Bakır'],['wood','Odun'],['leather','Deri'],['linen','Keten'],['grain','Tahıl'],['apple','Elma'],['meat','Et'],['fish','Balık'],['egg','Yumurta'],['beer','Şarap'],['olive_oil','Zeytinyağı']].map(([sku,name],i)=>({sku,name,quantity:20,food:i>=5}));
const base={user_id:owner,server_now:new Date().toISOString(),level:10,workers:2,free_workers:2,busy_workers:0,next_worker_level:15,unclaimed_workers:0,resources,destinations:[{id:'iron',name:'Demir madeni',description:'Maden',seconds:3600,yields:{iron:12},x:23,y:17},{id:'copper',name:'Bakır madeni',description:'Bakır',seconds:3600,yields:{copper:12},x:73,y:17},{id:'olive_oil',name:'Zeytinlik',description:'Sıkım evi',seconds:3600,yields:{olive_oil:6},x:89,y:34}],jobs:[],recipes:[{sku:'gladius',name:'Gladius',kind:'weapon',ingredients:{iron:6,wood:2,leather:2}}]};
(async()=>{
 const d=dom(),w=d.window,calls=[];const baseStyle=w.document.createElement('style');baseStyle.textContent=read('ludus.html').match(/<style>([\s\S]*?)<\/style>/)[1];w.document.head.append(baseStyle);const supplyStyle=w.document.createElement('style');supplyStyle.textContent=read('ludus-supply-v85.css');w.document.head.append(supplyStyle);let lost=true,lastRequest=null;
 let data=structuredClone(base);const client={rpc:async(name,args)=>{calls.push({name,args});if(!args)return {data:structuredClone(data)};if(args.p_action==='send'){
  if(!lastRequest){lastRequest=args.p_request;data.free_workers=1;data.busy_workers=1;data.jobs=[{id:'00000000-0000-4000-8000-000000000002',destination:args.p_key,workers:1,cargo:{copper:12},started_at:new Date().toISOString(),ends_at:new Date(Date.now()+3600000).toISOString()}];}
  assert.equal(args.p_request,lastRequest);if(lost){lost=false;return {error:{message:'Lost response',code:'503'}};}
 }return {data:{...structuredClone(data),result:{message:'OK'}}};}};
 let opened=0,closed=0;script(w,'ludus-supply-v85.js');const ui=w.LudusSupply.create({client,ready:Promise.resolve({user_id:owner}),inRoom:()=>true,blocked:()=>false,onOpen:()=>opened++,onClose:()=>closed++});
 ui.enter();await ui.open();assert.equal(opened,1);const header=w.getComputedStyle(w.document.querySelector('.supply-head'));assert.equal(header.display,'flex');assert.equal(header.position,'static');assert.equal(header.pointerEvents,'auto');assert.equal(w.document.querySelectorAll('[data-destination]').length,3);
 w.document.querySelector('[data-destination=copper]').click();assert.match(w.document.querySelector('.supply-yield').textContent,/12 Bakır/);
 const input=w.document.querySelector('.supply-worker-label input');input.value='3';input.dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelector('[data-send]').disabled,true);
 input.value='1';input.dispatchEvent(new w.Event('input'));w.document.querySelector('[data-send]').click();await pause();await pause();assert.ok(ui.pending);const pendingId=ui.pending.request;
 assert.equal(w.document.querySelector('[data-send]').disabled,true);w.document.querySelector('.supply-footer button').click();await pause();await pause();assert.equal(ui.pending,null);assert.equal(pendingId,lastRequest);assert.equal(ui.state.jobs.length,1);
 [...w.document.querySelectorAll('.supply-tabs button')].find(b=>b.textContent.startsWith('Seferler')).click();assert.equal(w.document.querySelector('.supply-auto-label').disabled,true);assert.equal(w.document.querySelector('[data-claim]'),null);
 ui.leave();assert.equal(closed,1);assert.equal(w.document.getElementById('supplyModal').hidden,true);
 ui.enter('forge');await ui.open();assert.equal(w.document.getElementById('supplyTitle').textContent,'Demirci');assert.equal(w.document.querySelector('[data-craft=gladius]').disabled,false);
 // A blocked operation must show its error even when the empty footer was hidden.
 assert.equal(w.document.querySelector('.supply-footer').hidden,true);
 const save=w.Storage.prototype.setItem,beforeBlockedCraft=calls.length;
 w.Storage.prototype.setItem=function(key,value){if(key.startsWith('ludus-supply-pending-'))throw new w.DOMException('Storage unavailable','QuotaExceededError');return save.call(this,key,value);};
 w.document.querySelector('[data-craft=gladius]').click();await pause();await pause();
 assert.equal(calls.length,beforeBlockedCraft);assert.equal(ui.pending,null);
 assert.match(w.document.querySelector('.supply-status').textContent,/İşlem kaydı saklanamadı/);
 assert.equal(w.document.querySelector('.supply-status').dataset.error,'true');assert.equal(w.document.querySelector('.supply-footer').hidden,false);
 w.Storage.prototype.setItem=save;
 w.document.querySelector('[data-craft=gladius]').click();await pause();await pause();
 assert.equal(calls.length,beforeBlockedCraft+1);assert.equal(calls.at(-1).args.p_action,'craft');assert.equal(ui.pending,null);
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(w.document.getElementById('supplyModal').hidden,true);
 data={...data,workers:0,free_workers:0,busy_workers:0,jobs:[],level:5,unclaimed_workers:1};ui.enter();await ui.open();w.document.querySelector('[data-destination=iron]').click();assert.equal(w.document.querySelector('[data-send]').disabled,true);assert.match(w.document.querySelector('.supply-reward-link').textContent,/1 işçi/);d.window.close();
 // Reward ledger has its own worker column, distinct from gladiator rewards.
 const l=dom(read('ludus-seviye.html')),lw=l.window;await pause();
 const state={level:5,current_exp:0,next_exp:3000,granted_gladiators:3,owned_gladiators:2,workers:1,next_worker_level:10,battle_exp_today:0,claimable_count:0,pending_gladiator_count:0,wallet:{ludus_name:'Fixture'},rewards:Array.from({length:49},(_,i)=>({level:i+2,diamonds:1,denarius:100,items:1,gladiators:0,workers:(i+2)%5===0?1:0,claimed:i+2<=5,unlocked:i+2<=5,claimable:false}))};
 const levelClient={rpc:async()=>({data:state}),auth:{getUser:async()=>({data:{user:{id:owner}}})}};lw.LudusClient={create:()=>levelClient};lw.LudusNavigation={setOwner(){},back(){}};script(lw,'ludus-level-v37.js');await pause();await pause();
 assert.equal(lw.document.getElementById('levelWorkers').textContent,'1 / 10');assert.equal(lw.document.querySelectorAll('.level-table th').length,10);assert.equal(lw.document.querySelectorAll('#levelRows tr td').length,10);assert.equal(lw.document.querySelector('#levelRows tr td:nth-child(9)').textContent,'1');l.window.close();
 // Existing food cards stay usable; retired food is hidden from purchasing.
 const f=dom(),fw=f.window;const food={user_id:owner,gold:500,crew_count:1,server_now:new Date().toISOString(),reset_at:new Date(Date.now()+86400000).toISOString(),history:[],menu:{units:100,daily_need:100,morale:90,available_units:100,missing_units:0,stamina_bonus_percent:8,served:[],balanced_without_oil:true,olive_oil_used:0,olive_oil_needed:1},combat:{active_bonus:8},items:[{sku:'bread',name:'Ekmek',retired:true,quantity:3,nutrition:15,price:3,daily:0},{sku:'meal',name:'Hazır öğün',retired:true,quantity:0,nutrition:100,price:30,daily:0},{sku:'olive_oil',name:'Zeytinyağı',retired:false,quantity:0,nutrition:0,price:12,daily:0}]};
 script(fw,'dining-food-v55.js');const foodUI=fw.LudusFood.create({client:{rpc:async()=>({data:food})},ready:Promise.resolve({user_id:owner}),inRoom:()=>true,blocked:()=>false});await pause();await pause();await foodUI.open();
 assert.ok(fw.document.querySelector('[data-sku=bread]'));assert.equal(fw.document.querySelector('[data-sku=meal]'),null);
 [...fw.document.querySelectorAll('.food-tabs button')].find(b=>b.textContent==='Erzak al').click();assert.equal(fw.document.querySelector('[data-sku=bread]'),null);assert.ok(fw.document.querySelector('[data-sku=olive_oil]'));assert.match(fw.document.querySelector('[data-sku=olive_oil]').textContent,/Yalnızca en yüksek kalite/);f.window.close();
 // Parse all inline scripts in the integrated game (without executing its 3D runtime).
 for(const file of ['ludus.html','ludus-seviye.html','pazar.html'])for(const m of read(file).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(!/type=["'](?:importmap|application\/json)/.test(m[1])&&m[2].trim())new vm.Script(m[2],{filename:file});}
 console.log('V85 DOM PASS: map selections; worker input; lost-response replay; reward ledger; forge entry; visible storage error and recovery; expired job guard; retired food; oil help; game script parsing.');
})().catch(e=>{console.error(e);process.exitCode=1;});
