# Caravan forest environment — V125

Requested direction: a dirt road enclosed by dense trees, a horse-drawn covered
wooden caravan, and separate ambush and defense starting positions. The supplied
forest photograph is the composition reference, not a background image.

## Entry and scope

- `caravan-field.html?mode=ambush`: accessible through “3D alan” in the hunt panel.
- `caravan-field.html?mode=defense`: accessible through “3D alan” in caravan equipment.
- A full Three.js scene: walk along the road, look around, switch starting sides,
  return to the overview or Ludus. Desktop uses WASD/arrows and dragging; touch
  uses a left movement pad and right-hand drag. Movement stops on blur, pointer
  cancellation, dialogs and page visibility changes.
- Two caravans, independently cloned horse skeletons, idle animation, reins,
  shafts, wagon canopy, wooden hoops, curtains and cargo. Wagon geometry, horses
  and trees are imported ready-made assets. Cloth and cargo augment the imported
  cart. This first environment is explicitly labeled **3D preview**.
- No combat, attack adjudication or reward client code is added. The existing
  server-owned two-hour raid and reports remain intact. This page makes no auth,
  database or RPC requests and never writes inventory or mission state.

## Asset sources and permissions

Full per-asset source paths and licenses are in
`assets/caravan-field-v125/CREDITS.txt` and the three accompanying license files.
The in-scene “Model kaynakları” dialog includes attribution and source links.

| Part | Source | Permission |
| --- | --- | --- |
| Horse, rig, idle/walk/canter/rear clips | Literock Studios, Warhorse Lite | Free commercial end-product use; no standalone redistribution |
| Close deciduous trees | Polyy.AI, Deciduous Trees Pack | CC0 |
| Four-wheel wagon, distant oak/pine, bushes, fern, terrain textures | Wildfire Games, 0 A.D. official archived art repository | CC BY-SA 3.0 |

The converted 0 A.D. artwork and wagon/canopy art adaptations retain CC BY-SA 3.0.
No source game code is imported. Warhorse is packaged solely as part of this game;
the application provides the creator's page instead of an asset download service.

## Rendering and loading

- All 12 model/texture files are served with the game, about **4.8 MB** combined.
  The SHA-256 manifest records file sizes, triangle counts and animation clips.
- Meshes use ordinary GLB with embedded WebP; no external textures, runtime CDNs,
  Draco downloads or additional decompression workers.
- Near trees are simplified to 7,776 and 8,108 triangles; background oak/pine are
  251–1,012 triangles. The horse retains 9,916 triangles and its original rig.
- Repeated trees, plants and rocks use GPU instances. Static wagon decorations
  are merged by material. The measured overview uses about 33 draws and 233,252
  triangles after shadow initialization.
- One bounded shadow map is baked when the scene is assembled. Pixel density
  adapts between 0.875 and 1.25 for touch, or up to 1.5 for desktop. Rendering
  suspends when the page is hidden. Actual phone frame rate is device-dependent;
  browser automation is not a physical iPhone benchmark.
- Loading reports real completed file counts. Each fetch and the overall load
  have deadlines. Failures show a retry action and a Ludus link; no invented
  percentage counter. Lost WebGL context produces a recoverable error screen.

## Validation

`tests/caravan-field-v125.cjs` verifies the checked-in GLBs and hashes, local-only
assets, preserved animation clips, scene budget, two caravans, role selection,
keyboard and pointer controls, touch release in Chromium, several landscape and
portrait layouts, lack of game-state requests, and failed-model recovery.

Existing V122/V123 supply UI and V124 raid-flow browser tests cover both new
entry links' surrounding panels, six landscape sizes and the unchanged raid
dispatch/retry/report flow. A separate GitHub workflow runs the new scene test.

Local validation completed in Chromium 153 and WebKit 26.5: V125 scene test
passed in both engines; the supply V122/V123 and raid V124 browser regressions
also passed. Captured renders are in `caravan-field-v125/overview.webp` and
`caravan-field-v125/walking.webp` (these include the credited adapted game art).

This work establishes the scene and reusable 3D assets. Binding gladiators,
weapons, combat outcomes and live caravan defense to this environment is a later
feature; the preview does not imply that those combat systems are implemented.
