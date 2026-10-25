"""Blender 4.5 LTS: deterministic conversion of the user-selected CGTrader axe.
Run with --background --factory-startup --disable-autoexec --python this.py -- SOURCE.blend OUTPUT_DIR
Source artwork is never sent to a generative model and is not copied into the repository.
"""
import bpy, hashlib, json, math, os, sys
from mathutils import Matrix, Vector

source, out = sys.argv[sys.argv.index('--') + 1:]
os.makedirs(out, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=source, load_ui=False, use_scripts=False)
names = ['Circle', 'Cylinder', 'Cylinder.001', 'Plane']
objects = [bpy.data.objects[name] for name in names]
source_triangles = 0
for obj in objects:
    obj.data.calc_loop_triangles()
    source_triangles += len(obj.data.loop_triangles)
source_images = []
for material_name, short, images in [
    ('Metal', 'metal', ['DefaultMaterial_BaseColor.jpg.004', 'DefaultMaterial_Normal.jpg.004', 'DefaultMaterial_Roughness.jpg.004', 'DefaultMaterial_Metallic.jpg.004']),
    ('wood_table_worn', 'wood', ['wood_table_worn_diff_8k.png', 'wood_table_worn_nor_gl_8k.png', 'wood_table_worn_rough_8k.png', None]),
]:
    material = bpy.data.materials[material_name]
    material.node_tree.nodes.clear()
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = .72
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    for role, image_name in zip(['color', 'normal', 'roughness', 'metallic'], images):
        if not image_name:
            continue
        image = bpy.data.images[image_name]
        source_images.append({'name':image_name, 'role':role, 'width':image.size[0], 'height':image.size[1], 'packedBytes':image.packed_file.size if image.packed_file else 0})
        # Original EXR wood maps are decoded offline; only small PNG/WebP maps reach the game.
        size = 256 if role == 'color' else 128 if role == 'normal' else 64
        image.scale(size, size)
        image.filepath_raw = os.path.join(out, short + '-' + role + '.png')
        image.file_format = 'PNG'
        image.save()
        small = bpy.data.images.load(image.filepath_raw, check_existing=False)
        small.colorspace_settings.name = 'sRGB' if role == 'color' else 'Non-Color'
        tex = nodes.new('ShaderNodeTexImage'); tex.image = small
        if role == 'normal':
            normal = nodes.new('ShaderNodeNormalMap')
            normal.inputs['Strength'].default_value = .45
            links.new(tex.outputs['Color'], normal.inputs['Color'])
            links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
        else:
            links.new(tex.outputs['Color'], bsdf.inputs[{'color':'Base Color', 'roughness':'Roughness', 'metallic':'Metallic'}[role]])
    material.name = 'Original ' + short

# Retain the source's active UV layer and bake its 90 degree handle texture mapping.
for obj in objects:
    active = next((uv for uv in obj.data.uv_layers if uv.active_render), obj.data.uv_layers.active)
    for uv in list(obj.data.uv_layers):
        if uv != active:
            obj.data.uv_layers.remove(uv)
    if obj.name == 'Cylinder.001':
        for loop in active.data:
            u,v = loop.uv
            loop.uv = (-v,u)

# Right-hand socket at the shaft, 14 cm above the butt; 90 cm total length.
points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
bottom, top = min(p.z for p in points), max(p.z for p in points)
scale = .90 / (top-bottom)
shaft_y = bpy.data.objects['Cylinder.001'].location.y
for obj in objects:
    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    for vertex in obj.data.vertices:
        x,y,z = vertex.co
        vertex.co = (-(y-shaft_y)*scale, x*scale, (z-bottom)*scale-.14)
    obj.data.update()

bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
# Keep a local comparison reference, never shipped with the game.
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'axe-reference.glb'), export_format='GLB', use_selection=True, export_animations=False, export_cameras=False, export_lights=False, export_extras=False, export_yup=True)
for obj in objects:
    if obj.name == 'Cylinder.001':
        continue
    bpy.context.view_layer.objects.active = obj
    reduce = obj.modifiers.new('Mobile silhouette reduction', 'DECIMATE')
    reduce.ratio = {'Circle':.35, 'Cylinder':.25, 'Plane':.45}[obj.name]
    reduce.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=reduce.name)
bpy.ops.export_scene.gltf(filepath=os.path.join(out,'axe-source.glb'), export_format='GLB', use_selection=True, export_animations=False, export_cameras=False, export_lights=False, export_extras=False, export_yup=True)
with open(os.path.join(out,'source-report.json'),'w') as f:
    json.dump({'sourceBytes':os.path.getsize(source), 'sourceSha256':hashlib.sha256(open(source,'rb').read()).hexdigest(), 'sourceTriangles':source_triangles, 'height':.90, 'handOrigin':[0,0,0], 'gripFromButt':.14, 'sourceImages':source_images, 'sourceTextureBytes':sum(i['packedBytes'] for i in source_images)},f,indent=2)
