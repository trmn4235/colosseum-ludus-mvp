const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{runtime}=require('./combat-stats-v73.cjs');
const c=runtime();for(const file of ['combat-curves-v163.js','combat-motion-v163.js','pit-archery-v178.js','pit-round-v176.js','pit-arena-v172.js'])vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),c);c.ArenaAuthoredCombat.install(c.ArenaCombat,c.ArenaMotion);
const ticket=JSON.parse(fs.readFileSync('/tmp/pit-fixtures-v176.json','utf8')).tickets[2];
function setup(){const sim=new c.ArenaCombat(()=>.999).reset('normal','secutor','pit');c.LudusLoadout.initialize(sim,ticket);c.PitArena.install(sim,ticket);const ai=sim.botStep;sim.botStep=()=>{};for(const f of sim.fighters)if(f.id>2)f.hp=0;const p=sim.fighters[0],ally=sim.fighters[1],enemy=sim.fighters[2];Object.assign(p,{x:0,z:0,angle:0,action:'idle',stamina:100,cooldown:0});Object.assign(ally,{x:4,z:0,action:'idle'});Object.assign(enemy,{x:.28,z:6,action:'idle',hp:1000,maxHp:1000,shield:false,weapon:null,offhand:null});return{sim,p,ally,enemy,ai};}
{
 const{sim,p,ally,enemy}=setup();assert.ok(p.pitBow&&ally.pitBow);assert.equal(p.weapon,null);assert.equal(sim.canBlock(p),false);assert.equal(sim.special(0),false);
 let preview=c.PitArchery.aim(sim,p,c.PitArena.bounds);assert.ok(preview.enemy);assert.equal(preview.hit.id,enemy.id);
 const hp=enemy.hp;assert.ok(sim.attack(0));assert.equal(p.stamina,87);assert.equal(sim.attack(0),false);for(let i=0;i<20;i++)sim.tick(1/60);assert.equal(sim.pitArchery.arrows.length,0,'arrow waits for string draw');
 for(let i=0;i<40;i++)sim.tick(1/60);assert.ok(enemy.hp<hp,'the green preview is an actual damaging shot');assert.equal(sim.pitArchery.arrows.length,0);const after=enemy.hp;for(let i=0;i<60;i++)sim.tick(1/60);assert.equal(enemy.hp,after,'one arrow damages once');
}
{
 const{sim,p,ally,enemy}=setup();ally.x=.28;ally.z=3;const preview=c.PitArchery.aim(sim,p,c.PitArena.bounds);assert.equal(preview.enemy,false);assert.equal(preview.hit.id,ally.id);const hp=enemy.hp,ah=ally.hp;sim.attack(0);for(let i=0;i<100;i++)sim.tick(1/60);assert.equal(enemy.hp,hp,'ally stops arrow');assert.equal(ally.hp,ah,'no friendly damage');
}
{
 const{sim,p,enemy}=setup();p.angle=-Math.PI/2;const q=c.PitArchery.aim(sim,p,c.PitArena.bounds);assert.equal(q.enemy,false);assert.ok(q.wall);const hp=enemy.hp;sim.attack(0);for(let i=0;i<120;i++)sim.tick(1/60);assert.equal(enemy.hp,hp);assert.equal(sim.pitArchery.arrows.length,0,'wall consumes the shot');
}
for(const cause of ['death','stun','dodge']){const{sim,p,enemy}=setup();sim.attack(0);sim.tick(.05);if(cause==='death')p.hp=0;else if(cause==='stun')p.stunUntil=10;else Object.assign(p,{action:'dodge',dx:1,dz:0});for(let i=0;i<30;i++)sim.tick(1/60);assert.equal(sim.pitArchery.arrows.length,0,'interrupted draw never releases: '+cause);assert.equal(enemy.hp,1000);}
for(const dt of [1/120,1/60,.05]){const{sim,p,enemy}=setup();const hp=enemy.hp;sim.attack(0);for(let t=0;t<1;t+=dt)sim.tick(dt);assert.ok(enemy.hp<hp,'swept arrow hits at '+dt);}
{
 const{sim,p,enemy}=setup();const start=c.PitArchery.origin(p),dir=c.PitArchery.direction(p);enemy.z=22;assert.equal(c.PitArchery.trace(sim,p.id,start,dir,20,c.PitArena.bounds).enemy,false);enemy.z=6;enemy.hp=0;assert.equal(c.PitArchery.aim(sim,p,c.PitArena.bounds).enemy,false);
}
{const{sim,p,ally,enemy,ai}=setup();sim.botStep=ai;Object.assign(p,{x:-5,z:-5});Object.assign(ally,{x:0,z:0,angle:0});Object.assign(enemy,{x:0,z:7});for(let i=0;i<180;i++)sim.tick(1/60);assert.ok(enemy.hp<1000,'selected teammate bow shoots real arrows');}
{const{sim,p}=setup();p.z=c.PitArena.bounds.z;assert.ok(c.PitArchery.aim(sim,p,c.PitArena.bounds).wall,'bow tip outside wall cannot shoot through it');}
console.log('V178 archery PASS: both selected bows, green real hit, yellow miss, ally occlusion, walls, no friendly damage, interruption, stamina, one hit per arrow and swept collision at three tick rates.');
