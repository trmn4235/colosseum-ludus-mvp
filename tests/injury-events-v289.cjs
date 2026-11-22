const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Observer=require('../injury-events-v289.js');
// A geometric shoulder contact is distinct from a generic arm hit; blocked/no damage is never evidence.
class Combat{constructor(){this.fighters=[];}damage(a,v,base,region,heavy,point){if(v.blocked)return false;v.hp-=base;if(heavy)v.action='knocked';return true;}emit(type,data){return[type,data];}tick(){for(const f of this.fighters)if(f.move)f.x+=f.move;}}
Observer.install(Combat);Observer.install(Combat);
const c=new Combat(),a={team:1},f={hp:100,maxHp:100,x:0,z:0,navHeight:.3};c.fighters=[f];
let sim={combat:c,ticket:{team:[{id:'owned'}]}},flags=()=>Observer.participants(sim)[0].flags;
f.blocked=true;c.damage(a,f,20,'head');assert.deepEqual(flags(),{});f.blocked=false;
c.damage(a,f,10,'rightArm',false,null);assert.equal(flags().arm_hit,true);assert.equal(flags().shoulder_hit,undefined);
c.damage(a,f,10,'rightArm',false,{y:1.85});assert.equal(flags().shoulder_hit,undefined,'target-height alone is not a shoulder-contact proof');
c.damage(a,f,30,'chest',true);assert.equal(flags().heavy_torso_hit,true);assert.equal(flags().hard_fall,true);assert.equal(flags().fall,true);
f.move=.5;c.tick();assert.equal(flags().movement,true);
const edge=fs.readFileSync(path.join(__dirname,'../supabase/functions/caravan-combat-v126/index.ts'),'utf8');
assert.match(edge,/\/auth\/v1\/user/);assert.match(edge,/InjuryEventsV289.participants\(sim\)/);assert(!edge.includes('body.evidence'));assert.match(edge,/ludus_caravan_verified_v289/);
assert.equal(fs.readFileSync(path.join(__dirname,'../injury-events-v289.js'),'utf8'),fs.readFileSync(path.join(__dirname,'../supabase/functions/caravan-combat-v126/injury-events-v289.js'),'utf8'));
// Compare genuine deterministic V168 replays with/without the observer in separate runtimes.
function runtime(observe){const context={console};context.globalThis=context;vm.createContext(context);const base=path.join(__dirname,'../supabase/functions/caravan-combat-v126');for(const file of ['caravan-core-v126.js','career-combat-v162.js','combat-curves-v163.js','combat-motion-v163.js','caravan-simulation-v168.js',...(observe?['injury-events-v289.js']:[])])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),context,{filename:file});if(observe)context.InjuryEventsV289.install(context.ArenaCombat);return context;}
const ticket={id:'raid',encounter:{version:126,rules:168,guards:2,archers:1,seed:289},team:[{id:'a',name:'A',class:'murmillo',overall:50,items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'}]},{id:'b',name:'B',class:'thraex',overall:50,items:[{kind:'weapon',model:'sica',equipped_slot:'main_hand'}]}]};
const commands=Array.from({length:100},()=>[0,0,0,1,0,0]);
const plain=runtime(false),observed=runtime(true),p=plain.CaravanSimulationV168.replay(ticket,commands,300),o=observed.CaravanSimulationV168.replay(ticket,commands,300);
const view=s=>JSON.stringify({steps:s.steps,finished:s.combat.finished,result:s.combat.result,stats:s.combat.stats,f:s.combat.fighters.map(f=>[f.hp,f.stamina,f.x,f.z,f.action,f.career])});assert.equal(view(o),view(p),'observation cannot change RNG, health, stamina, movements, outcomes or career');
const evidence=observed.InjuryEventsV289.participants(o);assert.deepEqual(Array.from(evidence,e=>e.id),['a','b']);assert(evidence.every(e=>Object.values(e.flags).every(v=>v===true)));
// Unmodified server simulation and actual AI/weapon collisions produce every conditional fact.
const union={};for(const seed of [1,2,3,6]){const t={encounter:{version:126,rules:168,guards:3,archers:1,seed},team:['a','b'].map(id=>({id,name:id,class:'murmillo',overall:50,items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'},{kind:'helmet',model:'roman',equipped_slot:'helmet'},{kind:'chest',model:'gladiator_chest',equipped_slot:'chest'},{kind:'legs',model:'starter',equipped_slot:'legs'}]}))};
 const state=observed.CaravanSimulationV168.create(t);while(!state.combat.finished){observed.CaravanSimulationV168.step(state,[0,0,0,0,0,0]);state.combat.drain();}
 const replay=observed.CaravanSimulationV168.replay(t,state.commands,state.steps);assert.equal(view(state),view(replay));for(const e of observed.InjuryEventsV289.participants(replay))Object.assign(union,e.flags);
}
for(const flag of ['movement','fall','hard_fall','head_hit','shoulder_hit','arm_hit','torso_hit','heavy_torso_hit','leg_hit','heavy_leg_hit'])assert.equal(union[flag],true,flag+' must occur in a genuine completed replay');
assert(union.arm_left_hit||union.arm_right_hit,'real replay records a precise forearm side for doctor014');
console.log('PASS V289 injury observer: real contact/HP/fall/movement predicates, owner team only, no client evidence, identical deterministic replay and identical edge module.');
