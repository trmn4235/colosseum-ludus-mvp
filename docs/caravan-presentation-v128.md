# Caravan presentation and missing rule activation — V128

The deployed frontend already contained V127 arena controls, but the database
still minted V126 encounters. Live inspection found no V127 migration and all
three existing tickets lacked `rules`. The deployed Edge Function (version 2)
was compared byte for byte with the checked-in dual-protocol verifier and matched.
The V127 migration is now applied. No active battle existed at activation. Started
legacy tickets remain replayable; all new tickets use the functioning target/hand
controls. No simulation bytes were changed.

## Player-visible changes

- Net geometry is now rendered through flight, capture and retrieval, with a rope
  to the left hand and terrain-correct height. Each disk/wrap is one merged mesh.
  Capture stuns for the existing three-second duration. Throw/capture feedback,
  selected-hand indication, a target ring, target health label and smooth locked
  camera follow make the controls visible.
- A photorealistic loading screen replaces the plain white preparation card.
  The long progress bar advances with completed environment files, combat
  scripts, authenticated ticket lookup, actors, clothing and first rendered
  battle frame. It is weighted stage progress, not a byte-download percentage;
  there is no artificial timer. Failure/retry and already-resolved tickets remain
  actionable. Portrait and short landscape layouts fit the screen.
- Both horses play the ready-made Warhorse Lite `rear` clip once on the first
  fighter death. It fades back to idle. A restored battle with existing deaths
  does not replay the scare. Idle playback is slightly livelier. Horse shadows
  join the existing bounded moving-shadow pass.
- The archer driver uses the existing licensed, ready-made Donitz tunic, belt,
  sandals and natural skin/hair, retaining the common combat rig interface.
  The selected asset is about 1.1 MB and 14,924 triangles. No 20 MB owner model is
  loaded by the battle. Scene exposure is modestly lifted; adaptive resolution,
  batching, antialiasing and shadow budgets remain in use.
- The message center derives `Kervan baskınından elde edilen 60 odun depomuza
  taşındı.` from the server's actual delivered loot. Food uses its real product
  name, e.g. `60 elma`. Only successful delivered raids generate this notice.
  Delayed delivery creates it after depot space opens. Existing supply notices
  also identify their cargo, while retaining their read/dismissal timestamps.

## Reward verification

The live server's verified settlement grants 60 units, exactly four times the
old 15-unit amount. The client cannot choose cargo or quantity. PostgreSQL
regressions confirm 60-unit capacity, food multiplication, server-only outcome,
exact-once retries and full-depot recovery. This release does not multiply 60
again or retroactively re-award prior cargo.

## Validation and deployment

- `LUDUS_CARAVAN_COMBAT_TEST=1 node tests/production-v119.cjs`
- `node tests/caravan-arena-v127.cjs`
- `node tests/caravan-verifier-v126.cjs`
- `LUDUS_CARAVAN_ARENA_TEST=1 LUDUS_FAST_BATTLE_TEST=1 node tests/caravan-combat-v126.cjs`
- `node tests/caravan-messages-v128.cjs`
- `node tests/caravan-presentation-v128.cjs`
- `node tests/caravan-field-v125.cjs`

The database message regression covers real quantities/names, ownership,
idempotency, delayed delivery and retained dismissed state. The rendered Chromium and WebKit browser
checks exercises actual target/special controls, net capture and stun, authored
horse rearing/idle recovery and visible skinned clothing. Screenshots were
inspected and a gray source-skin placeholder was corrected before release.
The existing Chromium browser suite covers both control layouts at six viewports. Browser
rendering checks do not measure physical iPhone FPS.

Database changes: `caravan_arena_v127`, then `caravan_messages_v128`. Live test
queries confirm `rules:127`, 60-unit reward, cargo wording and private function
grants. Security advisor findings are unchanged by these migrations.

## Asset preparation

`assets/caravan-v128/loading.webp` (352,044 bytes): built-in image generation.
`assets/caravan-v128/driver.glb`: selected adapted ready-made character meshes.
Attribution is retained in `assets/caravan-v128/CREDITS.txt` and the scene dialog.
The driver preparation script uses @gltf-transform/core/extensions/functions
4.5.1, meshoptimizer 1.3.0 and sharp 0.35.5. It retains original skeleton weights,
removes unused meshes/morphs/clips and embeds 512px WebP textures.

Image prompt:

> Use case: historical-scene. Asset type: photorealistic loading screen background
> for a mobile landscape Roman gladiator game, Colosseum & Magnus. Create a
> cinematic realistic photograph style scene of a caravan ambush on an ancient
> Roman forest trade road around AD 80. A believable timber wagon with weathered
> linen canopy, sacks of grain, timber cargo and a dark bay horse on the winding
> road. A fully clothed wagon driver in a simple cream linen tunic and leather
> belt, two helmeted Roman era escorts, and two gladiator raiders emerging from
> roadside trees with realistic shields and short swords. Tense moment before
> combat, no blood or gore. Dense Mediterranean woodland, sunbeams, natural olive
> greens, pale warm sunlight, rich but restrained colors, detailed wood grain,
> linen weave, metal and leather. Wide landscape composition roughly 16:9; keep
> main subjects inside central 70% so it crops well to extra-wide phones; lower
> 25% has relatively quiet shadowed road for a separate text title and long
> loading progress bar supplied by the game. Realistic photographic depth and
> light, sophisticated game key art, no cartoon, no painting, no modern clothing,
> no fantasy armor. Absolutely no text, logo, watermark, frames or UI inside the image.
