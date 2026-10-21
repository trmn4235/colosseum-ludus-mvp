"""Convert user-supplied panko10 CC-BY model; run Blender with --disable-autoexec.
Usage: blender -b --disable-autoexec --python scripts/prepare-chariot-v146.py -- INPUT OUTPUT
"""
import bpy,sys,math,json
from mathutils import Vector, Matrix
args=sys.argv[sys.argv.index('--')+1:];bpy.ops.wm.open_mainfile(filepath=args[0])
# Retain the authored forms, apply symmetry and a single subdivision level.
materials={}
for name,col,metal,rough in [('Wood',(0.23,.10,.035,1),0,.72),('TeamLeather',(.24,.025,.05,1),0,.8),('Bronze',(.47,.28,.09,1),.72,.42),('Iron',(.075,.07,.06,1),.85,.57)]:
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=col;p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;materials[name]=m
src=[o for o in bpy.data.objects if o.type=='MESH' and len(o.data.vertices)>1]
for o in src:
 for mod in list(o.modifiers):
  if mod.type=='NODES':o.modifiers.remove(mod)
  elif mod.type=='SUBSURF':mod.levels=1;mod.render_levels=1
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
buckets={};scale=.55;ground=-1.3394358;axlez=-.321402
for o in src:
 mesh=bpy.data.meshes.new_from_object(o.evaluated_get(deps));mesh.transform(o.matrix_world)
 kind='Bronze' if o.name.startswith('decor') or o.name=='part.5' else 'TeamLeather' if o.name=='part.2' else 'Iron' if o.name=='wheel.2' else 'Wood'
 wheel=o.name.startswith('wheel.')
 for side in ([-1,1] if wheel else [0]):
  polys=[p for p in mesh.polygons if not wheel or sum(mesh.vertices[v].co.x for v in p.vertices)*side>0]
  used=sorted({v for p in polys for v in p.vertices});lookup={v:i for i,v in enumerate(used)}
  # Local wheel origin lies on the axle. +Y Blender becomes +Z after export.
  pivot=Vector((side*1.29,0,axlez)) if wheel else Vector((0,0,ground))
  vertices=[tuple((mesh.vertices[i].co-pivot)*scale) for i in used]
  geo=bpy.data.meshes.new(o.name+str(side));geo.from_pydata(vertices,[],[[lookup[i] for i in p.vertices] for p in polys]);geo.update()
  ob=bpy.data.objects.new(o.name+str(side),geo);bpy.context.collection.objects.link(ob);ob.data.materials.append(materials[kind]);
  for p in geo.polygons:p.use_smooth=True
  if wheel:ob.location=(side*1.29*scale,0,(axlez-ground)*scale)
  buckets.setdefault((side,kind),[]).append(ob)
for o in list(src):bpy.data.objects.remove(o,do_unlink=True)
created=[]
for (side,kind),obs in buckets.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=obs[0]
 if len(o.data.polygons)>2600:
  mod=o.modifiers.new('Mobile geometry','DECIMATE');mod.ratio=max(.18,2600/len(o.data.polygons));bpy.ops.object.modifier_apply(modifier=mod.name)
 o.name=('WheelL' if side<0 else 'WheelR' if side>0 else 'Body')+'_'+kind;created.append(o)
# Reverse forward direction to +Z in glTF; axle stays horizontal.
root=bpy.data.objects.new('Panko10_Roman_Chariot',None);bpy.context.collection.objects.link(root);root.rotation_euler.z=math.pi
for o in created:o.parent=root
bpy.ops.object.select_all(action='DESELECT');root.select_set(True)
for o in created:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=args[1],export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
print('Exported',args[1])
