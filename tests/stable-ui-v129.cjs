const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');const root=path.resolve(__dirname,'..'),core=require('../ludus-stable-v129.js');
const next=()=>new Promise(r=>setTimeout(r,0));
(async()=>{
 const base=JSON.parse(fs.readFileSync(process.env.STABLE_FIXTURE_PATH,'utf8'));
 const dom=new JSDOM('<body><button id="return">Ahır</button></body>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let pause=false,calls=[],selected,failed=false;w.eval(fs.readFileSync(path.join(root,'ludus-stable-appearance-v130.js'),'utf8'));w.eval(fs.readFileSync(path.join(root,'ludus-stable-v129.js'),'utf8'));
 const state=structuredClone(base);const ui=w.LudusStable.create({ready:Promise.resolve({user_id:base.user_id}),blocked:()=>pause,onOpen:()=>pause=true,onClose:()=>pause=false,onHorse:h=>selected=h,client:{rpc:async(name,args)=>{assert.equal(name,'ludus_stable');calls.push(args||{});if(failed)return {error:{message:'Network unavailable'}};const out=structuredClone(state);out.result={message:'İşlem tamamlandı'};return {data:out};}}});
 ui.enter();await next();await next();assert.ok(selected);assert.equal(w.document.querySelector('.stable-hud'),null);assert.ok(w.document.querySelector('#stableGroomAction'));
 const untouched=w.document.querySelector('#stableGroomAction');ui.tick();ui.tick();assert.equal(w.document.querySelector('#stableGroomAction'),untouched,'animation tick reuses the groom interaction');
 for(const [tab]of core.tabs){await ui.open(tab);await next();assert.equal(ui.visible,true);assert.equal(pause,true);assert.ok(w.document.querySelector('.stable-body').children.length);assert.equal(w.document.querySelectorAll('.stable-tabs button[aria-pressed=true]').length,1);}
 await ui.open('pedigree');assert.equal(w.document.querySelectorAll('.stable-ancestor').length,6,'parents and four grandparent positions');
 await ui.open('stats');assert.equal(w.document.querySelectorAll('.stable-stats .stable-meter').length,9);
 const names=[...w.document.querySelectorAll('.stable-meter-label')].map(x=>x.textContent);assert.ok(names.some(x=>x.includes('Patlama gücü')));
 await ui.open('market');let coatPicker=w.document.querySelector('[aria-label="At görünümü"]');assert.equal(coatPicker.options.length,7);
 coatPicker.value='pinto';coatPicker.dispatchEvent(new w.Event('change'));assert.ok(w.document.querySelector('.stable-founder-figure img').src.endsWith('/pinto.webp'));
 [...w.document.querySelectorAll('.stable-founder button')].find(b=>b.textContent==='Satın al').click();[...w.document.querySelectorAll('.stable-confirm button')].find(b=>b.textContent==='Onayla').click();await next();await next();assert.equal(calls.at(-1).p_args.coat,'pinto');
 await ui.open('groom');const auto=w.document.querySelector('.stable-check input');assert.ok(auto);const before=calls.length;
 auto.checked=true;[...w.document.querySelectorAll('button')].find(b=>b.textContent==='Yemlik ayarlarını kaydet').click();await next();await next();assert.equal(calls.at(-1).p_action,'settings');assert.equal(calls.length,before+1);
 // A connection failure preserves the same request UUID across a retry.
 failed=true;[...w.document.querySelectorAll('button')].find(b=>b.textContent==='Yemlik ayarlarını kaydet').click();await next();await next();const id=calls.at(-1).p_request;assert.ok(id);assert.ok(w.localStorage.getItem('ludus-stable-pending-v129:'+base.user_id));
 failed=false;[...w.document.querySelectorAll('button')].find(b=>b.textContent==='Yeniden dene').click();await next();await next();assert.equal(calls.at(-1).p_request,id);assert.equal(w.localStorage.getItem('ludus-stable-pending-v129:'+base.user_id),null);
 ui.leave();assert.equal(ui.visible,false);assert.equal(pause,false);assert.equal(w.document.querySelector('#stableGroomAction').hidden,true);
 // Safely render user-chosen horse names as text.
 state.horses[0].name='<img src=x onerror=alert(1)>';ui.enter();await next();await ui.open('stats');assert.equal(w.document.querySelectorAll('img[onerror]').length,0);
 ui.leave();dom.window.close();
 const T=require('three'),context={console,LudusStableEnvironment:require('../ludus-stable-environment-v131.js'),LudusHorseAppearance:require('../ludus-stable-appearance-v130.js')};context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'ludus-stable-room-v130.js'),'utf8'),context);
 T.GLTFLoader=class{load(url,onLoad){const scene=new T.Group();scene.add(new T.Mesh(new T.BoxGeometry(1,2,3),new T.MeshStandardMaterial()));onLoad({scene,animations:[]});}};
 const props=new T.Group(),colliders=[],room=context.LudusStableRoom.create({T,props,colliders,wood:new T.MeshStandardMaterial(),stone:new T.MeshStandardMaterial()});
 room.enter();await next();room.select({id:'foal',stage:'foal'});assert.equal(room.root.userData.width,44);assert.equal(room.horse.scale.x,.55);const original=room.horse;room.leave();props.clear();colliders.length=0;room.enter();await next();room.select({id:'adult',stage:'adult'});assert.equal(room.horse,original,'model reused across entry');assert.equal(room.horse.scale.x,1);assert.ok(room.groom);room.leave();
 const h={stage:'adult',energy:100,fed_until:new Date(Date.now()+60000).toISOString()};assert.equal(core.canCompete(h),true);assert.equal(core.canCompete({...h,pregnant_until:'future'}),false);
 console.log('PASS stable UI V129: seven tabs, nine traits, full pedigree, safe text, retry identity, pause lifecycle, cached horse and single groom');
})().catch(e=>{console.error(e);process.exit(1)});
