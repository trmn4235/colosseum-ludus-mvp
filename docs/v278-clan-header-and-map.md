# V278 — Klan menüsü ve harita boşlukları

- Removed the name, wallet and refresh group from the clan header, including its DOM-dependent update handlers. Automatic state refresh and failure retry remain available.
- Header destinations and More use equal grid columns across the remaining width. The column count follows the current authenticated menu, including the no-clan entry state.
- Home title row is reduced from 62 to 32 stage pixels with smaller heading and gaps. Home subtitle and the repeated top level tag are removed; the level/EXP card and dedicated progression page remain.
- The map card is narrower and its canvas spans the full inner width at the original 2:1 ratio. Source art and marker coordinates are unchanged; no stretching, cropping or side padding. Banner, map and right rail align at their upper and lower edges.
- The released code contains no sample state. Existing preview fixtures still explicitly label account data and war time as examples.

Validation: 9 existing dashboard/map checks passed. Browser checks at 874×402 and 568×320 confirmed zero horizontal map gutters, a 2:1 canvas, equal menu widths, aligned cards, and working Members/More navigation. Other pages retain their useful subtitles. No new tests added for these reversible visual changes.

Local commit only; no push or deployment in this turn.
