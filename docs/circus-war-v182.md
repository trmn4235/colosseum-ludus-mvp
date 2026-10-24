# V182 — Savaş Arabası

Gişe → Yarışmaya katılacağım → Sürücü ve okçuyla savaş arabası. Existing five-lap racing and betting remain separate and retain their rules. The approved NPC photo, sizes, typography and three-answer positions are unchanged.

## Rules and controls

Four two-horse chariots, two crew per vehicle, seven laps. The player's driver and archer are distinct gladiators selected from their own ludus; both horses come from their stable. A narrowly scoped authenticated RPC returns the owned roster and revalidates all four selected identities and availability immediately before start/resume. A duplicate, foreign, hungry/immature horse or unavailable/injured gladiator is rejected.

The player starts as driver. The burgundy/gold SVG swap control (Q on keyboard) exchanges player control with the bot. In driver mode the player steers and boosts, while the bot archer chooses nearby visible targets and shoots with bounded error. In archer mode the bot steers through both bends and boosts, while dragging the canvas or using arrow keys aims and the fire button/Space draws and releases an arrow. Role changes clear held controls and pending draws. Touch cancellation, blur, page visibility changes and WebGL loss clear controls; interruption pauses the local match.

Each human has 100 mode HP: a projectile removes exactly 50, with no headshot or equipment multiplier. Damage is scoped to this module. Two hits eliminate a crew member; the survivor takes the reins and can no longer fire. Both eliminated means the team is out. The first vehicle to complete seven laps wins; an eliminated player gets the result immediately. A 15-minute stalled-race deadline prevents endless wall lock. No early victory is awarded merely for eliminating the opposing teams.

Projectiles use swept collision, moving human hit volumes, occlusion by horses, carts, the spina and outer boundaries. Horses have no combat HP and never receive damage. The preview uses the same arrow trajectory and trace; green means a human lies on the present trajectory, yellow otherwise. Targets can move before an arrow reaches them.

## Scope and persistence

This is a single-player race against bots, not network multiplayer or ranked play. Simulation and resumable state run locally at fixed 50 ms steps. The current tab's session storage is namespaced to the signed-in owner and written every two simulated seconds and when pausing/leaving. Resume revalidates the selected roster with the server. Closing the tab can remove the save; switching accounts never loads another owner's save. Results are presented locally and never submitted as authoritative money, rank, permanent injury or death. No reward was specified, so no new reward or wallet mutation was added. Existing ordinary-race and betting RPCs are untouched.

## Visual assets

Reuse the existing panko10 Roman chariot (CC-BY; assets/circus-v146/SOURCES.md), Warhorse horses and their canter clip, and the same gladiator-mobile.glb body already used in battles (see existing character asset credits). Only the cart platform is widened/lengthened; wheels are temporarily parented to the unscaled vehicle root to keep them round, and horses remain at normal scale. Two independent humanoid skeletons stand front/back, with hand reach poses for reins and bow, draw/release string motion and a brief elimination drop. On leaving, the ordinary cart dimensions, single rider and reins are restored. Geometry/textures are shared between clones; new state and arrows are bounded. No external asset download or newly generated artwork was needed. Reuse the existing approved victory/defeat pictures and photographic loading system.

## Verification

- Core test: deterministic simulation, exact half-max HP, dead-crew handling, immunity/occlusion for horses, seven-lap autopilot completion, real bot projectiles and hits, role swapping.
- Browser: actual stadium and GLBs, four viewport sizes (932×430, 667×375, 390×844, 1440×900), selection and duplicate prevention, server rejection, wider cart, eight crew, driver/archer handoff, manual aiming/shooting, pause/resume, survivor and defeat flow. Screenshots inspected for bounds and appearance.
- SQL: disposable accounts, canonical selection order, foreign/duplicate/missing IDs, injured gladiator, hungry horse, unchanged wallet, anonymous privilege rejection. Transaction rolled back.
- Existing clerk/betting/ordinary selection and five-lap driving regressions.
- Chromium with software rendering, not physical iPhone/Safari FPS certification.
