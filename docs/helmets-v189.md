# V189: lightweight Viking and steel helmets

Both requested CGTrader assets are distinct wearable helmets, available through
the existing forge recipes and equipment catalogue. Each recipe consumes five
steel, three leather, two linen and one wool cloth, and produces one item.
These match the existing visor helmet's recipe and base catalogue price; no
new stats, currencies, permissions or combat rules are introduced.

| Resource | Original triangles | Game triangles | Download bytes | Colour draw calls |
| --- | ---: | ---: | ---: | ---: |
| Viking | 440,866 | 4,076 | 322,476 | 1 |
| Steel | 3,454 | 2,358 | 173,100 | 1 |

Each helmet has one rigid mesh, one material and three small texture images.
The colour and normal textures are 512px, with packed roughness/metalness at
256px: at most 3 MiB of decoded RGBA texture storage including mip levels per
model. Geometry and texture resources are shared between wearers. A shadow
pass can add one draw call per visible helmet caster. The source skeleton,
lights, camera and procedural shaders do not run in the game.

Models load on demand when equipped or otherwise requested by a 3D preview;
opening a page or the inventory does not preload these two models. Inventory
and forge cards use small WebP renders of the actual meshes. Concurrent load
requests share one promise, and switching back reuses the cached resource.
The five character hosts keep the helmet attached to the existing head bone.

The shared WebGL renderer is unchanged. The existing Three.js loader supports
the used WebP and mesh-quantization extensions. No new game runtime library is
needed. V188 adaptive rendering, animation scheduling and shadow budgets stay
in place.

## Verification

- Twelve new unit tests cover both IDs across arena, battle preparation,
  multiplayer, Ludus and caravan: lazy loading, load deduplication, stable
  head attachment through seven motion states, equipment switching and drops.
- Geometry, transfer and texture budgets are assertions; twenty cloned helmet
  resources share geometry and material references. Runtime wear materials
  can be per-character while retaining shared textures and geometry.
- The render test uses the actual imported character and real image decoding,
  captures front/side/back in five poses, and checks one colour draw call per
  helmet. It runs in Chromium and WebKit in CI.
- The production SQL suite applies the additive migration twice and crafts
  every recipe with exact debits, correct model identity, replay protection,
  ownership and rollback checks. The UI checks all three imported helmet
  recipes and their real pictures in five landscape viewport sizes.

These are resource and correctness checks, not physical-phone FPS measurements.
Neither zero performance impact nor a particular FPS is claimed.

Sources, licence and transformation details: `assets/equipment-v189/CREDITS.md`.
