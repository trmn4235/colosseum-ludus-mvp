# V158 — Manual corners, contact and five-lap races

New races started by V158 use five laps and server-generated 300–325 second baseline plans. Existing V150 races retain their original rules. Betting races use the same five-lap AI boost plans as driving races.

The player's heading, lateral position, acceleration and progress run at fixed 50 ms steps. Without steering, heading diverges from the racing line through a curve; the car reaches the outside wall. Inner limits follow the spina and turning posts; outer limits follow the stadium's straights and end walls. Wall impacts reduce speed immediately; continued scraping decelerates to a stop after 2.5 seconds of continuous contact. Steering away lets the car accelerate again. Nearby vehicle contact reduces player speed and bumps the cart. This is a lightweight racing model; it does not add ragdolls or cart destruction.

AI teams use deterministic burst schedules with the same 25-point stamina cost, four-second boost duration and cooldown gates. Server-generated bot plans are returned with the race so floating point threshold differences cannot change their boosts in the browser.

Live control ticks are submitted in ordered batches; the server accepts inputs, never positions or claimed results. Client prediction replays unacknowledged ticks from server checkpoints. Missing control data defaults to neutral after a one-second buffer. Packet receipts preserve retry idempotency. A stopped/offline player cannot finish on elapsed time alone: after the AI finishes, the driver has another 30 seconds, then records a loss/DNF if unfinished. No new own-race cash reward is introduced.

HUD follows the user's marked screenshot: rank and lap at top right; left/right buttons raised at left; burst button raised at right; timing bar horizontally centered near the bottom. Button artwork is unchanged; both touch and keyboard directions are inverted from V151 to match the chase view. The approved NPC dialogue CSS and photograph are untouched.

Validation: physics tests cover missed turns, continuous wall stop, recovery, vehicle contact, AI stamina and five-lap distance. Disposable SQL tests roll back their users, horses and account records; they check replay, future-input rejection, private helper access, JS/SQL idle parity and offline DNF. Browser tests cover four viewports, both direction buttons, ordered control packets and HUD geometry. Existing clerk/betting flow regression also runs.
