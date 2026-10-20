# Workshop V135

The annotated layout is implemented as a full-width bottom material strip and a full-height equipment inventory on the right. Material names stay above their images, with quantities below. Four stones fit on each full page; equipment now fills two rows of four, with eight entries per page.

The selected item's name is aligned to the left edge of its heading and its actual + level to the right. The metal crest is preserved. Its digit is about 4% smaller relative to the crest, while the plus sign is scaled to 55% of its original glyph and vertically centred beside the digit. The complete mark remains centred on the crest.

Inventory paging, the odds dialog and the stone pouch share the inventory's lower control row. Transaction feedback has a separate full-width line below those controls so it remains readable. The stone strip respects the device's bottom inset. On the shortest landscape screens, emerald sockets use one compact row to keep the main screen free of scrolling.

Validation uses the actual HTML, CSS, SVG and local assets with fixture account data. `tests/upgrades-layout-v135.cjs` covers all stone names, four-card stone paging, eight-card equipment paging, split-title alignment, the smaller centred plus sign, bottom-strip geometry, six landscape sizes, simulated safe areas, filled sockets, upgrade results, double-tap protection and retry IDs. `tests/upgrades-layout-v112.cjs` additionally covers partial inventory pages, pouch navigation, quest tracking and portrait/landscape restoration. No real account transactions are used in these tests.
