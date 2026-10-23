# V167 selected equipment

Prepared and registered `warhammer`, `heavy_mace`, and `sylvain_helmet` in `LudusEquipmentCatalog`. The catalog is available on ludus, arena, singleplayer battle and multiplayer pages. The weapon template builder can load the two new weapon IDs on demand, refresh after loading, and share the resulting geometry and materials across fighters. No startup download is added for unused items.

The current inventory, recipes and server combat IDs are **not migrated** by this asset preparation. The existing `mace` is a chain flail; `heavy_mace` is a separate solid mace. Inventory distribution, stats and full gameplay approval remain separate from registering these visual assets. The helmet is registered for preview; a new fitted wearable slot is not enabled without an actual head-fit pass.

`equipment-preview-v167.html` presents all three assets with on-demand loading, pointer rotation and a retry state. The checked-in PNG is an offline geometry/material render, not an in-game screenshot or an iPhone FPS measurement.

## Reproduce

1. Obtain the authorized source downloads from the URLs in `assets/equipment-v167/CREDITS.md`.
2. Provide Node dependencies `three@0.160.1` and `meshoptimizer` to the preparation script.
3. `node scripts/prepare-selected-equipment-v167.mjs SOURCE_DIR PREPARED_DIR` (inputs: `Hammer_3.fbx`, `Mace_2_optimized.fbx`).
4. `node scripts/pack-equipment-v167.mjs PREPARED_DIR PATH_TO_HELMET_1K_GLB`.
5. `node --test tests/equipment-catalog-v167.cjs tests/equipment-arena-v30.test.cjs`.

Raw CGTrader source archives and raw derivative GLBs are not published in the repository. Game resources use the authenticated CME167 resource envelope. Source and licence information remains with the game.
