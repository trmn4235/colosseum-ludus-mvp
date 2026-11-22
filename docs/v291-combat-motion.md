# V291 — Combat motion continuity

Mobile Ranked fighters keep the renderer's authored root position offsets and
heading between scheduled full poses. Previously, a skipped pose overwrote a
sideways roll's heading with the normal facing; a real rig reproduced a 90-degree
alternation. Deaths retain their captured facing, while ordinary reconciliation
continues to move the displayed root. Action changes and restarts receive one
fresh pose. The existing 50/100 ms remote pose budget and offscreen culling remain.

Target locking, cycling and canvas selection now refresh the existing interface
without resetting the timestamp of the latest network snapshot. While an RPC is
pending, changing target no longer restarts local movement prediction and pulls
the fighter backward. Actual network replies still replace the snapshot normally.

Validation:

- Real gladiator rigs at 30/60/120 FPS and near/far pose intervals: sideways rolls,
  action exits, captured death origin/heading, revival and restarted actions.
- Actual controller: skipped-frame root continuity, immediate action transitions,
  target selection with a deferred reply, touch direction, visibility and budget.
- Both reported regressions fail with the released behavior and pass with V291.
- Existing compact-state/prediction and V290 fractional action-cost tests pass.

This is a client presentation change. Server combat, hit timing, rewards,
papyrus learning and the V290 database activation are unchanged. Automated
scene-graph/frame-time checks are not measurements of physical iPhone FPS.
