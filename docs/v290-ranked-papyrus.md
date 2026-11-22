# V290 — Ranked learned papyri

New Ranked matches use each participant's learned Doctore and Aşçı papyri. The server freezes the owner's learned effects when the match row is created, including each bot's own learning. Possessing an unread papyrus gives no bonus. Learning during a match applies to the next match.

| Profession | Ranked coverage | Still pending |
| --- | --- | --- |
| Doctore | 23 / 25 | `doctore_004`, `doctore_019`: axes unavailable in ordinary equipment |
| Aşçı | 22 / 25 | `chef_002`, `chef_013`: running has no stamina cost; `chef_016`: no slide action |

`chef_022` uses two different damaged enemies in the same accepted special execution. `chef_024` uses the existing career assist threshold on a real enemy death. These two effects are supported in Ranked only; existing 4×5 and Solo20 bindings remain Doctore 23 / Aşçı 20. Global coverage becomes 115 active and 35 pending.

Damage bonuses apply before existing integer rounding. Critical chance retains the approved percentage-point unit. Stamina reductions add within the existing action category; sword double retains the normal-attack category and its 13 + 6.5 base cost. Food, morale and equipment remain part of the existing base calculation. Shield break, disarm and throw refresh capacity once. Thrown weapons retain the owner's learning snapshot. Due damage resolves before timed stamina rewards.

Full and compact match replies include server-calculated action costs for the current owner only. The client uses exact fractional amounts, validating version, owner, equipment serial and special kind. Existing matches and other modes retain their previous fallback.

## Release order

1. Apply the migration with `ludus_staff_private.deployment_v290.enabled = false`.
2. Publish the compatible client after required CI passes; verify live file hashes.
3. Enable the V290 new-match snapshot gate and read it back. The V289 infirmary gate is separate.
4. Record the actual migration version, reviewed commit, Pages deployment, catalogue readback and release metadata.

The migration does not retrofit match rows, repeat the 90-papyrus grant, auto-learn knowledge, edit the 150 approved narratives/effect values, or change rating and rewards. The gate and internal helpers have no browser/service-role privileges; authenticated entry uses existing match RPCs.

## Validation

`tests/ranked-staff-v290.cjs` exercises actual Ranked/V261 SQL, ownership, disabled deployment and ACLs, costs, damage, regeneration, event receipts, gear refresh, and human/bot match creation. It compares legacy output and RNG before/after and checks actual authenticated full/compact replies. A lethal hit at 59.95 seconds must resolve before the minute reward at a 60.05-second poll. `tests/ranked-client-v290.cjs` exercises the real controller at fractional affordability boundaries. Existing browser tests check server-owned capacity through full and compact replies. Both new tests run in the required Ranked CI suite.
