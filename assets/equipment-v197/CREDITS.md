# Anatomical equipment fit — V197

Source authors and CC BY 4.0 attribution remain as documented in [V196 credits](../equipment-v196/CREDITS.md): Andy Woodhead (segmented arm guard), maned (lion arm guard and trident), and eissg (leather arm guard). Original source URLs and extraction details are retained there.

V197 modifications are deterministic mesh processing only. Upper-arm and forearm surfaces are fitted offline to the game's bind-pose body, with 9 mm clearance and retained embossed detail. Rays are restricted to the nearby arm surface to exclude the torso. Shoulder caps use corrected bind-pose offsets. The trident shaft is aligned to its longitudinal axis, scaled 1.20 along that axis and 1.30 across it, and positioned with 29 cm of shaft behind the resting grip. Normals are recalculated; topology and source textures are retained. Triangle counts and draw calls are unchanged.

Rebuild from the repository root with the V196 preparation dependencies:

```sh
node scripts/capture-arm-fit-v197.cjs /tmp/arm-fit-v197.json
node scripts/fit-armour-v197.mjs /tmp/arm-fit-v197.json
```

The maned assets' NoAI restriction is respected: neither their geometry, textures nor rendered imagery was submitted to an image generation service. The replacement inventory illustrations are independent artwork; see [V197 icon notes](../items-v197/CREDITS.md). Only selected equipment packages are fetched at runtime; no whole source characters or added animation data are shipped.
