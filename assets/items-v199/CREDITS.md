# Item identity renders — V199

These 22 transparent 320 × 320 WebP images are conventional Three.js studio renders of the geometry and materials actually used by the game. No model, texture or rendered reference was submitted to a generative image service. This includes the NoAI-restricted maned sources.

- The three imported manicas and gladiator trident use the final V197 fitted meshes. Attribution and original source URLs: [V197 equipment credits](../equipment-v197/CREDITS.md) and [V196 source credits](../equipment-v196/CREDITS.md).
- Halberd uses the shipped V193 model: [V193 credits](../equipment-v193/CREDITS.md).
- The two legacy shields use the shipped V190 models and textures: [V190 credits](../equipment-v190/CREDITS.md).
- Gladyatör göğüs zırhı uses the optimized original chest: [V199 chest notes](../equipment-v199/CREDITS.md). The other chest and both shoulder items retain the existing repository models and their attribution.
- Spear, original trident, chain mace, whip, scissor, net, traditional manica, greaves, heavy mace, warhammer and bow use the existing game-authored procedural geometry. Paired pieces are shown as worn. The bow comes from `pit-archery-v178.js`.

The original source files and their licenses remain unchanged. These notes do not grant additional rights to those assets. Sica, Gladius, all seven helmets, the six selected shields and the three pit weapon icons are unchanged.

Reproduce deliberately with `LUDUS_REBUILD_ITEM_ICONS=1 node scripts/render-item-icons-v199.cjs` (Playwright and sharp). Ordinary execution compares fresh geometry/material renders with the saved icons without overwriting them. Per-icon geometry hashes, triangle counts, draw calls, image hashes and byte sizes are in `render-report.json`. All 22 images total 260,398 bytes; each is below 35 KB.
