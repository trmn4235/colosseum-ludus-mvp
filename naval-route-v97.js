/* A visual variant of the existing server-owned 4x5 ticket, not a new reward mode. */
var NavalRoute=(()=>{
  const prefix='ludus-naval-v97:';
  function remember(id){try{localStorage.setItem(prefix+id,'1');}catch{}}
  function saved(id){try{return localStorage.getItem(prefix+id)==='1';}catch{return false;}}
  function requested(){const q=new URL(location.href).searchParams;return q.get('arena')==='naval'||saved(q.get('battle'));}
  function url(id,naval=saved(id)){return 'arena.html?v=revision101&battle='+encodeURIComponent(id)+(naval?'&arena=naval':'');}
  return {remember,saved,requested,url};
})();
