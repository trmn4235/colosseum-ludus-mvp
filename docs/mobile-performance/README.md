# Mobile loading investigation

Baseline: `af08a6a` (including the two courtyard clan banners). Owner/equipment GLB/image bytes, materials, geometry, fitting, appearance choices and gameplay rules are preserved. The distant city uses image cards baked from its original models/materials; the complete [city comparison](../city-performance/README.md) covers projection differences and the original 3D fallback.

## What is actually requested

The anonymous `index.html` launch requests HTML, `owner-avatar.css`, `owner-three-r160.js` and `owner-avatar.js`: about 4.24 MiB of uncompressed source payload. **No GLB is requested until the user enters Ludus or opens the appearance editor.** See [login-measurement.json](login-measurement.json). The login page's inline background/library payload remains a separate improvement opportunity.

In the authenticated Ludus fixture, the browser requests:

- `owner-makehuman-v27.glb`, `owner-run-v30.glb`, and both owner skin JPEGs. All appearance variants/morphs are still in the owner GLB, including currently hidden hair and facial-hair meshes.
- `gladiator-mobile.glb`, plus `roman_scutum_shield.glb`, `roman_shield.glb` and `roman_spatha.glb`. These three equipment templates currently load for every nonempty roster, including when some are unequipped.
- Originally six city GLBs: insula, forum, temple, gateway, city Colosseum and Pantheon. These now load only in the 3D fallback; the default city downloads a small manifest and one lossless WebP atlas, with 143 spatial image cards. The sky JPEG and courtyard/ground PBR maps remain. The city Colosseum is a **different asset** from the arena's `Colosseum.glb`.
- Previously: arena `Colosseum.glb` from the gladiator loader's idle prefetch, the desk, wardrobe, daily book and clan chest during boot. Room models now load on first room entry; the arena model waits for arena/battle navigation.
- Previously: four helmets, four armours, PBR maps and several UI thumbnails were downloaded as base64 **inside each of four HTML documents**. They are now shared files with SHA-256-derived names. PBR maps load when their materials are created; UI thumbnails load when used. An empty roster now skips the gladiator/equipment pipeline entirely.

GLB texture images are bufferViews inside the requested GLB, not additional external image downloads. `assets.json` records those embedded image sizes and dimensions. The asset manifest maps each extracted file to its original bytes and pages.

## Measured comparison

The measurement uses real HTTP requests, original models/textures and the complete renderer, with isolated account/RPC fixtures (two fighters with representative equipment). It does not access a player's account. The baseline and candidate use fresh browser contexts at 844×390, DPR 1 with touch enabled. HTTP is intentionally uncompressed with `max-age=600`; Cache Storage remains enabled. Source-byte totals exclude fixture injection and protocol headers. Resource Timing also records the actual fixture response sizes and durations.

| Cold authenticated Ludus | Before | After |
| --- | ---: | ---: |
| Requested source payload | 87.40 MiB | 49.85 MiB |
| `ludus.html` source | 8.00 MiB | 1.34 MiB |
| Arena GLB at boot | 15.09 MiB | 0 |
| Room GLBs at boot | 4.46 MiB | 0 |
| City model / backdrop source | 18.41 MiB | 2.07 MiB |

The reduction is **37.55 MiB (43.0%)** in the uncompressed fixture. The first shared-asset/lazy-room step reduced startup to 66.18 MiB; the subsequent city backdrop removes another 16.33 MiB from the complete startup trace. These are observed resource bytes, not a claim about production wire transfer, iPhone startup time, frame rate, or GPU memory. Production HTTP compression, cache eviction, device, connection and roster size change the totals/timings. The individual local timings in `measurement.json` are single runs under Chromium/SwiftShader and should not be treated as device benchmarks. Cellular latency and HTTP multiplexing still need device validation; extracted inline resources become separate, cacheable requests.

The owner GLB also uses the existing validated persistent cache in Ludus; the fixture's reload does not fetch it again. Standalone login/appearance preview pages retain their existing loader fallback. Cache Storage failures retain the network path.

Shared equipment URLs use the same persistent cache on all four renderer pages. The two office books previously caused two GLTF parses (the in-flight HTTP request could already be deduplicated by Three.js); they now use one parse and separate scene clones sharing geometry/materials. Room re-entry causes no extra GLB requests. Office entry generations and the existing chest generations discard late attachments after leaving a room. Equipment is ready before fighter creation, avoiding a late optional weapon download leaving a procedural template cached.

## Geometry and texture cost

Counts below are unique source primitive triangles, not total visible triangles or per-frame work. Mesh cloning/visibility/instancing change rendered cost. RGBA + mipmap estimates assume four bytes per pixel and a full mip chain; they are **not measured VRAM** and include images the renderer may never upload.

| Model | File MiB | Source triangles | Embedded images MiB | Estimated RGBA + mips MiB |
| --- | ---: | ---: | ---: | ---: |
| `owner-makehuman-v27.glb` | 20.42 | 147,560 | 6.74 | 66.67 |
| `gladiator-mobile.glb` | 11.36 | 78,158 | 7.11 | 48.00 |
| `Colosseum.glb` | 15.09 | 198,225 | 4.62 | 15.11 |
| `colosseum-city-v29.glb` | 5.30 | 104,633 | 0.00 | 0.00 |
| `pantheon-city-v29.glb` | 3.06 | 122,372 | 0.00 | 0.00 |
| `rome-insula-v30.glb` | 2.80 | 3,618 | 2.52 | 10.67 |
| `rome-gateway-v30.glb` | 3.80 | 62,468 | 0.00 | 0.00 |
| `roman_scutum_shield.glb` | 4.19 | 1,466 | 4.10 | 16.00 |
| `roman_shield.glb` | 2.80 | 1,246 | 2.73 | 16.00 |
| `imperial-desk-v31.glb` | 3.08 | 3,698 | 2.83 | 16.00 |

