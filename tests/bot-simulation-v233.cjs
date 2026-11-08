const assert=require('node:assert/strict');
require('../supabase/functions/bot-runner-v233/caravan-core-v126.js');
require('../supabase/functions/bot-runner-v233/combat-curves-v163.js');
require('../supabase/functions/bot-runner-v233/combat-motion-v163.js');
require('../supabase/functions/bot-runner-v233/bot-simulation-v233.js');
const {create,advance,pack,unpack}=globalThis.LudusBotSimulationV233;
const repeated={id:'same'},cycle={a:repeated,b:repeated,set:new Set([repeated])};cycle.self=cycle;
const restored=unpack(JSON.parse(JSON.stringify(pack(cycle))));assert.equal(restored.a,restored.b);assert.equal(restored.self,restored);assert.equal([...restored.set][0],restored.a);
const g={name:'Tester',class:'secutor',stat_version:46,level:1,overall:50,base_stats:globalThis.LudusExercise.profile('secutor')};
const item=(actor,slot,kind,model)=>({actor,slot,token:`${actor}-${slot}`,item:{id:`${actor}-${slot}`,kind,model,stat_version:10,natural_rule_version:2,natural_stats:globalThis.LudusItemSystem.baseStats(kind),natural_percentages:{},enhancement:0,sapphires:[],rubies:[],emeralds:[]}});
const classes=Object.keys(globalThis.ArenaClasses),loot=[];for(let actor=0;actor<20;actor++){const type=actor?classes[actor%7]:g.class,c=globalThis.ArenaClasses[type];loot.push(item(actor,'main_hand','weapon',c.weapon));if(c.shield)loot.push(item(actor,'off_hand','shield',c.shield));loot.push(item(actor,'helmet','helmet','gold'));}
const ticket={rule_version:2,mode:'4x5',snapshot:{gladiator:g,items:loot.filter(x=>x.actor===0).map(x=>({...x.item,equipped_slot:x.slot}))},loot};
const initial=create(ticket,42),one=advance(initial,400);let many=initial;for(let i=0;i<8&&!many.finished;i++)many=advance(JSON.parse(JSON.stringify(many)),50);
assert.equal(one.steps,many.steps);assert.equal(one.seed,many.seed);assert.deepEqual(one.combat,many.combat,'pausing and restoring must not change combat');
assert.ok(one.steps>0);assert.ok(one.combat.nodes.length<25000);
let result=initial;while(!result.finished&&!result.abandoned)result=advance(JSON.parse(JSON.stringify(result)),400);
assert.ok(result.finished,'the AI must finish an actual match');assert.ok(['win','loss'].includes(result.result));assert.ok(result.stats.seconds>=10);assert.equal(typeof result.stats.alive,'boolean');
for(const token of Object.values(result.stats.exit_slots))assert.ok(ticket.loot.some(x=>x.token===token),'only actual match equipment tokens can leave');
const loans=Array.from({length:4},(_,actor)=>{const x=item(actor,'main_hand','weapon','heavy_mace');x.item.pit_model=actor%2?'pit_wood_mace':'pit_stone_mace';return x;});
const pitTicket={rule_version:2,mode:'pit',snapshot:{gladiator:g,items:[{...loans[0].item,equipped_slot:'main_hand'}],pit_version:173,pit_weapon:'pit_stone_mace'},loot:loans};
const pitInitial=create(pitTicket,33),pitOne=advance(pitInitial,400);let pitSplit=pitInitial;for(let i=0;i<8&&!pitSplit.finished;i++)pitSplit=advance(JSON.parse(JSON.stringify(pitSplit)),50);
assert.equal(pitOne.steps,pitSplit.steps);assert.deepEqual(pitOne.combat,pitSplit.combat,'Aventinus resumes with the same arena boundary');
let pitWinner=null;for(let seed=1;seed<=12&&!pitWinner;seed++){let p=create(pitTicket,seed);while(!p.finished&&!p.abandoned)p=advance(JSON.parse(JSON.stringify(p)),400);assert.ok(p.finished,'Aventinus match finishes');if(p.result==='win')pitWinner=p;}
assert.ok(pitWinner,'a real Aventinus battle can produce a win');assert.equal(pitWinner.stats.opponents_defeated,3);assert.equal(pitWinner.stats.alive,true);assert.ok(pitWinner.stats.kills>=0&&pitWinner.stats.kills<=3);
assert.throws(()=>create({...ticket,mode:'other'},1),/Invalid/);assert.throws(()=>advance(initial,1001),/Invalid/);
console.log('V234 bot simulation PASS: actual arena and Aventinus combat, valid wins, equipment identity, bounded chunks and resumable state.');
