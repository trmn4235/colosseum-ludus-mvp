# Caravan arena controls and forest detail

The caravan encounter now mounts the existing arena touch controls, including
the player's saved classic/regional layout, six body targets, guard, roll,
special, target lock and hand switching. Health and stamina sit in the safe
upper-left corner; actions sit at the lower right. Layout can be changed in
the pause menu. WASD moves, J attacks, K guards, L rolls, E locks a target,
Q uses the selected hand's special, R switches hands and F picks up equipment.

Weapons dropped by disarm, wear, death or throwing use the arena's physical
equipment system. A nearby available piece shows its name and selected hand.
Pickup requires an idle, living, unstunned fighter within 1.8 units. Immutable
equipment snapshots travel with each dropped object, so its combat attributes
follow it. These pickups last for the battle; permanent rewards remain the
server-selected caravan cargo.

New encounters carry server-owned `rules:127`. V126 encounters that have
already started keep their original simulation. Unstarted encounters upgrade.
The Edge verifier imports both frozen engines and chooses from the owned
server ticket, never a client-supplied version. V127 records six integers per
100 ms packet, including action bits, attack region and guard region. The
30 Hz simulation, replay checkpoints, ownership checks and exact-once reward
settlement remain unchanged.

The forest adds broken trade crates, sacks, a Roman milestone, an overturned
licensed wagon and pooled footfall dust. Understory clears the fighting lane.
Texture filtering, ground normal detail, anti-aliasing, resolution ceiling and
light color improve clarity. A cached 2048px forest shadow map and a separate
1024px moving-character shadow pass avoid redrawing the whole forest for each
step. Dust respects reduced motion. Pause, result and help panels suspend redundant scene rendering, with one redraw after a resize. Existing asset licensing is unchanged.

Checks:

```sh
LUDUS_CARAVAN_COMBAT_TEST=1 node tests/production-v119.cjs
node tests/caravan-arena-v127.cjs
node tests/caravan-verifier-v126.cjs
LUDUS_CARAVAN_ARENA_TEST=1 node tests/caravan-combat-v126.cjs
node tests/caravan-field-v125.cjs
node tests/production-browser-v120.cjs
```

Deploy the dual-protocol Edge function, then publish and verify the frontend
before applying `caravan_arena_v127`. Caravan entry links carry the release
version to avoid reusing an old cached battle page. Do not regenerate old V126 simulation behavior.
