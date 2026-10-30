# V211 — another ten percent of HUD height

Relative to V210, the overall HUD height, painted frame height and marble wing height are reduced by 10%. All square icons, including map, trophy and the centered level badge, scale uniformly to 97%; the additional seven percentage points of compression come from the surrounding marble space. Typography and end ornaments scale by the same 3% to retain their proportions.

The V210 spacing rule is retained exactly: six units between every resource/crew icon and its value, eight-unit endpoint clearances, and equal spaces between the five complete groups in each wing. Horizontal frame width, safe-area behavior, order, colors and live data are unchanged. The notification badge is lowered slightly so it remains inside the shallower marble band; its malformed inherited border-length declaration is also corrected.

The existing Chromium/WebKit HUD regression checks the new 90% frame/container heights and 97% artwork sizes together with all V210 spacing assertions. It also measures the unread badge against the inside of the new frame, and retains seven landscape viewports, six balance states, notch simulations, two-digit crew counters, settings/navigation and rotation checks.
