/* Shared rig cleanup and measured rendering budget. Combat timing is never scaled. */
var ArenaRuntime = (() => {
  // V187: cache transforms only inside one synchronous pose evaluation. A changed
  // local transform or parent revision always recomputes its world matrix. Outside
  // this scope Three.js retains its original update and lifecycle behaviour.
  const matrixCache = {enabled:true, localUpdates:0, worldUpdates:0, reused:0};
  const transforms = new WeakMap(); let poseDepth=0, poseEpoch=0, installed=false;
  function installMatrixCache(T) {
    if(installed||!T?.Object3D)return;installed=true;
    const prototype=T.Object3D.prototype,tree=prototype.updateMatrixWorld,world=prototype.updateWorldMatrix;
    function refresh(node){
      let row=transforms.get(node);if(!row){row={epoch:0,version:0,parentVersion:-1,local:new Float64Array(16),trs:new Float64Array(10)};transforms.set(node,row);}
      const fresh=row.epoch!==poseEpoch,p=node.position,q=node.quaternion,s=node.scale,a=row.trs;
      const changed=fresh||a[0]!==p.x||a[1]!==p.y||a[2]!==p.z||a[3]!==q.x||a[4]!==q.y||a[5]!==q.z||a[6]!==q.w||a[7]!==s.x||a[8]!==s.y||a[9]!==s.z;
      if(node.matrixAutoUpdate&&changed){node.updateMatrix();matrixCache.localUpdates++;a[0]=p.x;a[1]=p.y;a[2]=p.z;a[3]=q.x;a[4]=q.y;a[5]=q.z;a[6]=q.w;a[7]=s.x;a[8]=s.y;a[9]=s.z;}
      const elements=node.matrix.elements,parent=node.parent,parentRow=parent&&transforms.get(parent),parentVersion=parentRow?.epoch===poseEpoch?parentRow.version:-1;
      let dirty=fresh||node.matrixWorldNeedsUpdate||node.matrixAutoUpdate&&changed||row.parent!==parent||row.parentVersion!==parentVersion;
      if(!node.matrixAutoUpdate)for(let i=0;i<16;i++)if(row.local[i]!==elements[i]){dirty=true;break;}
      // A parent outside this scope can have a manually assigned world matrix.
      if(parent&&parentVersion===-1)dirty=true;
      if(dirty){if(parent)node.matrixWorld.multiplyMatrices(parent.matrixWorld,node.matrix);else node.matrixWorld.copy(node.matrix);if(!node.matrixAutoUpdate)row.local.set(elements);row.version++;matrixCache.worldUpdates++;}else matrixCache.reused++;
      row.epoch=poseEpoch;row.parent=parent;row.parentVersion=parentVersion;node.matrixWorldNeedsUpdate=false;return dirty;
    }
    prototype.updateWorldMatrix=function(parents,children){
      if(!poseDepth||!matrixCache.enabled)return world.call(this,parents,children);
      if(parents&&this.parent?.matrixWorldAutoUpdate)this.parent.updateWorldMatrix(true,false);
      refresh(this);
      if(children)for(const child of this.children)if(child.matrixWorldAutoUpdate)child.updateWorldMatrix(false,true);
    };
    prototype.updateMatrixWorld=function(force){
      if(!poseDepth||!matrixCache.enabled)return tree.call(this,force);
      const dirty=refresh(this);
      for(const child of this.children)if(child.matrixWorldAutoUpdate||force||dirty)child.updateMatrixWorld(force||dirty);
    };
  }
  function beginPose(){if(!installed&&typeof THREE!=='undefined')installMatrixCache(THREE);if(poseDepth++===0)poseEpoch++;}
  function endPose(){poseDepth=Math.max(0,poseDepth-1);}
  // Real elapsed time down to 4 FPS; hidden/paused hosts reset their last timestamp.
  // Fixed-step simulations consume this in bounded 1/30 or 1/60 second steps.
  function frameDelta(now,last){return last?Math.max(0,Math.min(.25,(now-last)/1000)):0;}
  function pixelRatio(ratio,touch=false,width=0,height=0){
    const maximum=Math.min(Math.max(1,ratio||1),touch?1.25:1.5),pixels=width*height,budget=touch?900000:1600000;
    return pixels?Math.min(maximum,Math.sqrt(budget/pixels)):maximum;
  }
  const mergedBodies = new WeakMap();
  function optimizeRig(root) {
    const meshes = [], removed = [], skeletons = new Set();
    root.traverse(o => {
      if (!o.isSkinnedMesh) return;
      skeletons.add(o.skeleton);
      if (o.userData.replaceGear && !o.children.length) removed.push(o);
      else if (o.visible && !o.children.length) meshes.push(o);
    });
    // Replacement equipment has its own mesh. Retain the original bounds calculation
    // before this call so character height and all authored animation poses stay exact.
    for (const o of removed) o.removeFromParent();
    const first = meshes[0];
    if (first && typeof ArenaGeometryUtils !== 'undefined') {
      const compatible = meshes.filter(o => o.parent === first.parent &&
        o.material === first.material && o.matrix.equals(first.matrix) &&
        o.bindMatrix.equals(first.bindMatrix) && o.bindMatrixInverse.equals(first.bindMatrixInverse) &&
        o.skeleton.bones.length === first.skeleton.bones.length &&
        o.skeleton.bones.every((b, i) => b === first.skeleton.bones[i] &&
          o.skeleton.boneInverses[i].equals(first.skeleton.boneInverses[i])) &&
        !Object.keys(o.geometry.morphAttributes).length);
      if (compatible.length > 1) {
        const sources = compatible.map(o => o.geometry), cached = mergedBodies.get(first.geometry);
        let geometry = cached && sources.every((g, i) => g === cached.sources[i]) &&
          cached.sources.length === sources.length ? cached.geometry : null;
        if (!geometry) {
          geometry = ArenaGeometryUtils.mergeGeometries(sources, false);
          if (geometry) {
            geometry.computeBoundingBox(); geometry.computeBoundingSphere();
            mergedBodies.set(first.geometry, { sources, geometry });
          }
        }
        if (geometry) {
          first.geometry = geometry;
          for (const o of compatible.slice(1)) o.removeFromParent();
        }
      }
    }
    const kept = new Set();
    root.traverse(o => { if (o.isSkinnedMesh) kept.add(o.skeleton); });
    for (const skeleton of skeletons) if (!kept.has(skeleton)) skeleton.dispose();
    return { removedMeshes: removed.length + meshes.length - kept.size, skeletons: kept.size };
  }

  // A settled corpse keeps its final world pose. Its bones and matrices no longer
  // change, so neither world transforms nor bone texture data need rebuilding.
  function settleCorpse(model) {
    if (model.corpseSettled) return;
    model.root.updateMatrixWorld(true);
    const skeletons = new Set();
    model.root.traverse(o => {
      o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false;
      if (o.isSkinnedMesh) skeletons.add(o.skeleton);
    });
    for (const skeleton of skeletons) { skeleton.update(); skeleton.update = () => {}; }
    model.corpseSettled = true;
  }

  // Share the original geometry/material; one GPU draw per compatible mesh,
  // even when many identical pieces of loot accumulate. IDs still belong to combat.
  class DropBatch {
    constructor(T, scene) { this.T=T; this.scene=scene; this.ids=''; this.meshes=[]; }
    clear() { for(const mesh of this.meshes){this.scene.remove(mesh);mesh.dispose();} this.meshes=[];this.ids=''; }
    update(drops, template, visible) {
      const ids=drops.map(d=>d.id).join(',');
      if(ids!==this.ids){
        this.clear();this.ids=ids;const T=this.T,buckets=new Map();
        for(const d of drops){
          const item=template(d).clone(true);item.rotation.set(Math.PI/2,d.id*.71,0);item.position.set(d.x,.16,d.z);item.updateMatrixWorld(true);
          item.traverseVisible(o=>{
            if(!o.isMesh)return;
            const materials=Array.isArray(o.material)?o.material.map(m=>m.uuid).join(','):o.material.uuid;
            const key=o.geometry.uuid+':'+materials;
            if(!buckets.has(key))buckets.set(key,{geometry:o.geometry,material:o.material,matrices:[]});
            buckets.get(key).matrices.push(o.matrixWorld.clone());
          });
        }
        for(const b of buckets.values()){
          const mesh=new T.InstancedMesh(b.geometry,b.material,b.matrices.length);
          b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
          mesh.castShadow=false;mesh.receiveShadow=true;mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;
          this.scene.add(mesh);this.meshes.push(mesh);
        }
      }
      for(const mesh of this.meshes)mesh.visible=visible;
    }
  }

  class AdaptiveQuality {
    constructor(maximum = 1.25, minimum = .875) {
      this.setBounds(maximum, minimum); this.reset();
    }
    setBounds(maximum, minimum = this.minimum) {
      this.maximum = maximum; this.minimum = Math.min(maximum, minimum);
    }
    reset(now = 0) {
      this.last = null; this.elapsed = 0; this.frames = 0; this.slow = 0; this.fast = 0;
      this.cooldown = now + 2000;
    }
    sample(now, current) {
      const dt = this.last === null ? 0 : now - this.last; this.last = now;
      // Ignore background/loading gaps. Repeated 250–1000 ms frames must still
      // lower the load: the old 250 ms cutoff stranded the slowest devices.
      if (dt <= 0 || dt > 1000) { this.elapsed = 0; this.frames = 0; this.slow = 0; this.fast = 0; return null; }
      if (now < this.cooldown) return null;
      this.elapsed += dt; this.frames++; if (dt > 22.5) this.slow++;
      // Low-FPS devices cannot wait for thirty frames to form each sample.
      if (this.elapsed < 1000 || this.frames < 8 && this.elapsed < 2000) return null;
      const mean = this.elapsed / this.frames, duration = this.elapsed, slow = this.slow / this.frames;
      this.elapsed = 0; this.frames = 0; this.slow = 0;
      if (mean > 21.5 && slow > .25) {
        this.fast = 0;
        if (current > this.minimum + .001) {
          this.cooldown = now + 2000;
          return Math.max(this.minimum, +(current - (mean > 50 ? .25 : .125)).toFixed(3));
        }
      } else if (mean < 17.8 && slow < .1) {
        this.fast += duration;
        if (this.fast >= 6000 && current < this.maximum - .001) {
          this.fast = 0; this.cooldown = now + 3000;
          return Math.min(this.maximum, +(current + .125).toFixed(3));
        }
      } else this.fast = 0;
      return null;
    }
  }

  // Only the WebGL drawing buffer changes; photographs, text and touch targets
  // retain their CSS size. Every gameplay host uses the same measured controller.
  class RenderScale {
    constructor(renderer, {touch=false, minimum=.75, maximum=Infinity} = {}) {
      this.renderer=renderer; this.touch=touch; this.minimum=minimum; this.cap=maximum;
      this.quality=new AdaptiveQuality(1,minimum); this.configured=false;
    }
    resize(width,height,ratio=1) {
      if (!(width>0 && height>0)) return;
      const maximum=Math.min(this.cap,pixelRatio(ratio,this.touch,width,height));
      this.quality.setBounds(maximum,this.minimum);
      const current=this.renderer.getPixelRatio(),next=this.configured?Math.min(maximum,Math.max(this.quality.minimum,current)):maximum;
      if (Math.abs(next-current)>.00001) this.renderer.setPixelRatio(next);
      this.renderer.setSize(width,height,false); this.width=width; this.height=height; this.sourceRatio=ratio; this.configured=true;
    }
    reset(now=0) { this.quality.reset(now); }
    restore(now=0) { this.renderer.setPixelRatio(this.quality.maximum); this.reset(now); }
    sample(now,active=true) {
      if (!active) { this.reset(now); return null; }
      const next=this.quality.sample(now,this.renderer.getPixelRatio());
      if (next!==null) this.renderer.setPixelRatio(next);
      return next;
    }
  }
  return { optimizeRig, settleCorpse, DropBatch, AdaptiveQuality, RenderScale, beginPose, endPose, matrixCache, frameDelta, pixelRatio };
})();
if (typeof module !== 'undefined') module.exports = ArenaRuntime;
