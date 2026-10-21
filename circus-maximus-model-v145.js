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
  const sculptures = options.sculptures || {};
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
    marble: material('Honed veined marble', 0xe7e0d2, { map:textures.marble||null, normalMap: textures.plasterNormal || null, normalScale: new T.Vector2(.045,.045), roughness:.58 }),
    ashlar: material('Dressed travertine blocks',0xe9e2d2,{map:textures.plaster||null,normalMap:textures.plasterNormal||null,normalScale:new T.Vector2(.23,.23),roughnessMap:textures.plasterRough||null}),
    relief: material('Carved Roman stone panels',0xeee8dc,{map:textures.relief||null,roughness:.88}),
    shade: material('Recessed masonry', 0xa39c8e, { map: textures.stone || null, normalMap: textures.stoneNormal || null, normalScale: new T.Vector2(.45,.45) }),
    plaster: material('Lime plaster', 0xe6dbc4, { map: textures.plaster || null, normalMap: textures.plasterNormal || null, normalScale: new T.Vector2(.48,.48), roughnessMap: textures.plasterRough || null }),
    red: material('Worn Pompeian plaster', 0x8a443a, { map: textures.plaster || null, normalMap: textures.plasterNormal || null, normalScale: new T.Vector2(.4,.4) }),
    roof: material('Weathered terracotta tiles', 0xe0b391, { map: textures.roof || null, normalMap: textures.roofNormal || null, normalScale: new T.Vector2(.85,.85), roughnessMap: textures.roofRough || null }),
    gold: material('Aged bronze', 0x9b8055, { metalness: .72, roughness: .54 }),
    granite: material('Rose granite', 0xd8aa8f, {map:textures.plaster||null,normalMap:textures.plasterNormal||null,normalScale:new T.Vector2(.28,.28)}),
    mosaic: material('Inlaid stone floor',0xbfa89b,{map:textures.plaster||null,normalMap:textures.plasterNormal||null,normalScale:new T.Vector2(.12,.12),roughness:.65}),
    teal: material('Patinated bronze', 0x527c76, { metalness:.65,roughness:.68 }),
    wood: material('Cedar gates', 0xc5ae91, { map: textures.wood || null, normalMap: textures.woodNormal || null, normalScale: new T.Vector2(.35,.35), roughnessMap: textures.woodRough || null }),
    water: new T.MeshPhysicalMaterial({name:'Shallow basin water',color:0x7e9b8d,vertexColors:true,roughness:.085,metalness:0,ior:1.333,clearcoat:.4,clearcoatRoughness:.12,transparent:true,opacity:.78,depthWrite:false,side:T.DoubleSide}),
    sand: material('Rutted track sand', 0xf4eadb, { map: textures.sand || null, roughness:1 }),
    ground: material('Dry earth and grass', 0xc4c1a7, { map: textures.sand || null, normalMap: textures.sandNormal || null, normalScale:new T.Vector2(.35,.35) }),
    paving: material('Exterior paving', 0xbbb5a6, { map:textures.stone || null, normalMap:textures.stoneNormal || null, normalScale:new T.Vector2(.7,.7), roughnessMap:textures.stoneRough || null }),
    tree: material('Cypress foliage', 0x4b6040),
    trunk: material('Tree bark', 0x72634e),
    rope: material('Hemp rigging',0xa18f72,{roughness:1}),
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
    vec2 randomUV(vec2 uv,vec2 id){
      float a=hash21(id+17.3)*6.2831853,c=cos(a),s=sin(a);
      return mat2(c,s,-s,c)*uv*(.79+hash21(id+5.7)*.43)+vec2(hash21(id),hash21(id+9.1))*37.0;
    }
    vec4 sandSample(sampler2D tex,vec2 uv){
      // Three independently rotated samples on a triangular lattice: no square tiles.
      vec2 q=mat2(1.0,0.0,-.57735027,1.15470054)*uv*.71,id=floor(q),f=fract(q);
      vec2 a=id,b=id+vec2(1,0),c=id+vec2(0,1);vec3 w=vec3(1.0-f.x-f.y,f.x,f.y);
      if(f.x+f.y>1.0){a=id+1.0;w=vec3(f.x+f.y-1.0,1.0-f.y,1.0-f.x);}
      w=pow(max(w,vec3(0.0)),vec3(3.0));w/=max(dot(w,vec3(1)),.0001);
      return texture2D(tex,randomUV(uv,a))*w.x+texture2D(tex,randomUV(uv,b))*w.y+texture2D(tex,randomUV(uv,c))*w.z;
    }
    float trackDistance(vec2 p){return length(vec2(p.x,max(abs(p.y-5.5)-207.5,0.0)));}
    float rutHeight(vec2 p){
      float d=trackDistance(p), wear=smoothstep(10.0,14.0,d)*(1.0-smoothstep(43.0,47.0,d));
      vec3 centers=vec3(17.3,28.8,39.2)+vec3(.8,-1.2,.65)*sin(p.y*.021+vec3(1,4,8));
      centers+=vec3(noise21(p*.035),noise21(p*.019+13.0),noise21(p*.028-8.0))*.7;
      vec3 pairs=abs(abs(vec3(d)-centers)-vec3(.61,.57,.68));
      float pair=min(pairs.x,min(pairs.y,pairs.z)),width=max(.045,fwidth(d)*.7);
      float broken=smoothstep(.24,.7,fbm(vec2(p.y*.063,d*.52)));
      return -.018*(1.0-smoothstep(width,width+.16,pair))*wear*broken;
    }
    float hoofHeight(vec2 p){
      vec2 q=p*vec2(.7,1.1),id=floor(q),f=fract(q)-.5;
      f-=vec2(hash21(id+3.0)-.5,hash21(id+7.0)-.5)*.45;
      float a=hash21(id)*2.0-1.0;f=mat2(cos(a),sin(a),-sin(a),cos(a))*f;
      float mark=1.0-smoothstep(.6,1.0,length(f/vec2(.11,.20)));
      float use=smoothstep(12.0,16.0,trackDistance(p))*(1.0-smoothstep(44.0,47.0,abs(p.x)));
      return -.012*mark*step(.91,hash21(id+41.0))*use;
    }
    float sandHeight(vec2 p){
      float grainVisibility=1.0-smoothstep(.25,1.1,max(fwidth(p.x*18.0),fwidth(p.y*18.0)));
      return rutHeight(p)+hoofHeight(p)+.012*fbm(p*1.7)+.0015*noise21(p*18.0)*grainVisibility;
    }
  `;
  for(const mat of [M.sand,M.stone,M.marble,M.ashlar,M.granite,M.shade,M.plaster,M.red,M.ground,M.roof,M.paving,M.water,M.wood,M.gold,M.teal,...[M.cream,M.burgundy,M.blue,M.green]]){
    mat.onBeforeCompile=s=>{
      s.vertexShader='varying vec3 vSurfaceWorld;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSurfaceWorld=(modelMatrix*vec4(position,1.0)).xyz;');
      s.fragmentShader='varying vec3 vSurfaceWorld;\n'+noiseGLSL+s.fragmentShader;
      let detail='';
      if(mat===M.sand){
        // Keep the photographed grain; use a second scale only to break macro repetition.
        s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
          vec3 grain=sandSample(map,vMapUv*.72).rgb;
          float luminance=dot(grain,vec3(.2126,.7152,.0722));
          diffuseColor.rgb*=mix(vec3(luminance),grain,.65)*1.08;
        #endif`);
        detail=`
          vec2 p=vSurfaceWorld.xz;float d=trackDistance(p),macro=fbm(p*.027+fbm(p*.009)*4.0);
          float lane=smoothstep(10.0,15.0,d)*(1.0-smoothstep(42.0,47.0,d));
          diffuseColor.rgb*=mix(vec3(.79,.82,.84),vec3(1.12,1.075,.98),smoothstep(.17,.8,macro));
          diffuseColor.rgb*=mix(.95,1.045,fbm(p*.71))*(1.0-.075*lane);
          float rut=rutHeight(p);
          diffuseColor.rgb*=1.0+rut*4.0+hoofHeight(p)*7.0;
          float fine=noise21(p*37.0),filterGrain=1.0-smoothstep(.3,1.4,max(fwidth(p.x*37.0),fwidth(p.y*37.0)));
          diffuseColor.rgb*=1.0+(fine-.5)*.11*filterGrain;
          float edge=1.0-smoothstep(0.0,1.6,abs(d-47.8));
          float spina=(1.0-smoothstep(4.5,6.3,abs(p.x)))*(1.0-smoothstep(208.0,215.0,abs(p.y-4.0)));
          diffuseColor.rgb*=1.0-.12*max(edge,spina)*(0.65+fbm(p*.7));
          float gateWear=(1.0-smoothstep(-243.0,-213.0,p.y))*(1.0-smoothstep(42.0,47.0,abs(p.x)));
          float disturbed=fbm(vec2(p.x*.17,p.y*.55));diffuseColor.rgb*=1.0-gateWear*.15*disturbed;
        `;
        const normals=T.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv )','sandSample( normalMap, vNormalMapUv )');
        const roughness=T.ShaderChunk.roughnessmap_fragment.replace('texture2D( roughnessMap, vRoughnessMapUv )','sandSample( roughnessMap, vRoughnessMapUv )');
        s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',roughness);
        s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',normals+`
          float h=sandHeight(vSurfaceWorld.xz);
          #ifdef USE_MAP
          h+=.018*luminance;
          #endif
          vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);
          vec3 r1=cross(sy,normal),r2=cross(normal,sx);float det=dot(sx,r1);
          vec3 grad=sign(det)*(dFdx(h)*r1+dFdy(h)*r2);
          normal=normalize(abs(det)*normal-grad);
        `);
      }else if(mat===M.water){
        detail=`float edge=smoothstep(2.3,3.3,abs(vSurfaceWorld.x));diffuseColor.rgb*=mix(vec3(.78,.93,.86),vec3(.53,.64,.52),edge);diffuseColor.a=mix(.67,.88,edge);`;
        s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          float nearest=min(min(abs(vSurfaceWorld.z+159.0),abs(vSurfaceWorld.z+50.0)),min(abs(vSurfaceWorld.z-76.0),abs(vSurfaceWorld.z-161.0)));
          float radius=length(vec2(vSurfaceWorld.x,nearest));
          float ripple=.004*sin(radius*15.0)*exp(-radius*.65);
          float wave=ripple+.008*sin(vSurfaceWorld.x*3.7+vSurfaceWorld.z*1.3+noise21(vSurfaceWorld.xz)*2.0)+.006*fbm(vSurfaceWorld.xz*4.0);
          vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),r1=cross(sy,normal),r2=cross(normal,sx);float det=dot(sx,r1);
          normal=normalize(abs(det)*normal-sign(det)*(dFdx(wave)*r1+dFdy(wave)*r2));
        `);
      }else if(mat===M.ground){
        s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
          diffuseColor.rgb*=sandSample(map,vMapUv).rgb;
        #endif`);
        s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',T.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vNormalMapUv )','sandSample( normalMap, vNormalMapUv )'));
        detail=`float macro=fbm(vSurfaceWorld.xz*.011);diffuseColor.rgb*=mix(vec3(.73,.81,.59),vec3(1.03,.96,.81),smoothstep(.20,.79,macro));`;
      }else if(mat===M.marble){
        s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
          diffuseColor.rgb*=sandSample(map,vMapUv*.8).rgb;
        #endif`);
        detail=`vec2 p=vec2(vSurfaceWorld.x+vSurfaceWorld.z*.31,vSurfaceWorld.y+vSurfaceWorld.z*.17);diffuseColor.rgb*=mix(.94,1.025,fbm(p*.35));`;
      }else if(mat===M.ashlar){
        detail=`
          vec2 p=vec2((vSurfaceWorld.x+vSurfaceWorld.z)*.43,vSurfaceWorld.y*1.35);
          float row=floor(p.y);p.x+=mod(row,2.0)*.5;
          vec2 f=fract(p),fw=fwidth(p);vec2 joint=1.0-smoothstep(vec2(.012),vec2(.025)+fw,min(f,1.0-f));
          float seams=max(joint.x,joint.y),block=hash21(floor(p));
          diffuseColor.rgb*=mix(.91,1.06,block)*(1.0-seams*.28);
          float base=1.0-smoothstep(.15,2.5,vSurfaceWorld.y);diffuseColor.rgb*=1.0-base*.17;
        `;
        s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec2 bp=vec2((vSurfaceWorld.x+vSurfaceWorld.z)*.43,vSurfaceWorld.y*1.35);bp.x+=mod(floor(bp.y),2.0)*.5;
          vec2 bf=fract(bp),bw=fwidth(bp);vec2 bj=1.0-smoothstep(vec2(.012),vec2(.025)+bw,min(bf,1.0-bf));
          float h=-.018*max(bj.x,bj.y);vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),r1=cross(sy,normal),r2=cross(normal,sx);float det=dot(sx,r1);
          normal=normalize(abs(det)*normal-sign(det)*(dFdx(h)*r1+dFdy(h)*r2));
        `);
      }else if(mat===M.granite){
        detail=`float flecks=noise21(vSurfaceWorld.xz*95.0+vSurfaceWorld.y*vec2(71.0,37.0));diffuseColor.rgb*=mix(.78,1.13,flecks);`;
      }else if([M.cream,M.burgundy,M.blue,M.green].includes(mat)){
        detail=`vec2 p=vec2(vSurfaceWorld.x+vSurfaceWorld.z,vSurfaceWorld.y)*35.0;float weave=sin(p.x)*sin(p.y);float visible=1.0-smoothstep(.4,1.3,max(fwidth(p.x),fwidth(p.y)));diffuseColor.rgb*=.93+.045*weave*visible+.07*noise21(vSurfaceWorld.xz*.5);`;
        s.vertexShader='varying vec2 clothUV;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nclothUV=uv;');
        s.fragmentShader='varying vec2 clothUV;\n'+s.fragmentShader;
        detail+=`vec2 hem=min(clothUV,1.0-clothUV);float border=1.0-smoothstep(.015,.035,min(hem.x,hem.y));float seam=1.0-smoothstep(.001,.006,abs(clothUV.x-.5));diffuseColor.rgb*=1.0-.17*border-.055*seam;diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.11,1.08,1.03),noise21(vSurfaceWorld.xz*.14)*.45);`;
      }else if(mat===M.roof){
        detail=`vec2 tile=floor(vSurfaceWorld.xz*vec2(2.2,1.3));float kiln=hash21(tile);diffuseColor.rgb*=mix(vec3(.81,.84,.86),vec3(1.10,1.01,.91),kiln);diffuseColor.rgb*=mix(.88,1.08,fbm(vSurfaceWorld.xz*.23));`;
      }else if(mat===M.wood){
        detail=`float board=floor(vSurfaceWorld.x*3.3);float grain=noise21(vec2(vSurfaceWorld.x*32.0,vSurfaceWorld.y*.55+vSurfaceWorld.z*.1));diffuseColor.rgb*=mix(.9,1.17,hash21(vec2(board,floor(vSurfaceWorld.z*.2))))*(.94+.13*grain);float wear=smoothstep(.5,.8,fbm(vSurfaceWorld.xy*.8));diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.35,1.22,1.08),wear*.3);`;
      }else if(mat===M.gold||mat===M.teal){
        detail=`float oxide=smoothstep(.46,.77,fbm(vSurfaceWorld.xz*2.3+vSurfaceWorld.y*.4));diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.43,.76,.65),oxide*.7);diffuseColor.rgb*=mix(.9,1.04,noise21(vSurfaceWorld.xz*7.0+vSurfaceWorld.y*vec2(9.0,13.0)));`;
        s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec2 p=vSurfaceWorld.xz+vSurfaceWorld.y*vec2(.73,.41);float h=.008*fbm(p*8.0)+.004*fbm(p*31.0);
          vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition),r1=cross(sy,normal),r2=cross(normal,sx);float det=dot(sx,r1);
          normal=normalize(abs(det)*normal-sign(det)*(dFdx(h)*r1+dFdy(h)*r2));
        `);
      }else{
        detail=`
          float low=1.0-smoothstep(.15,2.3,vSurfaceWorld.y);
          float stain=fbm(vec2((vSurfaceWorld.x+vSurfaceWorld.z)*.72,vSurfaceWorld.y*.12));
          diffuseColor.rgb*=mix(.87,1.04,stain)*(1.0-.20*low);
          float deposits=smoothstep(.47,.76,fbm(vSurfaceWorld.xz*.47))*low;
          diffuseColor.rgb*=mix(vec3(1),vec3(.75,.79,.67),deposits*.5);
        `;
        if(mat===M.stone||mat===M.shade)detail+=`vec2 blocks=vec2((vSurfaceWorld.x+vSurfaceWorld.z)*1.15,vSurfaceWorld.y*2.0);blocks.x+=mod(floor(blocks.y),2.0)*.5;float block=hash21(floor(blocks));diffuseColor.rgb*=mix(.91,1.055,block);`;
      }
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+detail);
    };
    mat.customProgramCacheKey=()=> 'circus145-'+mat.name;
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
    const texScale = mat === M.sand ? .66 : mat === M.marble ? .5 : mat === M.roof ? .25 : mat === M.ground ? .17 : mat === M.paving ? .28 : mat===M.stone?.24:.5;
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
  function rod(mat,a,b,r=.04){
    const av=new T.Vector3(...a),bv=new T.Vector3(...b),delta=bv.clone().sub(av);
    // Sub-pixel rigging needs a silhouette, not hidden end caps.
    const g=new T.CylinderGeometry(r,r,delta.length(),3,1,true);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
    const c=av.add(bv).multiplyScalar(.5);add(g,mat,c.x,c.y,c.z);g.dispose();
  }
  function geo(positions, indices, uv) {
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    if (indices) g.setIndex(indices);
    if (uv) g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals(); ownGeometries.add(g); return g;
  }
  // Local X is the frontage; local Z points out of the building.
  function archGeometry(width, spring, thickness, depth, detailed=false) {
    const r = width / 2, shape = new T.Shape();
    shape.moveTo(-r - thickness, 0); shape.lineTo(-r - thickness, spring);
    shape.absarc(0, spring, r + thickness, Math.PI, 0, true);
    shape.lineTo(r + thickness, 0); shape.lineTo(r, 0); shape.lineTo(r, spring);
    shape.absarc(0, spring, r, 0, Math.PI, false); shape.lineTo(-r, 0); shape.closePath();
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled:detailed, bevelSize:.06, bevelThickness:.06, bevelSegments:1, curveSegments:detailed?10:7 });
    g.translate(0, 0, -depth / 2); ownGeometries.add(g); return g;
  }
  const arcade = archGeometry(4.8, 3.5, .72, 7.2), upperArcade = archGeometry(4.2, 2.65, .7, 1.1), gateArch = archGeometry(5.3, 4.5, .9, 2.4,true);
  function archedSlab(width,spring,depth=.12){
    const shape=new T.Shape(),r=width/2;shape.moveTo(-r,0);shape.lineTo(r,0);shape.lineTo(r,spring);shape.absarc(0,spring,r,0,Math.PI,false);shape.lineTo(-r,0);
    const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:10});g.translate(0,0,-depth/2);ownGeometries.add(g);return g;
  }
  const lowerRecess=archedSlab(4.75,3.5),upperRecess=archedSlab(4.15,2.65),doorLeaf=archedSlab(5.1,4.45,.20);
  const tunnelArch=archGeometry(3.5,2.2,.45,1.1,true),tunnelMouth=archedSlab(3.45,2.2,.1);
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
  const columnShaft=new T.LatheGeometry([[.98,0],[1.0,.28],[.94,.64],[.83,1]].map(([x,y])=>new T.Vector2(x,y)),20);
  const leaf=new T.IcosahedronGeometry(1,0);ownGeometries.add(leaf);
  const capital=new T.LatheGeometry([[.86,0],[.87,.12],[1.02,.25],[1.16,.52],[1.35,.69],[1.4,.8]].map(([x,y])=>new T.Vector2(x,y)),16);ownGeometries.add(capital);
  const cp=columnShaft.attributes.position;
  for(let i=0;i<cp.count;i++){const a=Math.atan2(cp.getZ(i),cp.getX(i)),f=1-.026*(.5+.5*Math.cos(a*10));cp.setXYZ(i,cp.getX(i)*f,cp.getY(i),cp.getZ(i)*f);}
  columnShaft.computeVertexNormals();ownGeometries.add(columnShaft);
  const farShaft=new T.LatheGeometry([[.98,0],[.97,.35],[.9,.7],[.83,1]].map(([x,y])=>new T.Vector2(x,y)),12);ownGeometries.add(farShaft);
  function column(x, y, z, h, r = .48, mat = M.marble) {
    add(r>=.6?columnShaft:r>=.45?farShaft:tapered,mat,x,y+(r>=.45?.3:h/2),z,r,r>=.45?h-.9:h,r);
    box(mat, x, y + .16, z, r * 2.8, .32, r * 2.8);
    box(mat, x, y + h - .18, z, r * 2.9, .36, r * 2.9);
    add(cylinder, mat, x, y + h - .54, z, r * 1.28, .24, r * 1.28);
    if(r>=.45){
      add(cylinder,mat,x,y+.4,z,r*1.18,.2,r*1.18);
      const ornate=r>=.6||Math.abs(x)<5;
      if(ornate)add(capital,mat,x,y+h-1.06,z,r,.9,r);else add(tapered,mat,x,y+h-.63,z,r*1.13,.35,r*1.13);
      // Raised acanthus leaves and projecting volutes, reserved for close architecture.
      for(let k=0;ornate&&k<8;k++){const a=k*Math.PI/4;add(leaf,mat,x+Math.cos(a)*r*.96,y+h-.64,z+Math.sin(a)*r*.96,r*.22,.34,r*.15,a,.96);}
    }
  }
  function relief(x,y,z,size,tile=0,angle=0){
    // The atlas is a photographic surface; its stone frame has actual depth.
    const g=new T.PlaneGeometry(1,1),uv=g.attributes.uv;
    const ox=(tile%2)*.5,oy=tile<2?.5:0;
    for(let i=0;i<uv.count;i++)uv.setXY(i,ox+.012+uv.getX(i)*.476,oy+.012+uv.getY(i)*.476);
    add(g,M.relief,x,y,z,size,size,1,angle,1,false);g.dispose();
    for(const side of [-1,1]){
      const dx=side*(size/2+.11)*Math.cos(angle),dz=-side*(size/2+.11)*Math.sin(angle);
      box(M.marble,x+dx,y,z+dz,.18,size+.4,.24,angle);
      box(M.marble,x,y+side*(size/2+.11),z,size+.4,.18,.24,angle);
    }
  }
  const robe=new T.LatheGeometry([[.32,0],[.38,.12],[.35,.45],[.28,.9],[.29,1.3],[.40,1.55],[.29,1.67]].map(([x,y])=>new T.Vector2(x,y)),16);
  const rp=robe.attributes.position;
  for(let i=0;i<rp.count;i++){const a=Math.atan2(rp.getZ(i),rp.getX(i)),f=1+.095*Math.sin(a*9+rp.getY(i)*1.4);rp.setXYZ(i,rp.getX(i)*f,rp.getY(i),rp.getZ(i)*f);}
  robe.computeVertexNormals();ownGeometries.add(robe);
  const statueHead=new T.SphereGeometry(1,12,8);ownGeometries.add(statueHead);
  function statue(x,y,z,scale=1){
    if(sculptures.figure){
      box(M.marble,x,y+.44*scale,z,1.75*scale,.88*scale,1.75*scale);
      box(M.marble,x,y+.92*scale,z,1.9*scale,.14*scale,1.9*scale);
      add(sculptures.figure,M.marble,x,y+scale,z,2.55*scale,2.55*scale,2.55*scale,x>20?-Math.PI/2:0);
      return;
    }
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
  function bust(x,y,z,h=1.7,angle=0){
    if(sculptures.bust)add(sculptures.bust,M.marble,x,y,z,h,h,h,angle);
    else statue(x,y,z,h*.36);
  }
  function horse(x,y,z,h=3.2,angle=0){
    if(sculptures.horse)add(sculptures.horse,M.gold,x,y,z,h,h,h,angle);
    else bust(x,y,z,h*.5,angle);
  }
  function lathe(points,segments=24){const g=new T.LatheGeometry(points.map(([x,y])=>new T.Vector2(x,y)),segments);ownGeometries.add(g);return g;}
  function drape(x,y,z,w,h,angle,mat=M.burgundy){
    const p=[],uv=[],ix=[];
    for(let j=0;j<=12;j++)for(let i=0;i<=16;i++){
      const u=i/16,v=j/12,fold=Math.sin(u*Math.PI*10)*(.13+.16*v)+Math.sin(u*Math.PI*20)*.035;
      p.push((u-.5)*w*(1-.20*Math.sin(v*Math.PI)), -v*h+.12*Math.sin(u*31)*v,fold);uv.push(u,v);
      if(j<12&&i<16){const k=j*17+i;ix.push(k,k+17,k+1,k+1,k+17,k+18);}
    }
    add(geo(p,ix,uv),mat,x,y,z,1,1,1,angle,1,false);
    rod(M.gold,[x-Math.cos(angle)*w*.55,y+.12,z+Math.sin(angle)*w*.55],[x+Math.cos(angle)*w*.55,y+.12,z-Math.sin(angle)*w*.55],.07);
  }
  function urn(x,y,z,size=.7,mat=M.roof){
    const g=lathe([[.2,0],[.25,.12],[.42,.4],[.43,.68],[.18,.94],[.24,1.09],[.24,1.16],[.14,1.16]],8);
    add(g,mat,x,y,z,size,size,size);
    for(const side of [-1,1]){const curve=new T.CatmullRomCurve3([new T.Vector3(side*.17,.96,0),new T.Vector3(side*.5,.87,0),new T.Vector3(side*.46,.64,0),new T.Vector3(side*.36,.51,0)]);const handle=new T.TubeGeometry(curve,4,.035,3,false);add(handle,mat,x,y,z,size,size,size);handle.dispose();}
  }
  const START = -244, TURN = 232, INNER = 48, ROWS = 28, STEP = .82, RISE = .59, OUTER = 76;
  function earthNoise(x,z){
    const ix=Math.floor(x),iz=Math.floor(z),f=x-ix,g=z-iz,u=f*f*(3-2*f),v=g*g*(3-2*g);
    const h=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n);};
    return T.MathUtils.lerp(T.MathUtils.lerp(h(ix,iz),h(ix+1,iz),u),T.MathUtils.lerp(h(ix,iz+1),h(ix+1,iz+1),u),v);
  }
  function sandElevation(x,z,d){
    const rim=Math.exp(-Math.pow((d-47.5)/.85,2));
    return .018+.045*earthNoise(x*.15,z*.09)+.025*earthNoise(x*.51,z*.28)+rim*(.07+.09*earthNoise(x*.9,z*.7));
  }
  const passageCenters=Array.from({length:5},(_,i)=>START+(i*4+1.5)*23.8);
  const paths = [];
  for (let side of [-1, 1]) {
    for (let z = START + 4; z < TURN; z += 8) paths.push({ x: side * OUTER, z, angle: side * Math.PI / 2, side });
  }
  for (let i = 0; i < 30; i++) {
    const a = (i + .5) / 30 * Math.PI;
    paths.push({ x: Math.cos(a) * OUTER, z: TURN + Math.sin(a) * OUTER, angle: Math.PI / 2 - a, curve: true });
  }
  // Continuous U-shaped podium, with the carceres closing the other end.
  function ringStrip(r0,r1,y,height,mat,segments=90,center=TURN,sign=1) {
    const p = [], ix = [];
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI, c = Math.cos(a), s = Math.sin(a);
      p.push(c*r0,y,center+sign*s*r0,c*r1,y,center+sign*s*r1,c*r0,y+height,center+sign*s*r0,c*r1,y+height,center+sign*s*r1);
    }
    for (let i = 0; i < segments; i++) {
      const a = i * 4, b = a + 4;
      ix.push(a+2,b+2,b+3,a+2,b+3,a+3, a,b,b+2,a,b+2,a+2, a+1,a+3,b+3,a+1,b+3,b+1);
    }
    if(sign<0)for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];
    const g = geo(p, ix); add(g, mat, 0, 0, 0);
  }
  const earth = new T.PlaneGeometry(3600,3600,48,48); earth.rotateX(-Math.PI/2);
  const ep = earth.attributes.position;
  for(let i=0;i<ep.count;i++){
    const x=ep.getX(i),z=ep.getZ(i),edge=T.MathUtils.smoothstep(Math.max(Math.abs(x)/290,Math.abs(z)/480),1,2.6);
    ep.setY(i,-.4+edge*(38+18*Math.sin(x*.007+z*.004)+17*Math.cos(z*.013)));
  }
  earth.computeVertexNormals();ownGeometries.add(earth);add(earth,M.ground,0,0,0);
  const track=new T.PlaneGeometry(INNER*2,TURN-START,48,238);track.rotateX(-Math.PI/2);
  const tp=track.attributes.position;
  for(let i=0;i<tp.count;i++){
    const x=tp.getX(i),z=tp.getZ(i),edge=Math.min(1,(INNER-Math.abs(x))*.7,(z+(TURN-START)/2)*.7);
    tp.setY(i,Math.max(0,edge)*sandElevation(x,z+(START+TURN)/2,Math.abs(x)));
  }
  track.computeVertexNormals();ownGeometries.add(track);add(track,M.sand,0,0,(START+TURN)/2);
  const endP=[],endIX=[];
  for(let r=0;r<=16;r++)for(let a=0;a<=70;a++){const rad=r/16*INNER,angle=a/70*Math.PI,x=Math.cos(angle)*rad,z=Math.sin(angle)*rad;endP.push(x,sandElevation(x,z+TURN,rad)*Math.min(1,(INNER-rad)*.7),z);if(r<16&&a<70){const k=r*71+a;endIX.push(k,k+1,k+71,k+1,k+72,k+71);}}
  add(geo(endP,endIX),M.sand,0,0,TURN);
  for (const side of [-1, 1]) {
    box(M.shade,side*59.1,1.2,-6,21,2.4,476);
    box(M.stone, side * 48.8, 1.8, -6, 1.6, 3.6, 476);
    box(M.red, side * 47.94, 2.65, -6, .1, .62, 476);
    box(M.marble, side * 48.6, 3.6, -6, 2.1, .28, 476);
    box(M.marble,side*47.91,.22,-6,.22,.44,476);
    box(M.marble,side*47.91,2.23,-6,.16,.16,476);
    for(let z=START+12;z<TURN;z+=23.8){
      box(M.marble,side*47.86,1.82,z,.28,3.2,.65);
      box(M.shade,side*47.78,.38,z+5,.035,.28,.48);
    }
    for(let z=START+9;z<TURN-5;z+=11.9){
      box(M.red,side*47.91,1.25,z,.025,1.18,9.7,0,.78+random()*.17);
      box(M.marble,side*47.83,.63,z,.15,.11,9.8);
      box(M.marble,side*47.83,1.86,z,.15,.12,9.8);
      for(const dz of [-4.95,4.95])box(M.marble,side*47.81,1.25,z+dz,.19,1.35,.16);
      for(let dz=-.5;dz<=.5;dz+=.25)box(M.gold,side*47.7,.37,z+dz,.09,.3,.055);
      box(M.shade,side*47.77,.37,z,.025,.35,1.35);
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
        if(side===1&&z+11.1>-93.5&&z-11.1<-50.5){
          for(const [a,b]of [[z-11.1,Math.min(z+11.1,-93.5)],[Math.max(z-11.1,-50.5),z+11.1]])if(b>a)box(M.stone,r+STEP/2,y-.42,(a+b)/2,STEP,.84,b-a,0,.92);
          continue;
        }
        if(section%4===1&&row>=9&&row<=15){
          for(const dz of [-6.65,6.65])box(M.stone,side*(r+STEP/2),y-.42,z+dz,STEP,.84,8.9,0,.9+random()*.08);
        }else box(M.stone,side*(r+STEP/2),y-.42,z,STEP,.84,22.2,0,.88+random()*.12);
      }
    }
    ringStrip(r,r+STEP,y-.82,.82,M.stone,72);
    if(row===0||row===8||row===18){
      for(const side of [-1,1])for(let k=0;k<20;k++){
        const z=START+(k+.5)*23.8;if(side===1&&z+11.1>-93.5&&z-11.1<-50.5)continue;
        box(M.marble,side*(r+.77),y+.32,z,.13,.64,21.7,0,.9);
      }
    }
    if(row<8)for(const side of [-1,1])for(let k=0;k<20;k++){
      const z=START+(k+.5)*23.8;if(side===1&&z+11.1>-93.5&&z-11.1<-50.5)continue;
      box(M.marble,side*(r+.08),y+.025,z,.10,.055,22.2,0,1.02);
    }
  }
  for(const side of [-1,1])for(const z of passageCenters){
    if(side===1&&z+11.1>-93.5&&z-11.1<-50.5)continue;
    const ry=-side*Math.PI/2,x=side*57.5;
    add(tunnelArch,M.marble,x,8.7,z,1,1,1,ry);
    add(tunnelMouth,M.shade,side*66.2,8.7,z,1,1,1,ry,.38);
    const vault=archGeometry(3.5,2.2,.45,7.2);
    add(vault,M.ashlar,side*61.3,8.7,z,1,1,1,ry,.76);
    for(let step=0;step<8;step++)box(M.stone,side*(58.2+step*.85),8.66+step*.055,z,.84,.19,3.3,0,.72+step*.018);
    for(const dz of [-2.3,2.3]){box(M.marble,side*56.9,9.25,z+dz,2.2,1.1,.32);box(M.marble,side*56.9,9.84,z+dz,2.4,.14,.48);}
    relief(side*57.0,13.3,z,1.15,side>0?1:3,ry);
    box(M.shade,side*60,8.65,z,6,.2,3.6);
    for(const dz of [-2,2])box(M.ashlar,side*60,10.5,z+dz,5,3.7,.3);
    box(M.marble,side*60.1,12.9,z,5.7,.35,4.2);
  }
  // Stair aisles read as pale stripes between seating blocks.
  for (const side of [-1, 1]) for (let section = 1; section < 20; section++) {
    const z = START + section * 23.8;
    if(side===1&&z>-94.5&&z<-49.5)continue;
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
    const inward=new T.Vector3(-Math.sin(p.angle),0,-Math.cos(p.angle));
    add(arcade,M.stone,p.x+inward.x*2.7,0,p.z+inward.z*2.7,1,1,1,p.angle,.9+random()*.1);
    box(M.paving,p.x+inward.x*3.7,.08,p.z+inward.z*3.7,6,.16,8.4,p.angle,.77);
    box(M.shade,p.x+inward.x*7.3,3.4,p.z+inward.z*7.3,6.3,6.8,.5,p.angle,.65);
    box(M.ashlar,p.x+Math.cos(p.angle)*3.6,3.6,p.z-Math.sin(p.angle)*3.6,1.8,7.2,2.3,p.angle);
    if(!p.curve&&Math.round((p.z-START-4)/8)%6===0){
      box(M.red,p.x+Math.sin(p.angle)*.7,17.7,p.z+Math.cos(p.angle)*.7,3.2,3.2,.1,p.angle,.83);
    }
    add(upperArcade,M.stone,p.x,8.1,p.z,1,1,1,p.angle,.9+random()*.1);
    // Exterior pilasters and the open upper colonnade.
    const tx = Math.cos(p.angle)*3.6, tz = -Math.sin(p.angle)*3.6;
    column(p.x+tx,0,p.z+tz,7.5,.35); column(p.x+tx,8.1,p.z+tz,6.8,.3);
    column(p.x,21.3,p.z,5,.36);
  }
  // Rear exedra: a genuine semicircle, joined to the existing galleries at ±76 m.
  // Its 28.4 m roof ridge matches the long stands, rather than leaving a low skyline.
  const rearBand=(a,b,y,h,m)=>ringStrip(a,b,y,h,m,96,START,-1);
  rearBand(74.5,77.5,0,21.0,M.ashlar);
  rearBand(73.9,78.0,0,.7,M.stone);
  rearBand(73.6,78.1,7.5,.6,M.marble);rearBand(73.6,78.1,14.9,.6,M.marble);
  rearBand(73.2,78.4,20.6,.7,M.marble);rearBand(73.6,77.8,19.9,.65,M.red);
  rearBand(72.9,79.0,26.2,.65,M.marble);
  const rearFloor=new T.CircleGeometry(74.5,80,0,Math.PI);rearFloor.rotateX(-Math.PI/2);ownGeometries.add(rearFloor);add(rearFloor,M.paving,0,-.24,START);
  const roofP=[],roofUV=[],roofIX=[];
  for(let i=0;i<=96;i++){
    const a=i/96*Math.PI;
    for(const [r,y,v]of [[73,26.85,0],[76,28.4,.8],[79,26.85,1.6]]){roofP.push(Math.cos(a)*r,y,START-Math.sin(a)*r);roofUV.push(a*76*.25,v);}
    if(i<96){const k=i*3;roofIX.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);}
  }
  for(let i=0;i<roofIX.length;i+=3)[roofIX[i+1],roofIX[i+2]]=[roofIX[i+2],roofIX[i+1]];
  add(geo(roofP,roofIX,roofUV),M.roof,0,0,0,1,1,1,0,1,false);
  for(let i=0;i<30;i++){
    const a=(i+.5)/30*Math.PI,ry=a-Math.PI/2,c=Math.cos(a),s=Math.sin(a);
    add(arcade,M.marble,c*73.8,.8,START-s*73.8,1,1,1,ry);
    add(upperArcade,M.marble,c*73.8,8.5,START-s*73.8,1,1,1,ry);
    const edge=i/30*Math.PI;
    column(Math.cos(edge)*73.2,.7,START-Math.sin(edge)*73.2,6.8,.46);
    column(Math.cos(edge)*73.2,8.1,START-Math.sin(edge)*73.2,6.6,.43);
    column(c*76,21.3,START-s*76,5,.47);
    box(M.red,c*73.7,12.1,START-s*73.7,3.1,4.7,.24,ry,.84);
    box(M.marble,c*73.6,14.65,START-s*73.6,4.0,.25,.5,ry);
    for(const dx of [-2.1,2.1])column(c*73.4+Math.cos(ry)*dx,15.6,START-s*73.4-Math.sin(ry)*dx,4.8,.24);
    box(M.marble,c*73.5,20.05,START-s*73.5,4.9,.28,.6,ry);
    if(i%5===2){box(M.marble,c*72.9,1.15,START-s*72.9,2.1,1.2,2.1,ry);bust(c*72.9,1.75,START-s*72.9,2.4,ry);}
    if(i%3===1)relief(c*74.36,17.7,START-s*74.36,2.8,Math.floor(i/3)%4,ry);
    // Recessed sandstone panels provide depth inside each blind arch.
    add(lowerRecess,M.shade,c*74.4,.8,START-s*74.4,1,1,1,ry,.8);
    add(upperRecess,M.shade,c*74.4,8.5,START-s*74.4,1,1,1,ry,.9);
  }
  for(const side of [-1,1]){
    box(M.ashlar,side*76,10.5,START-.3,3.5,21,3.1);
    box(M.marble,side*76,26.5,START,5,.65,3.2);
    // The end wall follows the rake of the seats instead of projecting above them.
    const endShape=new T.Shape();
    [[48,0],[75.8,0],[75.8,20.4],[73,20.4],[50,3.7],[48,3.7]].forEach(([x,y],i)=>i?endShape.lineTo(side*x,y):endShape.moveTo(side*x,y));
    endShape.closePath();const endWall=new T.ExtrudeGeometry(endShape,{depth:1.2,bevelEnabled:false});
    ownGeometries.add(endWall);add(endWall,M.ashlar,0,0,START-1.25);
    column(side*73.1,.7,START,6.8,.46);column(side*73.1,8.1,START,6.6,.43);
  }
  const fabric = [M.cream, M.burgundy, M.cream, M.blue, M.cream, M.green];
  for (let i=0;i<paths.length;i++) {
    const p=paths[i]; if (!p.curve && p.side===1 && p.z>-108 && p.z<-36) continue;
    if (i%6===5) continue;
    const pos=[],uv=[],ix=[];
    for(let j=0;j<=7;j++)for(let k=0;k<=4;k++){
      const u=k/4,v=j/7; pos.push((u-.5)*7.45,-1.5*Math.sin(v*Math.PI)-.55*Math.sin(u*Math.PI)+.09*Math.sin(u*19.0)*Math.sin(v*Math.PI),-v*14);
      uv.push(u,v);
    }
    for(let j=0;j<7;j++)for(let k=0;k<4;k++){const a=j*5+k,b=a+5;ix.push(a,b,a+1,b,b+1,a+1);}
    const g=geo(pos,ix,uv); // slope the sail from the back gallery toward the seats
    const a=g.attributes.position;for(let j=0;j<a.count;j++)a.setY(j,a.getY(j)+a.getZ(j)*.38);g.computeVertexNormals();
    add(g,fabric[i%fabric.length],p.x,25.7,p.z,1,1,1,p.angle,1,false);
    const local=(x,y,z)=>[p.x+Math.cos(p.angle)*x+Math.sin(p.angle)*z,y,p.z-Math.sin(p.angle)*x+Math.cos(p.angle)*z];
    for(const side of [-1,1]){
      const mast=local(side*3.72,29.2,0),foot=local(side*3.72,24.7,0),tip=local(side*3.72,20.38,-14);
      rod(M.wood,foot,mast,.11);const shoe=local(side*3.72,25.0,0);box(M.gold,...shoe,.32,.65,.32,p.angle);rod(M.rope,mast,tip,.027);
      rod(M.rope,local(side*3.72,25.7,0),tip,.035);
    }
    rod(M.rope,local(-3.72,20.38,-14),local(3.72,20.38,-14),.055);
    const hemP=[],hemUV=[],hemIX=[];
    for(let k=0;k<=16;k++){const u=k/16,drop=.34+.12*Math.sin(u*Math.PI*8);hemP.push((u-.5)*7.45,20.38,-14,(u-.5)*7.45,20.38-drop,-14);hemUV.push(u,0,u,1);if(k<16){const n=k*2;hemIX.push(n,n+1,n+2,n+1,n+3,n+2);}}
    add(geo(hemP,hemIX,hemUV),fabric[i%fabric.length],p.x,0,p.z,1,1,1,p.angle,.9,false);
  }
  // Twelve starting stalls. The two centre bays form the ceremonial gateway.
  for(let i=0;i<12;i++){
    const x=(i-5.5)*7.35,z=START-5+Math.abs(x)*.035;
    add(gateArch,M.stone,x,0,z);
    add(doorLeaf,M.wood,x,0,z-2.8,1,1,1,0,1.32);
    for(const side of [-1,1])box(M.ashlar,x+side*2.87,3.8,z-3.0,.48,7.6,6.0);
    box(M.paving,x,.16,z-2.6,5.3,.32,6.3);
    box(M.marble,x,.12,z+1.3,5.5,.24,1.1);
    for(let yy=1;yy<6;yy+=1.3)box(M.wood,x,yy,z-2.65,5.05,.16,.24,0,.83);
    for(const side of [-1,1]){
      const wheel=new T.TorusGeometry(.26,.045,5,16);add(wheel,M.gold,x+side*.45,3.1,z-2.61);wheel.dispose();
      rod(M.rope,[x+side*2.3,6.1,z-2.7],[x+side*2.3,8.8,z-1.1],.045);
    }
    box(M.gold,x,8.5,z-1.1,5.6,.13,.16);
    for(let j=-2;j<=2;j++)box(M.marble,x+j*1.35,10.25,z+3.55,.16,1.35,.18);
    box(M.marble,x,10.98,z+3.55,7.2,.2,.4);
    relief(x,8.8,z+3.03,.9,i%4);box(M.marble,x,9.5,z+3.2,7.2,.22,1.25);
    box(M.wood,x,3.1,z-2.59,.16,6.2,.18);
    for(let q=-2;q<=2;q++)box(M.gold,x+q*.85,3.1,z-2.56,.055,6.1,.07);
    box(M.gold,x,2.1,z-2.53,5.2,.12,.08);box(M.gold,x,4.4,z-2.53,5.2,.12,.08);
    for(const side of [-1,1])for(const yy of [1.3,4.8]){
      box(M.gold,x+side*2.3,yy,z-2.46,.26,.35,.14);
      box(M.gold,x+side*1.35,yy,z-2.47,1.85,.10,.11);
    }
    box(M.marble,x,7.25,z+1.25,.65,.82,.32);
    box(M.stone,x,9,z,7.35,1,6); roof(x,9.5,z,7.6,1.6,6.8);
    column(x-3.45,0,z+1.6,8.5,.32,M.marble);
  }
  for(const x of [-48,0,48]){
    if(x!==0)box(M.stone,x,4.7,START-8,8.5,9.4,11);
    else box(M.stone,x,9.6,START-8,8.5,1.1,11);
    box(M.red,x,9.6,START-1.9,7,.8,.15);
    for(const sx of [-2.8,2.8])column(x+sx,10.2,START-1.7,5,.4);
    box(M.marble,x,15.5,START-5.5,9.6,.65,9.4);roof(x,15.8,START-5.5,10.6,3.1,10);
    horse(x,18.9,START-5.5,3.5,x===0?0:x<0?.35:-.35);
    for(const sx of [-2.8,2.8])column(x+sx,10.2,START-9.0,5,.4);
    box(M.marble,x,10.3,START-5.5,8.1,.3,9.2);
    for(let q=-3;q<=3;q++)box(M.marble,x+q,11.0,START-1.5,.22,1.5,.22);
    box(M.marble,x,11.82,START-1.5,7.7,.2,.45);
    relief(x,16.65,START-.46,1.7,2);
    if(x!==0)relief(x,4.9,START-2.42,4.2,x<0?2:1);
  }
  // Spina: low barrier, marble basins, shrines, obelisk and both sets of metae.
  box(M.ashlar,0,.55,4,9,1.1,421);box(M.red,0,1.15,4,8.4,.35,420);box(M.marble,0,1.45,4,9.3,.3,422);
  for(let z=-194;z<206;z+=9.8){
    for(const side of [-1,1]){
      box(M.red,side*4.51,.65,z,.03,.64,8.7,0,.82);
      box(M.marble,side*4.61,.69,z+4.6,.22,1.28,.42);
      box(M.marble,side*4.6,.22,z,.22,.14,9.1);
    }
    box(M.shade,0,1.605,z,8.5,.01,.032,0,.83);
  }
  const metaDrum=lathe([[0,0],[1.18,0],[1.18,.2],[1.04,.32],[.96,.55],[.96,3.0],[1.1,3.14],[1.1,3.4]],24);
  const metaCone=lathe([[1.13,0],[1.18,.12],[1.13,.29],[.94,.55],[.79,1.2],[.55,2.2],[.29,3.15],[.07,3.92],[0,4.05]],28);
  const metaBase=lathe([[0,0],[5.65,0],[5.65,.25],[5.4,.4],[5.4,1.7],[5.8,1.85],[5.8,2.1],[0,2.1]],40);
  for(const z of [-203,215]){
    add(metaBase,M.marble,0,.2,z);
    for(let k=0;k<20;k++){const a=k/20*Math.PI*2;box(M.red,Math.cos(a)*5.43,1.28,z+Math.sin(a)*5.43,.98,1.0,.06,Math.PI/2-a,.86);}
    for(const [x,dz] of [[-2.6,0],[2.6,0],[0,z>0?2.8:-2.8]]){
      add(metaDrum,M.teal,x,2.3,z+dz);add(metaCone,M.gold,x,5.7,z+dz);
      for(let k=0;k<16;k++){const a=k/16*Math.PI*2;rod(M.gold,[x+.97*Math.cos(a),2.9,z+dz+.97*Math.sin(a)],[x+.97*Math.cos(a),5.26,z+dz+.97*Math.sin(a)],.035);}
    }
  }
  for(const z of [-159,-50,76,161]){
    box(M.ashlar,0,1.9,z,7.6,.8,28);box(M.mosaic,0,2.1,z,6.6,.035,26.8,0,.5);
    for(let zz=-12;zz<=12;zz+=2)for(let xx=-2.7;xx<=2.7;xx+=1.35)box(M.teal,xx,2.13,z+zz,1.26,.02,1.86,0,.52+random()*.25);
    const bowl=lathe([[.3,0],[.55,.12],[.5,1],[.65,1.15],[1.8,1.65],[2,1.9],[2,2.08],[1.8,2.1],[1.52,1.85],[.42,1.4]],28);
    add(bowl,M.marble,0,2.14,z);
    const pool=new T.CircleGeometry(1.74,32);pool.rotateX(-Math.PI/2);add(pool,M.water,0,4.16,z);pool.dispose();
    const jet=new T.CatmullRomCurve3([new T.Vector3(0,4.16,z),new T.Vector3(.1,4.7,z+.08),new T.Vector3(.35,4.15,z+.25)]);
    const stream=new T.TubeGeometry(jet,12,.045,5,false);add(stream,M.water,0,0,0);stream.dispose();
    
    const waterPlane=new T.PlaneGeometry(6.6,26.8);waterPlane.rotateX(-Math.PI/2);ownGeometries.add(waterPlane);add(waterPlane,M.water,0,2.37,z);
    for(const x of [-3.7,3.7])box(M.marble,x,2.4,z,.38,.35,28.3);
    for(const zz of [-14,14])box(M.marble,0,2.4,z+zz,7.8,.35,.4);
  }
  function shrine(z,round=false){
    if(round){
      add(lathe([[0,0],[4.4,0],[4.4,.25],[4.05,.25],[4.05,.5],[3.7,.5],[3.7,.85],[0,.85]],32),M.marble,0,1.6,z);
      for(let i=0;i<8;i++){const a=i/8*Math.PI*2;column(Math.cos(a)*2.9,2.45,z+Math.sin(a)*2.9,5.4,.38);}
      add(cylinder,M.marble,0,8.1,z,3.7,.6,3.7);add(cone,M.roof,0,9.65,z,4.1,2.5,4.1);
      add(sphere,M.gold,0,11,z,.23,.4,.23);statue(0,2.5,z,.88);
    }else{
      for(let i=0;i<4;i++)box(M.marble,0,1.75+i*.24,z-1.1+i*.55,8.5-i*.35,.3,12-i*1.1);
      for(const x of [-2.7,2.7])for(const zz of [-3.8,0,3.8])column(x,2.5,z+zz,5.4,.46);
      box(M.red,0,4.9,z+3,4.4,4.8,.5);box(M.marble,0,8.05,z,7.8,.6,10.3);
      roof(0,8.4,z,8.7,2.2,11);statue(0,2.5,z,.9);
      relief(0,9.1,z-5.56,1.4,0,Math.PI);
      for(const x of [-3,-2,-1,0,1,2,3])box(M.marble,x,7.71,z-5.18,.38,.3,.32);
    }
  }
  shrine(-102,true);shrine(116);
  box(M.marble,0,2.5,22,9,1.8,10);box(M.granite,0,5.3,22,6,3.8,7);box(M.marble,0,7.5,22,6.8,.6,7.8);
  const shaft=new T.CylinderGeometry(1.2,2.1,31,4,1);shaft.rotateY(Math.PI/4);ownGeometries.add(shaft);
  add(shaft,M.granite,0,23.3,22);const cap=new T.ConeGeometry(1.2,3,4);cap.rotateY(Math.PI/4);ownGeometries.add(cap);add(cap,M.gold,0,40.3,22);
  relief(0,5.35,25.52,2.65,1);relief(0,5.35,18.48,2.65,0,Math.PI);
  relief(3.02,5.35,22,2.65,3,Math.PI/2);relief(-3.02,5.35,22,2.65,2,-Math.PI/2);
  // Decorative carved signs are an artistic pattern, not a claimed historical inscription.
  for(let y=10;y<36;y+=1.45){
    const radius=(2.1-(y-7.8)/31*.9)*Math.SQRT1_2+.025;
    for(let face=0;face<4;face++){
      const a=face*Math.PI/2,front=(xx,yy,ww,hh)=>box(M.shade,Math.sin(a)*radius+Math.cos(a)*xx,yy,22+Math.cos(a)*radius-Math.sin(a)*xx,ww,hh,.014,a,.72);
      front(-.58,y,.035,1.35);front(.58,y,.035,1.35);
      const n=Math.round(y/1.45)%3;
      front(0,y-.42,.45,.045);front(0,y+.35,.42,.055);
      if(n===0){front(-.18,y,.045,.6);front(.18,y,.045,.6);front(0,y,.36,.045);}
      if(n===1){front(0,y,.055,.56);front(-.18,y+.15,.3,.045);front(.18,y-.12,.28,.045);}
      if(n===2){front(-.22,y,.055,.5);front(.12,y,.38,.055);front(.29,y+.16,.055,.33);}
    }
  }
  for(let i=0;i<3;i++)box(M.marble,0,1.76+i*.27,22,10.4-i*.6,.3,11.4-i*.6);
  for(const side of [-1,1])for(const z of [17.8,26.2]){box(M.granite,side*4.0,3,z,1.0,1.3,1.0);add(sphere,M.gold,side*4,3.8,z,.28,.31,.28);}

  for(const z of [-184,-130,-75,-17,54,143,191]){
    column(0,1.6,z,6,.7,M.granite);statue(0,7.6,z,.7);
    for(const x of [-3.7,3.7]){box(M.marble,x,2,z,1,.8,1);add(sphere,M.gold,x,2.75,z,.45,.45,.45);}
  }
  function dolphin(x,y,z,scale=1){
    const curve=new T.CatmullRomCurve3([new T.Vector3(-.52,-.12,0),new T.Vector3(-.25,.15,0),new T.Vector3(.1,.22,0),new T.Vector3(.36,.03,0),new T.Vector3(.53,-.07,0)]);
    const body=new T.TubeGeometry(curve,12,.14,7,false),pos=body.attributes.position;
    // Taper the head and tail instead of leaving a constant-radius tube.
    for(let i=0;i<pos.count;i++){const j=Math.floor(i/8),center=curve.getPointAt(j/12),f=.22+.78*Math.sin(Math.PI*j/12);pos.setXYZ(i,center.x+(pos.getX(i)-center.x)*f,center.y+(pos.getY(i)-center.y)*f,center.z+(pos.getZ(i)-center.z)*f);}
    body.computeVertexNormals();add(body,M.teal,x,y,z,scale,scale,scale);body.dispose();
    const fins=geo([-.07,.27,0,-.15,.52,0,.14,.3,0, -.46,-.07,0,-.7,-.03,.25,-.7,-.03,-.25, .03,.13,.1,-.08,-.12,.3,.23,.09,.1],[0,1,2,2,1,0,3,4,5,5,4,3,6,7,8,8,7,6]);
    add(fins,M.teal,x,y,z,scale,scale,scale);
    add(sphere,M.gold,x+.32*scale,y+.11*scale,z+.095*scale,.025*scale,.025*scale,.025*scale);
  }
  for(const z of [-120,98]){
    column(-3.2,1.6,z,3.2,.38);column(3.2,1.6,z,3.2,.38);box(M.marble,0,5.0,z,8.7,.45,1.8);
    box(M.red,0,4.74,z+.92,8.1,.19,.06);
    for(let i=-3;i<=3;i++){
      const x=i*1.12;add(cylinder,M.gold,x,5.33,z,.24,.2,.24);
      if(z<0)add(sphere,M.gold,x,5.91,z,.31,.53,.31);else dolphin(x,5.9,z,.81);
    }
    for(const x of [-3.2,3.2]){box(M.marble,x,1.76,z,1.2,.3,1.3);rod(M.gold,[x,5.27,z],[x,6.45,z],.055);}
  }

  // Imperial pulvinar, open to the track with a shaded, columned viewing room.
  box(M.stone,65,5,-72,35,10,40);box(M.marble,60.5,10.4,-72,36,.8,42);
  box(M.red,74.8,14.8,-72,1.4,9,40);
  for(const z of [-90,-81,-63,-54])column(45,10.8,z,8.5,.62);
  for(const z of [-90,-54])for(const x of [53,61,69])column(x,10.8,z,8.5,.62);
  box(M.marble,59,19.6,-72,31,.7,42);roof(61,19.95,-72,34,4.8,44);
  for(const z of [-90,-54])drape(46,19.2,z,3.6,8.1,Math.PI/2);
  box(M.marble,43.1,11.12,-72,.75,.3,39);box(M.marble,43.1,12.6,-72,.95,.25,40);
  const baluster=lathe([[.17,0],[.23,.1],[.14,.23],[.22,.5],[.23,.66],[.12,.87],[.19,1.15],[.21,1.22]],10);
  for(let z=-90;z<=-54;z+=.85)add(baluster,M.marble,43.1,11.27,z);
  for(const z of [-90,-81,-63,-54])box(M.marble,43.1,11.95,z,.9,1.5,.75);
  for(const z of [-91,-53])statue(42,11,z,1.1);
  // Inlaid floor, coffered ceiling and small relief panels visible from the loge.
  for(let x=46;x<72;x+=2)for(let z=-90;z<-53;z+=2){
    if((Math.round(x/2)+Math.round(z/2))%2===0)box(M.mosaic,x,10.804,z,1.97,.008,1.97,0,.88);
  }
  for(let z=-91;z<-53;z+=5){
    
    box(M.marble,59,19.2,z,29,.25,.35);
  }
  for(let x=48;x<73;x+=5)box(M.marble,x,19.2,-72,.35,.25,39);
  // A furnished chamber stays visible when looking around from the loge camera.
  for(let x=50.5;x<73;x+=5)for(let z=-88.5;z<-54;z+=5){
    box(M.mosaic,x,19.16,z,4.3,.03,4.3,0,.65);
    box(M.gold,x,19.1,z,1.1,.08,1.1,Math.PI/4,.9);
  }
  for(const z of [-87,-77,-67,-57]){
    box(M.marble,74.0,14.6,z,.3,6.4,7.6);box(M.red,73.79,14.8,z,.14,5.5,6.7);
    relief(73.65,15.1,z,3.2,Math.abs(z)%4,-Math.PI/2);
  }
  // Curule chairs, padded benches and side tables at human scale.
  for(const z of [-79,-72,-65]){
    box(M.wood,68,11.35,z,1.9,.22,2.1);box(M.burgundy,67.9,11.58,z,1.8,.24,1.9);
    for(const dz of [-.82,.82]){
      rod(M.gold,[67.2,10.8,z+dz],[68.7,11.42,z+dz],.07);rod(M.gold,[68.7,10.8,z+dz],[67.2,11.42,z+dz],.07);
      rod(M.gold,[68.65,11.42,z+dz],[68.65,13.2,z+dz],.065);
      box(M.gold,68.3,12.16,z+dz,1.2,.1,.1);
    }
    box(M.burgundy,68.66,12.5,z,.14,1.2,1.65);box(M.gold,68.66,13.17,z,.18,.1,1.9);
  }
  for(const z of [-86,-58]){
    box(M.wood,65,12.0,z,2.2,.14,2.2);column(65,10.8,z,1.15,.2,M.gold);
    urn(65,12.1,z,.45,M.gold);box(M.marble,73,11.6,z,1.4,1.6,1.4);bust(73,12.4,z,1.65,-Math.PI/2);
  }
  for(const z of [-91,-53])for(const x of [54,61,68]){
    box(M.marble,x,11.15,z,4.5,.7,1.6);box(M.burgundy,x,11.59,z,4.3,.18,1.45);
  }
  const medallion=new T.CircleGeometry(3.3,40);medallion.rotateX(-Math.PI/2);add(medallion,M.granite,58,10.815,-72);medallion.dispose();
  for(let k=0;k<12;k++){const a=k/12*Math.PI*2;box(M.marble,58+Math.cos(a)*2.55,10.825,-72+Math.sin(a)*2.55,.65,.02,1.15,-a);}
  // Terraced Palatine massing behind the imperial side.
  box(M.ashlar,133,5,-43,82,10,225);box(M.ashlar,147,14,-42,71,8,193);
  for(let z=-140;z<57;z+=9){
    add(arcade,M.stone,94.5,1,z,1,1,1,Math.PI/2);column(110,10,z,7.2,.5);
    box(M.red,112,13.8,z,.16,5.1,5.7,0,.84);
  }
  box(M.marble,111,17.6,-42,4,.8,202);
  for(const [x,z,w,d,h] of [[145,-113,50,48,18],[151,-45,54,59,24],[148,28,58,47,20]]){
    box(M.plaster,x,18+h/2,z,w,h,d);box(M.red,x-w/2-.06,20.5,z,.16,5,d);
    roof(x,18+h,z,w+4,6,d+4);box(M.marble,x,18+h-.6,z,w+2,1.2,d+2);
    for(let zz=z-d/2+4;zz<z+d/2;zz+=6){
      column(x-w/2-4.5,18,zz,9,.5);box(M.shade,x-w/2-.05,23.5,zz,.12,6,2.7);
      add(upperArcade,M.marble,x-w/2-1,29,zz,1,1.1,1,Math.PI/2);
      box(M.shade,x-w/2-.09,32,zz,.12,5,3.8);
    }
    box(M.marble,x-w/2-3,27.5,z,6.2,.6,d+1);roof(x-w/2-3,27.9,z,7,1.8,d+2);
    for(const zz of [z-d/2,z+d/2])box(M.marble,x-w/2-4.5,28.45,zz,6,.25,.4);
    // Side elevations are articulated too, so the palace is not a decorated front on a blank box.
    for(const side of [-1,1])for(let xx=x-w/2+5;xx<x+w/2-3;xx+=8){
      for(const yy of [23.5,31.5]){
        const front=z+side*(d/2+.06);
        box(M.shade,xx,yy,front,2.6,4.5,.1);
        for(const dx of [-1.5,1.5])box(M.marble,xx+dx,yy,front+side*.22,.24,4.8,.45);
        box(M.marble,xx,yy+2.45,front+side*.2,3.5,.24,.5);
        box(M.marble,xx,yy-2.4,front+side*.25,3.4,.22,.7);
      }
    }
    // Prominent moulded pilasters and pediment dentils break the palace's box silhouette.
    for(const zz of [z-d/2+.8,z+d/2-.8])box(M.marble,x-w/2-.6,18+h/2,zz,.8,h,1.4);
    for(let zz=z-d/2;zz<z+d/2;zz+=1.8)box(M.marble,x-w/2-.65,18+h-1.5,zz,.8,.65,.7);
  }
  for(let i=0;i<20;i++)box(M.marble,100+i*.65,10+i*.4,-158,1.3,.42,18);
  box(M.paving,119,18.06,-6,10,.12,38);
  for(const z of [-22,10])for(const x of [116,122])urn(x,18.12,z,1.4);

  function tree(x,z,height=13,y=-.28){
    treePlacements.push({x,z,height,y,angle:random()*Math.PI*2});
    if(options.trees)return;
    add(cylinder,M.trunk,x,y+height*.26,z,.33,height*.52,.33);
    add(sphere,M.tree,x,y+height*.6,z,1.6,height*.45,1.8,random(),.8+random()*.3);
  }
  function cypress(x,y,z,h=11){
    add(cylinder,M.trunk,x,y+h*.2,z,.18,h*.4,.18);
    const g=lathe([[0,.12],[.35,.16],[.7,.3],[.88,.52],[.66,.75],[.38,.9],[0,1.0]],9),v=g.attributes.position;
    for(let i=0;i<v.count;i++){const f=.91+.14*Math.sin(i*12.7);v.setXYZ(i,v.getX(i)*f,v.getY(i),v.getZ(i)*f);}g.computeVertexNormals();
    add(g,M.tree,x,y,z,1.4,h,1.4,random()*6.28,.75+random()*.3);
  }
  for(let z=-142;z<=66;z+=15)cypress(100+random()*3,10,z,10+random()*4);
  for(let z=-130;z<=50;z+=37){tree(181,z,13+random()*3,18);for(const dz of [-7,7])cypress(174,18,z+dz,8+random()*3);}
  for(const side of [-1,1])for(let i=0;i<28;i++){
    const x=side*(225+random()*50),z=-345+random()*760;
    cypress(x,-.3,z,9+random()*7);
    for(let j=0;j<3;j++)add(leaf,M.tree,x+(random()-.5)*7,.4+random()*.4,z+(random()-.5)*8,1.4+random(),.8+random(),1.2+random(),random()*6.28,.7+random()*.3);
  }
  // Small, individually varied Roman blocks, leaving the circus exterior clear.
  for(const side of [-1,1])for(let row=0;row<4;row++)for(let i=0;i<23;i++){
    const x=side*(110+row*27+random()*7),z=-322+i*31+random()*9;
    if(side===1&&z>-165&&z<86)continue;
    const w=15+random()*8,d=18+random()*8,h=7+random()*11;
    const angle=(random()-.5)*.16;
    const part=(m,lx,yy,lz,ww,hh,dd,tint=1)=>box(m,x+Math.cos(angle)*lx+Math.sin(angle)*lz,yy,z-Math.sin(angle)*lx+Math.cos(angle)*lz,ww,hh,dd,angle,tint);
    const plaster=random()>.22?M.plaster:M.red;
    if((row+i)%4===0){
      // An open atrium is built from four wings, with no hidden solid box beneath it.
      const wing=4.5;part(plaster,0,h/2,-d/2+wing/2,w,h,wing,.92);part(plaster,0,h/2,d/2-wing/2,w,h,wing,.87);
      for(const side2 of [-1,1])part(plaster,side2*(w-wing)/2,h/2,0,wing,h,d-wing*2,.94);
      for(const zz of [-d/2+wing/2,d/2-wing/2])roof(x+Math.sin(angle)*zz,h,z+Math.cos(angle)*zz,w+1.2,2.2,wing+1.1,angle);
      for(const xx of [-w/2+wing/2,w/2-wing/2])roof(x+Math.cos(angle)*xx,h,z-Math.sin(angle)*xx,wing+1.2,2.0,d-wing*2,angle);
      part(M.mosaic,0,.04,0,w-wing*2,.08,d-wing*2,.8);part(M.water,0,.1,0,3.0,.04,4.0);
    }else{
      part(plaster,0,h/2,0,w,h,d,.77+random()*.24);roof(x,h,z,w+1.2,3+random()*2,d+1.2,angle);
      if(i%3===1){
        part(M.marble,0,h*.48, d/2+.6,w*.78,.25,1.9);part(M.wood,0,h*.48+1,d/2+1.4,w*.78,.13,.14);
        for(let xx=-w*.35;xx<w*.36;xx+=1.2)part(M.wood,xx,h*.48+.5,d/2+1.4,.08,1.0,.08);
      }
    }
    part(M.stone,0,1.1,0,w+.12,2.2,d+.12,.82);
    for(const xx of [-w*.28,0,w*.28]){
      part(M.shade,xx,h*.68,d/2+.03,1.3,2.4,.08);
      part(M.marble,xx,h*.68-1.25,d/2+.15,1.7,.18,.4);
      part(M.wood,xx+.6,h*.68,d/2+.12,.16,2.3,.13);
      // Real window reveals and a partly open shutter, with a visible side face.
      for(const edge of [-.72,.72])part(plaster,xx+edge,h*.68,d/2+.22,.14,2.6,.44,.91);
      part(plaster,xx,h*.68+1.27,d/2+.22,1.6,.14,.44,.93);
      const shutter=new T.BoxGeometry(.55,2.25,.12);shutter.rotateY(.55+((row+i)%3)*.2);
      add(shutter,M.wood,x+Math.cos(angle)*(xx-.65)+Math.sin(angle)*(d/2+.36),h*.68,z-Math.sin(angle)*(xx-.65)+Math.cos(angle)*(d/2+.36),1,1,1,angle,.84);shutter.dispose();
    }
    part(M.wood,0,1.7,d/2+.06,1.8,3.4,.14);
    // Windows wrap around the side streets rather than appearing on one face only.
    for(const side2 of [-1,1])for(const zz of [-d*.25,d*.25]){
      part(M.shade,side2*(w/2+.04),h*.64,zz,.08,2.1,1.3);
      part(M.marble,side2*(w/2+.15),h*.64-1.12,zz,.4,.17,1.65);
      part(M.wood,side2*(w/2+.13),h*.64,zz+.74,.16,2.16,.2);
    }
    for(const xx of [-w*.24,w*.24]){
      part(M.shade,xx,h*.64,-d/2-.04,1.3,2.1,.08);
      part(M.marble,xx,h*.64-1.12,-d/2-.15,1.65,.17,.4);
    }
    if((row+i)%3===0){
      const awning=geo([-2.6,4.1,d/2,2.6,4.1,d/2,-2.6,3.35,d/2+2.8,2.6,3.35,d/2+2.8],[0,2,1,1,2,3]);
      add(awning,fabric[(row+i)%fabric.length],x,0,z,1,1,1,angle,.93);
      for(const dx of [-2.5,2.5])part(M.wood,dx,1.65,d/2+2.7,.11,3.3,.11);
      part(M.wood,0,.95,d/2+1.4,4.1,1.9,1.0,.87);
      for(const xx of [-1.15,1.15]){
        const lz=d/2+1.4;urn(x+Math.cos(angle)*xx+Math.sin(angle)*lz,1.9,z-Math.sin(angle)*xx+Math.cos(angle)*lz,.56);
      }
    }
    if(random()>.45)tree(x+w/2+4,z,8+random()*8);
  }
  for(const side of [-1,1]){
    box(M.paving,side*98,-.25,20,4,.15,690);
    box(M.paving,side*219,-.25,20,5,.15,690);
    for(let z=-340;z<400;z+=124)box(M.paving,side*159,-.25,z,120,.15,3.5);
  }
  // Additional monumental silhouettes beyond the turn.
  for(const x of [-130,-40,60,160]){
    const z=355+random()*35;box(M.stone,x,3,z,31,6,43);
    for(const xx of [-12,-6,0,6,12])for(const zz of [-18,18])column(x+xx,6,z+zz,11,.65);
    box(M.marble,x,17.5,z,32,1,43);roof(x,18,z,34,5,45);
  }
  // Pebbles and fragments collect at the track edges, clear of the racing line.
  function trackHeightAt(x,z){
    // Interpolate the actual rendered triangles, including the tapered boundary.
    const gx=(x+INNER)/2,gz=(z-START)/2,ix=Math.min(47,Math.max(0,Math.floor(gx))),iz=Math.min(237,Math.max(0,Math.floor(gz)));
    const u=gx-ix,v=gz-iz,k=iz*49+ix,a=tp.getY(k),b=tp.getY(k+49),c=tp.getY(k+50),d=tp.getY(k+1);
    return u+v<=1?a+(d-a)*u+(b-a)*v:c+(b-c)*(1-u)+(d-c)*(1-v);
  }
  const pebble=new T.IcosahedronGeometry(1,0);ownGeometries.add(pebble);
  for(let i=0;i<850;i++){
    const side=i%2?1:-1,z=START+random()*(TURN-START),x=side*(45.8+random()*1.8),s=.025+Math.pow(random(),2)*.14;
    if(earthNoise(x*.14,z*.2)<.35)continue;
    add(pebble,M.stone,x,trackHeightAt(x,z)+s*.22,z,s,s*(.28+random()*.23),s*(.55+random()*.6),random()*6.28,.57+random()*.4);
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
  function person(x,y,z,angle){
    const cluster=earthNoise(z*.09,y*.23),occupancy=.64+cluster*.29;
    if(random()>occupancy)return; spectators.push({x,y,z,angle,color:palette[Math.floor(random()*palette.length)],skin:[0x9a775b,0xbb9471,0x755342,0xd2ad87][Math.floor(random()*4)]});}
  for(let row=1;row<ROWS-1;row++){
    const r=50+(row+.5)*STEP,y=3.7+row*RISE;
    for(const side of [-1,1])for(let z=START+1.6;z<TURN-1;z+=1.65){
      if((z-START)%23.8<1.7 || (side===1&&z>-94.5&&z<-49.5))continue;
      if(row>=9&&row<=16&&passageCenters.some(center=>Math.abs(z-center)<2.4))continue;
      person(side*r,y,z+random()*.4,side*Math.PI/2);
    }
    const count=Math.floor(Math.PI*r/1.6);
    for(let i=0;i<count;i++){
      const a=(i+.5)/count*Math.PI;if(Math.abs((a/Math.PI*15)%1-.5)>.44)continue;
      person(Math.cos(a)*r,y,TURN+Math.sin(a)*r,Math.PI/2-a);
    }
  }
  if(textures.spectators){
    // Sixteen alpha-cutout seated people, one instanced draw call. Cylindrical
    // billboards retain human width from all four cameras; no stacked image layers.
    const g=new T.PlaneGeometry(1.38,1.38),offsets=new Float32Array(spectators.length*2),directions=new Float32Array(spectators.length*2);
    const m=new T.MeshLambertMaterial({map:textures.spectators,alphaTest:.52,alphaToCoverage:true,side:T.DoubleSide,color:0xf2ede5});
    m.name='Photographic spectator atlas';
    m.onBeforeCompile=s=>{
      s.vertexShader='attribute vec2 atlasOffset;attribute vec2 seatDirection;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
        vMapUv=(vMapUv*vec2(.986,.986)+vec2(.007,.007))*.25+atlasOffset;
      `).replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        objectNormal=vec3(0.0,1.0,0.0);
      `).replace('#include <begin_vertex>',`#include <begin_vertex>
        vec3 center=(modelMatrix*instanceMatrix*vec4(0,0,0,1)).xyz;
        vec3 toEye=cameraPosition-center;
        vec2 facing=normalize(mix(seatDirection,normalize(toEye.xz),.72));
        vec3 right=vec3(facing.y,0.0,-facing.x);
        // Keep seated torsos upright, including the overview camera.
        float tilt=clamp(toEye.y/max(length(toEye.xz),.001),0.0,.18);
        vec3 up=normalize(vec3(-normalize(toEye.xz).x*tilt,1.0,-normalize(toEye.xz).y*tilt));
        transformed=right*position.x+up*position.y;
      `);
    };
    m.customProgramCacheKey=()=> 'circus145-crowd-atlas';
    const mesh=new T.InstancedMesh(g,m,spectators.length);mesh.name='Seated spectators';
    spectators.forEach((p,i)=>{
      const tile=Math.floor(random()*16);offsets[i*2]=(tile%4)*.25;offsets[i*2+1]=Math.floor(tile/4)*.25;
      directions[i*2]=-Math.sin(p.angle);directions[i*2+1]=-Math.cos(p.angle);
      dummy.position.set(p.x+(random()-.5)*.12,p.y+.13,p.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(.9+random()*.18);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      const tint=.9+random()*.1,warm=(random()-.5)*.035;mesh.setColorAt(i,new T.Color().setRGB(tint+warm,tint,tint-warm*.65));
    });
    g.setAttribute('atlasOffset',new T.InstancedBufferAttribute(offsets,2));
    g.setAttribute('seatDirection',new T.InstancedBufferAttribute(directions,2));
    mesh.computeBoundingSphere();mesh.castShadow=false;mesh.receiveShadow=true;crowd.add(mesh);
    const cg=new T.PlaneGeometry(.66,.42);cg.rotateX(-Math.PI/2);
    const cm=new T.MeshBasicMaterial({color:0x30291f,transparent:true,opacity:.24,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    cm.onBeforeCompile=s=>{s.vertexShader='varying vec2 contactUv;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncontactUv=uv;');s.fragmentShader='varying vec2 contactUv;\n'+s.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\ndiffuseColor.a*=pow(max(0.0,1.0-length(contactUv*2.0-1.0)),1.4);');};
    cm.customProgramCacheKey=()=> 'circus145-seat-contact';
    // Upper tiers are too distant for a separate contact patch to be visible.
    const nearSeats=spectators.filter(p=>p.y<9);
    const contact=new T.InstancedMesh(cg,cm,nearSeats.length);contact.name='Seat contact shade';
    nearSeats.forEach((p,i)=>{dummy.position.set(p.x,p.y+.012,p.z);dummy.rotation.set(0,p.angle,0);dummy.scale.setScalar(1);dummy.updateMatrix();contact.setMatrixAt(i,dummy.matrix);});contact.computeBoundingSphere();crowd.add(contact);
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
  group.userData={sculptures:Object.keys(sculptures),realismAreas:20,crowdVariants:16,version:145,kind:'artistic-reconstruction',spectators:spectators.length,startingGates:12,rows:ROWS,photoCrowd:!!textures.spectators,rearWall:{radius:76,centerZ:START,height:28.4,joins:[[-76,START],[76,START]]},passages:passageCenters.length+passageCenters.filter(z=>z<=-108||z>=-36).length,reliefAtlas:!!textures.relief};
  return {group,crowd,materials:M,treePlacements,metadata:group.userData};
});
