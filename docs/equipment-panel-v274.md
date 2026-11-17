# V274 battle preparation panel

Prepared on the local review branch, not published. The V271 career SQL patch remains unapplied to live Supabase.

- Petrol navigation and slate-blue information panels replace the burgundy header and all-black composition. Stone-gray marble item trays provide a distinct, lighter surface. Enhancement numbers remain plain dark-gray text with their own reserved area.
- Widened inventory uses five columns by two rows. One shared page-size constant controls pagination and slicing at ten items. The category line shows the actual eligible inventory count; categories with fewer items do not fabricate entries.
- The character panel, six equipped slots, selected-item stats and four emerald sockets remain visible. New restrained selection outlines and matching secondary/primary buttons clarify current equipment and the battle action.
- Removed superseded V272/V273 palette blocks instead of stacking new color variants on them.
- Fixed the old heavy-mace/warhammer artwork override in `equipment-groups-v168.js` to prefer the shared exact-item renderer. Those items now receive the same enhancement header and transparent artwork container. Asset bytes and model identity are unchanged. All importing HTML pages invalidate the modified script.

## Verification

- Nine item identity, recipe, asset-hash and rig tests passed. Added a regression assertion that each known equipment item, including the two blunt weapons, includes its separate enhancement header.
- All seven inline scripts in `savas.html` pass JavaScript parsing; diff whitespace check passes.
- Browser fixture: twelve eligible weapons show ten on page one and two on page two. Returning to page one and selecting the tenth weapon updates the equipped slot and details.
- Phone layouts checked at 874x402 and 568x320; ten item cards, stats and four sockets fit without internal panel overflow.
- Screenshot uses isolated sample data. WebGL is unavailable in the QA browser, so the existing static fallback is shown; actual iPhone 3D rendering is not verified here.
