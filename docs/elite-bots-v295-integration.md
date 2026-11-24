# V295 special opponents

V296 updates these opponents and their selection. See [the V296 integration notes](elite-commanders-v296.md) for current names, bonuses and the persisted cycle; the asset-readiness and roster guarantees below still apply.

The single-player Colosseum loads Aegis and Hoplomachus for Solo 20 and Takımlı Arena (4×5). The arena ticket sets the mode. The separate naval route flag excludes Deniz Savaşı even though its ticket also says `4x5`. Survival, Aventinus, ranked and multiplayer retain their existing fighters.

Each verified model can appear once. The module replaces an existing enemy in ID order, preferring different enemy teams when both are available. It excludes the player, allies and owned characters. Fighter IDs, team and class, inventory items, pickup/drop tokens and the total roster size are preserved.

## Source of readiness

`arena.html` starts loading the optional models alongside the ordinary character. `ArenaEliteBotsV295.prepare` reads `assets/armor-v295/source-manifest.json` for eligible tickets. The row must have both `ready` and `rigVerified` set to true and its `outputPath` must match the definition in `arena-elite-bots-v295.js`. The GLB must load with a skin and the named anatomical bones used by arena poses. A missing file, unsupported rig, failed fetch or load exceeding the shared ten-second budget leaves the affected enemy ordinary for that match. No optional GLB is downloaded for a model that has not passed its checks.

The renderer clones the selected GLB and its skeleton. The bot's own armour stays on its skin. The arena attaches the fighter's current weapon and shield to its real hand bones, using the same attack, guard, pickup and throw logic as the other fighters. Hidden generic armour anchors prevent duplicate equipment. The plain fighter still receives the standard anatomy corrections and armour fitting.

## Combat and tests

The bonus is 15% maximum HP and 10% damage. Loadout refresh preserves health percentage and applies the bonus once, including after picking up equipment. The combat instance scales both ordinary damage and V10 projectile damage before existing mitigation and integer rounding.

Run `node --test tests/elite-bots-v295.cjs` to check actual 20-fighter rosters, per-model and failed readiness, mode exclusions, lifecycles, HP and damage. These simulation checks are independent of real-asset tests for deformation, grip, grounding and rendering.
