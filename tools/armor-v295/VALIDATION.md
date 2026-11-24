# Preparation-tool verification — 2026-11-23

Executed with Blender 4.3.2 from the `armor-v295` checkout. All generated GLBs and JSON reports were written to `/tmp/armor-v295-check/`; no production model was overwritten. **The Aegis, Hoplomachus and Roman Officer source downloads were not available during these checks. These results validate the preparation tool on existing project assets, not those three requested assets.**

## Commands executed

```bash
blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- audit --input gladiator-mobile-v217.glb --report /tmp/armor-v295-check/gladiator-audit.json

blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- optimize --input assets/equipment-v199/gladiator_chest.glb --output /tmp/armor-v295-check/chest-2k.glb --target-triangles 2000 --report /tmp/armor-v295-check/chest-2k.json

blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- audit --input /tmp/armor-v295-check/chest-2k.glb --report /tmp/armor-v295-check/chest-reimport.json

blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- optimize --input gladiator-mobile-v217.glb --output /tmp/armor-v295-check/gladiator-60k.glb --target-triangles 60000 --report /tmp/armor-v295-check/gladiator-60k.json

blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- audit --input /tmp/armor-v295-check/gladiator-60k.glb --report /tmp/armor-v295-check/gladiator-reimport.json
```

The first two commands were rerun with `--overwrite` after disabling Blender's imported bone-display helper; the final results below exclude that helper.

## Measured results

| Check | Existing chest | Existing gladiator |
|---|---:|---:|
| Source GLB triangles | 3,305 | 64,568 |
| Blender-imported triangles | 3,297 | 64,568 |
| Target triangles | 2,000 | 60,000 |
| Exported/reimported triangles | 2,000 | 59,992 |
| Exported bytes | 43,720 | 5,002,148 |
| Exported meshes | 1 | 8 |
| Exported skins | 0 | 1 |
| Reimported bones | 0 | 34 |
| Exported animations | 0 | 1 |
| Exported materials | 1 | 2 |
| Required extensions | None | `EXT_texture_webp` |
| Structural checks / budget | Passed / met | Passed / met |

The chest's eight-face source/import difference is recorded in the report; Blender discarded degenerate source geometry during import. This chest has no UV layer or skin, so the additional gladiator test exercised the textured/skinned path.

The gladiator reimport retained all 34 bone names, all mesh UV-layer names, six image dimensions, eight skinned meshes, and the one animation action over frames 0–100. No unweighted skinned vertices were found. Bone-display geometry is disabled on import (`disable_bone_shape=True`); otherwise Blender adds an unrelated 80-triangle Icosphere helper to the scene audit.

Blender printed that its optional Draco library was unavailable; export explicitly disabled Draco and completed successfully. It also warned that multiple image shader nodes map to one glTF texture sampler; this warrants material review on actual sources. No Draco, Meshopt or KTX2 extension was emitted.

These are structural round-trip checks, not a comparison of rendered poses or visual quality. No texture/normal-map baking, retargeting, new rig creation, bot integration, mobile GPU measurement, or source-asset download was performed. FBX/OBJ import branches and optional texture resizing were not exercised by these GLB fixtures.

The CLI writes structural errors and budget misses to the report before raising an exception. Use the documented `--python-exit-code 1` invocation so automation receives a nonzero status. Fixture reports and models remain temporary and are not included in git.
