/* Geographic anchors are documented in assets/rome-v148/SOURCES.md. */
var RomeDestinations=(()=>{
 const places=[
  {id:'pit',name:'Şan Avlusu',entry:'Küçük gladyatör arenası',description:'Şan · 4 kişi herkes tek · Bahis',photo:'assets/pit-v173/map.webp',target:'san-avlusu.html?travel=pit&v=revision175',lat:41.8917,lon:12.4892,tag:'ŞAN AVLUSU',preload:[]},
  {id:'colosseum',name:'Colosseum',entry:'Flavianus Amfitiyatrosu',description:'Singleplayer · Multiplayer · KlanWar',photo:'assets/rome-v148/colosseum.webp',target:'savas.html?choose=1&travel=colosseum&v=revision148',lat:41.889373,lon:12.492438,tag:'SAVAŞLAR',preload:['savas.html','arena-tabs-v82.css?v=revision89','assets/arena-entrance-v70.webp','assets/arena-modes-v69.webp']},
  {id:'palatine',name:'Circus Maximus',entry:'Palatine tarafından giriş',description:'Gişe · Kupon · Tribün · Yarışa katılım',photo:'assets/rome-v148/circus-palatine.webp',target:'circus-maximus.html?entrance=palatine&travel=palatine&v=revision148',lat:41.8870,lon:12.4863,tag:'PALATINE',preload:['circus-maximus.html','owner-three-r160.js?v=revision26','circus-maximus-model-v147.js?v=revision147','assets/circus-v146/chariot.glb']},
  {id:'aventine',name:'Circus Maximus',entry:'Aventine tarafından giriş',description:'Gişe · Kupon · Tribün · Yarışa katılım',photo:'assets/rome-v148/circus-aventine.webp',target:'circus-maximus.html?entrance=aventine&travel=aventine&v=revision148',lat:41.8852,lon:12.4840,tag:'AVENTINE',preload:['circus-maximus.html','owner-three-r160.js?v=revision26','circus-maximus-model-v147.js?v=revision147','assets/circus-v146/chariot.glb']}
 ];
 const bounds={west:12.474,east:12.498,north:41.8945,south:41.8800};
 const project=(lon,lat)=>({x:(lon-bounds.west)/(bounds.east-bounds.west)*1200,y:(bounds.north-lat)/(bounds.north-bounds.south)*980});
 return {places,find:id=>places.find(p=>p.id===id),bounds,project,ludus:{lat:41.890324,lon:12.495008},circus:{lat:41.8866506814,lon:12.4845086614}};
})();
if(typeof module!=='undefined')module.exports=RomeDestinations;
