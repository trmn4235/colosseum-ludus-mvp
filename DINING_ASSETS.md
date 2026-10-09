# Dining room V53 asset attribution

All included source models are CC0. They are ready downloaded meshes, not generated or remodelled geometry.

| Creator | Official pack | Included models |
| --- | --- | --- |
| Kenney | https://kenney.nl/assets/furniture-kit | tablecross, bench, bookcaseopen |
| Kenney | https://kenney.nl/assets/food-kit | fish, whole-ham, barrel, bowl-broth |
| Quaternius | https://quaternius.com/packs/fantasypropsmegakit.html | Bag, Cauldron, FarmCrate_Apple (free standard collection) |

Kenney GLB mirror: https://github.com/Hidencod/tge-assets/tree/08f0c913f6783cc81f9f6105a7cdda8562b1c192/packs

Quaternius GLB mirror and CC0 pack metadata: https://github.com/Papyszoo/CC0-Public-Domain-Models/tree/77343cac874f06b73d16ad0063339df7c9ca254c/packs/quaternius-fantasy-props-megakit

## Small mobile bundle

The build script preserves geometry and UVs, removes large normal/ORM maps, downsizes Quaternius colour atlases to 256px WebP, and deduplicates shared images and texture references. Kenney's small original PNG colour palette is preserved without resizing to protect palette UVs. Tables, benches and shelves share the existing Ludus wood material. Models are fitted to the room in the runtime, loaded on first dining entry, and shared on subsequent visits.

The final GLB is 398,500 bytes. Original high-resolution source files are not shipped. The apple-filled wooden crate is the lightweight produce container; it is not a wicker basket. Foods are symbolic decoration in this revision.

To rebuild, download the listed GLBs into the paths in `tools/build-dining-kit-v53.py`, then run:

```sh
python tools/build-dining-kit-v53.py /path/to/sources assets/dining/dining-kit-v53.glb
```
