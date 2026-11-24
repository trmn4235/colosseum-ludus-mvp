"""Run with Blender's Python: blender -b --python prepare_assets.py -- --help.

Preparation only: this tool does not download assets or change game catalogs.
It retains source UV layers/materials/rigs; it does not retopologize, rig or bake.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy


def triangles(mesh):
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def deform_names(obj):
    return {bone.name for mod in obj.modifiers
            if mod.type == 'ARMATURE' and mod.object
            for bone in mod.object.data.bones if bone.use_deform}


def weight_summary(obj):
    names = deform_names(obj)
    ids = {g.index for g in obj.vertex_groups if g.name in names}
    if not names:
        return None
    unweighted = over_four = non_unit = 0
    maximum = 0
    for vertex in obj.data.vertices:
        weights = [g.weight for g in vertex.groups if g.group in ids and g.weight > 1e-6]
        maximum = max(maximum, len(weights))
        unweighted += not weights
        over_four += len(weights) > 4
        non_unit += bool(weights) and abs(sum(weights) - 1) > 0.002
    return {'maximumInfluences': maximum, 'verticesOverFour': over_four,
            'unweightedVertices': unweighted, 'nonNormalizedVertices': non_unit}


def scene_audit():
    meshes = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        meshes.append({
            'object': obj.name, 'mesh': obj.data.name,
            'vertices': len(obj.data.vertices), 'triangles': triangles(obj.data),
            'uvLayers': [u.name for u in obj.data.uv_layers],
            'materials': [m.name if m else None for m in obj.data.materials],
            'vertexGroups': [g.name for g in obj.vertex_groups],
            'armatures': [m.object.name for m in obj.modifiers
                          if m.type == 'ARMATURE' and m.object],
            'shapeKeys': list(obj.data.shape_keys.key_blocks.keys()) if obj.data.shape_keys else [],
            'weights': weight_summary(obj), 'dimensions': list(obj.dimensions),
            'worldMatrix': [list(row) for row in obj.matrix_world],
        })
    armatures = [{'object': o.name, 'bones': [b.name for b in o.data.bones],
                  'boneCount': len(o.data.bones)}
                 for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    textures = [{'name': i.name, 'size': list(i.size), 'source': i.source,
                 'format': i.file_format, 'colorSpace': i.colorspace_settings.name,
                 'packed': bool(i.packed_file), 'path': i.filepath}
                for i in bpy.data.images if i.type not in {'RENDER_RESULT', 'COMPOSITING'}]
    materials = []
    for material in bpy.data.materials:
        if not material.users:
            continue
        materials.append({'name': material.name, 'usesNodes': material.use_nodes,
                          'images': [n.image.name for n in material.node_tree.nodes
                                     if n.type == 'TEX_IMAGE' and n.image]
                          if material.node_tree else []})
    return {'objectCount': len(bpy.context.scene.objects), 'meshCount': len(meshes),
            'triangles': sum(m['triangles'] for m in meshes),
            'vertices': sum(m['vertices'] for m in meshes), 'meshes': meshes,
            'armatures': armatures, 'armatureCount': len(armatures),
            'skinnedMeshCount': sum(bool(m['armatures']) for m in meshes),
            'materials': materials, 'textures': textures,
            'actions': [{'name': a.name, 'frameRange': list(a.frame_range)}
                        for a in bpy.data.actions]}


def glb_summary(path):
    data = path.read_bytes()
    if data[:4] != b'glTF':
        raise ValueError('Export is not a GLB')
    length, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4E4F534A:
        raise ValueError('GLB JSON chunk is missing')
    doc = json.loads(data[20:20 + length])
    accessors = doc.get('accessors', [])
    total = 0
    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            if primitive.get('mode', 4) == 4:
                accessor = primitive.get('indices', primitive['attributes']['POSITION'])
                total += accessors[accessor]['count'] // 3
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
            'uniqueMeshTriangles': total, 'meshCount': len(doc.get('meshes', [])),
            'skinCount': len(doc.get('skins', [])),
            'jointCounts': [len(s['joints']) for s in doc.get('skins', [])],
            'animationCount': len(doc.get('animations', [])),
            'materialCount': len(doc.get('materials', [])),
            'imageTypes': [i.get('mimeType') for i in doc.get('images', [])],
            'extensionsUsed': doc.get('extensionsUsed', []),
            'extensionsRequired': doc.get('extensionsRequired', [])}


def import_asset(path):
    # An empty scene prevents startup cubes, cameras and orphan materials in output.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.suffix.lower() in {'.glb', '.gltf'}:
        bpy.ops.import_scene.gltf(filepath=str(path), merge_vertices=False,
                                  disable_bone_shape=True)
    elif path.suffix.lower() == '.fbx':
        bpy.ops.import_scene.fbx(filepath=str(path), automatic_bone_orientation=False)
    elif path.suffix.lower() == '.obj':
        bpy.ops.wm.obj_import(filepath=str(path))
    else:
        raise ValueError('Supported inputs: GLB, glTF, FBX and OBJ')
    bpy.context.view_layer.update()


def validate(before, after):
    issues = []
    original = {m['object']: m for m in before['meshes']}
    for mesh in after['meshes']:
        old = original[mesh['object']]
        if mesh['uvLayers'] != old['uvLayers']:
            issues.append(mesh['object'] + ': UV layer names changed')
        if mesh['armatures'] != old['armatures']:
            issues.append(mesh['object'] + ': armature binding changed')
        if mesh['weights'] and mesh['weights']['unweightedVertices'] > old['weights']['unweightedVertices']:
            issues.append(mesh['object'] + ': new unweighted vertices')
    if before['armatures'] != after['armatures']:
        issues.append('Armature bone names/count changed')
    return issues


def prepare(args, before, warnings):
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    ratio = min(1.0, args.target_triangles / max(1, before['triangles']))
    changes = []
    for obj in meshes:
        original_count = triangles(obj.data)
        if ratio < 1 and original_count > 4:
            if obj.data.shape_keys:
                warnings.append(obj.name + ': shape keys present; decimation skipped to retain morph data')
            else:
                if obj.data.users > 1:
                    obj.data = obj.data.copy()
                    warnings.append(obj.name + ': shared mesh made unique before decimation')
                bpy.ops.object.select_all(action='DESELECT')
                obj.select_set(True)
                bpy.context.view_layer.objects.active = obj
                modifier = obj.modifiers.new('ArmorBudget', 'DECIMATE')
                modifier.decimate_type = 'COLLAPSE'
                modifier.ratio = max(4 / original_count, ratio)
                modifier.use_collapse_triangulate = True
                # Work on rest geometry, before Armature deformation.
                bpy.ops.object.modifier_move_to_index(modifier=modifier.name, index=0)
                bpy.ops.object.modifier_apply(modifier=modifier.name)
                obj.data.update()
        changes.append({'object': obj.name, 'before': original_count,
                        'after': triangles(obj.data)})
    if ratio < 1:
        warnings.append('Topology reduced. UV layers and vertex groups retained; UV distortion and shading need visual review. No UV unwrap or texture/normal-map bake was performed.')
    resized = []
    if args.texture_max:
        for image in bpy.data.images:
            width, height = image.size
            if image.type in {'RENDER_RESULT', 'COMPOSITING'} or not width or not height:
                continue
            scale = min(1.0, args.texture_max / max(width, height))
            if scale < 1:
                new = [max(1, round(width * scale)), max(1, round(height * scale))]
                image.scale(*new)
                resized.append({'image': image.name, 'before': [width, height], 'after': new})
        if resized:
            warnings.append('Images resized in memory; tangent-space normal vectors were not rebaked or renormalized. Inspect highlights and normal-map shading.')
    bpy.context.view_layer.update()
    return changes, resized


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['audit', 'optimize'])
    parser.add_argument('--input', required=True, type=Path)
    parser.add_argument('--report', required=True, type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--target-triangles', type=int)
    parser.add_argument('--texture-max', type=int, default=0,
                        help='Optional maximum texture side; 0 leaves images unchanged')
    parser.add_argument('--overwrite', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    args.input, args.report = args.input.resolve(), args.report.resolve()
    if not args.input.is_file():
        parser.error('Input file does not exist')
    if args.texture_max < 0:
        parser.error('--texture-max must be >= 0')
    if args.command == 'optimize':
        if not args.output or not args.target_triangles or args.target_triangles < 4:
            parser.error('optimize requires --output and --target-triangles >= 4')
        args.output = args.output.resolve()
        if args.output.suffix.lower() != '.glb':
            parser.error('Output must end in .glb')
    destinations = [p for p in [args.report, args.output] if p]
    if len(set(destinations + [args.input])) != len(destinations) + 1:
        parser.error('Input, output and report must be different files')
    if not args.overwrite and any(p.exists() for p in destinations):
        parser.error('Destination exists; choose a new path or pass --overwrite')
    import_asset(args.input)
    before = scene_audit()
    warnings = []
    if not before['meshes']:
        raise ValueError('No mesh objects found in input')
    for mesh in before['meshes']:
        if mesh['weights'] and mesh['weights']['verticesOverFour']:
            warnings.append(mesh['object'] + ': >4 skin influences; retained, but the current game requires a separate reviewed four-influence conversion')
        if not mesh['uvLayers']:
            warnings.append(mesh['object'] + ': no UV coordinates')
    report = {'tool': 'armor-v295/prepare_assets.py', 'blender': bpy.app.version_string,
              'input': str(args.input), 'inputSha256': hashlib.sha256(args.input.read_bytes()).hexdigest(),
              'command': args.command, 'before': before, 'warnings': warnings,
              'normalMapsBaked': False, 'rigCreatedOrRetargeted': False}
    if args.input.suffix.lower() == '.glb':
        report['inputContainer'] = glb_summary(args.input)
        if report['inputContainer']['uniqueMeshTriangles'] != before['triangles']:
            warnings.append('GLB source triangle count differs from imported scene count. Blender may discard degenerate faces; instanced or inactive scenes can also change totals. Both counts are recorded.')
    if args.command == 'optimize':
        changes, resized = prepare(args, before, warnings)
        after = scene_audit()
        issues = validate(before, after)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        bpy.ops.export_scene.gltf(filepath=str(args.output), export_format='GLB',
                                  export_draco_mesh_compression_enable=False,
                                  export_image_format='AUTO', export_apply=False,
                                  export_normals=True, export_tangents=True,
                                  export_skins=True, export_all_influences=True,
                                  export_animations=True)
        exported = glb_summary(args.output)
        unsupported = {'KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'}
        if unsupported.intersection(exported['extensionsUsed']):
            issues.append('Compressed extension incompatible with current loader configuration')
        budget_met = exported['uniqueMeshTriangles'] <= args.target_triangles
        if not budget_met:
            warnings.append('Requested triangle budget not reached; inspect skipped meshes or use an approved fallback budget')
        report.update({'output': str(args.output), 'targetTriangles': args.target_triangles,
                       'budgetMet': budget_met, 'after': after, 'meshChanges': changes,
                       'resizedImages': resized, 'export': exported,
                       'structuralIssues': issues, 'structuralChecksPassed': not issues,
                       'visualReviewRequired': True})
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('ARMOR_REPORT ' + str(args.report))
    print('ARMOR_RESULT ' + json.dumps({k: report.get(k) for k in
          ['command', 'targetTriangles', 'budgetMet', 'structuralChecksPassed', 'output']}))
    if report.get('structuralIssues') or report.get('budgetMet') is False:
        raise RuntimeError('Preparation needs review; see JSON report')


if __name__ == '__main__':
    main()
