const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'arena.html'),'utf8');
const ctx=vm.createContext({console});const start=source.indexOf('var ArenaClasses='),marker="if(typeof module!=='undefined')module.exports=install;else install(root.ArenaCombat,root.ArenaClasses);",end="})(typeof window!=='undefined'?window:globalThis);";vm.runInContext(source.slice(start,source.indexOf(end,source.indexOf(marker,start))+end.length),ctx);
for(const region of ['head','chest','rightArm','leftArm','rightLeg','leftLeg']){
 const sim=new ctx.ArenaCombat(()=>.999),a=sim.fighters[5],v=sim.fighters[0];Object.assign(a,{x:0,z:1,angle:Math.PI,attackRegion:region,action:'attack'});Object.assign(v,{x:0,z:0,angle:0,guardRegion:region});sim.prepareGuard(v,true);assert.equal(sim.guard(a,v),true,region+' guard');v.stamina=100;v.guardRegion=region==='head'?'chest':'head';sim.prepareGuard(v,true);assert.equal(sim.guard(a,v),false,region+' wrong guard');
 v.guardRegion=null;v.hp=100;sim.damage(a,v,10,region);assert.ok(Number.isFinite(v.body[region]));if(region==='leftLeg')assert.equal(v.body.rightLeg,100);if(region==='rightLeg')assert.equal(v.body.leftLeg,100);
}
require('node:child_process').execFileSync(process.execPath,['tests/login-settings-v44.cjs'],{cwd:root,env:{...process.env,CONTROLS_ONLY:'1'},stdio:'inherit'});
