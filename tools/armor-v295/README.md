# V295 asset preparation

These commands audit and optimize **officially downloaded source files**. They do not download models, obtain viewer files, change game equipment, add bots, create a rig, retarget animations, or publish the game. Blender 4.3.2 is installed at `/usr/bin/blender`; no additional packages are required. Source files are never overwritten.

The requested assets are **full Aegis and Hoplomachus bot models** and **Roman Officer chest armor in two color variants**. Keep Aegis and Hoplomachus as whole characters; the optimizer does not automatically identify armor, remove body regions or extract the Officer chest. The Officer source must be inspected and the intended chest geometry selected/exported before optimization. Two color variants should share geometry and textures when practical.

Run from the repository root. `--python-exit-code 1` makes Blender return a failure if the script fails. Structural issues or an exceeded triangle budget write the JSON report first, then raise an error. Input can be GLB, glTF with its dependencies, FBX or OBJ with its MTL/textures. A destination that exists is rejected unless `--overwrite` is supplied.

```bash
blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- audit --input /tmp/armor-source/aegis.glb --report /tmp/armor-work/aegis-source.json

blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- optimize --input /tmp/armor-source/aegis.glb --output /tmp/armor-work/aegis-12k.glb --target-triangles 12000 --report /tmp/armor-work/aegis-12k.json

blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- optimize --input /tmp/armor-source/hoplomachus.glb --output /tmp/armor-work/hoplomachus-8k.glb --target-triangles 8000 --report /tmp/armor-work/hoplomachus-8k.json

blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- optimize --input /tmp/armor-source/officer-chest.glb --output /tmp/armor-work/officer-chest-3k.glb --target-triangles 3000 --report /tmp/armor-work/officer-chest-3k.json
```

If visual inspection rejects those budgets, repeat from the **original input**, using 15000/10000/4000 triangles and distinct output/report filenames. Do not repeatedly decimate an already simplified model. Budgets are total mesh triangles, not triangles per part. The tool proportionally distributes the budget across mesh objects; manually tune or separate small silhouette details when a uniform reduction damages them. A source already below budget is not subdivided.

`--texture-max 1024` optionally resizes images in memory. It is intentionally opt-in: default output retains image dimensions. Texture resizing does not bake detail, and it does not renormalize a resized tangent-space normal map. Review metallic highlights and normal-map shading before accepting resized maps.

The report records source SHA-256, scene/mesh/triangle counts, material and image inventory, UV layers, armatures and bone names, skin weight diagnostics, animation actions, per-mesh before/after counts, export extensions and warnings. Exported GLB uses ordinary geometry without Draco/Meshopt/KTX2 requirements. Blender retains UV layers and vertex groups through decimation, but texture distortion, silhouette, custom normals and skin deformation still need visual inspection. Shape-key meshes are skipped rather than silently destroying morph targets. No normal map is baked. More than four skin influences are retained and flagged; do a reviewed four-weight conversion before using such a source in the current runtime.

## Reproducible local verification

These commands read existing project assets and write only temporary results:

```bash
blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- audit --input gladiator-mobile-v217.glb --report /tmp/armor-v295-check/gladiator-audit.json

blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- optimize --input assets/equipment-v199/gladiator_chest.glb --output /tmp/armor-v295-check/chest-2k.glb --target-triangles 2000 --report /tmp/armor-v295-check/chest-2k.json

blender -b --factory-startup --python-exit-code 1 --python tools/armor-v295/prepare_assets.py -- audit --input /tmp/armor-v295-check/chest-2k.glb --report /tmp/armor-v295-check/chest-reimport.json
```

Before accepting actual downloaded models, compare source and optimized turntables under identical lighting, then test idle, attack, guard, roll and recovery. Inspect knee/elbow silhouettes and intersections, UV seams, shading, texture size and draw calls. The automated structural checks are not a visual-quality or runtime-compatibility approval.

## Current combat compatibility

The active model is `gladiator-mobile-v217.glb` (one 34-joint Mixamo-style skin). `ImportedGladiator.create()` normalizes the character to 2.08 units and `ArenaAnatomy.prepare()` repairs source-specific arm pivots and inverse binds before poses are captured. Combat references named Hips/Spine/Arm/ForeArm/Hand/Leg bones. An unrigged character or a different skeleton will **not** become a working bot merely by replacing the GLB URL. Full bot models need a separate compatible skeleton/weight-transfer and animation validation step after their actual source files are inspected. Preserve the current rig as reference; do not duplicate its source-specific repair onto an unrelated skeleton without checking it.

For the Officer chest, `ArenaEquipmentFit` already supports binding worn torso armor to the body's skeleton; it accounts for the source rest pose differing from inverse-bind space. Naive weight copying can shift the armor when animation starts. Existing armor ID mappings and dimensions are explicit and require a later reviewed runtime integration.

Current `THREE.GLTFLoader` calls do not configure Draco, Meshopt or KTX2 decoders. Plain GLB with embedded PNG/JPEG is the conservative export; the existing game also loads WebP (`EXT_texture_webp`). Adding compressed geometry requires a separate loader change and verification.
