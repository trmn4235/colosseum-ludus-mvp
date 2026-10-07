# Rome city assets — V29

The city is a distant game backdrop. Its neighbourhood layout and ludus position are artistic, not a surveyed reconstruction. North is -Z; east is +X. The supplied gameplay specification sets the Colosseum to 48 m high, the Pantheon to 43.3 m high, and the monument centres to exactly 2 km apart, with the Colosseum southeast of the Pantheon. The Pantheon entrance faces north.

| Asset | Creator and source | Licence | Modifications |
| --- | --- | --- | --- |
| `colosseum-city-v29.glb` | **Vladyslav Holhanov**, [original Colosseum model](https://sketchfab.com/3d-models/colosseum-a416564e36fb450594c45b1bce119188); downloaded from [Objaverse / Zenodo](https://zenodo.org/records/10357365) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Merged geometry, welded chunk borders, reduced distant detail; adapted to a 188 × 156 m footprint and 48 m height; replaced material with existing photographed sandstone PBR. The source depicts the complete ancient exterior. |
| `pantheon-city-v29.glb` | **Brian Trepanier / CMBC**, [Pantheon, Rome, Italy](https://sketchfab.com/3d-models/pantheon-rome-italy-8ce20ac5fc3a4af7ab223cdc0caa7d27); downloaded from [Objaverse / Zenodo](https://zenodo.org/records/10269393) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Cropped the scan to the rotunda and entrance portico, excluding the surrounding modern urban block; retained source triangles, merged coincident vertices, smoothed normals, removed the low quality embedded atlas and applied sandstone PBR in-game, set height to 43.3 m. This scan is used at skyline distance, not as an explorable building. |
| `rome-sky-v29.jpg` | **Greg Zaal; sky edits by Jarod Guest**, [Kloppenheim 03 Pure Sky](https://polyhaven.com/a/kloppenheim_03_puresky) | [CC0](https://polyhaven.com/license) | Photographed tonemapped equirectangular panorama, resized to 4096 × 2048 and JPEG compressed. Used as background and environment. |
| `rome-roof-diff-v29.jpg`, `rome-roof-nor_gl-v29.jpg` | **Stephan Seeliger**, [Roof Tiles](https://polyhaven.com/a/roof_tiles) | [CC0](https://polyhaven.com/license) | Downloaded 1K diffuse and OpenGL normal maps; applied to tiled gable roofs. |

Existing masonry, plaster and wood PBR texture attribution remains in the repository's earlier asset credits. V29 retains the downloaded V28 owner model and motions unchanged; see [OWNER_ASSETS.md](OWNER_ASSETS.md).

No licence claims in this document cover the original owners' names, trademarks, or endorsement.

## V30 downloaded city architecture

The procedural exterior boxes, roofs and windows were removed. Ready models keep their original authored geometry and materials; the browser only places, rotates and scales them. These distant assets are not new buildings drawn by Codex.

- Roman Insula 1, Roman Forum and Roman Temple by AlexFerrart3D / lexferreira89, CC BY 4.0:
  - https://sketchfab.com/3d-models/low-poly-roman-insula-1-wip-6562e2ffeb3c4bd8ae5b714c6600db20
  - https://sketchfab.com/3d-models/low-poly-roman-forum-wip-3babeeadb8684bfdbeba9f816084c429
  - https://sketchfab.com/3d-models/low-poly-roman-temple-wip-5953273cfe5346cbacf704809a404c83
- Porta Nigra, MicMac, CC BY 4.0: https://sketchfab.com/3d-models/porta-nigra-roman-city-gate-in-trier-germany-f96abfafd34040a4bb09f5e2973403e9 . Adapted to a distant mesh LOD, approximately 60k triangles; used as a Roman architectural background asset, not as a claim that Trier's gate stood in Rome.
- Download distribution: Allen Institute for AI Objaverse 1.0, https://huggingface.co/datasets/allenai/objaverse . Original GLB metadata contains author, source and CC BY licence.

The ludus is between the monuments for a balanced distant skyline. Colosseum [820,0,650] and Pantheon [-594.21356,0,-764.21356] retain the specified 2,000m southeast relationship and heights 48m/43.3m. A clear street corridor prevents city houses covering either monument. There are no landmark-view buttons.
