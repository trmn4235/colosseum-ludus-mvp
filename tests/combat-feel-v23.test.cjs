const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const { test } = require('node:test');

function runtime(page = 'arena.html') {
  const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
  const start = html.indexOf('var ArenaClasses=');
  const marker = "if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);";
  const ending = "})(typeof window!=='undefined'?window:globalThis);";
  const end = html.indexOf(ending, html.indexOf(marker, start)) + ending.length;
  const context = vm.createContext({ console });
  vm.runInContext(html.slice(start, end), context);
  return context;
}

function duel(context) {
  const sim = new context.ArenaCombat(() => .999).reset('normal', 'secutor');
  const a = sim.fighters[0], b = sim.fighters[5];
  for (const f of sim.fighters) { f.hp = 0; f.cooldown = 999; }
  Object.assign(a, {hp:100, maxHp:100, x:0, z:0, angle:0, cooldown:0, stamina:100, shield:true, shieldStyle:'secutor'});
  Object.assign(b, {hp:100, maxHp:100, x:0, z:1.25, angle:Math.PI, cooldown:0, stamina:100, weapon:'gladius', attackBonus:1, defenseBonus:1, agility:50});
  sim.lockedTarget=b.id;
  return {sim,a,b};
}

function advance(sim, seconds, block = false) {
  for (let n=0;n<Math.round(seconds*120);n++) sim.tick(1/120, {block});
}

for (const page of ['arena.html', 'savas.html', 'multiplayer.html']) {
  const context = runtime(page);
  test(page + ': cuts visibly carry the hand and torso, with a separate overhead heavy', () => {
    const {sim,a}=duel(context);sim.attack(0);
    const samples=Array.from({length:81},(_,i)=>context.ArenaMotion.sample(a,a.duration*i/80));
    assert.ok(Math.max(...samples.map(s=>s.grip.x))-Math.min(...samples.map(s=>s.grip.x))>.65,'the cut must carry the hand across the body');
    const turns=Array.from({length:81},(_,i)=>context.ArenaMotion.body({...a,timer:a.duration*i/80}).poses.Hips[1]);
    assert.ok(Math.max(...turns)-Math.min(...turns)>.45,'pelvis must transfer weight into the swing');
    const heavy={...a,attackKind:'heavy',attackProfile:context.ArenaMotion.profile(a.weapon,true)};
    assert.ok(context.ArenaMotion.sample(heavy,heavy.attackProfile.wind).grip.y>1.85,'heavy wind-up goes above the shoulder');
  });
  test(page + ': shield interruption preserves the torso posture at contact', () => {
    const {sim,a,b}=duel(context);sim.attack(b.id);b.timer=.34;
    const before=context.ArenaMotion.body(b);sim.prepareGuard(a,true);sim.guard(b,a,false,{x:.26,y:1.42,z:.29});
    const after=context.ArenaMotion.body(b);
    for(const bone of ['Hips','Spine','Spine2']) assert.deepEqual(Array.from(after.poses[bone]),Array.from(before.poses[bone]));
    assert.equal(after.shift,before.shift);
  });
  test(page + ': shield contact stops the cut and leaves a continuous recovery', () => {
    const {sim,a,b}=duel(context);
    b.cooldown=999;advance(sim,.35,true);b.cooldown=0;assert.equal(sim.attack(b.id),true);
    const hp=a.hp;advance(sim,.5,true);
    assert.equal(a.hp,hp);assert.ok(sim.events.some(e=>e.type==='block'));
    assert.ok(!sim.events.some(e=>e.perfect));assert.equal(b.action,'recoil');
    const sample=context.ArenaMotion.sample(b);assert.equal(sample.active,false);
    assert.ok(Object.values(sample.grip).every(Number.isFinite));
    const e=sim.events.find(e=>e.type==='block');assert.ok(Math.abs(e.point.z-.29)<.1);
  });
  test(page + ': a new timed block opens a targeted counter without a fall', () => {
    const {sim,a,b}=duel(context);sim.attack(b.id);advance(sim,.25,false);advance(sim,.18,true);
    assert.equal(a.hp,100);assert.equal(b.action,'stagger');assert.equal(a.counterTarget,b.id);
    assert.ok(a.counterUntil>sim.time);assert.ok(sim.events.some(e=>e.type==='parry'&&e.perfect));
    assert.equal(sim.attack(0),true);assert.equal(a.attackCounterTarget,b.id);
    assert.ok(a.attackProfile.wind<context.ArenaMotion.profile(a.weapon).wind);
    advance(sim,.5,false);assert.ok(b.hp<100);assert.equal(sim.stats.counters,1);
    assert.ok(!sim.events.some(e=>e.type==='knockdown'));
  });
  test(page + ': holding or rapidly toggling guard cannot renew perfect timing', () => {
    const {sim,a,b}=duel(context);advance(sim,.02,true);const first=a.guardPressedAt;
    advance(sim,.01,false);advance(sim,.01,true);assert.equal(a.guardPressedAt,-99);
    advance(sim,.6,true);assert.notEqual(a.guardPressedAt,sim.time);
    sim.attack(b.id);advance(sim,.5,true);assert.ok(!sim.events.some(e=>e.perfect));
    assert.equal(a.counterTarget,null);assert.ok(first>=0);
  });
  test(page + ': expired counter or a different locked target receives no bonus', () => {
    const {sim,a,b}=duel(context);a.counterTarget=b.id;a.counterUntil=.1;advance(sim,.2);
    assert.equal(sim.attack(0),true);assert.equal(a.attackCounterTarget,null);
    const next=duel(context),c=next.sim.fighters[10];Object.assign(c,{hp:100,x:1,z:1});
    next.a.counterTarget=next.b.id;next.a.counterUntil=1;next.sim.lockedTarget=c.id;
    assert.equal(next.sim.attack(0),true);assert.equal(next.a.attackCounterTarget,null);
  });
  test(page + ': projectile blocks cannot stagger a distant thrower or open a melee counter', () => {
    const {sim,a,b}=duel(context);sim.time=.1;sim.prepareGuard(a,true);b.action='spearcast';b.z=5;
    assert.equal(sim.guard(b,a,false,{x:.26,y:1.42,z:.29}),true);
    assert.equal(b.action,'spearcast');assert.equal(a.counterTarget,null);assert.equal(a.counterUntil,0);
  });
}

test('all embedded scripts compile', () => {
  for(const name of ['arena','savas','multiplayer','ludus']) {
    const html=fs.readFileSync(path.join(__dirname,'..',name+'.html'),'utf8');
    for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if(!/type=["'](?:application\/json|importmap)/.test(match[1])) new vm.Script(match[2]);
    }
  }
});
