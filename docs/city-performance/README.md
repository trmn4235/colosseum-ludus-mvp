# Spatial city backdrop

The exterior city is scenery beyond the playable courtyard/gallery. Players cannot walk into its buildings. The prior renderer nevertheless submitted tens of thousands of city vertices behind the courtyard walls: wall occlusion does not remove vertex processing, draw submission or the initial model downloads.

This follow-up compares against the first mobile-loading PR tree `b8fe9ed2f62aa9b98c4d62696725872fbf55e037`. It uses the same city artwork and source layout.

## Representation

The six source city GLBs are rendered offline from `[0, 5, 0]`, using Three.js r160 and the game's existing materials, sky lighting, exposure and distance fog. Each placed building gets a view at its own angle. The 143 views use a single lossless WebP atlas and one batched mesh with two triangles per building. The shared ground remains a separate two-triangle mesh.

Each image surface remains at the building's actual depth. This retains translation parallax between buildings and their occlusion by the courtyard, while avoiding an infinite panorama that locks the entire city to the horizon. The sky/environment map remains independent. Lighting/fog are baked into the image pixels, so the card material does not apply tone mapping or fog twice.

The owner, fighters, courtyard, flags, doors, colliders and interactive furniture are unchanged. The 48 m Colosseum, 43.3 m Pantheon and 2 km relationship remain in the source layout/metadata. Image cards approximate the appearance within the existing bounded play area; they are not suitable for walking outside, flying around buildings, a moving sun or inspecting their sides up close. Those features would require a new representation/bake or the original 3D mode.

## Cost

| Exterior city | Original 3D | Spatial backdrop |
| --- | ---: | ---: |
| Scene triangles including ground | 781,433 | 288 |
| Mesh objects | 172 | 2 |
| Distinct materials | 7 | 2 |
| Source model payload | 19,300,648 bytes | No city GLB download |
| Backdrop atlas | None | 2,132,660 bytes |
| Embedded city image RGBA + mip estimate | 32.00 MiB | 21.33 MiB atlas |

Including the manifest, the city download falls from **18.41 MiB to 2.07 MiB**, saving **16.34 MiB (88.7%)**. The isolated two-fighter fixture's complete cold source payload falls from **66.18 MiB to 49.85 MiB** after this city change.

| QA view, foreground characters hidden | Submitted triangles before / after | Draw calls before / after |
| --- | ---: | ---: |
| Courtyard north | 389,612 / 138,514 | 114 / 77 |
| Upper gallery left | 406,684 / 141,114 | 122 / 81 |
| Upper gallery right | 354,969 / 138,814 | 56 / 24 |

The fixed-pose owner and two fighters were visible for separate warmed rendering/readback timings. Median synchronized rendering times in SwiftShader were 801.2 → 286.2 ms, 980.3 → 381.2 ms and 705.3 → 352.8 ms for those three views (five samples each). This is a **50–64% reduction in this software-renderer experiment**, not game-update frame time or an iPhone FPS prediction. Readback stalls and software rendering make the absolute times unsuitable as device benchmarks.

The texture estimates use four bytes per pixel and a full mip chain, and are not measured GPU memory. Common sky and courtyard PBR maps are excluded from both sides. Lower geometry and fewer draw calls demonstrate less rendering work; local software-renderer times do not establish iPhone FPS.

## Verification

`tests/ludus-city-backdrop.cjs` loads real models/textures/renderers over local HTTP. Only account/RPC data use isolated fixtures; no live player's account is accessed. It compares 24 playable courtyard/gallery poses across eight bearings, plus three diagnostic views with foreground geometry hidden to expose the skyline. Timed frames use warmed shaders and one-pixel `readPixels()` readback to synchronize the GPU command stream. The viewport is 844 × 390, DPR 1 with touch enabled.

The fixture CSP explicitly allows `blob:`/`data:` texture decoding while blocking backend connections. The test fails on GLTF texture-load warnings, so an accidentally untextured baseline cannot count as a valid comparison. Colliders, camera obstacles, movement boundaries, office furniture and the clan chest are compared too. A missing atlas exercises the original 3D loader, with no empty skyline or blocked boot.

All **27 visual comparisons pass**: playable views stay below 1/255 mean absolute channel difference (maximum 0.6835), diagnostic skyline views below 2/255 (maximum 1.4011). Differences occur in the distant cards; their projection approximates the source model when the camera moves away from the bake point. The collider/boundary comparisons and real-asset fallback also pass. `tests/ludus-city-backdrop.test.cjs` verifies atlas integrity, retained GLB hashes, tile bounds and landmark positions; these add two checks to the existing 40-test suite.

Measured results and source hashes are in [measurement.json](measurement.json). Physical iPhone frame time, FPS, decode memory, cold/warm launch and Safari eviction behaviour remain unmeasured. The figure is source payload under uncompressed local HTTP, not production wire-transfer size.

```sh
# Node >=18, Playwright, pngjs and sharp; set NODE_PATH if needed.
# This is the first mobile-loading commit, before the city backdrop.
git worktree add --detach /tmp/ludus-city-before 34480fd6fe4c3d316fd16ef0404054609fefcc89
CITY_BASELINE_ROOT=/tmp/ludus-city-before node tests/ludus-city-backdrop.cjs
# Bake from the authored 3D source (the default source loader supports mode: '3d').
node tools/bake-city-backdrop.cjs
```

Set `CHROMIUM_EXECUTABLE_PATH` for a system Chromium, `CITY_TEST_OUTPUT` for evidence outside the checkout, and `CITY_SOURCE`/`CITY_ASSET_OUTPUT` to select bake input/output. Run browser checks sequentially with SwiftShader. The original GLBs remain untouched and available for offline baking or runtime fallback. Asset creators/licences and derivation are in [CITY_ASSETS.md](../../CITY_ASSETS.md).

| View | Original | Backdrop |
| --- | --- | --- |
| Upper gallery, left | [PNG](before-gallery-left-0.png) | [PNG](after-gallery-left-0.png) |
| Upper gallery, right | [PNG](before-gallery-right-6.png) | [PNG](after-gallery-right-6.png) |
| Diagnostic city without foreground | [PNG](before-city-centre.png) | [PNG](after-city-centre.png) |

No SQL migration, backend or hosting change is required.
