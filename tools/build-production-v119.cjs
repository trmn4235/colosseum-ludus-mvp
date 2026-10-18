// Additive revision: keep historical stock and item identities; expose the active catalog.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),c=require('../ludus-production-v119.js');
const files=fs.readdirSync(root+'/supabase/migrations');
const target=files.find(f=>f.endsWith('_production_items_v119.sql'));
if(!target)throw Error('Create the migration with supabase migration new first.');
const q=v=>"'"+String(v).replaceAll("'","''")+"'",j=v=>q(JSON.stringify(v))+'::jsonb';
const foods=[['grain','Tahıl'],['apple','Elma'],['meat','Et'],['fish','Balık'],['egg','Yumurta'],['beer','Şarap'],['olive_oil','Zeytinyağı']];
const old=fs.readFileSync(root+'/supabase/migrations/'+files.find(f=>f.endsWith('_production_items_v118.sql')),'utf8');
let api=old.slice(old.indexOf('create or replace function ludus_supply_private.api('),old.lastIndexOf("notify pgrst"));
api=api.replace('where not r.food on conflict','where not r.food and r.active on conflict');
api=api.replace('left join public.ludus_food_stock f on f.sku=r.sku and f.owner_id=u;', 'left join public.ludus_food_stock f on f.sku=r.sku and f.owner_id=u where r.active;');
const sql=`-- V119: complete ingots and direct equipment recipes. No inventory/currency resets.
alter table ludus_supply_private.resources add column if not exists active boolean not null default true;
update ludus_supply_private.resources set active=false where sku in(${c.retired.map(q).join(',')});
-- Retired stock is retained for historical receipts; it is never an active ingredient.
update ludus_supply_private.resources set sort_order=sort_order+10000;
insert into ludus_supply_private.resources(sku,name,food,sort_order,stage,active)values
${c.resources.map((r,i)=>` (${q(r.sku)},${q(r.name)},false,${i+1},${q(r.stage)},true)`).concat(foods.map(([sku,name],i)=>` (${q(sku)},${q(name)},true,${101+i},'food',true)`)).join(',\n')}
on conflict(sku)do update set name=excluded.name,food=excluded.food,sort_order=excluded.sort_order,stage=excluded.stage,active=true;
delete from ludus_supply_private.production_recipes_v118 where sku in(${c.retired.map(q).join(',')});
update ludus_supply_private.production_recipes_v118 set sort_order=sort_order+1000;
insert into ludus_supply_private.production_recipes_v118 values
${c.recipes.map((r,i)=>` (${q(r.sku)},${q(r.name)},${q(r.kind)},${r.model?q(r.model):'null'},${j(r.ingredients)},${q(r.output_type)},${r.output_quantity},${i+1})`).join(',\n')}
on conflict(sku)do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,output_type=excluded.output_type,output_quantity=excluded.output_quantity,sort_order=excluded.sort_order;
${c.equipment.map(([sku,name,kind,model,ingredients])=>`insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)values(${q(sku)},${q(name)},${q(kind)},${q(model)},100,${q(kind==='gloves'?'Kolluk / omuzluk':kind==='helmet'?'Miğferler':kind==='weapon'?'Silahlar':kind==='shield'?'Kalkanlar':kind==='chest'?'Zırhlar':'Bacaklıklar')})on conflict(sku)do update set name=excluded.name;\ninsert into ludus_supply_private.recipes(sku,ingredients)values(${q(sku)},${j(ingredients)})on conflict(sku)do update set ingredients=excluded.ingredients;`).join('\n')}
${foods.map(([sku,name])=>`update public.ludus_food_catalog set name=${q(name)} where sku=${q(sku)};`).join('\n')}
${api}
notify pgrst, 'reload schema';
`;
fs.writeFileSync(root+'/supabase/migrations/'+target,sql);
const names=Object.fromEntries([...c.resources.map(r=>[r.sku,r.name]),...foods]);
const all=[...new Map([...c.resources,...c.recipes,...foods.map(([sku,name])=>({sku,name}))].map(r=>[r.sku,r])).values()];
fs.writeFileSync(root+'/assets/items-v119/catalog-audit.json',JSON.stringify({version:119,products:all.map(r=>({sku:r.sku,name:r.name,photo:c.photo(r.sku)})),caravan:{name:'Sürücülü kervan',photo:c.caravanPhoto,craftable:false},retired:c.retired,counts:{raw:c.raw.length,processed:c.processed.length,equipment:c.equipment.length,supplies:c.supplies.length,food:foods.length,recipes:c.recipes.length,products:all.length}},null,2)+'\n');
fs.writeFileSync(root+'/docs/production-v119.md',`# Üretim V119\n\n${all.length} aktif ürün ve ${c.recipes.length} tarif. ${c.raw.length} hammadde, ${c.processed.length} işlenmiş malzeme, ${c.equipment.length+c.supplies.length} nihai ürün ve 7 gıda. Sürücülü kervan ayrı bir seviye ödülüdür.\n\nTüm tarif girdileri pozitif tam sayıdır. Ok 50 adet; diğer bütün tarifler 1 ürün çıkarır. Tek Gladius çelik külçe kullanır. Demir, bakır, kalay, kurşun, bronz ve çelik külçeleri ayrı kayıt, tarif ve görsele sahiptir.\n\nKalkan gövdeleri, ahşap sap, ağ gövdesi ve kurşun ağırlık aktif ürünlerden çıkarıldı. Nihai ürünler doğrudan odun, külçe, deri, ip ve kumaş ile üretilir. Önceki stok ve işlem kimlikleri korunur.\n\nKolluk, iki omuzluktan ayrı bir üründür; mevcut omuzluklar korunur. Secutor ve Thraex miğfer fotoğrafları Roma temasına göre yenilendi.\n\n| Çıktı | Girdiler |\n|---|---|\n${c.recipes.map(r=>`| ${r.output_quantity} ${r.name} | ${Object.entries(r.ingredients).map(([sku,n])=>n+' '+names[sku]).join(' + ')} |`).join('\n')}\n\nFotoğraflar: assets/items-v119/ ve önceki onaylı assets/items-v118/ ile assets/resource-icons-v95/. Yerleşik imagegen ile altı yeni görsel üretildi; önceki üç onaylı görsel yeniden kullanıldı. İstemler prompts.json içinde, bütün aktif ürün-görsel eşleşmeleri catalog-audit.json içinde yer alır.\n`);
console.log(target,c.recipes.length+' recipes, '+all.length+' active product photos.');
