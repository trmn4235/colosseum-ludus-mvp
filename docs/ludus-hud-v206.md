# V206 — transparent, compact Ludus HUD

The user's corrected October 30 reference restores the one-row order: level at the far left, gold, diamond, sapphire, emerald, ruby, caravans, gladiators, map, rankings, friends, messages, settings. The existing transparent photographic icon assets in `assets/hud-v202/` match the supplied artwork and are reused; no generated replacement, new image transfer, or opaque marble rail is introduced.

`ludus-hud-v206.css` sizes icon artwork at 75% of the previous reference sizes. Button hit areas are kept larger than their images. Wallet groups never shrink below their content width, counters cannot wrap, the menu respects horizontal safe areas, and breakpoint-specific gaps keep the landscape row in bounds. All backgrounds are transparent. Long balances use Turkish compact notation; accessible labels retain exact values.

The level uses the existing numberless wreath and separate SVG text. Canvas text metrics position the visible numeral ink at the burgundy disk's center (93 on the 192px asset), avoiding the lower wreath knot and the font's asymmetric line box. The value remains live, including one-, two- and three-digit levels.

All initial, reward, vault, food, supply and stable wallet paths update the same HUD API. Caravan and gladiator availability use existing callbacks and the existing activity tick; there is no new network polling. Settings, friends and messages retain their existing buttons/handlers. The beginner guide remains available via Settings → Help. Navigation is integrated into the single row, and the old separate world navigation is not mounted. The login destination uses revision206 to fetch the new entry HTML.

## Validation

- `node tests/hud-v206.cjs --static`: production inline JavaScript compiles; wallet hooks, pending availability, busy statuses and timer boundaries are checked.
- Cloud Chromium review: production markup/styles and HUD rendering, isolated from account APIs, checked at 1440×800, 932×430, 874×402, 844×390, 760×360, 667×375 and 568×320. Normal, large, zero and near-abbreviation-threshold balances pass actual content bounds, overlap, scrolling, transparency, order and hit-target checks (28 cases).
- The HUD workflow runs `node tests/hud-v206.cjs` in Chromium and WebKit. It additionally checks numeral ink centering, exact 75% icon sizes, live wallet/counter updates, navigation, settings/help and portrait rotation.
- Existing full-courtyard caravan regression expectations are updated to the approved icon and navigation order, while retaining geometry, map, supply and reward checks.

Browser fixtures never read or change a player's account. These are browser checks, not a claim of testing a physical iPhone.
