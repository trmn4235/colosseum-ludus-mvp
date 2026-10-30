# Roma map — V212

The approved Roma city illustration replaces the small flat map. The map covers its panel without side gutters and keeps four interactive HTML destination markers aligned to the artwork. One 368 KiB WebP supplies the map and the four recomposed card photographs through SVG viewports.

On wide screens the destination column is exactly 1.25 times V181's width formula. Less-wide and portrait screens place the full map above the destination cards. The rankings entry is removed only from Roma; other rankings entry points remain available.

The small arena is now named **Aventinus Arenası** throughout current game headings, map controls, arena results and multiplayer labels. Its existing `pit` IDs, `san-avlusu.html` route, Şan currency, combat and betting behavior are unchanged. Ludus remains the player's school; the map information dialog identifies the illustration and fictional venues without claiming geographic scale.

## Validation

- Browser inspection at 932×430, 667×375, 390×844, 1536×706 and 1440×900: artwork fills the panel, four markers and card labels fit, and the page has no overflow.
- The information dialog opens and closes with the new venue name and scale clarification.
- Existing `tests/rome-travel-v148.cjs` now checks the approved artwork, renamed arena, absence of the rankings banner, 25% sidebar increase and marker/card bounds. Existing door-to-map, loading, Colosseum/Circus entry and Ludus return-state checks remain in place.
- The Rome loading workflow now runs these regression checks for relevant pull requests as well as main pushes.

No NPC dialogue layout, database, authentication or gameplay rules were changed.
