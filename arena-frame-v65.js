/* Render interpolation only. The 60 Hz combat state remains authoritative. */
(function(root){
 'use strict';
 const clamp=v=>Math.max(0,Math.min(1,v));
 class ArenaFrameState{
  constructor(){this.previous=new Map();this.views=new Map();}
  reset(){this.previous.clear();this.views.clear();}
  capture(fighters){for(const f of fighters){let p=this.previous.get(f.id);if(!p){p={};this.previous.set(f.id,p);}for(const key of ['x','z','angle','walk','timer','deadTime','action','hp'])p[key]=f[key];}}
  sample(f,alpha){
   let view=this.views.get(f.id);if(!view){view={};this.views.set(f.id,view);}Object.assign(view,f);
   const p=this.previous.get(f.id);if(!p)return view;alpha=clamp(Number.isFinite(alpha)?alpha:1);
   // Teleports/new lives and action boundaries must never blend stale attacks or falls.
   if((p.hp>0)!==(f.hp>0)||Math.hypot(f.x-p.x,f.z-p.z)>1)return view;
   view.x=p.x+(f.x-p.x)*alpha;view.z=p.z+(f.z-p.z)*alpha;
   view.angle=p.angle+Math.atan2(Math.sin(f.angle-p.angle),Math.cos(f.angle-p.angle))*alpha;
   if(p.action===f.action){for(const key of ['walk','timer','deadTime'])if(Number.isFinite(p[key])&&Number.isFinite(f[key])&&f[key]>=p[key])view[key]=p[key]+(f[key]-p[key])*alpha;}
   return view;
  }
 }
 root.ArenaFrameState=ArenaFrameState;
 if(typeof module!=='undefined')module.exports=ArenaFrameState;
})(typeof window!=='undefined'?window:globalThis);
