// Actual multiplayer controller: maintain the mobile pose budget without losing
// its cadence, and show state changes on the first eligible display frame.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const ids=['duelControls','mpBack','selfHp','rivalHp','selfName','rivalName','aliveCount','matchLobby','mpBattleHud','queueCount','queueMessage','queueSeconds','queueCaption','queueRing','queueProgress','queueNames','duelCanvas','duelResult','resultTitle','mpRetry','queueCancel','resultBack','mpStatus','duelLoot','duelLootRetry','duelLootStatus','duelPapyrusRewards'];
const html='<div class="queue-sky"></div><div class="queue-colosseum"></div><b class="queue-beta"></b><div class="queue-title"><h1></h1><span></span></div><div class="mp-top"><strong></strong></div><div class="mp-rule"></div>'+ids.map(id=>id==='selfHp'||id==='rivalHp'?`<progress id="${id}"></progress>`:id==='duelResult'?'<div id="duelResult"><p></p></div>':`<div id="${id}"></div>`).join('');
async function fixture(){
 const dom=new JSDOM(html,{url:'https://fixture.invalid/multiplayer.html?venue=ranked',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){}});Object.defineProperty(w.navigator,'maxTouchPoints',{value:5});
 Object.defineProperties(w.document.getElementById('duelCanvas'),{clientWidth:{value:844},clientHeight:{value:390}});
 for(const file of ['owner-three-r160.js','multiplayer-motion-v251.js','combat-specials-v261.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 const T=w.THREE,players=Array.from({length:10},(_,i)=>({owner:String(i),bot_v249:i>0,name:'G'+i,class:'murmillo',ranked_team:i<5?'a':'b',ranked_joined:true,gladiator:{},items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'}],x:i*.1,z:i===0?0:i<5?3:8,angle:0,hp:100,maxHp:100,stamina:100,maxStamina:100,serial:0,block:false,move:0}));
 const room={id:'cadence-fixture',status:'playing',players,combat_version:23,controls_version:77};let queued=[],clock=0;
 const models=[],fighters=[],counts=Array(10).fill(0),visible=Array(10).fill(true),samples=Array.from({length:10},()=>[]);
 Object.defineProperty(w.performance,'now',{value:()=>clock});const epoch=Date.now();w.Date.now=()=>epoch+clock;
 w.requestAnimationFrame=fn=>{queued.push(fn);return queued.length};w.setTimeout=()=>1;w.clearTimeout=()=>{};
 w.sessionStorage.setItem('ludus-ranked-room',room.id);
 const client={auth:{getUser:async()=>({data:{user:{id:'0',is_anonymous:false}}})},rpc:async()=>({data:room,error:null})};
 w.LudusClient={create:()=>client};w.ARENA_SUPABASE_CONFIG={};
 w.ArenaCreateRenderer=()=>({setSize(){},setPixelRatio(){},getPixelRatio(){return 1},render(){},capabilities:{getMaxAnisotropy(){return 1}}});
 w.ArenaRuntime={frameDelta:(t,last)=>Math.min(.25,Math.max(0,(t-last)/1000)),RenderScale:class{resize(width,height,ratio){this.width=width;this.height=height;this.sourceRatio=ratio}reset(){}sample(){}}};
 w.RomanVisualAssets={environment(){},material(){}};
 w.ImportedGladiator={load:async()=>{},create(i){return models[i]={id:i,root:new T.Group(),teamMark:new T.Group()}},animate(f,m,t,dt){counts[m.id]++;fighters[m.id]=f;samples[m.id].push({time:clock,dt,move:f.move,block:f.blocking,reaction:f.reaction,guardFlash:f.guardFlash,passiveEvade:f.passiveEvade});m.root.position.set(f.x,0,f.z);m.root.rotation.y=f.angle}};
 w.ArenaCombat=class{reset(){return {fighters:[{}]}}};w.LudusLoadout={apply(f){f.weapon='gladius'}};
 w.ArenaMotion={regions:{chest:{name:'Gövde'}},profile:()=>({length:1,duration:1}),impactQuality:()=>1,authored:{reach(){}}};
 w.GamePerformance={beginVisibility(){},characterVisibility(m,keep){m.root.visible=keep||visible[m.id]}};
 w.CombatPointer={stick(element,options){return {reset(){options.change(0,0)}}}};w.CombatEvasionControls={mount(){}};
 w.eval(fs.readFileSync(path.join(root,'multiplayer-v36.js'),'utf8').replace('\n(()=>{','\nColosseumEnvironment.load=async()=>{};\n(()=>{'));
 for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
 function frame(ms=1000/60){const fn=queued.shift();assert.ok(fn,'the controller schedules its render loop');const before=counts.slice();clock+=ms;fn(clock);return counts.map((n,i)=>n-before[i])}
 function waitPose(id){const before=counts[id];for(let i=0;i<30&&counts[id]===before;i++)frame();assert.ok(counts[id]>before,'fixture reached a fresh pose')}
 return {dom,players,models,fighters,counts,visible,samples,frame,waitPose,now:()=>clock};
}
for(const fps of [30,59.94,60,60.01,119.88,120])test('actual Ranked pose cadence remains 20/10 Hz at '+fps+' display FPS',async()=>{
 const f=await fixture();
 try{
  for(let i=0;i<Math.round(2*fps);i++)f.frame(1000/fps);
  const initial=f.counts.slice(),start=f.now(),frames=Math.round(10*fps);let peakRemote=0;
  for(let i=0;i<frames;i++)peakRemote=Math.max(peakRemote,f.frame(1000/fps).slice(1).reduce((a,b)=>a+b,0));
  const seconds=(f.now()-start)/1000;
  assert.equal(f.counts[0]-initial[0],frames,'local fighter updates every display frame');
  for(let i=1;i<10;i++){const count=f.counts[i]-initial[i],expected=seconds*(i<5?20:10);assert.ok(Math.abs(count-expected)<=2,`fighter ${i}: ${count} poses vs ${expected.toFixed(2)} budget`)}
  assert.ok(peakRemote<9,'routine updates do not synchronize all nine remote rigs on one frame');
 }finally{f.dom.window.close()}
});
test('irregular display intervals keep pose cadence without catch-up bursts',async()=>{
 const f=await fixture(),intervals=[8,16,24,18,17,15];
 try{
  for(let i=0;i<120;i++)f.frame(intervals[i%intervals.length]);
  const initial=f.counts.slice(),start=f.now();let frames=0;
  while(f.now()-start<10000){const calls=f.frame(intervals[frames++%intervals.length]);assert.ok(calls.every(n=>n<=1),'at most one full pose per fighter per frame')}
  const seconds=(f.now()-start)/1000;
  for(let i=1;i<10;i++)assert.ok(Math.abs(f.counts[i]-initial[i]-seconds*(i<5?20:10))<=2,'jitter does not accumulate scheduling drift');
  const before=f.counts.slice();f.frame(1500);assert.ok(f.counts.every((n,i)=>n-before[i]===1),'a long display stall poses once rather than replaying missed poses');
 }finally{f.dom.window.close()}
});
test('walking and blocking changes pose immediately between scheduled updates',async()=>{
 const f=await fixture();
 try{
  f.waitPose(1);
  for(const change of [{move:1},{move:0},{block:true},{block:false}]){
   const before=f.counts[1];Object.assign(f.players[1],change);f.frame(1);
   assert.equal(f.counts[1],before+1,'next display frame shows '+JSON.stringify(change));
   const sample=f.samples[1].at(-1);for(const [key,value]of Object.entries(change))assert.equal(sample[key==='block'?'block':key],value);
  }
  const before=f.counts[1];f.frame(1);assert.equal(f.counts[1],before,'an unchanged state does not force another expensive pose');
 }finally{f.dom.window.close()}
});
for(const effect of ['reaction','guardFlash','passiveEvade'])test(effect+' expiry poses immediately before the next routine deadline',async()=>{
 const f=await fixture();
 try{
  f.waitPose(1);
  if(effect==='reaction')f.players[1].hp-=1;
  else Object.assign(f.players[1],{defense_serial:1,last_defense:effect==='passiveEvade'?'evade':'perfect'});
  const before=f.counts[1];f.frame(1);assert.equal(f.counts[1],before+1,'defense/hit starts on the next display frame');
  assert.ok(f.fighters[1][effect]>0,'fixture has an active visual response');
  while(f.fighters[1][effect]>.25)f.frame(100);
  f.frame((f.fighters[1][effect]-.001)*1000);
  const last=f.counts[1];assert.ok(f.samples[1].at(-1)[effect]>0,'a fresh pose still contains the response');
  f.frame(2);assert.equal(f.counts[1],last+1,'expired response is cleared on the next display frame');
  assert.equal(f.samples[1].at(-1)[effect],0);
 }finally{f.dom.window.close()}
});
test('a hidden remote poses on its first visible frame even before its old deadline',async()=>{
 const f=await fixture();
 try{
  f.waitPose(9);const before=f.counts[9];f.visible[9]=false;f.frame(1);assert.equal(f.counts[9],before,'hidden fighter skips skeletal work');
  f.visible[9]=true;f.frame(1);assert.equal(f.counts[9],before+1,'visible reentry receives a current pose immediately');
  f.visible[9]=false;f.players[9].move=1;for(let i=0;i<60;i++)f.frame();assert.equal(f.counts[9],before+1,'even changing hidden fighters stay culled');
  f.visible[9]=true;f.frame(1);assert.equal(f.counts[9],before+2);assert.equal(f.samples[9].at(-1).move,1);
  assert.ok(f.samples[9].at(-1).dt<=.25,'return from culling keeps a bounded animation delta');
 }finally{f.dom.window.close()}
});
