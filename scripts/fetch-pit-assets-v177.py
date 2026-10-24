"""Fetch official CC0 surfaces/props and retain source checksums for the build."""
import concurrent.futures,hashlib,json,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/pit-v177';OUT.mkdir(exist_ok=True)
TMP=pathlib.Path('/tmp/pit-v177-sources');TMP.mkdir(exist_ok=True)
def get(url):return subprocess.check_output(['curl','-fsSL','--retry','2','--max-time','40',url])
def fetch(asset,kind):
    meta=json.loads(get('https://api.polyhaven.com/files/'+asset));records=[]
    if kind=='texture':
        for key,name in [('Diffuse','color'),('nor_gl','normal'),('Rough','rough')]:
            url=meta[key]['1k']['jpg']['url'];raw=get(url)
            target=TMP/(asset+'-'+name+'.jpg');target.write_bytes(raw)
            records.append(dict(asset=asset,file=asset+'-'+name+'.webp',source=url,sha256=hashlib.sha256(raw).hexdigest(),license='CC0'))
    else:
        data=meta['gltf']['1k']['gltf'];folder=TMP/asset;folder.mkdir(exist_ok=True)
        for name,url in [('scene.gltf',data['url'])]+[(n,e['url'])for n,e in data['include'].items()]:
            raw=get(url);target=folder/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
            records.append(dict(asset=asset,file=name,source=url,sha256=hashlib.sha256(raw).hexdigest(),license='CC0'))
    print(asset,'downloaded',flush=True);return records
with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
    futures=[pool.submit(fetch,a,k)for a,k in [('large_sandstone_blocks','texture'),('old_sandstone_02','texture'),('wooden_crate_01','model'),('wooden_bowl_01','model')]]
    records=[r for f in futures for r in f.result()]
(OUT/'sources.json').write_text(json.dumps(records,indent=2)+'\n')
