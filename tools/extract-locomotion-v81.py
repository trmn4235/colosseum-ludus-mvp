import json,numpy as np
from scipy.spatial.transform import Rotation as R,Slerp
from pathlib import Path
import argparse
parser=argparse.ArgumentParser();parser.add_argument('source',help='Directory containing AnimationLibrary_Godot_Standard.gltf and .bin');args=parser.parse_args()
src=Path(args.source); j=json.loads((src/'AnimationLibrary_Godot_Standard.gltf').read_text()); data=(src/'AnimationLibrary_Godot_Standard.bin').read_bytes()
def acc(i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];return np.frombuffer(data,dtype='<f4',count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,n)
nodes=j['nodes']; parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])};ids={n.get('name'):i for i,n in enumerate(nodes)}
mapping={}
for side,s in [('Left','L'),('Right','R')]:
 for a,b,end in [('UpLeg','thigh','shin'),('Leg','shin','foot'),('Foot','foot','toe'),('Arm','upper_arm','forearm'),('ForeArm','forearm','hand')]:mapping[side+a]=(ids['DEF-'+b+'.'+s],ids['DEF-'+end+'.'+s])
clips={}
for target,name in [('walk','Walk_Loop'),('jog','Jog_Fwd_Loop'),('run','Sprint_Loop')]:
 anim=next(a for a in j['animations'] if a['name']==name); tracks={}
 for ch in anim['channels']:
  s=anim['samplers'][ch['sampler']];tracks[ch['target']['node'],ch['target']['path']]=(acc(s['input'])[:,0],acc(s['output']))
 duration=max(t[-1] for t,v in tracks.values());dirs={k:[] for k in mapping}
 for t in np.linspace(0,duration,49):
  mats={}
  def world(i):
   if i in mats:return mats[i]
   n=nodes[i];p=np.array(n.get('translation',[0,0,0]));q=np.array(n.get('rotation',[0,0,0,1]));scale=n.get('scale',[1,1,1])
   for kind in ['translation','rotation']:
    tr=tracks.get((i,kind))
    if tr:
     tt,v=tr
     if kind=='rotation':q=Slerp(tt,R.from_quat(v))([min(float(t),float(tt[-1]))]).as_quat()[0]
     else:p=np.array([np.interp(t,tt,v[:,k]) for k in range(3)])
   m=np.eye(4);m[:3,:3]=R.from_quat(q).as_matrix()@np.diag(scale);m[:3,3]=p
   if i in parents:m=world(parents[i])@m
   mats[i]=m;return m
  for key,(a,b) in mapping.items():
   d=world(b)[:3,3]-world(a)[:3,3];d/=np.linalg.norm(d);dirs[key].append(np.round(d,5).tolist())
 clips[target]={'duration':round(float(duration),4),'frames':49,'directions':dirs}
Path('arena-locomotion-data-v81.js').write_text('/* Quaternius Universal Animation Library Standard; CC0-1.0. Extracted authored joint directions, no mesh or root translation. */\nvar ARENA_LOCOMOTION='+json.dumps({'source':'https://quaternius.com/packs/universalanimationlibrary.html','license':'CC0-1.0','clips':clips},separators=(',',':'))+';\n')
