/* Shared, low-poly fittings for the licensed Herculaneum hull. */
(function(root){
  'use strict';
  const teams=[
    {name:'BORDO',cloth:'#641c30',ink:'#e7bd68',hud:'#f3a9b5',mark:'eagle'},
    {name:'BEYAZ',cloth:'#e7dfc7',ink:'#243d55',hud:'#fff3d5',mark:'trident'},
    {name:'SİYAH',cloth:'#202329',ink:'#e4d7b6',hud:'#cec8bb',mark:'sun'},
    {name:'YEŞİL',cloth:'#244c3d',ink:'#d4b874',hud:'#9ed1af',mark:'laurel'}
  ];
  function sailTexture(T,team){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
    const c=canvas.getContext('2d');c.fillStyle=team.cloth;c.fillRect(0,0,512,512);
    // Woven canvas and stitched panels, generated once per team.
    c.strokeStyle='#ffffff0b';c.lineWidth=1;
    for(let i=0;i<512;i+=4){c.beginPath();c.moveTo(i,0);c.lineTo(i,512);c.moveTo(0,i);c.lineTo(512,i);c.stroke();}
    c.strokeStyle='#00000025';c.lineWidth=2;
    for(let x=64;x<512;x+=64){c.beginPath();c.moveTo(x,0);c.lineTo(x,512);c.stroke();}
    c.strokeStyle=team.ink;c.fillStyle=team.ink;c.lineWidth=4;c.strokeRect(22,22,468,468);c.lineWidth=1;c.strokeRect(31,31,450,450);
    c.save();c.translate(256,258);c.lineCap='round';c.lineJoin='round';
    function path(points,fill=true){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(fill){c.closePath();c.fill();}else c.stroke();}
    // Laurel frames keep all four insignia in the same Roman visual language.
    for(const side of [-1,1]){
      c.lineWidth=4;c.beginPath();c.moveTo(side*18,142);c.bezierCurveTo(side*142,105,side*170,-20,side*105,-112);c.stroke();
      for(let i=0;i<10;i++){const a=-.86+i*.185,x=side*(122*Math.cos(a)),y=122*Math.sin(a);c.save();c.translate(x,y);c.rotate(side*(a+.4));c.beginPath();c.ellipse(0,0,8,20,0,0,Math.PI*2);c.fill();c.restore();}
    }
    if(team.mark==='eagle'){
      path([[-17,-49],[-72,-85],[-105,-75],[-72,-48],[-104,-50],[-62,-19],[-97,-22],[-50,5],[-80,5],[-29,33],[-16,11],[-19,65],[0,48],[19,65],[16,11],[29,33],[80,5],[50,5],[97,-22],[62,-19],[104,-50],[72,-48],[105,-75],[72,-85],[17,-49],[14,-75],[34,-75],[21,-89],[-2,-90],[-14,-73]]);
      c.lineWidth=6;path([[-12,49],[-22,76],[-42,76]],false);path([[12,49],[22,76],[42,76]],false);
    }else if(team.mark==='trident'){
      c.lineWidth=12;path([[0,90],[0,-94]],false);path([[-65,-72],[-65,-12],[0,15],[65,-12],[65,-72]],false);
      for(const x of [-65,0,65])path([[x-15,-66-(x===0?28:0)],[x,-97-(x===0?28:0)],[x+15,-66-(x===0?28:0)]]);
      c.lineWidth=5;path([[-33,79],[33,79]],false);
    }else if(team.mark==='sun'){
      for(let i=0;i<12;i++){c.save();c.rotate(i*Math.PI/6);path([[-9,-65],[0,-105],[9,-65]]);c.restore();}
      c.beginPath();c.arc(0,0,50,0,Math.PI*2);c.fill();c.fillStyle=team.cloth;c.beginPath();c.arc(0,0,34,0,Math.PI*2);c.fill();c.fillStyle=team.ink;
      path([[10,-28],[-23,9],[-3,9],[-11,33],[25,-8],[5,-8]]);
    }else{
      path([[-45,-83],[8,-83],[-19,-20],[46,-20],[-25,94],[-6,22],[-49,22]]);
      c.lineWidth=5;c.beginPath();c.arc(0,0,92,-.3,Math.PI+.3);c.stroke();
    }
    c.restore();const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=2;return texture;
  }
  function create(T,source,materials){
    const group=new T.Group(),wood=materials.wood.clone(),dark=materials.dark,bronze=materials.bronze;
    wood.color.setHex(0x886548);wood.roughness=.94;
    const rope=new T.MeshStandardMaterial({color:0x958366,roughness:1});
    const steel=new T.MeshStandardMaterial({color:0x92978e,roughness:.5,metalness:.65});
    function merge(parts,material,name){
      const mesh=new T.Mesh(root.ArenaGeometryUtils.mergeGeometries(parts.map(g=>g.index?g.toNonIndexed():g),false),material);
      parts.forEach(g=>g.dispose());mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
    }
    function rod(a,b,r=.025,sides=5){const aa=new T.Vector3(...a),bb=new T.Vector3(...b),v=bb.clone().sub(aa),g=new T.CylinderGeometry(r,r,v.length(),sides);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.translate(...aa.add(bb).multiplyScalar(.5).toArray());return g;}
    // A continuous curved sheer and raised strakes give the widened boat depth.
    // The midship opening remains flush with both boarding bridges.
    const stations=[[-7.55,.36],[-6.9,1.46],[-6.2,2.26],[-5.4,2.70],[-4.4,2.98],[-3.2,3.14],[-2,3.28],[-1.1,3.33],[0,3.34],[1.1,3.31],[2.2,3.22],[3.4,3.12],[4.6,2.91],[5.6,2.62],[6.4,2.03],[7.1,1.21],[7.7,.22]];
    function width(z){for(let i=1;i<stations.length;i++)if(z<=stations[i][0]){const a=stations[i-1],b=stations[i],u=(z-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*u;}return .22;}
    function sheer(z){const end=Math.pow(Math.abs(z)/7.7,3);return .58+end*.66;}
    const planks=[],rails=[],bands=[];
    for(const side of [-1,1])for(const interval of [[-7.5,-1.16],[1.16,7.65]]){
      const count=16,vertices=[],uv=[],indices=[];
      for(let band=0;band<4;band++){
        const first=vertices.length/3;
        for(let i=0;i<=count;i++){const z=interval[0]+(interval[1]-interval[0])*i/count,w=width(z),top=sheer(z);
          for(const edge of [0,1]){const t=(band+edge)/4,y=-.58+(top+.58)*t+(edge?-.012:.012),x=side*(w-.12+Math.sin(t*Math.PI)*.12);vertices.push(x,y,z);uv.push(z*.23,t*.8);}
        }
        for(let i=0;i<count;i++){const a=first+i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
      }
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();planks.push(geo);
      for(let i=0;i<count;i++){
        const z=interval[0]+(interval[1]-interval[0])*i/count,next=interval[0]+(interval[1]-interval[0])*(i+1)/count;
        rails.push(rod([side*(width(z)-.1),sheer(z),z],[side*(width(next)-.1),sheer(next),next],.085,4));
        bands.push(rod([side*width(z),.07+Math.pow(Math.abs(z)/7.7,3)*.35,z],[side*width(next),.07+Math.pow(Math.abs(next)/7.7,3)*.35,next],.036,3));
      }
      for(let z=interval[0]+.35;z<interval[1];z+=1.25)rails.push(rod([side*(width(z)-.18),-.25,z],[side*(width(z)-.18),sheer(z),z],.055,5));
    }
    wood.side=T.DoubleSide;merge(planks,wood,'Curved hull strakes');merge(rails,dark,'Raised gunwales and ribs');merge(bands,bronze,'Bronze rubbing strakes');
    // A high foot leaves the fighting deck visible below a fully opened sail.
    const mast=[rod([0,-.1,5.65],[0,7.65,5.65],.1,8),rod([-3.65,7.12,5.65],[3.65,7.12,5.65],.065,6)];merge(mast,dark,'Mast and yard');
    const rig=[];for(const side of [-1,1]){rig.push(rod([0,7.5,5.65],[side*2.65,.3,4.4],.018));rig.push(rod([side*3.5,7.1,5.65],[side*2.8,3.5,6],.015));}rig.push(rod([0,7.5,5.65],[0,1,7.8],.02));merge(rig,rope,'Standing rigging');
    const sg=new T.PlaneGeometry(7,3.65,14,10),pos=sg.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),u=(x+3.5)/7,v=(y+1.825)/3.65;pos.setXYZ(i,x*(.84+.16*v),y+5.28-.13*Math.sin(Math.PI*u)*(1-v),5.69+.72*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)+.06*Math.sin(u*34)*(1-v));}
    sg.computeVertexNormals();const sail=new T.Mesh(sg,new T.MeshStandardMaterial({roughness:.98,side:T.DoubleSide}));sail.name='Open sail';sail.castShadow=false;sail.receiveShadow=true;group.add(sail);
    const sailMaterials=teams.map(team=>new T.MeshStandardMaterial({map:sailTexture(T,team),roughness:.98,side:T.DoubleSide}));
    const rack=new T.Group();rack.name='Javelin rack';rack.position.set(root.NavalSimulation.constants.rackX,0,root.NavalSimulation.constants.rackZ);
    const rackWood=[new T.BoxGeometry(.12,1.05,.12).translate(-.42,.525,0),new T.BoxGeometry(.12,1.05,.12).translate(.42,.525,0),new T.BoxGeometry(1.02,.12,.25).translate(0,.32,0),new T.BoxGeometry(1.02,.12,.25).translate(0,.91,0),new T.BoxGeometry(1.16,.1,.55).translate(0,.05,0)];
    const rackMesh=merge(rackWood,dark,'Rack frame');group.remove(rackMesh);rack.add(rackMesh);
    const shaftGeo=new T.CylinderGeometry(.019,.025,1.72,6).translate(0,.35,0),headGeo=new T.ConeGeometry(.055,.28,4).translate(0,1.35,0),jav=new T.Group();jav.name='Deck javelin';jav.add(new T.Mesh(shaftGeo,wood),new T.Mesh(headGeo,steel));
    const rackShafts=new T.InstancedMesh(shaftGeo,wood,8),rackHeads=new T.InstancedMesh(headGeo,steel,8),dummy=new T.Object3D();rackShafts.name='Rack shafts';rackHeads.name='Rack heads';
    for(let i=0;i<8;i++){dummy.position.set(-.35+(i%4)*.23,.62,Math.floor(i/4)*.17-.09);dummy.rotation.x=-.1;dummy.updateMatrix();rackShafts.setMatrixAt(i,dummy.matrix);rackHeads.setMatrixAt(i,dummy.matrix);}
    rack.add(rackShafts,rackHeads);
    group.add(rack);
    return{group,sailMaterials,javelin:jav};
  }
  root.NavalOutfit={teams,create};
})(window);
