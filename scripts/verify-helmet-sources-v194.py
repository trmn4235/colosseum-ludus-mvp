import json,struct,hashlib
from pathlib import Path
import argparse
parser=argparse.ArgumentParser();parser.add_argument('source_directory',type=Path);args=parser.parse_args()
repo=Path(__file__).resolve().parents[1]
sources=args.source_directory
def read(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);return b,j,b[28+n:]
def meshhash(j,blob):
 h=hashlib.sha256()
 def access(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];start=v.get('byteOffset',0)+a.get('byteOffset',0);dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];size={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4}[a['componentType']]*dims;stride=v.get('byteStride',size)
  h.update(str((a['componentType'],a['type'],a['count'],a.get('normalized',False))).encode())
  for k in range(a['count']):h.update(blob[start+k*stride:start+k*stride+size])
 for m in j['meshes']:
  for p in m['primitives']:
   if 'indices' in p:access(p['indices'])
   for name,i in sorted(p['attributes'].items()):h.update(name.encode());access(i)
 return h.hexdigest()
rows=[]
for original,model in [('knights_helm.glb','knights-e30cc69af0fd.glb'),('winged_helmet_gameready.glb','winged-111637d14990.glb'),('gladiator_helmet.glb','gladiator-9bcb0ac9d566.glb')]:
 a,j,ab=read(sources/original);b,k,bb=read(repo/'assets/equipment'/model)
 rows.append({'source':original,'sourceBytes':len(a),'sourceSha256':hashlib.sha256(a).hexdigest(),'gameModel':'assets/equipment/'+model,'gameBytes':len(b),'gameSha256':hashlib.sha256(b).hexdigest(),'sourceGeometrySha256':meshhash(j,ab),'gameGeometrySha256':meshhash(k,bb),'triangles':sum(k['accessors'][p.get('indices',p['attributes']['POSITION'])]['count']//3 for m in k['meshes'] for p in m['primitives'])})
for r in rows:r['geometryIdentical']=r['sourceGeometrySha256']==r['gameGeometrySha256']
print(json.dumps(rows,indent=2));(repo/'assets/items-v194/source-audit.json').write_text(json.dumps(rows,indent=2)+'\n')
