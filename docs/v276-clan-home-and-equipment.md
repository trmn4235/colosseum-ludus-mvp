# V276 — Klan ana sayfası ve ekipman görselleri

## Changes

- Long weapon art points from lower right to upper left. The image alone is mirrored/rotated inside its trimmed SVG viewport; the enhancement header remains in the upper right. Original weapon raster bytes, item identity, recipes, enhancement values and 3D models are unchanged.
- Three new transparent, realistic illustrations replace the basic `manica`, `legs` and ornate `chest-plate` card images. Distinct other armor variants keep their existing art. Optimized WebP files are each below 65 KB, at a maximum 512 px dimension. Generation prompts and file hashes are alongside the assets in `assets/items-v276/`.
- Clan home now shows working caravan count, the current 20-slot battle roster, clan leader, member/online counts, relevant action notices and treasury summary. Caravan home card intentionally contains just its title/count. Cards route to existing functional detail views.
- Working count uses authenticated, matching-clan `collecting` jobs from the existing V268 endpoint. Forming and completed jobs do not inflate it. Unavailable data displays an em dash with a retry notice; requests time out after 15 seconds.
- Caravan list, ten-worker details, reports, rankings and stock reuse the existing shared caravan module. The optional `onData` callback keeps dashboard data current. Existing permissions and server-authoritative mutations are preserved.
- Compact horizontal navigation prioritizes Home, Caravans, Battle roster, Members, Treasury and Clan strength. Level progression, trophies, administration and rankings remain under More. Previous home progression functionality is retained on its own page.
- New surfaces use the three existing persistent themes. Phone landscape stage scaling and no page scrolling are retained.

## Validation

- 19 Node checks passed across dashboard logic, all item wrappers/identities, unchanged recipes and model fitting, and theme persistence/entry points.
- After adding the request timeout, the 5 dashboard checks and existing V268 caravan regression script passed again. `git diff --check` clean.
- Managed browser preview uses the real page source with fixture-only account/RPC data. Verified home to caravan list to ten-worker detail, home to battle roster, More menu, all three theme choices and 568×320 / 874×402 landscape layouts. No production account data was mutated.
- Equipment preview shows ten inventory cards, all requested weapon tips at upper left, and the new three armor images. Enhancement header and art viewport remain disjoint. The preview browser uses the existing static gladiator fallback because its 3D preview could not initialize; this change does not claim to fix that separate renderer issue.

## Release status

Prepared and committed locally on the existing work branch. No push or deployment was performed in this turn.
