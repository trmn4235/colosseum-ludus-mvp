/* Worn armour uses the body's bind pose and skeleton, including shoulder blends.
 * Fit once per asset/slot; no vertex searches, smoothing or extra skeletons per frame.
 * Inventory/drop templates remain rigid and unchanged.
 */
var ArenaEquipmentFit = (() => {
  const surfaces = new WeakMap(), fitted = new WeakMap(), materials = new WeakMap();
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
    m.equipmentFit164 = { body, surface, anchors, restBones, bind:new T.Matrix4() };
  }
  function fitGeometry(source, transform, data, slot) {
    const T = THREE;
    let variants = fitted.get(source); if (!variants) fitted.set(source, variants = new Map());
    const key = data.body.geometry.uuid+':'+slot+':'+transform.elements.map(x => x.toFixed(6)).join(',');
    if (variants.has(key)) return variants.get(key);
    const geometry = source.clone().applyMatrix4(transform), pos = geometry.attributes.position;
    const indices = new Uint16Array(pos.count*4), weights = new Float32Array(pos.count*4), p = new T.Vector3(), n = new T.Vector3();
    const blend = new T.Matrix4(), normal = new T.Matrix3(), normals = geometry.attributes.normal;
    // Transfer in the captured rest pose. The shoulder rim/straps need the same
    // clavicle/upper-arm blend as the skin; exclude hands and lower arms above.
    const surface = data.surface;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos,i);
      const samples = nearest(surface,p), influences = new Map();
      for (const {point,d} of samples) {
        const influence = 1/Math.max(.000004,d);
        for (let k = 0; k < 4; k++) if (point.weights[k]) influences.set(point.ids[k], (influences.get(point.ids[k])||0)+point.weights[k]*influence);
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
      group.userData.fitted164 = true;
    }
  }
  return { capture, sync };
})();
