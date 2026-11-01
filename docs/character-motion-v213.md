# V213 — directional steps, attack entry and handle fit

Reconstructed against V212 (`67b7dd234364809dda6091b9ea7b19751ea6a854`).
The original unpublished V213 source could not be recovered in this session.
Later V214–V219 model/rig work is not part of this change.

- Backward and lateral stepping uses the current character's leg lengths, foot rest positions and a separate lane for each foot. Heading changes ease across display frames. Cadence follows travelled distance.
- Attack entry carries the preceding body position into the existing clip transition. Authored contact-height calibration is preserved so the hand can reach the authoritative weapon segment. Combat timing, damage, replay rules and hit detection are unchanged.
- The existing finger chains close differently for blade, pole and shield handles. This does not add independent finger or thumb bones.
- The character load is 6,622,264 bytes instead of 11,908,916 bytes (44.39% smaller). Color maps retain their dimensions; normal/material maps use 512px lossless WebP. Meshes, skin, skeleton, animation data and all non-image buffer bytes are identical. Original asset/license metadata is retained. The new filename avoids old CacheStorage entries.
- Shared arena, selection, caravan, pit and chariot consumers load the fresh model/script URLs.

## Verification

- `node tests/character-motion-v213.cjs`: 192 scenarios (8 directions × 3 weapons × 4 frame rates × 2 hands), including attack entry, movement recovery and guard. Tests exercise the actual GLB and the actual arena animator with CPU texture placeholders.
- `node tests/character-asset-v213.cjs`: image decoding and byte-for-byte geometry/skin/animation comparison.
- `node tests/anatomy-v166.cjs`: palm contact, arm pivots and armor checks across five renderers.
- `node tests/motion-stability-v165.cjs`: variable frame timing, 120 Hz interpolation and attachment/wrist limits.
- `node tests/combat-motion-replay-v163.cjs` and `node tests/locomotion-data-v91.cjs`.
- `tests/arena-browser-v96.cjs` can run the new browser scenarios with `LUDUS_CHARACTER_TEST=1`. The dedicated workflow includes Chromium and WebKit.

The session's cloud browser reports `GL_RENDERER = Disabled` and cannot create a WebGL context. Visual browser verification and a physical iPhone test are therefore not claimed here. CPU checks do not measure device FPS or certify close-up visual quality.

Repack command (requires Sharp):

```sh
node scripts/pack-character-v213.cjs gladiator-mobile.glb gladiator-mobile-v213.glb
```
