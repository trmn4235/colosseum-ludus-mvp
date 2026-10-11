# V79 — balcony residents, top-right auth and compact combat HUD

- Shift both starter and authenticated resident home rows 2 m away from the balcony: front row Z 4.4 → 2.4. Keep 3 m horizontal and 2.5 m row spacing. Returning residents use the same shifted homes; training station layouts are unchanged.
- Anchor welcome, login, membership, forgotten-password and reset-password views at the same safe top-right edge. Longer forms grow downward; short keyboard viewports retain internal scrolling and reachable fields. Keep artwork reveal, account switching and auth behavior unchanged.
- Reduce combat health/stamina icons 26 → 20 CSS px, glyphs 16 → 12 px, and bars 12 → 10 px. Bar width is now `clamp(105px,17vw,205px)`; the group starts closer to the safe left edge. Both classic and anatomical control presets share the layout.
- Advance entry and navigation URLs, installed-app start URL, page metadata and changed stylesheet queries to revision79. Keep the manifest ID and scope unchanged. V78 still had revision40/revision44/revision77 entry links, which could reuse cached page markup and its old stylesheet queries.

## Checks

`node tests/ui-revisions-v79.cjs` checks actual login markup, six auth views, keyboard reachability, both HUD presets at 568×320, 667×375, 844×390 and 1536×706, current navigation links, and 2–30 resident homes. All account operations use isolated stubs, never production data.

`node tests/arena-ui-v78.cjs` additionally checks the real arena/Ludus scenes and models, shifted resident homes and balcony screenshot, rest-room return, acknowledged rewards, finished render freeze, office loading and wall torches.

Login-intro and login-settings regression checks preserve cinematic reveal, portrait gating, reduced motion, artwork failure recovery, account switching, password reset and saved controls. Inline scripts and the existing nine V78 stat/reward/render checks also pass. No database or auth API changes are included.
