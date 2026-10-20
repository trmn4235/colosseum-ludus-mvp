/* One coat definition drives saved records, portraits and the existing horse rig. */
var LudusHorseAppearance = (() => {
 'use strict';
 const coats = [
  {id:'white',name:'Beyaz',color:'#eae6df'},
  {id:'grey',name:'Gri',color:'#949a9f'},
  {id:'light_brown',name:'Açık kahve',color:'#bd8050'},
  {id:'dark_brown',name:'Koyu kahve',color:'#513025'},
  {id:'black',name:'Siyah',color:'#202126'},
  {id:'pinto',name:'Açık kahve · Beyaz detaylı',color:'#bc8254'},
  {id:'caramel',name:'Karamel',color:'#945b32'}
 ];
 const coat = horse => coats.find(c=>c.id===(typeof horse==='string'?horse:horse?.coat)) || coats[3];
 const photo = horse => 'assets/stable-v130/'+coat(horse).id+'.webp';
 function material(T,original,id){
  const spec=coat(id),m=original.clone();m.name='Ahır · '+spec.name;m.roughness=.85;
  m.userData.coat=spec.id;
  // Keep the licensed normal/roughness maps, dark eyes, hooves and metal fittings.
  // The pigment is changed in the material; no seven copies of the GLB are downloaded.
  m.onBeforeCompile=shader=>{
   shader.uniforms.stableCoat={value:new T.Color(spec.color)};
   shader.uniforms.stablePinto={value:spec.id==='pinto'?1:0};
   shader.uniforms.stablePaleMane={value:spec.id==='white'?1:0};
   shader.vertexShader='varying vec3 stableRest;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstableRest = position;');
   shader.fragmentShader='uniform vec3 stableCoat;\nuniform float stablePinto;\nuniform float stablePaleMane;\nvarying vec3 stableRest;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    vec3 sourceCoat=diffuseColor.rgb;
    float warmPigment=smoothstep(.003,.025,sourceCoat.r-sourceCoat.b);
    float lightness=dot(sourceCoat,vec3(.2126,.7152,.0722));
    float detail=clamp(sqrt(max(lightness,.001)) * 2.2,.45,1.12);
    float fur=warmPigment * smoothstep(.003,.018,lightness);
    float paleLegs=stablePaleMane*smoothstep(.17,.27,stableRest.y)*(1.0-smoothstep(.65,.85,stableRest.y));
    fur=max(fur,paleLegs);
    vec3 pigment=stableCoat;
    float patchField=sin(stableRest.z*5.8 + sin(stableRest.y*3.1))*cos(stableRest.y*4.5 + stableRest.x*4.0);
    float patches=smoothstep(.04,.17,patchField);
    float socks=1.0-smoothstep(.32,.48,stableRest.y);
    float blaze=(1.0-smoothstep(.025,.085,abs(stableRest.x)))*smoothstep(1.25,1.6,stableRest.y);
    pigment=mix(pigment,vec3(.88,.86,.81),stablePinto*max(patches,max(socks,blaze)));
    diffuseColor.rgb=mix(sourceCoat,pigment*detail,fur);
    float maneZone=max(smoothstep(1.5,1.8,stableRest.y)*(1.0-smoothstep(.08,.17,abs(stableRest.x))),(1.0-smoothstep(-.8,-.6,stableRest.z))*smoothstep(.3,.55,stableRest.y));
    float mane=stablePaleMane*(1.0-smoothstep(.012,.038,lightness))*maneZone;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.55,.52,.46)*detail,mane*.85);
   `);
  };
  m.customProgramCacheKey=()=> 'stable-coat-v130-'+spec.id;
  return m;
 }
 return {coats,coat,photo,material};
})();
if(typeof module!=='undefined')module.exports=LudusHorseAppearance;
