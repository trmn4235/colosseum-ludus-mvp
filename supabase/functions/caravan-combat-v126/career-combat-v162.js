/* Observation only: the authoritative replay assigns every hit to its fighter. */
(()=>{
 const P=globalThis.ArenaCombat.prototype,damage=P.damage;
 P.damage=function(attacker,victim,...args){
  const before=victim.hp,result=damage.call(this,attacker,victim,...args);
  const actual=Math.max(0,before-Math.max(0,victim.hp));
  if(actual>0&&attacker.team!==victim.team){
   attacker.career??={kills:0,assists:0,damage:0,damageTaken:0};
   victim.career??={kills:0,assists:0,damage:0,damageTaken:0};
   attacker.career.damage+=actual;victim.career.damageTaken+=actual;
   victim.careerContributors??=new Map();victim.careerContributors.set(attacker,(victim.careerContributors.get(attacker)||0)+actual);
   if(before>0&&victim.hp<=0){
    attacker.career.kills++;
    for(const [helper,damage]of victim.careerContributors)if(helper!==attacker&&helper.team===attacker.team&&damage>=Math.max(1,(victim.maxHp||100)*.1)){
     helper.career??={kills:0,assists:0,damage:0,damageTaken:0};helper.career.assists=(helper.career.assists||0)+1;
    }
    victim.careerContributors.clear();
   }
  }
  return result;
 };
 globalThis.CaravanCareer={participants(sim){return sim.ticket.team.map((g,i)=>{
  const f=sim.combat.fighters[i];return {id:g.id,kills:f.career?.kills||0,deaths:f.hp<=0?1:0,assists:f.career?.assists||0,
   damage:Math.round((f.career?.damage||0)*100)/100,damageTaken:Math.round((f.career?.damageTaken||0)*100)/100};
 });}};
})();
