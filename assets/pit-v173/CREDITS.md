# Şan Avlusu V173 assets

## Venue weapons

Creator: **k4m3r** (CGTrader). Downloaded 23 October 2026 from the free listings selected by the user:

- [Middle Age Stone Mace](https://www.cgtrader.com/free-3d-models/military/melee/middle-age-stone-mace)
- [Middle Age Wood Mace](https://www.cgtrader.com/free-3d-models/military/melee/middle-age-wood-mace)

Listed license: CGTrader Royalty Free / No AI. These assets were not supplied to any generative model. Original FBX files are not distributed here. Game resources use the same CME167 client package format as existing equipment; this packaging is not a claim of DRM security. They are embedded game equipment, not a standalone asset library or reusable source download.

`prepare-pit-weapons-v173.mjs` deterministically bakes the source transforms, centers the shaft, scales to 0.94 m / 0.84 m, and sets hand-painted stone, wood and iron PBR material values. `weapons-build.json` records source hashes and geometry counts. The two selection icons are deterministic Three.js renders of these converted models, not generated images.

## Architecture and map

The rectangular scene is original code in `pit-arena-v172.js`: 22.6274 × 16.9706 m sand floor (384 m²), four high boundary walls, upper rectangular gallery. Existing project sand, plaster, gate and sandstone PBR textures are reused; original attributions remain with the texture assets. Standing crowd is the existing circus figure asset. Dominus and keeper reuse the existing MakeHuman rig; see `OWNER_ASSETS.md`.

`map.webp` is an original image made with the built-in image generation tool, revised to the user's final rectangular plan. It uses no CGTrader model as input. The exact image prompt is in `map-prompt.txt`.
