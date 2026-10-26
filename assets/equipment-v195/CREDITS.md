# Helmet transfer budget — V195

These are lighter derivatives of the five existing game helmets. No new design, generative imagery or replacement geometry is introduced. Original source attribution is retained in the GLB asset metadata.

- `gladiator.glb`: the user's `gladiator_helmet.glb`, via `../equipment/gladiator-9bcb0ac9d566.glb`.
- `knights.glb`: the user's `knights_helm.glb`, via `../equipment/knights-e30cc69af0fd.glb`.
- `winged.glb`: the user's `winged_helmet_gameready.glb`, via `../equipment/winged-111637d14990.glb`.
- `roman.glb`: **Roman Helmet**, VascoAmorimdeLemos, CC BY 4.0. Model: https://sketchfab.com/3d-models/roman-helmet-fe4dc3a4c6a141b795c97e2e94b336a3 — Author: https://sketchfab.com/VascoAmorimdeLemos — License: https://creativecommons.org/licenses/by/4.0/
- `sylvain_helmet.cme`: **Gladiator Helmet**, Sylvain Delandre (@lemanitek), CC BY 4.0. Model: https://sketchfab.com/3d-models/gladiator-helmet-6e5ede2ebea147bd82ffeafaf96cf6a2 — Author: https://sketchfab.com/lemanitek — License: https://creativecommons.org/licenses/by/4.0/ — based on the 6,652-triangle V191 derivative, with the same topology.

Changes: recompressed original textures to WebP; retained 512 px colour/normal maps and capped material maps at 256 px; reduced legacy index widths and encoded normals, tangents and UVs at 16-bit precision. Every triangle, vertex position, material assignment and existing skull fit is preserved. The runtime deinterleaves packed attributes once before its existing mesh batching.

`build-report.json` records exact source/output sizes, texture dimensions, triangle counts and hashes. Reproduction: `node scripts/pack-helmet-budget-v195.mjs`. All seven active helmet packages are at most 350,000 bytes, including all embedded textures. The Viking and Steel packages already meet that limit and are unchanged. Inventory icons are unchanged and verified against the loaded models.
