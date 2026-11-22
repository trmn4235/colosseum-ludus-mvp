// State/command coverage without browser layout. Browser geometry has its own suite.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {script}=require('./infirmary-fixture-v289.cjs');
class Node{
 constructor(tag='text',text=''){this.tagName=tag.toUpperCase();this.children=[];this.className='';this.dataset={};this.attributes={};this.style={setProperty(){}};this._text=text;this.hidden=false;this.disabled=false;this.isConnected=true;}
 append(...nodes){this.children.push(...nodes.map(node=>typeof node==='string'?new Node('text',node):node));}
 replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
 set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(node=>node.textContent).join('');}
 setAttribute(name,value){this.attributes[name]=String(value);if(name==='class')this.className=String(value);}getAttribute(name){return this.attributes[name];}
 addEventListener(){}focus(){document.activeElement=this;}getClientRects(){return this.hidden?[]:[{}];}
 querySelector(selector){return nodes(this).find(node=>selector.startsWith('.')?node.className.split(' ').includes(selector.slice(1)):node.id===selector.slice(1));}
}
const nodes=(node)=>[node,...node.children.flatMap(nodes)],document={body:new Node('body'),activeElement:null,createElement:tag=>new Node(tag),createTextNode:text=>new Node('text',text)};
const storage=new Map(),intervals=new Map(),events=[];let elapsed=0,production=0,opened=0,closed=0;
const context={document,innerWidth:1440,innerHeight:900,Intl,URL,Date,structuredClone,crypto:{randomUUID},performance:{now:()=>elapsed},
 localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)},
 setInterval:fn=>{const id=intervals.size+1;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
 addEventListener(){},dispatchEvent:event=>events.push(event),CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
 testUser:{id:'fixture-owner'},__testClient:{rpc:async()=>({error:{message:'Unexpected RPC'}})}};
context.window=context;vm.createContext(context);vm.runInContext(script(),context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../infirmary-v289.js'),'utf8'),context);
const infirmary=context.LudusInfirmaryV289.create({client:context.__testClient,ready:Promise.resolve({user_id:'fixture-owner'}),onOpen:()=>opened++,onClose:()=>closed++,openProduction:()=>production++});
const find=cls=>nodes(document.body).filter(node=>node.className.split(' ').includes(cls)),settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const advance=milliseconds=>{elapsed+=milliseconds;for(const tick of intervals.values())tick();};
(async()=>{
 infirmary.open({injuryId:'injury-5'});await settle();assert.equal(infirmary.state.injuries.length,15);assert.equal(infirmary.preview.duration_seconds,43200);assert.equal(find('inf289-start')[0].disabled,false);
 assert.match(find('inf289-patient-heading')[0].textContent,/Yorgunluk 45,5\/100/);assert.match(find('inf289-recovery')[0].textContent,/Dinlenme 10,04 puan\/saat/);
 assert.equal(infirmary.preview.required.find(m=>m.sku==='linen_bandage').required,2,'Potential savings never reduce the stock required to start');
 assert.equal(context.__infCommits,0,'State and preview do not start treatment');
 assert.equal(infirmary.state.inventory.find(i=>i.sku==='linen_bandage').quantity,20);
 context.__infDropNext=true;await assert.rejects(()=>infirmary.start('injury-5'),/Yanıt kayboldu/);assert.equal(context.__infCommits,1);
 assert.equal(infirmary.state.injuries[5].status,'untreated','Lost response does not optimistically display treatment');
 assert.equal(infirmary.state.inventory.find(i=>i.sku==='linen_bandage').quantity,20,'Lost response does not optimistically consume inventory');
 const request=infirmary.pending.request;assert(storage.has('ludus-infirmary-v289:fixture-owner'));await assert.rejects(()=>infirmary.start('injury-1'),/Önceki işlemin/);
 infirmary.close();assert.equal(intervals.size,0);infirmary.open({injuryId:'injury-5'});await settle();assert.equal(infirmary.pending.request,request);await infirmary.retry();
 const commands=context.__infReads.filter(call=>call.p_action==='start');assert.equal(commands.length,2);assert.equal(commands[0].p_request,commands[1].p_request);assert.equal(context.__infCommits,1);
 assert.equal(infirmary.pending,null);assert.equal(storage.size,0);assert.equal(infirmary.state.injuries[5].status,'treating');
 assert.equal(infirmary.state.inventory.find(i=>i.sku==='linen_bandage').quantity,19,'Authoritative receipt preserves one of the two bandages');
 assert.equal(find('inf289-countdown')[0].textContent,'12:00:00');assert.equal(find('inf289-finish')[0].disabled,true);assert.match(find('inf289-saved')[0].textContent,/Keten Sargı Bezi × 1/);
 advance(30000);assert.equal(find('inf289-countdown')[0].textContent,'11:59:30');
 await assert.rejects(()=>infirmary.finish('treatment-injury-5'),error=>/henüz dolmadı/.test(error.message));assert.equal(infirmary.pending,null);assert.equal(infirmary.state.injuries[5].status,'treating');
 advance(43200000);assert.equal(find('inf289-finish')[0].disabled,false);
 await assert.rejects(()=>infirmary.finish('treatment-injury-5'),error=>/henüz dolmadı/.test(error.message));assert.equal(infirmary.state.injuries[5].status,'treating','A displayed zero never overrides server time');
 context.__infNow+=43200000;await infirmary.finish('treatment-injury-5');assert.equal(infirmary.state.injuries[5].status,'healed');assert(find('inf289-filters')[0].textContent.includes('Tamamlanan · 1'));
 for(const [id,seconds]of [['injury-1',10800],['injury-6',43200],['injury-10',86400]]){infirmary.open({injuryId:id});await settle();assert.equal(infirmary.preview.duration_seconds,seconds);if(id==='injury-10'){assert.match(find('inf289-recovery')[0].textContent,/Ballı Sirke toplam 5,02 puan/);assert.match(find('inf289-recovery')[0].textContent,/İncir taburculukta 5,02 puan/);}}
 context.__infFixture.inventory.find(i=>i.sku==='linen_bandage').quantity=0;await infirmary.refresh();await settle();assert.equal(infirmary.preview.can_start,false);assert.equal(find('inf289-start')[0].disabled,true);assert.match(find('inf289-action-note')[0].textContent,/eksik/);
 find('inf289-production')[0].onclick();assert.equal(production,1);assert.equal(infirmary.visible,false);assert(opened>=2&&closed>=2);assert(events.some(event=>event.type==='ludus-infirmary-change'));
 console.log('PASS V289 infirmary contract: severity durations, full stock requirements, doctor saving receipt, persisted idempotent retry, server-owned countdown/finish, shortages and production navigation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
