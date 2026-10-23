# V170 — selected Fantasy Bandit locomotion

Only `Bandit@walk.fbx`, `Bandit@run_forward.fbx`, and `Bandit@idle.fbx` are used. Source: tokeshi, [Fantasy Bandit on CGTrader](https://www.cgtrader.com/free-3d-models/character/man/fantasy-bandit), downloaded in the user-selected archive. Source license recorded at acquisition: Royalty Free License (no AI). These files are processed deterministically, not with generative tools. Source characters, textures, and original FBX files are not shipped. The baked curves are integrated into this game, not offered as a standalone animation pack.

Reproduce with Three.js 0.160.0:

```
node tools/bake-bandit-locomotion-v170.mjs /path/to/extracted/fbx /path/to/three
```

Each clip has 49 normalized skeletal samples. Original file SHA-256 hashes and durations are embedded in the data. FBX duplicate bone names resolve to the first node, matching AnimationMixer binding. Torso rotations use the same neutral idle reference across all clips. Travel cycles align to the left foot's forward extreme. Quaternion, direction, and hip-height seams close gradually; horizontal source translation is discarded. The existing gladiator supplies proportions, equipment attachments, and simulation movement.

The clips are in-place: no authoritative travel speed is supplied by the source. Walk stride is estimated from foot excursion; run stride is calibrated to the existing game's run (3.11 target leg lengths per cycle). These are game calibration values, not measured source velocities. Cycle advancement uses actual traveled distance, with filtered speed controlling walk/run mixing. Stopping crossfades into the 3.367-second idle. This does not change simulation speed or turn the player's character automatically.

Arena, survival/multiplayer battle pages, the Ludus rig, and caravan battles load the selected data. The earlier CMU data stays available for fallback; V170 directly blends the selected walk and run, without inserting the old jog between them. Training practice, attacks, reactions, rolls, death, and naval actions retain their own animation paths. Authored guard, polearm idle, and bow actions retain precedence. Armed idle hands preserve equipment poses. The existing equipment/anatomy pass still runs after locomotion.

Validation: selected clip structure/seams, five rig contexts, walk/run/idle transitions, finite bone transforms, bounded feet, combat precedence, existing helmet/anatomy/stability regression tests, and browser renders of unarmed, sword/shield, and trident poses. These checks are not a claim of measured iPhone FPS or perfect foot-locking. Dedicated directional combat walks remain a separate need; the existing lateral/backward approximation is retained.
