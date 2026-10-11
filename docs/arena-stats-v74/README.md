# V74 — Reflex progression and visible upgrade / combat limits

Reflex now uses `0.7 + 0.006 * clamp(reflex, 0, 100)` in all three embedded
engines and the server-owned combat snapshot. Every point affects attack timing.
The 0, 50 and 100 endpoints remain 0.7, 1 and 1.3. This intentionally redistributes
the old curve: reflex 65 changes from 1.3 to 1.09, 80 to 1.18. Celeritas remains
a separate multiplier. This is not a blanket buff to all existing fighters.

New online players join V74 rooms only. V73 rooms retain their cached attack
speed and continue through the same authoritative resolver. Legacy V36 matches
remain supported. The migration replaces existing functions without changing
permissions or player records.

The upgrade page has a read-only “İhtimaller ve bonuslar” dialog:

- Actual normalized sapphire / emerald probabilities; 100% rolls occur about
  0.027%, not 0.1%. RNG weights and the economy are unchanged.
- Selected enhancement success and unconditional explosion chance. The 13%
  explosion roll applies only after failure at +6 or above.
- Explicit reroll warning: the new percentage replaces the old and can be lower.
- Sapphire and emerald formula explanations reflecting the existing server rules.
- Sum of equipment attached to the same gladiator, or a clearly labeled single
  unequipped item; raw contribution, capped contribution and excess.
- Conditional damage/critical/resistance effects remain labeled as situational;
  they are not presented as a guaranteed percentage of final damage.

Verification:

- 303 actual engine / PostgreSQL comparisons: every reflex point 0–100 improves
  attack cadence in arena, duel and embedded multiplayer engines.
- 70 equipment / character snapshot parity cases and existing V73 regressions.
- V73 cached cadence is retained; V74 matchmaking excludes waiting V73 rooms.
- Caps verified with six equipped items and an unrelated gladiator's item.
- Real upgrade page in Chromium at 844×390, 667×375, 568×320 and 1366×768:
  dialog bounds, data, Escape and focus restoration.
- 61 existing combat, equipment, movement and bot-defense tests.

Remaining audit priorities (not silently changed in this release):

1. Fortitudo's differing impact in the attacking weapon versus other slots.
2. Recovery behavior for knockdown, pull/net and special-action states.
3. Tactics' AI role and morale's intended gameplay role.
4. Online thrown weapons (resistance is calculated, but no throw action exists).
5. Reconcile the original design document's invalid probability total and its
   sapphire wording with the current additive rule before changing economics.
