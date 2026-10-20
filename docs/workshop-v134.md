# Workshop V134

The workshop now shows the selected equipment's actual + level on a forged Roman crest. The main-screen heading, target/current comparison and success-probability bar are removed. The detailed odds dialog remains available through the existing footer button.

Equipment and materials both use four columns and four entries per full page at every landscape size. Gem labels occupy their own row above the artwork; quantities have a separate row underneath. Full names wrap normally, including long emerald effects. The selected stone stays on its page. The last page can contain fewer than four entries.

The three main panels meet the screen edges without the previous safe-area padding inside the left and right columns. Header and footer controls retain their device-safe insets. The upgrade action has a 50–68 CSS pixel touch target, reduced to 44 pixels only on displays at most 350 pixels tall. The longest labels receive a 136-pixel stone panel even on small landscape phones.

The existing server request, retry ID, consumption rules, probabilities and balance calculations are preserved. The plate always displays the current item level, including while a stone is selected; a successful response updates it to the returned level. Decorative motion respects reduced-motion preferences.

## Art production

- Mode: built-in `image_gen.imagegen`, new opaque image generation.
- Production asset: `assets/workshop-v134/level-crest.webp` (1254 × 1254, 192,600 bytes).
- The generated PNG was converted to WebP at quality 82 with no resizing or visual edits. It contains no text; actual levels are drawn dynamically with SVG paths in `ludus-workshop-art-v134.js`.
- Numeral outlines derive from DejaVu Sans Condensed Bold; the required license is bundled in `assets/workshop-v134/NUMERAL-LICENSE.txt`. No external webfont is required.

Prompt used:

> Use case: product-mockup / historical-scene. Asset type: a single production-ready photographic game UI asset for a Roman gladiator equipment upgrading screen. Generate a perfectly centered, straight-on, symmetrical physically crafted Roman armory level crest, an elegant vertical octagonal/scutum metal plate with a broad nearly black oxblood burgundy enamel center left entirely EMPTY for a dynamic number to be overlaid later by code. The empty central face occupies about 55% of the entire crest area, calm and dark, no symbols or writing on this face. Rim is narrow antique pale gold with engraved Roman laurel motifs and polished steel structural edges, four discreet metal rivets, fine scratches, believable worn forged metal, nuanced relief, sophisticated high-end historical action RPG art direction, not a flat diagram and not a glossy toy. Strong physical depth and precise craftsmanship. Very subtle deep red cloth behind the plate and a soft near-black burgundy vignette, tightly framed crest with only a 10% margin all around. Key light from upper left gives realistic highlights on metal edges while center remains dark enough for bright text. Palette oxblood burgundy, blackened steel, pale antique gold; no tan, brown wood, parchment or orange background. Square composition, crisp details at small mobile scale, readable silhouette, no excessive spiky fantasy ornament, no fire, no characters, no equipment items, no letters, NO TEXT, NO NUMBERS, NO UI buttons, no watermarks. Render a single crest, not a sheet of options. Output high quality 1024x1024 or similar square image.

## Validation

- `tests/upgrades-layout-v134.cjs`: six landscape viewport sizes (1536 × 706, 1440 × 900, 874 × 402, 852 × 393, 667 × 375, 568 × 320); all sapphire, emerald and ruby names; quantities of 999,999; four-card paging; name/image/quantity separation; actual-level rendering; crest loading; filled sockets; simulated iPhone safe areas; double-tap guard; retry request reuse; reduced motion.
- `tests/upgrades-layout-v112.cjs`: all equipment categories, final partial inventory pages, pouch navigation and quest tracking, portrait gate and landscape restoration.
- Both suites route transactions to local fixtures. No real player upgrades are performed during testing.
