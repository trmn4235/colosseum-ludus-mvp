/* Shared rig cleanup and measured rendering budget. Combat timing is never scaled. */
var ArenaRuntime = (() => {
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

  class AdaptiveQuality {
    constructor(maximum = 1.25, minimum = .875) {
      this.maximum = maximum; this.minimum = Math.min(maximum, minimum); this.reset();
    }
    reset(now = 0) {
      this.last = null; this.elapsed = 0; this.frames = 0; this.fast = 0;
      this.cooldown = now + 2000;
    }
    sample(now, current) {
      const dt = this.last === null ? 0 : now - this.last; this.last = now;
      if (dt <= 0 || dt > 250) { this.elapsed = 0; this.frames = 0; this.fast = 0; return null; }
      if (now < this.cooldown) return null;
      this.elapsed += dt; this.frames++;
      if (this.elapsed < 1500 || this.frames < 30) return null;
      const mean = this.elapsed / this.frames, duration = this.elapsed;
      this.elapsed = 0; this.frames = 0;
      if (mean > 21.5) {
        this.fast = 0;
        if (current > this.minimum + .001) {
          this.cooldown = now + 2000;
          return Math.max(this.minimum, +(current - .125).toFixed(3));
        }
      } else if (mean < 17.8) {
        this.fast += duration;
        if (this.fast >= 6000 && current < this.maximum - .001) {
          this.fast = 0; this.cooldown = now + 3000;
          return Math.min(this.maximum, +(current + .125).toFixed(3));
        }
      } else this.fast = 0;
      return null;
    }
  }
  return { optimizeRig, AdaptiveQuality };
})();
if (typeof module !== 'undefined') module.exports = ArenaRuntime;
