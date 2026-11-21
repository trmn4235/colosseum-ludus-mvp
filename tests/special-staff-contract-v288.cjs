// UI state/command tests without a browser. Layout is tested separately in Playwright.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {catalog,script}=require('./special-staff-fixture-v288.cjs');
const root=path.resolve(__dirname,'..');
class Node {
 constructor(tag='text',text=''){this.tagName=tag.toUpperCase();this.children=[];this.className='';this.dataset={};this.attributes={};this.style={setProperty(){}};this._text=text;this.hidden=false;this.disabled=false;this.isConnected=true;this.classList={add:name=>{this.className+=' '+name;}};}
 append(...nodes){this.children.push(...nodes.map(node=>typeof node==='string'?new Node('text',node):node));}
 replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
 set textContent(value){this._text=String(value);this.children=[];}
 get textContent(){return this._text+this.children.map(node=>node.textContent).join('');}
 setAttribute(name,value){this.attributes[name]=String(value);}
 getAttribute(name){return this.attributes[name];}
 addEventListener(){}
 focus(){document.activeElement=this;}
 getClientRects(){return this.hidden?[]:[{}];}
 close(){this.open=false;}
 showModal(){this.open=true;}
}
const document={body:new Node('body'),activeElement:null,createElement:tag=>new Node(tag),createElementNS:(_namespace,tag)=>new Node(tag),createTextNode:text=>new Node('text',text)};
const local=new Map(),events=[],calculations=[];
const context={document,innerHeight:900,innerWidth:1440,Intl,URL,crypto:{randomUUID},structuredClone,
 localStorage:{getItem:key=>local.get(key)||null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)},
 location:{href:'https://example.test/ludus.html?staff=guard&keep=yes'},history:{replaceState(_a,_b,url){context.location.href=String(url);}},
 addEventListener(){},dispatchEvent:event=>events.push(event),CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
 testUser:{id:'ui-owner'},__testClient:{rpc:async(name,args)=>({data:{user_id:'ui-owner',role:args.p_role,staff:[],papyri:[],paper_count:0,page:0}})}};
