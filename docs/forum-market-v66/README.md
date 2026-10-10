# Forum Pazarı V66

The existing courtyard market cart still opens `pazar.html`. Its left navigation
now switches between **Basic** and **Forum Pazarı**. Basic retains equipment and
food purchases. The Forum uses the two supplied layout references: the listing
table with a selected-asset sidebar and own-listing footer; and the three-column
asset / price / market-comparison creation screen.

## Behavior

- Actual player listings, category/model/name/stone/price filters and sorting.
- The selected asset displays the existing game's effective stats and its actual
  sapphire, emerald and legacy ruby effects. New effects are never fabricated.
- Price shortcuts use real market records. Commission is 5%, rounded up to the
  next denarius. Listings last 6, 12 or 24 hours; an account may have ten active.
- Equipment enters server escrow with no personal owner while listed. Existing
  arena, equipment, upgrade and clan code therefore cannot use it. Its original
  enhancement, natural stats and stones survive sale, cancellation and expiry.
- A gladiator must be ready and unequipped; at least one fighter must remain in
  the seller's Ludus. Purchases respect the buyer's current progression slots.
- Wallet rows and the listing are locked for atomic transfer. A stored request
  ID permits recovery after a dropped response without charging twice.
- Expired escrow returns on a normal game-state load or market refresh.
- The browser displays the newest 500 active listings and the latest 100 sales;
  price-comparison summaries are computed over all applicable server records.

## Verification

`node --test tests/forum-market-v66.test.cjs tests/forum-market-runtime-v66.test.cjs`
passes seven tests, including the real UI controller's authentication handoff,
net-price calculation, create retry, purchase and Basic-navigation preservation.
The controller test uses a minimal DOM. It does not test browser paint or layout.

`tests/forum-market-v66.sql` passed against the project's PostgreSQL database.
It verifies escrow, ownership, price validation, insufficient funds, commission,
item-stat preservation, idempotency, cancellation, normal-load expiry release,
gladiator reservation/transfer, last-fighter protection and RPC role permissions.
All fixtures and test transactions are rolled back.

HTML IDs, referenced scripts/styles, JavaScript syntax and patch whitespace were
also checked. Browser QA was unavailable in this managed environment. The
desktop and mobile layout, especially 568–844px landscape, still needs visual
confirmation on an actual device.

## Background asset

`assets/market/forum-rome-v66.webp` (422,420 bytes) was produced with the built-in
Imagegen tool and encoded to WebP for the game. The supplied images were style
and environment references; all UI is HTML/CSS and remains interactive.

Prompt:

> Use case: historical-scene. Asset type: scenic background for a Roman gladiator
> equipment marketplace web game, landscape 16:9. The two attached images are
> STYLE AND ENVIRONMENT REFERENCES ONLY. Create the clean environment behind
> their interface: a sunlit prosperous ancient Roman forum market with cream
> marble columns and arches, distant tiled villas and cypress trees, deep
> burgundy fabric canopies with gold trims and laurel pennants, red fabric
> covered small merchant tables, pottery and metalwork at the far sides, bright
> blue sky. Viewpoint eye height. Warm premium historical game render, rich
> realistic materials and crisp elegant architecture, matching these references
> closely. Composition: marble courtyard central empty open space for large
> interface panels; detailed columns, canopies and wares toward far left and
> right frame, beautiful architecture and sky across top 15%. NO interface, no
> panel, no parchment boxes, no icons, no buttons, no words, no logos, no
> watermark. No foreground people. Wide landscape frame.
