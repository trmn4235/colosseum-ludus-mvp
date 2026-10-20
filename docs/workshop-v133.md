# Geliştirmeler V133

The workshop now gives the upgrade action its own full-height burgundy stage, with a visible target level, current level, success probability and a gold primary button. Equipment photographs sit on neutral display surfaces; item stats, sapphire bonuses and emerald sockets use distinct, compact rows.

The primary button is 50–70 CSS pixels high, with a 44-pixel minimum on landscape displays at most 350 pixels tall. A selected sapphire or emerald replaces the level preview with its actual gem artwork, full effect name and percentage range. Loading disables the action and labels it `İŞLENİYOR…`; the existing server request ID and retry lifecycle are preserved.

Stone art, full effect names and quantities occupy separate grid cells. Large counts use Turkish thousands separators. Desktop shows three material cards per page; viewports up to 1100 pixels show two. Short landscape screens show three equipment cards per page so the photographs remain legible. Choosing a material keeps its page selected.

No upgrade probabilities, item formulas, database functions, balances or gem consumption rules changed. The screen uses existing local equipment and gemstone assets; it adds no external fonts, raster artwork or network dependencies. Motion runs only during an upgrade or successful result, and respects reduced-motion preferences.

## Validation

- `tests/upgrades-layout-v112.cjs`: six viewport sizes, all equipment categories, inventory paging, stone pouch, quest tracking, iPhone safe-area simulation, portrait gate and landscape restoration.
- `tests/upgrades-layout-v133.cjs`: six viewport sizes from 568×320 through 1440×900 and 1536×706; every sapphire, emerald and ruby effect name; 999,999 counts; selected long emerald names; minimum action size; success probability visibility; safe areas; disabled double taps; request-ID-preserving retries; reduced motion; zero page errors.
- The new UI regression runs in the existing combat and upgrades GitHub workflow.
- Screenshots were visually reviewed in Chromium with the actual shipped assets. Account reads and transaction responses in tests are local fixtures; no player currency was spent. Physical iPhone hardware was not used.
