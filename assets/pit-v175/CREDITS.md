# Şan Avlusu V175 — photographed surfaces and authored models

No generative artwork is used. Existing betting and loading photographs are unchanged.

## Poly Haven — CC0

- Painted Plaster Wall, Amal Kumar: https://polyhaven.com/a/painted_plaster_wall
- Large Grey Tiles, Rob Tuytel: https://polyhaven.com/a/large_grey_tiles
- Painted Wooden Bench, Kirill Sannikov: https://polyhaven.com/a/painted_wooden_bench
- License: https://polyhaven.com/license

`sources.json` records official download URLs and SHA-256 hashes. Textures are 1K WebP conversions. The ready-made bench retains the original 630-triangle geometry, worn painted surface, joints and UVs; its PBR maps are resized to 512px and packed in GLB. It is used as a modest timber furnishing, not presented as an archaeological reconstruction of a specific Roman bench.

Reproduction: `scripts/fetch-pit-assets-v175.py`, then `scripts/pack-pit-bench-v175.mjs` (glTF Transform and sharp).

## People — existing downloaded MakeHuman assets

Original author links and individual licenses remain in `../../OWNER_ASSETS.md` and `../pit-v174/CREDITS.md`. MakeHuman body/face/hair and clothing are CC0; Elvaerwyn sandals and the scruffy beard retain their CC-BY attribution. `spectators.glb` and `spectators-low.glb` are new posed exports of those same models, with a knee-length tunic and corrected pelvis/thigh cloth weights. No foot/knee weights stretch the lower hem. The distant model reuses the near model's materials at runtime. Original UVs are retained.

Reproduction: `prepare-pit-crowd-v175.cjs`, followed by `optimize-pit-crowd-v175.mjs`. Near geometry has 80,361 triangles across four variants; distant geometry 29,598. WebP textures use the supported EXT_texture_webp glTF extension. Near/far rendering switches per person, not per whole crowd.

## Existing objects and surfaces

- Amphorae: 0 A.D. / Wildfire Games, CC BY-SA 3.0; see `../stable-v161/CREDITS.txt` and `../caravan-field-v125/LICENSE-0AD.txt`.
- Banner: 0 A.D. / Wildfire Games, CC BY-SA 3.0; see `../pit-v174/CREDITS.md`.
- Maces: k4m3r / CGTrader, selected and downloaded by the existing project; original royalty-free/No AI conditions remain in `../pit-v173/CREDITS.md`. The rack uses the existing embedded game assets; no new source model is redistributed.
- Dense Sand, Fabric Pattern 07, existing timber, sandstone and leather: original project credits retained in V174 and stable asset folders.

Architecture, closed niches, support cradles, desk, wax tablet and bounded footprint effects are scene code. They are not described as downloaded models.
