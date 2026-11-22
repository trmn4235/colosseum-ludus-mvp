const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const dashboard=require('../clan-dashboard-v276.js');
const state={clan:{id:'c1',level:1,experience:40,exp_cost:100,capacity:10,member_count:10,gold:0},members:[],applications:[]};
test('all 22 map locations preserve the supply map coordinates, legacy aliases and real icons',()=>{
 const c={};vm.runInNewContext(fs.readFileSync('ludus-supply-v85.js','utf8'),c);
 const actual=dashboard.locations.map(l=>[l.sku,l.x,l.y]);
 assert.equal(actual.length,22);assert.equal(new Set(actual.map(l=>l[0])).size,22);
 assert.deepEqual(actual,JSON.parse(JSON.stringify(c.LudusSupply.atlas.map(l=>[l.sku||l.id,...l.at]))));
 assert.deepEqual(dashboard.locations.slice(0,16).map(l=>l.sku),['wood','meat','lead_ore','tin_ore','copper_ore','flax','hide','wool','grain','resin','fish','olive_oil','iron_ore','beer','egg','apple']);
 assert.deepEqual(dashboard.locations.slice(16).map(l=>[l.sku,l.name]),[['beeswax','Balmumu arılığı'],['laurel','Defne bahçesi'],['honey','Bal arılığı'],['fig','İncir bahçesi'],['wine_vinegar','Sirke atölyesi'],['sponge','Sünger kıyısı']]);
 const html=dashboard.render(state,{status:'loading'},'me',''),images=[...html.matchAll(/class="clan-map-resource"><img src="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(images.length,22);for(const path of images)assert.ok(fs.existsSync(path),path);
 for(const l of dashboard.locations.slice(16))assert.ok(html.includes('src="assets/infirmary-v289/'+l.sku.replaceAll('_','-')+'.webp"'),l.sku+' uses the shipped medical-source icon');
});
test('medical-source teams contribute to map badges and totals, excluding forming/completed jobs',()=>{
 const work={status:'loaded',data:{clan_id:'c1',jobs:[{sku:'honey',status:'collecting'},{sku:'honey',status:'collecting'},{sku:'wine_vinegar',status:'collecting'},{sku:'sponge',status:'forming'},{sku:'fig',status:'completed'}]}};
 const counts=dashboard.workCounts(state,work);assert.equal(counts.honey,2);assert.equal(counts.wine_vinegar,1);assert.equal(counts.sponge,0);assert.equal(counts.fig,0);
 const html=dashboard.render(state,work,'me','');assert.ok(html.includes('Bal arılığı · 2 çalışan ekip'));assert.ok(html.includes('Sirke atölyesi · 1 çalışan ekip'));assert.ok(html.includes('3 ekip çalışıyor'));
 for(const sku of ['beeswax','laurel','honey','fig','wine_vinegar','sponge'])assert.ok(html.includes('data-action="site" data-sku="'+sku+'"'));
});
test('map aggregates only working teams by source, with unknown data kept distinct from zero',()=>{
 const work={status:'loaded',data:{clan_id:'c1',jobs:[{sku:'iron_ore',status:'collecting'},{sku:'iron_ore',status:'collecting'},{sku:'apple',status:'collecting'},{sku:'apple',status:'forming'},{sku:'iron_ore',status:'completed'}]}};
 const counts=dashboard.workCounts(state,work);assert.equal(counts.iron_ore,2);assert.equal(counts.apple,1);assert.equal(counts.fish,0);
 assert.equal(dashboard.workCounts(state,{...work,data:{...work.data,clan_id:'other'}}),null);
 assert.equal(dashboard.workCounts(state,{status:'error'}),null);
 const html=dashboard.render(state,work,'me','');assert.ok(html.includes('Demir ocağı · 2 çalışan ekip'));assert.ok(html.includes('data-action="site" data-sku="apple"'));assert.ok(html.includes('3 ekip çalışıyor'));
});
test('EXP bar handles progress, stored excess EXP, missing targets and the maximum level',()=>{
 assert.equal(dashboard.progress(state.clan).percent,40);
 assert.equal(dashboard.progress({...state.clan,experience:266}).percent,100);
 assert.equal(dashboard.progress({...state.clan,exp_cost:0}).percent,0);
 assert.equal(dashboard.progress({...state.clan,level:20,exp_cost:0}).percent,100);
 const html=dashboard.render(state,{status:'loading'},'me','');assert.ok(html.includes('aria-valuenow="40"'));assert.ok(html.includes('Seviye 1'));assert.ok(!html.includes('KLAN LİDERİ'));
});
test('war countdown uses a matching clan and an explicit scheduled instant; missing dates never invent a countdown',()=>{
 const now=Date.parse('2026-11-16T16:00:00Z'),war={clan_id:'c1',status:'scheduled',starts_at:'2026-11-16T22:30:00+03:00',team_size:10};
 assert.equal(dashboard.nextWar({...state,next_war:war},now).countdown,'03:30:00');
 assert.equal(dashboard.nextWar({...state,next_war:war},now+1000).countdown,'03:29:59');
 for(const w of [undefined,{...war,clan_id:'other'},{...war,starts_at:'bad'},{...war,starts_at:'2026-11-16T22:30:00'},{...war,status:'cancelled'}]){const result=dashboard.nextWar({...state,next_war:w},now);assert.equal(result.scheduled,false);assert.equal(result.label,'Savaş saati bekleniyor');}
 const expired=dashboard.nextWar({...state,next_war:war},now+14400000);assert.equal(expired.countdown,'00:00:00');assert.equal(expired.label,'Başlangıç saati geldi');
 assert.equal(dashboard.nextWar({...state,next_war:{...war,status:'active'}},now).countdown,'Savaş sürüyor');
});
