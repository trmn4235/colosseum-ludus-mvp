# Rankings V204 — shared game page design

V203 used its own palette, typography and page chrome. The ranking page now loads the same `roman-ui-v56.css`, `roman-theme-v68.css` and `game-art-v136.css` as the market and clan pages, and carries their Roman screen/art-direction markers.

- Shared full-width burgundy header and status strip, light-gold header text and local Cinzel title font.
- White paper content and dialogs, standard gold-edged tabs, buttons and pagination, and the shared selected-row colour.
- `rankings-v204.css` uses shared semantic colour variables instead of defining a separate palette. The common art stylesheet adds only the ranking header to its existing page-header and title selectors.
- Existing score calculations, representative selection, player/guild filters and the V203 RPC remain unchanged. `active` tab classes mirror the existing accessible pressed state for the shared theme.
- Compact layouts retain paging without vertical scrolling. Percentage columns also cover three-digit scores above 100%.

The existing ranking browser suite now asserts shared stylesheet loading, actual title-font loading, shared header/tab/paper colours, three-digit score fit, and the existing seven desktop/landscape/portrait layouts and interactions. CI exercises Chromium and WebKit.

The optional legacy `art-assets-v136.cjs` check fails on the unchanged `savas.html`, because it still requires the art stylesheet to be the first tag after `<head>`; the existing Rome travel stylesheet precedes it. The same assertion fails on the pre-change HEAD. This update does not modify that page or suppress the old assertion.
