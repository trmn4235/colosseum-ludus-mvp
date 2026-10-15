/* Four crews share the existing 4x5 combat rules. No account or reward writes. */
(function (root) {
  'use strict';
  const C = Object.freeze({arenaRadius:34.2, halfWidth:2.6, halfLength:5.5,
    hullWidth:3.5, hullLength:8.4, bridgeLength:3.8, bridgeWidth:1.8,
    margin:.34, interactDistance:1.9, openSeconds:.85, berth:8});
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  function world(ship,x,z){const c=Math.cos(ship.angle),s=Math.sin(ship.angle);return{x:ship.x+x*c+z*s,z:ship.z-x*s+z*c};}
  function local(ship,p){const x=p.x-ship.x,z=p.z-ship.z,c=Math.cos(ship.angle),s=Math.sin(ship.angle);return{x:x*c-z*s,z:x*s+z*c};}
  function onDeck(ship,p,margin=C.margin){const q=local(ship,p);return Math.abs(q.x)<=C.halfWidth-margin&&Math.abs(q.z)<=C.halfLength-margin;}
  function separation(a,b){
    let overlap=Infinity,normal=null;
    for(const angle of [a.angle,b.angle])for(const axis of [{x:Math.cos(angle),z:-Math.sin(angle)},{x:Math.sin(angle),z:Math.cos(angle)}]){
      const projection=s=>C.hullWidth*Math.abs(axis.x*Math.cos(s.angle)-axis.z*Math.sin(s.angle))+C.hullLength*Math.abs(axis.x*Math.sin(s.angle)+axis.z*Math.cos(s.angle));
      const d=(b.x-a.x)*axis.x+(b.z-a.z)*axis.z,depth=projection(a)+projection(b)-Math.abs(d);
      if(depth<=0)return null;
      if(depth<overlap){overlap=depth;normal={x:axis.x*(d<0?-1:1),z:axis.z*(d<0?-1:1)};}
    }
    return{x:normal.x*(overlap+.002),z:normal.z*(overlap+.002)};
  }
  class Battle {
    constructor(combat){
      this.combat=combat;this.manual=false;this.time=0;this.bridges=[];this.nextBridge=1;this.routes=new Map();
      this.ships=Array.from({length:4},(_,id)=>({id,team:id,x:(id-1.5)*C.berth,z:id%2?-13:13,angle:0,speed:0,turn:0,helm:null,throttle:0,steer:0}));
      for(const f of combat.fighters){
        f.shipId=f.team;f.navBridge=null;
        const positions=[[0,-3.7],[-1.25,-1.7],[1.25,-1.7],[-1.15,2],[1.15,2]],q=positions[f.id%5],s=this.ships[f.shipId];
        Object.assign(f,world(s,q[0],q[1]));f.angle=s.angle;f.navSafe={x:f.x,z:f.z};
      }
      combat.naval=this;
      for(const ship of this.ships)this.assignCaptain(ship);
    }
    player(){return this.combat.fighters[0];}
    linked(ship){return this.bridges.some(b=>b.phase!=='closed'&&(b.from===ship.id||b.to===ship.id));}
    capable(f){return !!f&&f.hp>0&&f.action!=='knocked'&&f.stunUntil<=this.combat.time;}
    assignCaptain(ship){
      if(ship.id===0&&this.manual&&this.capable(this.player())){ship.helm=0;return;}
      const existing=this.combat.fighters[ship.helm];
      if(this.capable(existing)&&existing.id!==0&&existing.team===ship.team&&existing.shipId===ship.id&&!existing.navBridge)return;
      const helm=world(ship,0,-3.7);
      const crew=this.combat.fighters.filter(f=>f.id!==0&&this.capable(f)&&f.team===ship.team&&f.shipId===ship.id&&!f.navBridge);
      crew.sort((a,b)=>distance(a,helm)-distance(b,helm)||a.id-b.id);
      ship.helm=crew[0]?.id??null;
    }
    canTakeHelm(){const p=this.player();return !this.combat.finished&&p.hp>0&&p.shipId===0&&!p.navBridge&&p.action==='idle'&&p.stunUntil<=this.combat.time;}
    takeHelm(){
      if(this.manual||!this.canTakeHelm())return false;
      const s=this.ships[0],p=this.player(),previous=this.combat.fighters[s.helm];
      if(previous){Object.assign(previous,world(s,-1.2,-2.2));previous.navSafe={x:previous.x,z:previous.z};}
      Object.assign(p,world(s,0,-3.7));p.angle=s.angle;p.navSafe={x:p.x,z:p.z};
      this.manual=true;s.helm=0;s.throttle=s.steer=0;this.combat.lockedTarget=null;return true;
    }
    releaseHelm(){
      if(!this.manual)return false;
      const s=this.ships[0];this.manual=false;s.helm=null;s.throttle=s.steer=0;
      this.assignCaptain(s);return true;
    }
    /* Both landing corners and the final half metre must be inside a side deck. */
    candidate(shipId,side){
      const s=this.ships[shipId];if(!s||![-1,1].includes(side))return null;
      if(this.bridges.some(b=>b.from===shipId&&b.side===side&&b.phase!=='closed'))return null;
      if(Math.abs(s.speed)>.32||Math.abs(s.turn)>.09)return null;
      const end=world(s,side*(C.halfWidth+C.bridgeLength),0);
      for(const t of this.ships){
        if(t===s||Math.abs(t.speed)>.32||Math.abs(t.turn)>.09)continue;
        if(this.bridges.some(b=>b.phase!=='closed'&&((b.from===s.id&&b.to===t.id)||(b.to===s.id&&b.from===t.id))))continue;
        if(Math.abs(Math.sin(t.angle-s.angle))>.12)continue;
        const center=local(s,t);if(Math.sign(center.x)!==side||Math.abs(center.x)<C.halfWidth*2+.6)continue;
        if(![-.5,0].every(dx=>[-1,1].every(z=>onDeck(t,world(s,side*(C.halfWidth+C.bridgeLength+dx),z*C.bridgeWidth/2),.12))))continue;
        // Another hull must not obstruct the walkway before its landing.
        let obstructed=false;
        for(const other of this.ships)if(other!==s&&other!==t)for(let x=C.halfWidth+.15;x<C.halfWidth+C.bridgeLength;x+=.25){
          if(onDeck(other,world(s,side*x,0),-.2)){obstructed=true;break;}
        }
        if(!obstructed)return{from:shipId,to:t.id,side,end};
      }
      return null;
    }
    nearBridge(f,ship,side){return !f.navBridge&&f.shipId===ship.id&&distance(f,world(ship,side*(C.halfWidth-.5),0))<=C.interactDistance;}
    interaction(f=this.player()){
      if(this.combat.finished||f.hp<=0||this.manual||f.action!=='idle'||f.stunUntil>this.combat.time)return null;
      const ship=this.ships[f.shipId];if(!ship)return null;
      for(const side of [-1,1]){
        if(!this.nearBridge(f,ship,side))continue;
        const existing=this.bridges.find(b=>b.from===ship.id&&b.side===side&&b.phase!=='closed');
        if(existing){if(existing.phase==='open')return{kind:'close',side,bridge:existing.id,blocked:this.occupied(existing)};continue;}
        const candidate=this.candidate(ship.id,side);if(candidate)return{kind:'open',...candidate};
      }
      return null;
    }
    operate(){
      const action=this.interaction();if(!action)return false;
      return action.kind==='close'?this.close(action.bridge):!!this.open(action.from,action.side);
    }
    open(shipId,side){
      const hit=this.candidate(shipId,side);if(!hit)return null;
      const b={id:this.nextBridge++,...hit,phase:'opening',progress:0};this.bridges.push(b);this.routes.clear();
      for(const id of [b.from,b.to]){const s=this.ships[id];s.speed=s.turn=s.throttle=s.steer=0;}
      return b;
    }
    onBridge(b,p,margin=C.margin){
      const q=local(this.ships[b.from],p),x=q.x*b.side;
      return x>=C.halfWidth-.7&&x<=C.halfWidth+C.bridgeLength+.1&&Math.abs(q.z)<=C.bridgeWidth/2-margin;
    }
    occupied(b){return this.combat.fighters.some(f=>f.hp>0&&(f.navBridge===b.id||this.onBridge(b,f,-.35)));}
    close(id){const b=this.bridges.find(b=>b.id===id);if(!b||b.phase!=='open'||this.occupied(b))return false;b.phase='closing';this.routes.clear();return true;}
    route(from,to){
      const key=from*4+to;if(this.routes.has(key))return this.routes.get(key);
      if(from===to){const path=[];this.routes.set(key,path);return path;}
      const todo=[{ship:from,path:[]}],seen=new Set([from]);
      while(todo.length){const n=todo.shift();for(const b of this.bridges){
        if(b.phase!=='open'||b.from!==n.ship&&b.to!==n.ship)continue;
        const next=b.from===n.ship?b.to:b.from;if(seen.has(next))continue;
        const path=[...n.path,{bridge:b,next}];if(next===to){this.routes.set(key,path);return path;}
        seen.add(next);todo.push({ship:next,path});
      }}this.routes.set(key,null);return null;
    }
    canStand(f,point){
      if(onDeck(this.ships[f.shipId],point))return true;
      return this.bridges.some(b=>b.phase==='open'&&(b.from===f.shipId||b.to===f.shipId)&&(this.onBridge(b,point)||onDeck(this.ships[b.from===f.shipId?b.to:b.from],point)));
    }
    // Carry cached death/roll poses as well as live actors. Distant and settled
    // corpses deliberately skip skeleton animation, but still belong to a deck.
    carryPose(f,m){
      const ship=this.ships[f.shipId],old=m.navalShipFrame;
      if(old&&old.id===ship.id&&!f.navBridge){
        const angle=delta(ship.angle,old.angle);
        for(const point of [m.root.position,m.fallTransition])if(point){const q=local(old,point);Object.assign(point,world(ship,q.x,q.z));}
        m.root.rotation.y+=angle;
        if(m.fallTransition)m.fallTransition.heading+=angle;
        if(m.rollTransition)m.rollTransition.heading+=angle;
      }
      m.navalShipFrame={id:ship.id,x:ship.x,z:ship.z,angle:ship.angle};
    }
    bound(o){
      if(o.shipId===undefined){
        const s=this.ships.find(s=>onDeck(s,o,0))||this.ships.reduce((a,b)=>distance(a,o)<distance(b,o)?a:b);
        o.shipId=s.id;
      }
      const own=this.ships[o.shipId];
      if(onDeck(own,o)){o.navBridge=null;o.navSafe={x:o.x,z:o.z};return;}
      const possible=this.bridges.filter(b=>b.phase==='open'&&(b.from===o.shipId||b.to===o.shipId||b.id===o.navBridge));
      for(const b of possible){
        const other=this.ships[b.from===o.shipId?b.to:b.from];
        if(onDeck(other,o)){o.shipId=other.id;o.navBridge=null;o.navSafe={x:o.x,z:o.z};return;}
        if(this.onBridge(b,o)){o.navBridge=b.id;o.navSafe={x:o.x,z:o.z};return;}
      }
      const bridge=possible.find(b=>b.id===o.navBridge);
      if(bridge){const s=this.ships[bridge.from],q=local(s,o);Object.assign(o,world(s,bridge.side*clamp(q.x*bridge.side,C.halfWidth-.7,C.halfWidth+C.bridgeLength),clamp(q.z,-C.bridgeWidth/2+C.margin,C.bridgeWidth/2-C.margin)));}
      else{const q=local(own,o);Object.assign(o,world(own,clamp(q.x,-C.halfWidth+C.margin,C.halfWidth-C.margin),clamp(q.z,-C.halfLength+C.margin,C.halfLength-C.margin)));o.navBridge=null;}
      o.navSafe={x:o.x,z:o.z};
    }
    botStep(f,dt,normal){
      const ship=this.ships[f.shipId];
      if(ship.helm===f.id&&!this.linked(ship)){this.walkTo(f,world(ship,0,-3.7),dt);f.angle=ship.angle;return;}
      let target=null,best=Infinity,path=null;
      for(const other of this.combat.fighters){if(!this.combat.enemy(f,other))continue;
        const route=this.route(f.shipId,other.shipId);if(route===null)continue;
        const cost=distance(f,other)+route.length*5;if(cost<best){target=other;path=route;best=cost;}
      }
      if(!target){
        if(ship.id!==0){for(const side of [-1,1])if(f.id%5===(side<0?1:2)&&this.candidate(ship.id,side)){this.walkTo(f,world(ship,side*(C.halfWidth-.5),0),dt);return;}}
        const k=f.id%5,spot=[[-1.15,2.6],[-1.25,-1.8],[1.25,-1.8],[-1.15,2],[1.15,2]][k];
        this.walkTo(f,world(ship,...spot),dt);return;
      }
      f.target=target.id;f.think=.12;
      if(f.shipId===target.shipId||distance(f,target)<1.8){normal(f,dt);return;}
      const segment=path?.[0];if(!segment)return;
      const b=segment.bridge,source=this.ships[b.from];
      let point;
      if(f.shipId===b.from){const q=local(source,f);point=world(source,b.side*(q.x*b.side<C.halfWidth-.65?C.halfWidth-.55:C.halfWidth+C.bridgeLength),0);}
      else{const q=local(source,f);point=world(source,b.side*(q.x*b.side>C.halfWidth+C.bridgeLength-.35?C.halfWidth+C.bridgeLength-.5:C.halfWidth-.65),0);}
      this.walkTo(f,point,dt);
    }
    walkTo(f,p,dt){const d=distance(f,p);f.blocking=false;f.guardRegion=null;if(d<.12)return;const angle=Math.atan2(p.x-f.x,p.z-f.z);f.angle+=delta(angle,f.angle)*Math.min(1,dt*9);const amount=Math.min(d,dt*2.3*(f.speedBonus||1));f.x+=(p.x-f.x)*amount/d;f.z+=(p.z-f.z)*amount/d;f.move=.65;}
    helmInput(input){
      if(!this.manual)return input;
      const s=this.ships[0];s.throttle=clamp(input.navalThrottle||0,-1,1);s.steer=clamp(input.navalSteer||0,-1,1);
      return{x:0,z:0,block:false,faceAngle:s.angle};
    }
    goal(ship){
      if(ship.id===0)return{x:-12,z:0,angle:0};
      const predecessor=this.ships[ship.id-1];
      const options=[1,-1].map(side=>{const p=world(predecessor,side*C.berth,0);let cost=Math.max(0,Math.hypot(p.x,p.z)-26)*10+(side===1?0:2);
        for(const s of this.ships)if(s!==predecessor&&s!==ship)cost+=Math.max(0,6.5-distance(s,p))*4;
        return{...p,angle:predecessor.angle,cost};});
      options.sort((a,b)=>a.cost-b.cost);return options[0];
    }
    step(dt,input={}){
      if(this.combat.finished)return input;
      this.time+=dt;
      if(this.manual&&(!this.capable(this.player())||this.player().shipId!==0))this.releaseHelm();
      const output=this.helmInput(input),previous=this.ships.map(s=>({...s}));
      for(const b of this.bridges){
        if(b.phase==='opening'){b.progress=Math.min(1,b.progress+dt/C.openSeconds);if(b.progress===1){b.phase='open';this.routes.clear();}}
        if(b.phase==='closing'){b.progress=Math.max(0,b.progress-dt/C.openSeconds);if(b.progress===0)b.phase='closed';}
      }
      for(const ship of this.ships){
        this.assignCaptain(ship);
        if(this.linked(ship)||ship.helm===null){ship.speed=ship.turn=0;continue;}
        if(ship.id===0&&this.manual){
          ship.speed+=(ship.throttle*(ship.throttle<0?1.5:3)-ship.speed)*Math.min(1,dt*2);
          ship.turn=ship.steer*.65;ship.angle+=ship.turn*dt;
          ship.x+=Math.sin(ship.angle)*ship.speed*dt;ship.z+=Math.cos(ship.angle)*ship.speed*dt;
        }else{
          // Rowing crews keep decks parallel during a side approach; chasing the
          // moving bearing caused endless circling and prevented a safe landing.
          const goal=this.goal(ship),d=distance(ship,goal),target=goal.angle;
          const turn=clamp(delta(target,ship.angle),-dt*.65,dt*.65);ship.angle+=turn;ship.turn=turn/dt;
          const speed=Math.min(2,d*1.5);ship.speed=d>.1?speed:0;
          if(d>.1){ship.x+=(goal.x-ship.x)*speed*dt/d;ship.z+=(goal.z-ship.z)*speed*dt/d;}
          if(d<.12&&Math.abs(delta(goal.angle,ship.angle))<.02){ship.x=goal.x;ship.z=goal.z;ship.angle=goal.angle;ship.speed=ship.turn=0;}
        }
        const radius=Math.hypot(ship.x,ship.z),limit=C.arenaRadius-Math.hypot(C.hullLength,C.hullWidth)-.3;
        if(radius>limit){ship.x*=limit/radius;ship.z*=limit/radius;ship.speed=0;}
      }
      for(let iteration=0;iteration<4;iteration++){
        for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
          const a=this.ships[i],b=this.ships[j],push=separation(a,b);if(!push)continue;
          const fixedA=this.linked(a),fixedB=this.linked(b);if(fixedA&&fixedB)continue;
          const ka=fixedA?0:fixedB?1:.5,kb=fixedB?0:fixedA?1:.5;
          a.x-=push.x*ka;a.z-=push.z*ka;b.x+=push.x*kb;b.z+=push.z*kb;a.speed=b.speed=0;
        }
        for(const ship of this.ships)if(!this.linked(ship)){
          const radius=Math.hypot(ship.x,ship.z),limit=C.arenaRadius-Math.hypot(C.hullLength,C.hullWidth)-.3;
          if(radius>limit){ship.x*=limit/radius;ship.z*=limit/radius;ship.speed=0;}
        }
      }
      for(const o of [...this.combat.fighters,...this.combat.drops]){
        if(o.shipId===undefined)this.bound(o);
        if(o.navBridge)continue;
        const old=previous[o.shipId],ship=this.ships[o.shipId],q=local(old,o),angle=delta(ship.angle,old.angle);
        Object.assign(o,world(ship,q.x,q.z));if(Number.isFinite(o.angle))o.angle+=angle;
        if(o.knockOrigin){const k=local(old,o.knockOrigin);Object.assign(o.knockOrigin,world(ship,k.x,k.z));o.knockAngle+=angle;}
      }
      // Opposing crews deploy their own boarding bridges only from a valid landing.
      for(const ship of this.ships)if(ship.id!==0&&this.time>8&&this.combat.alive(ship.team)>0){
        for(const side of [-1,1]){const candidate=this.candidate(ship.id,side);if(!candidate)continue;
          const crew=this.combat.fighters.find(f=>f.hp>0&&f.team===ship.team&&f.shipId===ship.id&&this.nearBridge(f,ship,side));
          if(crew)this.open(ship.id,side);
        }
      }
      return output;
    }
    afterStep(){for(const f of this.combat.fighters)this.bound(f);if(this.manual&&!this.capable(this.player()))this.releaseHelm();for(const ship of this.ships)this.assignCaptain(ship);}
  }
  function install(combat){
    const naval=new Battle(combat),bound=combat.bound.bind(combat),bot=combat.botStep.bind(combat),tick=combat.tick.bind(combat);
    combat.bound=function(f,r){if(this.naval)naval.bound(f);else bound(f,r);};
    combat.botStep=function(f,dt){if(this.naval)naval.botStep(f,dt,bot);else bot(f,dt);};
    combat.tick=function(dt,input){if(!this.naval)return tick(dt,input);const controls=naval.step(dt,input);tick(dt,controls);naval.afterStep();};
    return naval;
  }
  const api={constants:C,Battle,install,world,local,onDeck,separation};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NavalSimulation=api;
})(typeof window!=='undefined'?window:globalThis);
