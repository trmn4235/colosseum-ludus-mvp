const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');

(async()=>{
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;grant usage on schema auth to authenticated,anon;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create table public.ludus_accounts(user_id uuid primary key,username text,ludus_name text);
 create table public.ludus_gladiators(id uuid primary key,owner_id uuid,name text,class text,status text default 'available',fatigue_value numeric default 0,clan_roster_id uuid,injured_until timestamptz,training_ends_at timestamptz,overall numeric default 50);
 create table public.ludus_friends(requester uuid,target uuid,state text);
 create table public.ludus_clan_members(user_id uuid primary key,clan_id uuid);
 create table public.ludus_presence(user_id uuid primary key,last_seen timestamptz);`);
 await db.exec(fs.readFileSync('ranked-party-v244.sql','utf8'));
 const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
 const users=Array.from({length:8},()=>randomUUID()),fighters=users.map(()=>randomUUID()),clan=randomUUID();
 for(let n=0;n<users.length;n++){
  await q('insert into public.ludus_accounts values($1,$2,$3)',[users[n],'user'+n,'Ludus '+n]);
  await q('insert into public.ludus_gladiators(id,owner_id,name,class) values($1,$2,$3,$4)',[fighters[n],users[n],'Gladyatör '+n,'murmillo']);
  await q('insert into public.ludus_presence values($1,clock_timestamp())',[users[n]]);
 }
 await q("insert into public.ludus_friends values($1,$2,'accepted'),($1,$3,'accepted'),($1,$4,'accepted')",[users[0],users[1],users[2],users[3]]);
 await q('insert into public.ludus_clan_members values($1,$4),($2,$4),($3,$4)',[users[0],users[4],users[5],clan]);
 await db.exec('set role authenticated');
 const user=async n=>q("select set_config('request.jwt.claim.sub',$1,false)",[users[n]]);
 const api=async(action,peer=null,gladiator=null,invite=null)=>(await q('select public.ludus_ranked_party_v244($1,$2,$3,$4) s',[action,peer,gladiator,invite]))[0].s;
 await user(0);let s=await api('create',null,fighters[0]);assert.equal(s.party.members.length,1);assert.equal(s.party.members[0].gladiator,'Gladyatör 0');
 assert.deepEqual(s.candidates.map(x=>x.type),['friend','friend','friend','clan','clan']);
 await assert.rejects(()=>api('invite',users[6]),/arkadaşını veya klan üyesini/);
 for(let n=1;n<=4;n++)await api('invite',users[n]);
 assert.equal((await q('select count(*)::int n from ludus_ranked_party_private.invites_v244'))[0].n,0,'sender cannot read recipient rows');
 await assert.rejects(()=>api('invite',users[5]),/boş davet yeri/);
 await user(7);await assert.rejects(()=>api('accept',null,null,randomUUID()),/Davet bulunamadı/);
 for(let n=1;n<=4;n++){
  await user(n);assert.equal((await q('select count(*)::int n from ludus_ranked_party_private.invites_v244'))[0].n,1,'recipient sees only their invitation');const inbox=await api('inbox');assert.equal(inbox.invites.length,1);
  s=await api('accept',null,fighters[n],inbox.invites[0].id);assert.equal(s.party.members.length,n+1);
 }
 await user(1);await assert.rejects(()=>api('invite',users[5]),/takım lideri/);
 await assert.rejects(()=>api('select',null,fighters[2]),/Hazır bir gladyatör/);
 await user(0);s=await api('state');assert.equal(s.party.members.length,5);assert.equal(s.party.members[0].leader,true);
 await api('remove',users[4]);s=await api('invite',users[5]);assert.equal(s.party.members.length,4);
 await user(5);let incoming=await api('inbox');assert.equal(incoming.invites.length,1);await api('decline',null,null,incoming.invites[0].id);
 await user(0);await api('leave');await user(1);s=await api('state');assert.equal(s.party,null);
 await db.exec("reset role;set role anon");await assert.rejects(()=>q("select public.ludus_ranked_party_v244('state',null,null,null)"),/permission denied/);
 await db.close();console.log('V244 PASS: five-person party, four invitations, friends/clan ordering, acceptance, authorization and cleanup.');
})().catch(e=>{console.error(e);process.exitCode=1});
