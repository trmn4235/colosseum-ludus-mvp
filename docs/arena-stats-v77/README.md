# V77 — Arena statistics audit completion

The remaining four audit items are implemented together.

## Morale

The owner's last completed Istanbul-day menu provides morale, clamped to 0–100.
Before a completed menu exists, morale is 50. The server freezes this value in
each PvE battle or online match snapshot; changing pantry stock or reconnecting
cannot rewrite it. Requests cannot supply their own morale.

Stamina regeneration is multiplied by `1 + (morale - 50) / 1000`: 0 gives 0.95,
50 gives 1.00 and 100 gives 1.05. This applies once to base and equipment stamina
regeneration, alongside the existing food multiplier. It changes neither damage
nor health nor the 10/hour out-of-combat energy recovery. Existing rooms without
the field remain neutral. New online queues use statistics version 77.

## Tactics

The seven-attribute tactics score reaches the combat fighter. Legacy generated
bots use their class's tactics profile; unconfigured fixtures default to 50.
Existing attack/defense contributions remain. Bot decisions now also use it:

- Visible-attack reaction delay scales from 1.25 to 0.75 of the previous delay,
  with a 100 ms floor; each visible attack gets one random decision.
- Defensive choices and target reconsideration respond to tactics.
- Stamina reserves span 20–36; heavy-attack reserves span 40–56.
- Up to 80% of attack-region choices prefer an injured or unarmoured region and
  avoid the opponent's explicitly guarded region. Other choices remain varied.

Player-controlled fighters retain manual action selection. No class-exclusive
move was added.

## Passive evasion

Successful passive evasion produces a 360 ms upper-body slip on the real rig.
It does not change position, action, stamina cost or invulnerability. Both online
clients consume the server's defense serial; an absent initial serial is treated
as zero, fixing the first defense event being discarded. Evades no longer flash
the shield. Active rolls and interruption/death animations retain priority.

## Stone rules and presentation

The existing stone design document was reconciled with the shipped rules:
Safir 100% doubles the enhanced natural value; new rolls replace old rolls;
Zümrüt uses power × rolled percentage, unaffected by enhancement level. The 14
outcome weights total 365.6; the document now shows both weights and normalized
probabilities, including 0.02735% for a 100% result. TENAX preserves the item's
level on explosion. No stone roll balance or player inventory was changed.

In-game descriptions include morale/tactics and passive-evade behavior. The
gladiator detail timer's undefined-variable typo was also corrected.

## Verification

- `tests/arena-completion-v77.cjs`: all three engines, morale bounds/neutral
  fallback, SQL regeneration parity, server-owned PvE/PvP snapshots, retry and
  mid-match freezing, private grants, tactics decisions, passive-evade outcome
  and absence of extra immunity.
- `tests/arena-completion-ui-v77.cjs`: two isolated browser sessions, real models,
  PostgreSQL-produced evasion event, visible body motion without shield flash,
  and morale controls at three landscape sizes.
- Existing V73/V74/V75 and V76 server suites, plus 61 combat/equipment/movement/
  bot regressions. The updated Word document is rendered and visually reviewed.

The four scoped audit gaps are closed. Automated browser tests do not replace a
human playtest or hardware-specific mobile performance testing.
