const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {rigRuntime}=require('./performance-v84.cjs'),{runGuardCases}=require('./character-guard-v214.cjs');
(async()=>{
 for(const page of ['arena.html','savas.html','multiplayer.html','caravan-field.html']){
  const c=await rigRuntime(page,page==='caravan-field.html'?{rigFile:'caravan-rig-v126.js'}:{}),reports=[];
  // These are dynamically loaded by caravan-battle, so they have no HTML script tags.
  if(page==='caravan-field.html')for(const file of ['arena-locomotion-data-v91.js','arena-locomotion-v91.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c);
  for(const type of Object.keys(c.ArenaClasses))reports.push({type,...runGuardCases(c,{rates:[30],directions:4,weapons:[c.ArenaClasses[type].weapon],classes:[type],classLoadout:true})});
  console.log(JSON.stringify({page,reports}));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
