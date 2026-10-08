# İmparator Gizli Görevleri V31

`imperial-desk-v31.glb`: Antique wooden desk by Lorenzo Drago. Original geometry and textures downloaded from Objaverse/Sketchfab. CC BY 4.0. Source: https://sketchfab.com/3d-models/antique-wooden-desk-67cc4558a0e74bb6be61a1af1eb13b66 . The game scales and positions the original asset. Model metadata retains creator and licence.

The three mission illustrations (`imperial-trajan-v31.webp`, `imperial-portus-v31.webp`, `imperial-subura-v31.webp`) were generated for the requested missions. They are illustrations, not historical photographs.

Server controls the Istanbul calendar, thresholds, durations, roster ownership and availability, and one-time reward delivery.

## V45 approved four-day cycle

`imperial-cycle-v45.json` records the twelve approved tasks in their final order. Days 1 and 2 contain the new easy, medium and hard missions. Day 3 contains Masada, Jerusalem and Cannae, all at hard difficulty. The original Traianus, Portus and Subura missions are day 4. After day 4 the cycle returns to day 1 at Istanbul midnight.

Each mission has two separate uncropped 3:2 files in `imperial-missions/`: a 960×640 WebP card and a 1536×1024 WebP detail image. The UI selects the corresponding file and uses `object-fit: contain`. Older assignment snapshots retain a fallback to the high-resolution original scene.

Apply `supabase/migrations/20261008220535_imperial_four_day_cycle.sql` after the existing V31 mission and V37 level migrations. It preserves historical assignments and frozen rewards. Each calendar date receives new mission UUIDs, so tasks can be joined again on a later cycle. The administrator edits twelve entries, with separate card and detail fields and a difficulty selector. Saving a draft does not change the published cycle.

Validation: `tests/imperial-cycle-v45.cjs` runs the migration and mission RPC in PGlite, checking two full cycles, stable daily IDs, all three hard day-3 tiers, authorization, snapshots, and once-only diamonds, stones and EXP. Set `LUDUS_PGLITE_MODULE` to the PGlite module path if it is not installed locally. `tests/imperial-cycle-ui-v45.cjs` loads the actual approved images in Chromium and WebKit across five landscape viewports, checking all twelve details, exact image dimensions, no cropping, no scrolling and the four-day editor. Set `CHROMIUM_EXECUTABLE_PATH`, `LUDUS_TEST_ENGINES` and `LUDUS_TEST_OUTPUT` as needed.

## V32 room objects

- `office-wardrobe-v32.glb`: Antique Wardrobe by matejbiskup97, CC BY 4.0. https://sketchfab.com/3d-models/antique-wardrobe-9e194868da754d55afc876127dc8f74b . Original authored geometry retained; embedded textures reduced to 1K.
- `office-daily-book-v32.glb`: Old Book by g.saintecatherine, CC BY 4.0. https://sketchfab.com/3d-models/old-book-f635e9f788854a53ba2b3df034a27d0f . Original authored geometry retained; textures reduced to 512px. Used as the daily task ledger.
- Both assets downloaded through the Allen Institute for AI Objaverse distribution. Creator and licence metadata preserved in the files.
