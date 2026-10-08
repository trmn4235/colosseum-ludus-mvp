// Bake the existing, licensed city models into spatial image cards, not AI imagery.
// CITY_SOURCE=/path/to/source node tools/bake-city-backdrop.cjs
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright'),sharp=require('sharp');
const root=path.resolve(__dirname,'..'),source=path.resolve(process.env.CITY_SOURCE||root);
const output=path.resolve(process.env.CITY_ASSET_OUTPUT||path.join(root,'assets/city'));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const pageSource=fs.readFileSync(path.join(source,'ludus.html'),'utf8');
const start=pageSource.indexOf('var ROMAN_PBR_ASSETS='),end=pageSource.indexOf('\n})();',start)+7;
if(start<0||end<start)throw Error('City PBR source not found');
const pbrSource=pageSource.slice(start,end);
const mime={'.js':'text/javascript','.glb':'model/gltf-binary','.jpg':'image/jpeg','.webp':'image/webp'};
const bakeHtml=`<!doctype html><meta charset="utf-8"><canvas id="bake"></canvas><script src="owner-three-r160.js"></script><script>${pbrSource}</script><script src="ludus-city-v29.js"></script><script>
const T=THREE,renderer=new T.WebGLRenderer({canvas:document.getElementById('bake'),alpha:true,antialias:true,preserveDrawingBuffer:true,logarithmicDepthBuffer:true});
renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
const scene=new T.Scene();scene.add(new T.HemisphereLight(0xe4efff,0x897654,1.35));
const sun=new T.DirectionalLight(0xffe6bd,2.7);sun.position.set(-13,24,-16);scene.add(sun);
const city=LudusCity.create(scene,renderer,sun,{mode:'3d'}),reference=new T.Vector3(0,5,0);
window.bakeReady=(async()=>{await city.ready;await RomanVisualAssets.ready();
if(Object.keys(scene.userData).some(k=>k.endsWith('LoadError')))throw Error('Missing source model');
scene.background=null;renderer.setClearColor(0x000000,0);city.root.updateMatrixWorld(true);
window.bakeGroups=city.root.children.filter(o=>o.isGroup).sort((a,b)=>a.position.x-b.position.x||a.position.z-b.position.z||a.name.localeCompare(b.name));
city.root.children.forEach(o=>o.visible=false);return bakeGroups.length;})();
window.bakeCard=index=>{
const object=bakeGroups[index];bakeGroups.forEach(o=>o.visible=o===object);
const box=new T.Box3().setFromObject(object),center=box.getCenter(new T.Vector3());
const camera=new T.PerspectiveCamera(58,1,.08,5500);camera.position.copy(reference);camera.lookAt(center);camera.updateMatrixWorld(true);
const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1),forward=center.clone().sub(reference).normalize(),distance=center.distanceTo(reference);
let left=Infinity,bottom=Infinity,r=-Infinity,top=-Infinity;
for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
const v=new T.Vector3(x,y,z).sub(reference),depth=v.dot(forward);left=Math.min(left,v.dot(right)/depth);r=Math.max(r,v.dot(right)/depth);bottom=Math.min(bottom,v.dot(up)/depth);top=Math.max(top,v.dot(up)/depth);}
// Three times the 844x390, DPR 1.5 angular pixel density, including filter gutters.
const margin=.025,dx=(r-left)*margin,dy=(top-bottom)*margin;left-=dx;r+=dx;bottom-=dy;top+=dy;
const width=Math.min(512,Math.max(24,Math.ceil((r-left)*1600/8)*8)),height=Math.min(512,Math.max(24,Math.ceil((top-bottom)*1600/8)*8));
camera.projectionMatrix.makePerspective(left*.08,r*.08,top*.08,bottom*.08,.08,5500);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
renderer.setSize(width,height,false);renderer.render(scene,camera);
const vertices=[[left,bottom],[r,bottom],[r,top],[left,top]].map(([x,y])=>reference.clone().addScaledVector(forward,distance).addScaledVector(right,x*distance).addScaledVector(up,y*distance).toArray());
let triangles=0;object.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
return{name:object.name||'district',position:object.position.toArray(),width,height,vertices,sourceTriangles:triangles,png:renderer.domElement.toDataURL('image/png').split(',')[1]};
};</script>`;
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/__city-bake.html'){res.writeHead(200,{'content-type':'text/html'});res.end(bakeHtml);return;}
 const file=path.resolve(source,'.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(source+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'});res.end(fs.readFileSync(file));
});
async function main(){
 fs.mkdirSync(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/tmp/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/__city-bake.html');
 const count=await page.evaluate(()=>bakeReady),cards=[];
 for(let i=0;i<count;i++){cards.push(await page.evaluate(i=>bakeCard(i),i));if(i%40===0)console.log('Baked '+(i+1)+' / '+count);}
 if(errors.length)throw Error(errors.join('\n'));
 const atlasWidth=2048,gutter=8;let x=0,y=0,rowHeight=0;
 // Taller images first make the deterministic shelf packing compact.
 cards.sort((a,b)=>b.height-a.height||b.width-a.width||a.position[0]-b.position[0]);
 for(const card of cards){if(x+card.width+gutter*2>atlasWidth){x=0;y+=rowHeight;rowHeight=0;}card.rect=[x+gutter,y+gutter,card.width,card.height];x+=card.width+gutter*2;rowHeight=Math.max(rowHeight,card.height+gutter*2);}
 const atlasHeight=2**Math.ceil(Math.log2(y+rowHeight));
 if(atlasHeight>2048)throw Error('Atlas exceeds mobile texture budget');
 const atlas=await sharp({create:{width:atlasWidth,height:atlasHeight,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(cards.map(c=>({input:Buffer.from(c.png,'base64'),left:c.rect[0],top:c.rect[1]}))).webp({lossless:true}).toBuffer();
 const sha=digest(atlas),atlasFile='rome-backdrop-'+sha.slice(0,12)+'.webp';fs.writeFileSync(path.join(output,atlasFile),atlas);
 const files=['ludus-city-v29.js','rome-insula-v30.glb','rome-forum-v30.glb','rome-temple-v30.glb','rome-gateway-v30.glb','colosseum-city-v29.glb','pantheon-city-v29.glb','rome-sky-v29.jpg'];
 const manifest={version:1,reference:[0,5,0],format:'spatial image cards',atlas:{file:'assets/city/'+atlasFile,width:atlasWidth,height:atlasHeight,bytes:atlas.length,sha256:sha},bake:{threeRevision:'160',exposure:1.03,fogDensity:.00032,angularPixelsPerTangent:1600,sourceHashes:Object.fromEntries(files.map(f=>[f,digest(fs.readFileSync(path.join(source,f)))])),pbrSourceHash:digest(pbrSource)},cards:cards.map(({png,width,height,...c})=>({...c,vertices:c.vertices.map(v=>v.map(n=>Number(n.toFixed(6))))}))};
 fs.writeFileSync(path.join(output,'rome-backdrop-v39.json'),JSON.stringify(manifest)+'\n');
 console.log(JSON.stringify({pass:true,cards:count,sourceTriangles:cards.reduce((n,c)=>n+c.sourceTriangles,0),atlasFile,atlasBytes:atlas.length,atlasSize:[atlasWidth,atlasHeight]}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
