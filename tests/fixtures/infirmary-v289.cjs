const fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.LUDUS_PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'../..');
const migration=name=>fs.readFileSync(path.join(root,'supabase/migrations',fs.readdirSync(path.join(root,'supabase/migrations')).find(f=>f.endsWith('_'+name+'.sql'))),'utf8');
async function database({backend=true}={}){
 const db=new PGlite();await db.waitReady;
 await db.exec(fs.readFileSync(root+'/tests/fixtures/gladiator-v46.sql','utf8'));
 await db.exec(`create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt()to authenticated;
 alter table ludus_accounts add column username text,add column ludus_name text;alter table ludus_gladiators add column market_listing_id uuid;`);
 await db.exec(fs.readFileSync(root+'/ludus-multiplayer-v36.sql','utf8'));
 for(const name of ['gladiator_exercise_v46','targeted_training_v51','dining_food_v55','dining_meals_v56','dining_nutrition_v57','dining_recovery_v58','dining_recovery_balance_v59','combat_food_stamina_v60'])await db.exec(migration(name));
 await db.exec("insert into public.ludus_food_catalog(sku,name,price,edible,sort_order,nutrition)values('olive_oil','Zeytinyağı',12,false,9,0)");
 await db.exec(`create schema ludus_supply_private;
 create table ludus_supply_private.resources(sku text primary key,name text not null,food boolean not null,sort_order integer unique not null,stage text not null,active boolean not null default true);
 create table ludus_supply_private.stock(owner_id uuid references public.ludus_accounts(user_id),sku text references ludus_supply_private.resources(sku),quantity integer not null default 0 check(quantity between 0 and 50000),primary key(owner_id,sku));
 insert into ludus_supply_private.resources values('wood','Odun',false,5,'raw',true),('wool','Yün',false,8,'raw',true),('rope','İp',false,18,'processed',true),('linen','Keten kumaş',false,19,'processed',true),('olive_oil','Zeytinyağı',true,107,'food',true);
 revoke all on schema ludus_supply_private from public,anon,authenticated;revoke all on all tables in schema ludus_supply_private from public,anon,authenticated;
 create schema ludus_staff_private;
 create table ludus_staff_private.papyrus_catalog_v288(content_id text primary key,role_id text,profession text,ordinal smallint,title text,effect_text text,effect jsonb,conditions jsonb,runtime_status text default 'pending_feature',runtime_reason text);
 create table ludus_staff_private.knowledge_v288(owner_id uuid,content_id text,learned_at timestamptz default clock_timestamp(),primary key(owner_id,content_id));
 create view ludus_staff_private.learned_papyrus_v288 as select k.owner_id,c.content_id,c.role_id,c.profession,c.ordinal,c.effect,c.conditions,c.title,k.learned_at from ludus_staff_private.knowledge_v288 k join ludus_staff_private.papyrus_catalog_v288 c using(content_id)where c.runtime_status='active';`);
 const inputs=migration('infirmary_inputs_v289').match(/insert into ludus_supply_private\.resources[\s\S]*?;/i)[0];await db.exec(inputs);
 const catalog=JSON.parse(migration('papyrus_catalog_v288').match(/\$catalog\$([\s\S]*?)\$catalog\$/)[1]);
 for(const c of catalog.filter(c=>c.profession==='doctor'))await db.query('insert into ludus_staff_private.papyrus_catalog_v288(content_id,role_id,profession,ordinal,title,effect_text,effect,conditions)values($1,$2,$3,$4,$5,$6,$7,$8)',[c.content_id,c.role_id,c.profession,c.ordinal,c.title,c.effect_text,JSON.stringify(c.effect),JSON.stringify(c.conditions)]);
 if(backend)await db.exec(migration('infirmary_v289'));
 return db;
}
module.exports={database,migration,root};
