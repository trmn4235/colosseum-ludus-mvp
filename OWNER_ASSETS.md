# Downloaded owner assets

The human geometry is MakeHuman's ready HM08 base, exported through MPFB. No sphere/cylinder avatar is used. The browser loads `owner-makehuman-v27.glb` and two skin JPEGs from this repository.

## Sources and licences

- MPFB exporter: https://github.com/makehumancommunity/mpfb2 — GPL code, used offline in Blender; not shipped into the browser.
- Human geometry, targets, Mixamo rig, eyes, eyebrows, hair and natural male skins: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html — CC0 assets.
- Beard and moustache by Rehman Polanski; faun beard by culturalibre: https://static.makehumancommunity.org/assets/assetpacks/bodyparts05.html — selected files explicitly marked CC0/CC-0. Other pack assets are not included.
- Interim TunicViking by Rehman Polanski: https://static.makehumancommunity.org/assets/assetpacks/suits02.html — CC0. Its material is changed to white. It is not a final Roman toga.
- Asset/output licence policy: https://static.makehumancommunity.org/about/license.html

## Conversion

Blender 4.5 / MPFB import the ready human and assets, interpolate anatomical weight/muscle targets, fit each attached mesh and export a skinned GLB. Four retained shapes are Thin, Heavy, Muscular and Soft. Runtime blends intermediate values. Helpers are removed; face and optional-part masks are not baked into the body. Hair, eyebrows and beard retain their downloaded fitted positions; alpha-tested materials write depth so the face cannot overwrite them. Textures retain alpha and detail at up to 1024px; light/dark skin UVs match the base mesh.

The starter tunic is always white. Skin uses downloaded light and dark human textures, not an arbitrary colour picker. Hair, beard and eyebrows use one restricted natural-colour palette.

## Limits

This is a ready human asset pipeline, not an Unreal/Unity engine migration. The current garment is interim, and locomotion uses simple posing of the downloaded weighted skeleton. Neither cinematic hair nor new captured walk animations are claimed. Actual mobile performance and the final Roman clothing still need further work.
