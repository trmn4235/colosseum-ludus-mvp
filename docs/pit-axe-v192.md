# V192 — lightweight courtyard axe

The user-selected musunited85 axe is the fourth venue weapon in Şan Avlusu. Both fighters select their weapons independently; 1x10 and 2x5 use the same server-validated loan flow. Personal inventory and production recipes are unchanged. The axe reuses the venue's existing one-handed heavy-weapon animation and combat values; this addition does not rebalance damage or range.

## Measured asset budget

| Measurement | Source | Integrated resource |
|---|---:|---:|
| Blender scene including presentation room | 37,939,438 bytes | not distributed |
| Axe geometry | 4,840 triangles | 1,585 triangles |
| Axe's source texture files | 25,311,811 bytes | embedded in the resource below |
| Model including all textures | — | 129,456 bytes (126.42 KiB) |
| Selection icon | — | 8,544 bytes (8.34 KiB) |
| Draw calls per axe | 4 | 2 |
| Decoded textures including mipmaps | — | 0.875 MiB shared |
| Length / grip above butt | authored scene scale | 0.90 m / 0.14 m |

The 163,180-byte FBX has external texture references and is not a textured-package baseline. No source room, camera, lighting, unused maps, animation skeleton or extra mesh decoder is shipped. Color maps are 256 px, normal maps 128 px and packed material maps 64 px. All instances share the two geometry/material sets; the package downloads once when selected and is not fetched on courtyard entrance or for a mace-only exhibition.

## Validation

- Compared original and reduced mesh renders: blade outline, rear spike, ferrules and wooden shaft preserved.
- Seven gladiator classes through idle, walking, attacking, guarding, rolling, hit and fall poses use the existing fitted hand socket and shared buffers.
- SQL regression covers both axe loadouts, 1x10, idempotent requests, invalid weapon rejection, ownership and unchanged personal inventory. Production loan allowlist and revoked direct execution verified.
- Chromium checks exercise 932×430, 667×375 and 390×844, both axe cards, exact submitted choices, real mesh and texture loading, one shared download, melee damage and both fight modes.
- Bow, control cadence, exhibition, equipment, helmet/greave and script checks pass. Physical iPhone FPS has not been measured.

Source attribution and reproduction: `assets/pit-v192/CREDITS.md` and `build-report.json`.
