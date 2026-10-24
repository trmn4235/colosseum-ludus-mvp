# V187: shared combat rendering budget

The retired 50,880-triangle chest is no longer downloaded by any of the five
gladiator renderers. Legacy inventory identifiers resolve to the existing
`chest_plate` mesh (260 triangles, 452 with the fitted edging). Item ownership,
combat values and authenticated simulation/replay formats are unchanged.

Transform caching is scoped to synchronous pose evaluation. Local changes and
parent revisions invalidate cached world transforms; normal Three.js rendering
runs outside that scope. The exact-pose test compares every local/world matrix
with caching disabled across 324 frames in each of five renderers. Results:
zero numerical difference, 78–82% fewer matrix compose/multiply operations.
This operation count is not an FPS measurement.

Crowded arenas now use the existing baked body LOD data. Automatic detail keeps
the player, focus opponent and one other nearby body at full detail. Combat and
collision simulation still run for every fighter. Caravan poses outside this
focus update at 20–30 Hz, root movement remains interpolated, completed corpses
settle, and unchanged shadow membership avoids repeated hierarchy scans.

Frame hosts retain elapsed time up to 250 ms and consume bounded fixed steps.
Hidden/paused frames do not catch up combat. Caravan still records inputs at
10 Hz and simulates at 30 Hz; arena simulation remains 60 Hz. Tests exercise
10, 15, 30, 60 and 120 display frames per second, pause, and caravan replay.

Circus architecture is batched by material and spatial section, so the race
camera can reject unseen sections. Its cached sun shadows are rebuilt with all
static casters when needed; the live shadow pass then contains moving objects.
Crew rig meshes and basket parts are batched; hidden legacy reins and duplicate
horse skeleton/rein updates are removed. Live shadows are limited to 30 Hz.
Caravan/Circus framebuffer budgets cap touch DPR at 1.25 and desktop DPR at 1.5.

## Recorded scene comparisons

Same local fixtures, camera and geometry counters in headless Chromium:

| Scene | V186 colour triangles | V187 colour triangles | V186 incl. live shadows | V187 incl. live shadows |
| --- | ---: | ---: | ---: | ---: |
| Caravan, 5 allies + 5 guards + archer | 1,245,418 | 703,910 | 1,727,354 | 946,578 |
| Circus, 4 carts + 8 horses + 8 crew | 1,332,339 | 951,183 | 2,658,867 | 1,603,538 |

The 20-fighter arena budget fixture renders 865,820 triangles including shadows.
Counts include real loaded models. `renderer.info.autoReset=false` is required
to include shadow passes; default renderer counters omit that work. Headless
software rendering does not establish FPS, thermals or sustained frame pacing
on the user's phone. Those remain device measurements.

`render-performance-v187.yml` gates full scene budgets, exact animation poses,
retired asset loading and low-FPS clocks. Local commands:

```sh
node tests/render-runtime-v187.cjs
node --test tests/arena-timing-v94.test.cjs tests/naval-performance-v106.test.cjs
LUDUS_PERFORMANCE_TEST=1 node tests/arena-browser-v96.cjs
node tests/caravan-performance-v187.cjs
node tests/circus-performance-v187.cjs
```

The normal caravan settlement/replay, naval performance, pit bot/online, ordinary
five-lap race and two-person war race browser suites were also run. User-approved
conversation layout and combat controls remain as previously specified.
