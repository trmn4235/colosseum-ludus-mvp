# V200 — İmparatorluk Sıralaması

Entry points: the trophy button in Ludus, Rome and the clan hall. The independent
`siralamalar.html` page loads no 3D engine or large background assets. It uses the
existing thirty clan emblems, white marble, burgundy and gold; the table is paged
to fit the viewport without horizontal or vertical scrolling. Portrait is also
supported. Real names use text nodes and clan colors use the existing sanitizer.

## Approved behavior

- Top-level **Oyuncular / Hanedanlar** selection.
- Players: gladiators, equipment, multiplayer, naval, Circus Maximus, caravans.
- Equipment: General / Attack / Defense / Mobility. Caravans: All / Raid / Defense.
- Guilds: guild standings and the actual gladiators who participated in wars,
  displaying owner and current guild.
- Name search and guild filter; search is applied AFTER ranking. Equal primary
  scores have equal rank. K/D and KDA are NEVER ordering or tie-breaking inputs.
- No minimum number of matches. Own position is separate from the current page.
- Power is current; achievements are all-time. No fictional season filter or
  invented historical statistics. Demo players exist only in browser tests.

## Fixed score reference

Existing gladiator `overall` values are averaged over the player's current roster.
The equipped loadouts of the same roster are averaged for equipment. Six slots
count for each gladiator, including empty slots as zero. The off-hand can be a
shield or another class-appropriate weapon. Inventory/vault stock does not count.

Each item's six natural attributes are calculated as:

`100 * natural * (1 + enhancement / 10) * (1 + sapphire / 100) / (baseProfile * 5)`.

The six values and four Emerald application percentages are averaged with equal
weight. An empty Emerald socket is zero. Each two-slot group is averaged, then
the three groups form the general score. The reference is that equipment kind
at +15, six 100% Sapphires and four 100% Emeralds. It is NOT a new enhancement cap:
levels above +15 continue to count and can produce more than 100%. Existing combat
stats, crafting, caps and upgrade probabilities are unchanged. Unknown legacy
natural values yield an unavailable score instead of inventing their strength.

Multiplayer: actual finished online arena records, 1500 + 20 per win - 5 per loss;
pit matches and rooms that never started do not count. This is the new ranking
of the existing online arena; it does not open the future 5v5/10v10 queues.
Naval: 10 points per victory. Circus: races entered and settled with player-team
winner 3, excluding bets. Caravan: a battle counts once even with multiple
gladiators; participant kills/deaths/assists are summed.

Guild ratings start at 1500, K=32, expected result based on the two guild ratings.
Only the verified locked-roster participants receive their guild's match delta.
No client can call the guild or defense result-recording functions. Their public
wrappers are SECURITY INVOKER and granted ONLY to service_role; privileged
functions and tables remain in `ludus_rank_private` with fixed empty search paths,
explicit revokes, and RLS. All public reads require an existing signed-in game
account and return only game identity and aggregate statistics.

## Result integrity and coverage

Events are archived under unique source/result/participant IDs. Retries, repeated
polling and source-history cleanup cannot count results twice. Guild settlement
is serialized and roster rows are locked during validation. Account ownership at
the time a new event is recorded is retained, so subsequent gladiator transfers
do not move a player's match results. Older naval archive rows do not retain
historic owners; initial backfill uses the current owner, matching existing career
history. Future writes avoid that ambiguity.

K/D = kills / deaths; KDA = (kills + assists) / deaths. With zero deaths and a
positive numerator, display infinity; 0/0 displays zero. Unknown history is NULL,
never zero. Ratios can use their complete recorded subset, marked `*`, and the
detail states coverage. No result is invented for a currently empty mode.

New assist observation counts a non-killing contributor who dealt at least 10%
of the victim's max HP. Team combat requires the killer's team; the current online
arena is FFA. Observers do not change damage, RNG, movement or combat outcomes.
Caravan assists come from the authenticated Edge Function's authoritative replay.
Naval telemetry follows the existing single-player result submission mechanism.

## Existing feature boundaries

At implementation time clan wars only had roster preparation; no playable guild
war scheduler/match verifier exists. The ranking screen and restricted result
endpoint are ready, and the UI explicitly says wars have not opened. It does not
pretend roster preparation or unrelated clan trophies are war victories.

Caravan defense currently has escort assignment and a field preview, but no
verified defense-combat completion source. The defense filter and restricted
settlement endpoint are ready; cargo delivery is NOT counted as a defense win.
The server must call `ludus_caravan_defense_result_v200` once it actually verifies
a battle for that escort job. Likewise a future guild verifier calls
`ludus_guild_result_v200` with the locked rosters and actual participant telemetry.

## Validation

`tests/rankings-v200.cjs`: executable PostgreSQL fixtures for score components,
roster averages, grouping, deduplication, old NULL data, base rating, tie rules,
guild/fighter attribution, bench exclusion, filters/search, pagination and grants.
`tests/rankings-telemetry-v200.cjs`: exact assist attribution and combat invariance.
`tests/rankings-browser-v200.cjs`: real-browser interaction/layout checks at
1366×768, 932×430, 844×390, 667×375, 568×320 and 393×852, including dialogs,
search, empty/error states and logout. Chromium and WebKit run in CI.
