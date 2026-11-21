const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const{PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',I='00000000-0000-4000-8000-000000000011',J='00000000-0000-4000-8000-000000000012';
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema ludus_staff_private;
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create table public.ludus_accounts(user_id uuid primary key,diamonds integer default 10000);
 create table public.ludus_items(id uuid primary key,owner_id uuid,enhancement integer default 0,certus_used boolean default false,locked_battle_id uuid,stat_version integer default 10,natural_stats jsonb default '{"attack":10}',natural_percentages jsonb default '{"attack":10}',emeralds jsonb default '[]');
 create table public.ludus_upgrade_receipts(owner_id uuid,request_id uuid,item_id uuid,action text,stone_id integer,result jsonb,created_at timestamptz default now(),primary key(owner_id,request_id));
 create table public.ludus_stones(owner_id uuid,family text,stone_id integer,quantity integer,primary key(owner_id,family,stone_id));
 create table public.ludus_stone_catalog(family text,stone_id integer,effect_key text);
 create table ludus_staff_private.papyrus_catalog_v288(role_id text,ordinal integer,runtime_status text,runtime_reason text);
 create table ludus_staff_private.learned_papyrus_v288(owner_id uuid,content_id text,role_id text,ordinal integer,title text,effect jsonb);
 insert into public.ludus_stone_catalog values('sapphire',1,'attack'),('sapphire',2,'defense'),('emerald',1,'health'),('emerald',2,'health'),('emerald',3,'health'),('emerald',4,'health'),('emerald',5,'health');`);
 const q=async(sql,args=[])=>(await db.query(sql,args)).rows;
 await q('insert into ludus_accounts(user_id)values($1),($2)',[A,B]);await q('insert into ludus_items(id,owner_id)values($1,$2),($3,$2)',[I,A,J]);
 for(const fam of ['ruby','sapphire','emerald'])for(let n=1;n<=5;n++)await q('insert into ludus_stones values($1,$2,$3,10000)',[A,fam,n]);
 await db.exec(fs.readFileSync(root+'/supabase/migrations/20261121230000_smith_effects_v288.sql','utf8'));
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);
 const preview=async(action='enhance',stone=null,item=I)=>(await q('select public.ludus_smith_preview_v288($1,$2,$3) s',[item,action,stone]))[0].s;
 const upgrade=async(action='enhance',stone=null,item=I,request=randomUUID())=>(await q('select public.ludus_upgrade_item_v10($1,$2,$3,$4) s',[item,action,stone,request]))[0].s;
 const approx=(a,b)=>assert(Math.abs(a-b)<1e-11,`${a} != ${b}`);
 const learn=async(n)=>q("insert into ludus_staff_private.learned_papyrus_v288 values($1,$2,'smith',$3,$4,$5)",[A,'blacksmith_general_'+String(n).padStart(3,'0'),n,'Öğrenim '+n,JSON.stringify({value:[7,9,12,14,16,20,22,24].includes(n)?.004:.002})]);
 const series=async(action,n,low,last)=>q(`insert into ludus_staff_private.smith_series_v288(owner_id,item_id,family,completed,low_streak,last_success,last_request)values($1,$2,$3,$4,$5,$6,$7)on conflict(owner_id)do update set item_id=excluded.item_id,family=excluded.family,completed=excluded.completed,low_streak=excluded.low_streak,last_success=excluded.last_success`,[A,I,action,n,low,last,randomUUID()]);
 approx((await preview()).chance,.7);
 // Each of the 25 knowledge entries is independently exercised on the server.
 for(let n=1;n<=25;n++){
  await db.exec('delete from ludus_staff_private.learned_papyrus_v288;delete from ludus_staff_private.smith_series_v288;');
  await q("update ludus_items set enhancement=0,certus_used=false,natural_percentages='{\"attack\":10}',emeralds='[]' where id=$1",[I]);
  await learn(n);const action=n<=9?'enhance':n<=17?'sapphire':'emerald';
  if([3,15,23].includes(n))await q('update ludus_items set enhancement=5 where id=$1',[I]);
  if([4,16,24].includes(n))await q('update ludus_items set enhancement=9 where id=$1',[I]);
  if(n===5)await series(action,1,0,true);
  if([6,11,19].includes(n))await series(action,2,0,true);
  if([7,12,20].includes(n))await series(action,4,0,true);
  if([8,13,21].includes(n))await series(action,1,1,false);
  if([9,14,22].includes(n))await series(action,2,2,false);
  if(n===17)await q(`update ludus_items set emeralds='[{"id":1,"value":95}]' where id=$1`,[I]);
  if(n===25)await q(`update ludus_items set natural_percentages='{"attack":95}' where id=$1`,[I]);
  const s=await preview(action,action==='enhance'?null:1);approx(s.bonus,[7,9,12,14,16,20,22,24].includes(n)?.004:.002);assert.equal(s.applied[0].id,'blacksmith_general_'+String(n).padStart(3,'0'));
  // Other physical items cannot inherit a series, socket, or level condition.
  if(![1,2,10,18].includes(n))approx((await preview(action,action==='enhance'?null:1,J)).bonus,0);
 }
 await db.exec('delete from ludus_staff_private.learned_papyrus_v288;delete from ludus_staff_private.smith_series_v288');for(let n=1;n<=25;n++)await learn(n);
 await q('update ludus_items set enhancement=0 where id=$1',[I]);await series('enhance',4,2,false);
 let s=await preview();approx(s.bonus,.006);assert.equal(s.applied.length,2,'eligible conditional bonuses do not stack');
 await q('update ludus_items set enhancement=10 where id=$1',[I]);s=await preview('enhance',4);approx(s.chance,1);approx(s.effective_bonus,0);assert.equal(s.guaranteed,true);
 s=await preview('enhance',1);approx(s.chance,.326);
 for(const bonus of [0,.002,.004,.006]){
  const dist=(await q('select ludus_staff_private.smith_quality_distribution_v288($1) d',[bonus]))[0].d;
  approx(dist.reduce((a,x)=>a+x.probability,0),1);approx(dist.filter(x=>x.value>=95).reduce((a,x)=>a+x.probability,0),.6/365.6+bonus);approx(dist[1].probability/dist[0].probability,5);approx(dist[13].probability/dist[12].probability,90/75);
  let cumulative=0;for(const x of dist){const mid=cumulative+x.probability/2;assert.equal((await q('select ludus_staff_private.smith_quality_roll_v288($1,$2) n',[bonus,mid]))[0].n,x.value);cumulative+=x.probability;}
 }
 // Find reproducible RNG draws inside the newly added chance interval.
 const seedFor=async(lo,hi)=>{for(let i=1;i<10000;i++){const seed=i/10000;await q('select setseed($1)',[seed]);const r=(await q('select random() r'))[0].r;if(r>lo&&r<hi)return seed;}throw Error('seed not found');};
 await db.exec('delete from ludus_staff_private.smith_series_v288');await q('update ludus_items set enhancement=0,certus_used=false where id=$1',[I]);
 const seed=await seedFor(.7,.704);await q('select setseed($1)',[seed]);const request=randomUUID();s=await upgrade('enhance',null,I,request);assert.equal(s.success,true,'new bonus must alter actual roll outcome');approx(s.chance,.704);assert.equal(s.smith.series.completed,0);
 const diamonds=(await q('select diamonds from ludus_accounts where user_id=$1',[A]))[0].diamonds;
 assert.deepEqual(await upgrade('enhance',null,I,request),s);assert.equal((await q('select diamonds from ludus_accounts where user_id=$1',[A]))[0].diamonds,diamonds);assert.equal((await preview()).series.completed,1);
 await assert.rejects(()=>upgrade('enhance',null,J,request),/başka istekte/);
 await assert.rejects(()=>upgrade('sapphire',2),/grubuna uygun/);assert.equal((await preview()).series.completed,1);
 const qualitySeed=await seedFor(.6/365.6,.6/365.6+.002);await q('select setseed($1)',[qualitySeed]);s=await upgrade('sapphire',1);assert(s.percentage>=95,'gem bonus must alter actual quality result');assert.equal(s.smith.series.completed,0,'completed family switch starts a new series');
 assert.equal((await preview('sapphire',1)).series.low_streak,0);assert.equal((await preview('sapphire',1)).series.completed,1);
 const lowSeed=await seedFor(.05,.9);for(let n=0;n<2;n++){await q('select setseed($1)',[lowSeed]);await upgrade('sapphire',1);}
 s=await preview('sapphire',1);assert.equal(s.series.completed,3);assert.equal(s.series.low_streak,2);approx(s.bonus,.006);
 await q("select set_config('request.jwt.claim.sub',$1,false)",[B]);await db.exec('set role authenticated');await assert.rejects(()=>preview(),/Eşya bulunamadı/);await assert.rejects(()=>upgrade(),/Eşya bulunamadı/);await assert.rejects(()=>db.exec('select * from ludus_staff_private.smith_series_v288'),/permission denied/);await db.exec('reset role');
 await q("select set_config('request.jwt.claim.sub',$1,false)",[A]);await db.exec('set role authenticated');await preview('sapphire',1);await db.exec('reset role');
 await q("select set_config('request.jwt.claims','{\"is_anonymous\":true}',false)");await assert.rejects(()=>preview(),/Giriş/);await q("select set_config('request.jwt.claims','{}',false)");
 await q('update ludus_items set enhancement=10,certus_used=false where id=$1',[I]);const before=(await q("select quantity from ludus_stones where owner_id=$1 and family='ruby' and stone_id=4",[A]))[0].quantity;
 s=await upgrade('enhance',4);assert.equal(s.success,true);assert.equal(s.plus,11);assert.equal(s.item.certus_used,true);assert.equal((await q("select quantity from ludus_stones where owner_id=$1 and family='ruby' and stone_id=4",[A]))[0].quantity,before-1);await assert.rejects(()=>upgrade('enhance',4),/CERTUS/);
 // Rejected costs and invalid socket changes leave both the series and resources untouched.
 await q('update ludus_accounts set diamonds=0 where user_id=$1',[A]);const rejectedSeries=(await preview()).series;
 await assert.rejects(()=>upgrade(),/Elmas yetersiz/);assert.deepEqual((await preview()).series,rejectedSeries);await q('update ludus_accounts set diamonds=100 where user_id=$1',[A]);
 await q(`update ludus_items set emeralds='[{"id":1,"value":10},{"id":2,"value":10},{"id":3,"value":10},{"id":4,"value":10}]' where id=$1`,[I]);await assert.rejects(()=>upgrade('emerald',5),/yuvası dolu/);
 const explodingSeed=async()=>{for(let n=1;n<10000;n++){let seed=n/10000;await q('select setseed($1)',[seed]);const r=(await q('select random() first_roll,random() second_roll'))[0];if(r.first_roll>.8&&r.second_roll<.13)return seed;}throw Error('explosion seed not found');};
 const badSeed=await explodingSeed();
 for(const ruby of [2,3]){
  await q('update ludus_items set enhancement=6,certus_used=false where id=$1',[I]);
  const stock=(await q("select quantity from ludus_stones where owner_id=$1 and family='ruby' and stone_id=$2",[A,ruby]))[0].quantity;
  await q('select setseed($1)',[badSeed]);s=await upgrade('enhance',ruby);assert.equal(s.success,false);assert.equal(s.exploded,true);assert.equal(s.destroyed,false);assert.equal(s.plus,ruby===2?6:4);assert.equal((await q("select quantity from ludus_stones where owner_id=$1 and family='ruby' and stone_id=$2",[A,ruby]))[0].quantity,stock-1);
 }
 await q('update ludus_items set enhancement=6 where id=$1',[J]);await q('select setseed($1)',[badSeed]);const destroyedRequest=randomUUID();s=await upgrade('enhance',null,J,destroyedRequest);assert.equal(s.destroyed,true);assert.equal(s.smith.series.completed,0,'another physical item resets series');assert.deepEqual(await upgrade('enhance',null,J,destroyedRequest),s,'destroyed item request still replays');
 assert.equal((await preview()).series.completed,0,'switching back starts a new physical item series');
 console.log('PASS V288 smith: all 25 conditions, highest-only cap, actual enhancement and quality RNG, complete quality mass/ratios, persistent family/item series, retry-safe receipts, rollback on invalid attempt, owner isolation, private state, CERTUS preserved.');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
