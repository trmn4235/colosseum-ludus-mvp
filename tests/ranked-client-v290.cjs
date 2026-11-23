// Execute the real multiplayer controller against a small DOM and capture its actual RPC inputs.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const HandSpecials=require('../combat-specials-v261.js'),motion=require('../multiplayer-motion-v251.js');
const source=fs.readFileSync(path.join(__dirname,'../multiplayer-v36.js'),'utf8');
const quote=()=>({version:290,owner:'a',gear_serial:2,attack:{main_hand:12.844,off_hand:12.844},dodge:{step:18,duck:18,jump:22,roll:24.7},special:{main_hand:19.266,off_hand:25.688},special_kind:{main_hand:'double',off_hand:'bash'},special_first:{main_hand:12.844,off_hand:25.688},special_second:{main_hand:6.422,off_hand:0}});
function room(stamina,costs=quote()){
 return{id:'room',status:'playing',controls_version:77,combat_version:23,players:[
  {owner:'a',name:'A',ranked_team:'a',hp:100,maxHp:100,stamina,maxStamina:137.5,gear_serial:2,x:0,z:0,items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'},{kind:'shield',model:'large',equipped_slot:'off_hand'}],gladiator:{combat_stamina_bonus:12,combat_morale:80},...(costs?{action_costs_v290:costs}:{})},
  {owner:'b',name:'B',ranked_team:'b',hp:100,maxHp:100,stamina:100,maxStamina:100,x:0,z:1,items:[],gladiator:{}}
 ]};
}
function controller(data,venue='ranked'){
 const nodes=new Map(),events=new Map(),requests=[];
 class Node{
  constructor(){this.style={setProperty(){}};this.classList={toggle(){},add(){},remove(){}};this.attributes={};this.children=new Map();this.hidden=false;}
  set id(id){this._id=id;nodes.set(id,this);}get id(){return this._id;}
  after(){}addEventListener(){}setAttribute(name,value){this.attributes[name]=value;}querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Node());return this.children.get(selector);}
 }
 const node=id=>{if(!nodes.has(id)){const n=new Node();n.id=id;}return nodes.get(id);};
 const sandbox={console,URLSearchParams,Date,Map,Set,Math,Number,Promise,crypto:{randomUUID:()=> 'request-id'},performance:{now:()=>0},
  location:{search:'?venue='+venue},navigator:{maxTouchPoints:0},innerHeight:390,innerWidth:844,devicePixelRatio:1,
  document:{hidden:false,documentElement:new Node(),body:new Node(),getElementById:node,querySelector:node,createElement:()=>new Node(),addEventListener(){}},
  addEventListener(type,fn){events.set(type,fn);},matchMedia:()=>({matches:false}),sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,
  THREE:{Vector3:class{constructor(){this.x=0;this.y=0;this.z=0;}},Raycaster:class{}},
  CombatPointer:{stick:()=>({reset(){}})},CombatEvasionControls:{mount(){}},HandSpecials,MultiplayerMotion:motion,
  ARENA_SUPABASE_CONFIG:{url:'fixture',publishableKey:'fixture'},
  LudusClient:{create:()=>({rpc:(name,args)=>{requests.push({name,args});return new Promise(()=>{});}})}
 };
 sandbox.window=sandbox;sandbox.globalThis=sandbox;vm.createContext(sandbox);
 const boot='requestAnimationFrame(frame);boot();';assert.equal(source.split(boot).length,2,'one renderer boot hook');
 vm.runInContext(source.replace(boot,`globalThis.controllerTest={state(data){owner='a';ready=false;showState(data);ready=true;camera={getWorldDirection(v){v.x=0;v.z=-1;}};},cost:actionCost};`),sandbox);
 sandbox.controllerTest.state(structuredClone(data));
 return{nodes,requests,state:data=>sandbox.controllerTest.state(structuredClone(data)),cost:sandbox.controllerTest.cost,
  attack:()=>node('duelAttack').onclick({detail:0}),special:slot=>node(slot==='off_hand'?'duelSpecialLeft':'duelSpecial').onclick(),
  dodge:()=>node('duelDodge').onpointerdown({preventDefault(){}}),dodgeAccessible:()=>node('duelDodge').onclick({detail:0}),
  key:code=>events.get('keydown')({code,repeat:false,target:{matches:()=>false},preventDefault(){}})};
}
function sent(ui,key){return ui.requests.find(r=>r.args.p_input?.[key]);}
{
 const ui=controller(room(12.85));ui.attack();assert.equal(sent(ui,'attack')?.name,'ludus_ranked_match_v252');
 assert.equal(sent(ui,'attack').args.p_input.hand,'main_hand');assert.match(ui.nodes.get('duelAttack').title,/12,844 kondisyon/);
 assert.equal(ui.nodes.get('selfStamina').max,137.5);assert.equal(ui.nodes.get('selfStamina').value,12.85);
 assert.equal(ui.nodes.get('selfFoodBonus').textContent,'Beslenme +%12 · Moral 80');
}
{
 const ui=controller(room(12.843));ui.attack();assert.equal(sent(ui,'attack'),undefined,'fractional quote is not rounded down for eligibility');
}
for(const [label,perform] of [['touch',ui=>ui.dodge()],['accessible click',ui=>ui.dodgeAccessible()],['KeyL',ui=>ui.key('KeyL')],['KeyB',ui=>ui.key('KeyB')]]){
 const ready=controller(room(24.7)),button=ready.nodes.get('duelDodge');
 assert.equal(button.disabled,false,label+' accepts the exact fractional roll quote');
 assert.match(button.title,/24,7 kondisyon/,'primary control quotes roll, not the 18-stamina step');
 perform(ready);assert.equal(sent(ready,'dodge')?.name,'ludus_ranked_match_v252',label+' submits through the Ranked RPC');
 assert.equal(sent(ready,'dodge').args.p_input.dodge_kind,'roll',label+' requests the actual roll animation/action');
 const short=controller(room(24.699));assert.equal(short.nodes.get('duelDodge').disabled,true,label+' rejects stamina below the exact quote');
 perform(short);assert.equal(sent(short,'dodge'),undefined,label+' cannot bypass the fractional roll threshold');
}
for(const [code,cost,kind] of [['KeyC',18,'duck'],['KeyV',22,'jump']]){
 const ui=controller(room(cost));ui.key(code);assert.equal(sent(ui,'dodge').args.p_input.dodge_kind,kind);
}
{
 const ui=controller(room(19.27));assert.equal(ui.nodes.get('duelSpecial').disabled,false);assert.match(ui.nodes.get('duelSpecial').title,/19,266 kondisyon/);
 ui.special('main_hand');assert.equal(sent(ui,'special').args.p_input.hand,'main_hand');
}
{
 const ui=controller(room(12.85));assert.equal(ui.nodes.get('duelSpecial').disabled,true);ui.special('main_hand');
 assert.equal(sent(ui,'special'),undefined,'double needs the server total for both stages, not only the first13-stamina stage');
}
{
 const ui=controller(room(25.7));assert.equal(ui.nodes.get('duelSpecialLeft').disabled,false);ui.special('off_hand');assert.equal(sent(ui,'special').args.p_input.hand,'off_hand');
}
for(const change of [q=>{q.version=289;},q=>{q.owner='b';},q=>{q.gear_serial=1;},q=>{q.attack.main_hand=-1;},q=>{q.attack.main_hand=NaN;},q=>{q.attack.main_hand=Infinity;},q=>{q.attack.main_hand='12.844';}]){
 const q=quote();change(q);const ui=controller(room(12.85,q));ui.attack();assert.equal(sent(ui,'attack'),undefined,'invalid or other-equipment quotes retain the legacy threshold');
}
{
 const q=quote();q.special_kind.main_hand='throw';const ui=controller(room(19.27,q));ui.special('main_hand');assert.equal(sent(ui,'special'),undefined,'special quote must match the current equipped kind');
}
for(const venue of ['ranked','colosseum','pit']){
 const ui=controller(room(12.85,venue==='ranked'?null:quote()),venue);ui.attack();assert.equal(sent(ui,'attack'),undefined,'old matches and non-Ranked modes retain legacy costs');
}
{
 const ui=controller(room(13,null));ui.attack();assert.equal(sent(ui,'attack').args.p_input.attack,true,'pre-V290 Ranked remains playable');
}
{
 const initial=room(12.85),ui=controller(initial),packet={...initial,delta_version:252,players:initial.players.map(({items,gladiator,...p})=>p)};
 packet.players[0].action_costs_v290.attack.main_hand=12.8;ui.state(packet);assert.equal(ui.cost('attack','main_hand',13),12.8,'compact snapshot replaces its quote');
 delete packet.players[0].action_costs_v290;ui.state(packet);assert.equal(ui.cost('attack','main_hand',13),13,'missing compact quote never reuses an old discount');
 assert.equal(ui.nodes.get('selfStamina').max,137.5,'repeated snapshots do not apply staff/food capacity again');
}
console.log('PASS V290/V293 Ranked client: authoritative fractional action quotes, primary touch/accessible/KeyL/KeyB roll at24.7 stamina, two-stage double total, hand/gear/owner guards, legacy fallback, dynamic quote expiry, and unchanged server stamina capacity.');
