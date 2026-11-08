-- Roman names and stable fleet numbers for the 39 owned bot Luduses.
create or replace function ludus_bot_private.name_v233(p_slot integer) returns text
language sql immutable set search_path='' as $$
 select 'Ludus '||(array['Aquila','Varro','Felix','Drusus','Cassius','Titus','Lucius','Cato','Brutus','Aulus',
  'Flavius','Decimus','Gaius','Quintus','Severus','Nero','Octavius','Rufus','Maximus','Silvanus',
  'Antonius','Marcellus','Tiberius','Valerius','Fabius','Cornelius','Florus','Aurelius','Crispus','Sextus',
  'Scaurus','Paullus','Lentulus','Celsus','Rutilus','Agrippa','Cicero','Sulla','Vespasianus'])[p_slot]||'-'||p_slot;
$$;
update public.ludus_accounts a set ludus_name=ludus_bot_private.name_v233(b.slot)
from ludus_bot_private.members_v233 b where b.user_id=a.user_id and a.ludus_name is distinct from ludus_bot_private.name_v233(b.slot);
