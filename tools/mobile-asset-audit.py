#!/usr/bin/env python3
"""Report GLB geometry, embedded image bytes and estimated RGBA+mipmap cost.

Usage: python tools/mobile-asset-audit.py > docs/mobile-performance/assets.json
Requires Pillow for image dimensions. No assets are modified.
"""
import base64
import hashlib
import io
import json
from pathlib import Path
import struct
import sys
from PIL import Image

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
COMPONENT_BYTES = {5120:1, 5121:1, 5122:2, 5123:2, 5125:4, 5126:4}
TYPE_SIZE = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4, 'MAT2':4, 'MAT3':9, 'MAT4':16}

def audit(file):
    data = file.read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    assert magic == 0x46546C67 and version == 2 and length == len(data), file
    offset, doc, binary = 12, None, b''
    while offset < length:
        size, kind = struct.unpack_from('<II', data, offset)
        chunk = data[offset+8:offset+8+size]
        if kind == 0x4E4F534A:
            doc = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        offset += 8+size
    accessors = doc.get('accessors', [])
    vertices, triangles, primitives, morph_targets = 0, 0, 0, 0
    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            primitives += 1
            count = accessors[primitive['attributes']['POSITION']]['count']
            vertices += count
            indices = accessors[primitive['indices']]['count'] if 'indices' in primitive else count
            mode = primitive.get('mode', 4)
            triangles += indices//3 if mode == 4 else max(0, indices-2) if mode in (5,6) else 0
            morph_targets += len(primitive.get('targets', []))
    image_rows = []
    for image in doc.get('images', []):
        if 'bufferView' in image:
            view = doc['bufferViews'][image['bufferView']]
            begin = view.get('byteOffset', 0)
            content = binary[begin:begin+view['byteLength']]
        elif image.get('uri', '').startswith('data:'):
            content = base64.b64decode(image['uri'].split(',')[1])
        else:
            image_rows.append({'external':image.get('uri')})
            continue
        picture = Image.open(io.BytesIO(content))
        w,h = picture.size
        image_rows.append({'name':image.get('name',''), 'width':w, 'height':h, 'encodedBytes':len(content), 'rgbaWithMipmapsEstimateBytes':round(w*h*4*4/3), 'sha256':hashlib.sha256(content).hexdigest()})
    return {'file':str(file.relative_to(ROOT)), 'bytes':len(data), 'uniquePrimitiveVertices':vertices, 'uniquePrimitiveTriangles':triangles, 'primitives':primitives, 'meshNodes':sum('mesh' in n for n in doc.get('nodes', [])), 'morphTargetCountAcrossPrimitives':morph_targets, 'accessorUncompressedBytes':sum(a['count']*COMPONENT_BYTES[a['componentType']]*TYPE_SIZE[a['type']] for a in accessors), 'embeddedImageBytes':sum(i.get('encodedBytes',0) for i in image_rows), 'rgbaWithMipmapsEstimateBytes':sum(i.get('rgbaWithMipmapsEstimateBytes',0) for i in image_rows), 'images':image_rows, 'extensionsRequired':doc.get('extensionsRequired', []), 'extensionsUsed':doc.get('extensionsUsed', [])}

assets = [audit(f) for f in sorted(ROOT.glob('*.glb'))] + [audit(f) for f in sorted((ROOT/'assets/equipment').glob('*.glb'))]
duplicates = {}
for asset in assets:
    for image in asset['images']:
        if 'sha256' in image:
            duplicates.setdefault(image['sha256'], []).append(asset['file']+':'+image['name'])
print(json.dumps({'notes':['RGBA+mipmaps are an upper-bound-style estimate, not measured GPU memory.', 'Primitive counts are unique source geometry; scene clones/instancing and visibility change rendered cost.', 'Accessor totals include animation and morph data, not only base geometry.'], 'assets':assets, 'duplicateEmbeddedImages':{k:v for k,v in duplicates.items() if len(v)>1}}, indent=2))
