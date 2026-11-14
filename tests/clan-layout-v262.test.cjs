const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function setup(){
 const drawing=new Proxy({measureText:()=>({width:20})},{get:(o,k)=>o[k]||(()=>{})});
 const c={console:{warn(){}},document:{createElement:()=>({getContext:()=>drawing})},Image:class{}};
 vm.createContext(c);vm.runInContext(read('owner-three-r160.js'),c);
 let paints=0;c.LudusSupply={paintMap:async()=>{paints++;}};
 vm.runInContext(read('ludus-room-design-v87.js'),c);
 const T=c.THREE,props=new T.Group(),colliders=[],design=c.LudusRoomDesign.create({T,wood:new T.MeshStandardMaterial(),stone:new T.MeshStandardMaterial(),props,colliders});
 return {T,props,colliders,design,paints:()=>paints};
}
test('clan uses the existing caravan artwork, without trophies or added lights',async()=>{
 const {design,paints}=setup(),room=design.enter('clan');await Promise.resolve();
 const map=room.getObjectByName('Kervan kaynak haritası');assert.ok(map);assert.equal(map.userData.source,'assets/supply-v91/rome-panorama.webp');assert.equal(map.userData.pointCount,16);assert.equal(map.userData.ready,true);assert.equal(paints(),1);
 assert.ok(!room.userData.features.some(x=>/trophy/.test(x)));let lights=0;room.traverse(n=>{if(n.isLight)lights++;});assert.equal(lights,0);
 assert.ok(map.position.z< -3.9);assert.ok(Math.abs(map.scale.x/map.scale.y-2)<1e-6);
});
test('right table and left chest leave the central aisle and both interaction points walkable',()=>{
 const {design,colliders}=setup();design.enter('clan');
 const table=colliders.find(c=>c.kind==='design-clan-management-table'),chest=colliders.find(c=>c.kind==='design-clan-vault-plinth');assert.ok(table);assert.ok(chest);
 const blocked=(x,z)=>colliders.some(c=>x>c.minX-.3&&x<c.maxX+.3&&z>c.minZ-.3&&z<c.maxZ+.3);
 assert.equal(blocked(2.5,-1.85),true);assert.equal(blocked(-3.10,-2.4),true);assert.equal(blocked(0,2.6),false);
 for(let z=2.6;z>=-3.5;z-=.1)assert.equal(blocked(0,z),false,'central walking route '+z);
 assert.ok(chest.maxX<0);assert.ok(table.minX>0);assert.ok(chest.minX> -4.7);assert.ok(table.maxX<4.7);
 assert.equal(blocked(2.5,-.6),false);assert.equal(blocked(-3.1,-1.1),false);
});
test('repeat entry reuses the map and clears old collision bounds',async()=>{
 const {design,props,colliders,paints}=setup();let room=design.enter('clan'),count=colliders.length;
 for(let i=0;i<20;i++){design.leave();assert.equal(colliders.length,0);assert.equal(props.children.length,0);assert.equal(design.enter('clan'),room);assert.equal(colliders.length,count);assert.equal(props.children.length,1);}
 await Promise.resolve();assert.equal(paints(),1);
 design.leave();design.enter('office');assert.ok(!colliders.some(c=>c.kind.startsWith('design-clan-')));
});
test('game entry parses and keeps management/vault controls connected',()=>{
 const html=read('ludus.html');for(const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){if(!m[1].trim()||/type="(?:importmap|application\/)/.test(m[0].slice(0,m[0].indexOf('>'))))continue;new vm.Script(m[1]);}
 assert.ok(!html.includes('function clanCup('));assert.ok(!html.includes('Kupa rafları'));assert.ok(html.includes('clanVault?.tick();tickClanRoom();'));assert.ok(html.includes("roomClanButton.textContent='Yönetim Masası'"));
 const chest=read('clan-vault-v35.js');assert.ok(chest.includes('chest.position.set(-3.10,.16,-2.40)'));assert.ok(chest.includes('ctx.player.x-chest.position.x'));assert.ok(chest.includes('ctx.player.z-chest.position.z'));assert.ok(!chest.includes('m.map=null'));assert.ok(html.includes('clanTablePoint=new T.Vector3(2.5,1.45,-1.85)'));
});

test('Roman room uses mosaic, frescoes, timber and black desk legs without recolouring other rooms',()=>{
 const {design}=setup(),room=design.enter('clan'),materials=new Set();room.traverse(o=>{if(o.material)materials.add(o.material);});
 for(const name of ['clan-roman-mosaic','clan-fresco','clan-timber','clan-black-table-legs'])assert.ok([...materials].some(m=>m.name===name),name);
 const legs=[...materials].find(m=>m.name==='clan-black-table-legs');assert.equal(legs.color.getHex(),0x171818);
 assert.ok([...materials].some(m=>m.color.getHex()===0xb69975));assert.ok([...materials].some(m=>m.color.getHex()===0x843e30));
 const office=design.enter('office');office.traverse(o=>{assert.ok(!o.material?.name.startsWith('clan-'));});
});
