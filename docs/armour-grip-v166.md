# Armour and hand fit V166

The source gladiator had a left elbow about 20 cm in front of its skin, asymmetric arm weights, and an unweighted right finger chain with its first pivot about 24 cm from the wrist. Limiting wrist angles on that skeleton preserved the underlying defect.

`arena-anatomy-v166.js` repairs this specific source rig before rest poses and equipment binds are captured. The left joints and skin weights follow the mesh's bilateral symmetry. Inverse binds and finger vertex positions are rebased to preserve the original rest surface. The caravan driver's independent skeleton retains its authored binds.

The grip solver uses a stable elbow plane, distributes pronation through the forearm, and limits wrist bend. Hands follow the physical shaft or imported sword handle while the weapon anchor retains the combat contact segment. At the arm's reach limit, shoulder translation is capped at 2.5 cm and reset each frame. Carrying and shield poses use the same hand solver. Its temporary vectors and quaternions are cached; iterations stop once the palm error is below 0.1 mm.

The flat breastplate is fitted to the body's rest surface with approximately 9–17 mm clearance. Its torso panel and two retaining straps follow the ribs instead of stretching with upper-arm weights. Flexible shoulder tips and the separate full cuirass keep their surface blends. The decorative team hoop is hidden when chest armour is worn.

The shared changes are loaded by arena, preparation, multiplayer, caravan and ludus renderers. Client navigation and script versions advance to 166.

## Regression coverage

- `tests/anatomy-v166.cjs`: original/rest surface agreement, symmetrical arm pivots, chest clearance, actual palm contact, shoulder correction bounds, geometry reuse; 7,200 frames across five renderers and four weapons in both hands.
- `tests/equipment-stability-v164.cjs`: 2,870 posed frames, both armour families, helmet locking, item swaps, independent skeletons, shared fitted geometry, and the caravan driver. A rigid breastplate is compared with rib landmarks rather than adjacent upper-arm skin.
- `tests/armour-grip-browser-v166.cjs`: real WebGL assets and 17 close views, including the ludus selection renderer; verifies palm contact while entering attack from walking. Mid-attack screenshots are reached through time progression rather than teleporting into a contact pose.
- Existing combat behavior, contact geometry, motion stability and touch/input recovery tests remain in the release checks. CI now includes the new anatomy and armour checks.

Browser validation uses isolated account fixtures and does not create production battles. Software Chromium checks do not constitute physical iPhone or Safari validation. The previously reported permanent action lock was not reproduced, so this release does not claim that every possible action-lock cause has been resolved.
