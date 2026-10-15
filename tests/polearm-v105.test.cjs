const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./naval-fixture.cjs');
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
for(const kind of ['spear','trident']){
 test(kind+': guard, chamber, thrust and recovery form one continuous trajectory',()=>{
  const M=fixture().context.ArenaMotion,p=M.profile(kind),f={id:0,weapon:kind,attackWeapon:kind,attackProfile:p,attackRegion:'chest',action:'attack',timer:0,chain:1};
  const guard=M.poleGuard(f),start=M.sample(f,0),end=M.sample(f,p.duration),chamber=M.sample(f,p.wind),contact=M.sample(f,p.wind+p.active);
  assert.ok(distance(guard.grip,start.grip)<1e-9&&distance(start.grip,end.grip)<1e-9);assert.ok(distance(start.dir,end.dir)<1e-9);
  assert.ok(chamber.grip.z<start.grip.z-.15);assert.ok(contact.grip.z>chamber.grip.z+.45);assert.ok(Math.abs(contact.tip.x)<1e-8);
  for(const boundary of [p.wind,p.wind+p.active,p.duration]){assert.ok(distance(M.sample(f,boundary-1e-6).tip,M.sample(f,boundary+1e-6).tip)<1e-4);}
  let previous=start;for(let time=1/240;time<=p.duration;time+=1/240){const s=M.sample(f,time);assert.ok(distance(s.tip,previous.tip)<.07);assert.ok(Math.abs(Math.hypot(s.dir.x,s.dir.y,s.dir.z)-1)<1e-9);previous=s;}
 });
 test(kind+': targets use the same visible point at head, chest and leg heights',()=>{
  const M=fixture().context.ArenaMotion;
  for(const attackRegion of ['head','chest','leftLeg','rightLeg'])for(const attackLeft of [false,true]){
   const p=M.profile(kind,true,true),f={id:1,weapon:kind,attackWeapon:kind,attackProfile:p,attackRegion,attackLeft,action:'attack',timer:p.wind+p.active,angle:0,x:0,z:0};
   const s=M.sample(f);assert.ok(Math.abs(s.tip.y-M.regions[attackRegion].y)<1e-9);assert.ok(Math.abs(s.tip.x)<1e-8);assert.ok(s.tip.z>1.8);
   const body=M.body(f);assert.ok(body.shift>0&&body.lean>0);assert.ok(Object.values(body.poses).flat().every(Number.isFinite));
   assert.ok(M.contact(f,{x:0,z:s.tip.z,angle:0},f.timer-.02,f.timer));
  }
 });
 test(kind+': a real duel damages once per jab and retains ordinary stamina cost',()=>{
  const {combat:c,p,naval,context}=fixture();c.naval=null;for(const f of c.fighters)f.hp=0;
  Object.assign(p,{hp:100,weapon:kind,offhand:null,x:0,z:0,angle:0,stamina:100,action:'idle',cooldown:0,stunUntil:0});
  const enemy=c.fighters[5];Object.assign(enemy,{hp:200,maxHp:200,x:0,z:1.9,angle:Math.PI,shield:null,blocking:false,cooldown:99,passiveEvasion:0});c.lockedTarget=5;c.botStep=()=>{};
  assert.ok(c.attack(0));const cost=100-p.stamina;assert.ok(cost>0&&cost<25);
  for(let i=0;i<125;i++)c.tick(1/120,{});
  assert.ok(enemy.hp<200);assert.equal(c.events.filter(e=>e.type==='hit'&&e.source===0&&e.id===5).length,1);
 });
}
