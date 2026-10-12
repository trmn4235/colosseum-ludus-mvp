
// Tab-local return frames. State is restored only for its authenticated owner.
var LudusNavigation=(function(){
 const prefix='ludus-return-v12:',pages=new Set(['ludus.html','gelistirmeler.html','savas.html','pazar.html','arena.html','gorevler.html','ludus-seviye.html','klan.html','multiplayer.html']);
 let owner=null,readState=()=>null;
 const here=()=>new URL(window.location.href),file=url=>url.pathname.split('/').pop();
 function local(value){try{const url=new URL(value,here()),base=here();return url.origin===base.origin&&url.pathname.slice(0,url.pathname.lastIndexOf('/')+1)===base.pathname.slice(0,base.pathname.lastIndexOf('/')+1)&&pages.has(file(url))?url:null;}catch{return null;}}
 function read(id){if(!/^[a-z0-9-]{8,80}$/i.test(id||''))return null;try{const r=JSON.parse(sessionStorage.getItem(prefix+id));return owner&&r?.owner===owner&&r.created>Date.now()-86400000&&local(r.url)?r:null;}catch{return null;}}
 function go(target){const url=local(target);if(!url)return;url.searchParams.set('v','revision84');url.searchParams.delete('restore');url.searchParams.delete('nav');
  try{if(owner){const current=here();for(const k of ['restore','choose','recovered'])current.searchParams.delete(k);const id=crypto.randomUUID(),record={owner,url:current.href,state:readState(),created:Date.now()};
   sessionStorage.setItem(prefix+id,JSON.stringify(record));url.searchParams.set('nav',id);
   const saved=[];for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);if(k?.startsWith(prefix)){try{const r=JSON.parse(sessionStorage.getItem(k));saved.push({key:k,created:r.created||0});}catch{saved.push({key:k,created:0});}}}
   saved.sort((a,b)=>b.created-a.created);for(const r of saved.slice(40))sessionStorage.removeItem(r.key);
  }}catch{}
  window.location.href=url.href;
 }
 function back(fallback='ludus.html',params={}){const id=here().searchParams.get('nav'),record=read(id),url=(record&&local(record.url))||local(fallback)||local('ludus.html');if(record)url.searchParams.set('restore',id);url.searchParams.set('v','revision84');for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);window.location.href=url.href;}
 function restore(){const record=read(here().searchParams.get('restore'));return record&&file(new URL(record.url))===file(here())?record.state:null;}
 document.addEventListener('click',event=>{if(event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const a=event.target.closest?.('a[href]');if(!a||a.target==='_blank'||a.hasAttribute('download'))return;const url=local(a.href);if(!url)return;
  if(a.hasAttribute('data-game-back')){event.preventDefault();back(a.href);}
  else if(url.pathname!==here().pathname){event.preventDefault();go(url.href);}
 });
 return {go,back,restore,setOwner:id=>{owner=typeof id==='string'?id:null;},register:fn=>{readState=fn;}};
})();
