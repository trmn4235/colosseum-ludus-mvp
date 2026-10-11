# V72 — bot defense and dodge roll

Requested change: slightly stronger bots that can evade attacks, and a real roll instead of the sliding dodge animation.

## Behavior

- Every bot can notice nearby opponents winding up a melee attack, including an opponent other than its selected target. Teammates and attacks outside its visible arc are excluded.
- A normal bot waits 120–240 ms before deciding; easy bots wait 220–370 ms. Each observed swing receives one probability decision, rather than another chance on every frame.
- Bots choose a shield/weapon block or a directional roll according to stamina, weapon and incoming attack. A roll requires a stamina reserve, an open landing area inside the arena, and a separate 1.65–2.30 s normal / 2.60–3.25 s easy evade interval.
- Normal bot base melee damage changes from 14 to 15.5; easy from 10 to 11. Normal recovery cooldown changes from 0.40–0.75 s to 0.28–0.52 s. Normal approach speed changes from 2.2 to 2.45 before class/equipment modifiers.
- Bots close to the actual weapon arc before attacking and retain their melee weapon at close range. Throws and other specials use distance checks.
- The original gliding pose is replaced with Quaternius's authored Roll on the existing game model. The control uses a roll symbol and the accessible label “Yuvarlanarak kaçın”. The player's dodge cost, travel and combat timing are preserved; multiplayer changes are visual only.

## Validation

- 65 Node checks pass across all three embedded combat runtimes: ordinary-attack evasion, finite reaction time, misses, stamina and cooldown limits, actual shield blocks, awareness of other opponents, arena boundary choice, sword approach distance, unchanged player dodge cost/travel, plus existing attack geometry, equipment, knockdown and loot regressions.
- `tests/arena-roll-v72.cjs` renders the real GLB and equipment in Chromium: forward, backward and side rolls show full inversion, continuous head motion, floor clearance and upright recovery, with no page errors. The arena's actual movement is tested separately by the simulation checks.
- Existing `tests/controls-v43.cjs` passes with the actual arena at five landscape viewport sizes and exercises attack/guard pointer interactions. This uses an isolated battle fixture and local assets.
- A seeded 4x5/Solo20 smoke comparison runs six 25-second matches per mode, before/after, including the production item-stat and projectile wrappers. All fighter positions, HP and stamina remain finite and stamina stays nonnegative. The new bots perform more blocks and rolls. These synthetic matches are a regression check, not a human difficulty rating.
- Real iPhone/Safari performance and a live multiplayer match have not been tested in this environment. No database or server combat rules are changed.
