# V75 — Consistent Fortitudo and recovery effects

Fortitudo's flat physical-power points previously entered the striking weapon's
natural-power multiplier when socketed into that weapon. The same stone in armor
was additive. V75 separates the striking item's natural power (enhancement and
sapphire included) from its emerald contribution. Every Fortitudo now enters the
same additive equipment-power pool, capped at 50 together with other equipment
power. The striking item's natural power still supplies its own multiplier.

For example, a base-power-7 weapon with 100% Fortitudo previously changed the
weapon multiplier from 1 to 2. It now adds 7/50 = 0.14 to the attack bonus, just
like the same stone in another slot. This intentionally reduces the outsized
weapon-socket bonus. A 100% physical-power sapphire still doubles natural weapon
power. Inventory, stones, percentages, costs and drop odds are not rewritten.

Recovery now scales duration once at the start of hurt, heavy-hit knockdown,
shield knockdown, normal block/parry recoil and perfect-block stagger. Shield
knockdown animation duration, stun expiry and knockdown expiry use the same
shortened duration. At 30% recovery, duration is divided by 1.3. The old extra
timer increment is removed for the states now handled through duration to avoid
double application. Active net restraint and whip pulls are not recovery states.

The authoritative resolver also shortens ordinary block/parry recoil and its
corresponding cooldown. Only V75 matches receive the new Fortitudo/recoil rules;
running V73/V74 matches retain their earlier semantics. New matchmaking queues
exclude the older versions. Existing function permissions remain intact.

Validation:

- `tests/combat-stats-v75.cjs`: 36 same-stone slot comparisons across three real
  embedded engines, both weapon hands, real PostgreSQL damage, and thrown-item
  damage parity; natural weapon scaling; old-room damage compatibility.
- 60 recovery checks: zero/partial/capped/excess bonus, normal/perfect recoil,
  hurt/heavy-hit knockdown, synchronized shield-knockdown animation and action
  unlock; actual SQL resolver checks for block/parry/perfect in old/new rooms.
- Existing V73 suite: 70 stat snapshots, access control, client-forged stats,
  command retries, match version separation and repeatable migrations.
- 61 combat geometry, equipment, movement and bot-defense regression tests.

Remaining audit priorities:

1. Define morale's gameplay role and whether tactics should also drive bot
   decisions beyond its current attack/defense contribution.
2. Online thrown-weapon action; projectile resistance has no online throw event.
3. Passive evade presentation (the chance works, but is not an animated roll).
4. Reconcile source-document probability totals and sapphire wording before any
   economy change. The UI already exposes actual probabilities and formulas.
