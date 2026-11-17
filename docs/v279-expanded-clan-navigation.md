# V279 — Tüm klan bölümleri aynı menüde

- Removed the More dropdown and its event handlers. Level, trophies, management and bot administration now join the primary horizontal navigation; rankings retains its existing external-page link as the last equal-width destination.
- Permission conditions are unchanged: management remains leader-only, and bot administration appears only when the existing RPC authorizes that account. Grid columns follow the actual number of permitted destinations.
- Icons sit above single-line labels so all 11 administrator destinations fit the landscape panel without scrolling. Existing page content, map and game data are unchanged.

Validation: 5 existing dashboard checks passed, including inline script parsing. Browser preview checked the leader menu and the 11-entry administrator menu at 874×402 and 568×320. All entries share the same row and equal widths; full labels fit. Level, trophies, management and bot views open through their new visible entries. The administrator state used for preview is fixture-only and grants no production permission.

Local commit only; no push or deployment performed.
