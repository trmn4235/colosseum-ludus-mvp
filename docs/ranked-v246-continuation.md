# Ranked Arena: V246 continuation

V246 adds preparation only. **The ranked match, matchmaking, leader start, and ranked rating settlement are not implemented.** The match button deliberately remains disabled.

The existing V244 party supports one leader and up to four invited friends or clan members. V246 adds a readiness confirmation for each member, equipment and crafting controls backed by the existing inventory/production APIs, leader removal, and presence renewal while the preparation page or invitation indicator is visible. Readiness is verified against the selected gladiator and equipped items on the server; equipping through the panel explicitly clears it first.

The user requires 5v5 ranked play for a solo player or a party of up to five, a 1500 starting rating, +10 for a win and −5 for a loss. Only the party leader may start, after every current member confirms READY. Party members must stay together during matchmaking. Preserve the existing no-scroll landscape layout.

Do not connect the existing `ludus_match` directly to ranked parties: it currently targets every other player, resolves projectiles without team exclusion, and ends the match when at most one fighter survives. A ranked match needs team-aware targeting and projectiles, a team winner, validated matchmaking and reconnection, and server-authoritative, once-only rating settlement. Existing other game modes and economy must remain unaffected.

The V247 migration corrects legacy multiplayer wins from +20 to +10, preserves −5 losses, updates the existing online records, and makes the combined V203 board use the stored point totals. The existing Colosseum board also includes single-player results. Do not treat that combined score as a standalone 5v5 ranked rating: the requested ranked system starts at 1500 and uses +10/−5 for actual ranked matches.

Local checks: `tests/ranked-party-v244.cjs`, `tests/ranked-loader-v244.cjs`, and `tests/ranked-notice-v244.cjs` pass. The UI logic has also been exercised with a mocked DOM. The Playwright browser test and a real iPhone check have not been run successfully in this workspace.
