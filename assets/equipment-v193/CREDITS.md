# Halberd — Colosseum V193

- Creator: **sufair**, CGTrader.
- User-selected source: https://www.cgtrader.com/free-3d-models/military/armor/halberd-medieval-weapon
- Model ID: **3032132**. Downloaded 25 October 2026.
- Listed license: **Royalty Free License (no AI)**.
- Original Blender file: 28,467,484 bytes. Source hash and exact output budgets are recorded in `build-report.json`.

The two weapon meshes contain 372,992 source triangles. Offline Blender simplification retains 2,899 triangles (99.22% reduction). The presentation room, lights, cameras and environment maps are removed. Original wood/metal materials are baked offline; uniform textures become constant material colors. The final resource has four primitives and one 256 × 256 WebP map, 58,424 bytes including geometry and textures. Decoded texture memory including mipmaps is approximately 0.333 MiB. Existing CME167 packaging is reused; this is not a promise of DRM security. The original source file is not redistributed.

Total length is 1.80 m; the origin is 0.10 m above the butt, leaving 1.70 m from grip to tip. Existing pole thrust/guard animations and collision length are reused. Classification is **Silahlar → Kılıçlar**, explicitly requested by the user. It is not a shield-breaking mace and cannot be thrown.

Game recipe: **7 steel ingots, 3 wood, 2 processed leather, 2 resin, 1 rope → 1 Halberd**. Steel represents the blade, spike and collars; wood the shaft; leather the grip; resin and rope its binding. These are gameplay recipe units, not a claim about the physical manufacturing quantities of the source model.

## Inventory icon

`../items-v193/halberd.webp`: original generated inventory illustration, 512 × 512 transparent WebP, 21,448 bytes. Generated with OpenAI `image_gen.imagegen` from text only, then resized using Sharp. No licensed mesh, source texture, source preview or render was supplied to the image model.

Prompt brief: a single medieval halberd inventory icon on transparent background, full long brown wooden shaft diagonally from lower left to upper right, dark forged steel double crescent axe head with polished edges and central narrow spike, metal collars and leather grip; readable game item silhouette, no text, frame, ground shadow or other objects. The icon is an illustration, while the in-world model remains the optimized licensed asset.

Reproduction: run `scripts/prepare-halberd-v193.py` in Blender 4.5.9 with the original blend path and output directory after `--`; run `scripts/pack-halberd-v193.mjs` with that directory and the target asset directory. `scripts/render-halberd-v193.cjs` produces deterministic mesh QA renders when `HALBERD_QA_DIR` is set. Packing uses fresh AES-GCM IVs; the report records the resulting hash.
