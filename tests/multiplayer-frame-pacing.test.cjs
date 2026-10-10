const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'multiplayer-v36.js'),'utf8');
const threeSource=fs.readFileSync(path.join(root,'owner-three-r160.js'),'utf8');

// Run the production multiplayer controller with real Three.js math and isolated
// DOM/RAF/renderer boundaries. No account, RPC, graphics driver, or wall clock.
function fixture({width=852,height=393,dpr=1.3,hidden=false}={}){
 const callbacks=new Map(),nodes=new Map();let nextFrame=1,now=100000,parses=0,profiles=0;
 function eventTarget(extra={}){const listeners=new Map();return Object.assign({addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatch(type,event={}){for(const fn of listeners.get(type)||[])fn(event);}},extra);}
 function element(){return eventTarget({style:{setProperty(){}},classList:{toggle(){},add(){},remove(){}},after(){},setAttribute(){},setPointerCapture(){},matches(){return false;},clientWidth:width,clientHeight:height,width:0,height:0});}
 const document=eventTarget({hidden,documentElement:element(),body:element(),createElement:element,getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);}});
 const window=eventTarget({visualViewport:eventTarget({height})});
 const stats={renders:0,resizes:[],poses:[]};let renderer;
 class FakeDate extends Date{static now(){return now;}static parse(value){parses++;return Date.parse(value);}}
 const ctx=vm.createContext({console:{...console,warn(){}},window,document,innerHeight:height,devicePixelRatio:dpr,sessionStorage:{getItem(){return null;}},Date:FakeDate,performance:{now(){return now;}},requestAnimationFrame(fn){const id=nextFrame++;callbacks.set(id,fn);return id;},cancelAnimationFrame(id){callbacks.delete(id);},supabase:{createClient(){return {};}},ARENA_SUPABASE_CONFIG:{},RomanVisualAssets:{environment(){},material(){}},ImportedGladiator:{animate(f,m,t,dt){stats.poses.push({dt,t,x:f.x,timer:f.timer,action:f.action,profile:f.attackProfile});}},ArenaMotion:{profile(){profiles++;return {wind:.2,active:.1,recover:.3,duration:.6,length:1};},body(){return {};},sample(){return {};}}});
 vm.runInContext(threeSource,ctx);
 ctx.ArenaCreateRenderer=({canvas})=>renderer={ratio:1,setPixelRatio(value){this.ratio=value;},getPixelRatio(){return this.ratio;},setSize(w,h){stats.resizes.push([w,h]);canvas.width=Math.floor(w*this.ratio);canvas.height=Math.floor(h*this.ratio);},render(){stats.renders++;}};
 const entry=source.slice(source.indexOf('(()=>{'));
 const expose="scheduleFrame();globalThis.testApi={active,makeStage,frame,presentationSnapshot,attackProfile,get renderer(){return renderer;},get last(){return last;},setRoom(value,id='self'){room=value;owner=id;ready=true;},addState(id,f,m){states.set(id,f);models.set(id,m);}};";
 assert.ok(entry.includes('scheduleFrame();boot();'),'test entrypoint tracks production scheduling');
 vm.runInContext(entry.replace('scheduleFrame();boot();',expose),ctx);
 ctx.testApi.makeStage();
 return {ctx,api:ctx.testApi,stats,document,window,nodes,callbacks,get renderer(){return renderer;},get parses(){return parses;},get profiles(){return profiles;},setNow(value){now=value;},tick(t){assert.equal(callbacks.size,1,'only one animation loop is pending');const [id,fn]=callbacks.entries().next().value;callbacks.delete(id);fn(t);},addPlayer(overrides={}){const p={owner:'self',x:2,z:0,angle:0,hp:100,move:1,serial:0,defense_serial:0,wind:.2,active:.1,recover:.3,...overrides};const f={x:0,z:0,angle:0,hp:100,_hp:100,_serial:0,_defenseSerial:0,move:0,walk:0,weapon:'gladius',action:'idle',deadTime:0};this.api.setRoom({status:'playing',combat_version:23,players:[p]});this.api.addState(p.owner,f,{teamMark:{visible:false}});return {p,f};}};
}

test('fractional DPR uses Three r160 floor rounding and resizes only when needed',()=>{
 // Embedded WebGLRenderer.setSize is the source of truth for buffer dimensions.
 assert.match(threeSource,/width=Math\.floor\([^)]*\),\w+\.height=Math\.floor/);
 for(const [width,height] of [[852,393],[932,430],[667,375]]){
  const f=fixture({width,height});for(let i=0;i<10;i++)f.tick(i*1000/60);
  assert.equal(f.stats.resizes.length,1,`${width}×${height} must not resize every frame`);
  assert.equal(f.nodes.get('duelCanvas').width,Math.floor(width*1.3));
  f.nodes.get('duelCanvas').clientWidth=width+10;f.tick(200);f.tick(220);
  assert.equal(f.stats.resizes.length,2,'one resize for a new CSS size');
 }
});

