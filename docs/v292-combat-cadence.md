# V292 — Combat pose cadence and transition continuity

Ranked mobile pose scheduling keeps the remainder of each elapsed interval.
Setting every deadline to `now + interval` had reduced the intended 20/10 Hz
remote pose rates when display frames arrived after a deadline. Stable per-fighter
phases now spread routine skeleton updates over display frames, while the local
fighter continues to animate on every frame. Long stalls never replay a backlog
of poses. Walking, blocking, reaction expiry and visibility reentry receive a
fresh pose immediately; invisible remote skeletons remain culled.

The shared authored animation transition no longer counts time spent in a
previous action toward a newly observed action's entry. A 5 ms attack first seen
after a 100 ms pose gap previously skipped the entire 85 ms entry blend. Initial
age is now limited to the actual action/clip elapsed time, including jump phase
boundaries; untimed guards and idle/exit transitions start at zero. Subsequent
poses advance normally. A valid zero age is preserved instead of falling through
to a completed blend. Contact geometry and authoritative combat remain unchanged.

Validation includes actual multiplayer controller cadence at 30, 59.94, 60,
60.01, 119.88 and 120 display FPS, irregular frame spacing, a long stall, immediate
visual transitions and visibility reentry. Real-rig entry tests cover 0/5 ms
attacks across 8.3–250 ms pose intervals, restarted actions, exact weapon grip,
guards/reactions, pit action exits and jump phase boundaries. The reported
regressions fail with V291 behavior. Existing V291 motion/camera/control tests,
V252 latency tests and V290 action-cost tests remain part of validation.

These are automated timing and scene-graph checks, not physical iPhone FPS
measurements. No database migration, damage, stamina, rewards or papyrus rules
are changed.
