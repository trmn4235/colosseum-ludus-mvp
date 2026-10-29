# Imperial rankings V203

The player board now separates **Güç** and **Başarılar**. The guild board retains its clan and participating-gladiator views. Search preserves the actual rank within the selected dynasty filter; equal primary scores share a rank. K/D and K/D/A never participate in sorting or tie-breaking, and there is no minimum match count.

## Power

General power = (gladiator stat + item attack + item defense + item speed) / 4. The four normalized percentages each carry 25% weight. This is a comparison index, not a predicted combat win probability. All four values belong to one real gladiator, using its current stored overall and equipped loadout.

Each player appears once, represented by their highest scoring gladiator for the selected measure. General power chooses the best complete composite; the other four tabs choose that player's best stat, attack, defense or speed. All five percentages in the row are from that selected gladiator. A representative tie uses composite power and then name/ID for stable selection; rank is based only on the selected measure.

Equipment reuses the V200 ten-feature normalization: six effective natural stats (including enhancement and Sapphire multipliers) plus four Emerald socket percentages. Rubies are enhancement consumables; their resulting enhancement is already included, not counted as four additional stat sockets. Each two-slot group averages its two item scores:

- Attack: main hand and off hand, including a shield or legal second weapon.
- Defense: helmet and chest.
- Speed: gloves and legs.

Only currently equipped items owned by that fighter's owner count. Inventory, clan vault and market items do not. An empty slot is zero; unknown legacy item stats invalidate that group and the composite, without invalidating unrelated groups or other gladiators. The 100% reference is the kind's base profile at +15, six 100% Sapphires and four 100% Emeralds. Beyond +15 can exceed 100%. Existing combat, equipment and training rules are unchanged.

## Achievements

| Board | Primary sorting | Displayed statistics |
| --- | --- | --- |
| Colosseum | Rating or wins | Independent 1500-start rating, wins, losses, K/D, K/D/A |
| Naval | Rating or wins | Independent 1500-start rating, wins, losses, K/D, K/D/A |
| Caravan | Wins | Wins, losses, K/D, K/D/A; all/raid/defense filters |
| Circus Maximus | Championships | Championships from races the player entered |

Both rated player boards use the existing arena result scale: 1500 + 20 × wins − 5 × losses. Draws do not change rating. Ratings are calculated from distinct archived outcomes; stored V200 event points remain untouched for cached clients. Changing the order to wins leaves the rating visible in its own column.

Colosseum combines finished 4×5, solo20 and online arena results. The persisted battle mode must be 4×5 or solo20 and its game-mode telemetry must agree with one of those modes. Pit and survival are excluded even when pit telemetry says solo20. Naval4x5 remains naval. An added private trigger archives new Colosseum results; existing career results are backfilled idempotently using the same event key. Legacy career archives have no immutable owner column, so backfill follows the current owning gladiator, as in the existing V200 naval archive. Future ownership changes do not reassign archived player results.

Caravan battle outcomes count once per event, while participating fighters' K/D/A totals are summed. Cargo delivery is not a defense victory. There is still no verified playable guild-war or caravan-defense result source; their existing service-only settlement APIs and honest empty-state notices remain. Circus bets are excluded.

Historical missing telemetry stays unknown; partial ratios are marked with an asterisk and their coverage is shown in the detail view. No missing assists are synthesized. No fake account records or preview balances are written.

## Delivery and validation

`ludus_rankings_v203` is a new read-only public invoker wrapper around the authenticated private reader, with a fixed empty search path and explicit grants. V200 remains available. Deploy the migration before the new page. UI changes are limited to `siralamalar.html` and its V203 assets; the approved V202 HUD and NPC conversations are untouched.

PGlite tests cover the real migration, same-gladiator composites, representative selection, empty/unknown/unequipped items, independent ratings, historical backfill, venue exclusions, deduplication, wins/losses, caravan defense, championship counting, rank ties, search, paging and permissions. Chromium and WebKit check desktop, landscape iPhones and portrait phones, all visible component/achievement columns, sorting, filters, dialogs, pagination and empty/offline/auth states without vertical scrolling.
