// Deterministic migration and recipe reference from the shared integer catalog.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),c=require('../ludus-production-v118.js');
const quote=v=>"'"+String(v).replaceAll("'","''")+"'",json=v=>quote(JSON.stringify(v))+'::jsonb';
const files=fs.readdirSync(root+'/supabase/migrations');
const target=files.find(f=>f.endsWith('_production_items_v118.sql'));
if(!target)throw Error('Create the migration with supabase migration new first.');
const old=fs.readFileSync(root+'/supabase/migrations/'+files.find(f=>f.endsWith('_caravan_collection_v116.sql')),'utf8');
let api=old.slice(old.indexOf('create or replace function ludus_supply_private.api('),old.indexOf('create or replace function ludus_private.level_claim'));
api=api.replace('recipe ludus_supply_private.recipes;','recipe ludus_supply_private.production_recipes_v118;');
api=api.replace('select * into recipe from ludus_supply_private.recipes where sku=p_key;','select * into recipe from ludus_supply_private.production_recipes_v118 where sku=p_key;');
const previous=`    select * into product from public.ludus_shop_catalog where sku=p_key;
    insert into public.ludus_items(owner_id,kind,model)values(u,product.kind,product.model)returning id into iid;
    answer:=jsonb_build_object('message','Basic +0 ekipman envanterine eklendi.','item_id',iid);`;
if(!api.includes(previous))throw Error('Craft branch changed; review instead of guessing.');
api=api.replace(previous,`    if recipe.output_type='resource' then
     update ludus_supply_private.stock set quantity=quantity+recipe.output_quantity
      where owner_id=u and sku=recipe.sku and quantity+recipe.output_quantity<=50000;
     if not found then raise exception 'Ürün deposu dolu; malzemeler harcanmadı.';end if;
     answer:=jsonb_build_object('message',recipe.output_quantity||' '||recipe.name||' kasaya eklendi.','sku',recipe.sku,'quantity',recipe.output_quantity);
    else
     select * into product from public.ludus_shop_catalog where sku=p_key;
     if not found then raise exception 'Ekipman tanımı bulunamadı.';end if;
     insert into public.ludus_items(owner_id,kind,model)values(u,product.kind,product.model)returning id into iid;
     answer:=jsonb_build_object('message','1 '||recipe.name||' +0 olarak envantere eklendi.','item_id',iid,'sku',recipe.sku,'quantity',1);
    end if;`);
const previousState=` select jsonb_agg(jsonb_build_object('sku',r.sku,'ingredients',r.ingredients,'name',c.name,'kind',c.kind,'model',c.model)order by c.kind,r.sku)
 into crafts from ludus_supply_private.recipes r join public.ludus_shop_catalog c using(sku);`;
if(!api.includes(previousState))throw Error('Recipe state query changed.');
api=api.replace(previousState,` select jsonb_agg(to_jsonb(r)||jsonb_build_object('group',case when r.kind='material' then 'processing' else 'equipment' end)order by r.sort_order)
 into crafts from ludus_supply_private.production_recipes_v118 r;`);
