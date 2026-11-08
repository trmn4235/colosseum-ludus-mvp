// Uses the real market, delivery and production APIs from production-v119.
const assert=require('node:assert/strict');
module.exports=async({db,q,migration,randomUUID,A,batch=false})=>{
 await db.exec(`reset role;
 create schema ludus_bot_private;
 create table ludus_bot_private.settings_v233(id boolean primary key,owner_id uuid,ready boolean,enabled boolean);
 create table ludus_bot_private.members_v233(slot smallint primary key,user_id uuid,enabled boolean);
 create function ludus_bot_private.build_v233(integer)returns integer[] language sql as $$select array[1,3,10,12]$$;
 alter table public.ludus_items add column if not exists stat_version integer default 10;
 alter table public.ludus_items add column if not exists natural_stats jsonb default '{}'::jsonb;
 alter table public.ludus_items add column if not exists natural_percentages jsonb default '{}'::jsonb;
 alter table public.ludus_items add column if not exists created_at timestamptz default clock_timestamp();
 alter table public.ludus_stone_catalog add column if not exists effect_key text;
 create function public.ludus_equip_item(g uuid,s text,i uuid) returns jsonb language plpgsql as $$begin
  update public.ludus_items set equipped_by=null,equipped_slot=null where owner_id=auth.uid() and equipped_by=g and equipped_slot=s;
  update public.ludus_items set equipped_by=g,equipped_slot=s where id=i and owner_id=auth.uid();
  if not found then raise exception 'wrong owner';end if;return '{}'::jsonb;end$$;
 create function public.ludus_upgrade_item_v10(i uuid,a text,s integer,r uuid) returns jsonb language plpgsql as $$begin
  if a='enhance' then update public.ludus_accounts set diamonds=diamonds-1 where user_id=auth.uid() and diamonds>0;
   if not found then raise exception 'no diamonds';end if;
   update public.ludus_items set enhancement=enhancement+1 where id=i and owner_id=auth.uid();
  elsif a='emerald' then update public.ludus_stones set quantity=quantity-1 where owner_id=auth.uid() and family=a and stone_id=s and quantity>0;
   if not found then raise exception 'no stone';end if;
   update public.ludus_items set emeralds=emeralds||jsonb_build_array(jsonb_build_object('id',s,'value',100)) where id=i and owner_id=auth.uid();
  end if;return '{}'::jsonb;end$$;`);
 const bot=randomUUID(),g=randomUUID();
 await q("insert into public.ludus_accounts(user_id,gold,diamonds,ludus_name) values($1,500,0,'Bot')",[bot]);
 await q("insert into public.ludus_gladiators(id,owner_id,name,class,status) values($1,$2,'Bot','secutor','available')",[g,bot]);
 await q('insert into ludus_bot_private.settings_v233 values(true,$1,true,true)',[A]);
 await q('insert into ludus_bot_private.members_v233 values(1,$1,true)',[bot]);
 await db.exec(migration('bot_production_v238'));
 if(batch)await db.exec(migration('bot_production_batch_v242'));
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 await q('select ludus_bot_private.production_tick_v238(1)');
 let log=(await q('select last_action,last_error from ludus_bot_private.production_log_v238 where slot=1'))[0];
 assert.equal(log.last_error,null);assert.match(log.last_action,/Kervan malzeme aldı/);
 assert.equal((await q('select count(*)::integer n from ludus_bot_private.gear_goals_v238 where slot=1'))[0].n,6);
 assert.equal((await q('select count(*)::integer n from ludus_supply_private.jobs where owner_id=$1 and claimed_at is null',[bot]))[0].n,1);
 if(batch)assert.ok((await q("select (cargo->>'wood')::integer n from ludus_supply_private.jobs where owner_id=$1 and claimed_at is null",[bot]))[0].n>=15,'a useful material batch fills the caravan');
 const gold=Number((await q('select gold from public.ludus_accounts where user_id=$1',[bot]))[0].gold);assert.ok(gold<500&&gold>=100);
 assert.equal((await q('select auth.uid() u'))[0].u,A,'human identity restored');
 // Let the purchased cargo return, then provide fixture raw resources and
 // exercise the real recursive processing, recipe debit and equipment path.
 await q("update ludus_supply_private.jobs set started_at=clock_timestamp()-interval '2 hours',ends_at=clock_timestamp()-interval '1 second' where owner_id=$1",[bot]);
 await q("update ludus_supply_private.stock set quantity=100 where owner_id=$1 and sku in('iron_ore','copper_ore','tin_ore','wood','flax','hide','wool','resin')",[bot]);
 for(let n=0;n<30;n++)await q('select ludus_bot_private.production_tick_v238(1)');
 log=(await q('select last_action,last_error from ludus_bot_private.production_log_v238 where slot=1'))[0];assert.equal(log.last_error,null);
 const legs=(await q("select state,item_id from ludus_bot_private.gear_goals_v238 where gladiator_id=$1 and equipment_slot='legs'",[g]))[0];
 assert.equal(legs.state,'equipped');assert.ok(legs.item_id);
 assert.equal((await q('select equipped_by from public.ludus_items where id=$1',[legs.item_id]))[0].equipped_by,g);
 assert.ok((await q("select quantity from ludus_supply_private.stock where owner_id=$1 and sku='copper_ore'",[bot]))[0].quantity<100);
 await q('update public.ludus_accounts set diamonds=1 where user_id=$1',[bot]);
 await q("insert into public.ludus_stones(owner_id,family,stone_id,quantity) values($1,'emerald',1,1)",[bot]);
 await q('select ludus_bot_private.production_tick_v238(1)');
 assert.equal((await q('select diamonds from public.ludus_accounts where user_id=$1',[bot]))[0].diamonds,0);
 assert.equal((await q("select quantity from public.ludus_stones where owner_id=$1 and family='emerald' and stone_id=1",[bot]))[0].quantity,0);
 await q('update ludus_bot_private.settings_v233 set enabled=false where id');const before=Number((await q('select gold from public.ludus_accounts where user_id=$1',[bot]))[0].gold);
 await q('select ludus_bot_private.production_tick_v238(1)');assert.equal(Number((await q('select gold from public.ludus_accounts where user_id=$1',[bot]))[0].gold),before);
 assert.equal((await q("select has_function_privilege('authenticated','ludus_bot_private.production_tick_v238(integer)','EXECUTE') allowed"))[0].allowed,false);
 console.log('V238 bot production PASS: real market purchase, delivery, recursive crafting, equipment, owned stones and pause.');
};
