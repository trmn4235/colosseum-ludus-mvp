/* Smooth offline fit against the actual game body's arm profile. No extra runtime work. */
import fs from 'node:fs';import crypto from 'node:crypto';import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {quantize} from '@gltf-transform/functions';import {BufferGeometry,BufferAttribute,Vector3,Quaternion} from 'three';
const root=process.cwd(),io=new NodeIO().registerExtensions(ALL_EXTENSIONS),profiles=JSON.parse(fs.readFileSync(process.argv[2]||'/tmp/arm-fit-v197.json')),report=JSON.parse(fs.readFileSync('assets/equipment-v196/build-report.json'));
const key=Buffer.from([208,72,199,66,217,77,28,174,206,97,233,116,84,211,101,150,96,56,75,205,232,216,123,120,80,21,163,4,179,62,121,210]),header=Buffer.from([67,77,69,49,54,55,0,1]);
function radius(part,y,a){const p=profiles[part],f=Math.max(0,Math.min(23.999,(y-p.minY)/p.step)),row=Math.floor(f),t=f-row,c=((a/(2*Math.PI)*48)%48+48)%48,i=Math.floor(c),u=c-i;const r=j=>p.radii[j][i]*(1-u)+p.radii[j][(i+1)%48]*u;return r(row)*(1-t)+r(row+1)*t;}
fs.mkdirSync('assets/equipment-v197',{recursive:true});
for(const item of report.items){const b=fs.readFileSync('assets/equipment-v196/'+item.file),d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(8,20));d.setAAD(header);d.setAuthTag(b.subarray(-16));const doc=await io.readBinary(Buffer.concat([d.update(b.subarray(20,-16)),d.final()]));
 for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()||[]){const part=node.getName(),pos=primitive.getAttribute('POSITION'),values=Array.from(pos.getArray());
  if(item.id==='trident_gladiator'){
   // Fit the wooden shaft's centerline, rather than the asymmetric fork head.
   const rings=[];for(let low=-.05;low<.85;low+=.10){const points=[];for(let i=0;i<values.length;i+=3)if(values[i+1]>=low&&values[i+1]<low+.10)points.push(values.slice(i,i+3));if(points.length>=6)rings.push([0,1,2].map(k=>(Math.min(...points.map(p=>p[k]))+Math.max(...points.map(p=>p[k])))/2));}
   const mean=k=>rings.reduce((sum,p)=>sum+p[k],0)/rings.length,my=mean(1),variance=rings.reduce((sum,p)=>sum+(p[1]-my)**2,0),line=k=>{const m=mean(k),slope=rings.reduce((sum,p)=>sum+(p[1]-my)*(p[k]-m),0)/variance;return[slope,m-slope*my];},[sx,cx]=line(0),[sz,cz]=line(2),q=new Quaternion().setFromUnitVectors(new Vector3(sx,1,sz).normalize(),new Vector3(0,1,0)),point=new Vector3();
   let minY=Infinity;for(let i=0;i<values.length;i+=3){point.set(values[i]-cx,values[i+1],values[i+2]-cz).applyQuaternion(q);values[i]=point.x*1.3;values[i+1]=point.y*1.2;values[i+2]=point.z*1.3;minY=Math.min(minY,values[i+1]);}
   // Pole IK holds at -0.16 m. Leave 29 cm of shaft behind the palm.
   for(let i=1;i<values.length;i+=3)values[i]+=-.45-minY;
   item.axisScale=[1.3,1.2,1.3];item.shaftAlignment={xSlope:sx,zSlope:sz,xCenter:cx,zCenter:cz,buttY:-.45};
  }else{if(!profiles[part])continue;
  const ys=values.filter((_,i)=>i%3===1),min=Math.min(...ys),max=Math.max(...ys),length=part==='fore'?.215:.225,rows=Array.from({length:25},()=>[]);
  for(let i=0;i<values.length;i+=3){const y=(values[i+1]-min)/(max-min)*length-length/2,r=Math.hypot(values[i],values[i+2]);rows[Math.max(0,Math.min(24,Math.round((y+.12)/.01)))].push(r);}
  const inner=rows.map((row,j)=>{const pool=rows.slice(Math.max(0,j-2),j+3).flat().sort((a,b)=>a-b);return pool[Math.floor(pool.length*.18)]||.06;});
  const angle=part==='upper'?0:-Math.PI/2,cs=Math.cos(angle),sn=Math.sin(angle);
  for(let i=0;i<values.length;i+=3){const x=values[i]*cs+values[i+2]*sn,z=-values[i]*sn+values[i+2]*cs,y=(values[i+1]-min)/(max-min)*length-length/2,a=Math.atan2(z,x),old=Math.hypot(x,z),j=Math.max(0,Math.min(23.999,(y+.12)/.01)),lo=Math.floor(j),base=inner[lo]*(1-(j-lo))+inner[lo+1]*(j-lo),relief=Math.max(0,Math.min(.018,(old-base)*.7)),r=radius(part,y,a)+.009+relief;values[i]=Math.cos(a)*r;values[i+1]=y;values[i+2]=Math.sin(a)*r;}
  }
  pos.setArray(new Float32Array(values));const geo=new BufferGeometry();geo.setAttribute('position',new BufferAttribute(new Float32Array(values),3));geo.setIndex(new BufferAttribute(primitive.getIndices().getArray(),1));geo.computeVertexNormals();primitive.getAttribute('NORMAL').setArray(geo.attributes.normal.array).setNormalized(false);
 }
 await doc.transform(quantize({pattern:/^NORMAL$/,quantizeNormal:12}));const raw=Buffer.from(await io.writeBinary(doc)),iv=crypto.createHash('sha256').update(raw).digest().subarray(0,12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(header);const packed=Buffer.concat([header,iv,cipher.update(raw),cipher.final(),cipher.getAuthTag()]);fs.writeFileSync('assets/equipment-v197/'+item.file,packed);item.bytes=packed.length;item.sha256=crypto.createHash('sha256').update(packed).digest('hex');item.fitVersion=197;console.log(item.id,item.triangles,packed.length);
}report.version=197;fs.writeFileSync('assets/equipment-v197/build-report.json',JSON.stringify(report,null,2)+'\n');
