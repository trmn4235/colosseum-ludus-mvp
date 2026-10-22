/* Observation only: the authoritative replay assigns every hit to its fighter. */
(()=>{
 const P=globalThis.ArenaCombat.prototype,damage=P.damage;
 P.damage=function(attacker,victim,...args){
  const before=victim.hp,result=damage.call(this,attacker,victim,...args);
  const actual=Math.max(0,before-Math.max(0,victim.hp));
  if(actual>0&&attacker.team!==victim.team){
   attacker.career??={kills:0,damage:0,damageTaken:0};
   victim.career??={kills:0,damage:0,damageTaken:0};
   attacker.career.damage+=actual;victim.career.damageTaken+=actual;
   if(before>0&&victim.hp<=0)attacker.career.kills++;
  }
  return result;
 };
 globalThis.CaravanCareer={participants(sim){return sim.ticket.team.map((g,i)=>{
  const f=sim.combat.fighters[i];return {id:g.id,kills:f.career?.kills||0,deaths:f.hp<=0?1:0,
   damage:Math.round((f.career?.damage||0)*100)/100,damageTaken:Math.round((f.career?.damageTaken||0)*100)/100};
 });}};
})();
