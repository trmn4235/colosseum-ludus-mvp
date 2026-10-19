# Caravan raids V124

The spear entrance now opens a dedicated raid flow: two gladiators and their equipped weapons, region selection, a two-hour ambush, a ready encounter with **Kervanı Bas**, and the latest five reports. The trade map and stock tabs are absent from this flow. The original Roma panorama remains the map background.

## Gameplay rules

- A raid intercepts an NPC Roman trade caravan. It does not remove another player's stock.
- One unresolved raid per owner. Exactly two distinct owned, available gladiators. Both remain reserved until the encounter is resolved.
- The server records a two-hour wait. Closing the browser does not cancel it. On return, the ready encounter opens after the room/guide/other dialog allows it, including outside the trade room.
- Each region has its own resource and two nearby neighboring routes. Each resource appears in exactly three regions; each of the three cargoes is selected with exactly 1/3 probability. `%33,33` is the rounded display value.
- Independent nearest-neighbor selection on the irregular map would overrepresent some resources. The shipped symmetric degree-two adjacency minimizes total geometric route length under the user's strict three-regions-per-resource rule. Distance accounts for the map's 2:1 aspect ratio. Thus proximity is optimized subject to exact equality; an unconstrained nearest pair is not claimed.
- Initial balance: 70% raid success, 15 units of the selected resource. These rules are disclosed before dispatch. The cargo draw is independent of success and equipment; no undisclosed item rarity weights.
- Failure sends both gladiators to the existing infirmary status for 12 hours. Existing recovery clears that status. No equipment is destroyed.
- Successful loot enters the existing material stock or food pantry exactly once. A full stock retains the pending reward; future raid state checks retry delivery after space is freed.
- The latest five resolved raids include the frozen team, time, region, outcome, exact loot and delivery or recovery state.

## Implementation and security

`ludus_caravan_raid` is an invoker wrapper around a private definer with an empty search path. Private tables use RLS and no client table grants. Authenticated ownership and anonymous-session rejection apply to every action. The owner account lock serializes dispatch, resolution, existing inventory actions and reward delivery.

Dispatch uses a persisted client request UUID and an owner/request uniqueness constraint. Replay must match the same team and region. Resolution is idempotent on the owner's raid ID. Client clocks, outcome, quantities and probability inputs are never accepted.

Existing battles, training/rest, listings, clan rosters and imperial missions exclude a fighter. Reserved fighters use the existing `locked` status, plus database guards against reassignment, sale and equipment changes. At resolution, reservations are released atomically before success or infirmary state is written. Snapshot weapons are filtered by `kind=weapon`; shield and armor thumbnails do not appear as weapons.

All four generated assets and their full prompts/reference roles are recorded in `assets/caravan-v124/art-direction.json`. The transparent spiked mace replaces the smooth ball in both catalog versions, including market, upgrades, clan, combat inventory and raid views. Scene images use their full 3:2 composition.

## Validation

- `LUDUS_CARAVAN_RAIDS_TEST=1 node tests/production-v119.cjs`: real PostgreSQL/PGlite, existing supply and food migrations, repeated migration application, equal cargo representation, actual two-hour gate, ownership and existing-battle conflicts, equipment and roster guards, idempotency, success/failure, 12-hour recovery, full-stock delivery and five reports.
- `node tests/production-browser-v124.cjs`: real game stylesheet stack, six landscape viewports, uncropped heroes, weapon-only slots, dedicated map, three equal choices, five selectable reports, lost response retries and ready-screen restoration outside the store.
- `LUDUS_WEBKIT_TEST=1 node tests/production-browser-v124.cjs`: same visual and interaction checks in WebKit.

The browser fixture tests presentation and reconnect behavior; the PostgreSQL harness independently validates authority and rewards. Test clocks and mocked results are not shipped to the game.
