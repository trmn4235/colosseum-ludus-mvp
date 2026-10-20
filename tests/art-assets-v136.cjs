// Shipped assets, provenance, payload budget and the important CSS layer order.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file));
const pages=['index','ludus','savas','arena','multiplayer','gelistirmeler','pazar','gorevler','klan','ludus-seviye','caravan-field'];
for(const page of pages){
 const html=read(page+'.html').toString();
 assert.match(html,/<body[^>]*data-art-direction="136"/);
 assert.match(html,/<head>\s*<link rel="stylesheet" href="game-art-v136.css\?v=revision140">/,'art layer registered before legacy styles: '+page);
}
const css=read('game-art-v136.css').toString();
assert.match(css,/@layer game-art-v136;/);
assert.match(read('game-panels-v123.css').toString(),/@layer game-art-v136, game-windows;/);
for(const [,url]of css.matchAll(/url\(['"]?([^'"\s)]+)['"]?\)/g))assert.ok(fs.existsSync(path.join(root,url)),'CSS asset exists: '+url);
const manifest=JSON.parse(read('assets/art-v136/manifest.json'));
assert.equal(manifest.assets.length,5);
let total=0;
for(const asset of [...manifest.assets,manifest.font]){
 const bytes=read(asset.path);total+=bytes.length;
 assert.equal(bytes.length,asset.bytes,asset.path+' byte count');
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.path+' content hash');
 if(asset.mode){assert.equal(asset.mode,'generate');assert.ok(asset.prompt.length>100,'full prompt retained');}
}
assert.ok(total<1000000,'new art and local font stay below 1 MB');
assert.match(read(manifest.font.license).toString(),/SIL OPEN FONT LICENSE/);
console.log(JSON.stringify({pages:pages.length,generatedAssets:5,bytes:total,localFont:true,layerOrder:true}));
