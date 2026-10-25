# V194 — restore the uploaded helmet identities

V119 (`fb954957aabc316861206eb6c312bb28e9dc7339`) redirected the `knights` and `winged` entries to the `gladiator` mesh, recoloured the knight entry and renamed those items Secutor/Thraex. Their original GLBs remained in the repository. Independently illustrated icons then described designs that the worn models did not reproduce.

V194 restores each entry's own fitted model in the arena, battle, multiplayer, Ludus and caravan rigs. Original inventory IDs remain stable, so existing ownership, upgrades and equipment references continue to resolve. Shop and recipe labels return to Şövalye miğferi and Kanatlı miğfer. Shared UI names prefer the canonical catalog label over stale listing names. Class names Secutor and Thraex are unaffected.

| Inventory model ID | Display name | 3D model key | Triangles | Icon |
|---|---|---|---:|---|
| gold | Gladyatör miğferi | gladiator | 4,347 | items-v194/helmet-gold.webp |
| silver | Şövalye miğferi | knights | 3,271 | items-v194/helmet-silver.webp |
| winged | Kanatlı miğfer | winged | 3,896 | items-v194/helmet-winged.webp |
| roman | Roma miğferi | roman | 11,290 | items-v194/helmet-roman.webp |
| sylvain_helmet | Vizörlü gladyatör miğferi | sylvain_helmet | 6,652 | items-v169/helmet-sylvain.webp |
| viking_helmet | Boynuzlu Viking miğferi | viking_helmet | 4,076 | items-v189/helmet-viking.webp |
| steel_helmet | Çelik miğfer | steel_helmet | 2,358 | items-v189/helmet-steel.webp |

The user's original `knights_helm.glb`, `winged_helmet_gameready.glb` and `gladiator_helmet.glb` were recovered and compared with the existing game files. All primitive indices, positions, normals and texture coordinates match byte for byte. `assets/items-v194/source-audit.json` records source/file hashes and geometry fingerprints. No replacement model or new mesh reduction is introduced here.

Four new transparent 512 px WebP icons are rendered directly from the fitted meshes and their real textures, using `scripts/render-helmet-icons-v194.cjs`. They total 88,386 bytes. Inventory, upgrades, market and clan fallback paths use the same images. The three newer helmet icons already represented their own models and remain in use.

Validation covers seven distinct model selections in all five rigs; all seven gladiator classes through seven actions; stable head attachment and shared geometry/textures; canonical names and fallback images; idempotent SQL label changes and unchanged production ingredients; real icon-versus-model image comparisons; and the seven production detail cards at five landscape sizes. Local Chromium rendering, arena performance and 2,870-frame equipment stability checks pass. All 87 equipment unit tests pass. Chromium and WebKit regression checks run in the equipment workflow. The label migration was applied to production as `20261025185604_helmet_identity_v194`; both catalog and recipe rows were read back successfully.

To repeat source verification, run `python scripts/verify-helmet-sources-v194.py <directory-containing-the-three-original-GLBs>`. To render the four icons, run `node scripts/render-helmet-icons-v194.cjs`; a local Chromium binary can be selected with `CHROMIUM_PATH`.
