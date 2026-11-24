/* Actor-local finishes for the two commanders, including equipment picked up in combat. */
(function (root) {
 'use strict';
 const states = new WeakMap();

 function blackMaterial(source, preserveSkin) {
  const material = source.clone();
  // The actor owns its body material and drives the hit flash through this colour.
  if (preserveSkin && source.emissive) material.emissive = source.emissive;
  material.name = 'Legatus · ' + source.name;
  material.userData.legatusFinish296 = true;
  material.onBeforeCompile = shader => {
   if (preserveSkin) {
    shader.vertexShader = 'varying vec3 legatusPosition296;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nlegatusPosition296 = position;');
    shader.fragmentShader = 'varying vec3 legatusPosition296;\n' + shader.fragmentShader;
   }
   const skin = preserveSkin ? `
    vec3 p = legatusPosition296;
    float limbs = float((abs(p.x) > 0.235 && p.y > 0.78 && p.y < 1.63) ||
                       (abs(p.x) < 0.31 && p.y > 0.35 && p.y < 0.92 && p.z > -0.16));
    float skin = limbs * step(diffuseColor.g * 1.35, diffuseColor.r) *
                 step(diffuseColor.b * 1.3, diffuseColor.g);
   ` : 'float skin = 0.0;';
   shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
    #include <map_fragment>
    ${skin}
    float shade296 = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    diffuseColor.rgb = mix(vec3(0.008 + shade296 * 0.075), diffuseColor.rgb, skin);
   `);
  };
  material.customProgramCacheKey = () => preserveSkin ? 'legatus-body-296' : 'legatus-equipment-296';
  return material;
 }

 function sync(model, fighter) {
  const black = fighter.eliteBotV295?.variant === 'legatus';
  let state = states.get(model);
  if (!state && !black) return;
  if (!state) {
   const body = new WeakSet();
   model.visual.traverse(node => { if (node.isSkinnedMesh && !node.userData.wornEquipment164) body.add(node); });
   state = {body, originals:new Map(), materials:new Map(), revision:-1, black:false};
   states.set(model, state);
  }
  if (state.black === black && state.revision === model.gearRevisionV84) return;
  state.black = black;
  state.revision = model.gearRevisionV84;
  if (!black) {
   for (const [mesh, original] of state.originals) mesh.material = original;
   state.originals.clear();
   return;
  }
  const finish = (source, skin) => {
   if (source.userData.legatusFinish296) return source;
   let variants = state.materials.get(source);
   if (!variants) { variants = {}; state.materials.set(source, variants); }
   const key = skin ? 'body' : 'gear';
   return variants[key] ||= blackMaterial(source, skin);
  };
  function paint(group) {
   group.traverse(mesh => {
    if (!mesh.isMesh) return;
    if (!state.originals.has(mesh)) state.originals.set(mesh, mesh.material);
    const original = state.originals.get(mesh);
    mesh.material = Array.isArray(original) ? original.map(m => finish(m, state.body.has(mesh))) : finish(original, state.body.has(mesh));
   });
  }
  paint(model.visual);
  paint(model.weaponAnchor);
  paint(model.offhandAnchor);
  for (const part of Object.values(model.gear)) paint(part.group);
 }

 function dispose(model) {
  const state = states.get(model);
  if (!state) return;
  for (const variants of state.materials.values()) for (const material of Object.values(variants)) material.dispose();
  states.delete(model);
 }

 root.ArenaEliteAppearanceV296 = Object.freeze({sync, dispose});
})(globalThis);
