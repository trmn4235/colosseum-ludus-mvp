/* Muted gray pictograms. Only a door with pending work turns gold. */
var LudusDoorIcons=(function(){
 const textures=new Map();
 const paths={
  exit:['M15 8V3H3v18h12v-5','M10 12h12m-5-5 5 5-5 5'],
  office:['M6 4h11v16H6z','M6 4H4v4h2M17 16h3v4h-3','M9 8h5M9 11h5M9 14h3'],
  clan:['M12 3 5 6v6c0 5 7 9 7 9s7-4 7-9V6z','M12 7v9M8 10h8'],
  rest:['M3 7v14M21 11v10M3 17h18M3 11h18v6','M6 8h4v3H6z'],
  upgrades:['M8 11h13l-3 4h-4v4h4v2H6v-2h4v-4H7l-4-4h5','M5 3l5 4-3 4-5-4zM9 8l4 4'],
  armory:['M4 3l7 6-3 3zM8 12l9 9M14 18l4-4','M20 3l-7 6 3 3zM16 12l-9 9M6 14l4 4'],
  infirmary:['M9 3h6v6h6v6h-6v6H9v-6H3V9h6z'],
  dining:['M3 3v6M6 3v6M9 3v6M3 8q3 5 6 0M6 12v9','M19 3q-4 3-4 10h4M19 3v18','M12 8a4 4 0 0 1 0 8'],
  store:['M3 7l9-4 9 4v12l-9 3-9-3zM3 7l9 4 9-4M12 11v11','M7 5l10 4v5'],
  arena:['M5 4l6 5-3 3zM8 12l9 9M14 18l4-4','M19 4l-6 5 3 3zM16 12l-9 9M6 14l4 4','M3 5Q0 14 5 20M21 5q3 9-2 15'],
  market:['M12 3v18M7 21h10M4 7h16','M6 7l-4 8h8zM18 7l-4 8h8z']
 };
 function texture(T,kind,attention=false){
  const key=kind+':'+attention;if(textures.has(key))return textures.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
  c.shadowColor='#0009';c.shadowBlur=5;c.shadowOffsetY=3;
  c.fillStyle='#282929c4';c.beginPath();c.arc(64,64,55,0,Math.PI*2);c.fill();c.shadowBlur=0;c.shadowOffsetY=0;
  c.strokeStyle=attention?'#d8af5c99':'#98988d66';c.lineWidth=2;c.stroke();
  c.translate(24,24);c.scale(80/24,80/24);c.strokeStyle=attention?'#e5bd62':'#aaa9a4';c.lineWidth=1.65;c.lineJoin=c.lineCap='round';
  for(const d of paths[kind]||paths.store)c.stroke(new Path2D(d));
  const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;textures.set(key,map);return map;
 }
 function create(T,kind,name,x,y,z,size=.36,angle=Math.PI){
  const map=texture(T,kind);
  const icon=new T.Mesh(new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({map,transparent:true,alphaTest:.02,depthWrite:false}));
  icon.position.set(x,y,z);icon.rotation.y=angle;icon.userData={kind,name,doorIcon:true};return icon;
 }
 function setAttention(T,icon,value){value=!!value;if(icon.userData.attention===value)return;icon.userData.attention=value;icon.material.map=texture(T,icon.userData.kind,value);}
 function svg(kind){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[kind]||paths.store).map(d=>'<path d="'+d+'"/>').join('')+'</svg>';}
 return{create,setAttention,svg};
})();
