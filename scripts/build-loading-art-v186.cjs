// Preserve original photo pixels from the first frame, including offline entry.
// One inline source is shared by CSS layers instead of scaling a 320 px thumbnail.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),manifest=require('../assets/loading-v181/manifest.json'),previews={},pages=new Map();
for(const [key,item]of Object.entries(manifest)){
 const ext=path.extname(item.photo).toLowerCase(),mime=ext==='.webp'?'image/webp':'image/jpeg';
 previews[key]='data:'+mime+';base64,'+fs.readFileSync(path.join(root,item.photo)).toString('base64');
 const shade=item.shade===false?'':'linear-gradient(180deg,transparent 40%,#211017dd 100%),';
 const inline=previews[key].length>750000,image=`${inline?`url("${previews[key]}")`:`var(--loading-photo-${key})`},url("${item.photo}")`,fit=item.fit||'cover';
 const entry=pages.get(item.page)||{css:'',variables:'',preloads:'',previewKey:key};
 if(!inline)entry.variables+=`--loading-photo-${key}:url("${previews[key]}");`;
 entry.css+=`${item.selectors}{background-image:${shade}${image}!important;background-size:${fit}!important;background-position:center!important;background-repeat:no-repeat!important}`;

 pages.set(item.page,entry);
}
for(const [page,entry]of pages){
 const block=`<!-- loading-art-v181:start --><style id="loadingArtCritical">@layer loading-art-v181;:root{${entry.variables}--loading-photo-preview:var(--loading-photo-${entry.previewKey})}@layer loading-art-v181{${entry.css}}</style>${entry.preloads}<!-- loading-art-v181:end -->`;
 const file=path.join(root,page),source=fs.readFileSync(file,'utf8').replace(/<!-- loading-art-v181:start -->[\s\S]*?<!-- loading-art-v181:end -->/g,'');
 fs.writeFileSync(file,source.replace(/(<meta\s+charset=[^>]+>)/i,'$1'+block));
}
const file=path.join(root,'rome-destinations-v148.js'),source=fs.readFileSync(file,'utf8').replace(/^[ \t]*\/\* loading-previews-v181:start \*\/[\s\S]*?\/\* loading-previews-v181:end \*\/[ \t]*\r?\n?/gm,'').replace(/^[ \t]+$/gm,'').replace(/\n\s*\n(?= const places=)/g,'\n');
const travel=Object.fromEntries(Object.entries(manifest).filter(([,v])=>v.travel).map(([k])=>[k,previews[k]]));
fs.writeFileSync(file,source.replace(' const places=[',' /* loading-previews-v181:start */const previews='+JSON.stringify(travel)+';/* loading-previews-v181:end */\n const places=[').replace('return {places,find:', 'return {places,preview:id=>previews[id],find:'));
console.log('Embedded original-resolution',Object.keys(manifest).length,'photographic fallbacks in',pages.size,'entry pages.');
