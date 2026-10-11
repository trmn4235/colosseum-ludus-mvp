# V80 — compact login panel before the artwork title

Move the shared welcome/login/membership/password panel to the safe top-left edge. Reduce its width, padding, title, primary buttons and sound control. Limit the right edge to 31% of the viewport minus 12 CSS px so it leaves space before the artwork's Colosseum C, which begins beyond 31% even when the contain-fitted image is letterboxed.

The same anchor serves all auth views. Narrow landscape membership/reset forms use full-width inputs and internal vertical scrolling. A long Ludus name wraps within the card. Keep the artwork, reveal timing, account APIs and game links unchanged. Advance the entry stylesheet, index metadata and manifest start URL to revision80; preserve app ID and scope.

Validation: the actual-page UI check covers six auth states, four landscape sizes, the measured title gap, a simulated 59 px left safe inset, short keyboard height and both combat HUD presets. Login intro/settings checks cover reveal, orientation, artwork failure, account switching, password reset and saved controls. Tests use isolated account fixtures with no production mutations.
