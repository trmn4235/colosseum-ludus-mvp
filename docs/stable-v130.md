# Ahır V130

The V129 stable is now 30 × 54 metres: exactly twice its former 15 m width and six times its former 9 m length. The exterior door position stays at the far left; the caravan room retains its swapped position.

The interior follows the supplied stable photograph: two rows of six timber stalls, open upper bars and head openings, pale plaster, grey jointed paving, stone supports, timber rafters, high window recesses, hay bedding, individual mangers and water basins. The rear contains feed sacks, grain barrels, stacked hay and tools. These are instanced, reusable objects. The central aisle remains clear all the way to the rear. Selecting an owned horse in the HUD moves the viewpoint to that horse's stall.

A single groom is normalized from the actual posed/skinned GLB bounds after updating its matrices, inside a separate parent transform. Its height follows the current owner's configured height (1.60–2.00 m). The original rig transformations are preserved. All owned horses appear in their own stalls, up to the existing 12-horse capacity. The model and textures are loaded once; rig instances and coat materials are reused. Nearby horses animate at up to 30 updates per second, distant horses at four; no second WebGL renderer, shadow maps or per-horse asset downloads were added.

## Appearance

Seven persistent cosmetic coats: white, grey, light brown, dark brown, black, light brown with white patches, and caramel. The breeder purchase screen lets the player choose coat and sex. Records, portraits and model materials use the same coat key. The nine performance attributes are unaffected. Existing horses retain dark brown rather than being randomly recoloured. New foals inherit a parent's coat with a 90% combined chance; the remaining 10% draws from the seven looks. The cosmetic result is frozen at conception, survives birth, replay and sale, and is included in pedigree snapshots. Existing pregnancies without a coat use their mother's coat at birth.

The new migration adds only a constrained coat column and replaces the five affected functions. It retains all prior account locks, ownership checks, receipts, balances, progression, RLS and RPC privileges.

Caravan and stable door badges and their interaction buttons now use the same monochrome line pictograms as the other doors. The caravan HUD icon uses the same SVG instead of a photograph. Existing attention-state colouring and item photographs remain part of their original UI systems.

## Checks

- Actual PostgreSQL/PGlite migration and transaction tests, including upgrade of an existing horse, seven valid purchase coats, rejection of invalid coats, pedigree, births, trading, currency and replay.
- JSDOM interaction tests for the seven-choice selector, matching purchase image/payload, all prior stable tabs and retry/pause behaviour.
- Three.js loads the actual horse and groom GLBs (texture decoding skipped for numeric checks), verifies groom heights at 1.93 and 1.65 m, correct horse size/facing, twelve separate stalls, a clear 54 m aisle, cached asset loads and restoration of the ordinary room shell and lighting.
- Existing caravan browser regression updated to expect the requested monochrome badges, while retaining its layout and account checks.

No local browser is available under the managed Sites preview rules. Actual iPhone rendering and FPS have not been measured; numerical geometry and DOM tests do not establish visual quality or device frame rate.

## Art

Seven separate built-in Imagegen calls created the project portraits in `assets/stable-v130/`, resized without cropping to 768 × 512 WebP. The prompt set and final asset paths are recorded in `assets/stable-v130/art-direction.json`. Existing licensed horse and clothed-driver GLBs are reused; the new coat variations are shader materials, not seven new model downloads.
