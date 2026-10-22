# Stone stable and sand training courtyard

The twelve horse rooms now stand next to one another along the back of an open training yard. Each room has stone partitions, timber posts, a wooden half door with iron hinges, bedding, a manger and water. A flush cobbled apron connects their doors to the sand. The roof covers only the horse rooms; the yard uses the existing ludus sky and daylight. The surrounding walls match the ludus side-wall height of 5.6 metres.

The old central aisle and its separating gate are removed. Entry places the player in the training yard with the stable frontage ahead and the groom nearby. Small herds occupy the central rooms first. Inspecting a horse puts the player on the apron outside its door. Movement bounds derive from the environment dimensions instead of independent constants.

Return frames record the stable layout version. Positions from the old 70-metre floor plan fall back to the new entry; valid current positions can be restored across the whole yard. The login entry and scene script URLs use revision 159.

The existing horse rules, purchases, breeding, care and seven-tab menu are unchanged. Geometry tests cover real GLB scale, direction, clear approaches, an unroofed yard, shared sunlight and repeated entry. `tests/stable-scene-v159.cjs` opens the actual ludus page using isolated account data, exercises entry, the groom, navigation restoration and three viewport sizes, and produces screenshots. The stable workflow now runs this browser check and preserves its images before publishing changes.
