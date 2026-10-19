"""Freeze the existing arena simulation and rig for the caravan encounter.

The arena remains unchanged. Browser and server replay import identical simulation
bytes; copied art/animation attribution stays with the extracted source.
"""
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
scripts = re.findall(r'<script[^>]*>(.*?)</script>', (root / 'arena.html').read_text(), re.S)
core = next(s for s in scripts if s.strip().startswith('var ArenaClasses='))
core = core.replace("typeof module!=='undefined'", 'false')
core = core.replace("})(typeof window!=='undefined'?window:globalThis);", '})(root);')
marker = '/* Arena simulation:'
core = core.replace(marker, 'Object.assign(root,{ArenaClasses,ArenaWeapons,ArenaMotion});\n' + marker)
stats = next(s for s in scripts if s.strip().startswith('// Public browser configuration.'))
stats = stats.split('// Per-owner, per-battle outbox.')[0]
exercise = (root / 'gladiator-exercise-v46.js').read_text()
core += '\n' + exercise.replace("typeof module!=='undefined'", 'false') + '\n' + stats
core += '\nObject.assign(root,{LudusLoadout,LudusItemSystem,LudusExercise});\n'
core = '/* Arena V115 simulation, frozen for deterministic caravan replay. */\n(function(root){\n' + core + '\n})(globalThis);\n'
(root / 'caravan-core-v126.js').write_text(core)
rig = next(s for s in scripts if s.strip().startswith('/* Human graphical assets:'))
(root / 'caravan-rig-v126.js').write_text('\n'.join(line.rstrip() for line in rig.strip().splitlines()) + '\n')
assets = next(s for s in scripts if s.strip().startswith('// A single validated download'))
(root / 'caravan-assets-v126.js').write_text(assets)
edge = root / 'supabase/functions/caravan-combat-v126'
edge.mkdir(parents=True, exist_ok=True)
for name in ['caravan-core-v126.js', 'caravan-simulation-v126.js']:
    (edge / name).write_bytes((root / name).read_bytes())
