# Combat motion V163

The original gladiator uses 26 downloaded free clips for combat and evasion. Kevin Iglesias supplies polearm/one-handed/shield attacks; Quaternius supplies guard, reactions, jumping, crouching, punching and throwing; KayKit supplies directional steps, stabbing/chopping and bow handling. Credits and rebuild commands are in `ANIMATION_ASSETS.md`.

## Gameplay

- L / KAÇIN: directional short step, or backward with no direction; 18 stamina.
- C / EĞİL: duck for 0.65 seconds; 18 stamina. Head/chest targets lower with the body, legs remain vulnerable.
- V / ZIPLA: jump and land in 0.72 seconds; 22 stamina. Its vertical hit geometry follows the airborne part of the motion.
- B / YUVARLAN: existing 25-stamina roll. It retains its existing roll animation and rules.
- Inputs cannot interrupt another action or bypass stamina, incapacitation or the evasion recovery gate. Bots choose steps/duck/jump after their existing reaction delay.
- Spear/trident grip changes with available space. The full shaft moves behind the grip, alongside the body. Damage comes from the tip, and a landed thrust returns into recoil instead of continuing through the opponent.
- Regional attacks, equipment IK, shield impact rotation, foot planting and shared flexible weapon geometry remain active. Shortening a weapon model is never used to hide penetration.
- Caravan archers release the arrow after the draw, then play the release clip.

## Server compatibility

New caravan encounters use server-owned rules 163 and support six-integer packets with the new action flags. Rules 126 and 127 are retained byte-for-byte and still replay unchanged. The verifier chooses the protocol from the stored ticket, authenticates ownership, derives the outcome and career statistics, and uses the existing idempotent settlement.

Multiplayer validates step/duck/jump/roll costs and durations in PostgreSQL. Duck/jump avoid attacks only during the matching height window; stepping has no blanket invulnerability. Missing action kind retains the legacy roll for cached clients. Existing match ownership, grants, reward handling and V162 career accounting are preserved.

## Validation

- 95 existing combat/timing/defense tests passed.
- 2,262 real-rig samples cover six weapon types, both hands and head/chest/legs. Maximum measured held-tip/contact mismatch: 3.14 cm; all bone quaternions finite and feet above the floor tolerance.
- 20 attack/foot tests across arena, preparation, multiplayer and caravan renderers: maximum grip error 0.19 cm; maximum planted-foot error 1.88 cm.
- 24 spear/trident cases at 0.82–3 m and 30/60 simulation Hz check range limits, close hits and out-of-range misses. A crowded 0.82 m stab may miss; it does not grant shaft damage.
- Full old 126/127 replays match their pre-change results and fighter state. New replay matches outcome, fighter state and individual career totals. Malformed commands and client-selected protocol overrides are rejected.
- PostgreSQL tests cover all four action costs/travel lengths, insufficient stamina, invalid action kinds, repeated requests, defense windows, polearm recoil and private function permissions.
- Headless Chromium uses the real arena and models, tests touch input and six layout/viewport combinations. Two isolated online sessions exercise the actual PostgreSQL RPC.
- CPU-only scene-graph measurements: twelve characters take about 9.1 ms per attack pose frame in this environment. The browser scene still has twenty bodies/skeletons and 222 draw calls. These are not physical-device FPS measurements.

Physical iPhone/Android and Safari testing was not available in this environment. The work does not claim a newly sourced dedicated whip, net or scissor pack; those use adapted body motion plus existing equipment simulation.
