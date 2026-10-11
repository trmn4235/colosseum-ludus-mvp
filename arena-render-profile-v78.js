/* A lighter default on touch devices; explicit Detailed keeps the full profile. */
var ArenaRenderProfile={
 resolve(mode='auto',pixelRatio=1,touch=false){
  const detailed=mode==='high'||mode==='auto'&&!touch,shadows=mode!=='low';
  return {dpr:Math.min(Math.max(1,Number(pixelRatio)||1),detailed?1.6:shadows?1.25:1),shadowSize:detailed?1536:1024,shadows,label:mode==='auto'&&touch?'Dengeli':shadows?'Detaylı':'Akıcı'};
 }
};
if(typeof module!=='undefined')module.exports=ArenaRenderProfile;
