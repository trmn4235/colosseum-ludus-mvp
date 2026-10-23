# V172 — Şan Avlusu

The hammer head is the forged-steel GLB primitive. Its geometry scales 0.75 about its original bounding-box center; the bronze shaft/pommel and leather grip arrays stay unchanged. The encrypted source package remains unmodified. No generative processing of CGTrader assets occurred.

The new map point opens `san-avlusu.html`. The final geometry follows the user's corrections: pentagonal outer envelope, a rectangular 16 × 12 m interior, continuous sand directly against 3.4 m high walls, and standing spectators on the upper galleries. There are no curbstones or a separate ground-level boundary ring. Fighter centers are constrained to ±7.55 m / ±5.55 m, leaving body clearance. The online camera is constrained inside the interior walls too.

The original NPC art is stored in `assets/pit-v172/bookmaker.webp`. The dialogue imports the approved `circus-dialogue-v152.css` and `npc-dialogue-v153.css`; only the background and wording change. Each dialogue screen has three responses. Bot and online duel entry reuse the existing equipment preparation screen. The pit loads its own world without downloading `Colosseum.glb`.

## Game rules and persistence

- Each gladiator earns 10 Şan for a win. The singleplayer Colosseum gate requires 30 Şan. `ludus_pit_private.rules` stores the values; multiplayer Colosseum has no fame gate.
- Bot duels contain precisely two opposing fighters and preserve carried-in equipment on both outcomes. They reuse the existing client-simulated singleplayer MVP, with authenticated tickets, minimum duration/result checks and receipt replay protection. This is not a new server-replayed anti-cheat combat engine.
- Online pit matchmaking is capped at two players and isolated with the `venue` field. Existing normal multiplayer semantics are preserved. The existing authoritative online combat determines the winner; a unique source award prevents repeated Şan grants.
- Betting is on a separate 45-second exhibition between Varro and Felix, not on one's own duel. Both have equal probability and 1.90 total payout odds, including the stake. Stakes are 10–1,000 virtual denarius, in multiples of 10. The server chooses and withholds the result until settlement; clients animate the exhibition and cannot submit its winner. Wallet locks, one bet per bout, request receipts and a single status transition prevent duplicate charges/payouts. Pending mutations can be retried after refresh using the same request ID. The latest five settled coupons are shown.
- New private tables have RLS and no client table grants. The public RPC is security invoker; authenticated private API validates the owner. Award and finish helpers are not directly callable by players.

## Deployment

Apply `20261023154347_pit_arena_v172.sql` before deploying the frontend. The gate is initially disabled to avoid locking existing users out before the courtyard route exists. Once Pages deployment and its assets are verified, activate it with:

```sql
update ludus_pit_private.rules set gate_enabled=true where id;
```

Existing battle tickets remain finishable. The gate applies only to new tickets. No existing inventory, wallet balance or career entry is reset.

## Validation

`pit-model-v172.cjs` checks exact head scaling and unchanged non-head vertices. `pit-sql-v172.cjs` tests the actual PostgreSQL functions, per-gladiator progression, gate, request replay, balances, ownership, role privileges, isolated two-person queues and wall bounds. `pit-browser-v172.cjs` checks the three-choice dialogue and locked layout at desktop/mobile sizes, betting screen, arena world and exhibition rigs. `pit-combat-browser-v172.cjs` boots actual bot/online combat worlds with mocked accounts and verifies no Colosseum download. Existing equipment, map/travel and V171 loading recovery tests also run. Browser fixtures never act on production player accounts.
