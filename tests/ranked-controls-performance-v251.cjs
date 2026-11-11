// Exercise the actual multiplayer loop and touch inputs without a GPU or real account.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const ids=['duelControls','mpBack','selfHp','rivalHp','selfName','rivalName','aliveCount','matchLobby','mpBattleHud','queueCount','queueMessage','queueSeconds','queueCaption','queueRing','queueProgress','queueNames','duelCanvas','duelResult','resultTitle','mpRetry','queueCancel','resultBack','mpStatus'];
const html='<div class="queue-sky"></div><div class="queue-colosseum"></div><b class="queue-beta"></b><div class="queue-title"><h1></h1><span></span></div><div class="mp-top"><strong></strong></div><div class="mp-rule"></div>'+ids.map(id=>id==='selfHp'||id==='rivalHp'?`<progress id="${id}"></progress>`:id==='duelResult'?'<div id="duelResult"><p></p></div>':`<div id="${id}"></div>`).join('');
async function main(){
 const dom=new JSDOM(html,{url:'https://fixture.invalid/multiplayer.html?venue=ranked',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.matchMedia=()=>({matches:true,addEventListener(){}});Object.defineProperty(w.navigator,'maxTouchPoints',{value:5});
 Object.defineProperties(w.document.getElementById('duelCanvas'),{clientWidth:{value:844},clientHeight:{value:390}});
 w.eval(fs.readFileSync(root+'/owner-three-r160.js','utf8'));
 w.eval(fs.readFileSync(root+'/multiplayer-motion-v251.js','utf8'));
 w.eval(fs.readFileSync(root+'/combat-specials-v261.js','utf8'));
 const T=w.THREE,owner='human',match='fixture',players=Array.from({length:10},(_,i)=>({owner:i?String(i):owner,bot_v249:i>0,name:'G'+i,class:'murmillo',ranked_team:i<5?'a':'b',ranked_joined:true,gladiator:{},items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'}],x:0,z:i<5?-1:6+i,angle:0,hp:100,maxHp:100,stamina:100,maxStamina:100,serial:0,block:false}));
 const room={id:match,status:'playing',players,combat_version:23,controls_version:77};let frames=[],clock=0,lastInput=null;const poseCounts=Array(10).fill(0),models=[],timeouts=[];
 w.requestAnimationFrame=fn=>{frames.push(fn);return frames.length};
 w.setTimeout=(fn,ms)=>{timeouts.push(ms);return timeouts.length};w.clearTimeout=()=>{};
 w.sessionStorage.setItem('ludus-ranked-room',match);
 const client={auth:{getUser:async()=>({data:{user:{id:owner,is_anonymous:false}}})},rpc:async(name,args)=>{if(args.p_input)lastInput=args.p_input;return {data:room,error:null}}};
 w.LudusClient={create:()=>client};w.supabase={createClient:()=>client};w.ARENA_SUPABASE_CONFIG={};
 w.ArenaCreateRenderer=()=>({setSize(){},setPixelRatio(){},getPixelRatio(){return 1},render(scene,camera){w.fixtureCamera=camera},capabilities:{getMaxAnisotropy(){return 1}}});
 w.ArenaRuntime={frameDelta:(t,last)=>Math.min(.25,Math.max(0,(t-last)/1000)),RenderScale:class{resize(width,height,ratio){this.width=width;this.height=height;this.sourceRatio=ratio}reset(){}sample(){}}};
 w.RomanVisualAssets={environment(){},material(){}};
 w.ImportedGladiator={load:async()=>{},create(i){const model={id:i,root:new T.Group(),teamMark:new T.Group()};models[i]=model;return model},animate(f,m){poseCounts[m.id]++;m.root.position.set(f.x,0,f.z);m.root.rotation.y=f.angle}};
 w.ArenaCombat=class{reset(){return {fighters:[{}]}}};w.LudusLoadout={apply(f){f.weapon='gladius'}};
 w.ArenaMotion={regions:{chest:{name:'Gövde'}},profile:()=>({length:1,duration:1}),impactQuality:()=>1,authored:{reach(){}}};
 w.GamePerformance={beginVisibility(){},characterVisibility(m,keep){m.root.visible=keep||m.id%2===0}};
 w.CombatPointer={stick(element,options){w.fixtureStick=options;return {reset(){options.change(0,0)}}}};
 w.CombatEvasionControls={mount(){}};
 let source=fs.readFileSync(root+'/multiplayer-v36.js','utf8').replace('\n(()=>{','\nColosseumEnvironment.load=async()=>{};\n(()=>{');
 w.eval(source);
 for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(w.document.getElementById('duelControls').hidden,false,'match becomes playable');
 function frame(){const fn=frames.shift();assert.ok(fn,'render loop is scheduled');clock+=1000/60;fn(clock)}
 for(let i=0;i<90;i++)frame();
 for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  for(let i=5;i<10;i++){players[i].x=Math.sin(angle)*(6+i/10);players[i].z=Math.cos(angle)*(6+i/10)}
  for(let i=0;i<90;i++)frame();
  const forward=new T.Vector3();w.fixtureCamera.getWorldDirection(forward);forward.y=0;forward.normalize();const right=new T.Vector3(1,0,0).applyQuaternion(w.fixtureCamera.quaternion);right.y=0;right.normalize();
  for(const [x,z,axis,sign]of [[1,0,right,1],[-1,0,right,-1],[0,-1,forward,1],[0,1,forward,-1]]){
   lastInput=null;w.fixtureStick.change(x,z);for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));
   assert.ok(lastInput,'touch input reaches multiplayer RPC');
   assert.ok(sign*(lastInput.x*axis.x+lastInput.z*axis.z)>.99,`screen input ${x},${z} follows camera at angle ${angle}`);
   assert.equal(timeouts.at(-1),50,'held movement in a bot match is refreshed promptly');
  }
 }
 w.fixtureStick.change(0,0);for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(timeouts.at(-1),120,'idle polling keeps its normal rate');
 const before=poseCounts.slice();for(let i=0;i<60;i++)frame();const deltas=poseCounts.map((n,i)=>n-before[i]);
 assert.equal(deltas[0],60,'the player stays fully responsive');
 assert.ok(deltas.filter((n,i)=>i>0&&i%2===1).every(n=>n===0),'offscreen fighters skip expensive posing');
 assert.ok(deltas.filter((n,i)=>i>0&&i%2===0).every(n=>n>0&&n<=21),'visible fighters use the mobile pose budget');
 players[2].serial++;const old=poseCounts[2];frame();assert.equal(poseCounts[2],old+1,'a new visible attack is posed immediately');
 players[1].x=2;frame();assert.ok(models[1].root.position.x>0,'an offscreen fighter still tracks its current position');
 players[0].items.push({kind:'shield',equipped_slot:'off_hand',model:'large'});players[5].x=0;players[5].z=0;players[0].x=0;players[0].z=-1;
 w.fixtureStick.change(.01,0);for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(w.document.getElementById('duelHand'),null);
 assert.match(w.document.getElementById('duelSpecial').textContent,/SAĞ.*İKİ VURUŞ/);
 assert.match(w.document.getElementById('duelSpecialLeft').textContent,/SOL.*İTTİR/);
 for(const [id,hand]of [['duelSpecial','main_hand'],['duelSpecialLeft','off_hand']]){lastInput=null;w.document.getElementById(id).click();for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(lastInput.special,true);assert.equal(lastInput.hand,hand);assert.ok(lastInput.special_id);}
 console.log('PASS V261: actual right/left button events send separate equipped hands; no switch button.');
 console.log('PASS V251: real game loop maps touch left/right/forward/back to four camera headings; mobile self, visible and offscreen animation scheduling, immediate attacks, and position tracking.');
 dom.window.close();
}
main().catch(e=>{console.error(e);process.exitCode=1});
