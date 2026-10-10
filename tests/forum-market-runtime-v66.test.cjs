// Execute the real UI controller with a minimal DOM and an RPC boundary.
// This checks behavior; browser layout/paint is deliberately not simulated.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
function harness(){
 const registry=new Map(),listeners=new Map(),storage=new Map();
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.handlers={};this.hidden=false;this.disabled=false;this.value='';this._html='';this.textContent='';this.open=false;this.className='';this.classList={toggle:(c,on)=>{const s=new Set(this.className.split(' ').filter(Boolean));if(on)s.add(c);else s.delete(c);this.className=[...s].join(' ');},contains:c=>this.className.split(' ').includes(c)};}
  append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;this._html='';this.textContent='';}
  set innerHTML(html){this._html=html;this.children=[];for(const m of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const e=new Element(m[1]);e.id=m[2];registry.set(e.id,e);this.children.push(e);}}get innerHTML(){return this._html;}
  setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,f){this.handlers[k]=f;}focus(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 const html=fs.readFileSync(path.join(root,'pazar.html'),'utf8');
 for(const m of html.matchAll(/<(\w+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const e=new Element(m[1]);e.id=m[2];e.hidden=/\bhidden\b/.test(m[0]);e.disabled=/\bdisabled\b/.test(m[0]);registry.set(e.id,e);}
 const rail=['basic','forum'].map(s=>{const b=new Element('button');b.dataset.marketSection=s;return b;});
 registry.get('forumDuration').children=[6,12,24].map(h=>{const b=new Element('button');b.dataset.hours=String(h);return b;});
 const $=id=>{if(!registry.has(id))throw Error('Missing DOM id '+id);return registry.get(id);};
 const owner='00000000-0000-4000-8000-000000000001',itemId='00000000-0000-4000-8000-000000000011',listingId='00000000-0000-4000-8000-000000000022';
 const item={id:itemId,kind:'weapon',model:'gladius',enhancement:5,stat_version:10,natural_stats:{physical_power:7,critical_rate:3,critical_damage:5,block_rate:3,block_power:5,armor_penetration:3},natural_percentages:{physical_power:70},emeralds:[],rubies:[]};
 let wallet=5000,currentOwner=null,failCreate=true;const calls=[];
 let state={gold:5000,server_now:new Date().toISOString(),items:[item],gladiators:[],mine:[],sales:[],listings:[{id:listingId,asset:item,price:800,seller:'Aquila',own:false,created_at:new Date().toISOString(),expires_at:'2099-01-01T00:00:00Z',status:'active'}]};
 const client={rpc:async(name,args)=>{calls.push({name,args:structuredClone(args)});if(args.p_action==='state')return {data:structuredClone(state),error:null};if(args.p_action==='create'){
  if(failCreate){failCreate=false;throw Error('Network dropped after submit');}
  state.items=[];state.mine=[{id:'00000000-0000-4000-8000-000000000033',snapshot:item,price:1001,status:'active'}];return {data:structuredClone(state),error:null};
 }if(args.p_action==='buy'){state.gold=4200;state.listings=[];state.items=[item];return {data:structuredClone(state),error:null};}return {data:structuredClone(state),error:null};}};
 const basic={client,getOwner:()=>currentOwner,getGold:()=>wallet,setGold:n=>{wallet=n;},getNavigationState:()=>({category:'Gıda',productPage:1})};
 const context={console,URL,Date,Math,Number,String,Object,Array,Map,Set,JSON,structuredClone,crypto:{randomUUID:()=>crypto.randomUUID()},setTimeout:()=>0,clearTimeout:()=>{},location:{href:'https://game.example/pazar.html'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},document:{getElementById:$,createElement:t=>new Element(t),querySelectorAll:s=>s==='[data-market-section]'?rail:[],addEventListener:()=>{},hidden:false},addEventListener:(k,f)=>listeners.set(k,f),LudusBasicMarket:basic,LudusIcons:{svg:()=>'<svg></svg>'},LudusGems:{svg:()=>'<svg></svg>'},LudusNavigation:{register:fn=>context.navigation=fn,restore:()=>null}};
 vm.createContext(context);const itemCode=html.slice(html.indexOf('var LudusItemSystem ='),html.indexOf("if(typeof module!=='undefined'&&module.exports)module.exports=LudusItemSystem;"));vm.runInContext(itemCode,context);vm.runInContext(fs.readFileSync(path.join(root,'forum-market-v66.js'),'utf8'),context);
 return {$,rail,context,calls,storage,wallet:()=>wallet,auth:()=>{currentOwner=owner;listeners.get('ludus-basic-market-ready')();}};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('real controls connect after auth, compute net income, recover a submit and adopt a purchase',async()=>{
 const h=harness(),$=h.$;h.rail[1].onclick();assert.equal($('basicMarket').hidden,true);assert.equal($('forumMarket').hidden,false);assert.equal(h.calls.length,0);
 h.auth();await tick();assert.equal($('forumListings').children.length,1);assert.equal($('forumBuy').disabled,false);
 assert.equal(h.context.navigation().category,'Gıda');assert.equal(h.context.navigation().marketSection,'forum');
 $('forumNewListing').onclick();assert.equal($('forumCreate').hidden,false);assert.equal($('forumPublish').disabled,true);
 $('forumPrice').value='1001';$('forumPrice').oninput();assert.equal($('forumNet').textContent,'950');assert.equal($('forumPublish').disabled,false);
 $('forumDuration').children[1].onclick();$('forumCreate').onsubmit({preventDefault(){}});assert.equal($('forumPublish').disabled,true);await tick();
 assert.equal(h.storage.size,1);assert.equal(h.wallet(),5000);assert.equal($('forumPublish').disabled,true);
 const retry=$('forumNotice').children.find(e=>e.textContent==='Yeniden dene');assert.ok(retry);retry.onclick();await tick();
 const creates=h.calls.filter(r=>r.args.p_action==='create');assert.equal(creates.length,2);assert.deepEqual(creates[0].args,creates[1].args);assert.equal(creates[0].args.p_payload.hours,12);assert.equal(creates[0].args.p_payload.price,1001);assert.equal(h.storage.size,0);assert.equal($('forumBrowse').hidden,false);assert.equal($('forumMine').children.length,1);
 $('forumBuy').onclick();assert.equal($('forumDialogs').open,true);$('forumConfirmYes').onclick();assert.equal(h.wallet(),5000);await tick();assert.equal(h.wallet(),4200);assert.equal($('forumBuy').disabled,true);assert.equal(h.calls.filter(r=>r.args.p_action==='buy').length,1);
 $('forumQuery').value='<script>';$('forumQuery').handlers.input();assert.equal($('forumListings').children.length,0);
});
