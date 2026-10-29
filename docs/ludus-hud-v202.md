# V202 — approved Ludus header

Superseded by V205 at the user's request: the live Ludus page again uses the pre-V202 burgundy menu. The V202 script, stylesheet and images remain only for compatibility with cached pages. See `docs/ludus-hud-v205.md`.

The reference is the single white-marble bar with natural-material icons, level at the left, then gold / diamond / sapphire / emerald / ruby, caravans, gladiators, map / rankings, friends / messages / settings. The final requested scale is **90%**. The level badge uses the approved olive-branch frame, a burgundy center, and a separate centered HTML number; no `Sv.` prefix or baked-in number.

`ludus-hud-v202.css` joins the existing `game-art-v136` cascade layer so that the older important theme rules cannot override the approved bar. Its custom properties use a versioned prefix to avoid the old caravan HUD variables. On small landscape screens, spacing and icons compress before the entire bar receives the requested 90% scale. Safe-area insets and the existing portrait gate remain in effect.

`ludus-hud-v202.js` owns the display. The existing wallet/reward/food/supply/stable/vault callbacks update the same resource nodes; full values remain in their accessible labels and titles. Four-digit gem values display without a separator. Larger gem balances use Turkish compact notation; this never changes the stored balance. The 2000/984125/6/6/8/12/43 example values occur only in the isolated test fixture.

Caravans use the supply RPC's free/total values. Gladiators use the authenticated roster and server-aligned time, excluding locks, injuries, training/rest, clan rosters, market listings and battle locks. Unknown availability is shown as a dash until training state arrives. Supply updates carry current escort locks into the roster. Counters refresh on existing state callbacks and the existing one-second exercise tick, with no new polling loop.

The caravan control opens the collection room map; the gladiator control opens the existing gladiator detail/roster panel. Level, map and ranking links remain normal anchors. Friends, messages (including the existing unread badge), and settings reuse the original buttons and handlers. The shared rankings initializer sees the existing `imperialRankings` link and does not create a second Ludus panel. Rome and clan entrances are unchanged. The notebook trigger is hidden only inside this header; Settings → Help / Beginner guide remains available.

## Assets and validation

Nine transparent WebP assets in `assets/hud-v202/` were generated from the two approved references, then split and resized to 144px (192px for the level frame). Total transfer is about 95 KB. Colored gemstones reuse the existing glass-cut SVG renderer. Marble reuses `assets/circus-v143/honed-marble.webp`.

`node tests/hud-v202.cjs` checks realistic unavailable states and timer boundaries; compiles all inline game scripts; renders the production HTML/CSS plus HUD in an isolated fixture; checks seven landscape sizes, normal/large/zero balances, hit targets, scaling, level centering, live counters, preserved handlers, settings/help and portrait rotation. The fixture blocks every external request and cannot access a real account. `LUDUS_WEBKIT_TEST=1` runs the same checks in WebKit on CI. This is layout and integration verification, not a claim to have tested a physical iPhone or a live authenticated 3D session.
