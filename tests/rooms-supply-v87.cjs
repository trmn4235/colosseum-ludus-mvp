// Actual DOM behavior and Three.js scene geometry. No browser/GPU assertions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require(process.env.LUDUS_JSDOM_MODULE||'jsdom');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),pause=()=>new Promise(r=>setTimeout(r,0));
const owner='00000000-0000-4000-8000-000000000001';
const fixture={user_id:owner,server_now:new Date().toISOString(),level:5,workers:1,busy_workers:1,free_workers:0,unclaimed_workers:0,next_worker_level:10,automatic_delivery:true,deliveries:[],resources:[{sku:'iron',name:'Demir',quantity:0,food:false}],destinations:[{id:'iron',name:'Demir madeni',seconds:3600,yields:{iron:12}}],jobs:[{id:'trip-1',destination:'iron',workers:1,cargo:{iron:12},ends_at:new Date(Date.now()+30000).toISOString()}],recipes:[]};
(async()=>{
 const dom=new JSDOM('<body data-roman-screen="ludus"></body>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 for(const text of [read('ludus.html').match(/<style>([\s\S]*?)<\/style>/)[1],read('roman-ui-v56.css'),read('ludus-supply-v85.css'),read('roman-theme-v68.css')]){const style=w.document.createElement('style');style.textContent=text;w.document.head.append(style);}
 let data=structuredClone(fixture),lid=false,notifications=[],reads=0;w.eval(read('ludus-supply-v85.js'));
 const ui=w.LudusSupply.create({ready:Promise.resolve({user_id:owner}),inRoom:()=>true,blocked:()=>false,onChestOpen:b=>lid=b,onChange:a=>notifications.push(a),client:{rpc:async(_,args)=>{assert.equal(args,undefined,'all tested interactions are read-only');reads++;return {data:structuredClone(data)};}}});
 ui.enter();await ui.open();w.document.querySelector('[data-destination=iron]').click();
 const photo=w.document.querySelector('.supply-location-art');assert.equal(w.getComputedStyle(photo).objectFit,'contain');assert.equal(w.document.querySelector('.supply-scene figcaption'),null,'no caption covers the photograph');
 const expand=w.document.querySelector('.supply-art-expand');expand.focus();expand.click();const gallery=w.document.querySelector('.supply-gallery');
 assert.equal(gallery.hidden,false);assert.equal(w.document.getElementById('supplyModal').inert,true);assert.equal(w.getComputedStyle(gallery.querySelector('img')).objectFit,'contain');assert.ok(gallery.querySelector('img').src.endsWith('/iron.webp'));
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));assert.equal(w.document.activeElement,w.document.querySelector('.supply-gallery-close'));
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(gallery.hidden,true);assert.equal(w.document.getElementById('supplyModal').hidden,false);assert.equal(w.document.activeElement,expand);assert.equal(w.document.getElementById('supplyModal').inert,false);
 w.document.querySelector('.supply-back').click();w.document.querySelector('.supply-map-expand').click();assert.ok(gallery.querySelector('img').src.endsWith('/rome-map.webp'));w.document.querySelector('.supply-gallery-close').click();
 ui.close();w.document.getElementById('supplyChestOpen').click();await pause();await pause();assert.equal(lid,true);assert.equal(w.document.getElementById('supplyTitle').textContent,'Tedarik kasası');assert.equal(w.document.querySelector('.supply-stock-card strong').textContent,'0');
 // Delivery is adopted and dining is invalidated even while the supply panel is closed.
 ui.close();assert.equal(lid,false);const ended={...fixture.jobs[0],ends_at:new Date(Date.now()-1000).toISOString()};data.jobs=[ended];await ui.refresh();const before=reads;
 data.jobs=[];data.deliveries=[{...ended,claimed_at:new Date().toISOString()}];data.resources[0].quantity=12;data.free_workers=1;data.busy_workers=0;
 const oldNow=w.Date.now;w.Date.now=()=>oldNow()+6100;ui.tick();await pause();await pause();assert.ok(reads>before,'closed-panel clock requests mature cargo');assert.equal(ui.state.free_workers,1);assert.equal(ui.state.resources[0].quantity,12);assert.deepEqual(notifications,['delivery']);
 await ui.refresh();assert.deepEqual(notifications,['delivery'],'repeated state does not notify twice');w.Date.now=oldNow;
 await ui.open('stock');assert.equal(w.document.querySelector('.supply-stock-card strong').textContent,'12');[...w.document.querySelectorAll('.supply-tabs button')].find(b=>b.textContent.startsWith('Seferler')).click();assert.equal(lid,false);assert.equal(w.document.querySelector('[data-delivered]').dataset.delivered,'trip-1');assert.equal(w.document.querySelector('[data-claim]'),null);w.document.querySelector('.supply-job button').click();assert.equal(lid,true);
 ui.leave();ui.enter('forge');assert.equal(w.document.getElementById('supplyChestOpen').hidden,true);assert.equal(lid,false);dom.window.close();
 // Build the exact shipped geometry, including all instances, without WebGL.
 const paint=new Proxy({}, {get:()=>()=>paint}),context=vm.createContext({console,document:{createElement:()=>({width:512,height:512,getContext:()=>paint})}});vm.runInContext(read('owner-three-r160.js'),context);const T=context.THREE;T.TextureLoader.prototype.load=()=>new T.Texture();
 for(const file of ['ludus-room-design-v87.js','ludus-trade-room-v86.js','ludus-rest-v64.js'])vm.runInContext(read(file),context);
 const props=new T.Group(),colliders=[],design=context.LudusRoomDesign.create({T,wood:new T.MeshStandardMaterial(),stone:new T.MeshStandardMaterial(),props,colliders});
 const blocked=(x,z)=>colliders.some(c=>Math.hypot(x-Math.max(c.minX,Math.min(x,c.maxX)),z-Math.max(c.minZ,Math.min(z,c.maxZ)))<.28);
 function reachable(point){const queue=[[0,2.6]],seen=new Set();for(let i=0;i<queue.length&&i<10000;i++){const [x,z]=queue[i];if(Math.hypot(x-point[0],z-point[1])<1.9)return true;for(const [dx,dz]of [[.2,0],[-.2,0],[0,.2],[0,-.2]]){const xx=Math.round((x+dx)*10)/10,zz=Math.round((z+dz)*10)/10,k=xx+','+zz;if(seen.has(k)||Math.abs(xx)>=4.5||zz<=-4||zz>=4||blocked(xx,zz))continue;seen.add(k);queue.push([xx,zz]);}}return false;}
 const report=[];
 for(const kind of ['office','clan','rest','upgrades','infirmary','dining']){
  props.clear();colliders.length=0;const first=design.enter(kind);assert.ok(first.userData.features.length>=8);assert.equal(blocked(0,2.6),false,kind+' entry remains clear');assert.equal(blocked(0,3.7),false,kind+' exit remains clear');
  const extent=new T.Box3().setFromObject(first);for(const n of [extent.min.x,extent.min.y,extent.min.z,extent.max.x,extent.max.y,extent.max.z])assert.ok(Number.isFinite(n));assert.ok(extent.min.x>=-4.96&&extent.max.x<=4.96,kind+' fits room width');assert.ok(extent.max.y<5,kind+' fits ceiling');
  let draws=0,triangles=0,lights=0;first.traverse(o=>{if(o.isLight)lights++;if(o.isMesh){draws++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);}});assert.equal(lights,0);assert.ok(draws<55,kind+' static draw-call budget');assert.ok(triangles<28000,kind+' geometry budget');report.push({kind,draws,triangles});
  if(kind==='upgrades')for(const p of [[-2.8,-.65],[-.32,.06],[2.5,0]])assert.ok(reachable(p),'all three workshop stations reachable');
  if(kind==='office')for(const p of [[0,-1],[3.45,-3.5]])assert.ok(reachable(p),'office functions reachable');
  for(let n=0;n<4;n++){props.clear();colliders.length=0;assert.equal(design.enter(kind),first);assert.equal(props.children.length,1);assert.equal(colliders.length,first.userData.colliderCount);}
 }
 design.enter('rest');for(const count of [2,20,50,6]){const layout=context.LudusRestRoom.layout(count);design.resize(layout.depth);assert.equal(design.root.userData.depth,layout.depth);assert.equal(design.cachedRooms,6,'rest resizing does not grow the cache');const bottom=new T.Box3().setFromObject(design.root).min.z;assert.ok(bottom>=4.5-layout.depth-.01);for(const b of layout.beds)assert.equal(blocked(b.x,b.z),false,'no furnishing overlaps the preserved mattresses');}
 props.clear();colliders.length=0;assert.equal(design.enter('armory'),null);assert.equal(props.children.length,0,'old smithy is empty');
 const trade=context.LudusTradeRoom.create({T,wood:new T.MeshStandardMaterial(),stone:new T.MeshStandardMaterial()});trade.enter(props,colliders);const chest=trade.chest,lidNode=chest.getObjectByName('Açılır kasa kapağı');assert.equal(lidNode.rotation.x,0);trade.setChestOpen(true);assert.equal(lidNode.rotation.x,-1.1);trade.setChestOpen(false);assert.equal(lidNode.rotation.x,0);assert.ok(reachable([-3.6,1.02]));
 assert.equal(read('ludus-trade-room-v86.js').includes('TEDARİK • ROMA'),false);const html=read('ludus.html');assert.ok(html.includes("if(r.kind==='upgrades'){roomActions.enter();supplySystem.enter('forge');}"));assert.ok(html.includes("inRoom:()=>['store','upgrades']"));
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(match[2].trim()&&!/type=["'](?:importmap|application\/json)/.test(match[1]))new vm.Script(match[2]);
 console.log('V87 PASS: whole-photo viewer and focus; map enlargement; chest open/close; automatic closed-panel delivery and dining refresh; six cached room themes; safe entries and three workshop stations; rest resizing; empty old smithy; real chest hinge; integrated syntax.');console.table(report);
})().catch(e=>{console.error(e);process.exitCode=1;});