The owner contains 104 morph targets across primitives; reducing or merging this geometry must preserve all appearance controls, skinning and animation. The gladiator texture payload is 7.11 MiB of its 11.36 MiB file. The large shield files are almost entirely textures, so geometry-only compression will have little effect on them. The two distant monuments retain 227,005 source triangles together in the authored GLBs. The default skyline now uses the verified spatial backdrop; the original geometry remains in the repository for offline baking and fallback.

## Compression decisions

| Option | Value / required follow-up | This PR |
| --- | --- | --- |
| External, hashed binary/image resources | Removes base64 source/decoding, permits shared caching; original pixel and geometry bytes retained | Applied |
| Gzip/Brotli delivery | Lossless wire-size reduction; must verify host response headers and content types. `gzipBytes` in the trace is a modeled potential, not observed transfer | Evaluated; no hosting change |
| Meshopt | Covers geometry, morphs and animation. Default glTF Transform pipelines reorder/quantize; verify error, bind pose, all owner morphs and combat clips. Requires a matching decoder and delivery compression | Evaluated; decoder not wired |
| Draco | Geometry-oriented; does not replace texture compression or reduce triangle/draw counts. Requires a matching decoder and decode-time checks | Evaluated; decoder not wired |
| KTX2/Basis | Targets GPU texture storage as well as transfer. Test UASTC for normals/alpha/detail and ETC1S for suitable colour maps; preserve sRGB vs linear maps and mip behaviour | Evaluated; needs transcoder and iPhone quality/support tests |
| Spatial city backdrop / loadout-specific equipment | Baked city cards retain approximate depth/parallax within the bounded courtyard; loadout-specific assets can avoid unused equipment | City cards applied after 27 visual comparisons; loadout-specific equipment remains follow-up |

Primary references: [glTF Transform Meshopt](https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression), [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [Three.js KTX2Loader](https://threejs.org/docs/pages/KTX2Loader.html), [Three.js DRACOLoader](https://threejs.org/docs/pages/DRACOLoader.html). The embedded loader is r160; a production codec integration must use compatible, version-pinned loaders/decoders. File compression alone does not establish a frame-rate improvement.

## Validation and reproduction

- `tests/mobile-assets.test.cjs`: verifies every extracted SHA-256/size/container, common paths on all four pages, and (with `BASELINE_ROOT`) exact identity to prior embedded resources.
- `tests/mobile-login.cjs`: traces anonymous launch and checks that no GLB loads.
- `tests/mobile-loading.cjs`: captures cold/reload/room network phases, compares courtyard/office/clan images and colliders, opens the dual inventory, checks book loading and no room re-downloads, and verifies the owner cache on reload.
- Existing combat, equipment, city/camera and owner suites: 37 checks; shared assets add three and the city atlas adds two, all **42 passing**.
- The city browser comparison verifies 24 playable poses, three exposed-skyline diagnostic views, synchronized rendering/readback cost, unchanged colliders/boundaries and the missing-atlas 3D fallback.
- Existing multiplayer V36 integration passes eight viewport sizes, real Colosseum rendering, all five swipe regions, two-player damage, lost-response retry, held guard, dodge and portrait gating.
- Existing clan-room integration verifies chest collision, no tunnelling, walking around furniture, both inventories, movement resumption and stale colliders. Existing level-office integration verifies appearance entry, level arrows, collision and closing resumption.

Run browser tests sequentially when using SwiftShader: concurrent software renderers can exhaust the screenshot/initialization timeout budget.

```sh
# Node >=18; install Playwright and pngjs in your test environment.
# Set NODE_PATH if the modules are outside this checkout.
git worktree add --detach /tmp/ludus-baseline af08a6a
BASELINE_ROOT=/tmp/ludus-baseline node --test tests/mobile-assets.test.cjs
BASELINE_ROOT=/tmp/ludus-baseline node tests/mobile-loading.cjs
node tests/mobile-login.cjs
node --test tests/combat-feel-v23.test.cjs tests/equipment-arena-v30.test.cjs tests/ludus-city-v29.test.cjs tests/owner-avatar-v26.test.cjs
# Python + Pillow; emits a report without modifying any GLBs.
python tools/mobile-asset-audit.py > docs/mobile-performance/assets.json
```

Set `CHROMIUM_EXECUTABLE_PATH` for a system Chromium; browser tests fall back to `/tmp/chromium` in this workspace. `LUDUS_TEST_OUTPUT` can move the generated browser evidence outside the repository. The complete network phases and source counts are in [measurement.json](measurement.json); the model inventory is in [assets.json](assets.json).

| View | Before | After |
| --- | --- | --- |
| Courtyard | [PNG](before-courtyard.png) | [PNG](after-courtyard.png) |
| Office | [PNG](before-office.png) | [PNG](after-office.png) |
| Clan room | [PNG](before-clan.png) | [PNG](after-clan.png) |

All three screenshot pairs passed the pixel-difference budget (mean absolute channel difference below 2/255, observed maximum 0.1592); small idle-animation differences remain. Resource byte identity provides the stronger check for unchanged owner/equipment quality; distant image cards are covered by the separate 27-view test. The updated fixture CSP allows GLTF `blob:`/`data:` texture decoding. Auth/backend responses are fixtures, not a live account/backend regression claim.

**Physical iPhone performance remains unmeasured.** Device validation should cover cold and warm launch on the same connection, first room entry, appearance options, equipped combat, sustained frame time and Safari memory pressure. No publish, merge, SQL or backend change is included.
