# V295 special opponents: prepared integration

`arena-elite-bots-v295.js` is a standalone, default-off module. It is not included by an HTML page and contains no invented asset path. The Aegis and Hoplomachus source models have not yet been downloaded, processed, rigged or validated by this module. No new appearance is currently rendered.

## Confirmed scope and modes

`savas.html` puts **Takımlı Arena** (`4x5`, four teams of five) and **Solo 20** (`solo20`) in `panel-single`. These map to the requested Solo Team and Solo modes. The same panel also contains Survival and Deniz Savaşı; neither is eligible. At `savas.html`'s start RPC, `naval4x5` becomes ticket mode `4x5`, so the explicit naval route flag is essential. Ranked and multiplayer must never call this feature as single-player.

The module keeps the roster and every fighter ID/team/class/equipment object intact. It selects the first two living enemy bots in ID order, preferring different enemy teams: normally IDs 5 and 10 for `4x5`, IDs 1 and 2 for `solo20`. It adds one Aegis and one Hoplomachus identity. It excludes ID 0, allies, player/owner-marked fighters and malformed duplicate-ID rosters. Both models must be ready; partial readiness adds neither. It does not create or modify inventory, ticket loot or extraction tokens.

## Intended hooks, after verified assets are available

1. Load this script only for the single-player arena, after the final `LudusLoadout` wrappers are installed. Do not alter the shared combat reset or ranked runtime to activate it.
2. `arena.html` `begin()` currently resets combat, applies the player loadout, calls `LudusLoadout.initialize`, and attaches staff effects. After that setup and variant routing, before its `createCharacter` loop, await the real special-character loader **only** for eligible modes and routes.
3. Call the following with an actual renderer-owned readiness function. Do not use a constant `true` in production:

   ```js
   const elites = ArenaEliteBotsV295.attach(combat, ticket, {
     singlePlayer: true,
     naval: navalRequested,
     pit: pitRequested,
     ranked: false,
     loadout: LudusLoadout,
     assetsReady: key => verifiedCharacterAdapter.ready(key)
   });
   ```

4. The model creation path must consult `fighter.eliteBotV295?.key`. It currently passes only `(id, type)` into `ImportedGladiator.create`, which always clones the single `gladiator-mobile-v217.glb` template. Do not merely rename the existing model and report it as the selected asset.
5. `ImportedGladiator.create` assumes the current Mixamo bone map, captures rest poses and calls `ArenaAnatomy.prepare`, `ClassEquipment.equip` and `ArenaEquipmentFit.capture`. A new source requires verified skeleton mapping, skin weights, dimensions, hand grips and ground contact. `ClassEquipment.sync` must avoid duplicate visual armor/weapons while keeping the actual combat loadout and drops coherent. No generic rig adapter is supplied here.
6. Keep the two prepared models and materials cached. Check disposal, both characters together in the 20-fighter scene, mobile geometry/texture budget, locomotion, attack, block, roll and corpse poses before enabling readiness.

## Stat behavior

The module wraps only the supplied combat instance's damage method. Its 1.10 multiplier changes the damage input before the existing V10 weapon, resistance, critical and staff calculations and integer rounding. It does not mutate `attackBonus`, which the existing V10 wrapper compensates using `nativeAttackBonus`. Projectile damage reaches the same method.

The supplied loadout object's `apply` and `refresh` methods gain pass-through wrappers that affect only fighters registered by this module. Maximum HP is recalculated as `round(unboostedMaxHp * 1.15)` on each apply; current HP percentage survives attachment and refresh. Repeated calls do not compound the bonus and dead fighters remain dead. Reinitializing or detaching the battle clears the identity and reverses the bonus, preserving HP percentage. Wrapper installation itself creates no special opponent without readiness and the explicit single-player gate.

## Validation

Run `node --test tests/elite-bots-v295.cjs`. Tests use the shipped arena simulation and actual V10 loadout/damage code without production credentials or a database. They cover mode/route exclusions, both-or-neither asset readiness, exact replacement counts, player/ally/owned-fighter exclusion, immutable equipment references, persistent HP percentage, non-compounding boosts, melee and projectile damage, readiness loss and combat reset.

After visual integration, use `tests/performance-v84.cjs`'s `rigRuntime` helper with the verified files, plus `tests/weapon-motion-v294.cjs`, `tests/locomotion-grip-budget-v292.cjs`, `tests/roll-grounding-v293.cjs` and an actual browser check. These are pending; no claim of successful custom-character rendering is made.
