"""Download official CC0 assets; preserve geometry/UVs and record source hashes."""
import concurrent.futures, hashlib, io, json, pathlib, subprocess, sys
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/pit-v175'
OUT.mkdir(parents=True,exist_ok=True)
TMP=pathlib.Path('/tmp/pit-v175-sources'); TMP.mkdir(exist_ok=True)
floor_only='--floor-only' in sys.argv
records=[r for r in json.loads((OUT/'sources.json').read_text()) if not r['file'].startswith('paving-')] if floor_only else []
def get(url):
    return subprocess.check_output(['curl','-fsSL','--retry','2','--max-time','40',url])
def texture(asset,prefix):
    data=json.loads(get('https://api.polyhaven.com/files/'+asset))
    for key,suffix in [('Diffuse','color'),('nor_gl','normal'),('Rough','rough')]:
        entry=data[key]['1k']['jpg']; raw=get(entry['url'])
        name=prefix+'-'+suffix+'.webp'
        Image.open(io.BytesIO(raw)).save(OUT/name,'WEBP',quality=92)
        records.append(dict(file=name,source=entry['url'],sha256=hashlib.sha256(raw).hexdigest(),license='CC0',asset=asset))
def bench():
    data=json.loads(get('https://api.polyhaven.com/files/painted_wooden_bench'))['gltf']['1k']['gltf']
    folder=TMP/'bench';folder.mkdir(exist_ok=True)
    raw=get(data['url']);(folder/'bench.gltf').write_bytes(raw)
    records.append(dict(file='bench.glb',source=data['url'],sha256=hashlib.sha256(raw).hexdigest(),license='CC0',asset='painted_wooden_bench'))
    for name,entry in data['include'].items():
        target=folder/name;target.parent.mkdir(parents=True,exist_ok=True);raw=get(entry['url']);target.write_bytes(raw)
        records.append(dict(file=name,source=entry['url'],sha256=hashlib.sha256(raw).hexdigest(),license='CC0',asset='painted_wooden_bench'))
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    jobs=[pool.submit(texture,'large_grey_tiles','paving')]
    if not floor_only: jobs += [pool.submit(texture,'painted_plaster_wall','plaster'),pool.submit(bench)]
    for job in jobs: job.result()
(OUT/'sources.json').write_text(json.dumps(sorted(records,key=lambda x:x['file']),indent=2)+'\n')
print('Downloaded',len(records),'verified source files')