let sql=`-- V118: integer-only production, one steel Gladius and a complete item catalog.
-- Existing stock IDs, equipment instances, receipts and caravan cargo are preserved.
alter table ludus_supply_private.resources add column if not exists stage text not null default 'processed';
update ludus_supply_private.resources set sort_order=sort_order+10000;
insert into ludus_supply_private.resources(sku,name,food,sort_order,stage)values
${c.resources.map((r,i)=>` (${quote(r.sku)},${quote(r.name)},false,${i+1},${quote(r.stage)})`).join(',\n')},
${[['grain','Tahıl'],['apple','Elma'],['meat','Et'],['fish','Balık'],['egg','Yumurta'],['beer','Şarap'],['olive_oil','Zeytinyağı']].map(([sku,name],i)=>` (${quote(sku)},${quote(name)},true,${101+i},'food')`).join(',\n')}
on conflict(sku)do update set name=excluded.name,food=excluded.food,sort_order=excluded.sort_order,stage=excluded.stage;

create or replace function ludus_supply_private.valid_ingredients_v118(p jsonb)
returns boolean language sql immutable strict set search_path='' as $$
 select case when jsonb_typeof(p)<>'object' then false else
  p<>'{}'::jsonb and not exists(select 1 from jsonb_each(p)e where jsonb_typeof(e.value)<>'number' or e.value::text!~'^[1-9][0-9]*$') end
$$;
revoke all on function ludus_supply_private.valid_ingredients_v118(jsonb)from public,anon,authenticated;
create table if not exists ludus_supply_private.production_recipes_v118(
 sku text primary key,name text not null,kind text not null,model text,
 ingredients jsonb not null check(ludus_supply_private.valid_ingredients_v118(ingredients)),
 output_type text not null check(output_type in('equipment','resource')),
 output_quantity integer not null check((sku='arrow' and output_quantity=50)or(sku<>'arrow' and output_quantity=1)),
 sort_order integer not null unique
);
alter table ludus_supply_private.production_recipes_v118 enable row level security;
revoke all on ludus_supply_private.production_recipes_v118 from public,anon,authenticated;
insert into ludus_supply_private.production_recipes_v118 values
${c.recipes.map((r,i)=>` (${quote(r.sku)},${quote(r.name)},${quote(r.kind)},${r.model?quote(r.model):'null'},${json(r.ingredients)},${quote(r.output_type)},${r.output_quantity},${i+1})`).join(',\n')}
on conflict(sku)do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,output_type=excluded.output_type,output_quantity=excluded.output_quantity,sort_order=excluded.sort_order;
${c.equipment.map(([sku,name,kind,model,ingredients])=>`update public.ludus_shop_catalog set name=${quote(name)} where sku=${quote(sku)};\nupdate ludus_supply_private.recipes set ingredients=${json(ingredients)} where sku=${quote(sku)};`).join('\n')}

-- Keep historical sale references, but sell only the nine unprocessed materials.
alter table ludus_supply_private.market_goods_v116 add column if not exists active boolean not null default true;
update ludus_supply_private.market_goods_v116 set active=false,slot=case sku when 'iron' then 100 when 'copper' then 101 when 'leather' then 103 when 'linen' then 104 end where sku in('iron','copper','leather','linen');
update ludus_supply_private.market_goods_v116 set slot=4 where sku='wood';
insert into ludus_supply_private.market_goods_v116(sku,base_price,slot,active)values
${c.raw.map(([sku,name,price],i)=>` (${quote(sku)},${price},${i},true)`).join(',\n')}
on conflict(sku)do update set base_price=excluded.base_price,slot=excluded.slot,active=true;
`;
let offer=old.slice(old.indexOf('create or replace function ludus_supply_private.offer_v116('),old.indexOf('create or replace function public.ludus_caravan_city('));
offer=offer.replace('where sku=p_sku;','where sku=p_sku and active;');
offer=offer.replace('join ludus_supply_private.resources r using(sku);','join ludus_supply_private.resources r using(sku) where g.active;');
sql+='\n'+offer+'\n'+api+'\nnotify pgrst, \'reload schema\';\n';
fs.writeFileSync(root+'/supabase/migrations/'+target,sql);
const names=Object.fromEntries(c.resources.map(r=>[r.sku,r.name]));
const list=c.recipes.map(r=>`| ${r.output_quantity} ${r.name} | ${Object.entries(r.ingredients).map(([k,n])=>n+' '+names[k]).join(' + ')} |`).join('\n');
fs.writeFileSync(root+'/docs/production-v118.md',`# Üretim V118\n\nTüm girdiler pozitif tam sayıdır. Her tarif bir ürün çıkarır; yalnız ok tarifi 50 ok çıkarır. Tek Gladius çelik külçe kullanır. Tuz ve eski işçi aletleri bu katalogda yoktur.\n\n${c.raw.length} hammadde, ${c.processed.length} ara ürün, ${c.equipment.length+c.supplies.length} nihai ürün.\n\n## Hammaddeler\n\n${c.raw.map(r=>'- '+r[1]).join('\n')}\n\n## Tarifler\n\n| Çıktı | Girdiler |\n|---|---|\n${list}\n\nYay ve ok kervan donanımı olarak kasaya girer. Gıda ayrı bölmededir. Kervan sürücüsüyle birlikte seviye ödülüdür.\n\nFotoğraflar: assets/items-v118/ ve korunmuş assets/resource-icons-v95/. Kaynak istemleri assets/items-v118/prompts.json dosyasındadır; yerleşik imagegen kullanılmıştır.\n`);
console.log(target,`${c.resources.length} stock resources; ${c.recipes.length} integer recipes.`);
