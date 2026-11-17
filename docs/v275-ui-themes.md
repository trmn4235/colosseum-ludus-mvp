# V275 — three persistent UI themes

The preparation screen gives the gladiator approximately 25% more width at the primary landscape breakpoint. Equipped slots and inventory cards show the original item image and enhancement only. Names remain in accessible labels and in the selected item's detail panel. Ten inventory entries remain visible as a five-by-two grid.

The existing settings dialog now offers White Marble (burgundy/gold), Black Marble (anthracite/silver), and Blue (petrol/champagne). The theme runtime loads synchronously before styles in every root HTML entry. It records the preference in the device's local storage, restores it on navigation and back-forward cache activation, and synchronizes other same-origin open pages through storage events. Camera, control preferences and account data are separate. Blocked storage and unknown saved values cannot break startup.

The shared first CSS layer supplies the palette to page surfaces, headers, buttons, item tiles and dialogs, including preparation, market/forum, upgrades, clan, workers/caravans, rankings and existing Ludus overlays. No scene materials, 3D models, item textures, game balance or NPC dialogue geometry are changed. Item backgrounds remain distinct from the main panels. Theme controls use native accessible radio inputs and fit the existing settings window at short landscape sizes.

Validation:

- Five runtime/integration tests in `tests/ui-theme-v275.cjs` pass, covering defaults, persistence, cross-page changes, back-forward restoration, blocked storage and all HTML entry points.
- All nine existing item identity/render/rig regression tests in `tests/item-identity-v199.cjs` pass.
- Browser review uses isolated fixtures from the actual page source. No production account writes occur. Settings fit 568×320 without internal scrolling; preparation retains ten cards and no visible item labels. Market, upgrades and clan use the saved palette and readable headings.
- The review browser cannot initialize WebGL; it uses the existing fallback character image. This is layout/theme verification, not an iPhone 3D rendering or performance test.
- Changes are local and have not been pushed or deployed. Earlier V271 career migration remains a separate pending production step.
