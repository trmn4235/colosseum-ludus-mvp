# V229 worker tasks and archery

Worker cards and profiles show the current shopping task and a live return clock.
The clock uses the roster's server time; an overdue trip stays reserved and reads
"Teslimat bekleniyor" until delivery succeeds. Active tasks refresh every 30 seconds
while the panel is open. Refresh pauses while editing a worker name.

Raw-material checkout requires an explicit worker choice. Opening the selection
screen does not submit a purchase. The final button requires exactly one available,
owned worker per caravan and a valid quote. Selection order determines material
remainders and which workers carry the existing bows and arrows. There is no
automatic worker selection. Existing request receipts prevent duplicate purchases.

Archery is a separate skill from the nine material professions:

- Level 1 starts at 0 EXP and 9 base arrow damage.
- Each 100 EXP adds one level and one base damage, capped at level 20 / 28 damage.
- Successfully delivered shopping trips grant 10 EXP to each worker who departed
  with both a bow and ammunition. No EXP is granted merely for starting a trip.
- A blocked warehouse delays training. Replayed requests and repeat settlement
  do not award it again. Existing trips receive no retroactive archery EXP.
- The server freezes worker IDs, levels, damage, armed status and ammunition in
  each new departure record. Clients cannot edit skill EXP or damage.

**Combat scope:** current playable raids target NPC caravans. Player shopping
caravans have no playable defense encounter. V229 adds owned-worker progression,
display and departure snapshots; it does not add actual worker combat, PvP raids,
new attacks or cargo losses, and does not change the NPC combat engine.

Validation: the production PostgreSQL suite exercises real departures, deliveries,
role isolation, replay, warehouse blocking, selection order, zero-ammunition cases,
level progression and the cap. The browser suite covers required checkout choice,
server clock skew, live timers, pending delivery and mobile profile layouts.
