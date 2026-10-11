# V73: combat stat connections

The audit found that authoritative multiplayer used fixed character values and ignored equipment bonuses. New matches now calculate a server-owned snapshot from the selected database gladiator and owned equipment. Existing rooms retain their original rules; matchmaking does not mix versions.

The snapshot matches the PvE calculation for all seven attributes, legacy profiles, level, enhancement, sapphires and emeralds. Current multiplayer actions use these values for health/stamina, damage and defenses, criticals, penetration, movement/acceleration/turning, attack cadence, regeneration, dodge distance, passive dodge, automatic shield block and weapon parry. Recovery shortens perfect-block stagger and its corresponding action lock. Multiplayer currently has no thrown-weapon action; projectile resistance is calculated and supported by the damage helper but has no online projectile event yet.

PvE fixes, in all three embedded engine copies:

- Block Power refunds stamina for automatic and manual shield blocks through the same calculation.
- Parry works with either weapon hand, including a scissor blade, and requires stamina.
- Zero reflex and zero attack no longer become default values through truthy fallbacks.
- Throw cost is charged before removing equipment can lower the stamina capacity.
- Projectile damage combines the thrown item's bonuses with remaining gear exactly once and restores temporary state afterward.

The multiplayer model and health bars now use authoritative capacities, including values above 100. The progress maximum is set before the value so the browser does not clamp the first update.

Existing bonus caps, Fortitudo slot scaling, roll probability weights, sapphire interpretation, morale and AI tactic behavior are unchanged. They are separate balance/rule decisions from the confirmed connection bugs.

Validation:

- `tests/combat-stats-v73.cjs`: actual embedded engines, 70 SQL/PvE snapshot comparisons, authoritative damage, block/parry/dodge, healing fractions, stamina caps, movement/turn/attack speed, recovery locks, old-room compatibility, command retries, forged stat inputs, room access and private function permissions. Applies the migration twice in isolated PGlite.
- Combat geometry, equipment and knockdown regression tests; food regeneration tests.
- `tests/multiplayer-ui-v36.cjs`: two isolated browser sessions using the real models and local RPCs, with a new first-update health capacity check. This is not a human or production multiplayer playtest.

Deploy the static files and then apply `20261011141358_combat_stats_v73.sql`. The new helper functions are private security-invoker functions with explicit permission revocation; the existing authenticated RPC remains the only entry point. No inventory, currency or existing player records are rewritten by the migration.
