const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const N=require('../naval-simulation-v97.js');
function fixture(){
 const html=fs.readFileSync(path.join(__dirname,'../arena.html'),'utf8'),start=html.indexOf('var ArenaClasses='),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",endMarker="})(typeof window!=='undefined'?window:globalThis);",end=html.indexOf(endMarker,html.indexOf(marker,start))+endMarker.length;
 const context=vm.createContext({console});vm.runInContext(html.slice(start,end),context);
 vm.runInContext(html.slice(html.indexOf('var LudusLoadout='),html.indexOf('// Per-owner, per-battle outbox.')),context);
 let seed=97;const combat=new context.ArenaCombat(()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}).reset('normal','secutor','4x5');
 const naval=N.install(combat);return{combat,naval,p:combat.fighters[0],context};
}
function moored(){const f=fixture();Object.assign(f.naval.ships[0],{x:0,z:0,angle:0,speed:0,turn:0});Object.assign(f.naval.ships[1],{x:8,z:0,angle:0,speed:0,turn:0});Object.assign(f.naval.ships[2],{x:-20,z:0});Object.assign(f.naval.ships[3],{x:20,z:18});for(const a of f.combat.fighters){const q=N.world(f.naval.ships[a.shipId],a.id%2?1:-1,a.id%5-2);Object.assign(a,q);}Object.assign(f.p,{x:2.1,z:0});return f;}

module.exports={fixture,moored};
