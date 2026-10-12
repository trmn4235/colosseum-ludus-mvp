"""Bake CMU BVH motion into compact, heading-neutral arena samples (no meshes).
Usage: python tools/bake-cmu-locomotion-v91.py /path/to/bvh-directory
Requires numpy and scipy. Source and usage terms: docs/locomotion-v91.md.
"""
import argparse, hashlib, json, re
from pathlib import Path
import numpy as np
from scipy.spatial.transform import Rotation as R, Slerp
from scipy.signal import find_peaks

def read_bvh(path):
    header, motion = path.read_text().split('MOTION')
    tokens = iter(re.findall(r'[{}]|[^\s{}]+', header)); nodes=[]; channels=[]
    assert next(tokens)=='HIERARCHY'
    def node(parent, kind):
        name=next(tokens); idx=len(nodes)
        nodes.append({'name':name if kind!='End' else nodes[parent]['name']+'End','parent':parent})
        assert next(tokens)=='{'
        for token in tokens:
            if token=='}':break
            if token=='OFFSET':nodes[idx]['offset']=np.array([float(next(tokens)) for _ in range(3)])
            elif token=='CHANNELS':
                count=int(next(tokens));nodes[idx]['channels']=[]
                for _ in range(count):
                    channel=next(tokens);nodes[idx]['channels'].append((len(channels),channel));channels.append(channel)
            elif token in ('JOINT','End'):node(idx,token)
            else:raise ValueError(token)
    node(None,next(tokens))
    lines=motion.strip().splitlines();count=int(lines[0].split(':')[1]);dt=float(lines[1].split(':')[1]);data=np.loadtxt(lines[2:]);assert data.shape==(count,len(channels))
    positions=[];rotations=[]
    for n in nodes:
        local=np.broadcast_to(n['offset'],(count,3)).copy();angles=[];order=''
        for c,label in n.get('channels',[]):
            if label.endswith('position'):local[:,'XYZ'.index(label[0])]+=data[:,c]
            else:order+=label[0];angles.append(data[:,c])
        rot=R.from_euler(order,np.stack(angles,axis=1),degrees=True) if order else R.from_quat(np.tile([0,0,0,1],(count,1)))
        if n['parent'] is not None:
            parent=n['parent'];local=positions[parent]+rotations[parent].apply(local);rot=rotations[parent]*rot
        positions.append(local);rotations.append(rot)
    return nodes,np.stack(positions,axis=1),rotations,dt

def bake(path):
    nodes,p,r,dt=read_bvh(path);ids={n['name']:i for i,n in enumerate(nodes)};root=p[:,0]
    velocity=np.median(np.diff(root,axis=0),axis=0);heading=np.arctan2(velocity[0],velocity[2]);neutral=R.from_euler('y',-heading)
    local=neutral.apply((p-root[:,None]).reshape(-1,3)).reshape(p.shape)
    signal=local[:,ids['LeftFoot'],2];peaks=find_peaks(signal,distance=int(.48/dt),prominence=max(.1,np.ptp(signal)*.25))[0]
    pairs=[(a,b) for a,b in zip(peaks,peaks[1:]) if .48<(b-a)*dt<1.65 and a>5 and b<len(p)-5]
    if not pairs:
        peaks=find_peaks(-signal,distance=int(.48/dt),prominence=max(.1,np.ptp(signal)*.25))[0]
        pairs=[(a,b) for a,b in zip(peaks,peaks[1:]) if .48<(b-a)*dt<1.65 and a>5 and b<len(p)-5]
    assert pairs,(path,peaks)
    # Select the most repeatable complete stride, excluding starts/stops.
    a,b=min(pairs,key=lambda ab:np.mean((local[ab[0]]-local[ab[1]])**2))
    scale=1.05/np.median(root[a:b,1]);duration=(b-a)*dt
    stride=np.linalg.norm((root[b]-root[a])[[0,2]])*scale
    leg_length=np.mean([sum(np.linalg.norm(p[a,ids[side+y]]-p[a,ids[side+x]]) for x,y in [('UpLeg','Leg'),('Leg','Foot')]) for side in ['Left','Right']])*scale
    times=np.arange(a,b+1);sample=np.linspace(a,b,49);fraction=np.linspace(0,1,49)
    def vector(values,unit=False):
        v=np.stack([np.interp(sample,times,values[:,i]) for i in range(3)],axis=1)
        v-=fraction[:,None]*(v[-1]-v[0])
        if unit:v/=np.linalg.norm(v,axis=1)[:,None]
        return np.round(v,5).tolist()
    directions={}
    for side in ['Left','Right']:
        for start,end in [('UpLeg','Leg'),('Leg','Foot'),('Foot','ToeBase'),('Arm','ForeArm'),('ForeArm','Hand')]:
            values=local[a:b+1,ids[side+end]]-local[a:b+1,ids[side+start]]
            values/=np.linalg.norm(values,axis=1)[:,None];directions[side+start]=vector(values,True)
    rotations={}
    for target,source in [('Hips','Hips'),('Spine','LowerBack'),('Spine1','Spine'),('Spine2','Spine1'),('Neck','Neck'),('Head','Head')]:
        values=neutral*Slerp(times,r[ids[source]][a:b+1])(sample)
        drift=(values[-1]*values[0].inv()).as_rotvec()
        values=R.from_rotvec(-fraction[:,None]*drift)*values
        rotations[target]=np.round(values.as_quat(),6).tolist()
    # Preserve real root-height variation, including the running flight phase.
    lift=root[a:b+1,1]*scale;lift-=np.median(lift)
    lift=np.interp(sample,times,lift);lift-=fraction*(lift[-1]-lift[0])
    shift=int(np.argmax(np.interp(sample[:-1],times,signal[a:b+1])))
    def phase(values):
        values=np.roll(np.array(values)[:-1],-shift,axis=0).tolist();return values+[values[0]]
    return {'source':path.stem,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'range':[int(a),int(b)],'duration':round(duration,5),'stride':round(stride,5),'speed':round(stride/duration,5),'legLength':round(leg_length,5),'frames':49,'directions':{k:phase(v) for k,v in directions.items()},'rotations':{k:phase(v) for k,v in rotations.items()},'lift':phase(np.round(lift,5))}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);args=parser.parse_args()
    clips={name:bake(args.directory/(source+'.bvh')) for name,source in [('walk','35_01'),('jog','35_17'),('run','09_01')]}
    result={'source':'CMU Graphics Lab Motion Capture Database; cgspeed BVH conversion','clips':clips}
    Path('arena-locomotion-data-v91.js').write_text('/* CMU human mocap. Attribution and reproduction: docs/locomotion-v91.md. */\nvar ARENA_LOCOMOTION='+json.dumps(result,separators=(',',':'))+';\n')
    print(json.dumps({k:{p:v[p] for p in ['source','range','duration','stride','speed']} for k,v in clips.items()},indent=2))
