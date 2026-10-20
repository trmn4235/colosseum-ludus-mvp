# V136 · Roman art direction

The game had accumulated incompatible panel styles: flat white forms, parchment overlays, default headings and several compact layouts that clipped their contents. V136 gives the active game a consistent white, burgundy and worked-brass visual system while retaining the photographic art and 3D scenes that already fit it.

## Active surfaces

| Entry | Revision |
| --- | --- |
| `index.html` | Burgundy account plaque, clear white inputs, gold primary actions, compact registration layout and readable appearance picker. Existing cinematic arena image stays intact. |
| `ludus.html` | Readable courtyard HUD, training-school loading art, consistent illustrated headers and white content panels. Training, imperial orders, dining, supply, vault, messages, friends, settings, beginner guide, owner appearance, combat values and stable share the material system. |
| `savas.html` | Worked-brass frames and Roman titles for the existing arena posters; preparation controls use the same palette. |
| `arena.html` | Illustrated pause panel with three visible settings and persistent action buttons. The complete original combat guide moves into an expandable section. Arena simulation and touch-control geometry are unchanged. |
| `multiplayer.html` | A physical prestige medallion surrounds the live queue countdown. |
| `gelistirmeler.html` | Type and frame polish; V135's four bottom stones, eight inventory slots, split item title, centered small plus and large upgrade button are preserved. |
| `pazar.html` | Consistent frames, selected cards, title hierarchy and transaction buttons over the existing Roman forum art. |
| `gorevler.html` | Imperial orders sidebar, illustrated quest cards, clear progress, rewards and daily chest. |
| `klan.html` | Legion-hall artwork behind the editable clan standard; refined navigation, progression and trophy cards. |
| `ludus-seviye.html` | Physical level medallion, compact facts and a reward ledger that fits small landscape screens. |
| `caravan-field.html` | Loading title and encounter overlays join the shared style; existing scenery, capture feedback and controls are retained. |

Developer-only setup/preview pages are not player destinations and are not restyled.

## Assets and implementation

Five original ImageGen assets supply imperial orders, legion hall, prestige medallion, training school and provisions imagery. The medallion has an empty center; its number remains real game data. Full generation prompts, modes, dimensions, hashes and output paths are in `assets/art-v136/manifest.json`. WebP assets and the local Cinzel font together remain below 1 MB. The font is distributed under its included SIL Open Font License. No remote font requests are added.

`game-art-v136.css` is an opt-in presentation layer, registered before the existing important `game-windows` layer. This order is intentional: CSS important layer priority is reversed. The HTML entry pages carry `data-art-direction="136"`. Existing scripts, account and database operations, currencies, item formulas, 3D assets and world-door icons are retained. Apart from linking the theme, the production HTML change is the arena pause layout; all existing control IDs and guide text remain available.

## Verification

- The new page audit covers six landscape sizes, 1536×706 through 568×320, including 874×402 and 852×393. It checks document bounds, loaded title font, non-overlapping level summary rows, clan subviews and pause controls with the guide expanded.
- The real courtyard audit covers 22 windows/tabs at all six sizes, plus an active horse duel and purchase confirmation: 144 captures. Stable content is checked for internal clipping, not just outer frame bounds. All data and RPCs are isolated fixtures.
- Existing workshop tests verify all equipment categories and long gem names, four stones, eight equipment slots, split heading, safe areas, the upgrade target and retry behavior.
- Login tests cover cinematic timing, registration controls, portrait rotation, reduced motion and missing artwork recovery. Marketplace, arena-mode, beginner-quest, supply and caravan regression suites exercise the actual UI controllers with isolated data.
- Real browser runs exercise the 3D courtyard, arena pause/resume and caravan presentation. The populated battle-preparation screen is also checked with its real 3D character preview at all six sizes. Multiplayer queue captures cover presentation without live matchmaking.
- Layout testing is browser-based; these captures are not a physical iPhone performance certification. No production account, purchase or battle is used for validation.

The dedicated `Roman art direction` workflow keeps the new asset budget, first-layer ordering and compact page/window layouts under regression checks. Existing gameplay workflows remain in place.
