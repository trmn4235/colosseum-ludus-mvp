# Circus Maximus V146 — sources and adaptations

## Roman chariot

- **Creator:** panko10 (Panko10).
- **Original:** [Roman chariot — BlendSwap 26530](https://blendswap.com/blend/26530).
- **License:** Creative Commons Attribution (CC-BY), as identified on the source listing. No license-version number is asserted here.
- **Input:** `Roman chariot.blend`, supplied by the user; original preserved.
- **Derivative:** `chariot.glb`, for this game's racing scene.
- **Changes:** applied mirror geometry, reduced subdivision and polygon count, grouped surfaces, separated left/right wheel pivots, normalized scale/orientation, added wood, bronze, iron and team-colored body materials. Wheel motion is driven by distance travelled.
- **Conversion:** `scripts/prepare-chariot-v146.py` with Blender 4.2; run with `--background --disable-autoexec`. The exported GLB contains no scripts.

## Existing game assets reused

- **Warhorse by Literock Studios:** `../caravan-field-v125/horse.glb`. See [the asset's free end-product license](../caravan-field-v125/LICENSE-Warhorse.txt). Existing canter rig and seven coat definitions are reused; the model is not offered here as a standalone download or asset pack. Metallic response is disabled for the horse coat in this scene.
- **Driver:** the game's existing `../caravan-v128/driver.glb`; posed arms, team-colored tunic, reins attached to hands and animated mouth sockets.
- Stadium geometry, scenery and materials remain from V145; see [V145 sources](../circus-v145/SOURCES.md).

This is an artistic two-horse exhibition, not a claim of exact archaeological reconstruction. The existing horse asset retains its saddle/tack geometry.
