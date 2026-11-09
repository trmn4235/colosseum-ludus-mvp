const assert=require('node:assert/strict');
module.exports=async({db,q,users,gs,user,party,match})=>{
 const inbox=async(action='pulse')=>(await q('select public.ludus_ranked_invites_v254($1) r',[action]))[0].r;
 const admin=async(fn)=>{await db.exec('reset role');try{return await fn();}finally{await db.exec('set role authenticated');}};
 const due=()=>admin(()=>q("update ludus_ranked_party_private.incoming_v254 set due_at=clock_timestamp()-interval '1 second',last_seen=clock_timestamp() where user_id=$1",[users[0]]));
 const denied=async(fn,rx)=>{await db.exec('savepoint denied');await assert.rejects(fn,rx);await db.exec('rollback to savepoint denied;release savepoint denied');};
 await db.exec('begin');
 try{
  await user(0);let state=await inbox();assert.equal(state.invites.length,0);assert.ok(state.next_in_ms>=179000&&state.next_in_ms<=180001,'first invite waits three minutes');
  assert.equal((await inbox()).invites.length,0,'repeated requests cannot accelerate the server timer');
  await denied(()=>inbox('send'),/Geçersiz/);
  await due();state=await inbox();assert.equal(state.invites.length,1);
  const first=state.invites[0],firstHost=first.leader;assert.ok(['Ludus 1','Ludus 2','Ludus 3','Ludus 4'].includes(firstHost),'only clan bots send automatic invitations');
  assert.equal((await inbox()).invites[0].id,first.id,'simultaneous/duplicate polls do not create more invitations');
  await user(10);await denied(()=>party('accept',null,gs[10],first.id),/Davet bulunamadı/);assert.equal((await inbox()).invites.length,0,'other players receive no owner invitations');
  await user(0);await party('decline',null,null,first.id);assert.equal((await inbox()).invites.length,0,'swiped invitation stays dismissed');
  assert.equal(await admin(async()=>Number((await q('select count(*) n from ludus_ranked_party_private.hosted_v254'))[0].n)),0,'dismissal frees all four bot slots');
  const names=[firstHost];for(let n=0;n<4;n++){await due();state=await inbox();assert.equal(state.invites.length,1);const i=state.invites[0];assert.notEqual(i.leader,names.at(-1));names.push(i.leader);}
  assert.equal(new Set(names.slice(0,4)).size,4,'every eligible clan member gets a turn before rotation repeats');
  assert.equal(await admin(async()=>Number((await q('select count(*) n from ludus_ranked_party_private.hosted_v254'))[0].n)),1,'expired invitations do not accumulate NPC rooms');
  await party('decline',null,null,state.invites[0].id);
  await inbox('pause');await due();state=await inbox();assert.equal(state.invites.length,0);assert.ok(state.next_in_ms>179000,'returning from lobby or battle starts a fresh three-minute interval');
  await due();await admin(()=>q("update ludus_ranked_party_private.incoming_v254 set last_seen=clock_timestamp()-interval '5 minutes' where user_id=$1",[users[0]]));
  state=await inbox();assert.equal(state.invites.length,0);assert.ok(state.next_in_ms>179000,'offline time does not immediately generate an invitation on login');
  await due();state=await inbox();const invite=state.invites[0];
  state=await party('accept',null,gs[0],invite.id);assert.equal(state.party.members.length,5);assert.equal(state.party.auto_start,true);
  assert.notEqual(state.party.leader,users[0],'the sending clan friend is the actual leader');
  assert.equal(state.party.members.filter(m=>m.ready).length,4,'only the four NPCs are READY before the human chooses READY');
  assert.ok(state.party.members.every(m=>m.appearance.gladiator.id===m.gladiator_id));
  assert.equal((await inbox()).invites.length,0,'no invitations while in a party');
  await denied(()=>party('start'),/READY/);state=await party('ready');assert.equal(state.party.queue.status,'matched','READY alone starts the NPC-led game');
  const mid=state.party.queue.match_id;let battle=await match('state',mid);assert.equal(battle.players.length,10);assert.equal(battle.players.filter(p=>p.bot_v249).length,9);
  assert.equal(battle.players.find(p=>p.owner===users[0]).gladiator.id,gs[0]);assert.equal((await q('select auth.uid() u'))[0].u,users[0],'no JWT/identity impersonation');
  await denied(()=>party('accept',null,gs[0],invite.id),/Maç sırasında/);
  await admin(()=>q("update public.ludus_matches set status='finished' where id=$1",[mid]));await admin(()=>q('select ludus_ranked_match_private.cleanup_match($1)',[mid]));
  state=await party('state');assert.equal(state.party,null,'the automatic room releases every fighter after the game');
  state=await inbox();assert.ok(state.next_in_ms>179000);
  await due();state=await inbox();await party('accept',null,gs[0],state.invites[0].id);await party('leave');
  assert.equal(await admin(async()=>Number((await q('select count(*) n from ludus_ranked_party_private.hosted_v254'))[0].n)),0,'leaving an NPC lobby cleans up the room');
  await inbox();await due();state=await inbox();const changed=state.invites[0];
  await admin(()=>q('delete from public.ludus_clan_members where user_id=$1',[users[0]]));
  await denied(()=>party('accept',null,gs[0],changed.id),/Klan üyeliği/);
  assert.equal((await inbox()).invites.length,0,'clan changes invalidate old automatic invitations');
  await admin(async()=>{for(const name of ['ludus_ranked_party_private.host_owner_v254(uuid)','ludus_ranked_party_private.handle_before_incoming_v254(text,uuid,uuid,uuid)'])assert.equal((await q("select has_function_privilege('authenticated',$1,'execute') allowed",[name]))[0].allowed,false);});
  await q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");await denied(()=>inbox(),/giriş/);
  console.log('PASS V254: three-minute foreground cadence, unique clan hosts, swipe persistence, bounded rooms, four ready bots, READY -> 5v5, cleanup and authorization.');
 }finally{await db.exec('rollback');}
};
