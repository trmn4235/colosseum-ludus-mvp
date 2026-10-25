# V190: lighter shields and shared Gladius/Sica model

The existing three user-supplied GLBs are repacked under versioned URLs.
All five character renderers load the new files; the caravan script URL is
also updated so its persistent asset cache cannot retain the previous files.
Gladius and Sica continue to share one model. The logical `roman_spatha.glb`
asset tag is retained because the two authored grip corrections use it.

| Asset | Before, bytes | After, bytes | Reduction | Triangles |
| --- | ---: | ---: | ---: | ---: |
| Large shield | 4,394,088 | 204,436 | 95.35% | 1,466 |
| Small shield | 2,941,088 | 179,768 | 93.89% | 1,246 |
| Gladius / Sica | 1,942,872 | 221,964 | 88.58% | 4,994 |
| Unique files, total | 9,278,048 | 606,168 | 93.47% | |

Colour and normal maps are 512px WebP. The packed material map is 256px
lossless WebP. This reduces the RGBA texture budget including mipmaps from
16 MiB to 3 MiB per model. These are decoded-image budgets, not total GPU/RAM
measurements. Vertex attributes are quantized, without triangle simplification.
Rigid pieces are joined offline, retaining one colour draw call per item.
No new runtime decoder or library is introduced.

The original input files are retained for provenance and visual regression.
`assets/equipment-v190/build-report.json` records their hashes, final hashes,
exact sizes and texture dimensions. Reproduce using the pinned dependencies
listed in `scripts/pack-classic-equipment-v190.mjs`.

Validation covers all five rigs, shared resources, 0.3 mm bound tolerance,
stable equipment, both item IDs and both shields. The real browser comparison
checks versioned requests, real WebP decoding, front/back/angled silhouettes,
colour error, draw counts and twelve worn-equipment pose cases. Chromium's
worst silhouette overlap was 99.95%; mean per-channel image error was at most
2.34% in the controlled close-up fixture. Chromium and WebKit are gated in CI.
Neither these tests nor file size establish physical-phone FPS.
