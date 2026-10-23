# Şan Avlusu V174 — ready asset sources

No new generative image is used in this release. The original `../pit-v172/bookmaker.webp` is byte-for-byte unchanged.

## Photographed PBR surfaces — Poly Haven, CC0

- Plaster Stone Wall 02: https://polyhaven.com/a/plaster_stone_wall_02
- Wooden Gate — Amal Kumar: https://polyhaven.com/a/wooden_gate
- Fabric Pattern 07 — Rob Tuytel: https://polyhaven.com/a/fabric_pattern_07
- Reused Dense Sand — Dimitrios Savva: https://polyhaven.com/a/dense_sand (files in `../stable-v161`).
- Reused Cobblestone Floor 08 — Rob Tuytel: https://polyhaven.com/a/cobblestone_floor_08 (files in `../stable-v161`).
- Reused Wood Plank Wall: original attribution in `../stable-v160/CREDITS.txt`.
- Reused White Sandstone Blocks 02: existing project attribution retained.
- License: https://polyhaven.com/license

`sources.json` records the downloaded official 1K JPG URLs and SHA-256 hashes before WebP encoding. Color, normal and roughness maps retain their separate color spaces. Fabric is tinted burgundy in the scene. Geometry is original scene code.

## Roman banner — 0 A.D. / Wildfire Games, CC BY-SA 3.0

`banner-romans.png` is the unmodified `banner_romans.png` texture, downloaded from:
https://github.com/0ad/0ad/blob/master/binaries/data/mods/public/art/textures/skins/props/banner_romans.png

Original art: Wildfire Games / 0 A.D. contributors. License: https://creativecommons.org/licenses/by-sa/3.0/
The source texture is distributed unmodified and retains that license. Full original art license is included at `../caravan-field-v125/LICENSE-0AD.txt`.
The scene drapes the authored image on a cloth surface with Poly Haven fabric normal detail. The amphorae reuse `../stable-v161/amphorae.glb` and retain its CC BY-SA 3.0 credits.

## Dressed spectators — existing MakeHuman assets

`spectators.glb` is an offline static bake of four dressed, independently posed MakeHuman people. It uses the project's original CC0 body, face, hair, tunic and idle clip assets; sandals retain Elvaerwyn's CC-BY attribution. The scruffy beard retains Elvaerwyn's CC-BY attribution. See `../../OWNER_ASSETS.md` for individual source links and credits. No museum statue is used as a spectator.

`prepare-pit-crowd-v174.cjs` bakes posed vertices and original UVs, retains only visible parts, and reduces texture size to 512px. `optimize-pit-crowd-v174.mjs` welds and simplifies the mesh with a 0.003 error threshold. Result: 55,867 triangles across all four variants, instanced six times per variant, 24 people total. The two interactive actors keep their original animated rigs.

## Weapon selection renders

`stone-selection.webp` / `wood-selection.webp` are transparent 420×800px deterministic Three.js renders of the user's selected k4m3r CGTrader weapons already shipped in V173. No CGTrader asset was sent to a generative model. Original asset credits and use restrictions remain in `../pit-v173/CREDITS.md`. These images are UI thumbnails of the embedded game equipment, not separately licensed source assets.
