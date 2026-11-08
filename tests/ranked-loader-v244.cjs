const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const code=fs.readFileSync('ludus-client-v84.js','utf8');
function run(pathname,online=true){
 const added=[];const document={readyState:'complete',querySelector:()=>added[0]||null,createElement:()=>({dataset:{}}),body:{append(x){added.push(x)}}};
 const context={document,location:{pathname},supabase:online?{}:undefined};context.globalThis=context;vm.runInNewContext(code,context);return added;
}
assert.equal(run('/savas.html').length,1);assert.equal(run('/pazar.html')[0].src,'ranked-invites-v244.js?v=244');
assert.equal(run('/ranked-team-v244.html').length,0);assert.equal(run('/savas.html',false).length,0);
console.log('V244 LOADER PASS: shared game pages install one invitation indicator; ranked page and unavailable client are excluded.');
