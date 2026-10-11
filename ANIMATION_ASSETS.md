# Revision 39 movement

- Owner: the existing complete `OwnerWalk` (punkduck, MakeHuman community, CC0) on the actual Mixamo rig. Normal walking uses 1.65 m/s and a one-second cycle; full joystick deflection uses a brisk 2.6 m/s walk, with cadence blended to 1.58 cycles/second. The invalid two-frame / 0.083-second `OwnerRun` export is no longer fetched or blended. Skin, clothing and anatomy remain the original meshes.
- Backward knockdown: `Death01` from [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html), CC0. The free glTF distribution was downloaded from [J-Ponzo's mirror](https://github.com/J-Ponzo/gltf-universal-animation-library). `arena-fall-motion-v39.js` samples its world rotations, limb directions and pelvis translation at 30 fps; no new character geometry is shipped.
- Recovery: the already embedded Quaternius Universal Animation Library 2 `LayToIdle` clip, CC0. It is retargeted using animated parent transforms, anatomical floor clearance and a continuous transition from the fall.
- `arena-ground-fall-v39.js` is shared by all four character renderers. Death holds the grounded pose. Temporary knockdown plays fall, hold and recovery inside the existing incapacitation period. Shield push keeps the simulation endpoint but interpolates its visual travel over 0.24 s. Weapons settle sideways to avoid pointing through the ground.

Rebake the CC0 motion with `node tools/bake-fall-motion-v39.cjs /absolute/path/AnimationLibrary_Godot_Standard.gltf`; place the corresponding `.bin` beside that glTF. The exporter uses the repository's existing Three r160 loader and built-in Node APIs.

## Revision 72 dodge roll

- `Roll` from the same [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html), CC0. Source glTF/buffer: [J-Ponzo's distribution](https://github.com/J-Ponzo/gltf-universal-animation-library/tree/main/glTF). No character mesh is imported.
- `arena-roll-motion-v72.js`: 45 samples of world rotations, limb directions and hip height relative to the source bind pose, about 51 KB uncompressed. Reproduce with `node tools/bake-roll-motion-v72.cjs /absolute/path/AnimationLibrary_Godot_Standard.gltf`.
- `arena-roll-v72.js`: adapts those samples to the existing gladiator skeleton, aligns the roll with the actual dodge direction, blends entry/recovery, and maintains anatomical floor clearance. Shared by arena, preparation, multiplayer and Ludus renderers.
- Dodge movement, 25 stamina cost, action length and immunity rules remain owned by the existing local/server simulation. The runtime maps the authored clip to that action rather than adding a second movement or invulnerability system.
