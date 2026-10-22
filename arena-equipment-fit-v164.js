/* Worn armour uses the body's bind pose and skeleton, including shoulder blends.
 * Fit once per asset/slot; no vertex searches, smoothing or extra skeletons per frame.
 * Inventory/drop templates remain rigid and unchanged.
 */
var ArenaEquipmentFit = (() => {
  const surfaces = new WeakMap(), fitted = new WeakMap(), materials = new WeakMap(), bodies = new WeakMap();
  const slots = ['chest', 'shoulder', 'otherShoulder', 'collar'];
  const components = ['getX', 'getY', 'getZ', 'getW'];
  function wornMaterial(source) {
    if (Array.isArray(source)) return source.map(wornMaterial);
    if (source.userData.worn164) return source;
    let material = materials.get(source);
    if (!material) {
      material = source.clone(); material.userData.worn164 = true;
      // Sub-pixel separation at skin/metal contact; ordinary depth occlusion stays
      // enabled, so armour still disappears correctly behind walls/other actors.
      material.polygonOffset = true; material.polygonOffsetFactor = -1; material.polygonOffsetUnits = -1;
      materials.set(source,material);
    }
    return material;
  }
  function tree(points, depth = 0) {
    if (!points.length) return null;
    const axis = depth % 3;
    points.sort((a, b) => a.p[axis] - b.p[axis]);
    const mid = points.length >> 1;
    return { point: points[mid], axis, left: tree(points.slice(0, mid), depth + 1), right: tree(points.slice(mid + 1), depth + 1) };
  }
  function nearest(node, p, best = []) {
    if (!node) return best;
    const q = node.point.p, d = (p.x-q[0])**2 + (p.y-q[1])**2 + (p.z-q[2])**2;
    if (best.length < 4 || d < best[best.length-1].d) {
      best.push({ point: node.point, d }); best.sort((a,b) => a.d-b.d); if (best.length > 4) best.pop();
    }
    const delta = p.getComponent(node.axis)-q[node.axis];
    nearest(delta < 0 ? node.left : node.right, p, best);
    if (best.length < 4 || delta*delta < best[best.length-1].d) nearest(delta < 0 ? node.right : node.left, p, best);
    return best;
  }
  function capture(m) {
    const T = THREE;
    let body;
    m.visual.traverse(o => { if (!body && o.isSkinnedMesh && o.visible && !o.userData.replaceGear) body = o; });
    if (!body) return;
    m.root.updateMatrixWorld(true);
    const inverseRoot = m.root.matrixWorld.clone().invert();
    let surface = surfaces.get(body.geometry);
    if (!surface) {
      const points = [], p = new T.Vector3(), g = body.geometry;
      const ix = g.attributes.skinIndex, wt = g.attributes.skinWeight, unique = new Set();
      for (let i = 0; i < g.attributes.position.count; i++) {
        body.getVertexPosition(i,p).applyMatrix4(body.matrixWorld).applyMatrix4(inverseRoot);
        if (p.y < 1.02 || p.y > 1.79) continue;
        const ids = [], weights = []; let trunk = 0, arm = 0;
        for (let k = 0; k < 4; k++) {
          const id = ix[components[k]](i), w = wt[components[k]](i), name = body.skeleton.bones[id]?.name || '';
          ids.push(id); weights.push(w);
          if (/Spine|Hips|Neck/.test(name)) trunk += w;
          if (/(Left|Right)(Shoulder|Arm)/.test(name)) arm += w;
        }
        if (trunk + arm < .9) continue;
        const key = p.toArray().map(x => Math.round(x*1e5)).join(':'); if (unique.has(key)) continue; unique.add(key);
        points.push({ p:p.toArray(), ids, weights });
      }
      surface = tree(points); surfaces.set(body.geometry,surface);
    }
    if (!surface) return;
    const anchors = {};
    for (const name of slots) anchors[name] = inverseRoot.clone().multiply(m.gear[name].anchor.matrixWorld);
    const restBones = body.skeleton.bones.map((bone,i) => inverseRoot.clone().multiply(bone.matrixWorld).multiply(body.skeleton.boneInverses[i]));
    let shell=bodies.get(body.geometry);
    if(!shell){
      const geo=new T.BufferGeometry(),array=new Float32Array(body.geometry.attributes.position.count*3),p=new T.Vector3();
      for(let i=0;i<body.geometry.attributes.position.count;i++){body.getVertexPosition(i,p).applyMatrix4(body.matrixWorld).applyMatrix4(inverseRoot);p.toArray(array,i*3);}
      geo.setAttribute('position',new T.BufferAttribute(array,3));geo.setIndex(body.geometry.index.clone());
      const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld(true);
      shell={mesh,ray:new T.Raycaster(),hits:new Map()};bodies.set(body.geometry,shell);
    }
    const trunkId=body.skeleton.bones.findIndex(b=>/^(?:mixamorig:?)?Spine2(?:_\d+)?$/.test(b.name));
    const torsoIds=body.skeleton.bones.map((b,i)=>/(Left|Right)(Shoulder|Arm)/.test(b.name)&&trunkId>=0?trunkId:i);
    m.equipmentFit164 = { body, surface, anchors, restBones, shell, torsoIds, bind:new T.Matrix4() };
  }
  function chestSurface(p,data){
    const T=THREE,s=data.shell,key=p.x.toFixed(4)+':'+p.y.toFixed(4);
    let z=s.hits.get(key);if(z!==undefined)return z;
    s.ray.set(new T.Vector3(p.x,p.y,1),new T.Vector3(0,0,-1));
    const hits=s.ray.intersectObject(s.mesh,false);z=hits.length?hits[0].point.z:null;
    s.hits.set(key,z);return z;
  }
  let strapMaterial;
  function straps(data){
    const T=THREE,s=data.shell;if(s.straps)return s.straps;
    s.mesh.geometry.computeBoundingBox();
    const vertices=[],indices=[],center=s.mesh.geometry.boundingBox.getCenter(new T.Vector3()).x;
    function ribbon(rows){const start=vertices.length/3;rows.forEach(row=>row.forEach(p=>vertices.push(...p.toArray())));for(let i=0;i<rows.length-1;i++){const n=start+i*2;indices.push(n,n+2,n+1,n+1,n+2,n+3);}}
    for(const height of [1.29,1.48]){
      const rows=[];
      for(let n=0;n<=48;n++){
        const angle=.65+n/48*(Math.PI*2-1.3),dir=new T.Vector3(Math.sin(angle),0,Math.cos(angle)),row=[];
        for(const edge of [-1,1]){
          const origin=new T.Vector3(center,height+edge*.012,-.04);s.ray.set(origin.clone().add(dir),dir.clone().negate());
          const hits=s.ray.intersectObject(s.mesh,false).filter(h=>h.point.clone().sub(origin).dot(dir)>.025).sort((a,b)=>a.point.distanceToSquared(origin)-b.point.distanceToSquared(origin));
          if(hits.length)row.push(hits[0].point.clone().addScaledVector(dir,.009));
        }
        if(row.length===2)rows.push(row);
      }
      ribbon(rows);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();s.straps=g;return g;
  }
  function fitGeometry(source, transform, data, slot) {
    const T = THREE;
    let variants = fitted.get(source); if (!variants) fitted.set(source, variants = new Map());
    const key = data.body.geometry.uuid+':'+slot+':'+transform.elements.map(x => x.toFixed(6)).join(',');
    if (variants.has(key)) return variants.get(key);
    const geometry = source.clone().applyMatrix4(transform), pos = geometry.attributes.position;
    const indices = new Uint16Array(pos.count*4), weights = new Float32Array(pos.count*4), p = new T.Vector3(), n = new T.Vector3();
    const blend = new T.Matrix4(), normal = new T.Matrix3(), normals = geometry.attributes.normal;
    let flatPlate=false;
    if(slot==='chest'){
      geometry.computeBoundingBox();const box=geometry.boundingBox,center=box.getCenter(new T.Vector3()),depth=box.max.z-box.min.z;
      // The source breastplate was a flat panel 17 cm in front of the torso.
      // Fit its surface to the actual skin, including the shoulder-strap tips.
      flatPlate=depth<.20;
      if(flatPlate)for(let i=0;i<pos.count;i++){
        p.fromBufferAttribute(pos,i);const relief=.008+.009*(p.z-box.min.z)/Math.max(.001,depth);
        p.x=center.x+(p.x-center.x)*.86;
        let z=chestSurface(p,data);
        for(let n=0;z===null&&n<8;n++){p.x=center.x+(p.x-center.x)*.9;z=chestSurface(p,data);}
        if(z!==null)p.z=z+relief;
        pos.setXYZ(i,p.x,p.y,p.z);
      }
      geometry.computeVertexNormals();
    }
    // Transfer in the captured rest pose. The shoulder rim/straps need the same
    // clavicle/upper-arm blend as the skin; exclude hands and lower arms above.
    const surface = data.surface;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos,i);
      const samples = nearest(surface,p), influences = new Map();
      for (const {point,d} of samples) {
        const influence = 1/Math.max(.000004,d);
        for (let k = 0; k < 4; k++) if (point.weights[k]) {
          // A metal breastplate must not stretch sideways with the upper arm.
          // Keep its high shoulder tips flexible; the torso panel follows the ribs.
          const id=(flatPlate&&p.y<1.61||slot==='strap')?data.torsoIds[point.ids[k]]:point.ids[k];
          influences.set(id,(influences.get(id)||0)+point.weights[k]*influence);
        }
      }
      const ranked = [...influences].sort((a,b) => b[1]-a[1]).slice(0,4), total = ranked.reduce((sum,x) => sum+x[1],0);
      blend.elements.fill(0);
      for (let k = 0; k < ranked.length; k++) {
        const [id,value] = ranked[k], w = value/total;
        indices[i*4+k] = id; weights[i*4+k] = w;
        const e = data.restBones[id].elements;
        for (let j = 0; j < 16; j++) blend.elements[j] += e[j]*w;
      }
      // The GLB's authored rest pose differs from its inverse-bind pose. Undo
      // that exact blended transform, otherwise the first animation displaces gear.
      blend.invert(); p.applyMatrix4(blend); pos.setXYZ(i,p.x,p.y,p.z);
      normal.getNormalMatrix(blend); n.fromBufferAttribute(normals,i).applyNormalMatrix(normal); normals.setXYZ(i,n.x,n.y,n.z);
    }
    geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));
    geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    variants.set(key,geometry); return geometry;
  }
  function sync(m) {
    if(m.teamBand)m.teamBand.group.visible=!m.gear.chest.group.visible;
    m.gear.helmet.group.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.material = wornMaterial(o.material); } });
    const data = m.equipmentFit164; if (!data) return;
    const T = THREE;
    for (const name of slots) {
      const group = m.gear[name].group;
      if (group.userData.fitted164) continue;
      group.updateMatrix();
      const placement = group.matrix.clone();
      // The imported caps were centred in front of the deltoid; the full cuirass
      // also had 7 cm of excess depth. Keep these corrections out of item previews.
      if (name === 'shoulder' || name === 'otherShoulder') placement.elements[14] -= .05;
      if (name === 'collar') placement.elements[14] -= .045;
      if (name === 'chest' && m.chestModel !== 'chest_plate') placement.multiply(new T.Matrix4().makeScale(1,1,.84));
      const base = data.anchors[name].clone().multiply(placement), meshes = [];
      group.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) meshes.push(o); });
      for (const old of meshes) {
        old.updateMatrix(); const local = old.matrix.clone();
        for (let parent = old.parent; parent && parent !== group; parent = parent.parent) { parent.updateMatrix(); local.premultiply(parent.matrix); }
        const geometry = fitGeometry(old.geometry,base.clone().multiply(local),data,name);
        const mesh = new T.SkinnedMesh(geometry,wornMaterial(old.material));
        mesh.name = old.name; mesh.userData = {...old.userData, wornEquipment164:true};
        mesh.castShadow = old.castShadow; mesh.receiveShadow = old.receiveShadow;
        // Rest-pose bounds are invalid during duck/roll; use the same policy as the body.
        mesh.frustumCulled = false;
        mesh.bind(data.body.skeleton,data.bind);
        old.parent.add(mesh); old.removeFromParent();
      }
      if(name==='chest'&&m.chestModel==='chest_plate'){
        strapMaterial=strapMaterial||new T.MeshStandardMaterial({color:0x211b16,roughness:.8,metalness:.05,side:T.DoubleSide});
        const mesh=new T.SkinnedMesh(fitGeometry(straps(data),new T.Matrix4(),data,'strap'),wornMaterial(strapMaterial));
        mesh.name='fitted-breastplate-straps';mesh.userData.wornEquipment164=true;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.bind(data.body.skeleton,data.bind);group.add(mesh);
      }
      group.userData.fitted164 = true;
    }
  }
  return { capture, sync };
})();
