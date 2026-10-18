const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),c=require('../ludus-production-v119.js');
const quote=v=>"'"+String(v).replaceAll("'","''")+"'",json=v=>quote(JSON.stringify(v))+'::jsonb';
const files=fs.readdirSync(root+'/supabase/migrations');
const previous=fs.readFileSync(root+'/supabase/migrations/'+files.find(f=>f.endsWith('_production_items_v118.sql')),'utf8');
let api=previous.match(/create or replace function ludus_supply_private\.api\([\s\S]+?end;\$\$;/)[0];
function replaceOnce(a,b){if(!api.includes(a))throw Error('API template changed: '+a);api=api.replace(a,b);}
replaceOnce('resources r where not r.food on conflict','resources r where not r.food and r.active on conflict');
replaceOnce('production_recipes_v118 where sku=p_key;','production_recipes_v118 where sku=p_key and active;');
replaceOnce('left join public.ludus_food_stock f on f.sku=r.sku and f.owner_id=u;','left join public.ludus_food_stock f on f.sku=r.sku and f.owner_id=u where r.active;');
replaceOnce('into crafts from ludus_supply_private.production_recipes_v118 r;','into crafts from ludus_supply_private.production_recipes_v118 r where r.active;');
replaceOnce("return jsonb_build_object('user_id',u,'server_now',ts,","return jsonb_build_object('catalog_version',119,'user_id',u,'server_now',ts,");
const retired=c.retired.map(quote).join(',');
const refunds=`select s.owner_id,v.sku,sum(s.quantity*v.factor)::integer quantity
 from ludus_supply_private.stock s join (values
 ('wooden_handle','wood',1),('wooden_handle','resin',1),
 ('shield_frame_small','wood',3),('shield_frame_small','resin',1),
 ('shield_frame_large','wood',6),('shield_frame_large','resin',2),
 ('lead_weight','lead',1),('net_mesh','rope',3)
 )v(old_sku,sku,factor)on v.old_sku=s.sku where s.quantity>0 group by s.owner_id,v.sku`;
const foods=[['grain','Tahıl'],['apple','Elma'],['meat','Et'],['fish','Balık'],['egg','Yumurta'],['beer','Şarap'],['olive_oil','Zeytinyağı']];
const sql=`-- V119: reuse approved photos; base materials -> finished equipment in one craft.
-- Legacy part rows, item identities, receipts and cargo remain intact.
lock table ludus_supply_private.stock in share row exclusive mode;
alter table ludus_supply_private.resources add column if not exists active boolean not null default true;
alter table ludus_supply_private.production_recipes_v118 add column if not exists active boolean not null default true;
update ludus_supply_private.resources set sort_order=sort_order+100000;
update ludus_supply_private.production_recipes_v118 set sort_order=sort_order+100000;
update ludus_supply_private.resources set active=false,stage='retired' where sku in(${retired});
update ludus_supply_private.production_recipes_v118 set active=false where sku in(${retired});
insert into ludus_supply_private.resources(sku,name,food,sort_order,stage,active)values
${c.resources.map((r,i)=>` (${quote(r.sku)},${quote(r.name)},false,${i+1},${quote(r.stage)},true)`).join(',\n')},
${foods.map(([sku,name],i)=>` (${quote(sku)},${quote(name)},true,${101+i},'food',true)`).join(',\n')}
on conflict(sku)do update set name=excluded.name,food=excluded.food,sort_order=excluded.sort_order,stage=excluded.stage,active=true;
insert into public.ludus_shop_catalog(sku,name,kind,model,price,category)
values('bracers','Kolluk','gloves','starter',100,'Kolluk')
on conflict(sku)do update set name=excluded.name,kind=excluded.kind,model=excluded.model,category=excluded.category;
insert into ludus_supply_private.production_recipes_v118(sku,name,kind,model,ingredients,output_type,output_quantity,sort_order,active)values
${c.recipes.map((r,i)=>` (${quote(r.sku)},${quote(r.name)},${quote(r.kind)},${r.model?quote(r.model):'null'},${json(r.ingredients)},${quote(r.output_type)},${r.output_quantity},${i+1},true)`).join(',\n')}
on conflict(sku)do update set name=excluded.name,kind=excluded.kind,model=excluded.model,ingredients=excluded.ingredients,output_type=excluded.output_type,output_quantity=excluded.output_quantity,sort_order=excluded.sort_order,active=true;
${c.retired.map((sku,i)=>`update ludus_supply_private.resources set sort_order=${-i-1} where sku=${quote(sku)};\nupdate ludus_supply_private.production_recipes_v118 set sort_order=${-i-1} where sku=${quote(sku)};`).join('\n')}
${c.equipment.map(([sku,name,kind,model,ingredients])=>`update public.ludus_shop_catalog set name=${quote(name)} where sku=${quote(sku)};\ninsert into ludus_supply_private.recipes(sku,ingredients)values(${quote(sku)},${json(ingredients)})on conflict(sku)do update set ingredients=excluded.ingredients;`).join('\n')}
update public.ludus_food_catalog set name='Et' where sku='meat';

-- Refund legacy part stock once, preserving its exact base-material value.
do $$begin
 if exists(with refund as(${refunds})select 1 from refund f left join ludus_supply_private.stock s on s.owner_id=f.owner_id and s.sku=f.sku where coalesce(s.quantity,0)+f.quantity>50000)then
  raise exception 'Eski parça dönüşümü için malzeme deposunda yer gerekiyor; stoklar değiştirilmedi.';
 end if;
end;$$;
with refund as(${refunds})
insert into ludus_supply_private.stock(owner_id,sku,quantity)select owner_id,sku,quantity from refund
on conflict(owner_id,sku)do update set quantity=ludus_supply_private.stock.quantity+excluded.quantity;
update ludus_supply_private.stock set quantity=0 where sku in(${retired})and quantity>0;

${api}

notify pgrst,'reload schema';
`;
const out=process.argv[2]||'/tmp/production-v119.sql';fs.writeFileSync(out,sql);
const names=Object.fromEntries(c.resources.map(r=>[r.sku,r.name]));
fs.writeFileSync(root+'/docs/production-v119.md',`# Üretim V119\n\n9 hammadde, 11 temel işlenmiş malzeme, 20 savaş ekipmanı ve 2 kervan donanımı. Yedi aktif gıda ile toplam 49 aktif ürün.\n\nKülçe, deri, ip ve kumaş temel malzemedir. Hazır ekipmanlar tek üretim işlemiyle yapılır; ayrı sap, kalkan gövdesi, ağ gövdesi veya kurşun ağırlık üretilmez. Eski parça stokları eşdeğer temel malzemelere bir kez dönüştürülür.\n\nHer çıktı 1 envanter ürünüdür; ok tarifi 50 ok verir. Kolluk ve bacaklık görselleri bir ekipman takımını gösterir. Tuz yoktur. Tek Gladius çelikten üretilir.\n\n| Ürün | Girdiler |\n|---|---|\n${c.recipes.map(r=>`| ${r.output_quantity} ${r.name} | ${Object.entries(r.ingredients).map(([sku,n])=>n+' '+names[sku]).join(' + ')} |`).join('\n')}\n\n## Görseller\n\nKullanılan 39 üretim görseli ve 7 gıda görseli önceki onaylı dosyalardan alınmıştır. Yeni kalay külçe, kurşun külçe ve kolluk fotoğrafları assets/items-v119/ dizinindedir. Emekli parça görselleri aktif katalogda kullanılmaz.\n`);
console.log(out,`${c.resources.length} active stock resources; ${c.recipes.length} active recipes; ${new Set([...c.resources,...c.recipes].map(r=>r.sku)).size} production products.`);
