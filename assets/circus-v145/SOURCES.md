# Circus Maximus V145 asset provenance

All downloads are served locally with the scene. No runtime requests go to asset providers.

| File | Source / author | Rights | Scene adaptation |
| --- | --- | --- | --- |
| figure.glb | [SMK Open, KAS644](https://open.smk.dk/artwork/image/KAS644), plaster cast of a classical standing figure; [museum record](https://api.smk.dk/api/v1/art/?object_number=KAS644) | Museum record: public domain; [SMK-supplied 3D file and CC0 dedication](https://commons.wikimedia.org/wiki/File:Ubekendt,_St%C3%A5ende_n%C3%B8gen_mand,_Germanicus,_Octavian_,_,_KAS644,_Statens_Museum_for_Kunst,_3D_model.stl) | Source STL reduced from 1,505,550 to 4,800 triangles; Z-up to Y-up; normalized height; new marble material. |
| bust.glb | [Marble Bust 01 — Rico Cilliers / Poly Haven](https://polyhaven.com/a/marble_bust_01) | [CC0](https://polyhaven.com/license) | 3,600 triangles, normalized height, geometry only; scene marble. Renaissance-style asset used as artistic classical decoration, not an identified ancient portrait. |
| horse.glb | [Horse Statue 01 — Rico Cilliers / Poly Haven](https://polyhaven.com/a/horse_statue_01) | [CC0](https://polyhaven.com/license) | 4,800 triangles; hooves morph baked; original wooden base removed; normalized height; bronze instead of porcelain. |
| spectators-16.webp | Generated specifically for this scene with the built-in image generation tool | Project-generated | New 4×4 atlas, 16 seated adults, alpha preserved; resized to 1536×1536 and encoded as WebP with Sharp. |

Source geometry was simplified offline with trimesh and fast-simplification. There is no runtime decoder or dependency added to the game. GLB files contain geometry, not external textures.

This is an artistic reconstruction. The placement of these sculptures does not claim that these particular works stood in the historical Circus Maximus.

## Image generation record

Mode: built-in image generation, new transparent image (no reference image).
Project path: `assets/circus-v145/spectators-16.webp`.

Final prompt:

> Use case: historical-scene. Asset type: transparent 3D game seated crowd texture atlas, not a scene or poster. Create a precise uniform 4 columns by 4 rows grid of SIXTEEN distinct full-body seated ancient Roman spectators, each person centered entirely inside its own equal square cell, with at least 8% transparent padding on every cell edge. True transparent background everywhere between people, no benches, chairs, floor, backdrop, grid lines, cast ground shadows, captions or text. Each person sits naturally on an invisible bench, torso upright, knees bent, feet down, anatomically convincing hands and faces, whole head and feet fully visible. Front three-quarter view, mostly looking slightly toward camera-left, a few camera-right, subtle different poses (hands on knees, folded hands, chatting, one applauding, one leaning forward); all with consistent apparent seated height and camera focal length. Diverse adult Mediterranean men and women, old and young adults, varied hair/beards and skin tones, linen tunics, plain togas and stolas, worn muted ivory, rust, wine red, dusty blue, olive, ochre. Historically inspired classical Roman clothing with detailed textile folds, natural skin texture. Photoreal live action costume photography, soft neutral outdoor ambient light, no dramatic highlights, no cartoon or painted look. Exact equal 4x4 atlas packing is essential so each of 16 separate figures can be cropped by UV coordinates. Square image 2048x2048.

Retained assets (V142–V144): photographed stone/wood/plaster/roof PBR maps credited in those release notes; generated sand, marble and relief atlases; Polyy.AI tree meshes. Sand still loads from `assets/circus-v144/arena-sand.webp`.

