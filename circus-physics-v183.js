/* Fixed 50 ms simulation; mirrored by private SQL helpers. Never accepts client positions. */
var CircusPhysics=(()=>{
 const DT=.05,STRAIGHT=396,RADIUS=35,LENGTH=792+70*Math.PI,LAPS=5,TOTAL=LENGTH*LAPS;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function section(distance){const s=((distance%LENGTH)+LENGTH)%LENGTH;return s<396?{curve:false,s}:s<396+35*Math.PI?{curve:true,a:(s-396)/35,top:true,s}:s<792+35*Math.PI?{curve:false,s}:{curve:true,a:(s-792-35*Math.PI)/35,top:false,s};}
 function bounds(distance){const q=section(distance);if(!q.curve)return[-28.4,11.1];const c=Math.abs(Math.cos(q.a)),s=Math.sin(q.a),off=q.top?34:46,meta=q.top?17:5,end=q.top?16.5:8.5,outer=c>1e-8?46.1/c:1e9;let max=outer;if(outer*s>off)max=off*s+Math.sqrt(Math.max(0,46.1**2-off**2*c*c));const rect=Math.min(c>1e-8?6.6/c:1e9,s>1e-8?end/s:1e9),disc=7.6**2-meta**2*c*c,min=Math.max(rect,disc>=0?meta*s+Math.sqrt(disc):0);return[min-35,max-35];}
 function initial(){return{tick:0,distance:0,lane:10.2,heading:0,speed:0,wall:0,crashes:0,impact:0,finish:null};}
 function botDrive(i,initial=100){const d={initial,boosts:[]};for(let k=0;k<60;k++){const at=7+i*1.7+k*9.5;if((k+i)%5!==0&&CircusDriving.metrics(d,at,600).canBoost)d.boosts.push({at});}return d;}
 const botPlans=[0,1,2,3].map(i=>botDrive(i));
 function bot(i,t,duration,config=null){const m=CircusDriving.metrics(config||botPlans[i],t,duration);const limits=bounds(100+TOTAL*m.progress);return{distance:TOTAL*m.progress,lane:clamp([-12,-3,5,10.2][i]+Math.sin(t*.13+i)*1.5,limits[0]+.2,limits[1]-.2),speed:m.progress>=1?0:TOTAL/duration*m.multiplier,finish:m.finish,boosting:m.boosting,stamina:m.stamina};}
 function step(state,input,duration,drive,plans){const n={...state},t=state.tick*DT;n.tick++;n.impact=Math.max(0,n.impact-DT);if(n.finish!==null)return n;
  const m=CircusDriving.metrics(drive,t,duration),q=section(100+n.distance),scale=q.curve?Math.max(.2,1+n.lane/35):1;
  const before={...n};
  n.heading=clamp(n.heading+(clamp(input,-1,1)*.85+(q.curve?n.speed/(35*scale):0))*DT,-1.2,1.2);
  let target=TOTAL/duration*m.multiplier;n.speed+=clamp(target-n.speed,-8*DT,3.4*DT);
  let lane=n.lane+Math.sin(n.heading)*n.speed*DT,dist=n.distance+Math.max(0,Math.cos(n.heading))*n.speed*DT/scale;
  if(drive.motion===183){const motion=CircusMotion.advance(before,input,q.curve,target,DT);Object.assign(n,{heading:motion.heading,turn:motion.turn,slip:motion.slip,speed:motion.speed});lane=motion.lane;dist=motion.distance;}
  const limits=bounds(100+dist),contact=lane<limits[0]||lane>limits[1];
  if(contact){if(n.wall===0){n.crashes++;n.speed*=.58;n.impact=.7;}n.wall+=DT;if(drive.motion===183)n.slip*=.5;n.speed=Math.max(0,n.speed-(5+n.wall*7)*DT);if(n.wall>=2.5)n.speed=0;lane=clamp(lane,...limits);}else n.wall=0;
  for(let i=0;i<3;i++){const b=bot(i,t,Number(plans[i]),drive.bots?.[i]);if(Math.abs(b.distance-dist)<5.1&&Math.abs(b.lane-lane)<2.8){if(n.impact===0){n.crashes++;n.impact=.6;n.speed*=.48;}dist=Math.min(dist,Math.max(n.distance,b.distance-5.1));lane=clamp(lane+(lane>=b.lane?1:-1)*.8*DT,...limits);}}
  n.lane=lane;n.distance=Math.max(n.distance,dist);if(n.distance>=TOTAL){n.distance=TOTAL;n.finish=n.tick*DT;n.speed=0;}return n;
 }
 return{DT,LENGTH,LAPS,TOTAL,clamp,section,bounds,initial,bot,botDrive,step};
})();
if(typeof module!=='undefined')module.exports=CircusPhysics;
