# V205 — restore the previous Ludus menu

The user rejected the overlapping marble HUD and requested the former top menu. `ludus.html` restores the pre-V202 version from `123e1f2`: the burgundy resource strip, original SVG icons, caravan counter, `Sv.` level text, friends/messages/settings and the original beginner-guide book behavior. The five resources show their full amounts. The V202 render module and stylesheet are no longer loaded; its roster counter and new icon strip are removed from the active page.

The old wallet callbacks, caravan update and level rendering are restored together. The current item fixes and ranking functionality remain in place. The existing Harita / Sıralamalar entrance is again outside the resource strip. No account balances, gameplay data or database schema are changed.

The only addition to the pre-V202 page is a compact-landscape fit rule: below 700px the original gaps contract, and below 600px the original icons/text become smaller. This fixes the old menu's edge overflow with seven/eight-digit balances without changing its color, ordering or structure. At wider sizes the restored page matches the previous menu.

## Validation

- All inline scripts compile, and the restored source has no V202 HUD dependency.
- `node tests/hud-v205.cjs` renders production HTML/CSS with the actual wallet, level and caravan rendering functions, original SVGs and beginner guide. It checks 1440×800, 932×430, 874×402, 844×390, 760×360, 667×375 and 568×320 with normal, large and zero balances. Bounds include actual text ranges and SVGs, not only container boxes. It also checks button hit targets, counters, guide completion, help/settings, destinations and rotation.
- `node tests/caravan-collection-v116.cjs` generates isolated database fixtures; `node tests/caravan-browser-v116.cjs` checks the restored HUD in the complete 3D courtyard, including real supply and reward callbacks.
- The existing HUD workflow now runs the restored-menu checks in Chromium and WebKit. Retired V202 layout fixtures have been replaced. Tests mock account APIs and do not access or mutate a player's account.
