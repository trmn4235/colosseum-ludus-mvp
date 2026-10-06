# Downloaded owner assets

The human geometry is MakeHuman's ready HM08 base, exported through MPFB. No sphere/cylinder avatar is used. The browser loads `owner-makehuman-v27.glb` and two skin JPEGs from this repository.

## Sources and licences

- MPFB exporter: https://github.com/makehumancommunity/mpfb2 — GPL code, used offline in Blender; not shipped into the browser.
- Human geometry, targets, Mixamo rig, eyes, eyebrows, hair and natural male skins: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html — CC0 assets.
- Beard and moustache by Rehman Polanski; faun beard by culturalibre: https://static.makehumancommunity.org/assets/assetpacks/bodyparts05.html — selected files explicitly marked CC0/CC-0. Other pack assets are not included.
- Long robe by Donitz, `donitz_monk_robe`: https://static.makehumancommunity.org/assets/assetpacks/suits02.html — the selected source header explicitly marks CC0. Adapted to white, shortened sleeves. Its existing rope belt is retained. This is an adapted ready long tunic, not an exact reconstruction of the reference's diagonal toga drape.
- Caesar sandals by Elvaerwyn, `elvs_caesar_sandals1`: https://static.makehumancommunity.org/assets/assetpacks/shoes02.html — CC-BY (source header). Adapted from long straps to ankle height. Attribution: Elvaerwyn.
- Scruffy beard by Elvaerwyn and Dal moustache by culturalibre: https://static.makehumancommunity.org/assets/assetpacks/bodyparts06.html — CC-BY (selected source headers). Attribution: Elvaerwyn; culturalibre. Other pack files are not shipped.
- Normal walk and idle1 by punkduck: https://github.com/makehumancommunity/makehuman2 — official additional asset package, source pose metadata explicitly CC0. Downloaded BVH motion is retargeted offline to the ready Mixamo rig and embedded as OwnerWalk and OwnerIdle.
- Asset/output licence policy: https://static.makehumancommunity.org/about/license.html

## Conversion

Blender 4.5 / MPFB import the ready human and assets, interpolate anatomical weight/muscle targets, fit each attached mesh and export a skinned GLB. Four retained shapes are Thin, Heavy, Muscular and Soft. Heavy also uses the downloaded waist, head, upper-arm and thigh fat targets; clothing is refitted to each shape. Runtime blends intermediate values. Helpers are removed; face and optional-part masks are not baked into the body. Hair, eyebrows and beard retain their downloaded fitted positions; alpha-tested materials write depth so the face cannot overwrite them. Hair and facial-hair textures retain strand alpha/detail at 512px, with neutral brightness for distinct natural tinting. Other textures use up to 1024px; light/dark skin UVs match the base mesh.

The starter tunic is always white, with ankle sandals. There are 11 hair choices including bald, 6 facial-hair choices including clean shaven and 7 eyebrow choices. Skin uses downloaded light and dark human textures, not an arbitrary colour picker. Hair, beard and eyebrows use one restricted natural-colour palette.

## Limits

This is a ready human asset pipeline, not an Unreal/Unity engine migration. Locomotion crossfades between the downloaded idle and normal walk clips; movement speed is 1.45 m/s. The appearance editor does not open on login; it is available through the Ludus management room button, plus optional manual initial signup customization. The adapted garment differs from the reference’s diagonal shoulder drape. Actual device performance still needs player feedback.
