// Compile tiny photographic fallbacks into the initial HTML. No image request is
// needed for these first frames, including direct entry and failed CDN requests.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),manifest=require('../assets/loading-v181/manifest.json'),previews={},pages=new Map();
for(const [key,item]of Object.entries(manifest)){
 const preview=path.join(root,'assets/loading-v181/'+key+'-preview.jpg');
 execFileSync('convert',[path.join(root,item.photo),'-resize','320x180>','-strip','-quality','45',preview]);
 previews[key]='data:image/jpeg;base64,'+fs.readFileSync(preview).toString('base64');
 const shade=item.shade===false?'':'linear-gradient(180deg,transparent 40%,#211017dd 100%),';
 const image=`url("${item.photo}"),url("${previews[key]}")`,fit=item.fit||'cover';
 const entry=pages.get(item.page)||{css:'',preloads:'',preview:previews[key]};
 entry.css+=`${item.selectors}{background-image:${shade}${image}!important;background-size:${fit}!important;background-position:center!important;background-repeat:no-repeat!important}`;
 if(!item.secondary)entry.preloads+=`<link rel="preload" as="image" href="${item.photo}" fetchpriority="high">`;
 pages.set(item.page,entry);
}
for(const [page,entry]of pages){
 const block=`<!-- loading-art-v181:start --><style id="loadingArtCritical">@layer loading-art-v181;:root{--loading-photo-preview:url("${entry.preview}")}@layer loading-art-v181{${entry.css}}</style>${entry.preloads}<!-- loading-art-v181:end -->`;
 const file=path.join(root,page),source=fs.readFileSync(file,'utf8').replace(/<!-- loading-art-v181:start -->[\s\S]*?<!-- loading-art-v181:end -->/g,'');
 fs.writeFileSync(file,source.replace(/(<meta\s+charset=[^>]+>)/i,'$1'+block));
}
const file=path.join(root,'rome-destinations-v148.js'),source=fs.readFileSync(file,'utf8').replace(/^[ \t]*\/\* loading-previews-v181:start \*\/[\s\S]*?\/\* loading-previews-v181:end \*\/[ \t]*\r?\n?/gm,'').replace(/^[ \t]+$/gm,'').replace(/\n\s*\n(?= const places=)/g,'\n');
const travel=Object.fromEntries(Object.entries(manifest).filter(([,v])=>v.travel).map(([k])=>[k,previews[k]]));
fs.writeFileSync(file,source.replace(' const places=[',' /* loading-previews-v181:start */const previews='+JSON.stringify(travel)+';/* loading-previews-v181:end */\n const places=[').replace('return {places,find:', 'return {places,preview:id=>previews[id],find:'));
console.log('Embedded',Object.keys(manifest).length,'photographic fallbacks in',pages.size,'entry pages.');
