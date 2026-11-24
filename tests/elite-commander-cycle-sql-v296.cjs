const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID: uuid } = require('node:crypto');
const { database } = require('./combat-stats-v73.cjs');

const migrations = path.join(__dirname, '../supabase/migrations');
const read = name => fs.readFileSync(path.join(migrations,
  fs.readdirSync(migrations).find(file => file.endsWith('_' + name + '.sql'))), 'utf8');

async function main() {
  const db = await database();
  const q = async (sql, args = []) => (await db.query(sql, args)).rows;
  const as = async user => q("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    // Use the existing battle, pit, equipment, food and finish functions.
    await db.exec(read('survival_v83'));
    await require('./combat-motion-sql-v163.cjs').install(db);
    await db.exec("create table if not exists public.ludus_shop_catalog(sku text primary key,name text,kind text,model text,price integer,category text);create table ludus_supply_private.production_recipes_v118(sku text primary key,name text,kind text,model text,ingredients jsonb,output_type text,output_quantity int,sort_order int);create table ludus_supply_private.recipes(sku text primary key,ingredients jsonb);");
    for (const name of ['equipment_groups_v168', 'pit_arena_v172', 'pit_four_fighters_v173']) await db.exec(read(name));
    await db.exec('update ludus_pit_private.rules set gate_enabled=true');
    const original = await q("select oid::regprocedure::text name,pg_get_functiondef(oid) body from pg_proc where pronamespace='public'::regnamespace and proname in ('ludus_start_battle_v2','ludus_finish_battle_v2','ludus_match') order by name");
    await db.exec(read('elite_commander_cycle_v296'));
    await db.exec(read('elite_commander_cycle_v296')); // Migration reapplication is safe.
    assert.deepEqual(await q("select oid::regprocedure::text name,pg_get_functiondef(oid) body from pg_proc where pronamespace='public'::regnamespace and proname in ('ludus_start_battle_v2','ludus_finish_battle_v2','ludus_match') order by name"), original);

    const users = Array.from({ length: 4 }, () => ({ u: uuid(), g: uuid() }));
    for (const { u, g } of users) {
      await q('insert into ludus_accounts(user_id,username,gold)values($1,$2,2000)', [u, u]);
      await q("insert into ludus_gladiators(id,owner_id,name,class,status,base_stats,stat_version)values($1,$2,'Varro','secutor','available',$3,7)", [g, u, { health: 50, strength: 50, defense: 50, agility: 50, speed: 50, conditioning: 50 }]);
      await q('insert into ludus_pit_private.fame values($1,30)', [g]);
    }
    const count = async user => (await q('select matches_started from ludus_private.elite_commander_cycle_v296 where owner_id=$1', [user]))[0]?.matches_started ?? 0;
    const start = async (user, mode = 'solo20', request = uuid(), slots = {}, version = 296) => {
      await as(user.u);
      return (await q(`select public.ludus_start_battle_v${version}($1,$2,$3,$4) r`, [user.g, mode, slots, request]))[0].r;
    };
    const finish = async (user, battle) => {
      await as(user.u);
      const reward = (await q("select public.ludus_finish_battle_v2($1,false,'{\"alive\":false,\"exit_slots\":{},\"abandoned\":true}') r", [battle.id]))[0].r;
      assert.deepEqual((await q("select public.ludus_finish_battle_v2($1,false,'{\"alive\":false,\"exit_slots\":{},\"abandoned\":true}') r", [battle.id]))[0].r, reward);
      await q("update ludus_gladiators set status='available',fatigue_value=0,injury_level=0,injured_until=null where id=$1", [user.g]);
    };

    // Six starts alternate both eligible modes, with the exact 1/1/1 cycle.
    for (let i = 1; i <= 6; i++) {
      const mode = i % 2 ? 'solo20' : '4x5', request = uuid();
      const ticket = await start(users[0], mode, request);
      assert.equal(ticket.mode, mode);
      assert.equal(ticket.snapshot.game_mode, mode);
      assert.equal(ticket.snapshot.venue, 'colosseum');
      assert.deepEqual(ticket.snapshot.elite_v296, { version: 296, sequence: i, commander: ['legatus', 'imperator', null][(i - 1) % 3] });
      assert.deepEqual(await start(users[0], mode, request), ticket);
      assert.deepEqual((await q('select snapshot from ludus_battles where id=$1', [ticket.id]))[0].snapshot, ticket.snapshot);
      assert.equal(Number(await count(users[0].u)), i);
      await assert.rejects(() => start(users[0], mode), /Devam eden savaş/);
      assert.equal(Number(await count(users[0].u)), i);
      await finish(users[0], ticket);
      assert.deepEqual(await start(users[0], mode, request), ticket); // Completed replay.
      assert.equal(Number(await count(users[0].u)), i);
    }

    // Each account starts independently. Naval and other venues do not count.
    for (const [mode, slots] of [['naval4x5', {}], ['survival', {}], ['pit', { pit_weapon: 'pit_wood_mace' }]]) {
      const request = uuid(), ticket = await start(users[1], mode, request, slots);
      assert.equal(ticket.snapshot.elite_v296, undefined);
      if (mode === 'naval4x5') {
        assert.equal(ticket.mode, '4x5'); // Existing combat and reward contract.
        assert.equal(ticket.snapshot.venue, 'naval');
        assert.equal(ticket.snapshot.game_mode, 'naval4x5');
      }
      assert.deepEqual(await start(users[1], mode, request, slots), ticket);
      assert.equal(Number(await count(users[1].u)), 0);
      await finish(users[1], ticket);
    }
    const independent = await start(users[1]);
    assert.equal(independent.snapshot.elite_v296.commander, 'legatus');
    assert.equal(independent.snapshot.elite_v296.sequence, 1);
    assert.equal(Number(await count(users[0].u)), 6);
    await finish(users[1], independent);

    // A V295 ticket reloaded/retried after deployment never consumes a turn.
    const legacyRequest = uuid(), legacy = await start(users[2], '4x5', legacyRequest, {}, 2);
    assert.equal(legacy.snapshot.elite_v296, undefined);
    assert.deepEqual(await start(users[2], '4x5', legacyRequest), legacy);
    assert.equal(Number(await count(users[2].u)), 0);
    await finish(users[2], legacy);
    const first = await start(users[2]);
    assert.equal(first.snapshot.elite_v296.commander, 'legatus');
    await finish(users[2], first);

    // Ownership, input failures and a failed snapshot write leave no gap.
    await as(users[3].u);
    await assert.rejects(() => q("select ludus_start_battle_v296($1,'solo20','{}',$2)", [users[0].g, uuid()]), /Gladyatör bulunamadı/);
    await assert.rejects(() => start(users[3], 'multiplayer'), /Geçersiz mod/);
    await assert.rejects(() => start(users[3], null), /Geçersiz mod/);
    await assert.rejects(() => start(users[3], 'solo20', null), /işlem kimliği/);
    await assert.rejects(() => start(users[3], 'solo20', uuid(), { main_hand: uuid() }), /Eşya/);
    assert.equal(Number(await count(users[3].u)), 0);
    const weapon = uuid();
    await q("insert into ludus_items(id,owner_id,kind,model)values($1,$2,'weapon','gladius')", [weapon, users[3].u]);
    await db.exec("create function public.reject_v296_test_snapshot()returns trigger language plpgsql as $$begin raise exception 'test snapshot failure';end;$$;create trigger reject_v296_test_snapshot before update of snapshot on public.ludus_battles for each row execute function public.reject_v296_test_snapshot();");
    const retryRequest = uuid();
    await assert.rejects(() => start(users[3], 'solo20', retryRequest, { main_hand: weapon }), /test snapshot failure/);
    assert.equal(Number(await count(users[3].u)), 0);
    assert.equal((await q('select count(*) n from ludus_battles where owner_id=$1', [users[3].u]))[0].n, 0);
    assert.equal((await q('select locked_battle_id from ludus_items where id=$1', [weapon]))[0].locked_battle_id, null);
    await db.exec('drop trigger reject_v296_test_snapshot on public.ludus_battles;drop function public.reject_v296_test_snapshot();');
    const retried = await start(users[3], 'solo20', retryRequest, { main_hand: weapon });
    assert.equal(retried.snapshot.elite_v296.sequence, 1);
    assert.equal((await q('select locked_battle_id from ludus_items where id=$1', [weapon]))[0].locked_battle_id, retried.id);
    await finish(users[3], retried);

    // Overlapping requests queue safely: one new ticket and one cycle position.
    await as(users[3].u);
    const requests = await Promise.allSettled([uuid(), uuid()].map(request => q("select ludus_start_battle_v296($1,'4x5','{}',$2) r", [users[3].g, request])));
    assert.equal(requests.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(Number(await count(users[3].u)), 2);
    await finish(users[3], requests.find(result => result.status === 'fulfilled').value[0].r);

    const permissions = (await q("select has_table_privilege('authenticated','ludus_private.elite_commander_cycle_v296','SELECT,INSERT,UPDATE,DELETE') direct,has_table_privilege('anon','ludus_private.elite_commander_cycle_v296','SELECT,INSERT,UPDATE,DELETE') anonymous,has_function_privilege('anon','public.ludus_start_battle_v296(uuid,text,jsonb,uuid)','EXECUTE') anon_rpc,has_function_privilege('authenticated','public.ludus_start_battle_v296(uuid,text,jsonb,uuid)','EXECUTE') user_rpc,(select relrowsecurity from pg_class where oid='ludus_private.elite_commander_cycle_v296'::regclass) rls"))[0];
    assert.deepEqual(permissions, { direct: false, anonymous: false, anon_rpc: false, user_rpc: true, rls: true });
    await as('');
    await assert.rejects(() => q("select ludus_start_battle_v296($1,'solo20','{}',$2)", [users[3].g, uuid()]), /Giriş/);
    await as(users[3].u);
    await db.exec('set role authenticated');
    const allowed = (await q("select ludus_start_battle_v296($1,'solo20','{}',$2) r", [users[3].g, uuid()]))[0].r;
    assert.equal(allowed.snapshot.elite_v296.commander, null);
    await assert.rejects(() => q('select * from ludus_private.elite_commander_cycle_v296'), /permission denied/);
    await db.exec('reset role');
    assert.equal(Number(await count(users[3].u)), 3);

    // A request UUID belongs to its owner; another account cannot replay it.
    const sharedRequest = uuid();
    const ownerTicket = await start(users[0], 'solo20', sharedRequest);
    const otherTicket = await start(users[1], 'solo20', sharedRequest);
    assert.notEqual(ownerTicket.id, otherTicket.id);
    assert.equal(ownerTicket.snapshot.gladiator.owner_id, users[0].u);
    assert.equal(otherTicket.snapshot.gladiator.owner_id, users[1].u);
    assert.equal(ownerTicket.snapshot.elite_v296.sequence, 7);
    assert.equal(otherTicket.snapshot.elite_v296.sequence, 2);
    assert.deepEqual(await start(users[0], 'solo20', sharedRequest), ownerTicket);
    assert.deepEqual(await start(users[1], 'solo20', sharedRequest), otherTicket);
    console.log('V296 SQL PASS: durable per-account black/blue/none cycle, land-only starts, naval venue, retries, legacy tickets, rollback, item locks, existing finish rewards and private grants.');
  } finally {
    await db.close();
  }
}

main().catch(error => { console.error(error.message, { where: error.where, internalQuery: error.internalQuery }, error.stack); process.exitCode = 1; });
