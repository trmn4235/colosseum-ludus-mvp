const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');

// Run after V285's real reward/ownership tests, against the very same database.
module.exports = async function testLearning(db, migration) {
  await db.exec(`create schema ludus_worker_private; create schema ludus_supply_private;
    create table ludus_supply_private.jobs(id uuid primary key,escort_team jsonb);
    create table ludus_worker_private.defenses_v230(id uuid primary key,owner_id uuid,status text default 'ready',
      deadline timestamptz default now(),encounter jsonb,workers jsonb,success boolean);
    create function ludus_worker_private.resolve_defense_v230(uuid,uuid,boolean,boolean) returns void language sql as
      $$update ludus_worker_private.defenses_v230 set success=$3,status='resolved' where id=$2 and owner_id=$1$$;`);
  await db.exec(migration('special_staff_learning_v286'));
  const query = async (sql, args=[]) => (await db.query(sql,args)).rows;
  const a=randomUUID(), b=randomUUID();
  await query('insert into ludus_accounts(user_id) values($1),($2)',[a,b]);
  await query("insert into ludus_staff_private.papyri_v284(owner_id,role_id,lesson) values($1,'guard',1),($1,'guard',401),($1,'guard',491),($1,'cook',1)",[a]);
  // V285 already discovered each unique, then removed ownership. Reuse its
  // existing identity for this fixture and check its original discovery survives.
  await query("insert into ludus_staff_private.unique_papyri_v285(papyrus_id,owner_id) values('guard-first',$1)",[a]);
  const owner = id => query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  const state = async () => (await query("select ludus_special_staff('guard',0) s"))[0].s;
  const read = async (n, request=randomUUID(), role='guard') => (await query('select ludus_special_staff_read($1,$2,$3) s',[role,n,request]))[0].s;
  const unique = async (request=randomUUID(), role='guard') => (await query("select ludus_special_staff_read_unique($1,'guard-first',$2) s",[role,request]))[0].s;
  const guard = s => s.staff.find(r=>r.id==='guard');
  const ticket = async ownerId => {
    const id=randomUUID();
    await query("insert into ludus_supply_private.jobs values($1,'[{}]')",[id]);
    await query(`insert into ludus_worker_private.defenses_v230(id,owner_id,encounter,workers)
       values($1,$2,'{"version":230,"guards":2}','[{"armed":true,"base_damage":20,"arrows":6},{"armed":true,"base_damage":13,"arrows":3}]')`,[id,ownerId]);
    return id; // 239 attack vs 240 required.
  };
  const before = await ticket(a);
  await owner(a);await db.exec('set role authenticated');
  let s=await state();
  assert.deepEqual([guard(s).collected,guard(s).read,guard(s).overall,guard(s).unique_collected,guard(s).unique_read],[3,0,0,1,0]);
  assert.deepEqual(guard(s).bonuses,[]);
  const discovery=s.papyri.find(p=>p.unique_id);
  assert.equal(discovery.effects[0].percent,.3);assert.ok(discovery.finder&&discovery.found_at);
  await assert.rejects(()=>read(2),/çantanda yok/);
  await assert.rejects(()=>read(1,randomUUID(),'cook'),/açık değil/);
  await assert.rejects(()=>unique(randomUUID(),'trainer'),/çantanda yok/);
  const standardRequest=randomUUID(),uniqueRequest=randomUUID();
  s=await read(401,standardRequest);assert.equal(guard(s).overall,.2);assert.equal(guard(s).bonuses[0].percent,.03);
  assert.equal((await read(401,standardRequest)).reading.replayed,true);
  await assert.rejects(()=>unique(standardRequest),/farklı/);
  await assert.rejects(()=>read(401),/zaten okundu/);
  s=await unique(uniqueRequest);
  assert.equal(guard(s).overall,.2);assert.equal(guard(s).unique_read,1);assert.equal(guard(s).bonuses[0].percent,.33);
  assert.equal((await unique(uniqueRequest)).reading.replayed,true);
  await assert.rejects(()=>read(1,uniqueRequest),/farklı/);
  await assert.rejects(()=>unique(),/zaten okundu/);
  assert.equal(s.papyri.find(p=>p.unique_id).found_at,discovery.found_at);
  await unique(uniqueRequest);await read(1);s=await read(491);
  assert.equal(guard(s).bonuses[0].percent,.44);assert.equal(guard(s).overall,.6);
  await owner(b);assert.equal(guard(await state()).bonuses.length,0);await assert.rejects(()=>unique(),/çantanda yok/);
  await assert.rejects(()=>query('select * from ludus_staff_private.learned_effects_v286'),/permission denied/);
  await assert.rejects(()=>query('update ludus_staff_private.unique_effects_v286 set percent=100'),/permission denied/);
  await query("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");
  await assert.rejects(()=>read(1),/Giriş/);
  await query("select set_config('request.jwt.claims','{}',false)");
  await db.exec('reset role;set role anon');await assert.rejects(()=>unique(),/permission denied/);await db.exec('reset role');
  const after=await ticket(a),other=await ticket(b);
  const snapshots=await query("select id,(encounter->>'staff_attack_percent')::float as pct from ludus_worker_private.defenses_v230");
  assert.deepEqual(Object.fromEntries(snapshots.map(t=>[t.id,t.pct])),{[before]:0,[after]:.44,[other]:0});
  for(const id of [a,b])await query("select ludus_worker_private.settle_defenses_v230($1,clock_timestamp())",[id]);
  const outcomes=await query('select id,success from ludus_worker_private.defenses_v230');
  assert.deepEqual(Object.fromEntries(outcomes.map(t=>[t.id,t.success])),{[before]:false,[after]:true,[other]:false});
  await query(`insert into ludus_staff_private.papyri_v284(owner_id,role_id,lesson,read_at)
    select $1,role_id,lesson,clock_timestamp() from ludus_staff_private.lessons_v284 where role_id='guard' on conflict do nothing`,[a]);
  await owner(a);s=await state();
  assert.equal(guard(s).collected,500);assert.equal(guard(s).overall,100);assert.equal(guard(s).bonuses[0].percent,8);
  assert.equal(s.paper_count,501);
  const last=(await query("select ludus_special_staff('guard',83) s"))[0].s;assert.equal(last.papyri.length,3);
  console.log('V286 learning passed: post-drop reads, legacy receipts, owner isolation, separate unique, frozen and effective defense, 8% cap.');
};
