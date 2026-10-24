# V183 — Circus Maximus driving and javelin combat

Both modes now use delayed rein response, speed-dependent turning, lateral tyre slip and corner speed loss. The cart countersteers and leans; riders counterbalance; the two horses turn separately. The existing idle, walk and canter clips blend by speed. Wheels emit a bounded pool of 96 subtle dust points. The camera follows with damping, a small speed FOV change and track-wall limits. Manual corners and wall-contact slowdown remain meaningful.

The seven-lap two-person race replaces the bow with visible 2.15 m javelins. A tapered black open leather basket beside the thrower follows the supplied reference. A throw reaches into the basket, lifts the javelin, winds up and releases it. Javelins inherit the vehicle's velocity and use gravity and swept collision. A newly launched projectile begins advancing on the next fixed step, preventing the previous one-frame lead error. Each crew hit still removes 50% of maximum mode HP; horses block throws without taking damage.

Lock cycles nearby visible crew; the wheel button changes the target category. Dragging the view releases the lock. The lock leads a moving target until release; the javelin does not home in flight. Two total wheel hits, including one per wheel, break and stop that vehicle. A broken car stays visible with a tilted wheel/body and idle horses. Player defeat is shown after the stop has had time to render.

The crouch toggle lowers the actual crew hit volume behind the cart's collision hull. Crouching cancels drawing and disables attacks. Role changes, blur, pause and cancellation clear held actions. The whip is held in the active character's hand. It only pulls down a visible standing crew member within 3 m, within a 0.065-radian aim cone, when released between 0.42 and 0.54 seconds after pressing. A lock alone does not bypass the release window. The falling character is displaced toward the attacker. This remains local mode damage, with no persistent deaths or wallet writes.

Both timing bars use the same target formula: center 79%, width `18% / (1 + 0.25 × mistakes)`. Each valid missed attempt narrows it; successful attempts preserve the penalty; a new race resets it. Successful boosts cost 25 stamina and last four seconds. The war-race bar is available in both roles; the player times the boost even while the bot drives. Button/key presses are latched once, preventing held-button repeat penalties.

Ordinary racing remains server-authoritative. New clients request `motion:183` while preserving the existing V158 protocol. The server mirrors the new motion and owns mistake counts. Already-running earlier races keep their original physics and timing. Replayed request receipts cannot double-count a mistake. New war saves use a V183 key so incompatible V182 saves are never resumed.

## Validation

- Deterministic full simulation: both bends and seven laps, idle wall stop, bot shots and genuine hits, unchanged horses, exact half-health damage.
- Full locked-throw pipeline hits moving crew and wheels; two strikes stop the cart. Cover, whip range, aim error and release timing checked independently.
- Three 1,200-step JavaScript/PostgreSQL trajectory comparisons, including collisions, match to 0.00001. Migration includes the same parity assertions; failure would roll back its DDL.
- Disposable SQL account/horse fixtures verify shrinking targets, the formerly valid edge becoming a miss, center success, request replay and unchanged gold; fixtures roll back. Legacy V158 SQL regression passes.
- Actual stadium/character/cart GLBs at 932×430, 667×375, 390×844 and 1440×900. Selection, ownership rejection, role switching, short taps, lock/category, cover, whip controls, bar feedback, pause/resume, survivor and broken-cart results verified.
- Ordinary driving controls and clerk/betting regressions. Headless Chromium software rendering; physical iPhone/Safari frame rate was not measured.
- Database advisors before/after show no newly introduced findings. The new pure helper is in the private schema with direct anonymous/authenticated execution revoked.

NPC dialogue layout, photography and approved measurements are unchanged; only the bow-role wording is updated to ciritçi. No new external asset downloads or dependencies.
