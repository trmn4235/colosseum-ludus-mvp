# V196 — selected arm guards and trident

The three requested Sketchfab sources provide four independently craftable items. The existing trident and generic manica remain available. New guards use the existing gloves slot and Kol / Bacak inventory filter; the trident is in Silahlar → Trident, mızrak. Recipes return one item each and debit the existing resource stock.

| Model | Triangles | Mesh + embedded textures | Icon | Draw calls |
|---|---:|---:|---:|---:|
| `manica_segmented` | 2450 | 105,616 B | 12,566 B | 3 |
| `manica_lion` | 2687 | 183,164 B | 11,430 B | 3 |
| `trident_gladiator` | 1368 | 69,392 B | 3,650 B | 1 |
| `manica_leather` | 3177 | 167,500 B | 14,962 B | 1 |

Each complete model stays below 350,000 bytes. Four models total 525672 bytes; four icons total 42608 bytes. Textures are embedded, cropped and atlased, up to 512 pixels per dimension. No raw character, animation, spare weapon or unused texture is shipped. The original three downloaded GLBs are kept outside the repository.

Source geometry is selected by connected component, transformed from the bind pose and simplified offline. Shoulder caps, upper arms and forearms retain rigid contours on separate mounts. Smooth radial clearance accommodates the game's body. Mount transforms are captured when the actor is created, so selecting or finishing a download during an animation cannot bake the current pose into the attachment. Switching equipment hides/replaces the correct slots. Catalog loads are lazy and deduplicated; fighters and dropped items share geometry, materials and textures. The existing resource envelope and WebP loader are reused.

The new trident inherits trident timings, piercing rules, grip direction, throwing, pickup and battle entry/exit validation across arena, training, courtyard, caravan and multiplayer. Server registration changes only checked allowlists/case branches; account permissions, prices, owned items, default NPC loadouts and loot probabilities are retained. The caravan validator mirrors the browser core.

Validation: `tests/arm-equipment-v196.cjs` covers five rig contexts, delayed loading, switching, shared buffers, bind-pose stability in seven action states and file/texture/triangle budgets. `tests/arm-equipment-sql-v196.cjs` exercises the migration twice, melee, throwing/retry, all three arm items and battle entry/exit in PostgreSQL. The existing production suite validates actual crafting and stock debits. `scripts/render-armour-v196.cjs` renders icons and worn poses from the exact shipped models. The production browser suite checks the four recipes and images at five desktop/mobile viewport sizes. WebKit is exercised by CI; this local environment lacks its native libraries.

[Attribution, licenses and exact source models](../assets/equipment-v196/CREDITS.md). Source checksums and texture memory are in `assets/equipment-v196/build-report.json`.
