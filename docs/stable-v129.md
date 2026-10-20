# Ahır V129

The former empty room and caravan room trade positions. The stable occupies the caravan's former far-left position when facing the ground-floor doors (`x=9`), and the caravan room moves to `x=-4.5`. The stable interior is 15 m wide versus the standard 10 m. Other rooms restore their original width on entry. Its photograph badge, one animated horse and one clothed groom reuse the existing renderer. Models load only on stable entry and are cached.

## Included

- Nine attributes: power, speed, acceleration, agility, stamina, balance, courage, recovery and burst.
- A single groom panel: feed quality, ration purchasing, automatic feeding, daily care. Automatic feeding shares limited rations chronologically across horses, including foals born while offline.
- Persistent, elapsed-time-weighted food/care histories; completed training and age-eligible training history. Pregnancy rest does not create missed training time.
- Foal → young → adult. Female and male horses share the same scoring and upper bounds. Pregnancy blocks training, competition and sale.
- Pedigree snapshots show parents and all four grandparent positions. Known earlier ancestors can be inspected. Founder records explicitly show unknown ancestry. Parent data, names and quality are frozen at conception. The elite-ancestor bonus is applied once, and founders can achieve elite quality without it.
- Stable capacity: level 1/5/10/20/30/40/50 → 3/4/5/6/8/10/12 horses. Pregnancy reserves a stall; buying a horse cannot take a foal's reserved space.
- Own-horse breeding, paid stallion listings and requests, acceptance/decline/cancellation, player horse sales and an NPC buyer. Money and ownership transfer atomically; every action uses an idempotent request UUID. Pedigree and history survive sale.
- An initial timing-based mounted-duel prototype in the panel: three timed exchanges, fixed-strength opponent leagues and a 75% horse / 25% control score. This is a lightweight prototype, not the future full 3D Circus Maximus combat or biga/quadriga racing. Timing is scored against server arrival time, so network latency can affect the control score.

## Starting balance (tunable)

Private `ludus_stable_private.rules` holds the initial balance: genes 25%, lifetime food 25%, training 25%, elite ancestry 5%, care 10%, experience 10%. The last two are the proposed initial allocation of the previously undecided 20%.

- Founder: 350 denarius; adulthood, genes 60–80; first 6-hour meal and 24-hour grooming included. No automatic grants or resets of existing accounts.
- Young at 24 hours; adult at 72 hours. Pregnancy lasts 24 hours; post-breeding rest 24 hours.
- Food: quality 50/75/100 at 2/4/7 denarius per 6-hour meal. Up to 100 meals per purchase.
- Training: 30 minutes; one start per 24 hours. The selected attribute gains 10 training points on completion. Ordinary development and lifetime consistency contribute to the 25% training component.
- Grooming: 24 hours; energy recovers over time. Food/care deprivation changes historical quality, but horses are not killed by inactivity.
- Competition: 30 energy and a 1-hour horse cooldown. Three opponent leagues (40–48, 65–73, 85–93) allow stronger horses to have a meaningful advantage. Duels update career history; no monetary prizes are issued in this first balance pass.

## Security and validation

New tables live in a private schema with RLS enabled and no direct anon/authenticated table grants. The only authenticated RPC delegates to an auth-checked private implementation with a pinned empty search path. Affected account rows are locked in UUID order before transfer. Price changes, owner changes, full stables, insufficient funds and expired breeding requests are checked again at acceptance/purchase.

`tests/stable-v129.cjs` runs the actual migration with PostgreSQL/PGlite. It covers access control, replay, capacities, meal accounting, food history, training, births, reserved space, trade, paid mating, equal sex scoring, founder elite eligibility and timed duel settlement. `tests/stable-ui-v129.cjs` checks actual UI interactions in JSDOM, safe text rendering, network retries, pause lifecycle and scene model caching with Three.js. These are not browser layout or iPhone frame-rate tests.

Run:

```sh
STABLE_FIXTURE_PATH=/tmp/stable-v129.json node tests/stable-v129.cjs
STABLE_FIXTURE_PATH=/tmp/stable-v129.json node tests/stable-ui-v129.cjs
```

Dependencies: `@electric-sql/pglite@0.5.10`, `jsdom@26.1.0`, `three@0.160.0`. A GitHub Actions workflow runs these checks. The older `rooms-supply-v87.cjs` fixture still expects pre-V119 supply UI selectors and does not exercise this new stable; it must be updated separately before it can serve as a current supply UI gate.

## Artwork

`assets/stable-v129/horse.webp` is generated photorealistic bay-horse artwork, optimized to 1008×672. The prompt and creation mode are recorded in `assets/stable-v129/art-direction.json`. The animated horse and groom reuse the already licensed Warhorse Lite and existing clothed-driver assets; original credits remain in their existing asset directories.
