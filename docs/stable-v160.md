# Stable V160: sourced brown wood and dark grey stone

The stable previously used pale sandstone and a custom timber image. The
reference calls for brown timber and dark grey stone, using ready-made art.
V160 applies Poly Haven's Wood Plank Wall and Castle Wall Slates (CC0) to the
existing twelve-room stable, its wooden fittings, stone apron and enclosure.
Original diffuse, height and roughness maps are included at 1024px; see
assets/stable-v160/CREDITS.txt and sources.json for provenance and hashes.

The existing 44 × 34 m layout, open sandy training yard, 5.6 m walls, horses,
groom interaction, player movement and daylight remain in place. The material
shader follows the length of wooden beams and uses the supplied height maps
for relief. It marks color images as sRGB and height/roughness as linear data.

Validation uses the actual ludus page and GLB models with isolated account
data: texture loading and color spaces, shader errors, stable entry, horse
rooms, open yard, movement, groom menu, three viewport sizes and return
navigation. Screenshots come from tests/stable-scene-v159.cjs and the stable
workflow; visual inspection precedes publishing the tested commit.
