/* Original Circus Maximus-inspired architecture. No downloaded stadium model.
 * Pure Three.js builder: usable by the preview and future game scenes.
 * Artistic reconstruction; not an archaeological survey or an exact dated phase. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory;
  else root.createCircusMaximus = factory;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (T, options) {
  'use strict';
  options = options || {};
  const group = new T.Group(); group.name = 'Circus Maximus';
  const textures = options.textures || {}, batches = new Map(), crowd = new T.Group(), treePlacements=[];
  crowd.name = 'Spectators';
  let seed = 141;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const material = (name, color, extra = {}) => {
    const m = new T.MeshStandardMaterial({ color, roughness: .86, vertexColors: true, ...extra });
    m.name = name; return m;
  };
  const M = {
    stone: material('Weathered limestone', 0xf4efdf, { map: textures.stone || null, normalMap: textures.stoneNormal || null, normalScale: new T.Vector2(.65,.65), roughnessMap: textures.stoneRough || null }),
    marble: material('Honed pale stone', 0xf2eee4, { map: textures.plaster || null, normalMap: textures.plasterNormal || null, normalScale: new T.Vector2(.16,.16), roughnessMap: textures.plasterRough || null, roughness:.72 }),
    shade: material('Recessed masonry', 0xa39c8e, { map: textures.stone || null, normalMap: textures.stoneNormal || null, normalScale: new T.Vector2(.45,.45) }),
    plaster: material('Lime plaster', 0xe6dbc4, { map: textures.plaster || null, normalMap: textures.plasterNormal || null, normalScale: new T.Vector2(.48,.48), roughnessMap: textures.plasterRough || null }),
    red: material('Worn Pompeian plaster', 0x8a443a, { map: textures.plaster || null, normalMap: textures.plasterNormal || null, normalScale: new T.Vector2(.4,.4) }),
    roof: material('Weathered terracotta tiles', 0xe0b391, { map: textures.roof || null, normalMap: textures.roofNormal || null, normalScale: new T.Vector2(.85,.85), roughnessMap: textures.roofRough || null }),
    gold: material('Aged bronze', 0xaf8440, { metalness: .55, roughness: .43 }),
    granite: material('Rose granite', 0xbfa89b, {map:textures.plaster||null,normalMap:textures.plasterNormal||null,normalScale:new T.Vector2(.28,.28)}),
    mosaic: material('Inlaid stone floor',0xbfa89b,{map:textures.plaster||null,normalMap:textures.plasterNormal||null,normalScale:new T.Vector2(.12,.12),roughness:.65}),
    teal: material('Patinated bronze', 0x527c76, { metalness: .35 }),
    wood: material('Cedar gates', 0x9b8670, { map: textures.wood || null, normalMap: textures.woodNormal || null, normalScale: new T.Vector2(.45,.45), roughnessMap: textures.woodRough || null }),
    water: material('Spina basins', 0x476b65, { roughness: .18, metalness: .24 }),
    sand: material('Rutted track sand', 0xeee7d6, { map: textures.sand || null, normalMap: textures.sandNormal || null, normalScale: new T.Vector2(.55,.55), roughnessMap: textures.sandRough || null, roughness:1 }),
    ground: material('Dry earth and grass', 0xc4c1a7, { map: textures.sand || null, normalMap: textures.sandNormal || null, normalScale:new T.Vector2(.35,.35) }),
    paving: material('Exterior paving', 0xbbb5a6, { map:textures.stone || null, normalMap:textures.stoneNormal || null, normalScale:new T.Vector2(.7,.7), roughnessMap:textures.stoneRough || null }),
    tree: material('Cypress foliage', 0x4b6040),
    trunk: material('Tree bark', 0x72634e),
    cream: material('Linen awnings', 0xe1d0aa, { side: T.DoubleSide }),
    burgundy: material('Red awnings', 0x8d3c3e, { side: T.DoubleSide }),
    blue: material('Blue awnings', 0x4a707f, { side: T.DoubleSide }),
    green: material('Green awnings', 0x65775c, { side: T.DoubleSide })
  };
  // World-space wear is independent of camera position and never exposes a decal plane.
  const noiseGLSL = `
    float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise21(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+1.0),f.x),f.y);}
    float fbm(vec2 p){return .57*noise21(p)+.28*noise21(p*2.03)+.15*noise21(p*4.07);}
    vec4 sandSample(sampler2D tex,vec2 uv){
      float k=noise21(uv*.14)*7.0,i=floor(k),f=smoothstep(.12,.88,fract(k));
      vec2 a=vec2(hash21(vec2(i,3)),hash21(vec2(i,7)))*13.0;
      vec2 b=vec2(hash21(vec2(i+1.0,3)),hash21(vec2(i+1.0,7)))*13.0;
      return mix(texture2D(tex,uv+a),texture2D(tex,uv+b),f);
    }
    float trackDistance(vec2 p){return length(vec2(p.x,max(abs(p.y-5.5)-207.5,0.0)));}
    float rutHeight(vec2 p){
      float d=trackDistance(p), wear=smoothstep(10.0,14.0,d)*(1.0-smoothstep(43.0,47.0,d));
      float wobble=.44*sin(p.y*.029+d*.72)+.17*sin(p.y*.11+d*.29);
      float lane=abs(fract((d+wobble-12.0)/3.7)-.5)*3.7;
      float pair=abs(lane-.62),width=max(.035,fwidth(d)*.6);
      float broken=mix(.23,1.0,fbm(vec2(p.y*.043,d*.6)));
      return -.029*(1.0-smoothstep(width,width+.14,pair))*wear*broken;
    }
  `;
  for(const mat of [M.sand,M.stone,M.marble,M.shade,M.plaster,M.red,M.ground,M.roof,M.paving,M.water]){
    mat.onBeforeCompile=s=>{
      s.vertexShader='varying vec3 vSurfaceWorld;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceWorld=(modelMatrix*vec4(position,1.0)).xyz;');
      s.fragmentShader='varying vec3 vSurfaceWorld;\n'+noiseGLSL+s.fragmentShader;
      let detail='';
      if(mat===M.sand){
        // Keep the photographed grain; use a second scale only to break macro repetition.
        s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
          diffuseColor.rgb*=sandSample(map,vMapUv).rgb;
        #endif`);
        detail=`
          vec2 p=vSurfaceWorld.xz;float d=trackDistance(p),macro=fbm(p*.055);
          float lane=smoothstep(10.0,15.0,d)*(1.0-smoothstep(42.0,47.0,d));
          diffuseColor.rgb*=mix(.79,1.16,macro)*(1.0-.10*lane);
          float rut=rutHeight(p);
          diffuseColor.rgb*=1.0+rut*4.2;
          float edge=1.0-smoothstep(0.0,1.6,abs(d-47.8));
          float spina=(1.0-smoothstep(4.5,6.3,abs(p.x)))*(1.0-smoothstep(208.0,215.0,abs(p.y-4.0)));
          diffuseColor.rgb*=1.0-.19*max(edge,spina);
        `;
        const normals=T.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv )','sandSample( normalMap, vNormalMapUv )');
        const roughness=T.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )','sandSample( roughnessMap, vRoughnessMapUv )');
        s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',roughness);
        s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',normals+`
          float h=rutHeight(vSurfaceWorld.xz);
          vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);
          vec3 r1=cross(sy,normal),r2=cross(normal,sx);float det=dot(sx,r1);
          vec3 grad=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);
          normal=normalize(abs(det)*normal-grad);
        `);
      }else if(mat===M.water){
        detail=`diffuseColor.rgb*=.86+.14*noise21(vSurfaceWorld.xz*3.7);`;
        s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          float wave=.014*sin(vSurfaceWorld.x*4.2+vSurfaceWorld.z*1.7)+.008*cos(vSurfaceWorld.z*6.1);
          vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),r1=cross(sy,normal),r2=cross(normal,sx);float det=dot(sx,r1);
          normal=normalize(abs(det)*normal-sign(det)*(dFdx(wave)*r1+dFdy(wave)*r2));
        `);
      }else if(mat===M.ground){
        s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
          diffuseColor.rgb*=sandSample(map,vMapUv).rgb;
        #endif`);
        s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',T.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv )','sandSample( normalMap, vNormalMapUv )'));
        detail=`float macro=fbm(vSurfaceWorld.xz*.011);diffuseColor.rgb*=mix(vec3(.73,.81,.59),vec3(1.03,.96,.81),smoothstep(.20,.79,macro));`;
      }else if(mat===M.roof){
        detail=`diffuseColor.rgb*=mix(.84,1.12,fbm(vSurfaceWorld.xz*.23));`;
      }else{
        detail=`
          float low=1.0-smoothstep(.15,2.3,vSurfaceWorld.y);
          float stain=fbm(vec2((vSurfaceWorld.x+vSurfaceWorld.z)*.72,vSurfaceWorld.y*.12));
          diffuseColor.rgb*=mix(.87,1.04,stain)*(1.0-.20*low);
        `;
      }
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+detail);
    };
    mat.customProgramCacheKey=()=> 'circus142-'+mat.name;
  }
  const cube = new T.BoxGeometry(1, 1, 1), cylinder = new T.CylinderGeometry(1, 1, 1, 8),
    tapered = new T.CylinderGeometry(.82, 1, 1, 16), cone = new T.ConeGeometry(1, 1, 16),
    sphere = new T.IcosahedronGeometry(1, 1), dummy = new T.Object3D();
  const ownGeometries = new Set([cube, cylinder, tapered, cone, sphere]);
  function add(geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, tint = 1, worldUV = true) {
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(0, ry, 0); dummy.updateMatrix();
    const indexed = geometry.clone().applyMatrix4(dummy.matrix), g = indexed.index ? indexed.toNonIndexed() : indexed;
    if (g !== indexed) indexed.dispose();
    const p = g.attributes.position, n = g.attributes.normal;
    if (!g.attributes.uv) g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(p.count * 2), 2));
    const uv = g.attributes.uv, colors = new Float32Array(p.count * 3);
    const texScale = mat === M.sand ? .66 : mat === M.marble ? .55 : mat === M.roof ? .25 : mat === M.ground ? .06 : mat === M.paving ? .5 : .5;
    for (let i = 0; i < p.count; i++) {
      if (mat.map && worldUV) {
        const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
        uv.setXY(i, (nx > ny && nx > nz ? p.getZ(i) : p.getX(i)) * texScale,
          (ny > nx && ny > nz ? p.getZ(i) : p.getY(i)) * texScale);
        if(mat===M.roof&&ny>nz)uv.setXY(i,p.getZ(i)*texScale,p.getX(i)*texScale);
      }
      const variation = mat === M.ground ? .9 + .1 * Math.sin(p.getX(i)*.021)*Math.cos(p.getZ(i)*.017) : 1;
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = tint * variation;
    }
    g.setAttribute('color', new T.BufferAttribute(colors, 3));
    if (!batches.has(mat)) batches.set(mat, []);
    batches.get(mat).push(g);
  }
  const box = (mat, x, y, z, w, h, d, ry = 0, tint = 1) => add(cube, mat, x, y, z, w, h, d, ry, tint);
  function geo(positions, indices, uv) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    if (indices) g.setIndex(indices);
    if (uv) g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); ownGeometries.add(g); return g;
  }
  // Local X is the frontage; local Z points out of the building.
  function archGeometry(width, spring, thickness, depth) {
    const r = width / 2, shape = new T.Shape();
    shape.moveTo(-r - thickness, 0); shape.lineTo(-r - thickness, spring);
    shape.absarc(0, spring, r + thickness, Math.PI, 0, true);
    shape.lineTo(r + thickness, 0); shape.lineTo(r, 0); shape.lineTo(r, spring);
    shape.absarc(0, spring, r, 0, Math.PI, false); shape.lineTo(-r, 0); shape.closePath();
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize:.045, bevelThickness:.045, bevelSegments:1, curveSegments:8 });
    g.translate(0, 0, -depth / 2); ownGeometries.add(g); return g;
  }
  const arcade = archGeometry(4.8, 3.5, .72, 1.25), upperArcade = archGeometry(4.2, 2.65, .7, 1.1), gateArch = archGeometry(5.3, 4.5, .9, 2.4);
  const roofVertices=[-.5,0,-.5, .5,0,-.5, 0,1,-.5, -.5,0,.5, .5,0,.5, 0,1,.5];
  const roofBase = geo(roofVertices,[0,3,5,0,5,2,1,2,5,1,5,4]),roofEnds=geo(roofVertices,[0,2,1,3,4,5]);
  const roofGeo=roofBase.toNonIndexed();roofGeo.computeVertexNormals();ownGeometries.add(roofGeo);
  function roof(x, y, z, w, h, d, ry = 0) {
    add(roofGeo,M.roof,x,y,z,w,h,d,ry,.84+random()*.22);
    add(roofEnds,M.plaster,x,y,z,w,h,d,ry,.9);
    // Projecting eaves and ridge caps cast real shadows at roof edges.
    box(M.roof,x,y-.16,z,w+.22,.32,d+.24,ry,.83);
    box(M.roof,x,y+h+.04,z,.38,.28,d+.28,ry,1.03);
  }
  function column(x, y, z, h, r = .48, mat = M.marble) {
    add(tapered, mat, x, y + h / 2, z, r, h, r);
    box(mat, x, y + .16, z, r * 2.8, .32, r * 2.8);
    box(mat, x, y + h - .18, z, r * 2.9, .36, r * 2.9);
    add(cylinder, mat, x, y + h - .54, z, r * 1.28, .24, r * 1.28);
  }
  const robe=new T.LatheGeometry([[.32,0],[.38,.12],[.35,.45],[.28,.9],[.29,1.3],[.40,1.55],[.29,1.67]].map(([x,y])=>new T.Vector2(x,y)),16);
  const rp=robe.attributes.position;
  for(let i=0;i<rp.count;i++){const a=Math.atan2(rp.getZ(i),rp.getX(i)),f=1+.095*Math.sin(a*9+rp.getY(i)*1.4);rp.setXYZ(i,rp.getX(i)*f,rp.getY(i),rp.getZ(i)*f);}
  robe.computeVertexNormals();ownGeometries.add(robe);
  const statueHead=new T.SphereGeometry(1,12,8);ownGeometries.add(statueHead);
  function statue(x,y,z,scale=1){
    box(M.marble,x,y+.5*scale,z,1.8*scale,scale,1.8*scale);
    box(M.marble,x,y+1.03*scale,z,1.55*scale,.15*scale,1.55*scale);
    add(robe,M.marble,x,y+1.12*scale,z,scale,scale,scale);
    add(tapered,M.marble,x,y+2.9*scale,z,.13*scale,.28*scale,.13*scale);
    add(statueHead,M.marble,x,y+3.22*scale,z,.24*scale,.32*scale,.245*scale);
    add(sphere,M.marble,x,y+3.19*scale,z+.24*scale,.065*scale,.10*scale,.095*scale);
    for(const side of [-1,1]){
      add(tapered,M.marble,x+side*.39*scale,y+2.40*scale,z,.11*scale,.63*scale,.12*scale);
      add(sphere,M.marble,x+side*.35*scale,y+2.12*scale,z+.14*scale,.14*scale,.16*scale,.20*scale);
      add(sphere,M.marble,x+side*.16*scale,y+1.15*scale,z+.15*scale,.14*scale,.09*scale,.26*scale);
    }
  }
  const START = -244, TURN = 232, INNER = 48, ROWS = 28, STEP = .82, RISE = .59, OUTER = 76;
  const paths = [];
  for (let side of [-1, 1]) {
    for (let z = START + 4; z < TURN; z += 8) paths.push({ x: side * OUTER, z, angle: side * Math.PI / 2, side });
  }
  for (let i = 0; i < 30; i++) {
    const a = (i + .5) / 30 * Math.PI;
    paths.push({ x: Math.cos(a) * OUTER, z: TURN + Math.sin(a) * OUTER, angle: Math.PI / 2 - a, curve: true });
  }
  // Continuous U-shaped podium, with the carceres closing the other end.
  function ringStrip(r0, r1, y, height, mat, segments = 90) {
    const p = [], ix = [];
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI, c = Math.cos(a), s = Math.sin(a);
      p.push(c*r0,y,TURN+s*r0, c*r1,y,TURN+s*r1, c*r0,y+height,TURN+s*r0, c*r1,y+height,TURN+s*r1);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 4, b = a + 4;
      ix.push(a+2,b+2,b+3,a+2,b+3,a+3, a,b,b+2,a,b+2,a+2, a+1,a+3,b+3,a+1,b+3,b+1);
    }
    const g = geo(p, ix); add(g, mat, 0, 0, 0);
  }
  const earth = new T.PlaneGeometry(3600,3600,90,90); earth.rotateX(-Math.PI/2);
  const ep = earth.attributes.position;
  for(let i=0;i<ep.count;i++){
    const x=ep.getX(i),z=ep.getZ(i),edge=T.MathUtils.smoothstep(Math.max(Math.abs(x)/290,Math.abs(z)/480),1,2.6);
    ep.setY(i,-.4+edge*(38+18*Math.sin(x*.007+z*.004)+17*Math.cos(z*.013)));
  }
  earth.computeVertexNormals();ownGeometries.add(earth);add(earth,M.ground,0,0,0);
  const track=new T.PlaneGeometry(INNER*2,TURN-START,48,238);track.rotateX(-Math.PI/2);
  const tp=track.attributes.position;
  for(let i=0;i<tp.count;i++){
    const x=tp.getX(i),z=tp.getZ(i),edge=Math.min(1,(INNER-Math.abs(x))*.7,((TURN-START)/2-Math.abs(z))*.7);
    tp.setY(i,Math.max(0,edge)*(.018*Math.sin(x*.67+z*.23)+.012*Math.cos(z*.91)));
  }
  track.computeVertexNormals();ownGeometries.add(track);add(track,M.sand,0,0,(START+TURN)/2);
  const trackEnd = new T.CircleGeometry(INNER, 70, 0, Math.PI); trackEnd.rotateX(-Math.PI / 2); trackEnd.rotateY(Math.PI); ownGeometries.add(trackEnd);
  add(trackEnd, M.sand, 0, 0, TURN);
  for (const side of [-1, 1]) {
    box(M.shade, side * 62.6, 1.2, -6, 28, 2.4, 476);
    box(M.stone, side * 48.8, 1.8, -6, 1.6, 3.6, 476);
    box(M.red, side * 47.94, 2.65, -6, .1, .62, 476);
    box(M.marble, side * 48.6, 3.6, -6, 2.1, .28, 476);
    box(M.marble,side*47.91,.22,-6,.22,.44,476);
    box(M.marble,side*47.91,2.23,-6,.16,.16,476);
    for(let z=START+12;z<TURN;z+=23.8){
      box(M.marble,side*47.86,1.82,z,.28,3.2,.65);
      box(M.shade,side*47.78,.38,z+5,.035,.28,.48);
    }
    // Pavements connect the arena to the surrounding neighbourhood.
    box(M.paving,side*85,-.15,-7,14,.2,493);
    box(M.marble,side*92,-.05,-7,.45,.3,493,.0,.84);
  }
  ringStrip(48, 50, 0, 3.6, M.stone); ringStrip(47.93,48.02,2.35,.63,M.red); ringStrip(47.8,50.2,3.6,.25,M.marble);
  ringStrip(78.7,92,-.25,.15,M.paving,100);
  // Stepped rows, with regularly spaced radial aisles and entry portals.
  for (let row = 0; row < ROWS; row++) {
    const r = 50 + row * STEP, y = 3.7 + row * RISE;
    for (const side of [-1, 1]) {
      for (let section = 0; section < 20; section++) {
        const z = START + (section + .5) * 23.8;
        // A real opening for the imperial box, instead of intersecting its seats.
        if (side === 1 && z > -108 && z < -36 && row < 17) continue;
        box(M.stone, side * (r + STEP / 2), y - .42, z, STEP, .84, 22.2, 0, .88 + random() * .12);
      }
    }
    ringStrip(r, r + STEP, y - .82, .82, M.stone, 96);
  }
  // Stair aisles read as pale stripes between seating blocks.
  for (const side of [-1, 1]) for (let section = 1; section < 20; section++) {
    const z = START + section * 23.8;
    for (let row = 0; row < ROWS * 2; row++) box(M.marble, side*(50+(row+.5)*STEP/2),3.1+row*RISE/2,z,STEP/2,.34,1.6);
  }
  for (let k = 1; k < 15; k++) {
    const a = k / 15 * Math.PI;
    for (let row = 0; row < ROWS * 2; row++) {
      const r = 50 + (row + .5) * STEP / 2;
      box(M.marble, Math.cos(a)*r,3.18+row*RISE/2,TURN+Math.sin(a)*r,STEP/2,.34,1.4,-a);
    }
  }
  for (const side of [-1, 1]) {
    box(M.stone, side*76,7.8,-6,2.3,.55,477); box(M.stone,side*76,15.25,-6,2.4,.65,477);
    box(M.stone,side*75,21,-6,5,.7,477); box(M.red,side*75.7,20.3,-6,1,.7,477);
    box(M.stone,side*76,26.5,-6,5,.65,477); roof(side*76,26.85,-6,6,1.55,478);
  }
  ringStrip(74.7,77.3,7.5,.6,M.stone); ringStrip(74.7,77.3,14.9,.6,M.stone);
  ringStrip(72.5,78,20.6,.7,M.stone); ringStrip(73.4,78.4,26.2,.65,M.stone); ringStrip(73,79,26.85,.5,M.roof);
  for (const p of paths) {
    add(arcade,M.stone,p.x,0,p.z,1,1,1,p.angle,.88+random()*.12);
    add(upperArcade,M.stone,p.x,8.1,p.z,1,1,1,p.angle,.9+random()*.1);
    // Exterior pilasters and the open upper colonnade.
    const tx = Math.cos(p.angle)*3.6, tz = -Math.sin(p.angle)*3.6;
    column(p.x+tx,0,p.z+tz,7.5,.35); column(p.x+tx,8.1,p.z+tz,6.8,.3);
    column(p.x,21.3,p.z,5,.36);
  }
  const fabric = [M.cream, M.burgundy, M.cream, M.blue, M.cream, M.green];
  for (let i=0;i<paths.length;i++) {
    const p=paths[i]; if (!p.curve && p.side===1 && p.z>-108 && p.z<-36) continue;
    if (i%6===5) continue;
    const pos=[],uv=[],ix=[];
    for(let j=0;j<=5;j++)for(let k=0;k<=2;k++){
      const u=k/2,v=j/5; pos.push((u-.5)*7.45, -.9*Math.sin(v*Math.PI)-.22*Math.sin(u*Math.PI), -v*14);
      uv.push(u,v);
    }
    for(let j=0;j<5;j++)for(let k=0;k<2;k++){const a=j*3+k,b=a+3;ix.push(a,b,a+1,b,b+1,a+1);}
    const g=geo(pos,ix,uv); // slope the sail from the back gallery toward the seats
    const a=g.attributes.position;for(let j=0;j<a.count;j++)a.setY(j,a.getY(j)+a.getZ(j)*.38);g.computeVertexNormals();
    add(g,fabric[i%fabric.length],p.x,25.7,p.z,1,1,1,p.angle,1,false);
  }
  // Twelve starting stalls. The two centre bays form the ceremonial gateway.
  for(let i=0;i<12;i++){
    const x=(i-5.5)*7.35,z=START-5+Math.abs(x)*.035;
    add(gateArch,M.stone,x,0,z);
    box(M.wood,x,3.1,z-.9,5.15,6.2,.3);
    for(let q=-2;q<=2;q++)box(M.gold,x+q*.85,3.1,z-.68,.055,6.1,.07);
    box(M.gold,x,2.1,z-.65,5.2,.12,.08);box(M.gold,x,4.4,z-.65,5.2,.12,.08);
    box(M.stone,x,9,z,7.35,1,6); roof(x,9.5,z,7.6,1.6,6.8);
    column(x-3.45,0,z+1.6,8.5,.32,M.marble);
  }
  for(const x of [-48,0,48]){
    if(x!==0)box(M.stone,x,4.7,START-8,8.5,9.4,11);
    else box(M.stone,x,9.6,START-8,8.5,1.1,11);
    box(M.red,x,9.6,START-1.9,7,.8,.15);
    for(const sx of [-2.8,2.8])column(x+sx,10.2,START-1.7,5,.4);
    box(M.marble,x,15.5,START-5.5,9.6,.65,9.4);roof(x,15.8,START-5.5,10.6,3.1,10);
    statue(x,18.6,START-5.5,.9);
  }
  // Spina: low barrier, marble basins, shrines, obelisk and both sets of metae.
  box(M.marble,0,.55,4,9,1.1,421);box(M.red,0,1.15,4,8.4,.35,420);box(M.marble,0,1.45,4,9.3,.3,422);
  for(const z of [-203,215]){
    add(cylinder,M.stone,0,1.1,z,5.7,2.2,5.7);add(cylinder,M.marble,0,2.3,z,5.9,.3,5.9);
    for(const [x,dz] of [[-2.6,0],[2.6,0],[0,z>0?2.8:-2.8]]){
      add(cylinder,M.teal,x,4,z+dz,1.05,3.4,1.05);add(cone,M.gold,x,7.5,z+dz,1.15,3.8,1.15);
    }
  }
  for(const z of [-159,-50,76,161]){
    box(M.stone,0,1.9,z,7.6,.8,28);box(M.water,0,2.32,z,6.6,.08,26.8);
    for(const x of [-3.7,3.7])box(M.marble,x,2.4,z,.38,.35,28.3);
    for(const zz of [-14,14])box(M.marble,0,2.4,z+zz,7.8,.35,.4);
  }
  function shrine(z){
    box(M.marble,0,2,z,8,1,10);for(const x of [-2.6,2.6])for(const zz of [-3.5,0,3.5])column(x,2.5,z+zz,5.4,.35);
    box(M.marble,0,8.1,z,7.7,.65,10);roof(0,8.4,z,8.4,2.2,10.7);statue(0,2.5,z,.75);
  }
  shrine(-102);shrine(116);
  box(M.marble,0,2.5,22,9,1.8,10);box(M.granite,0,5.3,22,6,3.8,7);box(M.marble,0,7.5,22,6.8,.6,7.8);
  const shaft=new T.CylinderGeometry(1.2,2.1,31,4,1);shaft.rotateY(Math.PI/4);ownGeometries.add(shaft);
  add(shaft,M.granite,0,23.3,22);const cap=new T.ConeGeometry(1.2,3,4);cap.rotateY(Math.PI/4);ownGeometries.add(cap);add(cap,M.gold,0,40.3,22);
  for(const z of [-184,-130,-75,-17,54,143,191]){
    column(0,1.6,z,6,.7,M.granite);statue(0,7.6,z,.7);
    for(const x of [-3.7,3.7]){box(M.marble,x,2,z,1,.8,1);add(sphere,M.gold,x,2.75,z,.45,.45,.45);}
  }
  // Lap counter: seven bronze eggs on a small entablature.
  for(const z of [-120,98]){
    column(-2.8,1.6,z,3,.3);column(2.8,1.6,z,3,.3);box(M.marble,0,4.9,z,7.7,.45,1.7);
    for(let i=-3;i<=3;i++)add(sphere,M.gold,i*.93,5.6,z,.28,.48,.28);
  }
  // Imperial pulvinar, open to the track with a shaded, columned viewing room.
  box(M.stone,65,5,-72,35,10,40);box(M.marble,55,10.4,-72,30,.8,42);
  box(M.red,78,14.8,-72,1.4,9,40);
  for(const z of [-90,-81,-63,-54])column(45,10.8,z,8.5,.62);
  for(const z of [-90,-54])for(const x of [53,61,69])column(x,10.8,z,8.5,.62);
  box(M.marble,59,19.6,-72,31,.7,42);roof(61,19.95,-72,34,4.8,44);
  for(const z of [-90,-54])box(M.burgundy,46,15.2,z,1.6,8.4,3.7);
  box(M.marble,43.1,11.8,-72,.6,1.5,39);box(M.gold,42.7,12.6,-72,.25,.18,40);
  for(let z=-90;z<=-54;z+=2)box(M.marble,43,11.9,z,.8,1.6,.6);
  for(const z of [-91,-53])statue(42,11,z,1.1);
  // Inlaid floor, coffered ceiling and small relief panels visible from the loge.
  for(let x=46;x<72;x+=2)for(let z=-90;z<-53;z+=2){
    if((Math.round(x/2)+Math.round(z/2))%2===0)box(M.mosaic,x,10.84,z,1.88,.04,1.88,0,.88);
  }
  for(let z=-88;z<-54;z+=4){
    box(M.gold,42.75,11.75,z,.035,.42,2.1);
    box(M.marble,59,19.2,z,29,.25,.35);
  }
  for(let x=48;x<73;x+=5)box(M.marble,x,19.2,-72,.35,.25,39);
  // Terraced Palatine massing behind the imperial side.
  box(M.stone,133,5,-43,82,10,225);box(M.stone,147,14,-42,71,8,193);
  for(let z=-140;z<57;z+=9){add(arcade,M.stone,92.1,1,z,1,1,1,Math.PI/2);column(110,10,z,7.2,.5);}
  box(M.marble,111,17.6,-42,4,.8,202);
  for(const [x,z,w,d,h] of [[145,-113,50,48,18],[147,-45,62,59,24],[148,28,58,47,20]]){
    box(M.stone,x,18+h/2,z,w,h,d);roof(x,18+h,z,w+4,7,d+4);
    for(let zz=z-d/2+4;zz<z+d/2;zz+=6){column(x-w/2-.8,18,zz,h-.6,.65);box(M.shade,x-w/2-.05,22+h*.3,zz,.12,6,2.7);}
    box(M.marble,x,18+h-.6,z,w+2,1.2,d+2);
  }
  function tree(x,z,height=13){
    treePlacements.push({x,z,height,angle:random()*Math.PI*2});
    if(options.trees)return;
    add(cylinder,M.trunk,x,height*.26,z,.33,height*.52,.33);
    add(sphere,M.tree,x,height*.6,z,1.6,height*.45,1.8,random(),.8+random()*.3);
  }
  for(let z=-150;z<=75;z+=11)tree(99,z,9+random()*4);
  // Small, individually varied Roman blocks, leaving the circus exterior clear.
  for(const side of [-1,1])for(let row=0;row<4;row++)for(let i=0;i<23;i++){
    const x=side*(110+row*27+random()*7),z=-322+i*31+random()*9;
    if(side===1&&z>-165&&z<86)continue;
    const w=15+random()*8,d=18+random()*8,h=7+random()*11;
    const plaster=random()>.22?M.plaster:M.red;
    box(plaster,x,h/2,z,w,h,d,0,.77+random()*.24);roof(x,h,z,w+1.2,3+random()*2,d+1.2);
    box(M.stone,x,1.1,z,w+.12,2.2,d+.12,0,.82);
    for(const xx of [-w*.28,0,w*.28]){
      box(M.shade,x+xx,h*.68,z+d/2+.03,1.3,2.4,.08);
      box(M.marble,x+xx,h*.68-1.25,z+d/2+.15,1.7,.18,.4);
      box(M.wood,x+xx+.6,h*.68,z+d/2+.12,.16,2.3,.13);
    }
    box(M.wood,x,.0+1.7,z+d/2+.06,1.8,3.4,.14);
    if(random()>.45)tree(x+w/2+4,z,8+random()*8);
  }
  // Additional monumental silhouettes beyond the turn.
  for(const x of [-130,-40,60,160]){
    const z=355+random()*35;box(M.stone,x,3,z,31,6,43);
    for(const xx of [-12,-6,0,6,12])for(const zz of [-18,18])column(x+xx,6,z+zz,11,.65);
    box(M.marble,x,17.5,z,32,1,43);roof(x,18,z,34,5,45);
  }
  // Pebbles and fragments collect at the track edges, clear of the racing line.
  for(let i=0;i<650;i++){
    const side=i%2?1:-1,z=START+random()*(TURN-START),x=side*(46.4+random()*1.35),s=.035+random()*.10;
    add(sphere,M.stone,x,s*.24,z,s,s*.45,s*.8,random()*6.28,.64+random()*.27);
  }
  for(let z=-320;z<370;z+=25)for(const side of [-1,1])tree(side*(230+random()*23),z,10+random()*8);
  // Merge static parts by material: no per-seat or per-column draw calls.
  for(const [mat, parts] of batches){
    const total=parts.reduce((n,g)=>n+g.attributes.position.count,0),merged=new T.BufferGeometry();
    for(const [name,size]of [['position',3],['normal',3],['uv',2],['color',3]]){
      const values=new Float32Array(total*size);let offset=0;
      for(const g of parts){values.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}
      merged.setAttribute(name,new T.BufferAttribute(values,size));
    }
    const mesh=new T.Mesh(merged,mat);mesh.name=mat.name;mesh.castShadow=![M.sand,M.ground,M.water,M.mosaic].includes(mat);mesh.receiveShadow=true;
    merged.computeBoundingSphere();group.add(mesh);parts.forEach(g=>g.dispose());
  }
  const spectators=[];
  const palette=[0x824846,0xb8a788,0xddd3b9,0x536b75,0x6c7759,0x987151,0xb9b4a4,0x454d54];
  function person(x,y,z,angle){if(random()<.23)return; spectators.push({x,y,z,angle,color:palette[Math.floor(random()*palette.length)],skin:[0x9a775b,0xbb9471,0x755342,0xd2ad87][Math.floor(random()*4)]});}
  for(let row=1;row<ROWS-1;row++){
    const r=50+(row+.5)*STEP,y=3.7+row*RISE;
    for(const side of [-1,1])for(let z=START+1.6;z<TURN-1;z+=1.65){
      if((z-START)%23.8<1.7 || (side===1&&z>-108&&z<-36&&row<18))continue;
      person(side*r,y,z+random()*.4,side*Math.PI/2);
    }
    const count=Math.floor(Math.PI*r/1.6);
    for(let i=0;i<count;i++){
      const a=(i+.5)/count*Math.PI;if(Math.abs((a/Math.PI*15)%1-.5)>.44)continue;
      person(Math.cos(a)*r,y,TURN+Math.sin(a)*r,Math.PI/2-a);
    }
  }
  if(textures.spectators){
    // Eight alpha-cutout seated people, one instanced draw call. Cylindrical
    // billboards retain human width from all four cameras; no stacked image layers.
    const g=new T.PlaneGeometry(1.04,1.48),offsets=new Float32Array(spectators.length*2);
    const m=new T.MeshLambertMaterial({map:textures.spectators,alphaTest:.42,side:T.DoubleSide,color:0xf2ede5});
    m.name='Photographic spectator atlas';
    m.onBeforeCompile=s=>{
      s.vertexShader='attribute vec2 atlasOffset;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
        vMapUv=(vMapUv*vec2(.966,.978)+vec2(.017,.011))*vec2(.25,.5)+atlasOffset;
      `).replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        objectNormal=vec3(0.0,1.0,0.0);
      `).replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 center=(modelMatrix*instanceMatrix*vec4(0,0,0,1)).xyz;
        vec3 toEye=cameraPosition-center;
        vec3 right=normalize(vec3(toEye.z,0.0,-toEye.x));
        // A gentle tilt, capped at 30 degrees, keeps the overhead view legible.
        float tilt=clamp(toEye.y/max(length(toEye.xz),.001),0.0,.57);
        vec3 up=normalize(vec3(-normalize(toEye.xz).x*tilt,1.0,-normalize(toEye.xz).y*tilt));
        transformed=right*position.x+up*position.y;
      `);
    };
    m.customProgramCacheKey=()=> 'circus142-crowd-atlas';
    const mesh=new T.InstancedMesh(g,m,spectators.length);mesh.name='Seated spectators';
    spectators.forEach((p,i)=>{
      const tile=Math.floor(random()*8);offsets[i*2]=(tile%4)*.25;offsets[i*2+1]=Math.floor(tile/4)*.5;
      dummy.position.set(p.x,p.y+.48,p.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(.91+random()*.17);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      const tint=.78+random()*.21;mesh.setColorAt(i,new T.Color().setRGB(tint,tint,tint));
    });
    g.setAttribute('atlasOffset',new T.InstancedBufferAttribute(offsets,2));
    mesh.computeBoundingSphere();mesh.castShadow=false;mesh.receiveShadow=true;crowd.add(mesh);
  }else{
    // Keep a usable crowd if the optional atlas fails to load.
    const tunic=new T.CylinderGeometry(.16,.27,.6,4,1,true),head=new T.OctahedronGeometry(.18,0);
    const crowdMat=new T.MeshLambertMaterial({color:0xffffff});crowdMat.name='Fallback spectators';
    for(const [g,offset,name]of [[tunic,.39,'Tunics'],[head,.87,'Heads']]){
      const mesh=new T.InstancedMesh(g,crowdMat,spectators.length);mesh.name=name;
      spectators.forEach((p,i)=>{dummy.position.set(p.x,p.y+offset,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color(name==='Heads'?p.skin:p.color));});
      mesh.computeBoundingSphere();mesh.castShadow=false;crowd.add(mesh);
    }
  }
  crowd.visible=options.crowd!==false;group.add(crowd);
  ownGeometries.forEach(g=>g.dispose());
  group.userData={version:142,kind:'artistic-reconstruction',spectators:spectators.length,startingGates:12,rows:ROWS,photoCrowd:!!textures.spectators};
  return {group,crowd,materials:M,treePlacements,metadata:group.userData};
});
