# V292 — Equipment continuity and locomotion work

The previous palm orientation used by the grip solver was stored in world
coordinates. Reversing the character's heading could therefore select the
opposite solution for the same local pose. The history now stays in character
coordinates and is transformed by the current root orientation when solving.
The reproduced halberd case changed the hand orientation by approximately 179
degrees relative to an otherwise identical unturned character.

Inactive carried weapons now seat their actual handle on the solved palm. During
an attack-to-guard transition the nominal carry target can briefly be outside the
arm's reach; the previous implementation left the weapon floating away from the
hand. Active attack sweeps and shield collision placement keep their original
targets. The existing anatomy checks must still pass without relaxed tolerances.

Locomotion no longer solves temporary empty-handed swings for weapon-bearing
arms that the repaired grip solver immediately replaces. Free arms, shields,
archers, naval jumps and rigs without the repaired anatomy retain their existing
behavior. A real-rig comparison covers irregular frame intervals, speed changes,
turns, backward movement, attacks, guards, dual wielding and fallback paths. It
checks final bone, equipment and sampled skin transforms against the original
locomotion path and counts the removed arm solves.

Inspection of seven class rigs found no equipment rebuilds during 180 warmed-up
walking poses per class. The existing equipment fitting cache is retained.
Animation and contact tests exercise the actual rig without GPU rendering;
their results do not establish a physical iPhone FPS improvement or prove that
every visible form of shimmer has been eliminated. No server combat rules,
inventory data, currency, papyrus bonuses or database migrations change.
