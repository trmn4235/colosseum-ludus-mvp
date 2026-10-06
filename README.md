# Colosseum & Ludus

Static mobile gladiator game served by GitHub Pages. Supabase owns accounts, equipment and multiplayer match state.

## Owner appearance and third-person Ludus V26

Registration includes a live 3D owner editor for six hair styles, six beard styles, five eyebrow styles, separate hair/beard/brow colours, skin and eye colour, face shape, height (160–200 cm), four body builds and accessories. Only the starter white tunic is selectable; coloured outfits and cloth colours are not available. Cosmetic values are normalized, then stored in the authenticated user's `ludus_owner` metadata at sign-up or through `auth.updateUser`. Existing players can edit their appearance from the welcome screen or the Ludus portrait button. No SQL migration is required. These values never grant combat stats or paid inventory.

Ludus opens with the owner's animated avatar and a third-person orbit camera. Movement uses the existing joystick/WASD controls, dragging changes the camera direction, and a camera button cycles near/medium/far. Collision proxies shorten the camera before walls, columns and gallery floors; the avatar follows stairs and transfers into rooms. The overview toggle remains available. The model batches rigid details inside articulated joints to keep draw calls low. The new original avatar is stylized and does not use the gladiator's combat rig.

Validation: `node --test tests/*.test.cjs`. An isolated browser fixture also verifies sign-up metadata, failed-save retry, cross-page persistence, visible third-person movement, stairs/gallery/rooms and an 844×390 mobile editor layout. Actual iPhone frame rate remains a device check.

## Ludus architecture V25

The burgundy wall frieze wraps all four courtyard walls at one height and stops at doorways. Arena torches sit above it. Stair rails now use the balcony’s limestone balusters. The colonnade has fluted Ionic shafts, moulded bases and spiral capitals. An instanced Roman city skyline with tiled roofs, cypresses and a three-tier elliptical amphitheatre is visible beyond the perimeter walls, including from the upper gallery. No SQL migration or new downloaded assets are required.

Validated with three rendered viewpoints, JavaScript compilation and the existing regression suite. Mobile frame rate still requires device testing.

## Combat animation V24

Sword cuts carry the hand across the torso with shoulder and pelvis rotation, a distinct reverse cut and an overhead heavy attack. The attack pose is no longer overwritten by a second animation layer. Feet settle from locomotion during the wind-up, then keep their contact positions through the swing. Shield interruptions preserve the contact posture during recoil; the shield stays upright beside the attacking arm. Embedded Quaternius guard and special-action clips are retained.

V24 changes the three shared combat renderers and their local sword paths. It needs no additional SQL migration. Online V23 timed defense still requires the existing V23 migration below.

## Combat V23

Melee attacks use wind-up, blade contact and recovery. Shield contact interrupts a cut into a continuous recoil. Pressing the existing block control just before contact staggers the attacker and enables one short counter with the existing attack control. Holding block protects normally. The current embedded CC0 Quaternius clips are retained.

Apply `ludus-v23.sql` in the project's Supabase SQL Editor after V22. The migration is repeatable and uses one transaction. It replaces only multiplayer combat RPCs and retains V22 ownership and clan reservation checks. The final query returns `Dövüş V23 hazır`. The updated multiplayer client accepts V22 responses until the migration is applied; authoritative delayed contact and timed counters require V23.

Online strikes resolve once at their scheduled contact time. The server validates facing, distance, equipped shields and new guard presses. Attack command IDs prevent a lost response from applying the same attack again. No reward or item settlement was added to the multiplayer beta.

## Validation

Run `node --test tests/combat-feel-v23.test.cjs` with Node 18 or later. The tests exercise shield recoil, timed counters, held and rapidly toggled defense, target and expiry checks, projectile defense, and compilation of embedded scripts.

Local PostgreSQL checks also cover repeatable migration, delayed damage, attack retry deduplication, late defense and authorization. Browser checks use local assets and an isolated battle fixture. Actual iPhone frame rate and a live two-device match still need device validation.
