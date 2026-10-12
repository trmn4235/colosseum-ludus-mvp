# V86 — Roma tedarik haritası ve ticaret odası

The supply UI uses the approved V68 white, burgundy and gold tokens. Its frame and content remain bounded to the game viewport. Stock, expeditions and crafting use explicit pagination; every item remains reachable without a vertical list.

The overview contains a compact illustrated Rome map and eleven accessible destination buttons. A button or the region selector opens that destination's separate scene, current RPC yield, worker stepper and send action. Back and Escape return to the map; Escape from the overview closes the room UI. Images are loaded as their views are opened. All twelve assets live in `assets/supply-v86/`; `art-direction.json` records the built-in Imagegen prompts. The Rome illustration is game scenery, not a claim about real resource deposit locations.

The Tedarik room now has a mosaic floor, red wall panels, stone pilasters, framed Rome map, planning table, amphora shelves, linen rolls, metal ingots, cargo crates, ledger counter and balance. The same map asset is used on the wall and table. Repeated static geometry is instanced, no additional dynamic lights are added, and furnishings and textures are reused on room re-entry. Five colliders protect the furniture while keeping the entrance and table approach clear.

Worker rewards, resource yields, expedition time, cooking, olive-oil rules and server transactions retain V85 behavior. Pending transaction UUIDs and retries retain their existing storage key.

Validation:

- `tests/gathering-ui-v85.cjs`: existing worker, retry, crafting, food and integration checks.
- `tests/gathering-ui-v86.cjs`: all eleven scenes; map/back/Escape; every stock, expedition and recipe reachable through pagination; filtering and resize; five viewport inputs; fixed-overflow CSS contracts; real Three.js CPU scene construction, instancing, reuse and collisions; twelve valid WebP assets.
- Both JavaScript modules pass syntax checks; the existing suite parses the integrated page scripts.
- DOM tests do not measure rendered geometry. Browser/GPU visual QA was unavailable in this environment and was not performed.
