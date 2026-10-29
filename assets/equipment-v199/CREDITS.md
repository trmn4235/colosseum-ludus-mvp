# Original chest restored — V199

`gladiator_chest.glb` is derived from the existing user-supplied `assets/equipment/gladiator_chest-e2f685b66fb6.glb`. Source attribution and material metadata are retained. The original source remains unchanged; no new model source or license is introduced.

Offline processing joins compatible pieces, welds vertices and simplifies the original 50,880-triangle mesh to 3,305 triangles in one primitive. File size falls from 1,212,096 bytes to 67,616 bytes. There are no embedded textures. Float positions are retained for compatibility with the existing armour geometry merger. The existing runtime fit and material behavior remain in use.

Reproduce with `node scripts/pack-chest-v199.mjs .`, using `@gltf-transform/core`, `@gltf-transform/extensions` and `@gltf-transform/functions` 4.1.1, `meshoptimizer` 0.22.0 and `sharp` 0.34.3. Source/output hashes are in `build-report.json`.
