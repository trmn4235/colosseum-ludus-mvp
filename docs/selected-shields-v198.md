# Selected shields V198

Six independently craftable shields from research selections 2, 7, 8, 17, 19 and 22. Three large shields and three small/medium shields use the shared catalogue, original source textures and separate inventory icons. Existing equipment is unchanged.

| Selection | Item | Height | Triangles | Model + textures | Draw calls |
| --- | --- | --- | --- | --- | --- |
| 2 | Dura Europos oval kalkanı | 1.12 m | 2,484 | 239,980 bytes | 1 |
| 7 | Ahşap Parma kalkanı | 0.74 m | 2,016 | 203,452 bytes | 1 |
| 8 | Yeşil motifli kalkan | 0.78 m | 3,432 | 230,076 bytes | 1 |
| 17 | Mavi demir kuşaklı kalkan | 0.80 m | 3,422 | 220,760 bytes | 1 |
| 19 | Yeşil Roma kule kalkanı | 1.24 m | 2,599 | 332,052 bytes | 1 |
| 22 | Kartal işlemeli kule kalkanı | 1.30 m | 2,799 | 249,552 bytes | 1 |

All models are lazy loaded and share geometry/materials between fighters and dropped equipment. Each model is below 350,000 bytes, each icon below 25,000 bytes; no source archives are distributed. Attribution and license terms are in `assets/equipment-v198/CREDITS.md`.

The actual shield ID now survives courtyard initialization and equipment switching, arena/duel/caravan loadouts, drops and pickups. Small/medium collision classification is consistent in the shared caravan verifier. Existing shield bash and two-hit breaker mechanics remain in place. The database migration adds only catalogue/recipe rows, without granting inventory, money or privileges.

Validation uses the real decoded meshes in all five renderers, shared resource checks, source/transfer budgets, actual courtyard equip actions, three mobile recipe layouts, Chromium/WebKit image decoding/rendering, PostgreSQL production debits/retry/ownership, and battle entry/exit. Fixture accounts do not contact production auth or alter player inventories.
