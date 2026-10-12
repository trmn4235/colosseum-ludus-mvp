# V88 — Görsel ayrıntıları, teslimat göstergesi ve oda girişleri

The photo viewer now supports 100–400% zoom, two-finger pinch, bounded dragging, touch double-tap, mouse wheel, keyboard zoom/pan and a “Sığdır” reset. The initial view still contains the entire photograph. Controls sit outside the image. Pan limits use the actual contained-image dimensions, including portrait letterboxing. Touch compatibility clicks cannot immediately undo a double-tap. Escape restores focus even if a background supply refresh rebuilt the underlying region controls.

Unseen deliveries appear as a count on the supply chest and activate the existing gold attention state on the courtyard supply door. Opening the trade stock view acknowledges the deliveries shown, with owner-scoped local persistence and cross-tab updates. A latest-delivery strip links to the existing delivery ledger. These indicators make no inventory writes; all cargo remains authoritative V87 server state. The pending-operation key and UUID retry flow are unchanged.

Seven functional rooms now have courtyard-facing entrance walls with plaster, coloured dado, stone jambs, bronze details and plank doors. The six V87 room themes use a pediment; the approved trade hall has a matching layered stone lintel. The exit's existing icon remains in front of the door surface. Doorway colliders leave the centre clear. The old smithy remains empty. The central enhancement workbench height now meets the existing hammer model.

The room interiors still reuse cached static instances and add no lights or animation loop. Their decoration costs 13–27 draw calls per room in the CPU scene checks, excluding preserved imported models and the shared room shell.

Verification:

- `tests/supply-detail-v88.cjs`: unread cargo on initial state, account-scoped persistence, cross-tab acknowledgement, zero inventory mutations, latest cargo strip, anchored pinch, bounded pan, pointer cancellation, portrait letterboxing, double-tap compatibility guard, wheel/keyboard limits and focus after refresh.
- `tests/rooms-supply-v87.cjs`: real Three.js construction, static geometry budget, reusable rooms, dynamic rest depth, action reachability, clear entrances/exits, chest hinge and integrated script parsing.
- Existing V85/V86 DOM suites cover worker input, lost-response retries, all destinations and paginated stocks/jobs/recipes, crafting and food integration.
- Browser/GPU visual QA is unavailable in the managed environment. These checks do not measure rendered pixels, device touch behavior or FPS.

Release entry: `ludus.html?v=revision88`.
