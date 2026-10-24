# V177 courtyard assets

## New downloaded assets

Poly Haven assets are CC0: https://polyhaven.com/license

| Asset | Primary source | Shipped version |
| --- | --- | --- |
| Large Sandstone Blocks | https://polyhaven.com/a/large_sandstone_blocks | 1K colour, OpenGL normal and roughness WebP maps |
| Old Sandstone 02 | https://polyhaven.com/a/old_sandstone_02 | 1K colour, OpenGL normal and roughness WebP maps |
| Wooden Crate 01 | https://polyhaven.com/a/wooden_crate_01 | Original mesh, embedded 512px textures, GLB |
| Wooden Bowl 01 | https://polyhaven.com/a/wooden_bowl_01 | Original mesh, embedded 512px textures, GLB |

`sources.json` records exact download URLs and source SHA-256 values. `scripts/fetch-pit-assets-v177.py` downloads official files; `scripts/pack-pit-assets-v177.cjs` packs the models. No runtime download from the source provider is required. Stone colour is adjusted by the runtime material, not by image generation.

## Reused ready assets

- Wildfire Games / 0 A.D., bucket and basket: CC BY-SA 3.0. See `assets/stable-v161/CREDITS.txt` for revision and paths, and `assets/caravan-field-v125/LICENSE-0AD.txt` for the complete licence. Existing converted meshes are unchanged.
- Poly Haven Painted Wooden Bench, CC0: `assets/pit-v175/CREDITS.md`.
- Poly Haven Marble Bust 01 by Rico Cilliers, CC0: `assets/circus-v145/SOURCES.md`. A decorative ready model with a rough stone material; not represented as an authenticated Roman portrait.
- Kenney Furniture Kit tablecross, CC0: https://kenney.nl/assets/furniture-kit
- Quaternius Fantasy Props MegaKit Bag and Cauldron, CC0: https://quaternius.com/packs/fantasypropsmegakit.html
- The table, bag and cauldron reuse `assets/dining/dining-kit-v54.glb`; original build and pinned distribution details are in `DINING_ASSETS.md`.
- Existing photographed linen and wood textures retain their original asset-folder credits.
- Quaternius Universal Animation Library 2 and KayKit Character Animations, CC0: see `ANIMATION_ASSETS.md` and `docs/combat-animation-v163/source-manifest.json`. Existing baked Sword_Regular_A/B and Melee_1H_Attack_Chop motion is reused, not newly generated.

## Original weapon selection illustrations

`stone-icon.webp` and `wood-icon.webp` are original AI-generated illustrative inventory icons. Built-in image generation was used with transparent backgrounds and no reference images for these shipped files. They are not renders or edits of the existing CGTrader weapon models. The game weapon model files and their original licence remain unchanged.

Generation prompts and output provenance: `icon-generation.json`. Outputs were resized to 512px WebP while preserving alpha. No gameplay geometry is generated from these illustrations.
