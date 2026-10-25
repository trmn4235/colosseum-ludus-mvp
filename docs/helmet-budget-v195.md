# V195 — every helmet below 350 KB including textures

The 350 KB target means at most 350,000 bytes per active model package, including all embedded textures. Icons are separate. Five larger packages are replaced with lighter derivatives; Viking and Steel already meet the budget.

| Helmet | Before (bytes) | Active package (bytes) | Triangles, unchanged |
|---|---:|---:|---:|
| Gladyatör | 447,244 | 280,688 | 4,347 |
| Şövalye | 612,424 | 314,788 | 3,271 |
| Kanatlı | 520,556 | 266,440 | 3,896 |
| Roma | 601,112 | 343,380 | 11,290 |
| Vizörlü gladyatör | 434,936 | 342,928 | 6,652 |
| Boynuzlu Viking | 322,476 | 322,476 | 4,076 |
| Çelik | 173,100 | 173,100 | 2,358 |

Total model/texture transfer falls from 3,111,848 to 2,043,800 bytes (34.32% reduction). The seven separate icons still total 112,714 bytes. These are file sizes, not GPU memory measurements.

All positions and triangle indices remain identical after decoding; no mesh simplification is used. Legacy normals, tangents and UVs use 16-bit storage, indices use 16 bits when possible, and the original images are recompressed as WebP. Colour and normal maps remain 512 px; material maps are at most 256 px. Materials, item IDs, ownership, recipes and labels are unchanged.

Five rigs now reference the new four legacy helmet files. The shared catalog loads the lighter Sylvain package. Versioned script references and dynamic caravan/courtyard loaders invalidate their previous cached paths. Existing raw files remain as reproducible baselines; active loaders do not request them. Interleaved attribute data is converted once into plain typed attributes before the existing helmet batching, preserving one draw call for each helmet except the two-material Knight helmet.

Tests enforce the exact 350,000-byte ceiling for all seven active models, embedded textures, original positions/topology, all five source mappings, the seven-class head attachment and shared instances, and unchanged draw calls. Real Chromium and WebKit rendering compares the old/new models from four angles and checks the existing model-derived icons. Local Chromium comparison covers 20 views with identical silhouettes and fitted bounds; worst mean RGB difference is below 3%.

Reproduce assets with `scripts/pack-helmet-budget-v195.mjs`; inspect `assets/equipment-v195/build-report.json` for hashes and texture measurements. No database or server migration is required.
