// The actual multiplayer controller must not turn raw network position steps
// into camera aim jumps. No GPU, live account or server mutation is required.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const ids=['duelControls','mpBack','selfHp','rivalHp','selfName','rivalName','aliveCount','matchLobby','mpBattleHud','queueCount','queueMessage','queueSeconds','queueCaption','queueRing','queueProgress','queueNames','duelCanvas','duelResult','resultTitle','mpRetry','queueCancel','resultBack','mpStatus','duelLoot','duelLootRetry','duelLootStatus','duelPapyrusRewards'];
const html='<div class="queue-sky"></div><div class="queue-colosseum"></div><b class="queue-beta"></b><div class="queue-title"><h1></h1><span></span></div><div class="mp-top"><strong></strong></div><div class="mp-rule"></div>'+ids.map(id=>id==='selfHp'||id==='rivalHp'?`<progress id="${id}"></progress>`:id==='duelResult'?'<div id="duelResult"><p></p></div>':`<div id="${id}"></div>`).join('');
async function fixture(fps){
 const dom=new JSDOM(html,{url:'https://fixture.invalid/multiplayer.html?venue=ranked',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 w.matchMedia=()=>({matches:true,addEventListener(){}});Object.defineProperty(w.navigator,'maxTouchPoints',{value:5});
 Object.defineProperties(w.document.getElementById('duelCanvas'),{clientWidth:{value:844},clientHeight:{value:390}});
 for(const file of ['owner-three-r160.js','multiplayer-motion-v251.js','combat-specials-v261.js'])w.eval(fs.readFileSync(path.join(root,file),'utf8'));
 const T=w.THREE,players=Array.from({length:3},(_,i)=>({owner:String(i),bot_v249:i>0,name:'G'+i,class:'murmillo',ranked_team:i?'b':'a',ranked_joined:true,gladiator:{},items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'}],x:i===2?-10:0,z:i===0?-1:4,angle:0,hp:100,maxHp:100,stamina:100,maxStamina:100,serial:0,block:false}));
 const room={id:'camera-fixture',status:'playing',players,combat_version:23,controls_version:77};let queued=[],clock=0,camera;
 const models=[];
 Object.defineProperty(w.performance,'now',{value:()=>clock});w.requestAnimationFrame=fn=>{queued.push(fn);return queued.length};w.setTimeout=()=>1;w.clearTimeout=()=>{};
 w.sessionStorage.setItem('ludus-ranked-room',room.id);
 const client={auth:{getUser:async()=>({data:{user:{id:'0',is_anonymous:false}}})},rpc:async()=>({data:room,error:null})};
 w.LudusClient={create:()=>client};w.ARENA_SUPABASE_CONFIG={};
 w.ArenaCreateRenderer=()=>({setSize(){},setPixelRatio(){},getPixelRatio(){return 1},render(scene,c){camera=c},capabilities:{getMaxAnisotropy(){return 1}}});
 w.ArenaRuntime={frameDelta:(t,last)=>Math.min(.25,Math.max(0,(t-last)/1000)),RenderScale:class{resize(width,height,ratio){this.width=width;this.height=height;this.sourceRatio=ratio}reset(){}sample(){}}};
 w.RomanVisualAssets={environment(){},material(){}};
 w.ImportedGladiator={load:async()=>{},create(i){return models[i]={root:new T.Group(),teamMark:new T.Group()}},animate(f,m){m.root.position.set(f.x,0,f.z);m.root.rotation.y=f.angle}};
 w.ArenaCombat=class{reset(){return {fighters:[{}]}}};w.LudusLoadout={apply(f){f.weapon='gladius'}};
 w.ArenaMotion={regions:{chest:{name:'Gövde'}},profile:()=>({length:1,duration:1}),impactQuality:()=>1,authored:{reach(){}}};
 w.GamePerformance={beginVisibility(){},characterVisibility(m){m.root.visible=true}};
 w.CombatPointer={stick(element,options){return {reset(){options.change(0,0)}}}};w.CombatEvasionControls={mount(){}};
 w.eval(fs.readFileSync(path.join(root,'multiplayer-v36.js'),'utf8').replace('\n(()=>{','\nColosseumEnvironment.load=async()=>{};\n(()=>{'));
 for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
 function frame(){const fn=queued.shift();assert.ok(fn,'the controller schedules its render loop');clock+=1000/fps;fn(clock)}
 function aim(){const direction=camera.getWorldDirection(new T.Vector3());return direction.multiplyScalar((1.1-camera.position.y)/direction.y).add(camera.position)}
 function settle(){for(let i=0;i<fps*3;i++)frame()}
 return {dom,players,models,frame,aim,settle};
}
async function main(){
 const report=[];
 for(const fps of [30,60,120]){
  const f=await fixture(fps);
  try{
   f.settle();const before=f.aim();
   // A sparse network update moves the enemy, but its rendered rig and camera
   // should both approach the new location over subsequent display frames.
   f.players[1].x=3;f.frame();
   const first=f.aim(),visibleGoalX=f.models[0].root.position.x*.8+f.models[1].root.position.x*.2;
   assert.ok(first.x>before.x,'camera starts following the moving target immediately');
   assert.ok(first.x-before.x<(visibleGoalX-before.x)*.35,'camera aim advances only a fraction toward the displayed target, not to the raw network point');
   let previous=first.x;
   for(let i=0;i<fps;i++){f.frame();const x=f.aim().x;assert.ok(x>=previous-1e-7,'a single target update settles without reversing');previous=x}
   f.settle();assert.ok(Math.abs(f.aim().x-.6)<.001,'camera eventually tracks the target without permanent offset');
   // Losing the closest target selects the already visible second enemy.
   // Selection may change immediately; the view must turn continuously.
   const old=f.aim();f.players[1].hp=0;f.frame();const swapped=f.aim();
   assert.ok(swapped.x<old.x,'view starts turning toward the next enemy');
   assert.ok(old.x-swapped.x<.65,'target replacement does not snap the camera to the next enemy');
   f.settle();assert.ok(Math.abs(f.aim().x+2)<.001,'camera finishes the target change');
   report.push({fps,networkAimStep:Number((first.x-before.x).toFixed(5)),targetSwapStep:Number((old.x-swapped.x).toFixed(5))});
  }finally{f.dom.window.close()}
 }
 console.log('PASS V291: actual multiplayer camera smoothly follows displayed targets and target changes at 30/60/120 FPS: '+JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1});
