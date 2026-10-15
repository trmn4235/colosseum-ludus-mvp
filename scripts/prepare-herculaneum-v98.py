#!/usr/bin/env python3
"""Prepare the user's CC BY Herculaneum GLB for the naval arena.

Requires numpy and Pillow. Keeps the source file unchanged. Run the companion
meshoptimizer script on this intermediate GLB to produce the runtime asset.
"""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import struct
import numpy as np
from PIL import Image

DTYPES = {5120: 'i1', 5121: 'u1', 5122: '<i2', 5123: '<u2', 5125: '<u4', 5126: '<f4'}
SIZES = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Source:
    def __init__(self, path):
        self.raw = Path(path).read_bytes()
        assert self.raw[:4] == b'glTF'
        size, = struct.unpack_from('<I', self.raw, 12)
        self.doc = json.loads(self.raw[20:20 + size])
        self.bin = self.raw[28 + size:]
        self.world = {}
        def visit(idx, parent):
            n = self.doc['nodes'][idx]
            if 'matrix' in n:
                local = np.array(n['matrix']).reshape(4, 4).T
            else:
                x, y, z, w = n.get('rotation', [0, 0, 0, 1])
                local = np.eye(4)
                local[:3, :3] = np.array([
                    [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                    [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                    [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]
                ]) @ np.diag(n.get('scale', [1, 1, 1]))
                local[:3, 3] = n.get('translation', [0, 0, 0])
            self.world[idx] = parent @ local
            for child in n.get('children', []):
                visit(child, self.world[idx])
        for node in self.doc['scenes'][self.doc.get('scene', 0)]['nodes']:
            visit(node, np.eye(4))

    def accessor(self, idx):
        a = self.doc['accessors'][idx]
        assert 'sparse' not in a, 'Sparse accessor requires an explicit decoder'
        v = self.doc['bufferViews'][a['bufferView']]
        dtype = np.dtype(DTYPES[a['componentType']]); cols = SIZES[a['type']]
        ar = np.ndarray((a['count'], cols), dtype=dtype, buffer=self.bin,
                        offset=v.get('byteOffset', 0) + a.get('byteOffset', 0),
                        strides=(v.get('byteStride', dtype.itemsize * cols), dtype.itemsize)).copy()
        if a.get('normalized'):
            ar = ar.astype(float) / np.iinfo(dtype).max
            ar = np.maximum(ar, -1)
        return ar

    def parts(self):
        for idx, node in enumerate(self.doc['nodes']):
            if 'mesh' not in node:
                continue
            mesh = self.doc['meshes'][node['mesh']]
            for p in mesh['primitives']:
                attrs = {k: self.accessor(v) for k, v in p['attributes'].items()}
                xyz = attrs['POSITION'].astype(float)
                nor = attrs['NORMAL'].astype(float)
                if 'skin' in node:
                    skin = self.doc['skins'][node['skin']]
                    inverse = self.accessor(skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
                    matrices = np.array([self.world[j] @ inverse[k] for k, j in enumerate(skin['joints'])])
                    weights = attrs['WEIGHTS_0']
                    blended = np.einsum('nk,nkij->nij', weights, matrices[attrs['JOINTS_0']])
                    xyz = np.einsum('nij,nj->ni', blended[:, :3, :3], xyz) + blended[:, :3, 3]
                    nor = np.einsum('nij,nj->ni', np.linalg.inv(blended[:, :3, :3]).transpose(0, 2, 1), nor)
                else:
                    matrix = self.world[idx]
                    xyz = xyz @ matrix[:3, :3].T + matrix[:3, 3]
                    nor = nor @ np.linalg.inv(matrix[:3, :3])
                nor /= np.maximum(np.linalg.norm(nor, axis=1, keepdims=True), 1e-12)
                attrs = {k: v for k, v in attrs.items() if k in ['TEXCOORD_0', 'COLOR_0']}
                attrs.update(POSITION=xyz, NORMAL=nor)
                attrs.setdefault('COLOR_0', np.ones((len(xyz), 3)))
                attrs['COLOR_0'] = attrs['COLOR_0'][:, :3]
                yield {'name': mesh.get('name', ''), 'id': node['mesh'], 'mat': p['material'],
                       'attrs': attrs, 'indices': self.accessor(p['indices']).reshape(-1)}


class Output:
    def __init__(self, source):
        self.data = bytearray()
        self.doc = {'asset': {'version': '2.0', 'generator': 'Colosseum Herculaneum adaptation V98',
                             'extras': dict(source.doc['asset']['extras'],
                                            modifications='Widened battle deck, simplified hull, furled sail, reduced oars and rigging; static geometry and resized JPEG/PNG textures.',
                                            sourceSHA256=hashlib.sha256(source.raw).hexdigest())},
                    'buffers': [], 'bufferViews': [], 'accessors': [], 'images': [], 'textures': [],
                    'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}],
                    'materials': [], 'meshes': [], 'nodes': [], 'scenes': [{'nodes': []}], 'scene': 0}

    def view(self, data):
        self.data.extend(b'\0' * (-len(self.data) % 4))
        idx = len(self.doc['bufferViews'])
        self.doc['bufferViews'].append({'buffer': 0, 'byteOffset': len(self.data), 'byteLength': len(data)})
        self.data.extend(data)
        return idx

    def attr(self, array, type_, integer=False):
        array = np.array(array, dtype='<u4' if integer else '<f4')
        a = {'bufferView': self.view(array.tobytes()), 'componentType': 5125 if integer else 5126,
             'count': len(array), 'type': type_}
        if type_ == 'VEC3':
            a.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
        idx = len(self.doc['accessors']); self.doc['accessors'].append(a); return idx

    def mesh(self, name, attrs, indices, material, role='hull'):
        attributes = {k: self.attr(v, 'VEC' + str(v.shape[1])) for k, v in attrs.items()}
        idx = len(self.doc['meshes'])
        self.doc['meshes'].append({'name': name, 'primitives': [{'attributes': attributes,
            'indices': self.attr(indices, 'SCALAR', True), 'material': material}]})
        node = len(self.doc['nodes'])
        self.doc['nodes'].append({'name': name, 'mesh': idx, 'extras': {'navalRole': role}})
        self.doc['scenes'][0]['nodes'].append(node)

    def save(self, path):
        self.data.extend(b'\0' * (-len(self.data) % 4))
        self.doc['buffers'] = [{'byteLength': len(self.data)}]
        j = json.dumps(self.doc, separators=(',', ':')).encode(); j += b' ' * (-len(j) % 4)
        result = struct.pack('<III', 0x46546c67, 2, 28+len(j)+len(self.data))
        result += struct.pack('<II', len(j), 0x4e4f534a) + j
        result += struct.pack('<II', len(self.data), 0x004e4942) + self.data
        Path(path).parent.mkdir(parents=True, exist_ok=True); Path(path).write_bytes(result)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source'); parser.add_argument('output'); parser.add_argument('--inspect', action='store_true')
    args = parser.parse_args(); source = Source(args.source)
    if args.inspect:
        for p in source.parts():
            print(p['id'], p['name'], len(p['indices'])//3,
                  np.round(p['attrs']['POSITION'].min(axis=0), 3), np.round(p['attrs']['POSITION'].max(axis=0), 3))
        return
    out = Output(source)
    # Reuse wood grain and vertex shading. Remove the separate ORM maps; wood
    # has a constant roughness here. Normal maps stay small and lossless.
    image_map = {}
    for original, size, normal in [(0, 1024, False), (2, 512, True), (3, 256, False),
                                    (5, 512, False), (8, 1024, False), (10, 512, True),
                                    (11, 512, False), (12, 512, False)]:
        im = source.doc['images'][original]
        bv = source.doc['bufferViews'][im['bufferView']]
        raw = source.bin[bv.get('byteOffset', 0):bv.get('byteOffset', 0)+bv['byteLength']]
        image = Image.open(io.BytesIO(raw)).convert('RGB')
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        stream = io.BytesIO()
        image.save(stream, format='PNG' if normal else 'JPEG', **({'optimize': True} if normal else {'quality': 84, 'optimize': True}))
        image_map[original] = len(out.doc['textures'])
        out.doc['images'].append({'bufferView': out.view(stream.getvalue()), 'mimeType': 'image/png' if normal else 'image/jpeg'})
        out.doc['textures'].append({'sampler': 0, 'source': len(out.doc['images'])-1})
    for i, m in enumerate(source.doc['materials']):
        base = m['pbrMetallicRoughness']['baseColorTexture']['index']
        base = source.doc['textures'][base]['source']
        mat = {'name': m['name'], 'pbrMetallicRoughness': {'baseColorTexture': {'index': image_map[base]},
                'metallicFactor': 0, 'roughnessFactor': .88}}
        if i in [0, 3, 4, 5]:
            original = source.doc['textures'][m['normalTexture']['index']]['source']
            mat['normalTexture'] = {'index': image_map[original], 'scale': .65}
        if i == 2:
            mat['doubleSided'] = True
        out.doc['materials'].append(mat)

    def long_axis(z):
        a = np.abs(z)
        return -np.sign(z) * np.where(a <= 1.6, a*3.5, 5.6+(a-1.6)*.98)

    def shape(points, part):
        p = points.copy()
        if part in [0, 2, 16]:
            # Mast is forward of the traversable rectangle. The original sail
            # UVs are retained on a tightly furled roll, rather than a screen
            # of canvas across the combat camera.
            if part == 16:
                p[:, 0] *= -1.35; p[:, 1] = p[:, 1]*.68-.75; p[:, 2] = -p[:, 2]+5.6
            elif part == 0:
                p[:, 0] *= -.82; p[:, 1] = (p[:, 1]-5.46)*1.3+3.45; p[:, 2] = -p[:, 2]+5.55
            else:
                t = (p[:, 1]-1.09546)/(5.4176-1.09546)
                angle = (1-t)*math.pi*3.5
                p[:, 0] *= -.82
                p[:, 1] = 3.42 + (.11+.045*(1-t))*np.cos(angle)
                p[:, 2] = 5.91 + (.11+.045*(1-t))*np.sin(angle) - (p[:, 2]+.323442)*.5
            return p
        if part in [8, 10, 11, 13]:
            side = np.sign(p[:, 0].mean())
            p[:, 0] = -(p[:, 0] + side*1.85)
            p[:, 1] = p[:, 1]-1.10-(np.abs(points[:, 0])-1.1)*.13
            p[:, 2] = -p[:, 2]*3.2
            return p
        if part == 14:
            p[:, 0] = -p[:, 0]*1.5
            p[:, 1] = p[:, 1]*1.3-1.1
            p[:, 2] = -(p[:, 2]-3.15)*1.2-6.5
            return p
        p[:, 0] *= -3.0
        p[:, 1] = p[:, 1]*1.3-1.23
        p[:, 2] = long_axis(p[:, 2])
        # Two shallow boarding notches, flush with the bridge and deck surface.
        blend = np.clip((1.25-np.abs(p[:, 2]))/.3, 0, 1)
        p[:, 1] -= np.maximum(0, p[:, 1]+.035)*blend
        return p

    def transformed(part):
        attrs = part['attrs']; xyz = attrs['POSITION']; eps = .0001
        pos = shape(xyz, part['id'])
        # Transform authored normals with the inverse transpose Jacobian.
        jac = np.stack([(shape(xyz+np.eye(3)[k]*eps, part['id'])-shape(xyz-np.eye(3)[k]*eps, part['id']))/(2*eps) for k in range(3)], axis=2)
        # Notch caps are intentionally flattened, so use a pseudoinverse.
        normals = np.einsum('nij,nj->ni', np.linalg.pinv(jac).transpose(0, 2, 1), attrs['NORMAL'])
        lengths = np.linalg.norm(normals, axis=1, keepdims=True)
        normals = np.where(lengths > 1e-8, normals/np.maximum(lengths, 1e-8), [0, 1, 0])
        return dict(attrs, POSITION=pos, NORMAL=normals)

    keep = {0, 2, 8, 10, 11, 13, 14, 16, 23, 24, 25, 26, 27, 37}
    parts = list(source.parts()); interior = None; kept = 0
    for part in parts:
        if part['id'] not in keep:
            continue
        attrs = transformed(part); role = 'hull'
        if part['id'] in [8, 10, 11, 13]:
            role = 'oars-port' if attrs['POSITION'][:, 0].mean() < 0 else 'oars-starboard'
        elif part['id'] in [0, 2, 16]:
            role = 'sail' if part['id'] == 2 else 'mast'
        elif part['id'] == 14:
            role = 'rudder'
        if part['id'] == 25:
            interior = (attrs['POSITION'], part['indices'].reshape(-1, 3))
        out.mesh(part['name'], attrs, part['indices'], part['mat'], role)
        kept += len(part['indices'])//3

    # The deck follows the actual inner hull at y=0, not a rectangular slab
    # extending through the curved sides. Its playable centre covers the
    # simulation's 11 x 5.2 m rectangle including the boarding hinges.
    points, faces = interior; segments = []
    for face in faces:
        tri = points[face]; hits = []
        for i in range(3):
            a, b = tri[i], tri[(i+1)%3]
            if (a[1] <= -.045 < b[1]) or (b[1] <= -.045 < a[1]):
                hit = a+(b-a)*((-.045-a[1])/(b[1]-a[1])); hits.append(hit[[0, 2]])
        if len(hits) == 2:
            segments.append(hits)
    stations = []
    for z in np.linspace(-7.6, 7.6, 77):
        xs = []
        for a, b in segments:
            if min(a[1], b[1]) <= z < max(a[1], b[1]):
                xs.append(a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]))
        if xs:
            stations.append([float(z), max(0, min(max(xs), -min(xs))-.012)])
    assert len(stations) > 30
    outline = [[-w, z] for z, w in stations] + [[w, z] for z, w in reversed(stations)]
    def clip(poly, bound, keep_greater):
        result = []
        for i, b in enumerate(poly):
            a = poly[i-1]; ina = (a[0] >= bound) if keep_greater else (a[0] <= bound)
            inb = (b[0] >= bound) if keep_greater else (b[0] <= bound)
            if ina != inb:
                t = (bound-a[0])/(b[0]-a[0]); result.append([bound, a[1]+(b[1]-a[1])*t])
            if inb:
                result.append(b)
        return result
    xyz = []; uv = []; color = []; indices = []
    for i, x in enumerate(np.arange(-3.2, 3.2, .285)):
        poly = clip(clip(outline, float(x+.003), True), float(x+.282), False)
        if len(poly) < 3:
            continue
        start = len(xyz)
        # Polygon follows clockwise XZ winding, whose face normal is +Y.
        for a, z in poly:
            xyz.append([a, 0, z]); uv.append([a*.7, z*.21]); shade = .81 + (i*17 % 11)*.012
            color.append([shade, shade, shade])
        for k in range(1, len(poly)-1):
            indices.extend([start, start+k, start+k+1])
    out.mesh('Battle deck planks', {'POSITION': np.array(xyz), 'NORMAL': np.tile([0, 1, 0], (len(xyz), 1)),
                                  'TEXCOORD_0': np.array(uv), 'COLOR_0': np.array(color)}, np.array(indices), 3, 'deck')
    # A dark continuous backing makes the plank joints solid (no visible water
    # or light leaks through the walkable surface).
    xyz = [[x, -.018, z] for x, z in outline]
    indices = [v for k in range(1, len(outline)-1) for v in [0, k, k+1]]
    out.mesh('Deck backing', {'POSITION': np.array(xyz), 'NORMAL': np.tile([0, 1, 0], (len(xyz), 1)),
                             'TEXCOORD_0': np.array(outline)*.25, 'COLOR_0': np.full((len(xyz), 3), .15)}, np.array(indices), 0, 'deck')

    # Three low-sided stays replace the dense original rig. No skeletal rig,
    # shape-key arrays or animation tracks remain in the runtime file.
    xyz = []; uv = []; indices = []; normals = []
    for a, b in [([0, 3.6, 5.8], [0, .43, 7.85]), ([0, 3.6, 5.8], [-2.6, .12, 4.6]), ([0, 3.6, 5.8], [2.6, .12, 4.6])]:
        a, b = np.array(a), np.array(b); direction = b-a; direction /= np.linalg.norm(direction)
        u = np.cross(direction, [0, 1, 0]); u /= np.linalg.norm(u); v = np.cross(direction, u); start = len(xyz)
        for point in [a, b]:
            for k in range(6):
                norm = math.cos(k*math.tau/6)*u + math.sin(k*math.tau/6)*v
                xyz.append(point+norm*.018); normals.append(norm); uv.append([k/6, np.linalg.norm(point-a)])
        for k in range(6):
            n = (k+1)%6; indices.extend([start+k, start+n, start+6+k, start+n, start+6+n, start+6+k])
    out.mesh('Simplified stays', {'POSITION': np.array(xyz), 'NORMAL': np.array(normals), 'TEXCOORD_0': np.array(uv),
                                  'COLOR_0': np.ones((len(xyz), 3))}, np.array(indices), 1, 'rigging')
    out.doc['asset']['extras']['deckOutline'] = stations
    out.doc['asset']['extras']['playableDeck'] = {'halfWidth': 2.6, 'halfLength': 5.5, 'height': 0}
    out.save(args.output)
    print(json.dumps({'sourceBytes': len(source.raw), 'sourceTriangles': sum(len(p['indices'])//3 for p in parts),
                      'retainedTrianglesBeforeSimplification': kept, 'intermediateBytes': Path(args.output).stat().st_size,
                      'deckWidthAtZ': [[round(z, 2), round(w*2, 3)] for z, w in stations if abs(z)<.01 or 5.2<abs(z)<5.6]}, indent=2))


if __name__ == '__main__':
    main()
