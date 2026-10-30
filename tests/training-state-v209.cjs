/* Exercise the production refresh path, including slow first responses and recovery. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../ludus.html'),'utf8');
const state=source.match(/let trainingOffset=0[^\n]+/)[0];
const clock=source.match(/function trainingNow\(\)[^\n]+/)[0];
const functions=source.slice(source.indexOf('function applyTraining(data)'),source.indexOf('function syncDetailGear'));
assert(source.includes('\n refreshTrainingWhenDue();'),'frame loop must retry before the first successful load');
module.exports=(async()=>{
 let now=200000,calls=0,response={error:{message:'temporary network failure'}};
 const rows=Array.from({length:7},(_,i)=>({id:String(i),status:'available',session:null}));
 const sandbox={Date:{now:()=>now,parse:Date.parse},playerAccount:{user_id:'fixture'},roster:rows.map(record=>({record:{...record}})),
  exercisePanel:{render(){}},updateGladiatorHud(){},console:{warn(){}},accountClient:{rpc:async name=>{assert.equal(name,'ludus_training_state');calls++;return typeof response==='function'?await response():response;}}};
 vm.createContext(sandbox);
 vm.runInContext(state+'\n'+clock+'\n'+functions+`\nglobalThis.api={refreshTraining,refreshTrainingWhenDue,applyTraining,state:()=>({loaded:trainingLoaded,busy:trainingBusy,next:trainingNext,serverAt:trainingServerAt,now:trainingNow()})};`,sandbox);
 const api=sandbox.api;
 await api.refreshTraining();assert.equal(calls,1);assert.equal(api.state().loaded,false);
 now+=9999;await api.refreshTrainingWhenDue();assert.equal(calls,1,'failure backoff prevents a request per frame');
 now+=2;response={data:{server_now:new Date(now-5000).toISOString(),gladiators:rows}};
 await api.refreshTrainingWhenDue();assert.equal(calls,2);assert.equal(api.state().loaded,true,'slow first response is accepted');
 assert.equal(api.state().now,now-5000,'server clock is retained');
 require('../ludus-hud-v209.js');
 assert.equal(globalThis.LudusHudV209.rosterCounts(sandbox.roster,true,api.state().now).free,7,'all seven available');
 const accepted=api.state().serverAt;
 api.applyTraining({server_now:new Date(accepted-1000).toISOString(),gladiators:[{id:'0',status:'locked'}]});
 assert.equal(sandbox.roster[0].record.status,'available','out-of-order response cannot replace newer state');
 now+=60001;response={error:{message:'temporary failure'}};await api.refreshTrainingWhenDue();
 assert.equal(api.state().loaded,true,'temporary failure keeps the last confirmed state');
 now+=10001;response={data:{server_now:'invalid',gladiators:rows}};await api.refreshTrainingWhenDue();
 assert.equal(api.state().serverAt,accepted,'invalid payload cannot poison the clock');
 now+=10001;let finish;response=()=>new Promise(resolve=>{finish=resolve;});
 const pending=api.refreshTrainingWhenDue(),before=calls;await api.refreshTrainingWhenDue();assert.equal(calls,before,'only one request in flight');
 finish({data:{server_now:new Date(now).toISOString(),gladiators:rows.map((row,i)=>i?row:{...row,status:'locked'})}});await pending;
 assert.equal(globalThis.LudusHudV209.rosterCounts(sandbox.roster,true,api.state().now).free,6,'busy fighter excluded after recovery');
 sandbox.playerAccount=null;now+=60001;await api.refreshTrainingWhenDue();assert.equal(calls,before,'no requests before authentication');
 console.log('PASS first-load failure recovery, slow responses, 7/7, busy state, stale/invalid responses and single-flight refresh.');
})().catch(error=>{console.error(error);process.exitCode=1;});
