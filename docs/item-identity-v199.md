# Item / icon identity V199

The audit found independent illustrations that did not represent the shipped weapon, armour, shield and bow meshes. Twenty-two icons now come directly from the actual game geometry/materials. Sica and Gladius are explicitly excluded: their icon bytes, labels and shared Spatha selection remain unchanged. The seven matching helmets, six selected shields and three pit weapon icons are retained.

`item-visuals-v199.js` provides a shared visual identity for all 36 equipment recipes plus the bow. Inventory, production, market, clan storage, upgrades and battle selection load this before the production module. Exact kind/model takes precedence over a stale SKU, including heavy mace and warhammer overrides. Known legacy aliases remain supported. An unknown model receives a neutral missing-art mark instead of a different weapon or shield; production-module failure can still use the shared visual registry. New manicas receive their proper names instead of old shoulder labels. The legacy small shield is no longer called a round shield while showing a rectangular mesh.

Both chest item IDs previously resolved to `chest_plate`. The original gladiator chest now has its own optimized mesh in all five rigs, including the caravan/pit shared rig. It is 67,616 bytes / 3,305 triangles / one primitive, compared with the original 1,212,096 bytes / 50,880 triangles. The original source is preserved. The existing bind-pose fitting, skinning, swaps and shared fitted geometry are reused. Legacy `starter` chest items continue to select the light plate and now show its correct icon.

No recipes, prices, stats, socket values, ownership records, IDs, backend simulation or SQL are changed. All recipe objects retain their V198 hash. Changed external scripts receive V199 cache keys; unrelated catalog model URLs remain at their existing version.

## Validation

- `node --test tests/item-identity-v199.cjs` covers the 36 equipment identities and valid aliases in seven UI wrappers with/without production, stale SKUs, unknown models, exclusions, exact recipe hash, image budgets, two real chest meshes in all five rigs and cache/dependency order.
- `node tests/item-identity-browser-v199.cjs` compares fresh WebGL geometry/material renders with the 22 saved icons, decodes all 37 shared images and draws both chest models in idle, walk, guard and attack poses.
- `node tests/item-picker-v199.cjs` checks all 36 actual equipment-picker choices, labels, icon URLs and preserved enhancement values without account writes.
- `node tests/equipment-stability-v164.cjs` checks 2,870 animated frames across five rigs, both chest variants, equipment swaps, fitted mesh reuse and independent skeletons.
- Production browser fixtures cover the corrected arm/trident, halberd, heavy mace and warhammer icons at desktop and touch viewport sizes down to 568 × 320. SQL production validation uses local PGlite fixtures; no live account data is modified.

Browser checks use software-rendered Chromium. These checks do not claim physical phone FPS or hardware GPU performance. Reproduction and original attribution are documented with the new assets.
