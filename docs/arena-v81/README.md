# Arena revision 81

The top bar now provides three centered pictogram tabs: Singleplayer (4×5 and Solo20), Multiplayer (existing online preparation and queue), KlanWar (future clan wars). The KlanWar panel displays sand 10×4 / 20×20 and water 10×4 / 20×2, with a single “YAKINDA” notice. These previews do not launch unsupported battles.

Four distinct poster illustrations were generated from the supplied arena screenshot, using sandstone Colosseum architecture, burgundy banners, antique gold armor, and cream sunlight. Sand cards depict squads/armies; water cards depict four ships and two ships respectively. Naval revision: the two-ship card retains the red/gold laurel team and uses a black/gold trident opposing team. The four-ship card assigns red and blue teams to the rear ships, green and white teams to the front ships. Each crew matches its banner through clothing and helmet feathers, with distinct emblems. Labels remain accessible HTML. The optimized WebP files total about 628 KB and load lazily.

## Ready-made locomotion

Quaternius Universal Animation Library Standard, CC0-1.0:
https://quaternius.com/packs/universalanimationlibrary.html

Original clips: `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`.
Download mirror (standard pack, source geometry excluded from the game):
https://github.com/J-Ponzo/gltf-universal-animation-library

Rebuild extracted joint directions with:
`python tools/extract-locomotion-v81.py /path/to/library/glTF`
Requires NumPy and SciPy. Extracted data is 41 KB, synchronous local loading, no new character mesh and no external runtime CDN. Direction-based retargeting accommodates the gladiator's different bind pose. Actual distance drives the cycle, measured speed selects walk/jog/sprint, and smoothing reduces pose jumps. Stance-foot height is corrected for target limb lengths. Combat simulation still owns movement, hits, stamina and root position; attack, recoil, falling, rolls and damage reactions retain their existing animation priority.

## Validation

- Real markup/assets: three tabs, four cards, labels, image decoding and separate header controls across 1536×706, 844×390, 667×375, 568×320.
- Real WebGL model with isolated account fixture: walk at 1 m/s, jog at 3 m/s, sprint at 6 m/s; finite joint positions; attack relinquishes locomotion.
- Existing combat/movement regression tests: 26 passed.
- No production account writes during testing. Physical phone FPS is not measured by these browser checks.
