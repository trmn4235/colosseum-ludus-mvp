# V296 commanders and critical feedback

Only single-player Colosseum Solo20 and 4×5 receive special opponents. Victor uses the verified Hoplomachus asset in every eligible match. One enemy slot is replaced by Legatus legionis, then Imperator, then neither, repeating every three new battle tickets. The total roster, teams, classes and loot remain unchanged. The optional-asset loading budget from V295 is retained.

| Fighter | Maximum HP | Damage | Armor | Attack speed | Movement speed |
| --- | --- | --- | --- | --- | --- |
| Victor | ×1.15 | ×1.10 ×1.15 | ×1.15 | ×1.15 | ×1.15 |
| Imperator | ×1.15 | ×1.10 | ×1.15 | ×1.15 | ×1.00 |
| Legatus legionis | ×1.15 | ×1.10 | ×1.25 | ×1.25 | ×1.00 |

Multipliers are relative to the otherwise identical ordinary enemy. HP and the first damage multiplier are the existing V295 bonuses. Armor uses the actual defense factor, so resulting damage reduction still follows the existing mitigation formula. Faster attacks keep their preparation, contact, recoil and cooldown synchronized with their rendered motion. Projectile flight and net immobilization keep their existing durations. Refreshing equipment does not stack the bonuses.

Victor observes incoming wind-up before attempting a stamina-limited sidestep. He can circle a committed or guarding target and attack from behind. Escape routes respect arena bounds and living fighters. Ordinary fighters retain their existing AI.

Legatus uses actor-local black materials for body armor and equipped weapons/shields, including gear pickups. Exposed skin, the actor's hit flash, shared source textures and other fighters' materials are preserved. Imperator uses the original blue asset. No additional GLB or texture download is needed for the black variant.

`ludus_start_battle_v296` delegates equipment, rewards and battle creation to v2 and atomically records `snapshot.elite_v296` with a private per-account counter. A successful new ticket consumes a position, even if later abandoned. Reloads, request retries and finished-ticket replays do not consume positions. Legacy unmarked tickets retain the original blue commander without advancing the cycle. A missing optional asset leaves its enemy ordinary for that match and does not reroll the recorded choice.

Naval starts pass `naval4x5`; the database continues using existing 4×5 reward rules and persists `snapshot.venue = 'naval'`. Naval, pit, survival and multiplayer do not consume commander positions. Persisted venue overrides local hints when resuming across devices. Apply `20261124110448_elite_commander_cycle_v296.sql` before deploying the frontend.

Critical hit events carry their own flag from the existing critical-roll calculation. The existing floating damage label prefixes `C ` only for those events, including projectiles. Later ordinary hits do not inherit it.

Validation includes actual authored-combat simulations in `tests/elite-bots-v296.cjs`, transactional SQL and permission checks in `tests/elite-commander-cycle-sql-v296.cjs`, critical feedback checks in `tests/arena-realism-v114.test.cjs`, rendered commander isolation/gear changes in `tests/elite-browser-v296.cjs`, and persisted naval-route browser coverage. The V217 Chromium/WebKit workflow also renders the commanders. Software-rendered browser results do not measure physical iPhone FPS.
