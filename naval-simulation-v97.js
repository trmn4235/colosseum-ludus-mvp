/* Four crews share the existing 4x5 combat rules. No account or reward writes. */
(function (root) {
  'use strict';
  const C = Object.freeze({arenaRadius:34.2*Math.SQRT2, halfWidth:2.6, halfLength:5.5,
    hullWidth:3.5, hullLength:8.4, bridgeLength:3.8, bridgeWidth:1.8,
    margin:.34, interactDistance:1.9, openSeconds:.85, berth:8,
    jumpRange:4.6, jumpCost:20, jumpWindup:.12, jumpFlight:.72, jumpHeight:1.12, jumpRecovery:.18,
    javelinStock:8, javelinCost:18, javelinRange:22, javelinSpeed:15, rackX:-1.7, rackZ:-4.3});
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  function world(ship,x,z){const c=Math.cos(ship.angle),s=Math.sin(ship.angle);return{x:ship.x+x*c+z*s,z:ship.z-x*s+z*c};}
  function local(ship,p){const x=p.x-ship.x,z=p.z-ship.z,c=Math.cos(ship.angle),s=Math.sin(ship.angle);return{x:x*c-z*s,z:x*s+z*c};}
  function onDeck(ship,p,margin=C.margin){const q=local(ship,p);return Math.abs(q.x)<=C.halfWidth-margin+1e-7&&Math.abs(q.z)<=C.halfLength-margin+1e-7;}
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
      this.combat=combat;this.arenaRadius=C.arenaRadius;this.manual=false;this.time=0;this.bridges=[];this.nextBridge=1;this.routes=new Map();
      const starts=[[-7,-14,.26],[10,-10,-.45],[-15,9,Math.PI-.3],[10,13,Math.PI+.35]];
      this.ships=starts.map(([x,z,angle],id)=>({id,team:id,x,z,angle,speed:0,turn:0,helm:null,throttle:0,steer:0,javelins:C.javelinStock}));
      this.javelins=[];this.nextJavelin=1;
      for(const f of combat.fighters){
        f.shipId=f.team;f.navBridge=null;f.navJump=null;f.navHeight=0;f.navJumpReady=0;f.navJavelin=false;
        const positions=[[0,-3.7],[-1.25,-1.7],[1.25,-1.7],[-1.15,2],[1.15,2]],q=positions[f.id%5],s=this.ships[f.shipId];
        Object.assign(f,world(s,q[0],q[1]));f.angle=s.angle;f.navSafe={x:f.x,z:f.z};
      }
      combat.naval=this;
      for(const ship of this.ships)this.assignCaptain(ship);
    }
    player(){return this.combat.fighters[0];}
    rack(f=this.player()){
      if(!f||f.hp<=0||f.navBridge||f.navJump||f.id===0&&this.manual||this.combat.finished)return null;
      const ship=this.ships[f.shipId];return ship&&distance(f,world(ship,C.rackX,C.rackZ))<=1.65?ship:null;
    }
    takeJavelin(){
      const f=this.player(),rack=this.rack(f);
      if(!rack||rack.javelins<=0||f.navJavelin||f.action!=='idle'||f.stunUntil>this.combat.time)return false;
      rack.javelins--;f.navJavelin=true;this.combat.emit('javelinpickup',{id:f.id,ship:rack.id});return true;
    }
    javelinTarget(f=this.player()){
      if(!f||f.hp<=0||!f.navJavelin||this.combat.finished)return null;
      const locked=this.combat.fighters[this.combat.lockedTarget];
      if(this.combat.enemy(f,locked)&&distance(f,locked)<=C.javelinRange)return locked;
      return this.combat.nearest(f,C.javelinRange);
    }
    throwJavelin(){
      const f=this.player(),target=this.javelinTarget(f);
      if(!target||this.manual||f.navJump||f.action!=='idle'||f.stunUntil>this.combat.time||f.stamina<C.javelinCost)return false;
      f.angle=Math.atan2(target.x-f.x,target.z-f.z);f.action='spearcast';f.timer=0;f.duration=.7;f.attackLeft=false;
      f.stamina-=C.javelinCost;f.regenDelay=1;f.blocking=false;f.guardInput=false;f.guardRegion=null;
      this.javelins.push({id:this.nextJavelin++,owner:f.id,x:f.x,z:f.z,y:1.35,dx:Math.sin(f.angle),dz:Math.cos(f.angle),age:0,travel:0,launched:false});
      this.combat.emit('special',{id:f.id,target:target.id,kind:'throw'});return true;
    }
    updateJavelins(dt){
      for(let i=this.javelins.length-1;i>=0;i--){
        const n=this.javelins[i],owner=this.combat.fighters[n.owner];n.age+=dt;
        if(!n.launched){
          if(owner.hp<=0||owner.action!=='spearcast'||owner.stunUntil>this.combat.time){if(owner.hp<=0)owner.navJavelin=false;this.javelins.splice(i,1);continue;}
          n.x=owner.x;n.z=owner.z;if(n.age<.24)continue;n.launched=true;owner.navJavelin=false;
        }
        const px=n.x,pz=n.z,py=n.y,step=C.javelinSpeed*dt;
        n.travel+=step;n.x+=n.dx*step;n.z+=n.dz*step;n.y=1.35+.24*Math.sin(Math.PI*n.travel/C.javelinRange);
        let hit=false;
        for(const victim of this.combat.fighters){
          if(!this.combat.enemy(owner,victim)||victim.action==='dodge')continue;
          const u=clamp(((victim.x-px)*n.dx+(victim.z-pz)*n.dz)/Math.max(step,.001),0,1);
          if(Math.hypot(victim.x-(px+n.dx*step*u),victim.z-(pz+n.dz*step*u),(1.35+(victim.navHeight||0))-(py+(n.y-py)*u))>.48)continue;
          const point={x:victim.x,y:1.35+(victim.navHeight||0),z:victim.z};
          if(!this.combat.guard(owner,victim,false,point))this.combat.damageProjectileV10(owner,victim,{kind:'spear'},32,'chest',false,point);
          hit=true;break;
        }
        if(hit||n.travel>=C.javelinRange||Math.hypot(n.x,n.z)>C.arenaRadius+1)this.javelins.splice(i,1);
      }
      if(this.player().hp<=0)this.player().navJavelin=false;
    }
    linked(ship){return this.bridges.some(b=>b.phase!=='closed'&&(b.from===ship.id||b.to===ship.id));}
    capable(f){return !!f&&f.hp>0&&!f.navJump&&f.action!=='knocked'&&f.stunUntil<=this.combat.time;}
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
    jumpCandidate(f=this.player()){
      if(this.combat.finished||!f||f.hp<=0||f.action!=='idle'||f.stunUntil>this.combat.time||f.navJump||f.navBridge||f.navJumpReady>this.time||f.stamina<C.jumpCost||f.id===0&&this.manual)return null;
      const s=this.ships[f.shipId];if(!s||!onDeck(s,f))return null;
      const origin=local(s,f),side=Math.sign(origin.x);
      if(Math.abs(origin.x)<C.halfWidth-C.margin-.65||Math.abs(origin.z)>C.halfLength-.7||Math.abs(s.speed)>2.25||Math.abs(s.turn)>.3)return null;
      let best=null;
      for(const t of this.ships){
        if(t===s||Math.abs(t.speed)>2.25||Math.abs(t.turn)>.3||separation(s,t))continue;
        const q=local(t,f);if(Math.abs(q.x)<C.halfWidth)continue;
        const edge=Math.sign(q.x)*(C.halfWidth-.65);
        for(const inset of [0,.65])for(const offset of [0,.9,-.9,1.8,-1.8]){
          const landing={x:edge-Math.sign(edge)*inset,z:clamp(q.z+offset,-C.halfLength+.7,C.halfLength-.7)},end=world(t,landing.x,landing.z),d=distance(f,end),across=local(s,end);
          if(distance(end,world(t,C.rackX,C.rackZ))<.95||d>C.jumpRange||d<1.1||(across.x-origin.x)*side<1.1||Math.abs(across.z-origin.z)>(across.x-origin.x)*side)continue;
          const future={...t,x:t.x+(t.vx||0)*C.jumpFlight,z:t.z+(t.vz||0)*C.jumpFlight,angle:t.angle+t.turn*C.jumpFlight};
          if(distance(f,world(future,landing.x,landing.z))>C.jumpRange)continue;
          if(this.combat.fighters.some(other=>other!==f&&other.hp>0&&(other.shipId===t.id&&!other.navJump&&distance(other,end)<.9||other.navJump?.to===t.id&&distance(world(t,other.navJump.landing.x,other.navJump.landing.z),end)<.9)))continue;
          if(!this.jumpPathClear(f,end,s.id,t.id))continue;
          const cost=d+Math.abs(offset)*.04;
          if(!best||cost<best.cost)best={from:s.id,to:t.id,side,landing,end,cost};
        }
      }
      return best;
    }
    jumpPathClear(start,end,from,to){
      for(const s of this.ships)if(s.id!==from&&s.id!==to)for(let u=.1;u<1;u+=.1){
        const q=local(s,{x:start.x+(end.x-start.x)*u,z:start.z+(end.z-start.z)*u});
        if(Math.abs(q.x)<C.hullWidth+.3&&Math.abs(q.z)<C.hullLength+.3)return false;
      }
      return true;
    }
    jump(){
      const f=this.player(),target=this.jumpCandidate(f);if(!target)return false;
      f.navJump={...target,origin:local(this.ships[f.shipId],f),started:this.time,elapsed:0,airborne:false,start:null};
      f.action='navalJump';f.timer=0;f.duration=C.jumpWindup+C.jumpFlight;f.navHeight=0;
      f.stamina-=C.jumpCost;f.regenDelay=1;f.blocking=false;f.guardInput=false;f.guardRegion=null;f.move=0;
      f.angle=Math.atan2(target.end.x-f.x,target.end.z-f.z);this.combat.lockedTarget=null;
      this.combat.emit('navaljump',{id:f.id,to:target.to});return true;
    }
    cancelJump(f){
      const j=f.navJump;if(!j)return;
      Object.assign(f,world(this.ships[j.from],j.origin.x,j.origin.z));f.shipId=j.from;f.navJump=null;f.navHeight=0;
      f.stamina=Math.min(f.maxStamina||100,f.stamina+C.jumpCost);f.navJumpReady=this.time+.2;
      if(f.action==='navalJump'){f.action='idle';f.timer=0;}this.bound(f);
    }
    finishJump(f){
      const j=f.navJump;if(!j)return;
      Object.assign(f,world(this.ships[j.to],j.landing.x,j.landing.z));f.shipId=j.to;f.navBridge=null;f.navJump=null;f.navHeight=0;
      f.navJumpReady=this.time+.5;f.navSafe={x:f.x,z:f.z};
      if(f.hp>0&&f.stunUntil<=this.combat.time){f.action='navalLand';f.timer=0;f.duration=C.jumpRecovery;}
      this.combat.emit('navalland',{id:f.id,to:j.to});
    }
    advanceJump(f){
      const j=f.navJump;if(!j)return;
      j.elapsed=this.time-j.started;
      const end=world(this.ships[j.to],j.landing.x,j.landing.z);
      if(!j.airborne){
        Object.assign(f,world(this.ships[j.from],j.origin.x,j.origin.z));
        if(f.hp<=0||f.stunUntil>this.combat.time||f.action!=='navalJump'||distance(f,end)>C.jumpRange+.1||!this.jumpPathClear(f,end,j.from,j.to)){this.cancelJump(f);return;}
        if(j.elapsed<C.jumpWindup)return;
        j.start={x:f.x,z:f.z};j.airborne=true;
      }
      const u=clamp((j.elapsed-C.jumpWindup)/C.jumpFlight,0,1);
      const before={x:f.x,z:f.z,angle:f.angle};
      f.x=j.start.x+(end.x-j.start.x)*u;f.z=j.start.z+(end.z-j.start.z)*u;f.navHeight=Math.sin(Math.PI*u)*C.jumpHeight;
      f.angle=Math.atan2(end.x-j.start.x,end.z-j.start.z);j.position={x:f.x,z:f.z};
      if(f.knockOrigin){f.knockOrigin.x+=f.x-before.x;f.knockOrigin.z+=f.z-before.z;f.knockAngle+=delta(f.angle,before.angle);}
      if(u>=1)this.finishJump(f);
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
        if(distance(end,world(t,C.rackX,C.rackZ))<1.05)continue;
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
      return x>=C.halfWidth-.7-1e-7&&x<=C.halfWidth+C.bridgeLength+.1+1e-7&&Math.abs(q.z)<=C.bridgeWidth/2-margin+1e-7;
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
      const jump=m.navalJumpFrame;
      if(f.navJump||jump){
        if(jump){
          const dx=f.x-jump.x,dz=f.z-jump.z,angle=delta(f.angle,jump.angle);
          for(const point of [m.root.position,m.fallTransition])if(point){point.x+=dx;point.z+=dz;}
          m.root.rotation.y+=angle;if(m.fallTransition)m.fallTransition.heading+=angle;
        }
        m.navalJumpFrame=f.navJump?{x:f.x,z:f.z,angle:f.angle}:null;
      }else if(old&&old.id===ship.id&&!f.navBridge){
        const angle=delta(ship.angle,old.angle);
        for(const point of [m.root.position,m.fallTransition])if(point){const q=local(old,point);Object.assign(point,world(ship,q.x,q.z));}
        m.root.rotation.y+=angle;
        if(m.fallTransition)m.fallTransition.heading+=angle;
        if(m.rollTransition)m.rollTransition.heading+=angle;
      }
      m.navalShipFrame={id:ship.id,x:ship.x,z:ship.z,angle:ship.angle};
    }
    bound(o){
      if(o.navJump){const j=o.navJump;Object.assign(o,j.airborne?j.position:world(this.ships[j.from],j.origin.x,j.origin.z));return;}
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
      if(ship.id===0)return{x:-3,z:-6,angle:.2};
      // Different bearings and staggered, opposing bows replace the straight row.
      const predecessor=this.ships[ship.id===3?1:0],preferred=ship.id===1?1:-1,offset=ship.id===2?-2.8:2.8;
      const options=[preferred,-preferred].map(side=>{const p=world(predecessor,side*C.berth,offset);let cost=Math.max(0,Math.hypot(p.x,p.z)-(C.arenaRadius-Math.hypot(C.hullLength,C.hullWidth)-1.5))*10+(side===preferred?0:3);
        for(const s of this.ships)if(s!==predecessor&&s!==ship)cost+=Math.max(0,6.5-distance(s,p))*4;
        return{...p,angle:predecessor.angle+Math.PI,cost};});
      options.sort((a,b)=>a.cost-b.cost);return options[0];
    }
    step(dt,input={}){
      if(this.combat.finished)return input;
      dt=clamp(dt,0,.05);if(dt===0)return input;
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
        if(o.navBridge||o.navJump)continue;
        const old=previous[o.shipId],ship=this.ships[o.shipId],q=local(old,o),angle=delta(ship.angle,old.angle);
        Object.assign(o,world(ship,q.x,q.z));if(Number.isFinite(o.angle))o.angle+=angle;
        if(o.knockOrigin){const k=local(old,o.knockOrigin);Object.assign(o.knockOrigin,world(ship,k.x,k.z));o.knockAngle+=angle;}
      }
      for(const ship of this.ships){ship.vx=(ship.x-previous[ship.id].x)/dt;ship.vz=(ship.z-previous[ship.id].z)/dt;}
      for(const f of this.combat.fighters)this.advanceJump(f);
      // Opposing crews deploy their own boarding bridges only from a valid landing.
      for(const ship of this.ships)if(ship.id!==0&&this.time>8&&this.combat.alive(ship.team)>0){
        for(const side of [-1,1]){const candidate=this.candidate(ship.id,side);if(!candidate)continue;
          const crew=this.combat.fighters.find(f=>f.hp>0&&f.team===ship.team&&f.shipId===ship.id&&this.nearBridge(f,ship,side));
          if(crew)this.open(ship.id,side);
        }
      }
      return output;
    }
    afterStep(dt=0){
      if(dt>0)this.updateJavelins(dt);
      for(const f of this.combat.fighters){
        if(f.navJump){
          if(!f.navJump.airborne&&(f.hp<=0||f.action!=='navalJump'||f.stunUntil>this.combat.time))this.cancelJump(f);
          else if(this.combat.finished)this.finishJump(f);
          else if(f.hp>0&&f.stunUntil<=this.combat.time)f.action='navalJump';
        }
        this.bound(f);
      }
      if(this.manual&&!this.capable(this.player()))this.releaseHelm();for(const ship of this.ships)this.assignCaptain(ship);
    }
  }
  function install(combat){
    const naval=new Battle(combat),bound=combat.bound.bind(combat),bot=combat.botStep.bind(combat),tick=combat.tick.bind(combat),attack=combat.attack.bind(combat),special=combat.special.bind(combat);
    combat.bound=function(f,r){if(this.naval)naval.bound(f);else bound(f,r);};
    combat.botStep=function(f,dt){if(this.naval)naval.botStep(f,dt,bot);else bot(f,dt);};
    combat.attack=function(id,...args){return this.naval&&id===0&&naval.player().navJavelin?naval.throwJavelin():attack(id,...args);};
    combat.special=function(id=0,...args){return this.naval&&id===0&&naval.player().navJavelin?naval.throwJavelin():special(id,...args);};
    combat.tick=function(dt,input){if(!this.naval)return tick(dt,input);if(this.finished)return;dt=clamp(dt,0,.05);const controls=naval.step(dt,input);tick(dt,controls);naval.afterStep(dt);};
    return naval;
  }
  function jumpPose(f){
    if(f.hp<=0||f.action==='knocked'||f.action==='stunned')return null;
    const j=f.navJump,landing=f.action==='navalLand';if(!j&&!landing)return null;
    const u=j?clamp((j.elapsed-C.jumpWindup)/C.jumpFlight,0,1):1;
    const crouch=landing?1-clamp(f.timer/C.jumpRecovery,0,1):j.airborne?0:clamp(j.elapsed/C.jumpWindup,0,1);
    const tuck=j?.airborne?Math.sin(Math.PI*u):0;
    return {drop:-.12*crouch,lean:.12*tuck,poses:{Spine:[.14*crouch+.08*tuck,0,0],Spine2:[.06*crouch,0,0],LeftUpLeg:[-.48*crouch-.7*tuck,0,0],RightUpLeg:[-.48*crouch-.42*tuck,0,0],LeftLeg:[.9*crouch+1.1*tuck,0,0],RightLeg:[.9*crouch+.8*tuck,0,0],LeftFoot:[-.2*tuck,0,0],RightFoot:[-.2*tuck,0,0],LeftArm:[-.38-.22*tuck,0,-.16],RightArm:[-.35-.4*tuck,0,.18],LeftForeArm:[-.75,0,0],RightForeArm:[-.7,0,0]}};
  }
  const api={constants:C,Battle,install,world,local,onDeck,separation,jumpPose};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NavalSimulation=api;
})(typeof window!=='undefined'?window:globalThis);
