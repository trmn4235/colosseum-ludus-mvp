"""Combine licensed ready models; share palettes and reduce distant-prop texture maps."""
import copy, hashlib, io, json, pathlib, struct, sys
from PIL import Image
source=pathlib.Path(sys.argv[1]); destination=pathlib.Path(sys.argv[2])
models={
 'table':'packs/furniture-kit/tablecross.glb','bench':'packs/furniture-kit/bench.glb',
 'apples':'apple-crate.glb','fish':'mackerel.glb',
 'meat':'ham.glb','barrel':'packs/food-kit/barrel.glb',
 'bowl':'packs/food-kit/bowl-broth.glb','sack':'bag.glb','cauldron':'cauldron.glb','shelf':'packs/furniture-kit/bookcaseopen.glb'}
out={'asset':{'version':'2.0','generator':'Ludus dining V53: ready Kenney/Quaternius models'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'accessors':[],'bufferViews':[],'materials':[],'textures':[],'images':[],'samplers':[]}; binary=bytearray(); images={}; materials={}; report=[]
def append(data,target=None):
 while len(binary)%4: binary.append(0)
 view={'buffer':0,'byteOffset':len(binary),'byteLength':len(data)}
 if target:view['target']=target
 binary.extend(data);out['bufferViews'].append(view);return len(out['bufferViews'])-1
for name,file in models.items():
 data=(source/file).read_bytes();n=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+n]);buf=data[28+n:];views={};image_map={};texture_map={};mat_map={}
 # Props are small on screen: retain colour detail at 256px; discard 2K normal/ORM maps.
 for material in g.get('materials',[]):
  material.pop('normalTexture',None);material.pop('occlusionTexture',None);material.pop('emissiveTexture',None)
  pbr=material.setdefault('pbrMetallicRoughness',{});pbr.pop('metallicRoughnessTexture',None);pbr['roughnessFactor']=.88;pbr['metallicFactor']=.35 if name=='cauldron' else 0
 used_textures={m['pbrMetallicRoughness']['baseColorTexture']['index']for m in g['materials'] if 'baseColorTexture'in m['pbrMetallicRoughness']}
 for ti in used_textures:
  tex=g['textures'][ti];ii=tex['source'];im=g['images'][ii];v=g['bufferViews'][im['bufferView']];raw=buf[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
  key=hashlib.sha256(raw).hexdigest()
  if key not in images:
   if len(raw)<=16384:payload=raw;mime='image/png'
   else:
    image=Image.open(io.BytesIO(raw)).convert('RGB');image.thumbnail((256,256),Image.Resampling.LANCZOS);encoded=io.BytesIO();image.save(encoded,'WEBP',quality=82,method=6);payload=encoded.getvalue();mime='image/webp'
   idx=len(out['images']);out['images'].append({'bufferView':append(payload),'mimeType':mime});images[key]=idx
  sampler=copy.deepcopy(g.get('samplers',[{}])[tex.get('sampler',0)])
  if sampler not in out['samplers']:out['samplers'].append(sampler)
  candidate={'source':images[key],'sampler':out['samplers'].index(sampler)}
  if candidate not in out['textures']:out['textures'].append(candidate)
  texture_map[ti]=out['textures'].index(candidate)
 for mi,m in enumerate(g['materials']):
  m=copy.deepcopy(m)
  if 'baseColorTexture'in m['pbrMetallicRoughness']:m['pbrMetallicRoughness']['baseColorTexture']['index']=texture_map[m['pbrMetallicRoughness']['baseColorTexture']['index']]
  key=json.dumps(m,sort_keys=True)
  if key not in materials:materials[key]=len(out['materials']);out['materials'].append(m)
  mat_map[mi]=materials[key]
 ab=len(out['accessors']);mb=len(out['meshes']);nb=len(out['nodes'])
 for a in g['accessors']:
  a=copy.deepcopy(a);vi=a['bufferView'];v=g['bufferViews'][vi]
  if vi not in views:
   offset=v.get('byteOffset',0);view=append(buf[offset:offset+v['byteLength']],v.get('target'));views[vi]=view
   if 'byteStride'in v:out['bufferViews'][view]['byteStride']=v['byteStride']
  a['bufferView']=views[vi];out['accessors'].append(a)
 for mesh in g['meshes']:
  mesh=copy.deepcopy(mesh)
  for p in mesh['primitives']:
   p['attributes']={k:v+ab for k,v in p['attributes'].items()}
   if 'indices'in p:p['indices']+=ab
   if 'material'in p:p['material']=mat_map[p['material']]
  out['meshes'].append(mesh)
 for node in g['nodes']:
  node=copy.deepcopy(node)
  if 'mesh'in node:node['mesh']+=mb
  if 'children'in node:node['children']=[i+nb for i in node['children']]
  out['nodes'].append(node)
 root=len(out['nodes']);out['nodes'].append({'name':name,'children':[i+nb for i in g['scenes'][g.get('scene',0)]['nodes']]});out['scenes'][0]['nodes'].append(root)
 report.append({'model':name,'sourceBytes':len(data),'triangles':sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes']for p in m['primitives'])})
out['extensionsUsed']=['EXT_texture_webp'];out['extensionsRequired']=['EXT_texture_webp']
for texture in out['textures']:
 if out['images'][texture['source']]['mimeType']=='image/webp':texture['extensions']={'EXT_texture_webp':{'source':texture.pop('source')}}
while len(binary)%4:binary.append(0)
out['buffers']=[{'byteLength':len(binary)}];meta=json.dumps(out,separators=(',',':')).encode();meta+=b' '*((-len(meta))%4)
blob=struct.pack('<III',0x46546c67,2,28+len(meta)+len(binary))+struct.pack('<II',len(meta),0x4e4f534a)+meta+struct.pack('<II',len(binary),0x004e4942)+binary
destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(blob)
print(json.dumps({'output':str(destination),'bytes':len(blob),'sharedColourMaps':len(out['images']),'models':report}))
