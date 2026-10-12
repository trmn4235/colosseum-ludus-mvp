# V87 — Tam görseller, otomatik kasa ve odalar

## Presentation

The twelve approved V86 WebP assets are unchanged. Region and expedition images use `object-fit: contain`; region captions no longer cover the image. Tapping a region picture or “Görseli büyüt” opens an unobstructed viewport-sized viewer. The map has its own enlarge control. Escape returns to the underlying view and keyboard focus is restored. Lists retain pagination and the shared white/burgundy interface.

The trade room's “TEDARİK • ROMA” plaque is removed. A physical hinged supply chest replaces the left cargo pile. Both the chest and its nearby action marker open the authoritative stock inventory. The lid opens with that view and closes when leaving it. The approved map table, shelves and room architecture remain.

## Delivery

`ludus_supply_private.settle_owner_v87` transfers all mature cargo atomically into the existing food/material stock and releases its assigned workers. The supply RPC calls it before returning state. A privileged, bounded `pg_cron` job calls `deliver_due_v87(100)` every minute, including while players are offline. Active clients refresh at maturity, including when the supply modal is closed. This is a single expedition delivery, never automatic repeat dispatch.

Stock capacity remains 50,000 per SKU. If any part of a mixed load would exceed capacity, the entire load is kept pending and its workers remain assigned. Background retries use a five-minute eligibility timestamp so blocked loads cannot starve other owners. Food settlement happens before incoming stock is credited, preserving completed-day nutrition. Account-first locking, owner isolation, legacy claim compatibility, and existing receipt UUIDs prevent duplicate grants. Private helpers have no public/anon/authenticated execute permission. Recent state includes the latest ten deliveries, backed by a partial owner/date index.

Worker rewards, timings, yields, all 19 Basic +0 recipes, olive-oil policy, and existing food rules are unchanged. The pending request storage key remains `ludus-supply-pending-v85:<owner>`.

## Rooms

`ludus-room-design-v87.js` adds six room-specific static interiors. Existing functional models and interaction anchors are retained.

| Room | Design and function |
| --- | --- |
| Yönetim | Archive scrolls, laurel relief, visitor seat and curule-style chair frame the existing mission desk, books and appearance wardrobe. |
| Klan | Trophy alcoves, pale columns, ceremonial benches and a vault plinth retain the player's own banner, clan name, trophies and vault. |
| Dinlenme | Muted green plaster, linen storage and window niches preserve brown padded floor mattresses and the central aisle. Furnishings follow dynamic roster depth. |
| Geliştirmeler | A coal hearth and production anvil occupy the left. The existing enhancement hammer remains central and the imported stone vault remains right. |
| Revir | Linen treatment couches, wash basins, herbal jars, bandages, mortar and instruments; no new healing mechanic. |
| Yemekhane | Hearth framing, hanging herbs, ceramics and amphorae surround the imported kitchen and two existing tables. |
| Tedarik | Approved V86 interior plus the openable supply chest. |
| Former Demirci | Empty room with a neutral door icon. Basic crafting now opens at the anvil in Geliştirmeler. |

The six new interiors add 9–24 static draw calls each, using shared geometries/materials and instancing. They add no lights or per-frame animation. Room re-entry reuses cached groups; changing rest-room depth replaces the previous instance instead of growing the cache. Office and clan dressing attaches after their asynchronous scene clears.

## Verification

- `tests/gathering-auto-v87.cjs`: actual PGlite migrations, idempotent reapplication, automatic delivery, owner isolation, private ACLs, receipt replay, full-capacity atomic cargo, offline settlement and nutrition ordering.
- `tests/gathering-live-v87.sql`: real PostgreSQL delivery and legacy retry assertions; all account fixtures roll back.
- `tests/rooms-supply-v87.cjs`: image/gallery behavior, focus, chest controls, closed-panel automatic refresh, dining invalidation, real Three.js CPU geometry, bounds, entry/exit clearance, workshop accessibility, room caching, rest depth, empty smithy and chest hinge.
- Existing V85/V86 DOM suites retain worker, retry, crafting, level reward, food, map, pagination and script parsing coverage, updated for automatic delivery.
- The minute-based cron schedule completed successfully on the live database; both private helper ACLs deny client execution. Security/performance advisors identified no new V87 findings.
- Browser/GPU visual QA is unavailable in the managed environment. DOM viewport inputs and CPU scene checks do not measure rendered pixels or FPS.

Release entry: `ludus.html?v=revision87`.
