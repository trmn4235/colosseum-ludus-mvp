# Two lightweight helmets — V189

These files are incorporated game resources, not a standalone model download.
The original FBX, BLEND and RAR files are not distributed in this repository.
The existing authenticated `.cme` resource container is used; the shipped client
can decode it, so this is packaging rather than a claim of unbreakable DRM.
No generative AI was used to process, texture or render either model.

## Boynuzlu Viking miğferi — sujanmondals605

- Source: https://www.cgtrader.com/free-3d-models/character/clothing/viking-horned-helmet-3d-model-game-ready-asset
- Author: https://www.cgtrader.com/designers/sujanmondals605
- License displayed at download: Royalty Free License (no AI).
- The downloaded FBX is 9,742,796 bytes. The native Blender model evaluates to
  440,866 triangles; it is reduced offline to 4,076 triangles. The listing's
  advertised GLB is not the source used for this build.
- Original procedural metal and horn materials are baked into one atlas,
  preserving the material treatment without running procedural shaders in-game.
  The unbundled horn colour/displacement references in the BLEND are restored
  from the exact named Poly Haven source, using its 1K variants.
- Referenced CC0 texture: **Cracked Concrete Wall**, Dimitrios Savva and
  Rico Cilliers: https://polyhaven.com/a/cracked_concrete_wall
  License: https://polyhaven.com/license
- Reductions: curved horn and shell geometry, unused lights/cameras/curves;
  one rigid mesh/material; 512px colour/normal and 256px roughness/metalness;
  quantized attributes; game-scale skull fit and centring.

## Çelik miğfer — lesrode

- Source: https://www.cgtrader.com/free-3d-models/military/armor/steel-helmet
- Author: https://www.cgtrader.com/designers/lesrode
- License displayed at download: Royalty Free License (no AI).
- Source `Helmet_low.fbx`: 137,472 bytes, 3,454 triangles. Source `Textures.rar`:
  26,884,223 bytes, including original 2K PBR textures.
- The shell and upper cross retain all their geometry; excess rivet geometry is
  reduced. Final result: 2,358 triangles, one rigid mesh/material.
- Original base colour, normal, roughness and metalness maps are resized and
  packed. Colour/normal are 512px, roughness/metalness are 256px. The model is
  rotated to face the character's forward direction and fitted to the head.

## Build and verification

`build-report.json` records exact source/output triangle counts, byte sizes,
texture dimensions, per-part reductions and resource SHA-256 hashes.

Preparation: Blender 4.5.9 LTS with automatic source scripts disabled;
`scripts/prepare-helmets-v189.py`, then `scripts/pack-helmets-v189.mjs` using the
pinned dependency versions documented in its header. Sources remain private.
The native source was saved by Blender 5.1; the materials used for this bake
are supported in the preparation version. Images are ordinary offline Cycles
bakes and inventory photographs are renders of the actual in-game resources.

CGTrader terms: https://www.cgtrader.com/pages/terms-and-conditions (21A/21B).
Use is incorporated into this game. Do not publicly redistribute source models
or feed these licensed assets to generative AI or training tools.