test('zero-size canvas is skipped without an invalid camera projection',()=>{
 const f=fixture({height:0});f.tick(0);assert.equal(f.stats.renders,0);assert.equal(f.stats.resizes.length,0);
 f.nodes.get('duelCanvas').clientHeight=393;f.tick(16);assert.equal(f.stats.renders,1);assert.equal(f.stats.resizes.length,1);
});

test('hidden rendering is suspended and resumes once with a fresh presentation clock',()=>{
 const f=fixture();f.addPlayer();f.tick(0);f.tick(16);assert.equal(f.stats.poses.at(-1).dt,.016);
 f.document.hidden=true;f.document.dispatch('visibilitychange');assert.equal(f.callbacks.size,0);assert.equal(f.api.active(),false);
 const rendered=f.stats.renders;f.api.frame(20000);assert.equal(f.stats.renders,rendered);assert.equal(f.callbacks.size,0);
 f.document.hidden=false;f.document.dispatch('visibilitychange');f.document.dispatch('visibilitychange');assert.equal(f.callbacks.size,1);
 f.tick(20000);assert.equal(f.stats.poses.at(-1).dt,0,'background time is not consumed by animation');
 f.tick(20016);assert.equal(f.stats.poses.at(-1).dt,.016);
});

test('an initially hidden page waits for visibility before creating a RAF',()=>{
 const f=fixture({hidden:true});assert.equal(f.callbacks.size,0);
 f.document.hidden=false;f.document.dispatch('visibilitychange');f.tick(1000);assert.equal(f.stats.renders,1);
});

test('context loss suspends rendering, restore resets time, and pagehide prevents restart',()=>{
 const f=fixture();f.addPlayer();f.tick(0);f.tick(16);const canvas=f.nodes.get('duelCanvas');let prevented=false;
 canvas.dispatch('webglcontextlost',{preventDefault(){prevented=true;}});assert.ok(prevented);assert.equal(f.callbacks.size,0);assert.equal(f.api.active(),false);
 f.api.frame(200);assert.equal(f.stats.renders,2);canvas.dispatch('webglcontextrestored');f.tick(10000);assert.equal(f.stats.poses.at(-1).dt,0);
 f.window.dispatch('pagehide');assert.equal(f.callbacks.size,0);
 canvas.dispatch('webglcontextrestored');f.document.dispatch('visibilitychange');assert.equal(f.callbacks.size,0,'a disposed renderer is never restarted');
 f.api.frame(11000);assert.equal(f.stats.renders,3);
});

test('presentation delta is finite and bounded without changing server action timing',()=>{
 const f=fixture(),{p}=f.addPlayer({serial:1,swing_at:new Date(99900).toISOString(),swing_end:new Date(100600).toISOString(),strike_weapon:'gladius'});
 const original=JSON.stringify(p);f.tick(500);f.tick(516);f.tick(515);assert.equal(f.stats.poses.at(-1).dt,0);
 f.setNow(100300);f.tick(5000);assert.equal(f.stats.poses.at(-1).dt,.05);assert.equal(f.stats.poses.at(-1).timer,.4);assert.equal(f.stats.poses.at(-1).action,'attack');assert.equal(JSON.stringify(p),original,'presentation never mutates the authoritative snapshot');
});

test('timestamps and attack profiles are cached per immutable network snapshot',()=>{
 const f=fixture(),{p}=f.addPlayer({serial:1,swing_at:new Date(99900).toISOString(),swing_end:new Date(100600).toISOString(),strike_weapon:'gladius'});
 f.tick(0);const parses=f.parses,profile=f.stats.poses.at(-1).profile;assert.equal(f.profiles,1);
 for(let i=1;i<=10;i++)f.tick(i*16);assert.equal(f.parses,parses);assert.equal(f.profiles,1);assert.equal(f.stats.poses.at(-1).profile,profile);
 const next={...p,wind:.3,swing_at:new Date(99800).toISOString()};f.api.setRoom({status:'playing',combat_version:23,players:[next]});f.tick(180);
 assert.ok(f.parses>parses);assert.equal(f.profiles,2);assert.equal(f.stats.poses.at(-1).profile.wind,.3);assert.equal(f.stats.poses.at(-1).timer,.2);
});
