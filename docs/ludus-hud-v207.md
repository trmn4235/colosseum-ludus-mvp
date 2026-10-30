# V207 — approved cream-veined marble HUD

Applies the approved slim marble preview to the real courtyard HUD. The frame keeps the cream-veined white marble, burgundy/gold outlines, two central separators and mirrored palmettes. The level badge is centered; map is immediately left and rankings immediately right. Resources remain on the left; gladiators, caravans, friends, messages and settings remain on the right.

## Fixed geometry

- The rail fills the viewport with equal margins: `max(6px, safe-area-inset-left, safe-area-inset-right)` on **both** sides. A one-sided phone notch therefore cannot shift the center badge off the screen center.
- Height is 11.25% of rail width, preserving the approved 10% reduction from 12.5%.
- Per 1024px rail: ordinary artwork has a 27×27px visible box, map/trophy 41.4×41.4px, level badge 79.2×79.2px; numerals use Georgia at 16.56px. Approved artwork crops and gem SVGs are retained.
- Each wing distributes the visible icons and number labels with equal gaps, including its ornament and separator boundaries. The two wings have different numbers of pieces, so their gap sizes intentionally differ. Map/badge/trophy retain mirrored 12px gaps.
- Numbers stay **beside** their icons. Live balances may use compact notation; unusually long balances also share a reduced numeral size so they cannot consume the minimum clearances. Icons never shrink independently, and full values remain in accessible names/titles. The approved 2000 sample retains normal typography.
- Only the marble texture and palmette are new raster assets; existing realistic HUD artwork is reused. Everything lives in the existing GitHub Pages project.

## Existing game behavior

The V207 adapter preserves the existing `setWallet`, `setGold`, `setLevel`, `setCaravans` and `setRoster` interface. Actual balances, level, availability, messages and authentication visibility still come from the game. Preview values are confined to the isolated test fixture. Existing modal handlers and navigation destinations remain connected; the beginner guide remains accessible through Settings → Help. No account or database data changes.

## Verification

`node tests/hud-v207.cjs --static` checks script syntax, actual production callback bindings and busy/unknown roster states. The HUD GitHub Actions workflow runs the full regression in Chromium and WebKit: seven landscape sizes from 568×320 through 1440×800, six balance states, icon sizes, measured equal gaps and margins, numeral centering, touch targets, live updates, settings/help and portrait rotation. A 47px symmetric safe-area case covers the notch layout independently of device hardware. Local visual inspection uses the same production fixture through the browser. These checks do not claim physical iPhone performance testing.
