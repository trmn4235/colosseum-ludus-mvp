/* Observe assists without changing combat, timing, damage or random draws. */
(()=>{
 const P=globalThis.ArenaCombat?.prototype;if(!P||P._rankTelemetry200)return;P._rankTelemetry200=true;
 const state=new WeakMap();
 const reset=P.reset;if(reset)P.reset=function(...args){state.delete(this);const result=reset.apply(this,args);for(const f of this.fighters||[])delete f.rankAssists200;return result;};
 function observe(c,a,v,amount,before){
  if(amount<=0||!a||!v||a.team===v.team)return;
  let game=state.get(c);if(!game){game=new Map();state.set(c,game);}
  let victims=game.get(v);if(!victims){victims=new Map();game.set(v,victims);}
  victims.set(a,(victims.get(a)||0)+amount);
  if(before>0&&v.hp<=0){for(const [helper,damage]of victims){if(helper!==a&&helper.team===a.team&&damage>=Math.max(1,(v.maxHp||100)*.1))helper.rankAssists200=(helper.rankAssists200||0)+1;}game.delete(v);}
 }
 for(const name of ['damage','damageProjectileV10']){
  const fn=P[name];if(typeof fn!=='function')continue;
  P[name]=function(a,v,...args){
   const outer=!this._rankObserving200,before=v?.hp;this._rankObserving200=(this._rankObserving200||0)+1;
   try{return fn.call(this,a,v,...args);}finally{this._rankObserving200--;if(outer&&v)observe(this,a,v,Math.max(0,before-Math.max(0,v.hp)),before);}
  };
 }
 globalThis.LudusRankTelemetry={assists:c=>c.fighters[0]?.rankAssists200||0};
})();
