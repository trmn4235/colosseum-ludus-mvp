/* Shared deterministic driving rules. The server owns accepted boost events. */
var CircusDriving=(()=>{
 const SWEEP=.85,TARGET=[.70,.88],DURATION=4,COST=25,RECOVERY=2.5,COOLDOWN=5;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function target(misses=0){const half=.09/(1+Math.max(0,Number(misses)||0)*.25);return[.79-half,.79+half];}
 function needle(t){return 1-Math.abs(1-((Math.max(0,t)/SWEEP)%2));}
 function metrics(d,t,duration){
  t=Math.max(0,t);let stamina=Number(d?.initial??100),previous=0,bonus=0,finish=duration,boosting=false,last=-100;
  for(const event of d?.boosts||[]){const at=Number(event.at);if(at>t)break;stamina=Math.min(100,stamina+Math.max(0,at-previous)*RECOVERY)-COST;previous=at+DURATION;bonus+=.5*clamp(t-at,0,DURATION);if(t>=at&&t<at+DURATION)boosting=true;last=at;if(finish>at)finish-=Math.min(2,(finish-at)/3);}
  stamina=clamp(stamina+Math.max(0,t-previous)*RECOVERY,0,100);
  return{stamina,bonus,finish,boosting,cooldown:Math.max(0,last+COOLDOWN-t),canBoost:stamina>=COST&&!boosting&&t>=last+COOLDOWN,progress:clamp((t+bonus)/duration,0,1),multiplier:boosting?1.5:1};
 }
 function steeringStep(velocity,input,dt){dt=clamp(dt,0,.05);const target=clamp(input,-1,1)*2.35;return velocity+(target-velocity)*(1-Math.exp(-(input?8:13)*dt));}
 function canSteer(teams,lane){const own=teams[3];return lane>=-11&&lane<=11&&!teams.slice(0,3).some(t=>Math.abs(t.distance-own.distance)<5.8&&Math.abs(t.lane-lane)<3.1);}
 return{target,SWEEP,TARGET,DURATION,COST,RECOVERY,COOLDOWN,needle,metrics,steeringStep,canSteer,clamp};
})();
if(typeof module!=='undefined')module.exports=CircusDriving;
