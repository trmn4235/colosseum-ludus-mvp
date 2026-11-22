-- V289: medical inputs use the existing personal warehouse and licensed
-- collection/purchase paths. No inventory grant or reset is performed.
-- Fig and honey here are production inputs; daily-menu food choices stay separate.
insert into ludus_supply_private.resources(sku,name,food,sort_order,stage,active)values
 ('beeswax','Balmumu',false,201,'raw',true),
 ('laurel','Defne',false,202,'raw',true),
 ('honey','Bal',false,203,'raw',true),
 ('fig','İncir',false,204,'raw',true),
 ('wine_vinegar','Şarap sirkesi',false,205,'raw',true),
 ('sponge','Doğal sünger',false,206,'raw',true);

insert into ludus_worker_private.professions_v227(sku,name,sort_order)values
 ('beeswax','Balmumu toplama',17),('laurel','Defne toplama',18),
 ('honey','Bal toplama',19),('fig','İncir yetiştiriciliği',20),
 ('wine_vinegar','Sirke üretimi',21),('sponge','Sünger toplama',22);

insert into ludus_supply_private.market_goods_v116(sku,base_price,slot,active)values
 ('beeswax',2,16,true),('laurel',1,17,true),('honey',3,18,true),
 ('fig',2,19,true),('wine_vinegar',1,20,true),('sponge',2,21,true);

-- Existing roster/collection APIs insert per-worker skill records lazily.
-- Collection remains 6 hours, 20% tax and 8–24 net units per qualified worker;
-- shopping remains 3 hours and 10 units per caravan, with frozen receipts.
notify pgrst,'reload schema';
