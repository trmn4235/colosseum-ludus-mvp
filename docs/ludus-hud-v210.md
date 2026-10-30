# V210 — shared pair spacing and evenly distributed groups

Every resource and crew indicator uses the same six-unit gap between the visible icon and its value. This applies to gold, diamond, sapphire, emerald, ruby, gladiators and caravans. The gap scales with the existing safe content width and never changes with the length of a value.

Each wing uses one distribution rule: anchor the first group eight units after the visible starting boundary, anchor the last group eight units before the ending boundary, and divide the remaining space equally between the five complete groups. On the left the endpoints are gold and ruby; on the right they are gladiators and settings. Caravan, friends and messages now share the same inter-group clearance as the other right-wing indicators. There is no separate crew/social spacing rule.

Long resource balances keep their exact accessible value and use the existing shorter compact labels or uniformly reduced number type when necessary. Fitting only affects the text, never the shared icon/value gap or the anchored endpoints. The V209 frame, height, icon sizes, marble, ornaments, center badge, mirrored map/trophy and live availability refresh are retained.

The updated browser regression measures all seven pair gaps together and the four inter-group gaps within each wing. It also checks anchored endpoints, clearances, unchanged dimensions, long and pending balances, two-digit crew counters, seven landscape viewports, 47px/62px notch simulations, live updates, touch targets and navigation in Chromium and WebKit.
