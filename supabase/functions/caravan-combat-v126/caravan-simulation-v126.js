/* Identical fixed-step simulation in the browser and authenticated result verifier. */
((root)=>{
 'use strict';
 const STEP=1/30,MAX_STEPS=9000,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function terrainHeight(x,z){const road=2.2*Math.sin(z*.055)+.5*Math.sin(z*.14),t=clamp((Math.abs(x-road)-3.1)/5.9,0,1);return t*t*(3-2*t)*(.5+.32*Math.sin(x*.27+z*.17)+.15*Math.cos(z*.4))+.035*Math.sin(x*1.5+z*.5);}
 function seeded(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
 function create(ticket){
  const e=ticket.encounter,team=ticket.team;
  if(e?.version!==126||!Array.isArray(team)||team.length<2||team.length>5||e.guards<team.length||e.guards>team.length+1||e.archers!==1)throw Error('Savaş kaydı geçersiz.');
  const random=seeded(e.seed),combat=new root.ArenaCombat(random);combat.reset('normal',team[0].class,'caravan');combat.allowDrops=false;combat.equipmentVersion=167;
  const types=Object.keys(root.ArenaClasses),average=team.reduce((n,g)=>n+Number(g.overall||50),0)/team.length;
  const bots=Array.from({length:e.guards},(_,i)=>{const type=types[Math.floor(random()*types.length)],c=root.ArenaClasses[type];return{name:'Muhafız '+(i+1),class:type,overall:average,items:[{kind:'weapon',model:c.weapon,equipped_slot:'main_hand'},...(c.shield?[{kind:'shield',model:c.shield,equipped_slot:'off_hand'}]:[]),{kind:'helmet',model:'roman',equipped_slot:'helmet'},{kind:'chest',model:'gladiator_chest',equipped_slot:'chest'},{kind:'legs',model:'starter',equipped_slot:'legs'}]};});
  const archer={name:'Okçu kervancı',class:'retiarius',overall:average,items:[],archer:true};
  const snapshots=[...team,...bots,archer];
  combat.fighters=snapshots.map((g,id)=>{
   const f=new root.ArenaCombat(random).reset('normal',g.class,'caravan').fighters[0];
   f.id=id;f.team=id<team.length?0:1;f.type=g.class;root.LudusLoadout.apply(f,g,g.items||[]);f.helmet=f.team===0?true:f.helmet;f.caravanHood=f.team===0;f.archer=!!g.archer;f.nextArrow=2.5;f.spareSword=false;f.target=null;
   const index=f.team===0?id:id-team.length;f.x=f.team===0?-3.2+(index%3)*1.5:-3+(index%3)*2;f.z=f.team===0?17+Math.floor(index/3)*1.6:10-Math.floor(index/3)*1.5;f.angle=f.team===0?Math.PI:0;
   if(f.archer){f.x=2.5;f.z=5.5;f.maxHp=f.hp=Math.round(f.maxHp*.8);f.weapon=null;f.shield=false;}
   f.navHeight=terrainHeight(f.x,f.z);return f;
  });
  combat.bound=f=>{f.x=clamp(f.x,-7.3,7.3);f.z=clamp(f.z,4.5,24);if(Math.abs(f.x)<1.3&&f.z<7.4){f.x=f.x<0?-1.3:1.3;}};
  const originalAI=combat.botStep.bind(combat);combat.arrows=[];
  combat.botStep=(f,dt)=>{
   if(!f.archer){originalAI(f,dt);return;}
   const t=combat.nearest(f);if(!t)return;const dx=t.x-f.x,dz=t.z-f.z,d=Math.hypot(dx,dz);f.angle=Math.atan2(dx,dz);
   if(d<3){f.x-=Math.sin(f.angle)*1.2*dt;f.z-=Math.cos(f.angle)*1.2*dt;f.move=.3;}
   if(combat.time>=f.nextArrow&&d<19){f.nextArrow=combat.time+3;f.bowDrawUntil=combat.time+.35;combat.arrows.push({owner:f.id,x:f.x,z:f.z,dx:dx/d,dz:dz/d,age:0});combat.emit('arrow',{source:f.id,target:t.id});}
  };
  return {combat,ticket,steps:0,packet:null,commands:[]};
 }
 function packet(input){return[clamp(Math.round(Number(input.x||0)*100),-100,100),clamp(Math.round(Number(input.z||0)*100),-100,100),clamp(Math.round(Number(input.face||0)*1000),-3142,3142),Number(input.flags||0)&31];}
 function valid(p){return Array.isArray(p)&&p.length===4&&p.every(Number.isInteger)&&Math.abs(p[0])<=100&&Math.abs(p[1])<=100&&Math.abs(p[2])<=3142&&p[3]>=0&&p[3]<=31;}
 function step(state,p){
  const c=state.combat;if(c.finished)return;
  if(state.steps%3===0){if(!valid(p))throw Error('Geçersiz savaş kontrolü.');state.packet=p;state.commands.push(p);}
  const [x,z,face,flags]=state.packet,player=c.fighters[0];
  if(flags&1){const target=c.nearest(player,3.2);if(target){player.angle=Math.atan2(target.x-player.x,target.z-player.z);c.lockedTarget=target.id;}c.attack(0,false,'chest');}
  if(flags&4)c.dodge(0,x/100||Math.sin(player.angle),z/100||Math.cos(player.angle));
  if(flags&8)c.special(0,0);if(flags&16)c.special(0,1);
  c.tick(STEP,{x:x/100,z:z/100,faceAngle:flags&1?player.angle:face/1000,block:!!(flags&2)});
  for(const f of c.fighters)f.navHeight=terrainHeight(f.x,f.z);
  for(const a of c.arrows){a.age+=STEP;a.x+=a.dx*14*STEP;a.z+=a.dz*14*STEP;for(const f of c.fighters){if(f.team===1||f.hp<=0||Math.hypot(f.x-a.x,f.z-a.z)>.48)continue;
    const shooter=c.fighters[a.owner];if(f.action!=='dodge'&&!c.guard(shooter,f,false)){shooter.itemProjectile=true;c.damage(shooter,f,9,'chest',false);shooter.itemProjectile=false;}a.age=3;break;}}
  c.arrows=c.arrows.filter(a=>a.age<2);
  state.steps++;if(state.steps>=MAX_STEPS&&!c.finished){c.finished=true;c.result='loss';c.emit('finish',{result:'loss',timeout:true});}
 }
 function replay(ticket,commands,steps){
  if(!Number.isInteger(steps)||steps<0||steps>MAX_STEPS||!Array.isArray(commands)||commands.length!==Math.ceil(steps/3)||!commands.every(valid))throw Error('Savaş kaydı doğrulanamadı.');
  const state=create(ticket);for(let i=0;i<steps;i++){if(state.combat.finished)throw Error('Tamamlanmış savaşta ek komut var.');step(state,commands[Math.floor(i/3)]);state.combat.drain();}return state;
 }
  root.CaravanSimulation={create,step,replay,packet,valid,terrainHeight,STEP,MAX_STEPS};
 if(typeof module!=='undefined')module.exports=root.CaravanSimulation;
})(globalThis);
