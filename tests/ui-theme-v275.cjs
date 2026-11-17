const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'ui-theme-v275.js'),'utf8');
function page(storage=new Map(),blocked=false){
 const listeners=new Map();
 const context={document:{documentElement:{dataset:{}}},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}},localStorage:{getItem(k){if(blocked)throw Error('blocked');return storage.get(k)||null;},setItem(k,v){if(blocked)throw Error('blocked');storage.set(k,v);}},addEventListener(type,cb){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(cb);},dispatchEvent(e){for(const cb of listeners.get(e.type)||[])cb(e);}};
 vm.runInNewContext(source,context);return context;
}
test('first visit uses White Marble and does not overwrite unrelated preferences',()=>{
 const data=new Map([['ludus-camera-distance','far']]);const p=page(data);
 assert.equal(p.document.documentElement.dataset.uiTheme,'white');
 assert.deepEqual([...data],[['ludus-camera-distance','far']]);
});
test('selection persists across navigation and each available theme can be restored',()=>{
 const data=new Map();const p=page(data);
 for(const id of ['white','black','blue']){
  assert.equal(p.LudusTheme.set(id),id);
  assert.equal(page(data).document.documentElement.dataset.uiTheme,id);
 }
});
test('other open pages and back-forward cache restore the saved selection',()=>{
 const data=new Map(),a=page(data),b=page(data);
 a.LudusTheme.set('blue');b.dispatchEvent({type:'storage',key:'ludus-ui-theme'});
 assert.equal(b.LudusTheme.current(),'blue');
 a.LudusTheme.set('black');b.dispatchEvent({type:'pageshow'});
 assert.equal(b.LudusTheme.current(),'black');
 data.clear();b.dispatchEvent({type:'storage',key:null});assert.equal(b.LudusTheme.current(),'white');
});
test('invalid preferences and unavailable storage do not prevent page startup',()=>{
 assert.equal(page(new Map([['ludus-ui-theme','unknown']])).LudusTheme.current(),'white');
 const p=page(new Map(),true);assert.equal(p.LudusTheme.set('blue'),'blue');
 assert.equal(p.document.documentElement.dataset.uiTheme,'blue');
});
test('every game HTML entry loads the shared theme before existing styles and scripts',()=>{
 const files=fs.readdirSync(root).filter(f=>f.endsWith('.html'));
 for(const file of files){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  assert.equal((html.match(/src="ui-theme-v275\.js\?v=revision275"/g)||[]).length,1,file);
  assert.equal((html.match(/href="ui-theme-v275\.css\?v=revision275"/g)||[]).length,1,file);
  const head=html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1]||'';
  assert.ok(head.indexOf('@layer ludus-theme-v275')<head.indexOf('ui-theme-v275.js'),file);
  assert.ok(head.indexOf('ui-theme-v275.js')>=0,file);
 }
});
