const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Staff=require('../staff-combat-v288.js');
require('../caravan-core-v126.js');require('../combat-curves-v163.js');require('../combat-motion-v163.js');
const S=require('../caravan-defense-simulation-v230.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const learned=(role,ids)=>({version:288,effects:ids.map(content_id=>({role,content_id,learned_at:'2026-11-22T00:00:00Z'}))});
const seed={encounter:{version:230,rules:230,guards:2,seed:7288},team:[{name:'Owned',class:'secutor',overall:50,items:[{kind:'weapon',model:'gladius',equipped_slot:'main_hand'},{kind:'shield',model:'large',equipped_slot:'off_hand'}]}],workers:[{armed:true,arrows:50,base_damage:9}]};
function battle(ids=[]){const ticket=structuredClone(seed);if(ids.length)ticket.encounter.staff_combat_v288=learned('guard',ids);const state=S.create(ticket);state.combat.random=()=>.999;return state;}
function fixture(ids=[]){const state=battle(ids),c=state.combat,a=c.fighters[0],v=c.fighters.find(f=>f.team===1),worker=c.fighters.find(f=>f.worker);for(const f of c.fighters){f.hp=0;f.cooldown=999;}Object.assign(a,{hp:100,maxHp:100,stamina:100,maxStamina:100,cooldown:0,x:0,z:0,angle:0,weapon:'gladius',regenDelay:0,action:'idle'});Object.assign(v,{hp:10000,maxHp:10000,x:0,z:1.2,angle:Math.PI,weapon:'gladius'});c.botStep=()=>{};return{state,c,a,v,worker};}
function trainer(ids,extra={}){const f={id:0,hp:100,maxHp:100,maxStamina:100,stamina:100,...extra};Staff.attachArena({fighters:[f]},{mode:'4x5',snapshot:{staff_combat_v288:learned('trainer',ids)}});return f;}
// Every supported trainer event uses its approved weapon/action condition.
for(const [id,action,w]of [['003','normal','gladius'],['003','double','sica'],['006','breaker','heavy_mace'],['008','net','net'],['009','pull','whip'],['017','throw','spear'],['018','throw','trident_gladiator'],['020','normal','halberd'],['021','breaker','warhammer'],['022','bash',null],['023','normal','trident']]){const f=trainer(['doctore_'+id]);near(Staff.cost(f,26,action,w),26*.996);near(Staff.cost(f,26,'unrelated',w),26);}
for(const [id,style]of [['010','murmillo'],['011','shield_parma']]){const f=trainer(['doctore_'+id],{shield:true,shieldStyle:style});near(Staff.cost(f,20,'block'),19.92);f.shield=false;near(Staff.cost(f,20,'block'),20);}
{const f=trainer(['doctore_001'],{weapon:'trident'});near(Staff.criticalChance(f,.35),.352);f.weapon='gladius';near(Staff.criticalChance(f,.35),.35);}
for(const [id,w,action]of [['002','spear','spearcast'],['007','warhammer','attack'],['024','whip','attack'],['025','mace','attack']]){const a=trainer(['doctore_'+id],{weapon:w,action});near(Staff.damage(a,{id:5},100,'chest'),100.2);if(id==='024'||id==='025'){a.handSpecial261={kind:'breaker'};near(Staff.damage(a,{id:5},100,'chest'),100);}}
{const a=trainer(['doctore_005'],{weapon:'halberd',handSpecial261:{kind:'sweep',target:5}});near(Staff.damage(a,{id:5},100,'chest'),100);near(Staff.damage(a,{id:6},100,'chest'),100.4);}
{const a=trainer(['doctore_016'],{weapon:'gladius',staffCriticalHitV288:true});near(Staff.damage(a,{id:5},100,'chest'),100.4);a.staffCriticalHitV288=false;near(Staff.damage(a,{id:5},100,'chest'),100);}
for(const [id,region,gear]of [['012','head',{helmet:true}],['013','chest',{chest:true}],['014','rightArm',{shoulders:true,shoulderModel:'manica_leather'}],['015','leftLeg',{greaves:true}]]){const v=trainer(['doctore_'+id],gear);near(Staff.damage({},v,100,region),99.8);if(region==='rightArm')near(Staff.damage({},v,100,'leftArm'),100);for(const k of ['helmet','chest','shoulders','greaves'])v[k]=false;near(Staff.damage({},v,100,region),100);}
// Ownership and mode boundaries: generated allies, enemies, pit/naval and old tickets get no bonus.
for(const mode of ['pit','naval','survival','ranked']){const fighters=[{},{}];Staff.attachArena({fighters},{mode,snapshot:{staff_combat_v288:learned('trainer',Staff.trainerIds)}});assert(fighters.every(f=>!f.staffCombatV288));}
{const fighters=[{},{}];Staff.attachArena({fighters},{mode:'solo20',snapshot:{staff_combat_v288:learned('trainer',['doctore_002'])}});assert(fighters[0].staffCombatV288);assert.equal(fighters[1].staffCombatV288,undefined);}
// Real V230 engine checks discounted affordability and spends the exact fractional amount.
{const{c,a}=fixture(['guard_003']);a.stamina=13*.998;assert.equal(c.attack(0),true);near(a.stamina,0);}
for(const [id,w]of [['004','spear'],['005','trident']]){const{c,a}=fixture(['guard_'+id]);a.weapon=w;a.stamina=26*.996;assert.equal(c.special(0,0),true);near(a.stamina,0);}
for(const [id,kind]of [['007','bash'],['023','net'],['024','pull']]){const{c,a,v}=fixture(['guard_'+id]);if(kind==='bash'){a.shield=true;}if(kind==='net'){a.shield=false;a.leftGear='net';}if(kind==='pull'){a.weapon='whip';c.lockedTarget=v.id;}const hand=kind==='pull'?0:1;assert.equal(c.special(0,hand),true);near(a.stamina,100-26*.996);}
{const{c,a}=fixture(['guard_008']);a.stamina=25*.998;assert.equal(c.evade(0,1,0,'roll'),true);near(a.stamina,0);}
{const{c,a,v}=fixture(['guard_006']);Object.assign(a,{shield:true,shieldHeldBy:null,blocking:true,blockAge:1,guardPressedAt:-99,stamina:100});Object.assign(v,{action:'attack',attackKind:'light',attackWeapon:'gladius',attackProfile:ArenaMotion.profile('gladius'),angle:Math.PI});a.angle=0;assert.equal(c.guard(v,a,false),true);near(a.stamina,100-20*.998);}
// The actual damage path applies before integer HP rounding, to allies only.
for(const [id,who]of [['001','a'],['002','worker'],['014','victimWorker'],['012','low']]){
 const run=on=>{const {c,a,v,worker}=fixture(on?['guard_'+id]:[]);let source=a,target=v;if(who==='worker'){source=worker;source.hp=100;source.itemProjectile=true;}if(who==='victimWorker'){source=v;target=worker;worker.hp=worker.maxHp=10000;}if(who==='low'){source=v;target=a;a.hp=2000;a.maxHp=10000;}source.action='attack';target.body.chest=100;const before=target.hp;c.damage(source,target,who==='low'?500:5000,'chest');return c.drain().find(e=>e.type==='hit')?.damage;};
 if(who==='victimWorker'||who==='low')assert.ok(run(true)<run(false),id);else if(id==='001'){const a=battle(['guard_001']).combat.fighters[0];near(Staff.damage(a,{},10000,'chest'),10001);}else assert.ok(run(true)>run(false),id);
}
for(const [id,region,gear]of [['017','head',{helmet:true}],['018','chest',{chest:true}],['019','rightArm',{shoulders:true,shoulderModel:'manica_lion'}],['020','rightLeg',{greaves:true}]]){const a=battle(['guard_'+id]).combat.fighters[0];Object.assign(a,gear);near(Staff.damage({},a,100,region),99.8);}
{const a=battle(['guard_010','guard_011']).combat.fighters[0];a.maxStamina=100;a.stamina=24.99;near(Staff.regeneration(a,10),10.06);a.stamina=25;near(Staff.regeneration(a,10),10.02);}
{const run=ids=>{const{c,a}=fixture(ids);a.stamina=10;c.tick(1/30,{});return a.stamina-10;};near(run(['guard_010','guard_011']),run([])*1.006);}
// New effects never alter legacy tickets or add client-only state to authoritative replays.
const snapshot=s=>({steps:s.steps,result:s.combat.result,stats:s.combat.stats,f:s.combat.fighters.map(f=>[f.hp,f.stamina,f.x,f.z,f.arrowsLeft]),events:s.combat.events});
const old=battle(),empty=S.create({...structuredClone(seed),encounter:{...seed.encounter,staff_combat_v288:learned('guard',[])}});empty.combat.random=()=>.999;
for(let i=0;i<90;i++){S.step(old,[0,0,0,0,0,0]);S.step(empty,[0,0,0,0,0,0]);old.combat.drain();empty.combat.drain();}assert.deepEqual(snapshot(old),snapshot(empty));
const ticket=structuredClone(seed);ticket.encounter.staff_attack_percent=.44;ticket.encounter.staff_combat_v288=learned('guard',Staff.guardIds);
const live=S.create(ticket);while(!live.combat.finished){S.step(live,[0,0,0,1,0,0]);live.combat.drain();}const replay=S.replay(ticket,live.commands,live.steps);assert.deepEqual(snapshot(replay),snapshot(live));
for(const file of ['staff-combat-v288.js','caravan-core-v126.js','combat-motion-v163.js','caravan-defense-simulation-v230.js'])assert.equal(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),fs.readFileSync(path.join(__dirname,'../supabase/functions/caravan-defense-v230',file),'utf8'));
console.log('PASS V288 combat: 23 trainer / 18 guard condition bindings, cost thresholds, actual damage/regeneration, ownership/mode scope, old tickets and identical deterministic server replay.');
