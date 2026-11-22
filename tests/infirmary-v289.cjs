const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {database}=require('./fixtures/infirmary-v289.cjs');
const near=(a,b,tolerance=.03)=>assert.ok(Math.abs(Number(a)-b)<tolerance,`${a} != ${b}`);
async function test(){
 const db=await database(),q=async(s,a=[])=>(await db.query(s,a)).rows;
 const [a,b]=[randomUUID(),randomUUID()];await q('insert into ludus_accounts(user_id,gold)values($1,1000),($2,2000)',[a,b]);
 const user=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const admin=async(s,p=[])=>{await db.exec('reset role');const r=await q(s,p);await db.exec('set role authenticated');return r;};
 const call=async(action='state',args={},request=null)=>(await q('select ludus_infirmary_v289($1,$2,$3)s',[action,JSON.stringify(args),request]))[0].s;
 const gladiator=async owner=>(await admin("insert into ludus_gladiators(owner_id,name,class)values($1,'Hasta','secutor')returning id",[owner]))[0].id;
 const assign=async(owner,g,key,source='battle',sourceId=randomUUID(),context={verified:true})=>(await admin('select ludus_infirmary_private.assign_injury_v289($1,$2,$3,$4,$5,$6)id',[owner,g,key,source,sourceId,JSON.stringify(context)]))[0].id;
 await user(a);let state=await call();assert.equal(state.user_id,a);assert.equal(state.recipes.length,7);assert.equal(state.inventory.length,7);assert.equal(state.injuries.length,0);
 assert.deepEqual((await admin('select severity,count(*)::integer n,min(duration_seconds)seconds from ludus_infirmary_private.injury_catalog group by severity order by severity')).map(x=>[x.severity,x.n,x.seconds]),[['heavy',5,86400],['light',5,10800],['medium',5,43200]]);
 await assert.rejects(()=>q('select * from ludus_infirmary_private.injuries'),/permission denied/);
 await assert.rejects(()=>q('select ludus_infirmary_private.draw_v289()'),/permission denied/);
 await assert.rejects(()=>q("select ludus_infirmary_private.assign_injury_v289($1,$2,'knee_abrasion','battle',$3,'{}')",[a,randomUUID(),randomUUID()]),/permission denied/);
 await admin("insert into ludus_supply_private.stock(owner_id,sku,quantity)select $1,sku,10 from ludus_supply_private.resources where not food",[a]);
 await q('select ludus_food_state()');
 await admin("insert into ludus_food_stock(owner_id,sku,quantity)values($1,'olive_oil',10)on conflict(owner_id,sku)do update set quantity=10",[a]);
 state=await call();assert.equal(state.recipes.find(r=>r.sku==='beeswax_ointment').max_craftable,10);
 const craftRequest=randomUUID();state=await call('craft',{sku:'beeswax_ointment',quantity:2},craftRequest);
 assert.equal(state.inventory.find(r=>r.sku==='beeswax_ointment').quantity,12);assert.equal(state.outcome.spent.length,2);
 assert.equal((await call('craft',{sku:'beeswax_ointment',quantity:2},craftRequest)).outcome.replayed,true);
 await assert.rejects(()=>call('craft',{sku:'beeswax_ointment',quantity:3},craftRequest),/başka/);
 await assert.rejects(()=>call('craft',{sku:'beeswax_ointment',quantity:101},randomUUID()),/100/);
 await assert.rejects(()=>call('craft',{sku:'beeswax_ointment',quantity:9},randomUUID()),/eksik/);
 near((await admin("select quantity from ludus_food_stock where owner_id=$1 and sku='olive_oil'",[a]))[0].quantity,8);
 await user(b);assert.equal((await call()).inventory.every(r=>r.quantity===0),true);await user(a);
 const g=await gladiator(a),injury=await assign(a,g,'knee_abrasion');
 let record=(await admin('select * from ludus_gladiators where id=$1',[g]))[0];assert.equal(record.status,'injured');assert.ok(Date.parse(record.injured_until)>Date.now()+1e12);
 await admin("update ludus_gladiators set status='available',injury_level=0,injured_until=clock_timestamp()-interval'1 hour'where id=$1",[g]);
 await admin('select ludus_private.exercise_recover_v46($1)',[g]);record=(await admin('select * from ludus_gladiators where id=$1',[g]))[0];assert.equal(record.status,'injured');assert.equal(record.injury_level,1);
 await assert.rejects(()=>admin("update ludus_gladiators set training_ends_at=clock_timestamp()+interval'1 hour'where id=$1",[g]),/Tedavi bekleyen/);
 await user(b);await assert.rejects(()=>call('preview',{injury_id:injury}),/bu ludusa/);await user(a);
 state=await call('preview',{injury_id:injury});assert.equal(state.preview.can_start,true);assert.equal(state.preview.duration_seconds,10800);
 // Use the same authoritative 30/75-second activity windows as other entry APIs.
 await admin('alter table ludus_matches disable trigger exercise_match_v46');
 const room=(await admin("insert into ludus_matches(status,players,updated_at)values('playing',$1,clock_timestamp())returning id",[JSON.stringify([{gladiator:{id:g}}])]))[0].id;
 assert.equal((await call('preview',{injury_id:injury})).preview.can_start,false);
 await admin("update ludus_matches set updated_at=clock_timestamp()-interval'31 seconds'where id=$1",[room]);
 assert.equal((await call('preview',{injury_id:injury})).preview.can_start,true);
 await admin('delete from ludus_matches where id=$1',[room]);await admin('alter table ludus_matches enable trigger exercise_match_v46');
 const startRequest=randomUUID();state=await call('start',{injury_id:injury},startRequest);const treatment=state.outcome.treatment_id;
 near((Date.parse(state.outcome.ends_at)-Date.parse(state.outcome.started_at))/1000,10800,.001);
 assert.equal((await call('start',{injury_id:injury},startRequest)).outcome.replayed,true);
 await assert.rejects(()=>call('start',{injury_id:injury},randomUUID()),/başlatılmış/);
 await assert.rejects(()=>call('finish',{treatment_id:treatment},randomUUID()),/henüz/);
 // Offline completion is automatic on state read; legacy injuries keep old timing.
 await admin("update ludus_infirmary_private.treatments set started_at=clock_timestamp()-interval'4 hours',ends_at=clock_timestamp()-interval'1 hour',credited_until=clock_timestamp()-interval'4 hours'where id=$1",[treatment]);
 state=await call();assert.equal(state.injuries.find(i=>i.id===injury).status,'healed');assert.equal(state.treatments.find(t=>t.id===treatment).status,'finished');
 const doneRequest=randomUUID();assert.equal((await call('finish',{treatment_id:treatment},doneRequest)).outcome.action,'finish');assert.equal((await call('finish',{treatment_id:treatment},doneRequest)).outcome.replayed,true);
 const legacy=await gladiator(a);await admin("update ludus_gladiators set status='injured',injury_level=1,injured_until=clock_timestamp()+interval'1 hour'where id=$1",[legacy]);
 state=await call();assert.equal(state.legacy_injuries.some(i=>i.gladiator_id===legacy),true);assert.equal(state.injuries.some(i=>i.gladiator_id===legacy),false);
 await admin("update ludus_gladiators set injured_until=clock_timestamp()-interval'1 second'where id=$1",[legacy]);await call();assert.equal((await admin('select status from ludus_gladiators where id=$1',[legacy]))[0].status,'available');
 // Guaranteed private draws exercise exact item rules without exposing a seed RPC.
 await admin('create table ludus_infirmary_private.test_draws_v289(n integer)');await admin('insert into ludus_infirmary_private.test_draws_v289 values(0)');
 await admin("create or replace function ludus_infirmary_private.draw_v289()returns double precision language plpgsql volatile set search_path=''as $$begin update ludus_infirmary_private.test_draws_v289 set n=n+1;return 0;end$$");
 await admin("insert into ludus_staff_private.knowledge_v288(owner_id,content_id)select $1,content_id from ludus_staff_private.papyrus_catalog_v288",[a]);
 const deepG=await gladiator(a),deep=await assign(a,deepG,'deep_forearm_laceration');
 await admin("update ludus_supply_private.stock set quantity=0 where owner_id=$1 and sku='linen_bandage'",[a]);
 const beforeDraws=(await admin('select n from ludus_infirmary_private.test_draws_v289'))[0].n;
 await assert.rejects(()=>call('start',{injury_id:deep},randomUUID()),/eksik/);
 assert.equal((await admin('select n from ludus_infirmary_private.test_draws_v289'))[0].n,beforeDraws);
 await admin("update ludus_supply_private.stock set quantity=20 where owner_id=$1",[a]);
 let preview=(await call('preview',{injury_id:deep})).preview;assert.ok(preview.doctor_effects.some(e=>e.content_id==='doctor_019'));assert.ok(!preview.doctor_effects.some(e=>e.content_id==='doctor_001'));
 state=await call('start',{injury_id:deep},randomUUID());assert.equal(state.outcome.saved.linen_bandage,1);assert.equal(state.outcome.consumed.linen_bandage,1);assert.equal(state.outcome.saved.vinegar_sponge,1);assert.equal(state.outcome.saved.beeswax_ointment,1);
 const ribG=await gladiator(a),rib=await assign(a,ribG,'rib_contusion');state=await call('start',{injury_id:rib},randomUUID());const ribT=state.outcome.treatment_id;
 assert.ok(state.preview.doctor_effects.some(e=>e.content_id==='doctor_020'));assert.ok(!state.preview.doctor_effects.some(e=>e.content_id==='doctor_006'));near(state.preview.recovery.honey_total,5.04,.00001);near(state.preview.recovery.per_hour,10.04,.00001);
 let tr=(await admin('select * from ludus_infirmary_private.treatments where id=$1',[ribT]))[0];near(tr.bonuses.honey_extra,5.04,.00001);near(tr.bonuses.recovery_rate,.004,.00001);
 // One elapsed hour: 10 baseline + .04 doctor009 + 5.04/12 syrup recovery.
 await admin("update ludus_gladiators set fatigue_value=90,fatigue=90,fatigue_rest_from=clock_timestamp()-interval'1 hour'where id=$1",[ribG]);
 await admin("update ludus_infirmary_private.treatments set started_at=clock_timestamp()-interval'1 hour',ends_at=clock_timestamp()+interval'11 hours',credited_until=clock_timestamp()-interval'1 hour'where id=$1",[ribT]);
 await call();near((await admin('select fatigue_value from ludus_gladiators where id=$1',[ribG]))[0].fatigue_value,79.54);
 await call();near((await admin('select fatigue_value from ludus_gladiators where id=$1',[ribG]))[0].fatigue_value,79.54);
 const figG=await gladiator(a),fig=await assign(a,figG,'mild_calf_strain');state=await call('start',{injury_id:fig},randomUUID());const figT=state.outcome.treatment_id;
 near((await admin('select bonuses from ludus_infirmary_private.treatments where id=$1',[figT]))[0].bonuses.fig_discharge,5.02,.00001);
 await admin("update ludus_infirmary_private.treatments set started_at=clock_timestamp()-interval'3 hours 1 second',ends_at=clock_timestamp()-interval'1 second',credited_until=clock_timestamp()-interval'1 second'where id=$1",[figT]);
 await admin('update ludus_gladiators set fatigue_value=50,fatigue=50,fatigue_rest_from=clock_timestamp()where id=$1',[figG]);
 await call();near((await admin('select fatigue_value from ludus_gladiators where id=$1',[figG]))[0].fatigue_value,44.98);
 await call();near((await admin('select fatigue_value from ludus_gladiators where id=$1',[figG]))[0].fatigue_value,44.98);
 // Heavy duration never changes; clinician recovery fractions are snapshotted.
 const heavyG=await gladiator(a),heavy=await assign(a,heavyG,'open_tibia_fracture');state=await call('start',{injury_id:heavy},randomUUID());near((Date.parse(state.outcome.ends_at)-Date.parse(state.outcome.started_at))/1000,86400,.001);
 assert.equal(state.outcome.saved.wood_splint,1);near(state.preview.recovery.honey_total,5.02,.00001);near(state.preview.recovery.per_hour,10.04,.00001);
 assert.equal((await admin("select runtime_status from ludus_staff_private.papyrus_catalog_v288 where content_id='doctor_025'"))[0].runtime_status,'pending_feature');
 // Private future batch mechanic, deliberately unavailable in live runtime until
 // a verified clan-war producer exists. Activate only in this isolated fixture.
 await admin("update ludus_staff_private.papyrus_catalog_v288 set runtime_status='active'where content_id='doctor_025'");
 const clanId=randomUUID(),clanA=await assign(a,await gladiator(a),'deep_forearm_laceration','clan',clanId),clanB=await assign(a,await gladiator(a),'deep_forearm_laceration','clan',clanId);
 await admin("update ludus_supply_private.stock set quantity=20 where owner_id=$1",[a]);
 state=await call('start',{injury_id:clanA},randomUUID());assert.equal(state.outcome.saved.linen_bandage,1);
 state=await call('start',{injury_id:clanB},randomUUID());assert.equal(state.outcome.saved.linen_bandage,2);assert.equal(state.outcome.consumed.linen_bandage,0);assert.ok(Object.values(state.outcome.consumed).every(n=>n>=0));
 const batchTreatment=state.outcome.treatment_id;assert.equal((await admin('select clan_treatment_ordinal n from ludus_infirmary_private.treatments where id=$1',[batchTreatment]))[0].n,2);
 await admin("update ludus_staff_private.papyrus_catalog_v288 set runtime_status='pending_feature'where content_id='doctor_025'");
 // Cyclical injury/treatment references must not obstruct a parent record delete.
 await admin('delete from ludus_gladiators where id=$1',[heavyG]);assert.equal((await admin('select count(*)::int n from ludus_infirmary_private.injuries where gladiator_id=$1',[heavyG]))[0].n,0);
 await db.close();console.log('V289 infirmary PASS: actual legacy recovery, seven recipes, shared food/resource stock, ownership/replay, 15 typed injuries, fixed treatment clocks, full-stock-before-RNG, exact doctor savings/recovery and offline discharge.');
}
if(require.main===module)test().catch(e=>{console.error(e);process.exit(1);});
module.exports={test};
