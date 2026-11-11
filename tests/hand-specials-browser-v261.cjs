const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const root=path.resolve(__dirname,'..'),out='/tmp/hand-specials-v261';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://x').pathname;let file=path.resolve(root,'.'+name);if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404).end();return;}let body=fs.readFileSync(file);if(file.endsWith('.html'))body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(body);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 for(const type of ['arena','multiplayer']){
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+type+'.html');
  if(type==='multiplayer'){const s=fs.readFileSync(root+'/multiplayer-v36.js','utf8'),a=s.indexOf(' const icons='),b=s.indexOf(" $('mpBack').textContent",a);await page.evaluate("const $=id=>document.getElementById(id);"+s.slice(a,b));}
  await page.evaluate(type=>{if(type==='arena'){document.getElementById('controls').style.display='';document.getElementById('specialLabel').textContent='SAĞ · İKİ VURUŞ';document.getElementById('specialLeftLabel').textContent='SOL · KALKAN KIR';}else{document.getElementById('duelControls').hidden=false;document.getElementById('duelSpecial').querySelector('small').textContent='SAĞ · İKİ VURUŞ';document.getElementById('duelSpecialLeft').querySelector('small').textContent='SOL · KALKAN KIR';}},type);
  for(const [width,height]of [[667,375],[844,390],[932,430],[390,844]]){
   await page.setViewportSize({width,height});const ids=type==='arena'?['special','specialLeft','attack','block','dodge']:['duelSpecial','duelSpecialLeft','duelAttack','duelBlock','duelDodge'];
   const report=await page.evaluate(ids=>({scroll:document.documentElement.scrollHeight>innerHeight+1,buttons:ids.map(id=>{const b=document.getElementById(id),r=b.getBoundingClientRect();return{id,x:r.x,y:r.y,width:r.width,height:r.height,overflow:b.scrollWidth>b.clientWidth+2}})}),ids);
   assert.equal(report.scroll,false,JSON.stringify({type,width,report}));
   for(const b of report.buttons)assert.ok(b.width>25&&b.height>25&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,JSON.stringify({type,width,b}));
   for(let i=0;i<report.buttons.length;i++)for(let j=i+1;j<report.buttons.length;j++){const a=report.buttons[i],b=report.buttons[j];assert.ok(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,JSON.stringify({type,width,a,b}));}
   await page.screenshot({path:out+'/'+type+'-'+width+'x'+height+'.png'});
  }
  assert.equal(await page.locator(type==='arena'?'#hand':'#duelHand').count(),0);
 }
 assert.deepEqual(errors,[]);console.log('PASS V261: right/left controls fit four phone viewports, no overlaps, no switch button or vertical scrolling.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
