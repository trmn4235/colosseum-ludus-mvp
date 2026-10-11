# V76 — Authoritative online weapon throws

The special-action button now throws the selected gladius, sica, spear or trident
in new online matches. Whips retain their pull action. Throws require an explicit
target lock, 26 stamina, an available selected weapon and an idle action state.
Sword range is 4.5 m, polearm range 9 m, release wind-up 270 ms, flight speed
12 m/s, action duration 700 ms, and the shared special cooldown is 8 seconds for
throws. The client sends an intent and stable command ID; the server owns damage,
trajectory, equipment changes and collision outcomes.

The projectile follows the thrower's facing direction at acceptance; it does not
home in on a moving target. Swept segment / fighter-circle collision finds the
first living opponent along the flight path. Movement, timed dodge, passive
evade, shield blocks and parries can avoid damage. A projectile block cannot
stagger the distant thrower or create a perfect-block counter. Actual projectile
resistance, criticals, penetration, Fortitudo and the remaining gear's effects
flow through the established server damage helper. Each flight can damage once.

Only the room's equipment snapshot loses the weapon. Inventory ownership and
items in the database are untouched. The weapon cannot be picked up again during
this online match. Both the button hint and a visible rule explain that it leaves
the hand until the end of the match. The cost is paid before the capacity change;
health, stamina and all modifiers then use the remaining equipment. Reconnection
reads that authoritative room snapshot and cannot restore the thrown weapon.

Both browsers render the throw animation and a cloned equipment mesh on the
authoritative flight path. A lost RPC response reuses the special command ID and
the original hand/target. The room waits for outstanding projectiles before
declaring a winner, including weapons already released by a subsequently killed
thrower. Death or leaving before release cancels the throw without a hit.

New queues use stats/control version 76. Earlier room versions retain their
existing mechanics and controls. Private projectile resolution is security
invoker with an empty search path and no PUBLIC/anon/authenticated execute grant;
the existing authenticated, ownership-checked match RPC remains the entry point.

Validation commands:

- `tests/online-projectiles-v76.cjs`: all four weapons in both hands, delayed
  shared damage, fixed-path miss, first collision, dodge, front/rear/exhausted
  shield, projectile versus slash resistance, single charge / single hit on
  retry, insufficient stamina, range, occupied actions, wrong hand, bad IDs,
  forged damage inputs, capacity changes, old-room behavior and private grants.
- `tests/online-projectiles-ui-v76.cjs`: two isolated browser sessions with real
  models and local PostgreSQL RPC, controls in three landscape sizes, shared
  damage, lost-response retry, throw/flight rendering, removed equipment and
  reconnect behavior. This is an automated test, not a human production match.
- Existing V73 stat/security and V75 Fortitudo/recovery suites, plus 61 combat,
  movement, equipment and bot-defense regressions.

Remaining audit work: morale's combat role, any additional tactical AI behavior,
passive evade feedback, and reconciliation of the original stone design document.
