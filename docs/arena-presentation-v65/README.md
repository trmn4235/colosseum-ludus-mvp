# Arena presentation V65

Presentation-only changes on top of V64 (`a6f530d3e6db26b488e06dc2ad6dd6033a04b0c3`). No SQL migration, new model, or texture download.

## What changed

- Periodic cubic gait curves replace eight straight-line segments. Forward, backward and lateral steps follow actual rendered velocity; walking, running, braking and turning blend without restarting their phase.
- Armed locomotion keeps softer elbows and adds restrained torso counterbalance. Guard is an upper-body layer: walking legs are no longer overwritten by the full-body defense clip.
- Shields and unshielded region guards blend into and out of their contact positions. Interrupted raise/release and switching guard region reuse the current hand pose.
- Strike anticipation starts at the previous rendered hand. Release returns to the locomotion arm over 140 ms. Active contact still uses the exact existing `ArenaMotion` sample and sweep; recovery curves and hit windows are unchanged.
- The 60 Hz combat simulation is unchanged. Display frames interpolate its prior/current transforms, including shortest-path heading. Distant roots continue moving on every display frame while pose cadence keeps its fractional remainder.
- Conservative offscreen culling, settled-corpse pose caching and cached shadow updates avoid redundant rig work. Death is captured even offscreen. Removed a second equipment synchronization that could erase corpse equipment after the death renderer restored it.
- Up to three active enemy labels follow the camera every display frame. Hidden labels are not projected, and unchanged team scores do not reconstruct DOM nodes.
- Multiplayer uses the same integer framebuffer dimensions as Three.js. The old round-vs-floor mismatch caused a drawing-buffer resize on every frame at fractional DPR. Hidden/context-lost/disposed pages stop rendering; snapshot timestamps and attack profiles are cached without changing RPC authority.

## Balance and scope

`combat-integrity.json` records SHA-256 hashes of the unchanged combat engine blocks in all three pages. Stamina cost, damage, collision sweeps, hit windows, reward/account state, the V60 35% regeneration reduction and 4/8/12% food bonuses remain unchanged. Idle recovery stays +10 energy/hour. Courtyard and rest-room files are unchanged.

## Checks

Focused Node checks:

```sh
node --test tests/arena-frame-v65.test.cjs tests/arena-presentation-v65.test.cjs tests/multiplayer-frame-pacing.test.cjs tests/combat-feel-v23.test.cjs tests/movement-v39.test.cjs tests/death-v41.test.cjs tests/equipment-arena-v30.test.cjs
```

Database fixture checks:

```sh
NODE_PATH=/path/to/modules node tests/multiplayer-v36.cjs
LUDUS_PGLITE_MODULE=/path/to/@electric-sql/pglite node tests/combat-food-v60.cjs
```

The existing complete `node --test tests/*.test.cjs` run also includes an unrelated pre-existing failure: `tests/ludus-city-v29.test.cjs` does not provide the `CombatControlSettings` dependency required by the unchanged settings module. It reproduces independently; these files were not modified. The optional mobile-resource baseline test is skipped unless its baseline is supplied.

Browser harness:

```sh
CHROMIUM_PATH=/path/to/chromium node tests/arena-presentation-ui-v65.cjs
# Or serve the self-running local fixture in an existing browser:
node tests/arena-presentation-ui-v65.cjs serve
# Open the printed /qa URL. Add &rigonly=1 only for explicitly non-rendering checks.
# Compact the saved reports and regenerate comparison.json:
node tests/summarize-arena-presentation-v65.cjs
```

The fixture uses real repository assets and isolated account data, with external requests blocked. It does not access a real account or settle a battle.

## Real-rig / DOM results

The baseline and revised builds both passed a self-running fixture in the supported cloud Chromium, using the real repository GLBs and their articulated skeletons. Only the test fixture replaced the unavailable WebGL renderer with a matrix-update stub. Account loading/settlement was replaced locally, and CSP blocked non-local connections.

- Maximum 60 Hz head-guard entry left-hand step: **0.837 m → 0.220 m**, 73.7% lower. Release: **0.213 m → 0.126 m**, 41.0% lower.
- Guard walking now retains leg swing: steady left-foot forward excursion relative to the root increased from **0.004 m to 0.547 m**. Lateral guard steps similarly retain stride rather than translating a static defense stance.
- Chest, head and leg strike active blade direction stayed aligned to the unchanged collision sample (maximum numerical angular difference **2.2×10⁻⁸ radians**), with grip/hand error below **7×10⁻¹⁶ m**.
- Strike planting stayed finite; total ankle-joint movement was under **1.7 mm** in the tested attacks. Recorded ankle heights remained positive, around **0.125 m**. An ankle joint is not the foot sole, so this does not verify mesh-floor clearance.
- At **667×375, 844×390, 932×430, 740×320 and 1366×768**, all ten sampled controls fit without overlap or page scrolling.
- Pause stopped simulation, cleared movement/guard input and resumed. Actual repeated pointer/capture tests were not run in the fallback; the full Playwright harness contains them for a WebGL-capable environment.

`comparison.json` is the compact result summary. `baseline-report.json` and `after-report.json` contain numerical diagnostics and viewport outcomes; raw sample arrays are omitted by default. `ARENA_KEEP_RAW=1` preserves optional raw output when serving the fixture. CPU-only diagnostics are noisy single-run numbers, exclude GPU work, and do not establish a speedup. The reports deliberately contain no apparent graphics-FPS benchmark.

## Verification limits

The execution sandbox cannot launch Chromium because Unix sockets are unavailable. The supported cloud browser can open the isolated fixture, but its WebGL renderer reports `Disabled`. Consequently, this revision has **no production-renderer before/after screenshots, game-FPS measurement, physical iPhone benchmark, or live two-device match result**. The code remains a draft pending real-device visual review. Rig/curve/DOM-only checks, where reported, must not be read as a graphics-performance pass.
