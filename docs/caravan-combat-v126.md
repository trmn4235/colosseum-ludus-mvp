# Caravan combat V126

The existing forest road is now a playable NPC encounter. The room, resource
map, current arena and the read-only forest preview retain their entry points.

## Rules

- Raid crews contain 2–5 distinct, available gladiators. Their actual statistics
  and equipped weapons are frozen when the encounter starts.
- Starting a raid enters the forest immediately. The one-hour account cooldown
  begins when its verified outcome is saved, including retreat.
- Guards equal the selected crew. Every fourth encounter adds exactly one
  guard. One additional caravan archer is always present.
- The server selects uniformly from the region's existing three resources.
  Region adjacency and equal resource coverage are unchanged. Successful raids
  yield 60 units of that frozen resource.
- Trade cargo capacity increases from 15 to 60 units per caravan. Gathering
  yields are multiplied by four once. Existing in-flight cargo is unchanged.
- A trade departure can optionally carry 2–5 escorts, selected under
  **Kervancı → Savunma**. No escort is also valid; one escort is not.
  One selected crew accompanies the departure, including multi-caravan orders.
- Escorts and their equipment are reserved until arrival. A full warehouse
  does not trap the escort. This release does not automatically generate an
  attack on a player's trade caravan; the playable encounter is the NPC raid.
- A defeated or withdrawn raid crew retains the existing 12-hour infirmary
  recovery. The latest five reports remain accessible.

## Controls and continuity

The first gladiator is controlled with WASD or the touch stick. J attacks,
K blocks, L rolls, and E/Q activate class abilities. The other allies use the
arena AI. Dragging the scene rotates the camera. If the controlled fighter
falls, the camera follows a surviving ally while the remaining team fights.
Esc or the back button pauses, resumes, or explicitly confirms a retreat.

Controls are checkpointed locally and replayed after a page reload. Missing
network responses retain the command log for retry. Saving cannot grant the
same reward twice. Interrupted legacy V124 raids become immediately playable.
Pending legacy supply requests preserve their original RPC and request ID.

## Result validation

`CaravanSimulation` uses server-assigned encounter snapshots, a seeded random
generator, and fixed 1/30-second steps. Input is quantized at 10 Hz; the maximum
duration is 300 seconds. The authenticated `caravan-combat-v126` Edge Function
replays the exact same code and derives the outcome. Client-provided win flags,
loot, quantity and opponents are ignored. Only the service role can call the
private settlement wrapper. SQL checks elapsed time, account ownership,
reservations, cooldown and transactional delivery.

The encounter is NPC combat, not synchronous multiplayer. Replays establish
that controls produce an outcome; they are not an anti-bot system.

## Source generation and assets

Run `python scripts/build-caravan-shared-v126.py` to regenerate the frozen
arena simulation, imported character rig and model loader. This also synchronizes
the two simulation files packaged with the Edge Function. The verifier test
requires byte equality. The existing arena itself is not rewritten.

Run `python scripts/build-caravan-migration-v126.py` to generate the migration
from its two V126 SQL templates and the established V122 supply functions.

Character meshes, equipment and animation reuse existing project assets and
their attribution. Forest, horse and wagon licensing is documented in
`docs/caravan-field-v125.md`. NPC body detail uses the existing naval LOD asset;
the simulation is independent of rendering detail.

## Focused checks

```sh
LUDUS_CARAVAN_COMBAT_TEST=1 node tests/production-v119.cjs
node tests/caravan-verifier-v126.cjs
node tests/caravan-combat-v126.cjs
LUDUS_SUPPLY_UI_ONLY=1 node tests/production-browser-v122.cjs
node tests/production-browser-v124.cjs
```

The SQL suite covers 2–5 crew validation, reservations, ownership, unchanged
request retries, immediate encounters, four-encounter guard rotation, exact
reward delivery, private settlement grants, cooldown and the one-time capacity
multiplier. Browser checks cover crew selection, all six landscape panel sizes,
actual forest/character rendering, movement, checkpoint reload, phone/portrait
controls, and browser-to-server deterministic replay with identical final HP.
