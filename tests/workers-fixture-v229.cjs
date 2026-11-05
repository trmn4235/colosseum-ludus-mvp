module.exports=()=>`<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{height:100%;margin:0;overflow:hidden;background:#eee6d8}</style><link rel="stylesheet" href="/ludus-workers-v226.css"></head><body><button id="openWorkers">İşçileri aç</button><script src="/ludus-workers-v226.js"></script><script>
${require('./worker-fixture-v227.cjs')('00000000-0000-4000-8000-000000000109')}
const realNow=Date.now.bind(Date);window.__shift=0;Date.now=()=>realNow()+__shift;
window.__calls=0;window.__supplyFailure=false;window.__rosterFailure=false;
const serverStart=Date.now()+600000;
const jobs=[{id:'iron-trip',destination:'city-1',destination_name:'Roma',cargo:{iron_ore:60},started_at:new Date(serverStart-3510000).toISOString(),ends_at:new Date(serverStart+90000).toISOString()},
 {id:'blocked-trip',destination:'city-2',destination_name:'Ostia',cargo:{wood:60},started_at:new Date(serverStart-3601000).toISOString(),ends_at:new Date(serverStart-1000).toISOString()}];
jobs.forEach((j,i)=>{__workerRoster.workers[i].job_id=j.id;__workerRoster.workers[i].job=j;});
__workerRoster.workers[0].archery={xp:550,level:6,base_damage:14,training_trips:55};
const client={rpc:async name=>{__calls++;if(name==='ludus_workers_roster_v226')return __rosterFailure?{error:{message:'Offline'}}:{data:{...structuredClone(__workerRoster),server_now:new Date(Date.now()+600000).toISOString()}};return __supplyFailure?{error:{message:'Offline'}}:{data:{user_id:__workerRoster.user_id,server_now:new Date(Date.now()+600000).toISOString(),jobs,deliveries:[],cities:[{id:1,name:'Roma'},{id:2,name:'Ostia'}],resources:[],destinations:[],caravans:6,free_caravans:4}};}};
window.workerPanel=LudusWorkersV226.create({client,ready:Promise.resolve({user_id:__workerRoster.user_id})});document.getElementById('openWorkers').onclick=()=>workerPanel.open();workerPanel.open();
</script></body></html>`;
