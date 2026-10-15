# V106 — naval rendering performance

All four five-person teams, combat rules, collisions, boarding, ropes and javelins remain in the existing simulation. This revision changes presentation work and its scheduling.

## Changes

- Shared offline body LODs: original 55,228 triangles near the player, 18,000 at medium distance, 7,481 far away. Original positions, normals, UVs and skin weights are shared. Hysteresis prevents rapid switches; the player retains original geometry. Automatic mode prioritizes the focused enemy and closest bodies when all 20 fighters gather on one deck. Explicit Detailed restores full close body detail.
- Batch repeated NPC uniform meshes by geometry, material and shadow eligibility. World matrices are copied after Three updates the scene. Visibility, gear revisions and drops are respected; mirrored pieces keep their original rendering path. No new inventory items or stats are created.
- Stagger distant skeleton updates across frames, using 20 Hz beyond 24 m and 30 Hz otherwise. Nearby animation and all simulation/collision steps retain their existing cadence.
- Limit dynamic character shadows to the player and three nearest living actors in automatic mode; Detailed allows seven nearby actors. Refresh naval shadows at 15–20 Hz in automatic mode and 30 Hz in Detailed. Keep the light and its shadow camera aligned between refreshes.
- Extend automatic resolution adaptation to desktop naval play. Preserve the explicit graphics settings.
- Precompute ship headings for the water shader and replace equivalent fourth-power operations with multiplication. Preserve water shading, wakes, ripples, full water area and ship assets.
- Reuse the impact noise buffer, limit overlapping remote impacts, and omit the naval scene's unused sand texture request.

## Measured render counts

| Scene / count | V105 | V106 | Reduction |
| --- | ---: | ---: | ---: |
| Initial view: triangles | 1,620,198 | 862,421 | 46.8% |
| Initial view: calls | 366 | 316 | 13.7% |
| Wide fleet: triangles | 1,719,687 | 1,034,216 | 39.9% |
| Wide fleet: calls | 480 | 355 | 26.0% |
| Crowded deck: triangles | 1,719,016 | 1,123,368 | 34.7% |
| Crowded deck: calls | 470 | 346 | 26.4% |

## Validation

The full browser run passed with no console/page errors at four viewport sizes. It verified helm AI/manual handoff, rally, ropes, bridge ports, jumping, javelin stock/aim/hits, pause/resume, first/third person, polearm geometry and HUD placement. See `gameplay.json`.

101 automated tests passed and cover the existing simulation and polearm combat plus LOD bounds, exact skin-data sharing, near-detail restoration, crowd budgets, animation scheduling, instancing world matrices, visibility, mirrored transforms, shadow eligibility and equipment changes.

`tests/naval-browser-v97.cjs` exercises the real pages/assets with an isolated account fixture. The performance focus uses 20 actors at 844×390 CSS pixels, DPR 1.25, a fixed random seed, a wide fleet view and a crowded single deck. CPU samples exclude renderer submission and therefore also exclude the instancing callback. GPU diagnostics use headless Chromium/SwiftShader and are noisy; neither those timings nor the triangle/draw-call reductions establish physical iPhone FPS. Render counts include the colour pass, not shadow-map work.

Use `LUDUS_TEST_FOCUS=performance LUDUS_TEST_OUTPUT=/tmp/naval-perf node tests/naval-browser-v97.cjs`. For comparison set `LUDUS_TEST_ROOT` to the unchanged V105 checkout while running the V106 harness. `before.json` and `after.json` retain the measured output.

Rebuild the index asset with meshoptimizer 1.3.0: set `MESHOPT_MODULE` to its `index.js` and run `node tools/bake-naval-body-lod-v106.cjs`. The simplifier is build-time tooling only. Attribution remains in `asset-credits-v21.txt`. Optional detail data failures fall back to the original body; the GLB-only asset loader is intentionally not used for this binary.
