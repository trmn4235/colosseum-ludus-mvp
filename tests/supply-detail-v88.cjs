// Viewport geometry is explicit fixture input, not a browser layout or GPU claim.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.LUDUS_JSDOM_MODULE||'jsdom');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),pause=()=>new Promise(r=>setTimeout(r,0));
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const delivery=id=>({id,destination:'iron',workers:1,cargo:{iron:12},claimed_at:new Date().toISOString()});
const fixture={user_id:owner,server_now:new Date().toISOString(),level:5,workers:1,free_workers:1,busy_workers:0,next_worker_level:10,unclaimed_workers:0,jobs:[],deliveries:[delivery('a')],resources:[{sku:'iron',name:'Demir',quantity:12,food:false}],destinations:[{id:'iron',name:'Demir madeni',seconds:3600,yields:{iron:12}}],recipes:[]};
async function setup(saved={},user=owner){
 const dom=new JSDOM('<body data-roman-screen="ludus"></body>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;for(const [key,value]of Object.entries(saved))w.localStorage.setItem(key,value);
 for(const css of ['roman-ui-v56.css','ludus-supply-v85.css','roman-theme-v68.css']){const style=w.document.createElement('style');style.textContent=read(css);w.document.head.append(style);}
 const state={...structuredClone(fixture),user_id:user},writes=[];w.eval(read('ludus-supply-v85.js'));const ui=w.LudusSupply.create({ready:Promise.resolve({user_id:user}),inRoom:()=>true,blocked:()=>false,client:{rpc:async(_,args)=>{if(args)writes.push(args);return {data:structuredClone(state)};}}});ui.enter();await ui.open();return {dom,w,ui,state,writes};
}
(async()=>{
 const {dom,w,ui,state,writes}=await setup();const doc=w.document,chest=doc.getElementById('supplyChestOpen'),badge=chest.querySelector('.supply-chest-count');
 assert.equal(ui.attention,true,'offline deliveries attract attention immediately');assert.equal(chest.dataset.state,'ready');assert.equal(badge.textContent,'1');assert.equal(badge.hidden,false);assert.match(chest.getAttribute('aria-label'),/1 yeni teslimat/);
 doc.querySelector('[data-destination=iron]').click();doc.querySelector('.supply-art-expand').focus();doc.querySelector('.supply-art-expand').click();const stage=doc.querySelector('.supply-gallery-stage'),img=stage.querySelector('img'),level=doc.querySelector('.supply-gallery-level');
 let width=600,height=400;stage.getBoundingClientRect=()=>({left:0,top:0,width,height,right:width,bottom:height});
 const key=k=>doc.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true,cancelable:true}));
 const transform=()=>{const m=img.style.transform.match(/translate\(([-.\d]+)px,([-.\d]+)px\) scale\(([-.\d]+)\)/);return {x:Number(m[1]),y:Number(m[2]),zoom:Number(m[3])};};
 const pointer=(type,id,x,y,pointerType='touch')=>{const event=new w.Event(type,{bubbles:true,cancelable:true});for(const [k,v]of Object.entries({pointerId:id,clientX:x,clientY:y,pointerType,button:0}))Object.defineProperty(event,k,{value:v});stage.dispatchEvent(event);return event;};
 doc.querySelector('.supply-gallery-fit').click();assert.equal(level.value,'100%');assert.equal(w.getComputedStyle(img).objectFit,'contain');
 key('+');assert.equal(level.value,'125%');key('0');assert.equal(level.value,'100%');
 // Pinch from a 100 px span to a 200 px span, then pan with the remaining finger.
 pointer('pointerdown',1,250,200);pointer('pointerdown',2,350,200);pointer('pointermove',2,450,200);assert.deepEqual(transform(),{x:50,y:0,zoom:2});pointer('pointerup',2,450,200);pointer('pointermove',1,1250,1200);assert.deepEqual(transform(),{x:300,y:200,zoom:2},'panning clamps at the actual image edges');pointer('pointercancel',1,1250,1200);pointer('pointermove',1,0,0);assert.deepEqual(transform(),{x:300,y:200,zoom:2},'cancelled fingers cannot keep dragging');
 key('0');assert.deepEqual(transform(),{x:0,y:0,zoom:1});
 // Portrait letterboxing must not permit dragging empty space into view.
 width=360;height=620;w.dispatchEvent(new w.Event('resize'));key('+');key('+');key('+');key('+');key('ArrowUp');assert.equal(transform().y,0);assert.equal(transform().zoom,2);key('0');
 // Touch double-tap toggles zoom; its compatibility dblclick must not toggle it back.
 pointer('pointerdown',3,180,310);pointer('pointerup',3,180,310);pointer('pointerdown',4,180,310);pointer('pointerup',4,180,310);assert.equal(transform().zoom,2);stage.dispatchEvent(new w.MouseEvent('dblclick',{bubbles:true,clientX:180,clientY:310}));assert.equal(transform().zoom,2);
 for(let i=0;i<20;i++)key('+');assert.equal(transform().zoom,4);assert.equal(doc.querySelector('[aria-label="Görseli yakınlaştır"]').disabled,true);key('0');assert.equal(doc.querySelector('[aria-label="Görseli uzaklaştır"]').disabled,true);
 const wheel=new w.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-250,clientX:180,clientY:310});stage.dispatchEvent(wheel);assert.equal(wheel.defaultPrevented,true);assert.ok(transform().zoom>1);
 // Refresh rebuilds the region controls while the gallery stays open: focus still returns.
 await ui.refresh();key('Escape');assert.equal(doc.querySelector('.supply-gallery').hidden,true);assert.equal(doc.activeElement,doc.querySelector('.supply-art-expand'));assert.equal(doc.getElementById('supplyModal').hasAttribute('aria-hidden'),false);
 ui.close();await ui.open('stock');assert.equal(ui.attention,false);assert.equal(chest.dataset.state,'idle');assert.equal(badge.hidden,true);assert.match(doc.querySelector('.supply-arrival').textContent,/12 Demir/);const seenKey='ludus-supply-seen-v88:'+owner,saved=w.localStorage.getItem(seenKey);assert.deepEqual(JSON.parse(saved),['a']);
 // A new delivery while outside the chest is new; another tab can acknowledge it.
 ui.close();state.deliveries=[delivery('b'),delivery('a')];await ui.refresh();assert.equal(ui.attention,true);assert.equal(badge.textContent,'1');w.dispatchEvent(new w.StorageEvent('storage',{key:seenKey,newValue:'["a","b"]'}));assert.equal(ui.attention,false);
 assert.deepEqual(writes,[],'zoom, notifications and acknowledgement never mutate inventory');dom.window.close();
 const restored=await setup({[seenKey]:saved});assert.equal(restored.ui.attention,false,'seen arrivals survive page reload');restored.dom.window.close();
 const separate=await setup({[seenKey]:saved},other);assert.equal(separate.ui.attention,true,'seen state is account-scoped');separate.dom.window.close();
 assert.ok(read('ludus.html').includes("if(kind==='store')return supplySystem.attention;"));
 console.log('V88 PASS: offline unread cargo; account-scoped persistence; cross-tab acknowledgement; no inventory writes; latest cargo; anchored pinch; bounded pan; pointer cancellation; letterboxing; double-tap guard; wheel/keyboard zoom; restored focus after refresh.');
})().catch(e=>{console.error(e);process.exitCode=1;});
