/* Room-specific Roman interiors. Static, shared, instanced; no extra lights or frame work. */
var LudusRoomDesign=(()=>{
 'use strict';
 const themes={
  office:{name:'Yönetim · Tablinum',tone:0x702d39,ink:'#702d39',pale:0xe4d8bf,motif:'laurel'},
  clan:{name:'Klan · Zafer salonu',tone:0x512735,ink:'#512735',pale:0xe7ddc9,motif:'shield'},
  rest:{name:'Dinlenme · Sessiz yatakhane',tone:0x596961,ink:'#596961',pale:0xcec6af,motif:'star'},
  upgrades:{name:'Geliştirmeler · Fabrica',tone:0x484b4a,ink:'#484b4a',pale:0xc9bfa9,motif:'hammer'},
  infirmary:{name:'Revir · Valetudinarium',tone:0x607c74,ink:'#607c74',pale:0xe6dfcc,motif:'leaf'},
  dining:{name:'Yemekhane · Triclinium',tone:0x98593c,ink:'#98593c',pale:0xe8d9ba,motif:'wheat'}
 };
 function create({T,wood,stone,props,colliders}){
  const cache=new Map(),floorMats=new Map(),crestMats=new Map();let current=null;
  const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.9,...extra});
  const m={wood,stone,ivory:mat(0xeee5d1),gold:mat(0xaa8750,{metalness:.62,roughness:.48}),iron:mat(0x545759,{metalness:.5,roughness:.65}),dark:mat(0x302d2a),clay:mat(0xae6948),clayDark:mat(0x7e4b36),paper:mat(0xe2cea4),linen:mat(0xdcd4bd),red:mat(0x753b40),olive:mat(0x536443),herb:mat(0x7b8b5b),water:mat(0x759796,{metalness:.22,roughness:.32}),coal:mat(0x332a26),ember:mat(0xb04f24,{emissive:0xd34912,emissiveIntensity:.48}),light:new T.MeshBasicMaterial({color:0xe3d7b8})};
  const g={box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,14),sphere:new T.SphereGeometry(1,12,8),plane:new T.PlaneGeometry(1,1),ring:new T.TorusGeometry(1,.13,6,14),cone:new T.ConeGeometry(1,1,12),leaf:new T.SphereGeometry(1,7,5)};
  g.jar=new T.LatheGeometry([[.07,0],[.14,.04],[.24,.27],[.25,.48],[.18,.65],[.09,.75],[.09,.89],[.13,.92],[.13,.97],[.08,.97]].map(p=>new T.Vector2(...p)),14);
  g.bowl=new T.LatheGeometry([[0,0],[.12,0],[.23,.12],[.27,.22],[.23,.23],[.20,.13],[.10,.045],[0,.045]].map(p=>new T.Vector2(...p)),16);
  const shape=new T.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(0,.36);shape.closePath();g.pediment=new T.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:false});
  function canvasMat(key,crest=false){
   const bank=crest?crestMats:floorMats;if(bank.has(key))return bank.get(key);
   const theme=themes[key],c=document.createElement('canvas');c.width=c.height=512;const p=c.getContext('2d');
   p.fillStyle=crest?'#e7dbc2':'#d6ccb7';p.fillRect(0,0,512,512);
   if(!crest){for(let y=0;y<512;y+=16)for(let x=0;x<512;x+=16){p.fillStyle=['#ded4bf','#d4cab5','#d8cfbb','#cec5b1'][(x/16*3+y/16*7)%4];p.fillRect(x+1,y+1,14,14);}}
   p.strokeStyle=theme.ink;p.lineWidth=crest?5:10;p.strokeRect(18,18,476,476);p.strokeStyle='#b19159';p.lineWidth=3;p.strokeRect(32,32,448,448);
   if(!crest){p.fillStyle=theme.ink;for(let n=0;n<22;n++){p.fillRect(46+n*20,43,9,9);p.fillRect(46+n*20,460,9,9);p.fillRect(43,46+n*20,9,9);p.fillRect(460,46+n*20,9,9);}}
   p.strokeStyle=theme.ink;p.lineWidth=4;p.beginPath();p.arc(256,256,102,0,Math.PI*2);p.stroke();p.strokeStyle='#b19159';p.lineWidth=2;p.beginPath();p.arc(256,256,111,0,Math.PI*2);p.stroke();
   p.save();p.translate(256,256);p.strokeStyle=theme.ink;p.fillStyle=theme.ink;p.lineWidth=6;p.lineCap='round';p.lineJoin='round';
   if(theme.motif==='laurel'||theme.motif==='shield'){
    for(const side of [-1,1])for(let n=0;n<10;n++){const a=-.75+n*.19;p.save();p.translate(side*Math.cos(a)*69,Math.sin(a)*79);p.rotate(side*(a+.65));p.beginPath();p.ellipse(0,0,5,13,0,0,Math.PI*2);p.fill();p.restore();}
    if(theme.motif==='shield'){p.beginPath();p.moveTo(-33,-43);p.lineTo(33,-43);p.lineTo(30,16);p.quadraticCurveTo(20,43,0,56);p.quadraticCurveTo(-20,43,-30,16);p.closePath();p.stroke();p.beginPath();p.moveTo(0,-25);p.lineTo(0,27);p.moveTo(-18,0);p.lineTo(18,0);p.stroke();}
    else{p.font='bold 33px Georgia';p.textAlign='center';p.fillText('SPQR',0,10);}
   }else if(theme.motif==='star'){
    for(let n=0;n<8;n++){p.save();p.rotate(n*Math.PI/4);p.beginPath();p.moveTo(0,-64);p.lineTo(10,-19);p.lineTo(0,0);p.lineTo(-10,-19);p.closePath();p.fill();p.restore();}
   }else if(theme.motif==='hammer'){
    p.save();p.rotate(-.7);p.fillRect(-7,-24,14,88);p.fillRect(-39,-51,78,30);p.restore();p.beginPath();p.moveTo(-55,39);p.lineTo(-27,55);p.lineTo(27,55);p.lineTo(48,39);p.stroke();
   }else{
    for(const side of [-1,1]){p.beginPath();p.moveTo(0,64);p.quadraticCurveTo(side*18,0,side*32,-66);p.stroke();for(let n=0;n<5;n++){p.save();p.translate(side*(6+n*5),37-n*20);p.rotate(side*.7);p.beginPath();p.ellipse(0,0,theme.motif==='wheat'?7:10,15,0,0,Math.PI*2);p.fill();p.restore();}}
   }
   p.restore();const tx=new T.CanvasTexture(c);tx.colorSpace=T.SRGBColorSpace;tx.anisotropy=2;const material=mat(0xffffff,{map:tx});bank.set(key,material);return material;
  }
  function build(kind,depth){
   const theme=themes[kind],root=new T.Group(),bounds=[],features=[];root.name=theme.name;const back=4.5-depth,center=4.5-depth/2,tone=mat(theme.tone),pale=mat(theme.pale);
   function put(geo,material,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){const o=new T.Mesh(geo,material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.set(rx,ry,rz);o.receiveShadow=true;root.add(o);return o;}
   const box=(material,x,y,z,w,h,d)=>put(g.box,material,x,y,z,w,h,d);
   const cyl=(material,x,y,z,r,h)=>put(g.cyl,material,x,y,z,r,h,r);
   function boundsAt(name,x,z,w,d){bounds.push({kind:'design-'+kind+'-'+name,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});}
   function leg(x,y,z,h=.9){box(m.wood,x,y,z,.12,h,.12);box(m.gold,x,.13,z,.14,.05,.14);}
   function bench(x,z,w=1.9,d=.6,h=.52,material=m.wood){box(material,x,h,z,w,.14,d);for(const a of [-1,1])for(const b of [-1,1])leg(x+a*(w/2-.15),h/2,z+b*(d/2-.10),h);}
   function jar(x,y,z,s=.65,dark=false){put(g.jar,dark?m.clayDark:m.clay,x,y,z,s,s,s);for(const side of [-1,1])put(g.ring,m.clayDark,x+side*.16*s,y+.76*s,z,.1*s,.14*s,.1*s);cyl(m.dark,x,y+.954*s,z,.085*s,.018);cyl(m.gold,x,y+.48*s,z,.25*s,.022);}
   function bowl(x,y,z,s=.7,material=m.clay){put(g.bowl,material,x,y,z,s,s,s);}
   function roll(x,y,z,s=.45,standing=false){put(g.cyl,m.paper,x,y,z,.052,s,.052,standing?0:Math.PI/2);put(g.cyl,m.red,x,y,z,.056,.035,.056,standing?0:Math.PI/2);}
   function shelf(x,z,w=2.1,h=2.65,levels=3){
    box(m.wood,x,h/2,z-.28,w,h,.07);for(const a of [-1,1])box(m.wood,x+a*w/2,h/2,z,.11,h,.65);
    for(let i=0;i<levels;i++){const y=.22+i*(h-.36)/levels;box(m.wood,x,y,z,w,.10,.67);box(m.gold,x,y+.025,z+.35,w,.025,.02);}
    box(m.wood,x,h,z,w+.14,.12,.74);box(m.gold,x,h+.067,z+.37,w+.12,.025,.02);
   }
   function plant(x,y,z,s=.75){jar(x,y,z,s,true);for(let i=0;i<7;i++){const a=i*2.4;const leaf=put(g.leaf,i%2?m.herb:m.olive,x+Math.sin(a)*s*.17,y+s*(1.0+i%3*.1),z+Math.cos(a)*s*.14,.055*s,.30*s,.09*s);leaf.rotation.set(Math.sin(a)*.6,a,Math.cos(a)*.6);}}
   function sconce(x,y,z){box(m.gold,x,y,z,.10,.4,.08);bowl(x,y+.13,z+.15,.6,m.gold);put(g.sphere,m.light,x,y+.36,z+.15,.045,.115,.045);}
   function column(x,z,h=3.8){box(pale,x,.14,z,.52,.28,.47);cyl(pale,x,h/2+.10,z,.17,h-.25);cyl(m.gold,x,.34,z,.182,.06);box(pale,x,h,z,.50,.20,.46);box(m.gold,x,h+.12,z,.50,.035,.46);}
   function wallWindow(side,z){
    const x=side*4.78;box(m.dark,x,3.1,z,.07,1.6,1.34);box(m.light,x-side*.045,3.1,z,.02,1.43,1.16);
    for(const yy of [2.25,3.95])box(pale,x-side*.07,yy,z,.18,.13,1.55);
    for(const zz of [-.67,.67])box(pale,x-side*.07,3.1,z+zz,.18,1.64,.13);
    for(const zz of [-.34,0,.34])box(m.wood,x-side*.10,3.1,z+zz,.05,1.48,.035);box(m.wood,x-side*.10,3.1,z,.05,.045,1.28);
   }
   function crest(x,y,z,w=1.7){box(m.wood,x,y,z,w+.18,w+.18,.08);put(g.plane,canvasMat(kind,true),x,y,z+.047,w,w);}
   // Continuous plaster, a coloured dado, stone trim and ceiling beams unify each room.
   put(g.plane,canvasMat(kind),0,.002,center,9.72,depth-.30,1,-Math.PI/2);
   box(pale,0,2.65,back+.18,9.7,4.65,.05);box(tone,0,.72,back+.22,9.7,1.4,.05);
   box(m.ivory,0,1.46,back+.27,9.7,.12,.11);box(m.gold,0,1.56,back+.29,9.7,.026,.025);
   for(const side of [-1,1]){box(pale,side*4.81,2.65,center,.05,4.65,depth-.3);box(tone,side*4.77,.72,center,.05,1.4,depth-.3);box(m.ivory,side*4.73,1.46,center,.10,.12,depth-.3);box(m.gold,side*4.70,1.56,center,.023,.026,depth-.3);box(pale,side*4.73,4.67,center,.22,.23,depth-.3);}
   box(pale,0,4.67,back+.32,9.68,.24,.26);box(m.gold,0,4.51,back+.37,9.6,.035,.08);
   for(let z=back+1.2;z<3.5;z+=2.7)box(kind==='clan'?pale:m.wood,0,4.79,z,9.6,.18,.20);
   for(const side of [-1,1])for(const z of [back+1.05,2.9]){box(pale,side*4.59,2.07,z,.28,4.14,.34);box(m.gold,side*4.56,1.72,z,.32,.045,.37);}
   features.push('mosaic','plaster','dado','cornice');
   if(kind==='office'){
    for(const x of [-1.55,1.55])column(x,back+.48,3.95);put(g.pediment,pale,0,4.13,back+.29,3.8,1.1,1);crest(0,3.05,back+.31,1.58);
    shelf(-3.33,back+.68,2.1,2.72,3);boundsAt('archive',-3.33,back+.68,2.3,.85);
    for(let row=0;row<3;row++)for(let i=0;i<7;i++)roll(-4.10+i*.245,.39+row*.786,back+.78,.43);
    for(const x of [-1.08,1.08])sconce(x,2.13,back+.43);
    // Curule-style chair stays behind the existing imported mission desk.
    bench(0,-2.88,1.07,.64,.56);box(m.red,0,.66,-2.88,.95,.10,.58);box(m.wood,0,1.14,-3.14,1.08,1.0,.10);box(m.red,0,1.17,-3.075,.87,.72,.02);for(const x of [-.51,.51])cyl(m.gold,x,1.73,-3.14,.055,.07);boundsAt('chair',0,-2.91,1.1,.73);
    bench(-3.75,.36,1.1,1.60,.56);box(m.red,-3.75,.67,.36,.93,.06,1.41);boundsAt('visitor-seat',-3.75,.36,1.16,1.66);
    plant(3.92,.02,1.9,.92);boundsAt('planter',3.92,1.9,.62,.62);wallWindow(-1,-.8);wallWindow(1,.1);
    features.push('archive-scrolls','curule-chair','laurel-relief','visitor-seat','retained-mission-desk');
   }else if(kind==='clan'){
    for(const x of [-4.38,-1.53,1.53,4.38])column(x,back+.42,4.02);
    for(const x of [-2.87,2.87]){box(tone,x,2.19,back+.26,2.27,3.70,.07);for(const xx of [-1.12,1.12])box(m.gold,x+xx,2.18,back+.32,.028,3.70,.03);box(m.gold,x,4.08,back+.33,2.24,.04,.04);}
    for(const side of [-1,1]){const x=side*4.13;bench(x,.10,.65,3.50,.51);box(tone,x,.62,.10,.61,.08,3.36);box(pale,side*4.52,.92,.10,.12,.87,3.6);boundsAt('bench',x,.10,.70,3.55);wallWindow(side,.35);}
    for(const x of [-1.10,1.10])sconce(x,3.22,back+.36);
    // The centre is deliberately reserved for the player's banner and imported vault.
    box(pale,0,.07,-2.50,2.35,.14,1.65);box(m.gold,0,.145,-1.67,2.34,.016,.04);
    features.push('trophy-alcoves','ceremonial-benches','vault-plinth','retained-player-banner');
   }else if(kind==='rest'){
    // Beds remain padded brown floor mattresses, with a clear central aisle.
    for(const side of [-1,1]){wallWindow(side,center-.9);for(const z of [back+1.85,2.25]){box(m.wood,side*4.55,2.25,z,.34,.10,1.05);for(let i=0;i<3;i++)box(i%2?m.linen:tone,side*4.56,2.36+i*.10,z,.29,.09,.78);}}
    for(const x of [-2.75,2.75]){box(m.wood,x,.42,back+.64,1.65,.76,.52);box(m.linen,x,.83,back+.64,1.67,.10,.56);for(const dx of [-.53,.53])box(m.gold,x+dx,.40,back+.91,.05,.69,.025);boundsAt('linen-store',x,back+.64,1.70,.60);}
    for(const side of [-1,1]){box(tone,side*4.65,3.12,center-.08,.06,1.45,.36);box(m.gold,side*4.60,2.59,center-.08,.06,.04,.39);}
    features.push('linen-storage','quiet-window-niches','retained-floor-mattresses','open-central-aisle');
   }else if(kind==='upgrades'){
    // Left: basic production. Centre: existing enhancement hammer. Right: stone vault.
    box(m.stone,-2.95,.68,back+.88,2.08,1.36,1.40);box(m.coal,-2.95,1.40,back+.88,1.55,.12,1.08);
    for(const x of [-3.91,-1.99])box(pale,x,2.28,back+.83,.22,1.92,1.47);box(m.stone,-2.95,3.29,back+.89,2.22,.32,1.55);box(m.dark,-2.95,2.31,back+.30,1.70,1.80,.04);box(m.stone,-2.95,4.10,back+.68,1.04,1.35,.80);
    for(let i=0;i<7;i++)put(g.sphere,i%3?m.coal:m.ember,-3.55+i*.19,1.50,back+.96+(i%2)*.22,.16,.08,.14);
    boundsAt('hearth',-2.95,back+.88,2.25,1.6);
    cyl(m.wood,-2.8,.41,-.65,.45,.82);for(const y of [.12,.69])cyl(m.iron,-2.8,y,-.65,.456,.06);box(m.iron,-2.8,.90,-.65,.70,.16,.46);box(m.iron,-2.8,1.05,-.65,.38,.21,.30);box(m.iron,-2.8,1.21,-.65,.91,.17,.41);put(g.cone,m.iron,-2.18,1.20,-.65,.19,.49,.19,0,0,-Math.PI/2);boundsAt('anvil',-2.65,-.65,1.35,.98);
    bench(0,0,1.92,1.06,.98);box(m.linen,.38,1.06,.06,.68,.013,.68);box(m.gold,.49,1.082,.06,.11,.025,.36);boundsAt('enhancement-bench',0,0,1.97,1.1);
    shelf(2.99,back+.63,2.25,2.75,3);boundsAt('materials-rack',2.99,back+.63,2.43,.83);
    for(let i=0;i<5;i++){box(m.iron,2.18+i*.37,.40,back+.65,.30,.15,.32);box(m.gold,2.18+i*.37,.54,back+.65,.25,.12,.28);roll(2.16+i*.39,1.33,back+.65,.45);box(i%2?m.red:m.linen,2.18+i*.38,2.15,back+.65,.30,.30,.43);}
    box(m.wood,.10,2.55,back+.26,2.37,1.66,.07);for(let i=0;i<5;i++){const x=-.77+i*.43;box(m.iron,x,2.52,back+.36,.055,.94,.06);box(i%2?m.gold:m.iron,x,2.94,back+.38,.26,.13,.14);}crest(.10,3.88,back+.28,.73);
    bowl(3.95,.69,1.38,1.4,m.iron);cyl(m.stone,3.95,.34,1.38,.25,.65);cyl(m.water,3.95,.91,1.38,.28,.015);boundsAt('quench-basin',3.95,1.38,.80,.80);wallWindow(1,-.7);
    features.push('coal-hearth','basic-production-anvil','enhancement-workbench','tool-board','materials-rack','retained-stone-vault');
   }else if(kind==='infirmary'){
    for(const side of [-1,1]){
     const x=side*2.54,z=-.48;bench(x,z,1.5,2.40,.48);box(m.linen,x,.66,z,1.45,.26,2.34);box(m.ivory,x,.85,z-.79,1.02,.19,.48);box(tone,x,.81,z+.36,1.45,.035,1.15);for(const dx of [-.53,.53])box(m.gold,x+dx,.835,z+.38,.035,.015,1.09);boundsAt('treatment-couch',x,z,1.56,2.48);
     box(pale,x,.52,-2.70,.64,1.04,.61);box(m.ivory,x,1.09,-2.70,.73,.10,.68);bowl(x,1.16,-2.70,.65,m.gold);boundsAt('bedside',x,-2.70,.74,.69);wallWindow(side,-.72);
    }
    shelf(-3.30,back+.63,2.05,2.52,3);boundsAt('herbs',-3.30,back+.63,2.18,.83);
    for(let i=0;i<5;i++){jar(-4.05+i*.36,.28,back+.66,.43,i%2===0);jar(-4.05+i*.36,1.0,back+.66,.40,true);for(let j=0;j<2;j++)box(m.ivory,-3.99+i*.35,1.80+j*.12,back+.65,.27,.11,.45);}
    shelf(3.29,back+.63,2.04,2.52,3);boundsAt('linens',3.29,back+.63,2.18,.83);
    for(let i=0;i<3;i++){plant(2.58+i*.64,1.05,back+.62,.48);for(let j=0;j<3;j++)box(j%2?m.linen:m.ivory,2.59+i*.66,.32+j*.14,back+.62,.54,.12,.51);roll(2.63+i*.64,1.94,back+.66,.43);}
    bench(0,back+1.0,1.76,.69,.84);bowl(-.47,.93,back+1.0,.68,m.stone);put(g.cyl,m.stone,-.45,1.13,back+1.0,.045,.34,.045,0,0,.40);box(m.linen,.30,.93,back+1.0,.76,.012,.46);for(let i=0;i<3;i++)box(m.gold,.10+i*.17,.949,back+1.0,.026,.015,.34);boundsAt('medicine-table',0,back+1.0,1.81,.76);
    crest(0,3.08,back+.29,1.54);for(const x of [-1.31,1.31])sconce(x,2.6,back+.32);plant(-4.06,.02,2.18,.84);boundsAt('herb-pot',-4.06,2.18,.6,.6);
    features.push('linen-treatment-couches','herbal-jars','bandage-shelves','mortar-and-instruments','wash-basins');
   }else if(kind==='dining'){
    // Frame the existing imported cauldron, preparation bench, tables and food racks.
    box(m.dark,-3.55,1.49,back+.24,1.98,2.18,.06);for(const x of [-4.55,-2.55])box(pale,x,1.65,back+.43,.20,2.84,.40);box(pale,-3.55,3.12,back+.45,2.18,.24,.52);box(m.stone,-3.55,3.80,back+.32,1.15,1.18,.31);
    for(let i=0;i<4;i++)put(g.sphere,i%2?m.coal:m.ember,-3.88+i*.22,.08,-2.91,.13,.06,.13);
    box(m.wood,-1.05,2.80,back+.39,2.0,.12,.57);for(let i=0;i<4;i++){bowl(-1.76+i*.46,2.87,back+.4,.65,i%2?m.clayDark:m.clay);jar(-1.76+i*.46,3.04,back+.4,.27,i%2===0);}
    for(let i=0;i<5;i++){const x=-1.89+i*.36;box(m.wood,x,2.37,back+.40,.025,.40,.035);put(g.leaf,m.herb,x,2.13,back+.41,.09,.18,.07);}
    wallWindow(-1,.55);wallWindow(1,.85);crest(.04,3.75,back+.29,.82);
    for(const x of [-4.12,4.12]){jar(x,.02,3.01,.88,true);boundsAt('amphora',x,3.01,.60,.60);}
    for(const side of [-1,1])for(const z of [-1.16,2.88]){box(pale,side*4.73,2.15,z,.18,.12,.55);bowl(side*4.67,2.22,z,.45,m.gold);}
    features.push('cauldron-hearth','hanging-herbs','ceramics-ledge','wine-amphorae','retained-dining-models');
   }
   // Draw repeated furniture in one call per material/geometry, and reuse it on every entry.
   const batches=new Map();root.updateMatrixWorld(true);
   for(const o of root.children){const key=o.geometry.uuid+':'+o.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(o);}
   for(const list of batches.values())if(list.length>1){const inst=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);inst.name=theme.name+' · static details';inst.receiveShadow=true;for(let i=0;i<list.length;i++){inst.setMatrixAt(i,list[i].matrix);root.remove(list[i]);}inst.instanceMatrix.needsUpdate=true;inst.computeBoundingSphere();root.add(inst);}
   root.userData={kind,depth,features,colliderCount:bounds.length};return {root,bounds,localMaterials:[tone,pale]};
  }
  function detach(){current?.root.removeFromParent();current=null;for(let i=colliders.length-1;i>=0;i--)if(colliders[i].kind?.startsWith('design-'))colliders.splice(i,1);}
  function enter(kind,depth=9){
   detach();if(!themes[kind])return null;depth=kind==='rest'?Math.max(9,Number(depth)||9):9;const key=kind+':'+depth;
   if(!cache.has(key)){
    // A roster resize replaces only the previous rest instance; shared textures are retained.
    if(kind==='rest')for(const [old,value]of cache)if(old.startsWith('rest:')){value.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();});value.localMaterials.forEach(v=>v.dispose());cache.delete(old);}
    cache.set(key,build(kind,depth));
   }
   current=cache.get(key);props.add(current.root);colliders.push(...current.bounds.map(b=>({...b})));return current.root;
  }
  function resize(depth){if(current?.root.userData.kind==='rest'&&current.root.userData.depth!==depth)enter('rest',depth);}
  return {enter,leave:detach,resize,get root(){return current?.root||null;},get cachedRooms(){return cache.size;}};
 }
 return {create,themes};
})();
