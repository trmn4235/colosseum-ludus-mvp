"""Convert the original sufair halberd offline; no Blender scripts are executed."""
import bpy,sys,os,json,math,hashlib
from mathutils import Vector,Matrix
source,out=sys.argv[sys.argv.index('--')+1:];os.makedirs(out,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=source,load_ui=False,use_scripts=False)
objects=[bpy.data.objects[n] for n in ['Cylinder','Cylinder.001']]
original=0
for o in objects:o.data.calc_loop_triangles();original+=len(o.data.loop_triangles)
# The source lies along world Y. Keep the head above the grip, with a 1.80 m total length.
points=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
ymin=min(v.y for v in points);ymax=max(v.y for v in points);scale=1.8/(ymax-ymin)
centerx=(min(v.x for v in points)+max(v.x for v in points))/2
centerz=(min(v.z for v in points)+max(v.z for v in points))/2
images=[]
for name,short in [('concrete_floor.jpg.001','metal'),('wood_texture.jpg.001','wood')]:
 im=bpy.data.images[name];images.append({'name':name,'width':im.size[0],'height':im.size[1],'packedBytes':im.packed_file.size if im.packed_file else 0});im.scale(256,256);im.filepath_raw=os.path.join(out,short+'.png');im.file_format='PNG';im.save()
# Flatten the author's image/color Mix nodes to small textures offline.
for name in ['Material.003','Rough','Smooth','Smooth.002','wood']:
 m=bpy.data.materials[name]
 for n in list(m.node_tree.nodes):
  if n.type=='DISPLACEMENT':m.node_tree.nodes.remove(n)
# Export source and optimized geometry using identical material processing.
for o in list(bpy.data.objects):
 if o not in objects:bpy.data.objects.remove(o,do_unlink=True)
for o in objects:
 matrix=o.matrix_world.copy()
 for v in o.data.vertices:
  p=matrix@v.co;v.co=((p.x-centerx)*scale,(p.y-ymin)*scale-.6,(p.z-centerz)*scale)
 o.matrix_world=Matrix.Identity(4)
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 m=o.modifiers.new('Planar surface cleanup','DECIMATE');m.decimate_type='DISSOLVE';m.angle_limit=.012;m.delimit={'MATERIAL','UV'}
 bpy.ops.object.modifier_apply(modifier=m.name)
 o.data.calc_loop_triangles();n=len(o.data.loop_triangles);print('PLANAR',o.name,n)
 target=1800 if o.name=='Cylinder' else 1100
 if n>target:
  m=o.modifiers.new('Mobile silhouette reduction','DECIMATE');m.ratio=target/n;m.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=m.name)
 for p in o.data.polygons:p.use_smooth=True
 o.data.calc_loop_triangles();print('REDUCED',o.name,len(o.data.loop_triangles))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,'halberd-low.blend'))
report={'sourceBytes':os.path.getsize(source),'sourceSha256':hashlib.sha256(open(source,'rb').read()).hexdigest(),'sourceTriangles':original,'height':1.8,'gripFromButt':.6,'sourceImages':images}
json.dump(report,open(os.path.join(out,'source-report.json'),'w'),indent=2)

import bpy,os,json
from mathutils import Vector

bpy.ops.wm.open_mainfile(filepath=out+'/halberd-low.blend',load_ui=False,use_scripts=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True
for mname in ['Smooth','Smooth.002','wood']:
 m=bpy.data.materials[mname]
 bpy.ops.object.select_all(action='DESELECT');bpy.ops.mesh.primitive_plane_add();p=bpy.context.object;p.data.materials.append(m)
 im=bpy.data.images.new('Baked '+mname,width=256,height=256,alpha=True);n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=im;m.node_tree.nodes.active=n
 bpy.ops.object.bake(type='DIFFUSE',margin=2)
 im.filepath_raw=out+'/baked-'+mname+'.png';im.file_format='PNG';im.save();im.pack()
 bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 for node in list(m.node_tree.nodes):
  if node not in [bs,n] and node.type!='OUTPUT_MATERIAL':m.node_tree.nodes.remove(node)
 m.node_tree.links.new(n.outputs['Color'],bs.inputs['Base Color'])
 bpy.data.objects.remove(p,do_unlink=True)
for o in bpy.data.objects:
 if o.type=='MESH':
  # Main hand is 10 cm above the shaft butt, matching the existing 1.70 m pole reach.
  for v in o.data.vertices:v.co.y+=.5
  # Blender exporter converts Z-up to Y-up; rotate our already Y-up coordinates first.
  for v in o.data.vertices:v.co=(v.co.x,-v.co.z,v.co.y)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out+'/halberd-source.glb',export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
r=json.load(open(out+'/source-report.json'));r['gripFromButt']=.1;json.dump(r,open(out+'/source-report.json','w'),indent=2)
bpy.ops.wm.save_as_mainfile(filepath=out+'/halberd-export.blend')
