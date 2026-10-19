from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
old=(root/'supabase/migrations/20261018201255_caravan_loadout_v122.sql').read_text()
def fn(name):
 return re.search(r'create or replace function '+re.escape(name)+r'\([^;]+?\$\$[\s\S]+?\$\$;',old).group()
api=fn('ludus_supply_private.api').replace('qty>p_workers*15','qty>p_workers*60').replace('en fazla 15 birim','en fazla 60 birim').replace("'caravan_capacity',15","'caravan_capacity',60")
# Destinations are updated once below; existing in-flight cargo remains untouched.
api=api.replace('j.cargo,j.loadout,j.claimed_at','j.cargo,j.loadout,j.escort,j.escort_team,j.claimed_at')
api=api.replace("'resources',items", "'escort_gladiators',ludus_supply_private.fighters_v126(),'resources',items")
settle=fn('ludus_supply_private.settle_owner_v87')
settle=settle.replace('  select exists(', '  perform ludus_supply_private.escort_release_v126(j.id);\n  select exists(')
api=api.replace("update ludus_supply_private.jobs set claimed_at=ts", "perform ludus_supply_private.escort_release_v126(job.id);\n     update ludus_supply_private.jobs set claimed_at=ts")
p=root/'supabase/migrations/20261019134742_caravan_combat_v126.sql'
base=(root/'scripts/caravan-schema-v126.sql').read_text()
hunt=fn('ludus_supply_private.hunt_v122')
hunt=hunt.replace("p_gladiators is null or cardinality(p_gladiators)<>2 or p_gladiators[1]is null or p_gladiators[2]is null or p_gladiators[1]=p_gladiators[2]", "not ludus_supply_private.valid_team_v126(p_gladiators)").replace('if n<>2 then','if n<>cardinality(p_gladiators) then').replace('İki farklı','2–5 farklı').replace('Seçilen iki gladyatör','Seçilen gladyatörler')
p.write_text(base+'\n'+settle+'\n'+api+'\n'+hunt+'\n'+(root/'scripts/caravan-api-v126.sql').read_text())
