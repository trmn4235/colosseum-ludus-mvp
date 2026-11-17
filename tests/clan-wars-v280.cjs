const test=require('node:test'),assert=require('node:assert/strict');
const d=require('../clan-dashboard-v276.js');
const now=Date.parse('2026-11-16T16:00:00Z');
const clan={id:'c1',level:1,experience:40,exp_cost:100,capacity:10,member_count:10,gold:0};
const first={id:'war-1',clan_id:'c1',status:'scheduled',starts_at:'2026-11-16T22:30:00+03:00',team_size:10,roster_id:'r1'};
const second={...first,id:'war-2',starts_at:'2026-11-17T01:30:00+03:00',roster_id:'r2'};
const state={clan,members:[],upcoming_wars:[second,first],roster:{id:'r1',state:'draft'},rosters:[{id:'r2',clan_id:'c1',state:'locked'}]};
test('two earliest scheduled wars are chronological, unique and clan-scoped',()=>{
 const s={...state,upcoming_wars:[second,{...first,id:'cancel',status:'cancelled'},{...first,id:'foreign',clan_id:'other'},first,first,{...second,id:'war-3',starts_at:'2026-11-18T01:30:00+03:00'}]};
 const wars=d.upcomingWars(s,now);assert.deepEqual(wars.map(w=>w.key),['war-1','war-2']);assert.deepEqual(wars.map(w=>w.countdown),['03:30:00','06:30:00']);assert.deepEqual(wars.map(w=>w.format),['10vs10','10vs10']);
 assert.equal(d.upcomingWars({...state,upcoming_wars:undefined,next_war:first},now)[1].scheduled,false);
 assert.equal(d.upcomingWars({...state,upcoming_wars:[],next_war:first},now)[0].scheduled,false);
});
test('war buttons resolve only their own explicitly linked, same-clan roster',()=>{
 assert.equal(d.rosterForWar(state,'war-1').roster.id,'r1');assert.equal(d.rosterForWar(state,'war-2').roster.id,'r2');
 assert.equal(d.rosterForWar({...state,rosters:[]},'war-2').roster,null);
 assert.equal(d.rosterForWar({...state,rosters:[{id:'r2',clan_id:'other',state:'draft'}]},'war-2').roster,null);
 assert.equal(d.rosterForWar({...state,rosters:[{id:'r2',clan_id:'c1',state:'finished'}]},'war-2').roster,null);
 assert.equal(d.rosterForWar(state,'unknown'),null);
});
test('both timers advance independently without rebuilding the cards',()=>{
 const cards=['war-1','war-2'].map(key=>{const clock={},label={};return{dataset:{warKey:key},clock,label,querySelector:s=>s==='[data-war-countdown]'?clock:label};});
 const host={querySelectorAll:()=>cards};d.tick(host,state,now);assert.deepEqual(cards.map(c=>c.clock.textContent),['03:30:00','06:30:00']);
 d.tick(host,state,now+1000);assert.deepEqual(cards.map(c=>c.clock.textContent),['03:29:59','06:29:59']);
 const html=d.render(state,{status:'loading'},'me','');assert.equal((html.match(/data-action="war_roster"/g)||[]).length,2);for(const key of ['war-1','war-2'])assert.ok(html.includes('data-war-key="'+key+'"'));
});
test('absent schedules leave two clearly empty, independently addressed cards',()=>{
 const s={...state,upcoming_wars:undefined};const wars=d.upcomingWars(s,now);
 assert.deepEqual(wars.map(w=>w.key),['pending-1','pending-2']);assert.ok(wars.every(w=>!w.scheduled&&w.countdown==='— : — : —'));
 assert.equal(d.rosterForWar(s,'pending-2').roster,null);
});
