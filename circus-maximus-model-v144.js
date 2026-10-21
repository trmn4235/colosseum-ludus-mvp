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
    marble: material('Honed veined marble', 0xe7e0d2, { map:textures.marble||null, normalMap: textures.plasterNormal || null, normalScale: new T.Vector2(.045,.045), roughness:.58 }),
    ashlar: material('Dressed travertine blocks',0xe9e2d2,{map:textures.plaster||null,normalMap:textures.plasterNormal||null,normalScale:new T.Vector2(.23,.23),roughnessMap:textures.plasterRough||null}),
    relief: material('Carved Roman stone panels',0xeee8dc,{map:textures.relief||null,roughness:.88}),
    shade: material('Recessed masonry', 0xa39c8e, { map: textures.stone || null, normalMap: textures.stoneNormal || null, normalScale: new T.Vector2(.45,.45) }),
    plaster: material('Lime plaster', 0xe6dbc4, { map: textures.plaster || null, normalMap: textures.plasterNormal || null, normalScale: new T.Vector2(.48,.48), roughnessMap: textures.plasterRough || null }),
    red: material('Worn Pompeian plaster', 0x8a443a, { map: textures.plaster || null, normalMap: textures.plasterNormal || null, normalScale: new T.Vector2(.4,.4) }),
    roof: material('Weathered terracotta tiles', 0xe0b391, { map: textures.roof || null, normalMap: textures.roofNormal || null, normalScale: new T.Vector2(.85,.85), roughnessMap: textures.roofRough || null }),
    gold: material('Aged bronze', 0xaf8440, { metalness: .55, roughness: .43 }),
    granite: material('Rose granite', 0xbfa89b, {map:textures.plaster||null,normalMap:textures.plasterNormal||null,normalScale:new T.Vector2(.28,.28)}),
    mosaic: material('Inlaid stone floor',0xbfa89b,{map:textures.plaster||null,normalMap:textures.plasterNormal||null,normalScale:new T.Vector2(.12,.12),roughness:.65}),
    teal: material('Patinated bronze', 0x527c76, { metalness: .35 }),
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
          float wave=.008*sin(vSurfaceWorld.x*3.7+vSurfaceWorld.z*1.3+noise21(vSurfaceWorld.xz)*2.0)+.006*fbm(vSurfaceWorld.xz*4.0);
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
        detail=`float oxide=smoothstep(.54,.77,fbm(vSurfaceWorld.xz*2.3+vSurfaceWorld.y*.4));diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.43,.76,.65),oxide*.7);`;
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
    mat.customProgramCacheKey=()=> 'circus144-'+mat.name;
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
  const arcade = archGeometry(4.8, 3.5, .72, 1.25), upperArcade = archGeometry(4.2, 2.65, .7, 1.1), gateArch = archGeometry(5.3, 4.5, .9, 2.4,true);
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
  const cp=columnShaft.attributes.position;
  for(let i=0;i<cp.count;i++){const a=Math.atan2(cp.getZ(i),cp.getX(i)),f=1-.026*(.5+.5*Math.cos(a*10));cp.setXYZ(i,cp.getX(i)*f,cp.getY(i),cp.getZ(i)*f);}
  columnShaft.computeVertexNormals();ownGeometries.add(columnShaft);
  function column(x, y, z, h, r = .48, mat = M.marble) {
    add(r>=.45?columnShaft:tapered,mat,x,y+(r>=.45?.3:h/2),z,r,r>=.45?h-.9:h,r);
    box(mat, x, y + .16, z, r * 2.8, .32, r * 2.8);
    box(mat, x, y + h - .18, z, r * 2.9, .36, r * 2.9);
    add(cylinder, mat, x, y + h - .54, z, r * 1.28, .24, r * 1.28);
    if(r>=.45){add(cylinder,mat,x,y+.4,z,r*1.18,.2,r*1.18);add(tapered,mat,x,y+h-.65,z,r*1.15,.34,r*1.15);}
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
    const x=tp.getX(i),z=tp.getZ(i),edge=Math.min(1,(INNER-Math.abs(x))*.7,(z+(TURN-START)/2)*.7);
    tp.setY(i,Math.max(0,edge)*sandElevation(x,z+(START+TURN)/2,Math.abs(x)));
  }
  track.computeVertexNormals();ownGeometries.add(track);add(track,M.sand,0,0,(START+TURN)/2);
  const endP=[],endIX=[];
  for(let r=0;r<=16;r++)for(let a=0;a<=70;a++){const rad=r/16*INNER,angle=a/70*Math.PI,x=Math.cos(angle)*rad,z=Math.sin(angle)*rad;endP.push(x,sandElevation(x,z+TURN,rad)*Math.min(1,(INNER-rad)*.7),z);if(r<16&&a<70){const k=r*71+a;endIX.push(k,k+1,k+71,k+1,k+72,k+71);}}
  add(geo(endP,endIX),M.sand,0,0,TURN);
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
        if(section%4===1&&row>=9&&row<=15){
          for(const dz of [-6.65,6.65])box(M.stone,side*(r+STEP/2),y-.42,z+dz,STEP,.84,8.9,0,.9+random()*.08);
        }else box(M.stone,side*(r+STEP/2),y-.42,z,STEP,.84,22.2,0,.88+random()*.12);
      }
    }
    ringStrip(r, r + STEP, y - .82, .82, M.stone, 96);
  }
  for(const side of [-1,1])for(const z of passageCenters){
    if(side===1&&z>-108&&z<-36)continue;
    const ry=-side*Math.PI/2,x=side*57.5;
    add(tunnelArch,M.marble,x,8.7,z,1,1,1,ry);
    add(tunnelMouth,M.shade,side*61.6,8.7,z,1,1,1,ry,.47);
    box(M.shade,side*60,8.65,z,6,.2,3.6);
    for(const dz of [-2,2])box(M.ashlar,side*60,10.5,z+dz,5,3.7,.3);
    box(M.marble,side*60.1,12.9,z,5.7,.35,4.2);
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
      const u=k/4,v=j/7; pos.push((u-.5)*7.45,-.95*Math.sin(v*Math.PI)-.3*Math.sin(u*Math.PI)+.055*Math.sin(u*19.0)*Math.sin(v*Math.PI),-v*14);
      uv.push(u,v);
    }
    for(let j=0;j<7;j++)for(let k=0;k<4;k++){const a=j*5+k,b=a+5;ix.push(a,b,a+1,b,b+1,a+1);}
    const g=geo(pos,ix,uv); // slope the sail from the back gallery toward the seats
    const a=g.attributes.position;for(let j=0;j<a.count;j++)a.setY(j,a.getY(j)+a.getZ(j)*.38);g.computeVertexNormals();
    add(g,fabric[i%fabric.length],p.x,25.7,p.z,1,1,1,p.angle,1,false);
    const local=(x,y,z)=>[p.x+Math.cos(p.angle)*x+Math.sin(p.angle)*z,y,p.z-Math.sin(p.angle)*x+Math.cos(p.angle)*z];
    for(const side of [-1,1]){
      const mast=local(side*3.72,29.2,0),foot=local(side*3.72,24.7,0),tip=local(side*3.72,20.38,-14);
      rod(M.wood,foot,mast,.065);rod(M.rope,mast,tip,.027);
      rod(M.rope,local(side*3.72,25.7,0),tip,.035);
    }
    rod(M.rope,local(-3.72,20.38,-14),local(3.72,20.38,-14),.032);
  }
  // Twelve starting stalls. The two centre bays form the ceremonial gateway.
  for(let i=0;i<12;i++){
    const x=(i-5.5)*7.35,z=START-5+Math.abs(x)*.035;
    add(gateArch,M.stone,x,0,z);
    add(doorLeaf,M.wood,x,0,z-.9);
    box(M.wood,x,3.1,z-.71,.16,6.2,.18);
    for(let q=-2;q<=2;q++)box(M.gold,x+q*.85,3.1,z-.68,.055,6.1,.07);
    box(M.gold,x,2.1,z-.65,5.2,.12,.08);box(M.gold,x,4.4,z-.65,5.2,.12,.08);
    for(const side of [-1,1])for(const yy of [1.3,4.8]){
      box(M.gold,x+side*2.3,yy,z-.58,.26,.35,.14);
      box(M.gold,x+side*1.35,yy,z-.59,1.85,.10,.11);
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
    statue(x,18.6,START-5.5,.9);
    if(x!==0)relief(x,4.9,START-2.42,4.2,x<0?2:1);
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
    box(M.stone,0,1.9,z,7.6,.8,28);box(M.mosaic,0,2.31,z,6.6,.035,26.8,0,.58);
    const waterPlane=new T.PlaneGeometry(6.6,26.8);waterPlane.rotateX(-Math.PI/2);ownGeometries.add(waterPlane);add(waterPlane,M.water,0,2.37,z);
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
  relief(0,5.35,25.52,2.65,1);relief(0,5.35,18.48,2.65,0,Math.PI);
  relief(3.02,5.35,22,2.65,3,Math.PI/2);relief(-3.02,5.35,22,2.65,2,-Math.PI/2);
  // Shallow decorative cutting on the granite; deliberately not invented text.
  for(let y=10;y<36;y+=1.8){
    const r=(2.1-(y-7.8)/31*.9)*Math.SQRT1_2+.018;
    for(const side of [-1,1])for(const dx of [-.28,0,.28]){
      box(M.shade,dx,y,22+side*r,.035,.52,.018,0,.84);
      box(M.shade,dx,y-.26,22+side*r,.16,.026,.018,0,.84);
      box(M.shade,side*r,y,22+dx,.018,.52,.035,0,.84);
    }
  }
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
    const angle=(random()-.5)*.16;
    const part=(m,lx,yy,lz,ww,hh,dd,tint=1)=>box(m,x+Math.cos(angle)*lx+Math.sin(angle)*lz,yy,z-Math.sin(angle)*lx+Math.cos(angle)*lz,ww,hh,dd,angle,tint);
    const plaster=random()>.22?M.plaster:M.red;
    part(plaster,0,h/2,0,w,h,d,.77+random()*.24);roof(x,h,z,w+1.2,3+random()*2,d+1.2,angle);
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
    if((row+i)%3===0){
      const awning=geo([-2.6,4.1,d/2,2.6,4.1,d/2,-2.6,3.35,d/2+2.8,2.6,3.35,d/2+2.8],[0,2,1,1,2,3]);
      add(awning,fabric[(row+i)%fabric.length],x,0,z,1,1,1,angle,.93);
      for(const dx of [-2.5,2.5])part(M.wood,dx,1.65,d/2+2.7,.11,3.3,.11);
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
  function person(x,y,z,angle){if(random()<.23)return; spectators.push({x,y,z,angle,color:palette[Math.floor(random()*palette.length)],skin:[0x9a775b,0xbb9471,0x755342,0xd2ad87][Math.floor(random()*4)]});}
  for(let row=1;row<ROWS-1;row++){
    const r=50+(row+.5)*STEP,y=3.7+row*RISE;
    for(const side of [-1,1])for(let z=START+1.6;z<TURN-1;z+=1.65){
      if((z-START)%23.8<1.7 || (side===1&&z>-108&&z<-36&&row<18))continue;
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
    // Eight alpha-cutout seated people, one instanced draw call. Cylindrical
    // billboards retain human width from all four cameras; no stacked image layers.
    const g=new T.PlaneGeometry(.76,1.40),offsets=new Float32Array(spectators.length*2),directions=new Float32Array(spectators.length*2);
    const m=new T.MeshLambertMaterial({map:textures.spectators,alphaTest:.52,alphaToCoverage:true,side:T.DoubleSide,color:0xf2ede5});
    m.name='Photographic spectator atlas';
    m.onBeforeCompile=s=>{
      s.vertexShader='attribute vec2 atlasOffset;attribute vec2 seatDirection;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <uv_vertex>',`#include <uv_vertex>
        vMapUv=(vMapUv*vec2(.966,.978)+vec2(.017,.011))*vec2(.25,.5)+atlasOffset;
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
    m.customProgramCacheKey=()=> 'circus144-crowd-atlas';
    const mesh=new T.InstancedMesh(g,m,spectators.length);mesh.name='Seated spectators';
    spectators.forEach((p,i)=>{
      const tile=Math.floor(random()*8);offsets[i*2]=(tile%4)*.25;offsets[i*2+1]=Math.floor(tile/4)*.5;
      directions[i*2]=-Math.sin(p.angle);directions[i*2+1]=-Math.cos(p.angle);
      dummy.position.set(p.x,p.y+.12,p.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(.94+random()*.13);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      const tint=.82+random()*.17,warm=(random()-.5)*.075;mesh.setColorAt(i,new T.Color().setRGB(tint+warm,tint,tint-warm*.65));
    });
    g.setAttribute('atlasOffset',new T.InstancedBufferAttribute(offsets,2));
    g.setAttribute('seatDirection',new T.InstancedBufferAttribute(directions,2));
    mesh.computeBoundingSphere();mesh.castShadow=false;mesh.receiveShadow=true;crowd.add(mesh);
    const cg=new T.PlaneGeometry(.66,.42);cg.rotateX(-Math.PI/2);
    const cm=new T.MeshBasicMaterial({color:0x30291f,transparent:true,opacity:.24,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
    cm.onBeforeCompile=s=>{s.vertexShader='varying vec2 contactUv;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncontactUv=uv;');s.fragmentShader='varying vec2 contactUv;\n'+s.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\ndiffuseColor.a*=pow(max(0.0,1.0-length(contactUv*2.0-1.0)),1.4);');};
    cm.customProgramCacheKey=()=> 'circus144-seat-contact';
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
  group.userData={version:144,kind:'artistic-reconstruction',spectators:spectators.length,startingGates:12,rows:ROWS,photoCrowd:!!textures.spectators,rearWall:{radius:76,centerZ:START,height:28.4,joins:[[-76,START],[76,START]]},passages:passageCenters.length+passageCenters.filter(z=>z<=-108||z>=-36).length,reliefAtlas:!!textures.relief};
  return {group,crowd,materials:M,treePlacements,metadata:group.userData};
});
