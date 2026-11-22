const assert=require('node:assert/strict'),{create}=require('../smith-knowledge-v288.js');
(async()=>{
 const calls=[],pending=[];const client={rpc(name,args){calls.push({name,args});return new Promise(resolve=>pending.push(resolve));}};
 const smith=create(client),item={id:'one',enhancement:2},owner='A';
 const first=smith.update({item,owner});assert.equal(smith.snapshot().status,'loading');
 const second=smith.update({item:{...item,id:'two'},owner,action:'sapphire',stone:3});
 pending[0]({data:{item_id:'one',chance:.7}});await first;assert.equal(smith.snapshot().status,'loading','old item response must not replace selected item');
 pending[1]({data:{item_id:'two',chance:.008}});await second;assert.equal(smith.snapshot().data.item_id,'two');
 assert.deepEqual(calls[1],{name:'ludus_smith_preview_v288',args:{p_item:'two',p_action:'sapphire',p_stone:3}});
 await smith.update({item:{...item,id:'two'},owner,action:'sapphire',stone:3});assert.equal(calls.length,2,'duplicate rendering does not send duplicate RPC');
 await smith.update({item,owner,busy:true});assert.equal(smith.snapshot().status,'working');assert.equal(smith.snapshot().data,null);
 const third=smith.update({item,owner});pending[2]({error:{message:'Eşya bulunamadı'}});await third;assert.equal(smith.snapshot().status,'error');assert.equal(smith.snapshot().data,null,'no fabricated fallback chance');
 const fourth=smith.update({item,owner});smith.invalidate();pending[3]({data:{chance:1}});await fourth;assert.equal(smith.snapshot().status,'empty');
 console.log('PASS V288 smith preview: authoritative RPC, stale response isolation, render deduplication, working/invalidation and failure state.');
})().catch(e=>{console.error(e);process.exitCode=1;});
