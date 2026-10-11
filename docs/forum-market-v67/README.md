# Forum Pazarı V67 — Beyaz / bordo / altın

Fixes the oversized bottom create button, wide sidebar, invisible active Forum
icon, ornament/title overlaps, pale heading, brown surfaces and plain balance.
The shared palette and rules are documented in `../ui-design-system.md`.

The create action is now a compact header button. The narrow rail has contrasting
icons. Own listings use the full footer width. The wallet has a coin medallion,
currency label and a live numeric amount. Both market modes, the creation form
and confirmation dialogs use the same palette. Repeated equipment SVGs now have
unique clipping IDs, preventing neighbouring atlas cells from bleeding into the
large creation preview.

## Validation

- Seven existing market rule/controller tests pass.
- `tests/forum-market-layout-v67.cjs` runs the real HTML, styles, icon renderer
  and UI controllers against local RPC fixtures. It checks empty, populated and
  create views at 1536×706, 844×390, 667×375 and 568×320 (12 views), panel bounds,
  horizontal overflow, white surfaces, active icon contrast, top action placement,
  visible listing space, unique image crop IDs, net income and the fixed publish
  button. It also opens the purchase dialog and Basic mode, checks the existing
  portrait orientation gate, and records no browser JavaScript errors.
- The included PNGs are browser renders with test data, not a live account.
- Chromium automation does not replace a physical iPhone/Safari check.

Run:

```sh
node --test tests/forum-market-v66.test.cjs tests/forum-market-runtime-v66.test.cjs
CHROMIUM_PATH=/path/to/chromium node tests/forum-market-layout-v67.cjs
```

`CHROMIUM_PATH` is optional with Playwright's default Chromium installed.
`CODEX_PRIMARY_RUNTIME_NODE_MODULES` points to the runtime's Playwright module.
`LUDUS_TEST_OUTPUT` optionally selects a screenshot/report directory.