context.window=context;vm.createContext(context);
for(const file of ['special-staff-people-v284.js','special-staff-v288.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
vm.runInContext(script(),context);
const profile=context.LudusSpecialStaff.create({ready:Promise.resolve({user_id:'ui-owner'}),client:context.__testClient,openCalculation:role=>calculations.push(role)});
const nodes=(base=document.body)=>[base,...base.children.flatMap(child=>nodes(child))];
const findClass=name=>nodes().filter(node=>node.className.split(' ').includes(name));
const clickText=(className,text)=>{const node=findClass(className).find(node=>node.textContent===text);assert(node,`${className}: ${text}`);assert(!node.disabled);return node.onclick();};
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const overall=()=>findClass('ss288-overall')[0].textContent;
(async()=>{
 assert.equal(catalog.length,150);assert.equal(new Set(catalog.map(p=>p.content_id)).size,150);
 profile.openDirectory();await settle();assert.equal(findClass('ss288-person').length,6);
 for(const role of ['trainer','cook','doctor','smith','guard','groom']){
  profile.open(role);await settle();assert.equal(profile.state.papyri.length,25);
  assert.equal(overall(),'Overall20 / 100','Distinct learned/owned union, including duplicate unread copies');
  assert.equal(findClass('ss288-passive').length,2,'Only active learned effects appear');
  assert.match(findClass('ss288-pending-note')[0].textContent,/1 öğrenilmiş etki/);
  assert.equal(findClass('ss288-calculation').length,role==='smith'?1:0);
 }
 profile.open('smith');await settle();clickText('ss288-calculation','İşlem hesabı');assert.deepEqual(calculations,['smith']);
 findClass('ss288-info')[0].onclick();assert.match(findClass('ss288-dialog')[0].textContent,/belirtilen oyun koşulunda/);findClass('ss288-dialog-close')[0].onclick();
 clickText('ss288-tab','Papirüsler');
 assert.equal(findClass('ss288-ownership')[0].children.find(node=>node.getAttribute('aria-pressed')==='true').textContent,'Hepsi');
 for(const [rarity,label,total]of [['common','Yaygın',12],['rare','Nadir',8],['very_rare','Çok nadir',4],['unique','Eşsiz',1]]){
  findClass('ss288-rarity-tabs')[0].children.find(node=>node.textContent===label).onclick();
  assert.equal(findClass('ss288-paper-row').length,total);assert.equal(profile.archive.papyri.length,total);
  findClass('ss288-ownership')[0].children.find(node=>node.textContent==='Olmayanlar').onclick();
  assert(profile.archive.papyri.every(p=>!p.learned&&!p.owned_quantity));
  findClass('ss288-ownership')[0].children.find(node=>node.textContent==='Olanlar').onclick();
  assert(profile.archive.papyri.every(p=>p.learned||p.owned_quantity>0));
  findClass('ss288-ownership')[0].children.find(node=>node.textContent==='Hepsi').onclick();
 }
 const unread=profile.state.papyri.find(p=>p.ordinal===3);context.__papyrusFailOnce=true;
 await assert.rejects(()=>profile.readPaper(unread),/Bağlantı kesildi/);
 const request=profile.pendingRead.request;assert(request);assert(local.has('ludus-staff-read-v288:ui-owner'));
 assert.equal(profile.state.papyri.find(p=>p.ordinal===3).learned,false,'No optimistic learning after a lost response');
 await profile.retryRead();assert.equal(profile.pendingRead,null);assert(!local.size);
 assert.equal(context.__papyrusReads.length,2);assert.equal(context.__papyrusReads[0].p_request,request);assert.equal(context.__papyrusReads[1].p_request,request);
 assert.equal(profile.state.papyri.find(p=>p.ordinal===3).owned_quantity,1,'Retry consumes only the original copy');
 clickText('ss288-tab','Ana sayfa');assert.equal(overall(),'Overall20 / 100');assert.equal(findClass('ss288-passive').length,3);assert.equal(findClass('ss288-new').length,1);
 await assert.rejects(()=>profile.readPaper(unread),error=>/zaten öğrenildi/.test(error.message));assert.equal(profile.pendingRead,null);
 const prepared=profile.state.papyri.find(p=>p.ordinal===6);await profile.readPaper(prepared);
 assert.equal(findClass('ss288-passive').length,3,'Prepared knowledge does not claim an active effect');
 assert.match(findClass('ss288-pending-note')[0].textContent,/2 öğrenilmiş/);
 context.__papyrusSetMode('all');await profile.refresh();assert.equal(overall(),'Overall100 / 100');assert.equal(findClass('ss288-passive').length,25);
 assert.deepEqual(findClass('ss288-passive-column').map(node=>node.children.length),[13,12]);
 const labels=new Map();
 for(const role of ['trainer','cook','doctor','smith','guard','groom']){
  profile.open(role);await settle();assert.equal(findClass('ss288-passive').length,25);
  for(const row of findClass('ss288-passive'))labels.set(row.dataset.contentId,row.children[1].textContent);
 }
 assert.equal(labels.size,150,'Every released effect has a meaningful home label');
 for(const id of ['chef_008','chef_020','groom_013','groom_025','guard_011','guard_012'])assert.match(labels.get(id),/%25/,'The condition threshold is preserved for '+id);
 assert.match(labels.get('groom_014'),/%50/);
 assert.match(labels.get('doctor_004'),/Balmumu Merhemi.*Bir doz/);assert.match(labels.get('doctor_005'),/Defne Merhemi.*Bir doz/);
 assert.match(labels.get('doctor_007'),/İncir Şurubu.*yorgunluk giderimi/);
 assert.match(labels.get('doctor_017'),/Kaş yarılması ihtimali/);assert.match(labels.get('doctor_019'),/Derin ön kol kesiği.*sargı koruma/);
 for(const label of labels.values()){assert(label.length>=12);assert(!/(?:^|\s)[’'](?:in|si|ü)\b/.test(label),'No orphaned percentage suffix: '+label);}
 context.__papyrusSetMode('empty');await profile.refresh();assert.equal(overall(),'Overall0 / 100');assert.equal(findClass('ss288-passive').length,0);
 profile.close();assert.equal(profile.visible,false);assert.equal(profile.openFromLink(),true);await settle();
 assert.equal(profile.state.role,'guard');assert.equal(new URL(context.location.href).searchParams.get('staff'),null);assert.equal(new URL(context.location.href).searchParams.get('keep'),'yes');
 assert(events.some(event=>event.type==='ludus-staff-change'));
 console.log('V288 staff UI contract passed: six catalogues, filters, collection union, active status, learning retry and navigation.');
})().catch(error=>{console.error(error);process.exitCode=1;});
