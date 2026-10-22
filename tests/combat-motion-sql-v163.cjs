const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {fixtureDatabase,players,setMatch,call,A,B}=require('./online-projectiles-v76.cjs');
async function main(){const db=await fixtureDatabase();try{
 await install(db);
 let cases=0;for(const [kind,cost,seconds,travel]of [['duck',18,.65,0],['jump',22,.72,.65],['step',18,.42,1.15],['roll',25,.46,3.45]]){
  const rows=await players(db);rows[1].z=4;await setMatch(db,rows);const r=await call(db,A,'step',{dodge:true,dodge_id:kind,dodge_kind:kind,x:1,z:0});const p=r.players[0];assert.equal(p.dodge_kind,kind);assert.equal(p.stamina,100-cost);assert.equal((Date.parse(p.dodge_until)-Date.parse(p.dodge_at))/1000,seconds);assert.equal((await call(db,A,'step',{dodge:true,dodge_id:kind,dodge_kind:kind,x:1})).players[0].dodge_serial,1);
  const advanced=(await db.query('select private.ludus_advance_combat_v36($1,$2) p',[[p],p.dodge_until])).rows[0].p[0];assert.ok(Math.abs(advanced.x-p.x-travel)<.001,JSON.stringify({kind,x:advanced.x-p.x,travel}));cases++;
 }
 for(const kind of ['duck','jump','step']){const rows=await players(db);rows[0].stamina=17;await setMatch(db,rows);assert.equal((await call(db,A,'step',{dodge:true,dodge_id:'poor',dodge_kind:kind})).players[0].dodge_at,undefined);}
 for(const kind of ['teleport',[],{},99])await assert.rejects(()=>call(db,A,'step',{dodge:true,dodge_id:'bad',dodge_kind:kind}),/Geçersiz/);
 const time='2026-10-22T12:00:00.000Z';let ducks=0;
 for(const [kind,region,expected]of [['duck','head',true],['duck','legs',false],['jump','legs',true],['step','chest',false],['roll','chest',true]]){const duration=kind==='duck'?.65:kind==='jump'?.72:kind==='step'?.42:.46,p={dodge_kind:kind,dodge_at:time,dodge_until:new Date(Date.parse(time)+duration*1000).toISOString()};const at=new Date(Date.parse(time)+duration*.475*1000).toISOString();const result=(await db.query('select private.ludus_evade_avoids_v163($1,$2,$3) v',[p,at,region])).rows[0].v;assert.equal(result,expected,kind+region);ducks++;}
 const rows=await players(db,'spear');rows[1].z=1;await setMatch(db,rows);const strike=(await call(db,A,'step',{attack:true,attack_id:'spear',target:B})).players,at=new Date(Date.parse(strike[0].strike_at)+1).toISOString();const resolved=(await db.query('select private.ludus_resolve_combat_v36($1,$2) p',[strike,at])).rows[0].p;assert.ok(resolved[1].hp<100);assert.ok(resolved[0].recoil_until);assert.deepEqual((await db.query('select private.ludus_resolve_combat_v36($1,$2) p',[resolved,at])).rows[0].p,resolved);
 const grants=(await db.query("select has_function_privilege('authenticated','private.ludus_evade_avoids_v163(jsonb,timestamptz,text)','execute') a,has_function_privilege('anon','public.ludus_match(text,uuid,uuid,jsonb,jsonb)','execute') b")).rows[0];assert.deepEqual(grants,{a:false,b:false});console.log(JSON.stringify({cases,defenseWindows:ducks,stamina:true,inputValidation:true,repeatProtection:true,poleRecoil:true,permissions:true}));
}finally{await db.close();}}
async function install(db){
 await db.exec("create schema ludus_career_private;create schema ludus_supply_private;create table ludus_supply_private.raids_v124(id uuid,owner_id uuid,gladiators uuid[],region text,encounter jsonb,resolved_at timestamptz,team jsonb,started_at timestamptz,ends_at timestamptz);create table ludus_supply_private.raid_counter_v126(owner_id uuid primary key,attempt int);create table ludus_supply_private.raid_regions_v124(id text,choices text[]);");
 const career=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261022150912_participant_careers_v162.sql'),'utf8');
 await db.exec(career.slice(career.indexOf('create function ludus_career_private.number'),career.indexOf('create table')));
 const hit=career.indexOf('create function ludus_career_private.hit');await db.exec(career.slice(hit,career.indexOf('revoke all on function ludus_career_private.hit',hit)));
 const migration=fs.readdirSync(path.join(__dirname,'../supabase/migrations')).find(n=>n.endsWith('_combat_motion_v163.sql'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/migrations',migration),'utf8'));
}
module.exports={install};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
