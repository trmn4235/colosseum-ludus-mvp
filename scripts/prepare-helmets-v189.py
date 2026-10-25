"""Offline source-material bake; run with Blender --background --disable-autoexec.
Usage: blender -b --disable-autoexec --python scripts/prepare-helmets-v189.py -- SOURCE OUT
Original licensed source files stay outside the repository. No generative tools.
"""
import bpy, sys, json, math
from pathlib import Path
from mathutils import Vector
source, out = map(Path, sys.argv[sys.argv.index('--')+1:])
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source/'viking.blend'),load_ui=False,use_scripts=False)
# The source links these CC0 Poly Haven files but does not pack them.
for image in bpy.data.images:
    if image.name.startswith('cracked_concrete_wall_diff'):
        image.filepath=str(source/'diffuse.jpg');image.reload()
    elif image.name.startswith('cracked_concrete_wall_disp'):
        image.filepath=str(source/'displacement.jpg');image.reload()
hi=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in list(bpy.context.scene.objects):
    if o not in hi:bpy.data.objects.remove(o,do_unlink=True)
low=[];report=[]
targets={'Cylinder':2000,'Cube':300,'Cube.001':450,'Cube.002':200,'Cube.003':260,'Cube.004':260,'Cube.005':260,'Cube.006':150,'Cube.026':200}
for o in hi:
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    for m in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=m.name)
    o.data.calc_loop_triangles();original=len(o.data.loop_triangles)
    copy=o.copy();copy.data=o.data.copy();copy.name='low_'+o.name;bpy.context.collection.objects.link(copy)
    bpy.ops.object.select_all(action='DESELECT');copy.select_set(True);bpy.context.view_layer.objects.active=copy
    mod=copy.modifiers.new('Offline polygon reduction','DECIMATE');mod.ratio=min(1,targets[o.name]/original)
    mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
    copy.data.calc_loop_triangles();report.append({'part':o.name,'sourceTriangles':original,'triangles':len(copy.data.loop_triangles)})
    low.append(copy)
bpy.ops.object.select_all(action='DESELECT')
for o in low:o.select_set(True)
bpy.context.view_layer.objects.active=low[0];bpy.ops.object.join();lo=bpy.context.object;lo.name='Viking helmet'
# A single atlas and material keep this helmet to one colour draw call.
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')
for i,slot in enumerate(lo.material_slots):slot.material=slot.material.copy()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.cycles.device='CPU';scene.render.threads_mode='FIXED';scene.render.threads=4
scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.025;scene.render.bake.max_ray_distance=.1;scene.render.bake.margin=8
scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
baked={}
for kind,bake_type in [('base','EMIT'),('normal','NORMAL'),('rough','ROUGHNESS'),('metal','EMIT')]:
    image=bpy.data.images.new('helmet_'+kind,1024,1024,alpha=False)
    image.colorspace_settings.name='sRGB' if kind=='base' else 'Non-Color'
    for slot in lo.material_slots:
        nodes=slot.material.node_tree.nodes;node=nodes.new('ShaderNodeTexImage');node.image=image;nodes.active=node
    changes=[]
    if kind in ('base','metal'):
        for m in set(s.material for o in hi for s in o.material_slots):
            tree=m.node_tree;bs=next(n for n in tree.nodes if n.type=='BSDF_PRINCIPLED');output=next(n for n in tree.nodes if n.type=='OUTPUT_MATERIAL')
            old=[l.from_socket for l in output.inputs['Surface'].links];em=tree.nodes.new('ShaderNodeEmission');channel=bs.inputs['Base Color' if kind=='base' else 'Metallic'];value=channel.default_value
            em.inputs['Color'].default_value=value if kind=='base' else (value,value,value,1)
            if channel.is_linked:tree.links.new(channel.links[0].from_socket,em.inputs['Color'])
            tree.links.new(em.outputs[0],output.inputs['Surface']);changes.append((tree,output,old,em))
    bpy.ops.object.select_all(action='DESELECT')
    for o in hi:o.select_set(True)
    lo.select_set(True);bpy.context.view_layer.objects.active=lo
    bpy.ops.object.bake(type=bake_type)
    image.filepath_raw=str(out/('viking-'+kind+'.png'));image.file_format='PNG';image.save();baked[kind]=image
    for tree,output,old,em in changes:
        tree.nodes.remove(em)
        for socket in old:tree.links.new(socket,output.inputs['Surface'])
    print('BAKED',kind,flush=True)
for o in hi:bpy.data.objects.remove(o,do_unlink=True)
mat=bpy.data.materials.new('Baked source steel and horn');mat.use_nodes=True;tree=mat.node_tree;bs=tree.nodes.get('Principled BSDF')
for kind,socket in [('base','Base Color'),('rough','Roughness'),('metal','Metallic')]:
    n=tree.nodes.new('ShaderNodeTexImage');n.image=baked[kind];tree.links.new(n.outputs['Color'],bs.inputs[socket])
n=tree.nodes.new('ShaderNodeTexImage');n.image=baked['normal'];normal=tree.nodes.new('ShaderNodeNormalMap');tree.links.new(n.outputs['Color'],normal.inputs['Color']);tree.links.new(normal.outputs[0],bs.inputs['Normal'])
lo.data.materials.clear();lo.data.materials.append(mat)
for p in lo.data.polygons:p.material_index=0
# Fit the shell, not the horn span, to the canonical 20 cm character head.
# Blender Z up -> glTF Y up; glTF +Z is the face.
points=[v.co.copy() for v in lo.data.vertices];mn=Vector([min(v[i] for v in points) for i in range(3)]);mx=Vector([max(v[i] for v in points) for i in range(3)]);center=(mn+mx)*.5
scale=Vector((.24/2.021888,.285/(mx.y-mn.y),.33/(mx.z-mn.z)))
for v in lo.data.vertices:
    v.co=Vector([(v.co[i]-center[i])*scale[i] for i in range(3)])
lo.data.update();bpy.ops.object.select_all(action='DESELECT');lo.select_set(True);bpy.context.view_layer.objects.active=lo
bpy.ops.export_scene.gltf(filepath=str(out/'viking_helmet.glb'),export_format='GLB',use_selection=True,export_animations=False,export_extras=False,export_yup=True,export_tangents=False)
(out/'viking-source-report.json').write_text(json.dumps(report,indent=2))
print('VIKING_REPORT',json.dumps(report),flush=True)
