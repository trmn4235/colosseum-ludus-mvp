const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const playwright=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright':'playwright');
const engine=process.env.LUDUS_TEST_ENGINE||'chromium',root=path.resolve(__dirname,'..'),out=process.env.LUDUS_TEST_OUTPUT||'/tmp/hand-specials-v261';
(async()=>{
 fs.mkdirSync(out,{recursive:true});const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://x').pathname;let file=path.resolve(root,'.'+name);if(!file.startsWith(root+'/')||!fs.existsSync(file)){res.writeHead(404).end();return;}let body=fs.readFileSync(file);if(file.endsWith('.html'))body=Buffer.from(body.toString().replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(body);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{args:['--no-sandbox'],...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})}: {})});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 for(const type of ['arena','multiplayer']){
  await page.goto('http://127.0.0.1:'+server.address().port+'/'+type+'.html');
  if(type==='multiplayer'){const s=fs.readFileSync(root+'/multiplayer-v36.js','utf8'),a=s.indexOf(' const icons='),b=s.indexOf(" $('mpBack').textContent",a);await page.evaluate("const $=id=>document.getElementById(id);"+s.slice(a,b));}
  await page.evaluate(type=>{if(type==='arena'){document.body.classList.add('arena-ready');document.getElementById('controls').style.display='';document.getElementById('specialLabel').textContent='SAĞ · İKİ VURUŞ';document.getElementById('specialLeftLabel').textContent='SOL · KALKAN KIR';}else{document.getElementById('matchLobby').hidden=true;document.getElementById('duelControls').hidden=false;document.getElementById('duelSpecial').querySelector('small').textContent='SAĞ · İKİ VURUŞ';document.getElementById('duelSpecialLeft').querySelector('small').textContent='SOL · KALKAN KIR';}},type);
  for(const [width,height]of [[568,320],[667,375],[844,390],[932,430],[1024,768],[1536,706],[390,844]]){
   await page.setViewportSize({width,height});const ids=type==='arena'?['specialLeft','target','special','block','attack','dodge']:['duelSpecialLeft','duelTarget','duelSpecial','duelBlock','duelAttack','duelDodge'];
   const report=await page.evaluate(ids=>({scroll:document.documentElement.scrollHeight>innerHeight+1,buttons:ids.map(id=>{const b=document.getElementById(id),r=b.getBoundingClientRect(),s=getComputedStyle(b),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id,x:r.x,y:r.y,width:r.width,height:r.height,overflow:b.scrollWidth>b.clientWidth+2||b.scrollHeight>b.clientHeight+2,visible:s.visibility==='visible'&&s.display!=='none',touchable:hit===b||b.contains(hit),radius:s.borderRadius,iconWidth:b.querySelector('svg')?.getBoundingClientRect().width}})}),ids);
   assert.equal(report.scroll,false,JSON.stringify({type,width,report}));
   for(const b of report.buttons)assert.ok(b.width>25&&b.height>25&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,JSON.stringify({type,width,b}));
   for(let i=0;i<report.buttons.length;i++)for(let j=i+1;j<report.buttons.length;j++){const a=report.buttons[i],b=report.buttons[j];assert.ok(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,JSON.stringify({type,width,a,b}));}
   const [left,lock,right,block,attack,roll]=report.buttons,cx=b=>b.x+b.width/2,cy=b=>b.y+b.height/2,near=(a,b)=>assert.ok(Math.abs(a-b)<1,JSON.stringify({type,width,a,b}));
   near(left.width,right.width);near(left.height,right.height);near(left.iconWidth,right.iconWidth);assert.equal(left.radius,right.radius);
   near(cy(left),cy(lock));near(cy(lock),cy(right));near(cx(lock)-cx(left),cx(right)-cx(lock));near(cx(lock),cx(attack));near(cx(left),cx(block));near(cx(right),cx(roll));
   if(width>height)for(const b of report.buttons){assert.ok(b.visible&&b.touchable,JSON.stringify({type,width,b}));assert.equal(b.overflow,false,JSON.stringify({type,width,b}));}
   await page.screenshot({path:out+'/'+engine+'-'+type+'-'+width+'x'+height+'.png'});
  }
  assert.equal(await page.locator(type==='arena'?'#hand':'#duelHand').count(),0);
 }
 assert.deepEqual(errors,[]);console.log('PASS V261 '+engine+': mirrored hand specials, centred target lock, visible touch controls, seven viewports, no overlaps or switch button.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
