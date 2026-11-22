const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const dashboard=require('../clan-dashboard-v276.js'),visuals=require('../item-visuals-v199.js');
const state={clan:{id:'c1',name:'TOTTI',level:1,experience:266,exp_cost:100,gold:550,coin_cost:500,member_count:10,capacity:10},leader:true,members:[{name:'Tırman',leader:true,online:true},{online:false}],applications:[{kind:'application'},{kind:'invite'}],roster:{state:'draft',invited:true,entries:[{user_id:'other'}]}};
const work={status:'loaded',data:{clan_id:'c1',jobs:[{status:'collecting'},{status:'collecting'},{status:'forming'},{status:'completed'}]}};
test('home counts working caravans only, never reports missing or other-clan data as zero',()=>{
 assert.equal(dashboard.summarize(state,work,'me').active,2);
 for(const w of [{status:'loading'},{status:'error'},{...work,data:{...work.data,clan_id:'other'}}])assert.equal(dashboard.summarize(state,w,'me').active,null);
 assert.equal(dashboard.summarize(state,{...work,data:{...work.data,jobs:[]}},'me').active,0);
});
test('home routes to details and removes the leader name',()=>{
 const s=structuredClone(state);s.members[0].name='<img src=x onerror=alert(1)>';
 const summary=dashboard.summarize(s,work,'me');assert.equal(summary.online,1);assert.equal(summary.rosterCount,1);
 assert.deepEqual(summary.notes.map(x=>x.view),['roster','manage','progress']);
 const html=dashboard.render(s,work,'me','<svg></svg>');assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('onerror'));assert.ok(!html.includes('KLAN LİDERİ'));
 for(const target of ['members','caravans','roster','vault','progress'])assert.ok(html.includes('data-view="'+target+'"'));
 assert.ok(!dashboard.summarize({...s,leader:false},work,'me').notes.some(n=>n.view==='manage'));
 assert.ok(dashboard.render(s,{status:'error'},'me','').includes('data-action="retry_caravans"'));
});
test('new generated equipment files retain distinct identities, alpha frames and small payloads',()=>{
 for(const r of require('../assets/items-v276/render-report.json')){const b=fs.readFileSync(r.icon);assert.equal(visuals.records[r.sku].icon,r.icon);assert.equal(b.length,r.bytes);assert.ok(r.bytes<70000);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),r.sha256);assert.ok(visuals.artwork({sku:r.sku,enhancement:10}).includes('viewBox="'+r.frame.slice(0,4).join(' ')+'"'));}
 assert.equal(visuals.records.chest.icon,'assets/items-v199/chest.webp');
});
test('long weapons turn in the art layer while enhancement header remains separate',()=>{
 for(const sku of ['gladius','sica','spear','trident','trident-gladiator','halberd','heavy_mace','mace','warhammer','whip']){const html=visuals.artwork({sku,enhancement:10});assert.ok(html.includes('data-tip="northwest"'),sku);assert.match(html,/<\/svg><span class="item-enhancement-v269"/);assert.equal((html.match(/\+10/g)||[]).length,2);}
 assert.match(visuals.artwork({sku:'gladius'}),/scale\(-1 -1\)/);
 assert.match(visuals.artwork({sku:'sica'}),/scale\(1 -1\)/);
 assert.ok(!visuals.artwork({sku:'chest-plate'}).includes('transform='));
});
test('clan inline scripts parse and preserve the owner-checked caravan endpoint',()=>{
 const s=fs.readFileSync('klan.html','utf8');for(const m of s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
 assert.ok(s.includes("r.data?.user_id!==userId||r.data?.clan_id!==clanId"));
 assert.ok(s.includes('clan-dashboard-v276.js?v=revision289'));
});
