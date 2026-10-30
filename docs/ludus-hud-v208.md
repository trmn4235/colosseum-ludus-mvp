# V208 — thinner marble wings and smaller screen margins

The user’s device screenshot showed that V207 inset the entire frame by the phone safe area. V208 keeps the decorative rail 6px from both screen edges; only the content is constrained by the larger of the left/right safe areas. The ornament-to-divider spacing uses the visible safe boundary when the notch reaches past an ornament. Both halves remain centered and symmetric.

The frame retains its original 101.2-unit center height around the level badge. Its two marble wings are now 60 units high instead of 85.2, with mirrored curved shoulders immediately around the central badge. The two dividers fit the slimmer band. The same cream marble, gold/burgundy border and end ornaments are reused.

Artwork and typography continue to scale from the original safe content width, independently of the expanded decorative frame. The level badge remains 79.2 units, map/trophy 41.4 and ordinary icons 27, so widening the rail cannot unexpectedly enlarge or shrink the badge or icons. Numbers remain beside icons. Live data and callbacks are unchanged.

The V208 regression retains the seven landscape sizes, six balance states, live updates, menu handlers and rotation checks. It additionally measures the actual SVG wing/center heights and symmetric top/bottom bounds, and verifies 6px decorative margins with both 47px and 62px simulated phone safe areas. Chromium and WebKit run in the existing HUD workflow; no physical-device performance claim is made.
