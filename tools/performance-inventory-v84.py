"""Reproducible inventory of every tracked file in the V83 baseline."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '7de1ba4289b9f942d583120ae8b0c07f3c5342b1'
parser = argparse.ArgumentParser()
parser.add_argument('--baseline-root', type=Path)
parser.add_argument('--output', type=Path)
args = parser.parse_args()
paths = subprocess.check_output(['git', 'ls-tree', '-r', '--name-only', BASELINE], cwd=ROOT, text=True).splitlines()
signals = {
    'animationFrames': r'\brequestAnimationFrame\s*\(',
    'intervals': r'\bsetInterval\s*\(',
    'layoutReads': r'\.getBoundingClientRect\s*\(',
    'clientCreation': r'\b(?:supabase\.createClient|LudusClient\.create)\s*\(',
    'userChecks': r'\.getUser\s*\(',
    'modelLoads': r'GLTFLoader|ArenaAssetLoad\s*\(',
    'sceneTraversals': r'\.traverse\s*\(',
}
text_extensions = {'.html', '.js', '.css', '.sql', '.py', '.cjs', '.md', '.json', '.txt', '.webmanifest'}
rows = []
for name in paths:
    before = (args.baseline_root / name).read_bytes() if args.baseline_root else subprocess.check_output(['git', 'show', BASELINE + ':' + name], cwd=ROOT)
    file = ROOT / name
    after = file.read_bytes() if file.exists() else b''
    ext = Path(name).suffix.lower() or '(none)'
    area = ('verification' if name.startswith(('tests/', 'tools/')) else
            'documentation' if name.startswith('docs/') or ext in {'.md', '.txt'} else
            'database' if ext == '.sql' or name.startswith('supabase/') else
            'page' if ext == '.html' else
            'runtime' if ext == '.js' else
            'style' if ext == '.css' else
            'asset' if ext in {'.glb', '.webp', '.png', '.jpg', '.jpeg', '.svg', '.zip'} else 'configuration')
    row = {'file': name, 'area': area, 'extension': ext, 'beforeBytes': len(before), 'afterBytes': len(after), 'unchanged': before == after,
           'beforeSha256': hashlib.sha256(before).hexdigest(), 'afterSha256': hashlib.sha256(after).hexdigest()}
    if ext in text_extensions and area not in {'verification', 'documentation'}:
        source = after.decode('utf-8', errors='replace')
        row['sourceSignals'] = {k: n for k, pattern in signals.items() if (n := len(re.findall(pattern, source)))}
    if ext in {'.webp', '.png', '.jpg', '.jpeg'}:
        from PIL import Image
        with Image.open(file) as image:
            row['image'] = {'width': image.width, 'height': image.height, 'mode': image.mode}
    rows.append(row)
result = {'baselineCommit': BASELINE, 'scope': 'All files tracked by the baseline; added V84 files are listed in the commit diff.',
          'trackedFiles': len(rows), 'extensions': dict(sorted(collections.Counter(r['extension'] for r in rows).items())),
          'areas': dict(sorted(collections.Counter(r['area'] for r in rows).items())), 'files': rows}
content = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
if args.output:
    args.output.write_text(content)
else:
    print(content, end='')
