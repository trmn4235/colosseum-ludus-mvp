# V188: frame pacing across gameplay hosts

V187 removed redundant rig work and reduced geometry. V188 addresses uneven
pose scheduling and the inconsistent automatic rendering controls between
scenes. It does not change combat rules, input timing or replay formats.

## Causes and changes

- The old adaptive controller discarded every frame longer than 250 ms. At
  sustained 2–3 FPS it never reduced load. It now includes repeated slow frames,
  excludes background/loading gaps above one second, and reacts after a bounded
  measurement window. An isolated stall does not lower image quality.
- Arena, caravan, Circus Maximus, Ludus and online arena now share `RenderScale`.
  Only the WebGL drawing buffer changes; CSS controls, text and loading images
  retain their dimensions. Paused/loading/hidden sampling is suspended by the
  host. Circus static architectural views restore the permitted maximum.
- Touch rendering is capped at DPR 1.25 / 900,000 pixels; desktop rendering at
  DPR 1.5 / 1,600,000 pixels (online additionally caps DPR at 1.3). The normal
  adaptive floor is 0.75, or the pixel-budget ceiling if that is lower. A former
  0.875 floor in the ceiling calculation incorrectly exceeded the pixel budget
  on large viewports. Arena's explicit high/low settings remain available.
- Sustained slow play lowers resolution in bounded steps; six seconds of stable
  fast samples raises it gradually, with cooldowns between changes. At low
  resolution, live shadows in arena, caravan and Circus update at 15 Hz.
- Distant arena and caravan pose work is staggered by fighter ID. Nearby focus
  fighters still update every frame, root positions continue to interpolate,
  and action transitions update immediately.
- Online arena used rounded expected buffer dimensions, while Three.js floors
  the actual dimensions. At fractional DPR this could resize the canvas every
  frame. Resizing now depends on CSS viewport dimensions and device DPR.

## Recorded verification

The same eleven-character caravan fixture ran the previous and current pose
schedulers with real animation evaluation. Three focus fighters update every
frame; the other eight keep approximately 30 pose evaluations per second.

| Display cadence | V187 pose evaluations per frame | V188 pose evaluations per frame |
| --- | --- | --- |
| 60 Hz | 3–11 | 7 |
| 120 Hz | 3–11 | 5 |

This removes recurring work spikes without reducing the distant update rate.
The deterministic counts, rather than machine-dependent execution time, are
the regression assertions.

Actual host loops and WebGL drawing buffers were exercised in Chromium for all
five hosts. Controlled 10 FPS intervals reached the allowed floor, pausing
preserved it, and controlled 60 FPS intervals restored detail gradually. Across
820–840 sampled frames each host resized its buffer only 2–3 times. Canvas CSS
bounds and body text size stayed identical. The online test uses an odd
931 × 429 viewport to cover fractional buffer rounding.

The 36 timing, scheduling and adaptive-quality unit tests pass. Exact-pose
comparisons remain unchanged; full arena, caravan and war-race geometry budgets,
10–120 FPS clocks and caravan replay pass. Real Ludus panels and two online
clients with server-acknowledged input pass. These tests use controlled cadence
or headless rendering; they do not measure sustained FPS or thermal behaviour
on a physical phone.

## Regression commands

```sh
node --test tests/arena-timing-v94.test.cjs tests/naval-performance-v106.test.cjs tests/adaptive-quality-v96.test.cjs tests/render-scale-v188.test.cjs
node tests/render-runtime-v187.cjs
LUDUS_RENDER_SCALE_TEST=1 LUDUS_PERFORMANCE_TEST=1 node tests/arena-browser-v96.cjs
LUDUS_RENDER_SCALE_TEST=1 node tests/caravan-performance-v187.cjs
LUDUS_RENDER_SCALE_TEST=1 node tests/circus-performance-v187.cjs
LUDUS_RENDER_SCALE_TEST=1 LUDUS_MODERN_PANELS_TEST=1 node tests/production-browser-v122.cjs
LUDUS_RENDER_SCALE_TEST=1 node tests/combat-motion-online-v163.cjs
node tests/circus-driving-v183.cjs
```

The performance, arena-realism and caravan-collection workflows run the new
host-level regressions on future relevant changes.
